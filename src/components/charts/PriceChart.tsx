'use client';

import { useEffect, useRef, useState } from 'react';
import { createChart, ColorType, IChartApi, Time } from 'lightweight-charts';
import type { ChartDataPoint } from '@/types/stock';

interface PriceChartProps {
  data: ChartDataPoint[];
  height?: number;
  period?: '1d' | '5d' | '1mo' | '3mo' | '6mo' | '1y' | '5y';
  // 固定的 SMA 值（從 1Y 資料計算，不隨圖表週期改變）
  fixedSma50?: number | null;
  fixedSma200?: number | null;
}

// Calculate Simple Moving Average
function calculateSMA(data: ChartDataPoint[], period: number): { time: string; value: number }[] {
  const result: { time: string; value: number }[] = [];

  for (let i = period - 1; i < data.length; i++) {
    let sum = 0;
    for (let j = 0; j < period; j++) {
      sum += data[i - j].close;
    }
    result.push({
      time: data[i].time as string,
      value: sum / period,
    });
  }

  return result;
}

// Darvas Box Theory calculation
interface DarvasBox {
  startTime: string;
  endTime: string;
  top: number;
  bottom: number;
}

function calculateDarvasBoxes(data: ChartDataPoint[], lookback: number = 5): DarvasBox[] {
  const boxes: DarvasBox[] = [];

  if (data.length < lookback + 3) return boxes;

  let i = lookback;
  while (i < data.length - 1) {
    // Find a local high (highest in last lookback days)
    let isLocalHigh = true;
    const currentHigh = data[i].high;

    for (let j = 1; j <= lookback; j++) {
      if (data[i - j].high > currentHigh) {
        isLocalHigh = false;
        break;
      }
    }

    if (isLocalHigh) {
      // Found a local high, now look for box formation
      const boxTop = currentHigh;
      let boxBottom = data[i].low;
      let consolidationDays = 0;
      let boxEndIndex = i;

      // Look for consolidation (1+ days without breaking high significantly)
      for (let j = i + 1; j < data.length && j < i + 50; j++) {
        if (data[j].high > boxTop * 1.02) {
          // Breakout above 2% - box complete
          break;
        }
        if (data[j].low < boxBottom) {
          boxBottom = data[j].low;
        }
        consolidationDays++;
        boxEndIndex = j;

        if (consolidationDays >= 1 && data[j].close < boxBottom * 0.95) {
          // Breakdown 5% below - box complete
          break;
        }
      }

      // Only add box if we have any consolidation (1+ days)
      if (consolidationDays >= 1) {
        boxes.push({
          startTime: data[i].time,
          endTime: data[boxEndIndex].time,
          top: boxTop,
          bottom: boxBottom,
        });
        i = boxEndIndex + 1;
      } else {
        i++;
      }
    } else {
      i++;
    }
  }

  // 如果沒有找到箱型，創建一個基於最近資料的簡單箱型
  if (boxes.length === 0 && data.length >= 10) {
    const recentData = data.slice(-10);
    const recentHigh = Math.max(...recentData.map(d => d.high));
    const recentLow = Math.min(...recentData.map(d => d.low));

    boxes.push({
      startTime: recentData[0].time,
      endTime: recentData[recentData.length - 1].time,
      top: recentHigh,
      bottom: recentLow,
    });
  }

  return boxes;
}

