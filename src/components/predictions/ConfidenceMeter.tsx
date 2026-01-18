'use client';

interface ConfidenceMeterProps {
  confidence: number;
}

export function ConfidenceMeter({ confidence }: ConfidenceMeterProps) {
  const getConfidenceLevel = (value: number) => {
    if (value >= 75) return { label: '高', color: 'bg-green-500' };
    if (value >= 50) return { label: '中', color: 'bg-yellow-500' };
    if (value >= 25) return { label: '低', color: 'bg-orange-500' };
    return { label: '極低', color: 'bg-red-500' };
  };

  const { label, color } = getConfidenceLevel(confidence);

  return (
    <div className="bg-gray-900/50 rounded-lg p-4">
      <div className="flex items-center justify-between mb-2">
        <p className="text-sm text-gray-400">預測信心度</p>
        <span className={`text-sm font-medium ${
          confidence >= 75 ? 'text-green-400' :
          confidence >= 50 ? 'text-yellow-400' :
          confidence >= 25 ? 'text-orange-400' : 'text-red-400'
        }`}>
          {label}
        </span>
      </div>

      <div className="relative">
        {/* Background bar */}
        <div className="h-3 bg-gray-700 rounded-full overflow-hidden">
          {/* Confidence fill */}
          <div
            className={`h-full ${color} transition-all duration-500 ease-out rounded-full`}
            style={{ width: `${Math.min(100, Math.max(0, confidence))}%` }}
          />
        </div>

        {/* Scale markers */}
        <div className="flex justify-between mt-1">
          <span className="text-xs text-gray-500">0%</span>
          <span className="text-xs text-gray-500">25%</span>
          <span className="text-xs text-gray-500">50%</span>
          <span className="text-xs text-gray-500">75%</span>
          <span className="text-xs text-gray-500">100%</span>
        </div>
      </div>

      <div className="mt-3 flex items-center justify-center">
        <span className="text-3xl font-bold text-white">{confidence}%</span>
      </div>

      <p className="text-xs text-gray-500 text-center mt-2">
        基於模型一致性及市場狀況計算
      </p>
    </div>
  );
}
