'use client';

import type { StockQuote } from '@/types/stock';
import { useStockStore } from '@/stores/stockStore';

interface QuoteCardProps {
  quote: StockQuote;
}

export function QuoteCard({ quote }: QuoteCardProps) {
  const { addToWatchlist, removeFromWatchlist, isInWatchlist } = useStockStore();
  const inWatchlist = isInWatchlist(quote.symbol);

  const change = quote.change ?? 0;
  const changePercent = quote.changePercent ?? 0;
  const price = quote.price ?? 0;
  const open = quote.open ?? 0;
  const high = quote.high ?? 0;
  const low = quote.low ?? 0;
  const volume = quote.volume ?? 0;

  const isPositive = change >= 0;
  const changeColor = isPositive ? 'text-green-400' : 'text-red-400';

  const toggleWatchlist = () => {
    if (inWatchlist) {
      removeFromWatchlist(quote.symbol);
    } else {
      addToWatchlist(quote.symbol, quote.name);
    }
  };

  return (
    <div className="bg-gray-800 rounded-xl p-4 sm:p-6 border border-gray-700">
      <div className="flex items-start justify-between mb-4 gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2 sm:gap-3">
            <h2 className="text-xl sm:text-2xl font-bold text-white">{quote.symbol}</h2>
            <button
              onClick={toggleWatchlist}
              className={`p-1.5 rounded-lg transition-colors ${
                inWatchlist
                  ? 'bg-yellow-500/20 text-yellow-400 hover:bg-yellow-500/30'
                  : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
              }`}
              title={inWatchlist ? '從自選股移除' : '加入自選股'}
            >
              <svg
                className="w-5 h-5"
                fill={inWatchlist ? 'currentColor' : 'none'}
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"
                />
              </svg>
            </button>
          </div>
          <p className="text-gray-400 text-sm">{quote.name}</p>
        </div>
        <div className="text-right flex-shrink-0">
          <p className="text-2xl sm:text-3xl font-bold text-white">
            ${price.toFixed(2)}
          </p>
          <p className={`text-sm sm:text-lg font-semibold ${changeColor}`}>
            {isPositive ? '+' : ''}
            {change.toFixed(2)} ({isPositive ? '+' : ''}
            {changePercent.toFixed(2)}%)
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mt-4 pt-4 border-t border-gray-700">
        <div>
          <p className="text-xs text-gray-500 uppercase">開盤</p>
          <p className="text-sm font-medium text-white">
            ${open.toFixed(2)}
          </p>
        </div>
        <div>
          <p className="text-xs text-gray-500 uppercase">最高</p>
          <p className="text-sm font-medium text-green-400">
            ${high.toFixed(2)}
          </p>
        </div>
        <div>
          <p className="text-xs text-gray-500 uppercase">最低</p>
          <p className="text-sm font-medium text-red-400">
            ${low.toFixed(2)}
          </p>
        </div>
        <div>
          <p className="text-xs text-gray-500 uppercase">成交量</p>
          <p className="text-sm font-medium text-white">
            {formatVolume(volume)}
          </p>
        </div>
      </div>

      {quote.marketCap && (
        <div className="mt-4 pt-4 border-t border-gray-700">
          <p className="text-xs text-gray-500 uppercase">市值</p>
          <p className="text-sm font-medium text-white">
            {formatMarketCap(quote.marketCap)}
          </p>
        </div>
      )}

      <p className="text-xs text-gray-500 mt-4">
        最後更新: {quote.timestamp ? new Date(quote.timestamp).toLocaleString('zh-TW') : '無資料'}
      </p>
    </div>
  );
}

function formatVolume(volume: number): string {
  if (volume >= 1_000_000_000) {
    return `${(volume / 1_000_000_000).toFixed(2)}B`;
  }
  if (volume >= 1_000_000) {
    return `${(volume / 1_000_000).toFixed(2)}M`;
  }
  if (volume >= 1_000) {
    return `${(volume / 1_000).toFixed(2)}K`;
  }
  return volume.toString();
}

function formatMarketCap(marketCap: number): string {
  if (marketCap >= 1_000_000_000_000) {
    return `$${(marketCap / 1_000_000_000_000).toFixed(2)}兆`;
  }
  if (marketCap >= 1_000_000_000) {
    return `$${(marketCap / 1_000_000_000).toFixed(2)}億`;
  }
  if (marketCap >= 1_000_000) {
    return `$${(marketCap / 1_000_000).toFixed(2)}百萬`;
  }
  return `$${marketCap.toLocaleString()}`;
}
