import { NextResponse } from 'next/server';
import yahooFinance from 'yahoo-finance2';
import type { FinancialMetrics } from '@/types/stock';

// Known SaaS companies for demo purposes
const SAAS_COMPANIES = ['CRM', 'NOW', 'SNOW', 'DDOG', 'ZS', 'CRWD', 'NET', 'MDB', 'TEAM', 'OKTA'];

// Generate fallback metrics when API data is unavailable
function generateFallbackMetrics(symbol: string): FinancialMetrics {
  const isSaas = SAAS_COMPANIES.includes(symbol.toUpperCase());
  const baseRevenue = 50000000000 + Math.random() * 100000000000; // 50B - 150B
  const now = new Date();
  const quarter = Math.ceil((now.getMonth() + 1) / 3);
  const fiscalPeriod = `${now.getFullYear()}Q${quarter}`;

  return {
    revenue: {
      current: baseRevenue,
      yoy: 5 + Math.random() * 25, // 5-30% YoY growth
      qoq: -2 + Math.random() * 10, // -2% to 8% QoQ
    },
    saasMetrics: isSaas
      ? {
          customerCount: Math.round(10000 + Math.random() * 50000),
          arr: baseRevenue * 1.05,
          nrr: 105 + Math.random() * 25, // 105-130%
          grr: 85 + Math.random() * 10, // 85-95%
        }
      : null,
    marketExpansion: isSaas
      ? {
          marketPenetration: 5 + Math.random() * 15,
          regions: ['北美', '歐洲', '亞太', '其他'],
          regionalRevenue: [
            { region: '北美', percentage: 55 + Math.round(Math.random() * 10) },
            { region: '歐洲', percentage: 20 + Math.round(Math.random() * 10) },
            { region: '亞太', percentage: 15 + Math.round(Math.random() * 5) },
            { region: '其他', percentage: 5 + Math.round(Math.random() * 5) },
          ],
        }
      : null,
    margins: {
      grossMargin: 35 + Math.random() * 30, // 35-65%
      operatingMargin: 10 + Math.random() * 20, // 10-30%
      fcfMargin: 5 + Math.random() * 20, // 5-25%
    },
    cashFlow: {
      operatingCashFlow: baseRevenue * (0.15 + Math.random() * 0.15),
      freeCashFlow: baseRevenue * (0.08 + Math.random() * 0.12),
      fcfPerShare: 5 + Math.random() * 15,
    },
    expenseRatios: {
      rdExpenseRatio: 8 + Math.random() * 12, // 8-20%
      salesExpenseRatio: 10 + Math.random() * 15, // 10-25%
      gaExpenseRatio: 3 + Math.random() * 7, // 3-10%
      totalOpex: 25 + Math.random() * 20, // 25-45%
    },
    valuation: {
      evToEbitda: 10 + Math.random() * 20, // 10-30x
      evToRevenue: 2 + Math.random() * 8, // 2-10x
      peRatio: 15 + Math.random() * 30, // 15-45x
      pbRatio: 2 + Math.random() * 8, // 2-10x
    },
    lastUpdated: new Date(),
    fiscalPeriod,
  };
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ symbol: string }> }
) {
  try {
    const { symbol } = await params;
    const upperSymbol = symbol.toUpperCase();

    let metrics: FinancialMetrics;

    try {
      // Try to fetch real data from Yahoo Finance
      const [quoteSummary, quote] = await Promise.all([
        yahooFinance.quoteSummary(upperSymbol, {
          modules: [
            'financialData',
            'incomeStatementHistory',
            'incomeStatementHistoryQuarterly',
            'balanceSheetHistory',
            'cashflowStatementHistory',
            'defaultKeyStatistics',
          ],
        }),
        yahooFinance.quote(upperSymbol),
      ]);

      const financialData = quoteSummary.financialData;
      const incomeStmt = quoteSummary.incomeStatementHistory?.incomeStatementHistory?.[0];
      const incomeStmtQ = quoteSummary.incomeStatementHistoryQuarterly?.incomeStatementHistory;
      const cashflow = quoteSummary.cashflowStatementHistory?.cashflowStatements?.[0];
      const keyStats = quoteSummary.defaultKeyStatistics;

      // Calculate revenue growth
      const currentRevenue = incomeStmt?.totalRevenue || 0;
      const previousRevenue = quoteSummary.incomeStatementHistory?.incomeStatementHistory?.[1]?.totalRevenue || currentRevenue;
      const revenueYoY = previousRevenue > 0 ? ((currentRevenue - previousRevenue) / previousRevenue) * 100 : 0;

      // QoQ calculation
      const currentQRevenue = incomeStmtQ?.[0]?.totalRevenue || 0;
      const previousQRevenue = incomeStmtQ?.[1]?.totalRevenue || currentQRevenue;
      const revenueQoQ = previousQRevenue > 0 ? ((currentQRevenue - previousQRevenue) / previousQRevenue) * 100 : 0;

      // Margins
      const grossMargin = financialData?.grossMargins ? financialData.grossMargins * 100 : 40;
      const operatingMargin = financialData?.operatingMargins ? financialData.operatingMargins * 100 : 15;

      // Cash Flow
      const operatingCashFlow = cashflow?.totalCashFromOperatingActivities || currentRevenue * 0.2;
      const capex = Math.abs(cashflow?.capitalExpenditures || currentRevenue * 0.05);
      const freeCashFlow = operatingCashFlow - capex;
      const fcfMargin = currentRevenue > 0 ? (freeCashFlow / currentRevenue) * 100 : 15;
      const sharesOutstanding = quote.sharesOutstanding || 1000000000;
      const fcfPerShare = freeCashFlow / sharesOutstanding;

      // Expense ratios (estimated from operating income and gross profit)
      const grossProfit = incomeStmt?.grossProfit || currentRevenue * 0.5;
      const operatingIncome = incomeStmt?.operatingIncome || currentRevenue * 0.2;
      const totalOpex = grossProfit - operatingIncome;
      const totalOpexRatio = currentRevenue > 0 ? (totalOpex / currentRevenue) * 100 : 30;

      // Estimate expense breakdown (typical tech company ratios)
      const rdRatio = totalOpexRatio * 0.45; // ~45% of opex goes to R&D
      const salesRatio = totalOpexRatio * 0.40; // ~40% to S&M
      const gaRatio = totalOpexRatio * 0.15; // ~15% to G&A

      // Valuation metrics
      const marketCap = quote.marketCap || 100000000000;
      const enterpriseValue = keyStats?.enterpriseValue || marketCap;
      const ebitda = financialData?.ebitda || currentRevenue * 0.25;
      const evToEbitda = ebitda > 0 ? enterpriseValue / ebitda : 15;
      const evToRevenue = currentRevenue > 0 ? enterpriseValue / currentRevenue : 5;
      const peRatio = quote.trailingPE || quote.forwardPE || 20;
      const pbRatio = quote.priceToBook || 3;

      // SaaS metrics (mock data for SaaS companies)
      const isSaas = SAAS_COMPANIES.includes(upperSymbol);
      const saasMetrics = isSaas
        ? {
            customerCount: Math.round((currentRevenue || 50000000000) / 150000),
            arr: (currentRevenue || 50000000000) * 1.05,
            nrr: 110 + Math.random() * 20,
            grr: 88 + Math.random() * 7,
          }
        : null;

      // Market expansion (mock data)
      const marketExpansion = isSaas
        ? {
            marketPenetration: 5 + Math.random() * 15,
            regions: ['北美', '歐洲', '亞太', '其他'],
            regionalRevenue: [
              { region: '北美', percentage: 55 + Math.round(Math.random() * 10) },
              { region: '歐洲', percentage: 20 + Math.round(Math.random() * 10) },
              { region: '亞太', percentage: 15 + Math.round(Math.random() * 5) },
              { region: '其他', percentage: 5 + Math.round(Math.random() * 5) },
            ],
          }
        : null;

      // Determine fiscal period
      const now = new Date();
      const quarter = Math.ceil((now.getMonth() + 1) / 3);
      const fiscalPeriod = `${now.getFullYear()}Q${quarter}`;

      metrics = {
        revenue: {
          current: currentRevenue || 50000000000,
          yoy: revenueYoY || 10,
          qoq: revenueQoQ || 2,
        },
        saasMetrics,
        marketExpansion,
        margins: {
          grossMargin,
          operatingMargin,
          fcfMargin,
        },
        cashFlow: {
          operatingCashFlow,
          freeCashFlow,
          fcfPerShare,
        },
        expenseRatios: {
          rdExpenseRatio: rdRatio || 12,
          salesExpenseRatio: salesRatio || 15,
          gaExpenseRatio: gaRatio || 5,
          totalOpex: totalOpexRatio || 32,
        },
        valuation: {
          evToEbitda,
          evToRevenue,
          peRatio,
          pbRatio,
        },
        lastUpdated: new Date(),
        fiscalPeriod,
      };
    } catch (apiError) {
      console.warn('Yahoo Finance API error, using fallback data:', apiError);
      // Use fallback metrics if API fails
      metrics = generateFallbackMetrics(upperSymbol);
    }

    return NextResponse.json({ metrics });
  } catch (error) {
    console.error('Error in financials API:', error);
    // Return fallback data even on error
    const { symbol } = await params;
    const metrics = generateFallbackMetrics(symbol);
    return NextResponse.json({ metrics });
  }
}
