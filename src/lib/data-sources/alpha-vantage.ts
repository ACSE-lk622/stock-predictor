import type { HistoricalDataPoint, StockQuote } from '@/types/stock';

const ALPHA_VANTAGE_BASE = 'https://www.alphavantage.co/query';

export class AlphaVantageService {
  private apiKey: string;

  constructor(apiKey?: string) {
    this.apiKey = apiKey || process.env.ALPHA_VANTAGE_API_KEY || 'demo';
  }

  async getQuote(symbol: string): Promise<StockQuote | null> {
    try {
      const response = await fetch(
        `${ALPHA_VANTAGE_BASE}?function=GLOBAL_QUOTE&symbol=${symbol}&apikey=${this.apiKey}`,
        { next: { revalidate: 60 } }
      );

      if (!response.ok) {
        throw new Error(`Alpha Vantage API error: ${response.status}`);
      }

      const data = await response.json();
      const quote = data['Global Quote'];

      if (!quote || Object.keys(quote).length === 0) {
        return null;
      }

      const price = parseFloat(quote['05. price']);
      const previousClose = parseFloat(quote['08. previous close']);

      return {
        symbol: quote['01. symbol'],
        name: quote['01. symbol'],
        price,
        change: parseFloat(quote['09. change']),
        changePercent: parseFloat(quote['10. change percent'].replace('%', '')),
        open: parseFloat(quote['02. open']),
        high: parseFloat(quote['03. high']),
        low: parseFloat(quote['04. low']),
        volume: parseInt(quote['06. volume']),
        timestamp: new Date(quote['07. latest trading day']),
      };
    } catch (error) {
      console.error(`Error fetching Alpha Vantage quote for ${symbol}:`, error);
      return null;
    }
  }

  async getHistoricalData(
    symbol: string,
    outputSize: 'compact' | 'full' = 'full'
  ): Promise<HistoricalDataPoint[]> {
    try {
      const response = await fetch(
        `${ALPHA_VANTAGE_BASE}?function=TIME_SERIES_DAILY_ADJUSTED&symbol=${symbol}&outputsize=${outputSize}&apikey=${this.apiKey}`,
        { next: { revalidate: 300 } }
      );

      if (!response.ok) {
        throw new Error(`Alpha Vantage API error: ${response.status}`);
      }

      const data = await response.json();
      const timeSeries = data['Time Series (Daily)'];

      if (!timeSeries) {
        return [];
      }

      const historicalData: HistoricalDataPoint[] = [];

      for (const [dateStr, values] of Object.entries(timeSeries)) {
        const v = values as Record<string, string>;
        historicalData.push({
          date: new Date(dateStr),
          open: parseFloat(v['1. open']),
          high: parseFloat(v['2. high']),
          low: parseFloat(v['3. low']),
          close: parseFloat(v['4. close']),
          volume: parseInt(v['6. volume']),
          adjClose: parseFloat(v['5. adjusted close']),
        });
      }

      return historicalData.sort(
        (a, b) => a.date.getTime() - b.date.getTime()
      );
    } catch (error) {
      console.error(
        `Error fetching Alpha Vantage historical data for ${symbol}:`,
        error
      );
      return [];
    }
  }

  async getTechnicalIndicator(
    symbol: string,
    indicator: 'RSI' | 'MACD' | 'BBANDS' | 'SMA' | 'EMA',
    timePeriod: number = 14
  ): Promise<Record<string, number>[]> {
    try {
      let functionName = indicator;
      let params = `&symbol=${symbol}&interval=daily&time_period=${timePeriod}&series_type=close`;

      if (indicator === 'MACD') {
        params = `&symbol=${symbol}&interval=daily&series_type=close`;
      } else if (indicator === 'BBANDS') {
        params = `&symbol=${symbol}&interval=daily&time_period=${timePeriod}&series_type=close`;
      }

      const response = await fetch(
        `${ALPHA_VANTAGE_BASE}?function=${functionName}${params}&apikey=${this.apiKey}`,
        { next: { revalidate: 300 } }
      );

      if (!response.ok) {
        throw new Error(`Alpha Vantage API error: ${response.status}`);
      }

      const data = await response.json();
      const technicalKey = Object.keys(data).find((key) =>
        key.startsWith('Technical Analysis')
      );

      if (!technicalKey) {
        return [];
      }

      const technicalData = data[technicalKey];
      const result: Record<string, number>[] = [];

      for (const [dateStr, values] of Object.entries(technicalData)) {
        const entry: Record<string, number> = { date: new Date(dateStr).getTime() };
        for (const [key, value] of Object.entries(
          values as Record<string, string>
        )) {
          entry[key] = parseFloat(value);
        }
        result.push(entry);
      }

      return result.sort((a, b) => a.date - b.date);
    } catch (error) {
      console.error(
        `Error fetching ${indicator} for ${symbol}:`,
        error
      );
      return [];
    }
  }
}

export const alphaVantage = new AlphaVantageService();
