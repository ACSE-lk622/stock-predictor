'use client';

import {
  ResponsiveContainer,
  ComposedChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
} from 'recharts';
import type { ChartDataPoint, PredictionResult } from '@/types/stock';

interface PredictionChartProps {
  historicalData: ChartDataPoint[];
  prediction: PredictionResult | null;
  height?: number;
}

export function PredictionChart({
  historicalData,
  prediction,
  height = 300,
}: PredictionChartProps) {
  // Take last 30 days of historical data
  const recentData = historicalData.slice(-30);

  // Prepare chart data
  const chartData = recentData.map((d) => ({
    date: d.time,
    price: d.close,
    type: 'historical',
  }));

  // Add prediction point if available
  if (prediction) {
    const lastDate = recentData[recentData.length - 1]?.time;
    if (lastDate) {
      // Add current price point
      chartData.push({
        date: lastDate,
        price: prediction.currentPrice,
        type: 'current',
      });

      // Add predicted point
      const predDate = prediction.targetDate.toISOString().split('T')[0];
      chartData.push({
        date: predDate,
        price: prediction.predictedPrice,
        type: 'prediction',
      });
    }
  }

  // Calculate Y-axis domain
  const prices = chartData.map((d) => d.price);
  const minPrice = Math.min(...prices) * 0.98;
  const maxPrice = Math.max(...prices) * 1.02;

  return (
    <div className="bg-gray-800 rounded-lg p-4">
      <h3 className="text-lg font-semibold text-white mb-4">
        價格預測圖
      </h3>

      <ResponsiveContainer width="100%" height={height}>
        <ComposedChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis
            dataKey="date"
            stroke="#9ca3af"
            tick={{ fill: '#9ca3af', fontSize: 12 }}
            tickFormatter={(value) => {
              const date = new Date(value);
              return `${date.getMonth() + 1}/${date.getDate()}`;
            }}
          />
          <YAxis
            domain={[minPrice, maxPrice]}
            stroke="#9ca3af"
            tick={{ fill: '#9ca3af', fontSize: 12 }}
            tickFormatter={(value) => `$${value.toFixed(0)}`}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: '#1f2937',
              border: '1px solid #374151',
              borderRadius: '8px',
            }}
            labelStyle={{ color: '#9ca3af' }}
            formatter={(value: number, name: string) => [
              `$${value.toFixed(2)}`,
              name,
            ]}
          />
          <Legend />

          {/* Historical price line */}
          <Line
            type="monotone"
            dataKey="price"
            stroke="#3b82f6"
            strokeWidth={2}
            dot={false}
            name="歷史價格"
          />

          {/* Current price reference line */}
          {prediction && (
            <ReferenceLine
              y={prediction.currentPrice}
              stroke="#6b7280"
              strokeDasharray="3 3"
              label={{
                value: `目前: $${prediction.currentPrice}`,
                fill: '#9ca3af',
                fontSize: 12,
              }}
            />
          )}

          {/* Prediction point */}
          {prediction && (
            <ReferenceLine
              y={prediction.predictedPrice}
              stroke={prediction.direction === 'up' ? '#22c55e' : '#ef4444'}
              strokeDasharray="5 5"
              label={{
                value: `預測: $${prediction.predictedPrice}`,
                fill: prediction.direction === 'up' ? '#22c55e' : '#ef4444',
                fontSize: 12,
              }}
            />
          )}
        </ComposedChart>
      </ResponsiveContainer>

      {prediction && (
        <div className="mt-4 flex items-center justify-center gap-6 text-sm">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-blue-500 rounded-full" />
            <span className="text-gray-400">歷史價格</span>
          </div>
          <div className="flex items-center gap-2">
            <div
              className={`w-3 h-3 rounded-full ${
                prediction.direction === 'up' ? 'bg-green-500' : 'bg-red-500'
              }`}
            />
            <span className="text-gray-400">預測價格</span>
          </div>
        </div>
      )}
    </div>
  );
}
