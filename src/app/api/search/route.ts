import { NextRequest, NextResponse } from 'next/server';
import { stockDataAggregator } from '@/lib/data-sources/aggregator';
import { validateSearchQuery } from '@/lib/api/validation';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const query = searchParams.get('q');

  // Validate query
  const queryValidation = validateSearchQuery(query);
  if (!queryValidation.valid) {
    return NextResponse.json(
      { error: queryValidation.error },
      { status: 400 }
    );
  }

  try {
    const results = await stockDataAggregator.searchStocks(query!);

    return NextResponse.json({
      results,
      count: results.length,
      query,
    });
  } catch (error) {
    console.error('Search error:', error);
    return NextResponse.json(
      { error: 'Failed to search stocks' },
      { status: 500 }
    );
  }
}
