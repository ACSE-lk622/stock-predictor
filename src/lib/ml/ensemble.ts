/**
 * Ensemble utilities for combining multiple model predictions.
 * This module provides functions for weighted averaging and confidence calculation.
 */

export interface EnsemblePrediction {
  prediction: number;
  confidence: number;
  weights: {
    lstm: number;
    xgboost: number;
  };
  individual: {
    lstm: number;
    xgboost: number;
  };
}

export interface EnsembleWeights {
  lstm: number;
  xgboost: number;
}

/**
 * Calculate optimal ensemble weights based on historical performance
 */
export function calculateOptimalWeights(
  lstmErrors: number[],
  xgboostErrors: number[]
): EnsembleWeights {
  const lstmMAE = lstmErrors.reduce((a, b) => a + Math.abs(b), 0) / lstmErrors.length;
  const xgbMAE = xgboostErrors.reduce((a, b) => a + Math.abs(b), 0) / xgboostErrors.length;

  const totalError = lstmMAE + xgbMAE;

  if (totalError === 0) {
    return { lstm: 0.5, xgboost: 0.5 };
  }

  // Weight inversely proportional to error
  return {
    lstm: xgbMAE / totalError,
    xgboost: lstmMAE / totalError,
  };
}

/**
 * Combine predictions using weighted average
 */
export function combineWeightedPredictions(
  lstmPrediction: number,
  xgboostPrediction: number,
  weights: EnsembleWeights
): number {
  return weights.lstm * lstmPrediction + weights.xgboost * xgboostPrediction;
}

/**
 * Calculate prediction confidence based on model agreement
 */
export function calculatePredictionConfidence(
  lstmPrediction: number,
  xgboostPrediction: number,
  currentPrice: number,
  volatility?: number
): number {
  const avgPrediction = (lstmPrediction + xgboostPrediction) / 2;

  // Measure relative difference between predictions
  const predictionDiff = Math.abs(lstmPrediction - xgboostPrediction);
  const relativeDiff = avgPrediction !== 0 ? predictionDiff / avgPrediction : 0;

  // Agreement score: 100% when identical, decreases with divergence
  let agreementScore = Math.max(0, 1 - relativeDiff * 5);

  // Direction agreement bonus/penalty
  const lstmDirection = lstmPrediction > currentPrice ? 'up' : 'down';
  const xgbDirection = xgboostPrediction > currentPrice ? 'up' : 'down';

  if (lstmDirection === xgbDirection) {
    agreementScore += 0.1;
  } else {
    agreementScore -= 0.2;
  }

  // Volatility adjustment
  if (volatility !== undefined && volatility > 0) {
    const predictedChange = Math.abs(avgPrediction - currentPrice);
    const expectedRange = volatility * currentPrice * 2;

    // Penalize predictions outside normal range
    if (predictedChange > expectedRange) {
      agreementScore *= 0.8;
    }
  }

  // Convert to percentage and clamp
  return Math.max(0, Math.min(100, agreementScore * 100));
}

/**
 * Determine prediction direction with confidence threshold
 */
export function getPredictionDirection(
  predictedPrice: number,
  currentPrice: number,
  neutralThreshold: number = 0.005
): 'up' | 'down' | 'neutral' {
  const changePercent = (predictedPrice - currentPrice) / currentPrice;

  if (Math.abs(changePercent) < neutralThreshold) {
    return 'neutral';
  }

  return changePercent > 0 ? 'up' : 'down';
}

/**
 * Full ensemble prediction with all metrics
 */
export function createEnsemblePrediction(
  lstmPrediction: number,
  xgboostPrediction: number,
  currentPrice: number,
  weights: EnsembleWeights = { lstm: 0.6, xgboost: 0.4 },
  volatility?: number
): EnsemblePrediction {
  const prediction = combineWeightedPredictions(
    lstmPrediction,
    xgboostPrediction,
    weights
  );

  const confidence = calculatePredictionConfidence(
    lstmPrediction,
    xgboostPrediction,
    currentPrice,
    volatility
  );

  return {
    prediction,
    confidence,
    weights,
    individual: {
      lstm: lstmPrediction,
      xgboost: xgboostPrediction,
    },
  };
}

/**
 * Backtesting utility to evaluate ensemble performance
 */
export function backtestEnsemble(
  lstmPredictions: number[],
  xgboostPredictions: number[],
  actualPrices: number[],
  weights: EnsembleWeights
): {
  directionAccuracy: number;
  mae: number;
  rmse: number;
  mape: number;
} {
  let correctDirection = 0;
  let totalAbsError = 0;
  let totalSquaredError = 0;
  let totalPercentError = 0;

  for (let i = 1; i < actualPrices.length; i++) {
    const previousPrice = actualPrices[i - 1];
    const actualPrice = actualPrices[i];

    const ensemblePred = combineWeightedPredictions(
      lstmPredictions[i],
      xgboostPredictions[i],
      weights
    );

    // Direction accuracy
    const actualDirection = actualPrice > previousPrice ? 'up' : 'down';
    const predictedDirection = ensemblePred > previousPrice ? 'up' : 'down';

    if (actualDirection === predictedDirection) {
      correctDirection++;
    }

    // Error metrics
    const error = Math.abs(ensemblePred - actualPrice);
    totalAbsError += error;
    totalSquaredError += error * error;
    totalPercentError += actualPrice !== 0 ? error / actualPrice : 0;
  }

  const n = actualPrices.length - 1;

  return {
    directionAccuracy: (correctDirection / n) * 100,
    mae: totalAbsError / n,
    rmse: Math.sqrt(totalSquaredError / n),
    mape: (totalPercentError / n) * 100,
  };
}
