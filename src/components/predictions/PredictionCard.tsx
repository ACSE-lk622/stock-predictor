'use client';

import type { PredictionResult } from '@/types/stock';
import { ConfidenceMeter } from './ConfidenceMeter';

interface PredictionCardProps {
  prediction: PredictionResult;
}

export function PredictionCard({ prediction }: PredictionCardProps) {
  const isPositive = prediction.direction === 'up';
  const isNeutral = prediction.direction === 'neutral';

  const directionColor = isNeutral
    ? 'text-gray-400'
    : isPositive
      ? 'text-green-400'
      : 'text-red-400';

  const directionBg = isNeutral
    ? 'bg-gray-800'
    : isPositive
      ? 'bg-green-900/20 border-green-800'
      : 'bg-red-900/20 border-red-800';

  const directionIcon = isNeutral ? '→' : isPositive ? '↑' : '↓';

  const directionText = isNeutral ? '持平' : isPositive ? '看漲' : '看跌';

  return (
    <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-white">
          {prediction.symbol} AI 預測
        </h3>
        <span className="text-xs text-gray-500">
          目標日期: {prediction.targetDate.toLocaleDateString('zh-TW')}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-6">
        {/* Current Price */}
        <div className="bg-gray-900/50 rounded-lg p-4">
          <p className="text-sm text-gray-400 mb-1">目前價格</p>
          <p className="text-2xl font-bold text-white">
            ${prediction.currentPrice.toFixed(2)}
          </p>
        </div>

        {/* Predicted Price */}
        <div className={`rounded-lg p-4 border ${directionBg}`}>
          <p className="text-sm text-gray-400 mb-1">預測價格</p>
          <p className={`text-2xl font-bold ${directionColor}`}>
            ${prediction.predictedPrice.toFixed(2)}
          </p>
        </div>
      </div>

      {/* Direction and Change */}
      <div
        className={`flex items-center justify-between rounded-lg p-4 mb-6 border ${directionBg}`}
      >
        <div className="flex items-center gap-3">
          <span className={`text-3xl ${directionColor}`}>{directionIcon}</span>
          <div>
            <p className={`text-lg font-semibold ${directionColor}`}>
              {directionText}
            </p>
            <p className="text-sm text-gray-400">預測方向</p>
          </div>
        </div>
        <div className="text-right">
          <p className={`text-lg font-semibold ${directionColor}`}>
            {prediction.priceChange >= 0 ? '+' : ''}
            ${prediction.priceChange.toFixed(2)}
          </p>
          <p className={`text-sm ${directionColor}`}>
            ({prediction.priceChangePercent >= 0 ? '+' : ''}
            {prediction.priceChangePercent.toFixed(2)}%)
          </p>
        </div>
      </div>

      {/* Confidence Meter */}
      <ConfidenceMeter confidence={prediction.confidence} />

      {/* Model Breakdown */}
      <div className="mt-6 pt-4 border-t border-gray-700">
        <p className="text-sm text-gray-400 mb-3">模型預測細節</p>
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-gray-900/50 rounded-lg p-3">
            <p className="text-xs text-gray-500 mb-1">LSTM (深度學習)</p>
            <p className="text-lg font-semibold text-blue-400">
              ${prediction.predictions.lstm.toFixed(2)}
            </p>
          </div>
          <div className="bg-gray-900/50 rounded-lg p-3">
            <p className="text-xs text-gray-500 mb-1">XGBoost (整合學習)</p>
            <p className="text-lg font-semibold text-purple-400">
              ${prediction.predictions.xgboost.toFixed(2)}
            </p>
          </div>
        </div>
      </div>

      {/* Timestamp */}
      <p className="text-xs text-gray-500 mt-4 text-center">
        產生時間: {prediction.generatedAt.toLocaleString('zh-TW')}
      </p>
    </div>
  );
}
