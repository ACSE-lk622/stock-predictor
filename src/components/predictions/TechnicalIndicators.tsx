'use client';

import type { TechnicalIndicators } from '@/types/stock';

interface TechnicalIndicatorsCardProps {
  indicators: TechnicalIndicators;
  currentPrice: number;
}

export function TechnicalIndicatorsCard({
  indicators,
  currentPrice,
}: TechnicalIndicatorsCardProps) {
  const getRSISignal = (rsi: number) => {
    if (rsi > 70) return { text: '超買', color: 'text-red-400' };
    if (rsi < 30) return { text: '超賣', color: 'text-green-400' };
    return { text: '中性', color: 'text-gray-400' };
  };

  const getMACDSignal = (histogram: number) => {
    if (histogram > 0) return { text: '看漲', color: 'text-green-400' };
    if (histogram < 0) return { text: '看跌', color: 'text-red-400' };
    return { text: '中性', color: 'text-gray-400' };
  };

  const getPriceVsSMA = (price: number, sma: number) => {
    if (sma === 0) return { text: '無資料', color: 'text-gray-400' };
    const diff = ((price - sma) / sma) * 100;
    if (diff > 2) return { text: `+${diff.toFixed(1)}%`, color: 'text-green-400' };
    if (diff < -2) return { text: `${diff.toFixed(1)}%`, color: 'text-red-400' };
    return { text: `${diff.toFixed(1)}%`, color: 'text-gray-400' };
  };

  const rsiSignal = getRSISignal(indicators.rsi);
  const macdSignal = getMACDSignal(indicators.macd.histogram);

  return (
    <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
      <h3 className="text-lg font-semibold text-white mb-4">
        技術指標
      </h3>

      <div className="space-y-4">
        {/* RSI */}
        <div className="bg-gray-900/50 rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-400">RSI (14日)</span>
            <span className={`text-sm font-medium ${rsiSignal.color}`}>
              {rsiSignal.text}
            </span>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-2xl font-bold text-white">
              {indicators.rsi.toFixed(1)}
            </span>
            <div className="flex-1">
              <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${
                    indicators.rsi > 70
                      ? 'bg-red-500'
                      : indicators.rsi < 30
                        ? 'bg-green-500'
                        : 'bg-blue-500'
                  }`}
                  style={{ width: `${indicators.rsi}%` }}
                />
              </div>
              <div className="flex justify-between text-xs text-gray-500 mt-1">
                <span>0</span>
                <span>30</span>
                <span>70</span>
                <span>100</span>
              </div>
            </div>
          </div>
        </div>

        {/* MACD */}
        <div className="bg-gray-900/50 rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-400">MACD</span>
            <span className={`text-sm font-medium ${macdSignal.color}`}>
              {macdSignal.text}
            </span>
          </div>
          <div className="grid grid-cols-3 gap-2 text-sm">
            <div>
              <span className="text-gray-500">線</span>
              <p className="font-medium text-white">
                {indicators.macd.macd.toFixed(2)}
              </p>
            </div>
            <div>
              <span className="text-gray-500">訊號</span>
              <p className="font-medium text-white">
                {indicators.macd.signal.toFixed(2)}
              </p>
            </div>
            <div>
              <span className="text-gray-500">柱狀圖</span>
              <p
                className={`font-medium ${
                  indicators.macd.histogram >= 0
                    ? 'text-green-400'
                    : 'text-red-400'
                }`}
              >
                {indicators.macd.histogram.toFixed(2)}
              </p>
            </div>
          </div>
        </div>

        {/* Bollinger Bands */}
        <div className="bg-gray-900/50 rounded-lg p-4">
          <span className="text-sm text-gray-400">布林通道</span>
          <div className="mt-2 space-y-1">
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">上軌</span>
              <span className="text-red-400">
                ${indicators.bollingerBands.upper.toFixed(2)}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">中軌</span>
              <span className="text-white">
                ${indicators.bollingerBands.middle.toFixed(2)}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">下軌</span>
              <span className="text-green-400">
                ${indicators.bollingerBands.lower.toFixed(2)}
              </span>
            </div>
          </div>
        </div>

        {/* Moving Averages */}
        <div className="bg-gray-900/50 rounded-lg p-4">
          <span className="text-sm text-gray-400">移動平均線</span>
          <div className="mt-2 space-y-2">
            {[
              { label: 'SMA 20', value: indicators.sma20 },
              { label: 'SMA 50', value: indicators.sma50 },
              { label: 'SMA 200', value: indicators.sma200 },
              { label: 'EMA 12', value: indicators.ema12 },
              { label: 'EMA 26', value: indicators.ema26 },
            ].map(({ label, value }) => {
              const signal = getPriceVsSMA(currentPrice, value);
              return (
                <div key={label} className="flex justify-between text-sm">
                  <span className="text-gray-500">{label}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-white">
                      ${value > 0 ? value.toFixed(2) : '無資料'}
                    </span>
                    <span className={`text-xs ${signal.color}`}>
                      {signal.text}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
