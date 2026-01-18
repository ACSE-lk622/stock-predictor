import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { WatchlistItem, StockQuote, PredictionResult } from '@/types/stock';

interface StockState {
  selectedSymbol: string | null;
  watchlist: WatchlistItem[];
  recentSearches: string[];
  predictions: Record<string, PredictionResult>;
  quotes: Record<string, StockQuote>;

  // Actions
  setSelectedSymbol: (symbol: string | null) => void;
  addToWatchlist: (symbol: string, name: string) => void;
  removeFromWatchlist: (symbol: string) => void;
  isInWatchlist: (symbol: string) => boolean;
  addRecentSearch: (symbol: string) => void;
  clearRecentSearches: () => void;
  setPrediction: (symbol: string, prediction: PredictionResult) => void;
  setQuote: (symbol: string, quote: StockQuote) => void;
}

export const useStockStore = create<StockState>()(
  persist(
    (set, get) => ({
      selectedSymbol: null,
      watchlist: [],
      recentSearches: [],
      predictions: {},
      quotes: {},

      setSelectedSymbol: (symbol) => set({ selectedSymbol: symbol }),

      addToWatchlist: (symbol, name) => {
        const upperSymbol = symbol.toUpperCase();
        const current = get().watchlist;
        if (!current.find((item) => item.symbol === upperSymbol)) {
          set({
            watchlist: [
              ...current,
              { symbol: upperSymbol, name, addedAt: new Date() },
            ],
          });
        }
      },

      removeFromWatchlist: (symbol) => {
        const upperSymbol = symbol.toUpperCase();
        set({
          watchlist: get().watchlist.filter(
            (item) => item.symbol !== upperSymbol
          ),
        });
      },

      isInWatchlist: (symbol) => {
        const upperSymbol = symbol.toUpperCase();
        return get().watchlist.some((item) => item.symbol === upperSymbol);
      },

      addRecentSearch: (symbol) => {
        const upperSymbol = symbol.toUpperCase();
        const current = get().recentSearches;
        const filtered = current.filter((s) => s !== upperSymbol);
        set({
          recentSearches: [upperSymbol, ...filtered].slice(0, 10),
        });
      },

      clearRecentSearches: () => set({ recentSearches: [] }),

      setPrediction: (symbol, prediction) => {
        set({
          predictions: {
            ...get().predictions,
            [symbol.toUpperCase()]: prediction,
          },
        });
      },

      setQuote: (symbol, quote) => {
        set({
          quotes: {
            ...get().quotes,
            [symbol.toUpperCase()]: quote,
          },
        });
      },
    }),
    {
      name: 'stock-predictor-storage',
      partialize: (state) => ({
        watchlist: state.watchlist,
        recentSearches: state.recentSearches,
      }),
    }
  )
);
