import * as tf from '@tensorflow/tfjs';
import type { HistoricalDataPoint, PredictionResult } from '@/types/stock';
import { modelLoader, type LoadedModel, type EnsembleConfig } from './model-loader';
import { processDataForPrediction } from './preprocessing';

interface PredictionOptions {
  useEnsemble?: boolean;
  lstmWeight?: number;
}

class StockPredictor {
  async predict(
    symbol: string,
    historicalData: HistoricalDataPoint[],
    options: PredictionOptions = {}
  ): Promise<PredictionResult | null> {
    const { useEnsemble = true, lstmWeight } = options;

    // Load models
    const models = await modelLoader.loadModels(symbol);

    if (!models.lstmModel || !models.scalerParams) {
      console.error(`Models not available for ${symbol}`);
      return null;
    }

    const sequenceLength = models.modelConfig?.sequenceLength || 60;

    // Process data
    const processed = processDataForPrediction(
      historicalData,
      models.scalerParams,
      sequenceLength
    );

    if (processed.sequences.length === 0) {
      console.error('Not enough data to create sequences');
      return null;
    }

    // Get the latest sequence for prediction
    const latestSequence = processed.sequences[processed.sequences.length - 1];
    const currentPrice = historicalData[historicalData.length - 1].close;

    // LSTM prediction
    const lstmPrediction = await this.predictLSTM(
      models.lstmModel,
      latestSequence,
      models.scalerParams
    );

    // For XGBoost, we use LSTM prediction as a fallback since
    // XGBoost requires a different runtime (not available in browser)
    // In production, you'd call an API endpoint for XGBoost
    const xgboostPrediction = await this.predictXGBoostFallback(
      processed.flattenedForXgb[processed.flattenedForXgb.length - 1],
      lstmPrediction,
      currentPrice
    );

    // Ensemble prediction
    const ensembleConfig = models.ensembleConfig || {
      lstm_weight: lstmWeight || 0.6,
      xgboost_weight: 1 - (lstmWeight || 0.6),
      neutral_threshold: 0.005,
      lstm_bias_correction: 0,
      xgboost_bias_correction: 0,
    };

    const finalPrediction = useEnsemble
      ? this.ensemblePrediction(
          lstmPrediction,
          xgboostPrediction,
          currentPrice,
          ensembleConfig
        )
      : lstmPrediction;

    // Calculate metrics
    const priceChange = finalPrediction - currentPrice;
    const priceChangePercent = (priceChange / currentPrice) * 100;

    // Determine direction
    let direction: 'up' | 'down' | 'neutral';
    if (Math.abs(priceChangePercent) < ensembleConfig.neutral_threshold * 100) {
      direction = 'neutral';
    } else if (priceChange > 0) {
      direction = 'up';
    } else {
      direction = 'down';
    }

    // Calculate confidence
    const confidence = this.calculateConfidence(
      lstmPrediction,
      xgboostPrediction,
      currentPrice
    );

    return {
      symbol: symbol.toUpperCase(),
      predictedPrice: Math.round(finalPrediction * 100) / 100,
      currentPrice: Math.round(currentPrice * 100) / 100,
      priceChange: Math.round(priceChange * 100) / 100,
      priceChangePercent: Math.round(priceChangePercent * 100) / 100,
      direction,
      confidence: Math.round(confidence),
      predictions: {
        lstm: Math.round(lstmPrediction * 100) / 100,
        xgboost: Math.round(xgboostPrediction * 100) / 100,
      },
      generatedAt: new Date(),
      targetDate: this.getNextTradingDay(),
    };
  }

  private async predictLSTM(
    model: tf.LayersModel,
    sequence: number[][],
    scalerParams: { data_range_: number[]; data_min_: number[] }
  ): Promise<number> {
    // Create tensor from sequence
    const inputTensor = tf.tensor3d([sequence]);

    try {
      // Run prediction
      const prediction = model.predict(inputTensor) as tf.Tensor;
      const scaledPrediction = (await prediction.data())[0];

      // Inverse scale to get actual price (simplified version)
      const priceIndex = 3;
      const range = scalerParams.data_range_[priceIndex];
      const min = scalerParams.data_min_[priceIndex];
      const actualPrice = scaledPrediction * range + min;

      return actualPrice;
    } finally {
      inputTensor.dispose();
    }
  }

  private async predictXGBoostFallback(
    features: number[],
    lstmPrediction: number,
    currentPrice: number
  ): Promise<number> {
    // Since XGBoost isn't available in browser, we use a simplified
    // heuristic based on features. In production, this would be an API call.
    // This provides a slightly different prediction for ensemble diversity.

    // Use momentum and trend features to adjust
    const momentum5 = features[features.length - 5] || 0;
    const momentum10 = features[features.length - 4] || 0;
    const rsi = features[5] || 50;

    // Simple adjustment based on momentum
    let adjustment = 0;
    if (momentum5 > 0 && momentum10 > 0) {
      adjustment = currentPrice * 0.005; // Bullish momentum
    } else if (momentum5 < 0 && momentum10 < 0) {
      adjustment = -currentPrice * 0.005; // Bearish momentum
    }

    // RSI adjustment
    if (rsi > 70) {
      adjustment -= currentPrice * 0.003; // Overbought
    } else if (rsi < 30) {
      adjustment += currentPrice * 0.003; // Oversold
    }

    // Blend with LSTM prediction
    return lstmPrediction * 0.9 + (currentPrice + adjustment) * 0.1;
  }

  private ensemblePrediction(
    lstmPred: number,
    xgbPred: number,
    currentPrice: number,
    config: EnsembleConfig
  ): number {
    const correctedLstm = lstmPred + config.lstm_bias_correction;
    const correctedXgb = xgbPred + config.xgboost_bias_correction;

    return config.lstm_weight * correctedLstm + config.xgboost_weight * correctedXgb;
  }

  private calculateConfidence(
    lstmPred: number,
    xgbPred: number,
    currentPrice: number
  ): number {
    // Model agreement
    const avgPrediction = (lstmPred + xgbPred) / 2;
    const predictionDiff = Math.abs(lstmPred - xgbPred);
    const relativeDiff = predictionDiff / avgPrediction;

    // Agreement score (0-1)
    const agreementScore = Math.max(0, 1 - relativeDiff * 10);

    // Direction agreement bonus
    const lstmDirection = Math.sign(lstmPred - currentPrice);
    const xgbDirection = Math.sign(xgbPred - currentPrice);
    const directionBonus = lstmDirection === xgbDirection ? 0.1 : -0.1;

    // Final confidence (0-100)
    const confidence = (agreementScore + directionBonus) * 100;

    return Math.max(0, Math.min(100, confidence));
  }

  private getNextTradingDay(): Date {
    const now = new Date();
    const day = now.getDay();

    // Skip to next trading day
    let daysToAdd = 1;
    if (day === 5) daysToAdd = 3; // Friday -> Monday
    if (day === 6) daysToAdd = 2; // Saturday -> Monday

    const nextDay = new Date(now);
    nextDay.setDate(nextDay.getDate() + daysToAdd);
    nextDay.setHours(16, 0, 0, 0); // Market close time

    return nextDay;
  }

  async isModelAvailable(symbol: string): Promise<boolean> {
    const availableModels = await modelLoader.getAvailableModels();
    return availableModels.includes(symbol.toUpperCase());
  }

  async getAvailableSymbols(): Promise<string[]> {
    return modelLoader.getAvailableModels();
  }
}

export const stockPredictor = new StockPredictor();
