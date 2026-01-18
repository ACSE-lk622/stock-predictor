'use client';

import { useState } from 'react';

interface NewsItem {
  id: string;
  title: string;
  summary: string;
  url: string;
  source: string;
  publishedAt: Date | string;
  thumbnail?: string;
}

interface StockNewsCardProps {
  news: NewsItem[];
  symbol: string;
  isLoading?: boolean;
}

function formatTimeAgo(date: Date | string): string {
  const now = new Date();
  const publishedDate = new Date(date);
  const diffInSeconds = Math.floor((now.getTime() - publishedDate.getTime()) / 1000);

  if (diffInSeconds < 60) {
    return '剛剛';
  }

  const diffInMinutes = Math.floor(diffInSeconds / 60);
  if (diffInMinutes < 60) {
    return `${diffInMinutes} 分鐘前`;
  }

  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) {
    return `${diffInHours} 小時前`;
  }

  const diffInDays = Math.floor(diffInHours / 24);
  if (diffInDays < 7) {
    return `${diffInDays} 天前`;
  }

  const diffInWeeks = Math.floor(diffInDays / 7);
  if (diffInWeeks < 4) {
    return `${diffInWeeks} 週前`;
  }

  return publishedDate.toLocaleDateString('zh-TW');
}

export function StockNewsCard({ news, symbol, isLoading }: StockNewsCardProps) {
  const [showAll, setShowAll] = useState(false);
  const displayNews = showAll ? news : news.slice(0, 5);

  if (isLoading) {
    return (
      <div className="bg-gray-800 rounded-xl border border-gray-700 p-6">
        <h3 className="text-lg font-semibold text-white mb-4">相關新聞</h3>
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="animate-pulse">
              <div className="h-4 bg-gray-700 rounded w-3/4 mb-2" />
              <div className="h-3 bg-gray-700 rounded w-1/4" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (news.length === 0) {
    return (
      <div className="bg-gray-800 rounded-xl border border-gray-700 p-6">
        <h3 className="text-lg font-semibold text-white mb-4">相關新聞</h3>
        <p className="text-gray-400 text-center py-8">
          暫無 {symbol} 相關新聞
        </p>
      </div>
    );
  }

  return (
    <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-700 flex items-center justify-between">
        <h3 className="text-lg font-semibold text-white">
          相關新聞
        </h3>
        <span className="text-sm text-gray-400">
          {news.length} 則新聞
        </span>
      </div>

      <div className="divide-y divide-gray-700">
        {displayNews.map((item) => (
          <a
            key={item.id}
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
            className="block p-4 hover:bg-gray-700/50 transition-colors"
          >
            <div className="flex gap-4">
              {/* Thumbnail */}
              {item.thumbnail && (
                <div className="flex-shrink-0 w-20 h-14 rounded overflow-hidden bg-gray-700">
                  <img
                    src={item.thumbnail}
                    alt=""
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = 'none';
                    }}
                  />
                </div>
              )}

              {/* Content */}
              <div className="flex-1 min-w-0">
                <h4 className="text-sm font-medium text-white line-clamp-2 mb-1 hover:text-blue-400 transition-colors">
                  {item.title}
                </h4>
                <div className="flex items-center gap-2 text-xs text-gray-500">
                  <span className="text-gray-400">{item.source}</span>
                  <span>·</span>
                  <span>{formatTimeAgo(item.publishedAt)}</span>
                </div>
              </div>

              {/* External link icon */}
              <div className="flex-shrink-0 text-gray-500">
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
                    d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                  />
                </svg>
              </div>
            </div>
          </a>
        ))}
      </div>

      {/* Show more button */}
      {news.length > 5 && (
        <div className="px-6 py-3 border-t border-gray-700 bg-gray-900/50">
          <button
            onClick={() => setShowAll(!showAll)}
            className="w-full text-center text-sm text-blue-400 hover:text-blue-300 transition-colors"
          >
            {showAll ? '顯示較少' : `顯示全部 ${news.length} 則新聞`}
          </button>
        </div>
      )}
    </div>
  );
}
