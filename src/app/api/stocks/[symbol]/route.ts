import { NextRequest, NextResponse } from 'next/server';
import { stockDataAggregator } from '@/lib/data-sources/aggregator';
import {
  validateSymbol,
  validatePeriod,
  sanitizeSymbol,
  sanitizePeriod,
} from '@/lib/api/validation';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ symbol: string }> }
) {
  const { symbol: rawSymbol } = await params;

  // Validate symbol
  const symbolValidation = validateSymbol(rawSymbol);
  if (!symbolValidation.valid) {
    return NextResponse.json(
      { error: symbolValidation.error },
      { status: 400 }
    );
  }

  const symbol = sanitizeSymbol(rawSymbol);

  // Get period from query params
  const searchParams = request.nextUrl.searchParams;
  const rawPeriod = searchParams.get('period');

  const periodValidation = validatePeriod(rawPeriod);
  if (!periodValidation.valid) {
    return NextResponse.json(
      { error: periodValidation.error },
      { status: 400 }
    );
  }

  const period = sanitizePeriod(rawPeriod);
  const includeIndicators = searchParams.get('indicators') === 'true';

  try {
    // Fetch quote and historical data in parallel
    const [quote, historicalData] = await Promise.all([
      stockDataAggregator.getQuote(symbol),
      stockDataAggregator.getHistoricalData(symbol, period),
    ]);

    if (!quote) {
      return NextResponse.json(
        { error: `Stock ${symbol} not found` },
        { status: 404 }
      );
    }

    // Calculate technical indicators if requested
    let indicators = null;
    if (includeIndicators && historicalData.length > 0) {
      indicators = stockDataAggregator.calculateTechnicalIndicators(historicalData);
    }

    // Format historical data for charts
    // 日內資料 (1d, 5d) 使用原始價格，其他使用調整後收盤價
    const isIntraday = period === '1d' || period === '5d';

    const chartData = historicalData.map((d) => {
      // 日內資料不需要調整，其他使用調整後收盤價
      if (isIntraday) {
        return {
          time: d.date.getTime() / 1000, // Unix timestamp for intraday
          open: d.open,
          high: d.high,
          low: d.low,
          close: d.close,
          volume: d.volume,
        };
      }

      // 計算調整係數 (如果有 adjClose)
      const adjustmentRatio = d.adjClose && d.close ? d.adjClose / d.close : 1;

      return {
        time: d.date.toISOString().split('T')[0],
        // 使用調整後的價格
        open: d.open * adjustmentRatio,
        high: d.high * adjustmentRatio,
        low: d.low * adjustmentRatio,
        close: d.adjClose || d.close, // 優先使用調整後收盤價
        volume: d.volume,
      };
    });

    return NextResponse.json({
      quote,
      historical: chartData,
      indicators,
      meta: {
        symbol,
        period,
        dataPoints: historicalData.length,
        fetchedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error(`Error fetching stock data for ${symbol}:`, error);
    return NextResponse.json(
      { error: 'Failed to fetch stock data' },
      { status: 500 }
    );
  }
}
