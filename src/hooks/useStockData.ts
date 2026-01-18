import { useQuery } from '@tanstack/react-query';
import type { StockQuote, ChartDataPoint, TechnicalIndicators } from '@/types/stock';

interface StockData {
  quote: StockQuote;
  historical: ChartDataPoint[];
  indicators: TechnicalIndicators | null;
}

async function fetchStockData(
  symbol: string,
  period: string = '1y'
): Promise<StockData> {
  const response = await fetch(
    `/api/stocks/${symbol}?period=${period}&indicators=true`
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to fetch stock data');
  }

  const data = await response.json();

  return {
    quote: {
      ...data.quote,
      timestamp: new Date(data.quote.timestamp),
    },
    historical: data.historical,
    indicators: data.indicators,
  };
}

export function useStockData(symbol: string | null, period: string = '1y') {
  return useQuery({
    queryKey: ['stock', symbol, period],
    queryFn: () => fetchStockData(symbol!, period),
    enabled: !!symbol,
    staleTime: 60000, // 1 minute
    retry: 2,
  });
}

interface PredictionResponse {
  prediction: {
    predictedPrice: number;
    currentPrice: number;
    priceChange: number;
    priceChangePercent: number;
    direction: 'up' | 'down' | 'neutral';
    confidence: number;
    signals: string[];
  };
}

async function fetchPrediction(symbol: string): Promise<PredictionResponse> {
  const response = await fetch('/api/predict', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ symbol }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to fetch prediction');
  }

  return response.json();
}

export function usePrediction(symbol: string | null) {
  return useQuery({
    queryKey: ['prediction', symbol],
    queryFn: () => fetchPrediction(symbol!),
    enabled: !!symbol,
    staleTime: 300000, // 5 minutes
    retry: 1,
  });
}
