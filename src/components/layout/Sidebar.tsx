'use client';

import { useState } from 'react';
import { useStockStore } from '@/stores/stockStore';

interface SidebarProps {
  onSelectSymbol: (symbol: string) => void;
}

export function Sidebar({ onSelectSymbol }: SidebarProps) {
  const { watchlist, removeFromWatchlist, recentSearches, selectedSymbol } =
    useStockStore();
  const [isOpen, setIsOpen] = useState(false);

  const handleSelect = (symbol: string) => {
    onSelectSymbol(symbol);
    setIsOpen(false); // 手機版選擇後自動關閉
  };

  return (
    <>
      {/* 手機版漢堡選單按鈕 */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="lg:hidden fixed top-20 left-4 z-50 bg-gray-800 p-2 rounded-lg border border-gray-700"
        aria-label="開啟選單"
      >
        <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          {isOpen ? (
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          ) : (
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          )}
        </svg>
      </button>

      {/* 手機版背景遮罩 */}
      {isOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/50 z-40"
          onClick={() => setIsOpen(false)}
        />
      )}

      <aside className={`
        fixed lg:relative
        w-64 bg-gray-900 border-r border-gray-800 h-full overflow-y-auto
        z-40 transition-transform duration-300
        ${isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
      <div className="p-4">
        {/* Watchlist */}
        <div className="mb-6">
          <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">
            自選股
          </h3>
          {watchlist.length === 0 ? (
            <p className="text-gray-500 text-sm">尚無自選股</p>
          ) : (
            <ul className="space-y-1">
              {watchlist.map((item) => (
                <li key={item.symbol}>
                  <div
                    onClick={() => handleSelect(item.symbol)}
                    className={`w-full text-left px-3 py-2 rounded-lg transition-colors flex items-center justify-between group cursor-pointer ${
                      selectedSymbol === item.symbol
                        ? 'bg-blue-600 text-white'
                        : 'text-gray-300 hover:bg-gray-800'
                    }`}
                  >
                    <div>
                      <span className="font-medium">{item.symbol}</span>
                      <span className="text-xs text-gray-400 block truncate">
                        {item.name}
                      </span>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        removeFromWatchlist(item.symbol);
                      }}
                      className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-400 transition-opacity"
                      title="從自選股移除"
                    >
                      <svg
                        className="w-4 h-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M6 18L18 6M6 6l12 12"
                        />
                      </svg>
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Recent Searches */}
        {recentSearches.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">
              最近搜尋
            </h3>
            <ul className="space-y-1">
              {recentSearches.slice(0, 5).map((symbol) => (
                <li key={symbol}>
                  <button
                    onClick={() => handleSelect(symbol)}
                    className={`w-full text-left px-3 py-2 rounded-lg transition-colors ${
                      selectedSymbol === symbol
                        ? 'bg-blue-600 text-white'
                        : 'text-gray-300 hover:bg-gray-800'
                    }`}
                  >
                    {symbol}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Popular Stocks */}
        <div className="mt-6">
          <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">
            熱門股票
          </h3>
          <ul className="space-y-1">
            {['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'TSLA', 'NVDA'].map((symbol) => (
              <li key={symbol}>
                <button
                  onClick={() => handleSelect(symbol)}
                  className={`w-full text-left px-3 py-2 rounded-lg transition-colors ${
                    selectedSymbol === symbol
                      ? 'bg-blue-600 text-white'
                      : 'text-gray-300 hover:bg-gray-800'
                  }`}
                >
                  {symbol}
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </aside>
    </>
  );
}
