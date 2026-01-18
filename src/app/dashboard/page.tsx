'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { Header } from '@/components/layout/Header';
import { Sidebar } from '@/components/layout/Sidebar';
import { PriceChart } from '@/components/charts/PriceChart';
import { QuoteCard } from '@/components/predictions/QuoteCard';
import { TechnicalIndicatorsCard } from '@/components/predictions/TechnicalIndicators';
import { FinancialMetricsCard } from '@/components/financials/FinancialMetricsCard';
import { StockNewsCard } from '@/components/news/StockNewsCard';
import { useStockStore } from '@/stores/stockStore';
import { InstallPrompt } from '@/components/pwa/InstallPrompt';
import type { StockQuote, ChartDataPoint, TechnicalIndicators, FinancialMetrics } from '@/types/stock';

interface NewsItem {
  id: string;
  title: string;
  summary: string;
  url: string;
  source: string;
  publishedAt: Date | string;
  thumbnail?: string;
}

// SaaS 公司列表
const SAAS_COMPANIES = [
  { symbol: 'CRM', name: 'Salesforce' },
  { symbol: 'NOW', name: 'ServiceNow' },
  { symbol: 'SNOW', name: 'Snowflake' },
  { symbol: 'DDOG', name: 'Datadog' },
  { symbol: 'ZS', name: 'Zscaler' },
  { symbol: 'CRWD', name: 'CrowdStrike' },
  { symbol: 'NET', name: 'Cloudflare' },
  { symbol: 'MDB', name: 'MongoDB' },
  { symbol: 'TEAM', name: 'Atlassian' },
  { symbol: 'OKTA', name: 'Okta' },
];

// 時間區間選項
type ChartPeriod = '1d' | '5d' | '1mo' | '3mo' | '6mo' | '1y' | '5y';

const PERIOD_OPTIONS: { value: ChartPeriod; label: string }[] = [
  { value: '1d', label: '1日' },
  { value: '5d', label: '5日' },
  { value: '1mo', label: '1個月' },
  { value: '3mo', label: '3個月' },
  { value: '6mo', label: '6個月' },
  { value: '1y', label: '1年' },
  { value: '5y', label: '5年' },
];

interface StockData {
  quote: StockQuote;
  historical: ChartDataPoint[];
  indicators: TechnicalIndicators | null;
}

async function fetchStockData(symbol: string, period: ChartPeriod = '1y'): Promise<StockData> {
  // 圖表資料使用選擇的時間區間，但不需要技術指標
  const response = await fetch(
    `/api/stocks/${symbol}?period=${period}&indicators=false`
  );
  if (!response.ok) throw new Error('Failed to fetch stock data');
  const data = await response.json();

  return {
    quote: {
      ...data.quote,
      timestamp: new Date(data.quote.timestamp),
    },
    historical: data.historical,
    indicators: null,
  };
}

// 分開獲取技術指標（固定使用 1 年資料）
async function fetchTechnicalIndicators(symbol: string): Promise<{ indicators: TechnicalIndicators | null }> {
  const response = await fetch(
    `/api/stocks/${symbol}?period=1y&indicators=true`
  );
  if (!response.ok) throw new Error('Failed to fetch indicators');
  const data = await response.json();

  return {
    indicators: data.indicators,
  };
}

async function fetchFinancialMetrics(symbol: string): Promise<{ metrics: FinancialMetrics }> {
  const response = await fetch(`/api/financials/${symbol}`);
  if (!response.ok) throw new Error('Failed to fetch financial metrics');
  return response.json();
}

async function fetchNews(symbol: string): Promise<{ news: NewsItem[] }> {
  const response = await fetch(`/api/news/${symbol}`);
  if (!response.ok) throw new Error('Failed to fetch news');
  return response.json();
}

