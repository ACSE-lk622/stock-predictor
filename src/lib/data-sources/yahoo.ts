import type {
  StockQuote,
  HistoricalDataPoint,
  StockSearchResult,
} from '@/types/stock';

const YAHOO_API_BASE = 'https://query1.finance.yahoo.com/v8/finance';

export class YahooFinanceService {
  async getQuote(symbol: string): Promise<StockQuote | null> {
    try {
      const response = await fetch(
        `${YAHOO_API_BASE}/chart/${symbol}?interval=1d&range=1d`,
        {
          headers: {
            'User-Agent': 'Mozilla/5.0',
          },
          next: { revalidate: 60 },
        }
      );

      if (!response.ok) {
        throw new Error(`Yahoo API error: ${response.status}`);
      }

      const data = await response.json();
      const result = data.chart?.result?.[0];

      if (!result) {
        return null;
      }

      const meta = result.meta;
      const quote = result.indicators?.quote?.[0];
      const lastIndex = quote?.close?.length - 1;

      return {
        symbol: meta.symbol,
        name: meta.shortName || meta.symbol,
        price: meta.regularMarketPrice,
        change: meta.regularMarketPrice - meta.previousClose,
        changePercent:
          ((meta.regularMarketPrice - meta.previousClose) /
            meta.previousClose) *
          100,
        open: quote?.open?.[lastIndex] || meta.regularMarketOpen,
        high: quote?.high?.[lastIndex] || meta.regularMarketDayHigh,
        low: quote?.low?.[lastIndex] || meta.regularMarketDayLow,
        volume: quote?.volume?.[lastIndex] || meta.regularMarketVolume,
        marketCap: meta.marketCap,
        timestamp: new Date(meta.regularMarketTime * 1000),
      };
    } catch (error) {
      console.error(`Error fetching quote for ${symbol}:`, error);
      return null;
    }
  }

  async getHistoricalData(
    symbol: string,
    period: '1d' | '5d' | '1mo' | '3mo' | '6mo' | '1y' | '2y' | '5y' = '1y'
  ): Promise<HistoricalDataPoint[]> {
    try {
      // 根據時間區間選擇適當的 interval
      let interval = '1d';
      if (period === '1d') {
        interval = '5m'; // 1日：每5分鐘
      } else if (period === '5d') {
        interval = '15m'; // 5日：每15分鐘
      }

      const response = await fetch(
        `${YAHOO_API_BASE}/chart/${symbol}?interval=${interval}&range=${period}`,
        {
          headers: {
            'User-Agent': 'Mozilla/5.0',
          },
          next: { revalidate: period === '1d' ? 60 : 300 }, // 1日資料更頻繁更新
        }
      );

      if (!response.ok) {
        throw new Error(`Yahoo API error: ${response.status}`);
      }

      const data = await response.json();
      const result = data.chart?.result?.[0];

      if (!result) {
        return [];
      }

      const timestamps = result.timestamp || [];
      const quote = result.indicators?.quote?.[0] || {};
      const adjClose = result.indicators?.adjclose?.[0]?.adjclose || [];

      const historicalData: HistoricalDataPoint[] = [];

      for (let i = 0; i < timestamps.length; i++) {
        if (
          quote.open?.[i] != null &&
          quote.high?.[i] != null &&
          quote.low?.[i] != null &&
          quote.close?.[i] != null
        ) {
          historicalData.push({
            date: new Date(timestamps[i] * 1000),
            open: quote.open[i],
            high: quote.high[i],
            low: quote.low[i],
            close: quote.close[i],
            volume: quote.volume?.[i] || 0,
            adjClose: adjClose[i],
          });
        }
      }

      return historicalData;
    } catch (error) {
      console.error(`Error fetching historical data for ${symbol}:`, error);
      return [];
    }
  }

  async searchStocks(query: string): Promise<StockSearchResult[]> {
    try {
      const response = await fetch(
        `https://query2.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(
          query
        )}&quotesCount=10&newsCount=0`,
        {
          headers: {
            'User-Agent': 'Mozilla/5.0',
          },
        }
      );

      if (!response.ok) {
        throw new Error(`Yahoo API error: ${response.status}`);
      }

      const data = await response.json();
      const quotes = data.quotes || [];

      return quotes
        .filter(
          (q: Record<string, unknown>) =>
            q.quoteType === 'EQUITY' || q.quoteType === 'ETF'
        )
        .map((q: Record<string, unknown>) => ({
          symbol: q.symbol as string,
          name: (q.shortname || q.longname || q.symbol) as string,
          exchange: q.exchange as string,
          type: q.quoteType as string,
        }));
    } catch (error) {
      console.error(`Error searching stocks for "${query}":`, error);
      return [];
    }
  }
}

export const yahooFinance = new YahooFinanceService();
