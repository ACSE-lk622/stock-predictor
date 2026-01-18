import type {
  StockQuote,
  HistoricalDataPoint,
  StockSearchResult,
  TechnicalIndicators,
} from '@/types/stock';
import { yahooFinance } from './yahoo';
import { alphaVantage } from './alpha-vantage';

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

class DataCache {
  private cache: Map<string, CacheEntry<unknown>> = new Map();
  private defaultTTL: number = 60000; // 1 minute

  get<T>(key: string): T | null {
    const entry = this.cache.get(key) as CacheEntry<T> | undefined;
    if (!entry) return null;
    if (Date.now() - entry.timestamp > this.defaultTTL) {
      this.cache.delete(key);
      return null;
    }
    return entry.data;
  }

  set<T>(key: string, data: T, ttl?: number): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
    });
    if (ttl) {
      setTimeout(() => this.cache.delete(key), ttl);
    }
  }

  clear(): void {
    this.cache.clear();
  }
}

export class StockDataAggregator {
  private cache = new DataCache();

  async getQuote(symbol: string): Promise<StockQuote | null> {
    const cacheKey = `quote:${symbol}`;
    const cached = this.cache.get<StockQuote>(cacheKey);
    if (cached) return cached;

    // Try Yahoo Finance first (more reliable for real-time data)
    let quote = await yahooFinance.getQuote(symbol);

    // Fallback to Alpha Vantage if Yahoo fails
    if (!quote) {
      quote = await alphaVantage.getQuote(symbol);
    }

    if (quote) {
      this.cache.set(cacheKey, quote);
    }

    return quote;
  }

  async getHistoricalData(
    symbol: string,
    period: '1d' | '5d' | '1mo' | '3mo' | '6mo' | '1y' | '2y' | '5y' = '1y'
  ): Promise<HistoricalDataPoint[]> {
    const cacheKey = `historical:${symbol}:${period}`;
    const cached = this.cache.get<HistoricalDataPoint[]>(cacheKey);
    if (cached) return cached;

    // Try Yahoo Finance first
    let data = await yahooFinance.getHistoricalData(symbol, period);

    // Fallback to Alpha Vantage if needed (only for daily data)
    if (data.length === 0 && period !== '1d' && period !== '5d') {
      const outputSize = period === '1mo' || period === '3mo' ? 'compact' : 'full';
      data = await alphaVantage.getHistoricalData(symbol, outputSize);

      // Filter based on period
      const now = new Date();
      const periodDays: Record<string, number> = {
        '1d': 1,
        '5d': 5,
        '1mo': 30,
        '3mo': 90,
        '6mo': 180,
        '1y': 365,
        '2y': 730,
        '5y': 1825,
      };
      const cutoff = new Date(
        now.getTime() - periodDays[period] * 24 * 60 * 60 * 1000
      );
      data = data.filter((d) => d.date >= cutoff);
    }

    if (data.length > 0) {
      // 1日和5日資料快取時間較短
      const cacheTTL = period === '1d' ? 60000 : period === '5d' ? 120000 : 300000;
      this.cache.set(cacheKey, data, cacheTTL);
    }

    return data;
  }

  async searchStocks(query: string): Promise<StockSearchResult[]> {
    if (!query || query.length < 1) return [];

    const cacheKey = `search:${query.toLowerCase()}`;
    const cached = this.cache.get<StockSearchResult[]>(cacheKey);
    if (cached) return cached;

    const results = await yahooFinance.searchStocks(query);

    if (results.length > 0) {
      this.cache.set(cacheKey, results, 600000); // 10 minutes cache
    }

    return results;
  }

  calculateTechnicalIndicators(
    data: HistoricalDataPoint[]
  ): TechnicalIndicators | null {
    if (data.length < 200) {
      console.warn('Insufficient data for all technical indicators');
    }

    if (data.length < 26) {
      return null;
    }

    // 使用調整後收盤價計算技術指標，與大多數財經平台一致
    const closes = data.map((d) => d.adjClose || d.close);

    return {
      rsi: this.calculateRSI(closes, 14),
      macd: this.calculateMACD(closes),
      bollingerBands: this.calculateBollingerBands(closes, 20),
      sma20: this.calculateSMA(closes, 20),
      sma50: data.length >= 50 ? this.calculateSMA(closes, 50) : 0,
      sma200: data.length >= 200 ? this.calculateSMA(closes, 200) : 0,
      ema12: this.calculateEMA(closes, 12),
      ema26: this.calculateEMA(closes, 26),
    };
  }

  private calculateSMA(data: number[], period: number): number {
    if (data.length < period) return 0;
    const slice = data.slice(-period);
    return slice.reduce((a, b) => a + b, 0) / period;
  }

  private calculateEMA(data: number[], period: number): number {
    if (data.length < period) return 0;
    const multiplier = 2 / (period + 1);
    let ema = this.calculateSMA(data.slice(0, period), period);

    for (let i = period; i < data.length; i++) {
      ema = (data[i] - ema) * multiplier + ema;
    }

    return ema;
  }

  private calculateRSI(data: number[], period: number = 14): number {
    if (data.length < period + 1) return 50;

    const changes: number[] = [];
    for (let i = 1; i < data.length; i++) {
      changes.push(data[i] - data[i - 1]);
    }

    const recentChanges = changes.slice(-period);
    let gains = 0;
    let losses = 0;

    for (const change of recentChanges) {
      if (change > 0) gains += change;
      else losses -= change;
    }

    const avgGain = gains / period;
    const avgLoss = losses / period;

    if (avgLoss === 0) return 100;
    const rs = avgGain / avgLoss;
    return 100 - 100 / (1 + rs);
  }

  private calculateMACD(
    data: number[]
  ): { macd: number; signal: number; histogram: number } {
    const ema12 = this.calculateEMA(data, 12);
    const ema26 = this.calculateEMA(data, 26);
    const macdLine = ema12 - ema26;

    // Calculate signal line (9-day EMA of MACD)
    const macdValues: number[] = [];
    let ema12Running = this.calculateSMA(data.slice(0, 12), 12);
    let ema26Running = this.calculateSMA(data.slice(0, 26), 26);

    for (let i = 26; i < data.length; i++) {
      ema12Running = (data[i] - ema12Running) * (2 / 13) + ema12Running;
      ema26Running = (data[i] - ema26Running) * (2 / 27) + ema26Running;
      macdValues.push(ema12Running - ema26Running);
    }

    const signalLine =
      macdValues.length >= 9 ? this.calculateEMA(macdValues, 9) : macdLine;

    return {
      macd: macdLine,
      signal: signalLine,
      histogram: macdLine - signalLine,
    };
  }

  private calculateBollingerBands(
    data: number[],
    period: number = 20
  ): { upper: number; middle: number; lower: number } {
    const sma = this.calculateSMA(data, period);
    const slice = data.slice(-period);

    const squaredDiffs = slice.map((v) => Math.pow(v - sma, 2));
    const variance = squaredDiffs.reduce((a, b) => a + b, 0) / period;
    const stdDev = Math.sqrt(variance);

    return {
      upper: sma + 2 * stdDev,
      middle: sma,
      lower: sma - 2 * stdDev,
    };
  }
}

export const stockDataAggregator = new StockDataAggregator();
