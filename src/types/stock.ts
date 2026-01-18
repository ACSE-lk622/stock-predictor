export interface StockQuote {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  open: number;
  high: number;
  low: number;
  volume: number;
  marketCap?: number;
  timestamp: Date;
}

export interface HistoricalDataPoint {
  date: Date;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  adjClose?: number;
}

export interface TechnicalIndicators {
  rsi: number;
  macd: {
    macd: number;
    signal: number;
    histogram: number;
  };
  bollingerBands: {
    upper: number;
    middle: number;
    lower: number;
  };
  sma20: number;
  sma50: number;
  sma200: number;
  ema12: number;
  ema26: number;
}

export interface PredictionResult {
  symbol: string;
  predictedPrice: number;
  currentPrice: number;
  priceChange: number;
  priceChangePercent: number;
  direction: 'up' | 'down' | 'neutral';
  confidence: number;
  predictions: {
    lstm: number;
    xgboost: number;
  };
  generatedAt: Date;
  targetDate: Date;
}

export interface StockSearchResult {
  symbol: string;
  name: string;
  exchange: string;
  type: string;
}

export interface WatchlistItem {
  symbol: string;
  name: string;
  addedAt: Date;
}

export interface ChartDataPoint {
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

export interface PredictionChartData {
  historical: ChartDataPoint[];
  predicted: ChartDataPoint[];
}

// 財務指標類型
export interface FinancialMetrics {
  // 營收成長
  revenue: {
    current: number;           // 當期營收
    yoy: number;               // 營收年增率 (Year-over-Year)
    qoq: number;               // 營收季增率 (Quarter-over-Quarter)
  };

  // SaaS 指標
  saasMetrics: {
    customerCount: number;     // 客戶數
    arr: number;               // 年度經常性收入 (Annual Recurring Revenue)
    nrr: number;               // 淨收入留存率 (Net Revenue Retention)
    grr: number;               // 毛收入留存率 (Gross Revenue Retention)
  } | null;

  // 市場拓展
  marketExpansion: {
    marketPenetration: number; // 市場滲透率 (%)
    regions: string[];         // 營運地區
    regionalRevenue: { region: string; percentage: number }[];
  } | null;

  // 利潤率指標
  margins: {
    grossMargin: number;       // 毛利率 (Gross Margin)
    operatingMargin: number;   // 營運利潤率 (Operating Margin)
    fcfMargin: number;         // 自由現金流率 (FCF Margin)
  };

  // 現金流
  cashFlow: {
    operatingCashFlow: number; // 營運現金流
    freeCashFlow: number;      // 自由現金流 (Free Cash Flow)
    fcfPerShare: number;       // 每股自由現金流
  };

  // 費用率
  expenseRatios: {
    rdExpenseRatio: number;    // 研發費用率
    salesExpenseRatio: number; // 銷售費用率
    gaExpenseRatio: number;    // 總管費用率 (General & Administrative)
    totalOpex: number;         // 總營運費用率
  };

  // 估值指標
  valuation: {
    evToEbitda: number;        // 企業價值/息稅折舊攤銷前利潤
    evToRevenue: number;       // 企業價值/營收
    peRatio: number;           // 本益比
    pbRatio: number;           // 股價淨值比
  };

  // 資料更新時間
  lastUpdated: Date;
  fiscalPeriod: string;        // 財務期間 (e.g., "2024Q3")
}