export function PriceChart({ data, height = 400, period = '1y', fixedSma50, fixedSma200 }: PriceChartProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const [showSMA50, setShowSMA50] = useState(true);
  const [showSMA200, setShowSMA200] = useState(true);
  const [showVolume, setShowVolume] = useState(true);
  const [showDarvasBox, setShowDarvasBox] = useState(false);

  // 判斷是否為日內資料
  const isIntraday = period === '1d' || period === '5d';

  // 判斷是否可以顯示箱型理論（需要 >= 3個月的資料）
  const canShowDarvasBox = ['3mo', '6mo', '1y', '5y'].includes(period);

  // 使用固定的 SMA 值（從 props 傳入，基於 1Y 資料計算）
  const sma50Value = fixedSma50 ?? null;
  const sma200Value = fixedSma200 ?? null;

  // Darvas Box 數值會直接顯示在圖表上，不需要在這裡計算

  // 縮放功能
  const handleZoomIn = () => {
    if (chartRef.current) {
      const timeScale = chartRef.current.timeScale();
      const currentRange = timeScale.getVisibleLogicalRange();
      if (currentRange) {
        const center = (currentRange.from + currentRange.to) / 2;
        const newRange = (currentRange.to - currentRange.from) * 0.7;
        timeScale.setVisibleLogicalRange({
          from: center - newRange / 2,
          to: center + newRange / 2,
        });
      }
    }
  };

  const handleZoomOut = () => {
    if (chartRef.current) {
      const timeScale = chartRef.current.timeScale();
      const currentRange = timeScale.getVisibleLogicalRange();
      if (currentRange) {
        const center = (currentRange.from + currentRange.to) / 2;
        const newRange = (currentRange.to - currentRange.from) * 1.4;
        timeScale.setVisibleLogicalRange({
          from: center - newRange / 2,
          to: center + newRange / 2,
        });
      }
    }
  };

  const handleResetZoom = () => {
    if (chartRef.current) {
      chartRef.current.timeScale().fitContent();
    }
  };

  const [tooltipData, setTooltipData] = useState<{
    x: number;
    y: number;
    high: number;
    low: number;
    open: number;
    close: number;
    volume: number;
    date: string;
    visible: boolean;
    barTop: number;
    barBottom: number;
  }>({
    x: 0,
    y: 0,
    high: 0,
    low: 0,
    open: 0,
    close: 0,
    volume: 0,
    date: '',
    visible: false,
    barTop: 0,
    barBottom: 0,
  });

  useEffect(() => {
    if (!chartContainerRef.current || data.length === 0) return;

    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: '#1f2937' },
        textColor: '#9ca3af',
      },
      grid: {
        vertLines: { color: '#374151' },
        horzLines: { color: '#374151' },
      },
      width: chartContainerRef.current.clientWidth,
      height,
      crosshair: {
        mode: 1,
      },
      rightPriceScale: {
        borderColor: '#374151',
        autoScale: true, // 自動縮放 Y 軸
        scaleMargins: {
          top: 0.1,    // 上方留 10% 空間
          bottom: 0.2, // 下方留 20% 空間（給成交量）
        },
      },
      timeScale: {
        borderColor: '#374151',
        timeVisible: isIntraday, // 日內資料顯示時間，其他只顯示日期
        secondsVisible: false,
        visible: true,
        tickMarkFormatter: isIntraday
          ? (time: number) => {
              const date = new Date(time * 1000);
              return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
            }
          : undefined,
      },
      // 啟用拖曳和縮放功能
      handleScroll: {
        mouseWheel: true,      // 滑鼠滾輪縮放
        pressedMouseMove: true, // 按住滑鼠拖曳移動
        horzTouchDrag: true,   // 觸控水平拖曳
        vertTouchDrag: true,   // 觸控垂直拖曳
      },
      handleScale: {
        axisPressedMouseMove: true,  // 按住軸線拖曳縮放
        mouseWheel: true,            // 滑鼠滾輪縮放
        pinch: true,                 // 觸控捏合縮放
      },
      kineticScroll: {
        mouse: true,   // 滑鼠慣性滾動
        touch: true,   // 觸控慣性滾動
      },
    });

    chartRef.current = chart;

    // Candlestick series
    const candlestickSeries = chart.addCandlestickSeries({
      upColor: '#22c55e',
      downColor: '#ef4444',
      borderDownColor: '#ef4444',
      borderUpColor: '#22c55e',
      wickDownColor: '#ef4444',
      wickUpColor: '#22c55e',
      priceLineVisible: false, // 移除價格線（紅色虛線）
    });

    // 根據是否為日內資料格式化時間
    const formattedData = data.map((d) => ({
      time: d.time as Time, // 日內為 Unix timestamp，其他為日期字串
      open: d.open,
      high: d.high,
      low: d.low,
      close: d.close,
    }));

    candlestickSeries.setData(formattedData);

    // 50-day SMA (Orange) - 只在非日內資料時顯示
    if (showSMA50 && data.length >= 50 && !isIntraday) {
      const sma50Series = chart.addLineSeries({
        color: '#f97316',
        lineWidth: 2,
        title: 'SMA 50',
      });
      const sma50Data = calculateSMA(data, 50);
      sma50Series.setData(sma50Data);
    }

    // 200-day SMA (Purple) - 只在非日內資料時顯示
    if (showSMA200 && data.length >= 200 && !isIntraday) {
      const sma200Series = chart.addLineSeries({
        color: '#a855f7',
        lineWidth: 2,
        title: 'SMA 200',
      });
      const sma200Data = calculateSMA(data, 200);
      sma200Series.setData(sma200Data);
    }

    // Darvas Box - 使用更明顯的樣式 - 只在 >= 3個月時顯示
    if (showDarvasBox && canShowDarvasBox) {
      const boxes = calculateDarvasBoxes(data);

      // 顯示所有箱型
      boxes.forEach((box, index) => {
        const boxLabel = `箱${index + 1}`;

        // 箱頂線
        const boxTopSeries = chart.addLineSeries({
          color: '#00ffff',
          lineWidth: 3,
          lineStyle: 0,
          lastValueVisible: false,
          priceLineVisible: false,
          crosshairMarkerVisible: false,
        });

        boxTopSeries.setData([
          { time: box.startTime as Time, value: box.top },
          { time: box.endTime as Time, value: box.top },
        ]);

        // 在箱頂線上添加標記顯示數值
        boxTopSeries.setMarkers([
          {
            time: box.endTime as Time,
            position: 'aboveBar',
            color: '#00ffff',
            shape: 'arrowDown',
            text: `${boxLabel} 頂: $${box.top.toFixed(2)}`,
            size: 1,
          },
        ]);

        // 箱底線
        const boxBottomSeries = chart.addLineSeries({
          color: '#00ffff',
          lineWidth: 3,
          lineStyle: 0,
          lastValueVisible: false,
          priceLineVisible: false,
          crosshairMarkerVisible: false,
        });

        boxBottomSeries.setData([
          { time: box.startTime as Time, value: box.bottom },
          { time: box.endTime as Time, value: box.bottom },
        ]);

        // 在箱底線上添加標記顯示數值
        boxBottomSeries.setMarkers([
          {
            time: box.endTime as Time,
            position: 'belowBar',
            color: '#00ffff',
            shape: 'arrowUp',
            text: `${boxLabel} 底: $${box.bottom.toFixed(2)}`,
            size: 1,
          },
        ]);
      });

    }

    // Volume series
    if (showVolume) {
      const volumeSeries = chart.addHistogramSeries({
        color: '#3b82f6',
        priceFormat: {
          type: 'volume',
        },
        priceScaleId: 'volume',
      });

      volumeSeries.priceScale().applyOptions({
        scaleMargins: {
          top: 0.8,
          bottom: 0,
        },
      });

      const volumeData = data
        .filter((d) => d.volume !== undefined)
        .map((d) => ({
          time: d.time as Time,
          value: d.volume!,
          color: d.close >= d.open ? '#22c55e80' : '#ef444480',
        }));

      volumeSeries.setData(volumeData);
    }

    // 重置並自適應軸線
    chart.priceScale('right').applyOptions({
      autoScale: true,
    });

    chart.timeScale().fitContent();

    // 設定時間軸選項，留出空間顯示標籤
    chart.timeScale().applyOptions({
      rightOffset: 15, // 右邊留更多空間給箱型標籤
      barSpacing: isIntraday ? 4 : 6, // 日內資料間距小一點
      minBarSpacing: 2, // 最小 bar 間距
      fixLeftEdge: false, // 允許左邊有空間
      fixRightEdge: false, // 允許右邊有空間
    });

    // 確保時間軸完全顯示所有資料
    chart.timeScale().scrollToRealTime();

    // 訂閱滑鼠移動事件，顯示價格提示
    chart.subscribeCrosshairMove((param) => {
      if (!param.point || !param.time || !chartContainerRef.current) {
        setTooltipData((prev) => ({ ...prev, visible: false }));
        return;
      }

      // 獲取 K 線數據
      type OHLCData = { open: number; high: number; low: number; close: number };
      let ohlcData: OHLCData | null = null;

      param.seriesData.forEach((value) => {
        if (value && typeof value === 'object' && 'close' in value && 'high' in value) {
          ohlcData = value as OHLCData;
        }
      });

      if (ohlcData !== null) {
        const ohlc = ohlcData as OHLCData;
        // 計算價格對應的 Y 座標
        const highY = candlestickSeries.priceToCoordinate(ohlc.high);
        const lowY = candlestickSeries.priceToCoordinate(ohlc.low);

        // 格式化日期（中文格式）
        let formattedDate: string;
        if (isIntraday) {
          // Unix timestamp - 日內資料顯示時間
          const dateObj = new Date((param.time as number) * 1000);
          formattedDate = `${dateObj.getFullYear()}年${dateObj.getMonth() + 1}月${dateObj.getDate()}日 ${dateObj.getHours().toString().padStart(2, '0')}:${dateObj.getMinutes().toString().padStart(2, '0')}`;
        } else {
          const dateObj = new Date(param.time as string);
          formattedDate = `${dateObj.getFullYear()}年${dateObj.getMonth() + 1}月${dateObj.getDate()}日`;
        }

        // 找到對應的成交量
        const dataPoint = data.find(d => d.time === param.time);
        const volume = dataPoint?.volume || 0;

        setTooltipData({
          x: param.point.x,
          y: param.point.y,
          high: ohlc.high,
          low: ohlc.low,
          open: ohlc.open,
          close: ohlc.close,
          volume: volume,
          date: formattedDate,
          visible: true,
          barTop: highY || 0,
          barBottom: lowY || 0,
        });
      } else {
        setTooltipData((prev) => ({ ...prev, visible: false }));
      }
    });

    // Handle resize
    const handleResize = () => {
      if (chartContainerRef.current) {
        chart.applyOptions({ width: chartContainerRef.current.clientWidth });
      }
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      chart.remove();
    };
  }, [data, height, showSMA50, showSMA200, showVolume, showDarvasBox, isIntraday, period, canShowDarvasBox]);

  if (data.length === 0) {
    return (
      <div
        className="flex items-center justify-center bg-gray-800 rounded-lg"
        style={{ height }}
      >
        <p className="text-gray-400">無圖表數據</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Toggle buttons 和 SMA 數值 */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-2">
          {/* SMA 按鈕（固定使用 1 年資料） */}
          <button
            onClick={() => setShowSMA50(!showSMA50)}
            className={`px-3 py-1 text-sm rounded-full border transition-colors ${
              showSMA50
                ? 'bg-orange-500/20 border-orange-500 text-orange-400'
                : 'bg-gray-700/50 border-gray-600 text-gray-400 hover:border-gray-500'
            }`}
          >
            <span className="inline-block w-2 h-2 rounded-full bg-orange-500 mr-2" />
            50日均線
          </button>
          <button
            onClick={() => setShowSMA200(!showSMA200)}
            className={`px-3 py-1 text-sm rounded-full border transition-colors ${
              showSMA200
                ? 'bg-purple-500/20 border-purple-500 text-purple-400'
                : 'bg-gray-700/50 border-gray-600 text-gray-400 hover:border-gray-500'
            }`}
          >
            <span className="inline-block w-2 h-2 rounded-full bg-purple-500 mr-2" />
            200日均線
          </button>
          <button
            onClick={() => setShowVolume(!showVolume)}
            className={`px-3 py-1 text-sm rounded-full border transition-colors ${
              showVolume
                ? 'bg-blue-500/20 border-blue-500 text-blue-400'
                : 'bg-gray-700/50 border-gray-600 text-gray-400 hover:border-gray-500'
            }`}
          >
            <span className="inline-block w-2 h-2 rounded-full bg-blue-500 mr-2" />
            成交量
          </button>
          {/* 箱型理論只在 >= 3個月時顯示 */}
          {canShowDarvasBox && (
            <button
              onClick={() => setShowDarvasBox(!showDarvasBox)}
              className={`px-3 py-1 text-sm rounded-full border transition-colors ${
                showDarvasBox
                  ? 'bg-cyan-500/20 border-cyan-500 text-cyan-400'
                  : 'bg-gray-700/50 border-gray-600 text-gray-400 hover:border-gray-500'
              }`}
            >
              <span className="inline-block w-2 h-2 rounded-full bg-cyan-500 mr-2" />
              箱型理論
            </button>
          )}
        </div>

        {/* 指標數值顯示（右上角） */}
        <div className="flex flex-wrap gap-4 text-sm">
          {/* SMA 數值 - 固定使用 1 年資料計算 */}
          {showSMA50 && sma50Value && (
            <div className="flex items-center gap-1">
              <span className="text-orange-400">50日均線:</span>
              <span className="text-white font-medium">${sma50Value.toFixed(2)}</span>
            </div>
          )}
          {showSMA200 && sma200Value && (
            <div className="flex items-center gap-1">
              <span className="text-purple-400">200日均線:</span>
              <span className="text-white font-medium">${sma200Value.toFixed(2)}</span>
            </div>
          )}
          {/* 箱型理論提示 - 數值已顯示在圖表上 */}
          {showDarvasBox && !canShowDarvasBox && (
            <span className="text-cyan-400 text-xs">（箱型理論需選擇3個月以上時間區間）</span>
          )}
        </div>
      </div>

      {/* 圖表上方數據面板 - 即時顯示滑鼠位置的K線數據 */}
      <div className={`min-h-[36px] mb-2 flex items-center ${tooltipData.visible ? 'opacity-100' : 'opacity-50'}`}>
        <div className="bg-gray-900/90 rounded-lg px-4 py-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm border border-gray-700">
          <span className="text-white font-semibold">{tooltipData.visible ? tooltipData.date : '移動滑鼠查看K線數據'}</span>
          {tooltipData.visible && (
            <>
              <span className="border-l border-gray-600 pl-4">
                <span className="text-gray-400">開</span>{' '}
                <span className="text-white font-medium">${tooltipData.open.toFixed(2)}</span>
              </span>
              <span>
                <span className="text-gray-400">高</span>{' '}
                <span className="text-green-400 font-medium">${tooltipData.high.toFixed(2)}</span>
              </span>
              <span>
                <span className="text-gray-400">低</span>{' '}
                <span className="text-red-400 font-medium">${tooltipData.low.toFixed(2)}</span>
              </span>
              <span>
                <span className="text-gray-400">收</span>{' '}
                <span className={`font-medium ${tooltipData.close >= tooltipData.open ? 'text-green-400' : 'text-red-400'}`}>
                  ${tooltipData.close.toFixed(2)}
                </span>
              </span>
              <span>
                <span className="text-gray-400">漲跌</span>{' '}
                <span className={`font-medium ${tooltipData.close >= tooltipData.open ? 'text-green-400' : 'text-red-400'}`}>
                  {tooltipData.close >= tooltipData.open ? '+' : ''}{((tooltipData.close - tooltipData.open) / tooltipData.open * 100).toFixed(2)}%
                </span>
              </span>
              <span className="border-l border-gray-600 pl-4">
                <span className="text-gray-400">量</span>{' '}
                <span className="text-blue-400 font-medium">
                  {tooltipData.volume >= 1e6
                    ? `${(tooltipData.volume / 1e6).toFixed(2)}M`
                    : tooltipData.volume >= 1e3
                      ? `${(tooltipData.volume / 1e3).toFixed(1)}K`
                      : tooltipData.volume.toLocaleString()}
                </span>
              </span>
            </>
          )}
        </div>
      </div>

      {/* Chart */}
      <div className="relative">
        <div
          ref={chartContainerRef}
          className="rounded-lg overflow-hidden"
          style={{ height }}
        />

        {/* 浮動即時價格提示 - 跟隨滑鼠 */}
        {tooltipData.visible && (
          <div
            className="absolute pointer-events-none z-10 bg-gray-900/95 border border-cyan-500 rounded px-2 py-1 text-xs shadow-lg"
            style={{
              left: Math.min(tooltipData.x + 15, (chartContainerRef.current?.clientWidth || 300) - 120),
              top: Math.max(tooltipData.y - 60, 10),
            }}
          >
            <div className={`font-bold ${tooltipData.close >= tooltipData.open ? 'text-green-400' : 'text-red-400'}`}>
              ${tooltipData.close.toFixed(2)}
            </div>
            <div className={`text-xs ${tooltipData.close >= tooltipData.open ? 'text-green-400' : 'text-red-400'}`}>
              {tooltipData.close >= tooltipData.open ? '▲' : '▼'} {((tooltipData.close - tooltipData.open) / tooltipData.open * 100).toFixed(2)}%
            </div>
          </div>
        )}

        {/* 縮放按鈕 */}
        <div className="absolute top-2 right-2 flex flex-col gap-1 bg-gray-900/80 rounded-lg p-1">
          <button
            onClick={handleZoomIn}
            className="w-8 h-8 flex items-center justify-center bg-gray-700 hover:bg-gray-600 rounded text-white transition-colors"
            title="放大"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          </button>
          <button
            onClick={handleZoomOut}
            className="w-8 h-8 flex items-center justify-center bg-gray-700 hover:bg-gray-600 rounded text-white transition-colors"
            title="縮小"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
            </svg>
          </button>
          <button
            onClick={handleResetZoom}
            className="w-8 h-8 flex items-center justify-center bg-gray-700 hover:bg-gray-600 rounded text-white transition-colors"
            title="重置縮放"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5v-4m0 4h-4m4 0l-5-5" />
            </svg>
          </button>
        </div>
      </div>

      {/* 圖例 */}
      <div className="flex flex-wrap gap-4 text-xs text-gray-400">
        <div className="flex items-center gap-1">
          <span className="inline-block w-3 h-3 bg-green-500 rounded-sm" />
          <span>上漲</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="inline-block w-3 h-3 bg-red-500 rounded-sm" />
          <span>下跌</span>
        </div>
        {showSMA50 && (
          <div className="flex items-center gap-1">
            <span className="inline-block w-3 h-0.5 bg-orange-500" />
            <span>50日均線（1年資料）</span>
          </div>
        )}
        {showSMA200 && (
          <div className="flex items-center gap-1">
            <span className="inline-block w-3 h-0.5 bg-purple-500" />
            <span>200日均線（1年資料）</span>
          </div>
        )}
        {showDarvasBox && canShowDarvasBox && (
          <div className="flex items-center gap-1">
            <span className="inline-block w-3 h-0.5" style={{ backgroundColor: '#00ffff' }} />
            <span>箱型理論</span>
          </div>
        )}
      </div>

      {/* Darvas Box explanation */}
      {showDarvasBox && canShowDarvasBox && (
        <div className="bg-cyan-900/20 border border-cyan-800/50 rounded-lg p-3 text-xs">
          <p className="text-cyan-400 font-medium mb-1">箱型理論 (Darvas Box)</p>
          <p className="text-gray-400">
            當股價創新高後進入盤整，形成一個價格區間（箱型）。
            突破箱頂為買入訊號，跌破箱底為賣出訊號。
          </p>
        </div>
      )}
    </div>
  );
}
