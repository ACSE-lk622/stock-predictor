import { NextRequest, NextResponse } from 'next/server';
import { stockDataAggregator } from '@/lib/data-sources/aggregator';
import { validateSymbol, sanitizeSymbol } from '@/lib/api/validation';

// Note: In browser, this would use TensorFlow.js client-side
// This API route provides server-side prediction capability

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { symbol: rawSymbol, useEnsemble = true } = body;

    // Validate symbol
    const symbolValidation = validateSymbol(rawSymbol);
    if (!symbolValidation.valid) {
      return NextResponse.json(
        { error: symbolValidation.error },
        { status: 400 }
      );
    }

    const symbol = sanitizeSymbol(rawSymbol);

    // Fetch historical data needed for prediction
    const historicalData = await stockDataAggregator.getHistoricalData(symbol, '1y');

    if (historicalData.length < 100) {
      return NextResponse.json(
        { error: 'Insufficient historical data for prediction' },
        { status: 400 }
      );
    }

    // Calculate technical indicators
    const indicators = stockDataAggregator.calculateTechnicalIndicators(historicalData);
    const currentPrice = historicalData[historicalData.length - 1].close;

    // Since we can't run TensorFlow.js on the server easily without models,
    // we'll provide a simplified prediction based on technical analysis
    // In production, you would load and run the actual models here

    const prediction = generateTechnicalPrediction(
      currentPrice,
      indicators,
      historicalData
    );

    return NextResponse.json({
      symbol,
      prediction,
      indicators,
      meta: {
        dataPoints: historicalData.length,
        generatedAt: new Date().toISOString(),
        method: 'technical_analysis',
        note: 'For ML predictions, use client-side TensorFlow.js or deploy trained models',
      },
    });
  } catch (error) {
    console.error('Prediction error:', error);
    return NextResponse.json(
      { error: 'Failed to generate prediction' },
      { status: 500 }
    );
  }
}

function generateTechnicalPrediction(
  currentPrice: number,
  indicators: ReturnType<typeof stockDataAggregator.calculateTechnicalIndicators>,
  historicalData: { close: number }[]
) {
  if (!indicators) {
    return {
      predictedPrice: currentPrice,
      direction: 'neutral' as const,
      confidence: 0,
      signals: [],
    };
  }

  const signals: string[] = [];
  let bullishScore = 0;
  let bearishScore = 0;

  // RSI signals
  if (indicators.rsi < 30) {
    signals.push('RSI oversold - bullish');
    bullishScore += 2;
  } else if (indicators.rsi > 70) {
    signals.push('RSI overbought - bearish');
    bearishScore += 2;
  } else if (indicators.rsi < 50) {
    bearishScore += 0.5;
  } else {
    bullishScore += 0.5;
  }

  // MACD signals
  if (indicators.macd.histogram > 0) {
    signals.push('MACD bullish');
    bullishScore += 1;
  } else {
    signals.push('MACD bearish');
    bearishScore += 1;
  }

  // Moving average signals
  if (currentPrice > indicators.sma20) {
    signals.push('Price above SMA20 - bullish');
    bullishScore += 1;
  } else {
    signals.push('Price below SMA20 - bearish');
    bearishScore += 1;
  }

  if (currentPrice > indicators.sma50) {
    bullishScore += 0.5;
  } else {
    bearishScore += 0.5;
  }

  // Bollinger Bands signals
  if (currentPrice < indicators.bollingerBands.lower) {
    signals.push('Price at lower Bollinger Band - potential bounce');
    bullishScore += 1;
  } else if (currentPrice > indicators.bollingerBands.upper) {
    signals.push('Price at upper Bollinger Band - potential pullback');
    bearishScore += 1;
  }

  // Calculate momentum
  const recentPrices = historicalData.slice(-5).map((d) => d.close);
  const momentum =
    recentPrices.length > 1
      ? (recentPrices[recentPrices.length - 1] - recentPrices[0]) / recentPrices[0]
      : 0;

  if (momentum > 0.02) {
    bullishScore += 1;
    signals.push('Strong upward momentum');
  } else if (momentum < -0.02) {
    bearishScore += 1;
    signals.push('Strong downward momentum');
  }

  // Calculate prediction
  const totalScore = bullishScore + bearishScore;
  const confidence =
    totalScore > 0 ? Math.abs(bullishScore - bearishScore) / totalScore : 0;

  const direction =
    bullishScore > bearishScore
      ? 'up'
      : bullishScore < bearishScore
        ? 'down'
        : 'neutral';

  // Estimate price change (simplified)
  const avgVolatility = calculateVolatility(historicalData.map((d) => d.close));
  const priceChangePercent =
    direction === 'up'
      ? avgVolatility * (bullishScore - bearishScore) * 0.1
      : direction === 'down'
        ? -avgVolatility * (bearishScore - bullishScore) * 0.1
        : 0;

  const predictedPrice = currentPrice * (1 + priceChangePercent);

  return {
    predictedPrice: Math.round(predictedPrice * 100) / 100,
    currentPrice: Math.round(currentPrice * 100) / 100,
    priceChange: Math.round((predictedPrice - currentPrice) * 100) / 100,
    priceChangePercent: Math.round(priceChangePercent * 10000) / 100,
    direction: direction as 'up' | 'down' | 'neutral',
    confidence: Math.round(confidence * 100),
    signals,
    scores: {
      bullish: bullishScore,
      bearish: bearishScore,
    },
  };
}

function calculateVolatility(prices: number[]): number {
  if (prices.length < 2) return 0;

  const returns: number[] = [];
  for (let i = 1; i < prices.length; i++) {
    returns.push((prices[i] - prices[i - 1]) / prices[i - 1]);
  }

  const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
  const variance =
    returns.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / returns.length;

  return Math.sqrt(variance);
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const rawSymbol = searchParams.get('symbol');

  if (!rawSymbol) {
    return NextResponse.json(
      { error: 'Symbol is required' },
      { status: 400 }
    );
  }

  // Forward to POST handler
  return POST(
    new NextRequest(request.url, {
      method: 'POST',
      body: JSON.stringify({ symbol: rawSymbol }),
    })
  );
}
