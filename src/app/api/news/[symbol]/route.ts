import { NextResponse } from 'next/server';

export interface NewsItem {
  id: string;
  title: string;
  summary: string;
  url: string;
  source: string;
  publishedAt: Date;
  thumbnail?: string;
  sentiment?: string;
}

// Finnhub API for company news
async function fetchFinnhubNews(symbol: string): Promise<NewsItem[]> {
  const apiKey = process.env.FINNHUB_API_KEY;

  if (!apiKey) {
    console.warn('FINNHUB_API_KEY not set');
    return [];
  }

  try {
    // Get news from last 7 days
    const toDate = new Date();
    const fromDate = new Date();
    fromDate.setDate(fromDate.getDate() - 7);

    const from = fromDate.toISOString().split('T')[0];
    const to = toDate.toISOString().split('T')[0];

    const response = await fetch(
      `https://finnhub.io/api/v1/company-news?symbol=${symbol}&from=${from}&to=${to}&token=${apiKey}`,
      { next: { revalidate: 300 } } // Cache for 5 minutes
    );

    if (!response.ok) {
      throw new Error(`Finnhub API error: ${response.status}`);
    }

    const data = await response.json();

    return data.slice(0, 20).map((item: any, index: number) => ({
      id: `finnhub-${symbol}-${index}-${item.datetime}`,
      title: item.headline || '無標題',
      summary: item.summary || '',
      url: item.url || '#',
      source: item.source || 'Finnhub',
      publishedAt: new Date(item.datetime * 1000),
      thumbnail: item.image || undefined,
      sentiment: item.sentiment,
    }));
  } catch (error) {
    console.error('Finnhub API error:', error);
    return [];
  }
}

// Alpha Vantage News API as backup
async function fetchAlphaVantageNews(symbol: string): Promise<NewsItem[]> {
  const apiKey = process.env.ALPHA_VANTAGE_API_KEY;

  if (!apiKey) {
    return [];
  }

  try {
    const response = await fetch(
      `https://www.alphavantage.co/query?function=NEWS_SENTIMENT&tickers=${symbol}&apikey=${apiKey}`,
      { next: { revalidate: 300 } }
    );

    if (!response.ok) {
      throw new Error(`Alpha Vantage API error: ${response.status}`);
    }

    const data = await response.json();

    if (!data.feed) {
      return [];
    }

    return data.feed.slice(0, 20).map((item: any, index: number) => ({
      id: `av-${symbol}-${index}-${Date.now()}`,
      title: item.title || '無標題',
      summary: item.summary || '',
      url: item.url || '#',
      source: item.source || 'Alpha Vantage',
      publishedAt: new Date(item.time_published?.replace(/(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})/, '$1-$2-$3T$4:$5:$6') || Date.now()),
      thumbnail: item.banner_image || undefined,
      sentiment: item.overall_sentiment_label,
    }));
  } catch (error) {
    console.error('Alpha Vantage API error:', error);
    return [];
  }
}

// Marketaux News API
async function fetchMarketauxNews(symbol: string): Promise<NewsItem[]> {
  const apiKey = process.env.MARKETAUX_API_KEY;

  if (!apiKey) {
    return [];
  }

  try {
    const response = await fetch(
      `https://api.marketaux.com/v1/news/all?symbols=${symbol}&filter_entities=true&language=en&api_token=${apiKey}`,
      { next: { revalidate: 300 } }
    );

    if (!response.ok) {
      throw new Error(`Marketaux API error: ${response.status}`);
    }

    const data = await response.json();

    if (!data.data) {
      return [];
    }

    return data.data.slice(0, 20).map((item: any, index: number) => ({
      id: `marketaux-${symbol}-${index}-${Date.now()}`,
      title: item.title || '無標題',
      summary: item.description || '',
      url: item.url || '#',
      source: item.source || 'Marketaux',
      publishedAt: new Date(item.published_at || Date.now()),
      thumbnail: item.image_url || undefined,
      sentiment: item.sentiment,
    }));
  } catch (error) {
    console.error('Marketaux API error:', error);
    return [];
  }
}

// Fallback: Use a public RSS feed parser for financial news
async function fetchFallbackNews(symbol: string): Promise<NewsItem[]> {
  try {
    // Use Google News RSS as fallback
    const query = encodeURIComponent(`${symbol} stock`);
    const response = await fetch(
      `https://news.google.com/rss/search?q=${query}&hl=en-US&gl=US&ceid=US:en`,
      { next: { revalidate: 300 } }
    );

    if (!response.ok) {
      return [];
    }

    const text = await response.text();

    // Simple XML parsing for RSS
    const items: NewsItem[] = [];
    const itemMatches = text.match(/<item>([\s\S]*?)<\/item>/g) || [];

    itemMatches.slice(0, 15).forEach((itemXml, index) => {
      const title = itemXml.match(/<title>([\s\S]*?)<\/title>/)?.[1]?.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1') || '';
      const link = itemXml.match(/<link>([\s\S]*?)<\/link>/)?.[1] || '';
      const pubDate = itemXml.match(/<pubDate>([\s\S]*?)<\/pubDate>/)?.[1] || '';
      const source = itemXml.match(/<source[^>]*>([\s\S]*?)<\/source>/)?.[1] || 'Google News';

      if (title && link) {
        items.push({
          id: `google-${symbol}-${index}-${Date.now()}`,
          title: title.trim(),
          summary: '',
          url: link.trim(),
          source: source.trim(),
          publishedAt: pubDate ? new Date(pubDate) : new Date(),
        });
      }
    });

    return items;
  } catch (error) {
    console.error('Fallback news error:', error);
    return [];
  }
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ symbol: string }> }
) {
  try {
    const { symbol } = await params;
    const upperSymbol = symbol.toUpperCase();

    // Try multiple sources in order of preference
    let news: NewsItem[] = [];

    // 1. Try Finnhub first
    news = await fetchFinnhubNews(upperSymbol);

    // 2. If no results, try Alpha Vantage
    if (news.length === 0) {
      news = await fetchAlphaVantageNews(upperSymbol);
    }

    // 3. If still no results, try Marketaux
    if (news.length === 0) {
      news = await fetchMarketauxNews(upperSymbol);
    }

    // 4. Fallback to Google News RSS
    if (news.length === 0) {
      news = await fetchFallbackNews(upperSymbol);
    }

    // Sort by most recent first
    news.sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());

    return NextResponse.json({ news });
  } catch (error) {
    console.error('Error fetching news:', error);
    return NextResponse.json({ news: [] });
  }
}
