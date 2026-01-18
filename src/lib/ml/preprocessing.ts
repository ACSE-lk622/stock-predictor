import type { HistoricalDataPoint, TechnicalIndicators } from '@/types/stock';
import type { ScalerParams } from './model-loader';

interface ProcessedFeatures {
  raw: number[][];
  scaled: number[][];
  sequences: number[][][];
  flattenedForXgb: number[][];
}

export function calculateTechnicalIndicators(
  data: HistoricalDataPoint[]
): (HistoricalDataPoint & TechnicalIndicators)[] {
  const result: (HistoricalDataPoint & TechnicalIndicators)[] = [];
  const closes = data.map((d) => d.close);
  const volumes = data.map((d) => d.volume);

  for (let i = 0; i < data.length; i++) {
    const point = data[i];

    // Calculate indicators with available data
    const rsi = i >= 14 ? calculateRSI(closes.slice(0, i + 1), 14) : 50;
    const macd = i >= 26 ? calculateMACD(closes.slice(0, i + 1)) : { macd: 0, signal: 0, histogram: 0 };
    const bb = i >= 20 ? calculateBollingerBands(closes.slice(0, i + 1), 20) : { upper: point.close, middle: point.close, lower: point.close };

    result.push({
      ...point,
      rsi,
      macd,
      bollingerBands: bb,
      sma20: i >= 20 ? calculateSMA(closes.slice(0, i + 1), 20) : point.close,
      sma50: i >= 50 ? calculateSMA(closes.slice(0, i + 1), 50) : point.close,
      sma200: i >= 200 ? calculateSMA(closes.slice(0, i + 1), 200) : point.close,
      ema12: i >= 12 ? calculateEMA(closes.slice(0, i + 1), 12) : point.close,
      ema26: i >= 26 ? calculateEMA(closes.slice(0, i + 1), 26) : point.close,
    });
  }

  return result;
}

function calculateSMA(data: number[], period: number): number {
  if (data.length < period) return data[data.length - 1];
  const slice = data.slice(-period);
  return slice.reduce((a, b) => a + b, 0) / period;
}

function calculateEMA(data: number[], period: number): number {
  if (data.length < period) return data[data.length - 1];
  const multiplier = 2 / (period + 1);
  let ema = calculateSMA(data.slice(0, period), period);

  for (let i = period; i < data.length; i++) {
    ema = (data[i] - ema) * multiplier + ema;
  }

  return ema;
}

