'use client';

import { useState } from 'react';
import type { FinancialMetrics } from '@/types/stock';

interface FinancialMetricsCardProps {
  metrics: FinancialMetrics;
  symbol: string;
}

type TabType = 'revenue' | 'margins' | 'expenses' | 'valuation' | 'saas';

export function FinancialMetricsCard({ metrics, symbol }: FinancialMetricsCardProps) {
  const [activeTab, setActiveTab] = useState<TabType>('revenue');

  const formatNumber = (num: number, type: 'currency' | 'percent' | 'number' = 'number') => {
    if (type === 'currency') {
      if (num >= 1e9) return `$${(num / 1e9).toFixed(2)}B`;
      if (num >= 1e6) return `$${(num / 1e6).toFixed(2)}M`;
      if (num >= 1e3) return `$${(num / 1e3).toFixed(2)}K`;
      return `$${num.toFixed(2)}`;
    }
    if (type === 'percent') {
      return `${num >= 0 ? '+' : ''}${num.toFixed(2)}%`;
    }
    if (num >= 1e6) return `${(num / 1e6).toFixed(2)}M`;
    if (num >= 1e3) return `${(num / 1e3).toFixed(1)}K`;
    return num.toLocaleString();
  };

  const getColorClass = (value: number, inverse = false) => {
    if (value === 0) return 'text-gray-400';
    const isPositive = inverse ? value < 0 : value > 0;
    return isPositive ? 'text-green-400' : 'text-red-400';
  };

  const tabs: { id: TabType; label: string }[] = [
    { id: 'revenue', label: '營收成長' },
    { id: 'margins', label: '利潤率' },
    { id: 'expenses', label: '費用率' },
    { id: 'valuation', label: '估值指標' },
    { id: 'saas', label: 'SaaS 指標' },
  ];

  return (
    <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-700">
        <h3 className="text-lg font-semibold text-white">
          財務指標分析
        </h3>
        <p className="text-sm text-gray-400 mt-1">
          {symbol} · {metrics.fiscalPeriod}
        </p>
      </div>

      {/* Tabs */}
      <div className="flex overflow-x-auto border-b border-gray-700">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-3 text-sm font-medium whitespace-nowrap transition-colors ${
              activeTab === tab.id
                ? 'text-blue-400 border-b-2 border-blue-400 bg-gray-700/50'
                : 'text-gray-400 hover:text-gray-300 hover:bg-gray-700/30'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="p-6">
        {activeTab === 'revenue' && (
          <div className="space-y-4">
            <MetricRow
              label="當期營收"
              value={formatNumber(metrics.revenue.current, 'currency')}
            />
            <MetricRow
              label="營收年增率 (YoY)"
              value={formatNumber(metrics.revenue.yoy, 'percent')}
              valueClass={getColorClass(metrics.revenue.yoy)}
              description="與去年同期相比"
            />
            <MetricRow
              label="營收季增率 (QoQ)"
              value={formatNumber(metrics.revenue.qoq, 'percent')}
              valueClass={getColorClass(metrics.revenue.qoq)}
              description="與上一季相比"
            />

            {/* Revenue Growth Chart Placeholder */}
            <div className="mt-6 p-4 bg-gray-900/50 rounded-lg">
              <h4 className="text-sm font-medium text-gray-300 mb-3">營收趨勢</h4>
              <div className="flex items-end gap-1 h-20">
                {[65, 72, 68, 80, 85, 78, 92, 100].map((h, i) => (
                  <div
                    key={i}
                    className="flex-1 bg-blue-500/60 rounded-t hover:bg-blue-500 transition-colors"
                    style={{ height: `${h}%` }}
                  />
                ))}
              </div>
              <div className="flex justify-between text-xs text-gray-500 mt-2">
                <span>Q1'23</span>
                <span>Q4'24</span>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'margins' && (
          <div className="space-y-4">
            <MetricRow
              label="毛利率 (Gross Margin)"
              value={`${metrics.margins.grossMargin.toFixed(1)}%`}
              valueClass={getColorClass(metrics.margins.grossMargin)}
              progress={metrics.margins.grossMargin}
              progressColor="bg-green-500"
            />
            <MetricRow
              label="營運利潤率 (Operating Margin)"
              value={`${metrics.margins.operatingMargin.toFixed(1)}%`}
              valueClass={getColorClass(metrics.margins.operatingMargin)}
              progress={Math.max(0, metrics.margins.operatingMargin)}
              progressColor="bg-blue-500"
            />
            <MetricRow
              label="自由現金流率 (FCF Margin)"
              value={`${metrics.margins.fcfMargin.toFixed(1)}%`}
              valueClass={getColorClass(metrics.margins.fcfMargin)}
              progress={Math.max(0, metrics.margins.fcfMargin)}
              progressColor="bg-purple-500"
            />

            <div className="mt-6 pt-4 border-t border-gray-700">
              <h4 className="text-sm font-medium text-gray-300 mb-3">現金流</h4>
              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 bg-gray-900/50 rounded-lg">
                  <span className="text-xs text-gray-500">營運現金流</span>
                  <p className={`text-lg font-semibold ${getColorClass(metrics.cashFlow.operatingCashFlow)}`}>
                    {formatNumber(metrics.cashFlow.operatingCashFlow, 'currency')}
                  </p>
                </div>
                <div className="p-3 bg-gray-900/50 rounded-lg">
                  <span className="text-xs text-gray-500">自由現金流</span>
                  <p className={`text-lg font-semibold ${getColorClass(metrics.cashFlow.freeCashFlow)}`}>
                    {formatNumber(metrics.cashFlow.freeCashFlow, 'currency')}
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'expenses' && (
          <div className="space-y-4">
            <MetricRow
              label="研發費用率 (R&D)"
              value={`${metrics.expenseRatios.rdExpenseRatio.toFixed(1)}%`}
              progress={metrics.expenseRatios.rdExpenseRatio}
              progressColor="bg-cyan-500"
              description="研發投入佔營收比例"
            />
            <MetricRow
              label="銷售費用率 (S&M)"
              value={`${metrics.expenseRatios.salesExpenseRatio.toFixed(1)}%`}
              progress={metrics.expenseRatios.salesExpenseRatio}
              progressColor="bg-orange-500"
              description="銷售與行銷費用佔營收比例"
            />
            <MetricRow
              label="總管費用率 (G&A)"
              value={`${metrics.expenseRatios.gaExpenseRatio.toFixed(1)}%`}
              progress={metrics.expenseRatios.gaExpenseRatio}
              progressColor="bg-yellow-500"
              description="一般及行政費用佔營收比例"
            />

            <div className="mt-6 p-4 bg-gray-900/50 rounded-lg">
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm text-gray-300">總營運費用率</span>
                <span className="text-lg font-semibold text-white">
                  {metrics.expenseRatios.totalOpex.toFixed(1)}%
                </span>
              </div>
              <div className="h-3 bg-gray-700 rounded-full overflow-hidden flex">
                <div
                  className="bg-cyan-500"
                  style={{ width: `${(metrics.expenseRatios.rdExpenseRatio / metrics.expenseRatios.totalOpex) * 100}%` }}
                />
                <div
                  className="bg-orange-500"
                  style={{ width: `${(metrics.expenseRatios.salesExpenseRatio / metrics.expenseRatios.totalOpex) * 100}%` }}
                />
                <div
                  className="bg-yellow-500"
                  style={{ width: `${(metrics.expenseRatios.gaExpenseRatio / metrics.expenseRatios.totalOpex) * 100}%` }}
                />
              </div>
              <div className="flex gap-4 mt-3 text-xs">
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 bg-cyan-500 rounded" />
                  研發
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 bg-orange-500 rounded" />
                  銷售
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 bg-yellow-500 rounded" />
                  總管
                </span>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'valuation' && (
          <div className="space-y-4">
            <MetricRow
              label="EV/EBITDA"
              value={`${metrics.valuation.evToEbitda.toFixed(1)}x`}
              description="企業價值 / 息稅折舊攤銷前利潤"
            />
            <MetricRow
              label="EV/Revenue"
              value={`${metrics.valuation.evToRevenue.toFixed(1)}x`}
              description="企業價值 / 營收"
            />
            <MetricRow
              label="本益比 (P/E)"
              value={`${metrics.valuation.peRatio.toFixed(1)}x`}
              description="股價 / 每股盈餘"
            />
            <MetricRow
              label="股價淨值比 (P/B)"
              value={`${metrics.valuation.pbRatio.toFixed(1)}x`}
              description="股價 / 每股淨值"
            />

            <div className="mt-6 p-4 bg-blue-900/20 border border-blue-800/50 rounded-lg">
              <p className="text-sm text-blue-300">
                估值指標說明
              </p>
              <p className="text-xs text-gray-400 mt-1">
                較低的 EV/EBITDA 可能表示股票被低估，但需結合行業平均值和公司成長性綜合判斷。
              </p>
            </div>
          </div>
        )}

        {activeTab === 'saas' && (
          <div className="space-y-4">
            {metrics.saasMetrics ? (
              <>
                <MetricRow
                  label="客戶數"
                  value={formatNumber(metrics.saasMetrics.customerCount)}
                  description="付費客戶總數"
                />
                <MetricRow
                  label="年度經常性收入 (ARR)"
                  value={formatNumber(metrics.saasMetrics.arr, 'currency')}
                  description="Annual Recurring Revenue"
                />
                <MetricRow
                  label="淨收入留存率 (NRR)"
                  value={`${metrics.saasMetrics.nrr.toFixed(0)}%`}
                  valueClass={metrics.saasMetrics.nrr >= 100 ? 'text-green-400' : 'text-yellow-400'}
                  progress={Math.min(150, metrics.saasMetrics.nrr)}
                  progressColor={metrics.saasMetrics.nrr >= 100 ? 'bg-green-500' : 'bg-yellow-500'}
                  progressMax={150}
                  description="包含擴展收入的留存率"
                />
                <MetricRow
                  label="毛收入留存率 (GRR)"
                  value={`${metrics.saasMetrics.grr.toFixed(0)}%`}
                  valueClass={metrics.saasMetrics.grr >= 90 ? 'text-green-400' : 'text-yellow-400'}
                  progress={metrics.saasMetrics.grr}
                  progressColor={metrics.saasMetrics.grr >= 90 ? 'bg-green-500' : 'bg-yellow-500'}
                  description="不含擴展收入的基礎留存率"
                />

                {metrics.marketExpansion && (
                  <div className="mt-6 pt-4 border-t border-gray-700">
                    <h4 className="text-sm font-medium text-gray-300 mb-3">市場拓展</h4>
                    <MetricRow
                      label="市場滲透率"
                      value={`${metrics.marketExpansion.marketPenetration.toFixed(1)}%`}
                      progress={metrics.marketExpansion.marketPenetration}
                      progressColor="bg-indigo-500"
                    />
                    <div className="mt-4">
                      <span className="text-xs text-gray-500">營運地區分佈</span>
                      <div className="mt-2 space-y-2">
                        {metrics.marketExpansion.regionalRevenue.map((r) => (
                          <div key={r.region} className="flex items-center gap-2">
                            <span className="text-sm text-gray-300 w-20">{r.region}</span>
                            <div className="flex-1 h-2 bg-gray-700 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-indigo-500"
                                style={{ width: `${r.percentage}%` }}
                              />
                            </div>
                            <span className="text-sm text-gray-400 w-12 text-right">
                              {r.percentage}%
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="text-center py-8">
                <p className="text-gray-400">
                  此股票無 SaaS 相關指標
                </p>
                <p className="text-sm text-gray-500 mt-1">
                  SaaS 指標適用於軟體即服務類型公司
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-6 py-3 bg-gray-900/50 border-t border-gray-700">
        <p className="text-xs text-gray-500">
          資料更新時間：{new Date(metrics.lastUpdated).toLocaleDateString('zh-TW')}
        </p>
      </div>
    </div>
  );
}

// Helper component for consistent metric display
function MetricRow({
  label,
  value,
  valueClass = 'text-white',
  description,
  progress,
  progressColor = 'bg-blue-500',
  progressMax = 100,
}: {
  label: string;
  value: string;
  valueClass?: string;
  description?: string;
  progress?: number;
  progressColor?: string;
  progressMax?: number;
}) {
  return (
    <div className="space-y-1">
      <div className="flex justify-between items-baseline">
        <span className="text-sm text-gray-400">{label}</span>
        <span className={`text-lg font-semibold ${valueClass}`}>{value}</span>
      </div>
      {progress !== undefined && (
        <div className="h-1.5 bg-gray-700 rounded-full overflow-hidden">
          <div
            className={`h-full ${progressColor} transition-all`}
            style={{ width: `${Math.min(100, (progress / progressMax) * 100)}%` }}
          />
        </div>
      )}
      {description && (
        <p className="text-xs text-gray-500">{description}</p>
      )}
    </div>
  );
}