function DashboardContent() {
  const searchParams = useSearchParams();
  const urlSymbol = searchParams.get('symbol');
  const { selectedSymbol, setSelectedSymbol, addRecentSearch } = useStockStore();

  const [currentSymbol, setCurrentSymbol] = useState<string | null>(
    urlSymbol || selectedSymbol || 'CRM'
  );
  const [chartPeriod, setChartPeriod] = useState<ChartPeriod>('1y');

  useEffect(() => {
    if (urlSymbol && urlSymbol !== currentSymbol) {
      setCurrentSymbol(urlSymbol);
      setSelectedSymbol(urlSymbol);
      addRecentSearch(urlSymbol);
    }
  }, [urlSymbol, currentSymbol, setSelectedSymbol, addRecentSearch]);

  const handleSelectSymbol = (symbol: string) => {
    setCurrentSymbol(symbol);
    setSelectedSymbol(symbol);
    addRecentSearch(symbol);
    window.history.pushState(null, '', `/dashboard?symbol=${symbol}`);
  };

  const {
    data: stockData,
    isLoading: isLoadingStock,
    error: stockError,
  } = useQuery({
    queryKey: ['stock', currentSymbol, chartPeriod],
    queryFn: () => fetchStockData(currentSymbol!, chartPeriod),
    enabled: !!currentSymbol,
    staleTime: chartPeriod === '1d' ? 30000 : 60000, // 1日資料更頻繁更新
  });

  // 技術指標固定使用 1 年資料，不隨圖表時間區間改變
  const {
    data: indicatorsData,
    isLoading: isLoadingIndicators,
  } = useQuery({
    queryKey: ['indicators', currentSymbol],
    queryFn: () => fetchTechnicalIndicators(currentSymbol!),
    enabled: !!currentSymbol,
    staleTime: 300000, // 5 分鐘快取
  });

  const {
    data: financialData,
    isLoading: isLoadingFinancials,
  } = useQuery({
    queryKey: ['financials', currentSymbol],
    queryFn: () => fetchFinancialMetrics(currentSymbol!),
    enabled: !!currentSymbol,
    staleTime: 600000,
  });

  const {
    data: newsData,
    isLoading: isLoadingNews,
  } = useQuery({
    queryKey: ['news', currentSymbol],
    queryFn: () => fetchNews(currentSymbol!),
    enabled: !!currentSymbol,
    staleTime: 300000, // 5 minutes cache
  });

  const isSaasCompany = SAAS_COMPANIES.some(c => c.symbol === currentSymbol?.toUpperCase());

  return (
    <div className="flex min-h-[calc(100vh-64px)]">
      <Sidebar onSelectSymbol={handleSelectSymbol} />

      <main className="flex-1 p-3 sm:p-6 overflow-y-auto w-full">
        {/* SaaS 公司快速選單 */}
        <div className="mb-4 sm:mb-6">
          <h3 className="text-sm font-medium text-gray-400 mb-3">SaaS 公司快速選單</h3>
          <div className="flex gap-2 overflow-x-auto pb-2 sm:flex-wrap sm:overflow-x-visible">
            {SAAS_COMPANIES.map((company) => (
              <button
                key={company.symbol}
                onClick={() => handleSelectSymbol(company.symbol)}
                className={`px-3 py-1.5 text-sm rounded-lg border transition-colors flex-shrink-0 ${
                  currentSymbol === company.symbol
                    ? 'bg-blue-500/20 border-blue-500 text-blue-400'
                    : 'bg-gray-800 border-gray-700 text-gray-300 hover:border-gray-600 hover:bg-gray-700'
                }`}
              >
                <span className="font-medium">{company.symbol}</span>
                <span className="text-gray-500 ml-1 text-xs hidden sm:inline">{company.name}</span>
              </button>
            ))}
          </div>
        </div>

        {!currentSymbol ? (
          <div className="flex items-center justify-center h-[calc(100vh-300px)]">
            <div className="text-center">
              <h2 className="text-2xl font-bold text-white mb-2">
                請選擇股票
              </h2>
              <p className="text-gray-400">
                搜尋股票或從上方選擇一支 SaaS 公司開始
              </p>
            </div>
          </div>
        ) : isLoadingStock ? (
          <div className="flex items-center justify-center h-[calc(100vh-300px)]">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-500 border-t-transparent mx-auto mb-4" />
              <p className="text-gray-400">正在載入 {currentSymbol} 資料...</p>
            </div>
          </div>
        ) : stockError ? (
          <div className="flex items-center justify-center h-[calc(100vh-300px)]">
            <div className="text-center">
              <p className="text-red-400 text-lg mb-2">
                載入股票資料失敗
              </p>
              <p className="text-gray-400">
                請重試或選擇其他股票
              </p>
            </div>
          </div>
        ) : stockData ? (
          <div className="space-y-6">
            <QuoteCard quote={stockData.quote} />

            {/* 價格圖表 - 全寬 */}
            <div className="bg-gray-800 rounded-xl p-3 sm:p-4 border border-gray-700">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
                <h3 className="text-base sm:text-lg font-semibold text-white">
                  價格走勢圖
                </h3>
                {/* 時間區間選擇 */}
                <div className="flex gap-1 bg-gray-900/50 rounded-lg p-1 overflow-x-auto">
                  {PERIOD_OPTIONS.map((option) => (
                    <button
                      key={option.value}
                      onClick={() => setChartPeriod(option.value)}
                      className={`px-2 sm:px-3 py-1 text-xs sm:text-sm rounded-md transition-colors flex-shrink-0 ${
                        chartPeriod === option.value
                          ? 'bg-blue-500 text-white'
                          : 'text-gray-400 hover:text-white hover:bg-gray-700'
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>
              <PriceChart
                data={stockData.historical}
                height={400}
                period={chartPeriod}
                fixedSma50={indicatorsData?.indicators?.sma50 ?? null}
                fixedSma200={indicatorsData?.indicators?.sma200 ?? null}
              />
            </div>

            {/* 技術指標 - 固定使用 1 年資料計算 */}
            <div className="grid lg:grid-cols-1 gap-6">
              {isLoadingIndicators ? (
                <div className="bg-gray-800 rounded-xl p-6 border border-gray-700 flex items-center justify-center">
                  <div className="text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-4 border-blue-500 border-t-transparent mx-auto mb-2" />
                    <p className="text-gray-400">正在載入技術指標...</p>
                  </div>
                </div>
              ) : indicatorsData?.indicators ? (
                <TechnicalIndicatorsCard
                  indicators={indicatorsData.indicators}
                  currentPrice={stockData.quote.price}
                />
              ) : (
                <div className="bg-gray-800 rounded-xl p-6 border border-gray-700 flex items-center justify-center">
                  <p className="text-gray-400">
                    技術指標無法取得
                  </p>
                </div>
              )}
            </div>

            {/* 財務指標 */}
            <div className="grid lg:grid-cols-1 gap-6">
              {isLoadingFinancials ? (
                <div className="bg-gray-800 rounded-xl p-6 border border-gray-700 flex items-center justify-center">
                  <div className="text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-4 border-blue-500 border-t-transparent mx-auto mb-2" />
                    <p className="text-gray-400">正在載入財務指標...</p>
                  </div>
                </div>
              ) : financialData?.metrics ? (
                <>
                  {isSaasCompany && (
                    <div className="bg-green-900/20 border border-green-800/50 rounded-lg p-3 mb-2">
                      <p className="text-green-400 text-sm">
                        ✓ 此為 SaaS 公司，可查看完整 SaaS 指標（客戶數、ARR、NRR、GRR 等）
                      </p>
                    </div>
                  )}
                  <FinancialMetricsCard
                    metrics={financialData.metrics}
                    symbol={currentSymbol!}
                  />
                </>
              ) : (
                <div className="bg-gray-800 rounded-xl p-6 border border-gray-700 flex items-center justify-center">
                  <p className="text-gray-400">
                    財務指標無法取得
                  </p>
                </div>
              )}
            </div>

            {/* 相關新聞 */}
            <StockNewsCard
              news={newsData?.news || []}
              symbol={currentSymbol!}
              isLoading={isLoadingNews}
            />

            <div className="bg-yellow-900/20 border border-yellow-800/50 rounded-lg p-4">
              <p className="text-yellow-400 text-sm font-medium mb-1">
                免責聲明
              </p>
              <p className="text-gray-400 text-sm">
                本資料僅供參考目的使用。股票市場具有風險，
                不應作為投資決策的唯一依據。請務必諮詢專業財務顧問。
              </p>
            </div>
          </div>
        ) : null}
      </main>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <div className="min-h-screen bg-gray-900">
      <Header />
      <Suspense fallback={
        <div className="flex items-center justify-center h-[calc(100vh-64px)]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-500 border-t-transparent mx-auto mb-4" />
            <p className="text-gray-400">載入中...</p>
          </div>
        </div>
      }>
        <DashboardContent />
      </Suspense>
      <InstallPrompt />
    </div>
  );
}