function calculateRSI(data: number[], period: number = 14): number {
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

function calculateMACD(data: number[]): { macd: number; signal: number; histogram: number } {
  const ema12 = calculateEMA(data, 12);
  const ema26 = calculateEMA(data, 26);
  const macdLine = ema12 - ema26;

  // Calculate signal line (9-day EMA of MACD)
  const macdValues: number[] = [];
  let ema12Running = calculateSMA(data.slice(0, 12), 12);
  let ema26Running = calculateSMA(data.slice(0, 26), 26);

  for (let i = 26; i < data.length; i++) {
    ema12Running = (data[i] - ema12Running) * (2 / 13) + ema12Running;
    ema26Running = (data[i] - ema26Running) * (2 / 27) + ema26Running;
    macdValues.push(ema12Running - ema26Running);
  }

  const signalLine = macdValues.length >= 9 ? calculateEMA(macdValues, 9) : macdLine;

  return {
    macd: macdLine,
    signal: signalLine,
    histogram: macdLine - signalLine,
  };
}

function calculateBollingerBands(
  data: number[],
  period: number = 20
): { upper: number; middle: number; lower: number } {
  const sma = calculateSMA(data, period);
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

export function prepareFeatures(data: HistoricalDataPoint[]): number[][] {
  const withIndicators = calculateTechnicalIndicators(data);
  const features: number[][] = [];

  for (let i = 0; i < withIndicators.length; i++) {
    const d = withIndicators[i];
    const prev = i > 0 ? withIndicators[i - 1] : d;

    const dailyReturn = prev.close !== 0 ? (d.close - prev.close) / prev.close : 0;
    const volumeSMA = i >= 20 ? calculateSMA(data.slice(0, i + 1).map((x) => x.volume), 20) : d.volume;
    const volumeRatio = volumeSMA !== 0 ? d.volume / volumeSMA : 1;

    // Momentum calculations
    const momentum5 = i >= 5 && withIndicators[i - 5].close !== 0
      ? d.close / withIndicators[i - 5].close - 1
      : 0;
    const momentum10 = i >= 10 && withIndicators[i - 10].close !== 0
      ? d.close / withIndicators[i - 10].close - 1
      : 0;
    const momentum20 = i >= 20 && withIndicators[i - 20].close !== 0
      ? d.close / withIndicators[i - 20].close - 1
      : 0;

    // Rolling volatility
    let volatility = 0;
    if (i >= 20) {
      const returns: number[] = [];
      for (let j = i - 19; j <= i; j++) {
        if (j > 0) {
          returns.push(
            (withIndicators[j].close - withIndicators[j - 1].close) /
              withIndicators[j - 1].close
          );
        }
      }
      const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
      volatility = Math.sqrt(
        returns.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / returns.length
      );
    }

    const bbWidth = d.bollingerBands.middle !== 0
      ? (d.bollingerBands.upper - d.bollingerBands.lower) / d.bollingerBands.middle
      : 0;

    features.push([
      d.open,
      d.high,
      d.low,
      d.close,
      d.volume,
      d.rsi,
      d.macd.macd,
      d.macd.signal,
      d.macd.histogram,
      d.bollingerBands.upper,
      d.bollingerBands.middle,
      d.bollingerBands.lower,
      bbWidth,
      d.sma20,
      d.sma50,
      d.ema12,
      d.ema26,
      dailyReturn,
      volatility,
      volumeRatio,
      momentum5,
      momentum10,
      momentum20,
      d.sma20 !== 0 ? d.close / d.sma20 : 1,
      d.sma50 !== 0 ? d.close / d.sma50 : 1,
    ]);
  }

  return features;
}

export function scaleFeatures(
  features: number[][],
  scalerParams: ScalerParams
): number[][] {
  return features.map((row) =>
    row.map((value, i) => {
      const range = scalerParams.data_range_[i];
      if (range === 0) return 0;
      return (value - scalerParams.data_min_[i]) / range;
    })
  );
}

export function inverseScalePrice(
  scaledPrice: number,
  scalerParams: ScalerParams,
  priceIndex: number = 3
): number {
  const range = scalerParams.data_range_[priceIndex];
  const min = scalerParams.data_min_[priceIndex];
  return scaledPrice * range + min;
}

export function createSequences(
  data: number[][],
  sequenceLength: number = 60
): number[][][] {
  const sequences: number[][][] = [];

  for (let i = sequenceLength; i <= data.length; i++) {
    sequences.push(data.slice(i - sequenceLength, i));
  }

  return sequences;
}

export function flattenForXgboost(
  data: number[][],
  lookback: number = 5
): number[][] {
  const flattened: number[][] = [];

  for (let i = lookback; i < data.length; i++) {
    const features: number[] = [];
    for (let j = i - lookback; j < i; j++) {
      features.push(...data[j]);
    }
    flattened.push(features);
  }

  return flattened;
}

export function processDataForPrediction(
  data: HistoricalDataPoint[],
  scalerParams: ScalerParams,
  sequenceLength: number = 60
): ProcessedFeatures {
  const raw = prepareFeatures(data);

  // Filter out rows with NaN (usually early rows without enough history)
  const validStartIndex = Math.max(200, sequenceLength); // Need at least 200 for SMA200
  const validRaw = raw.slice(validStartIndex);

  const scaled = scaleFeatures(validRaw, scalerParams);
  const sequences = createSequences(scaled, sequenceLength);
  const flattenedForXgb = flattenForXgboost(scaled, 5);

  return {
    raw: validRaw,
    scaled,
    sequences,
    flattenedForXgb,
  };
}
