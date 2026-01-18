'use client';

import Link from 'next/link';
import { StockSearch } from '../search/StockSearch';

export function Header() {
  return (
    <header className="bg-gray-900 border-b border-gray-800 sticky top-0 z-50">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16 gap-2">
          <Link href="/" className="flex items-center gap-2 flex-shrink-0">
            <span className="text-lg sm:text-xl font-bold text-white">股票預測</span>
          </Link>

          <div className="flex-1 max-w-xl mx-2 sm:mx-8">
            <StockSearch />
          </div>

          <nav className="hidden sm:flex items-center gap-4">
            <Link
              href="/dashboard"
              className="text-gray-300 hover:text-white transition-colors"
            >
              儀表板
            </Link>
          </nav>
        </div>
      </div>
    </header>
  );
}
