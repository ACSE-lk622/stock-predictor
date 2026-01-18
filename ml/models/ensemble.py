"""
Ensemble model combining LSTM and XGBoost predictions.
"""

import numpy as np
from typing import Dict, Tuple, Optional
from dataclasses import dataclass
import json
import os


@dataclass
class PredictionResult:
    """Result from ensemble prediction."""
    predicted_price: float
    direction: str  # 'up', 'down', 'neutral'
    confidence: float
    lstm_prediction: float
    xgboost_prediction: float
    current_price: float
    price_change: float
    price_change_percent: float


class EnsemblePredictor:
    """
    Ensemble predictor combining LSTM and XGBoost models.
    Uses weighted averaging and model agreement for confidence.
    """

    def __init__(
        self,
        lstm_weight: float = 0.6,
        xgboost_weight: float = 0.4,
        neutral_threshold: float = 0.005  # 0.5% change threshold
    ):
        self.lstm_weight = lstm_weight
        self.xgboost_weight = xgboost_weight
        self.neutral_threshold = neutral_threshold

        # Calibration based on backtesting
        self.lstm_bias_correction = 0.0
        self.xgboost_bias_correction = 0.0

    def predict(
        self,
        lstm_prediction: float,
        xgboost_prediction: float,
        current_price: float,
        historical_volatility: Optional[float] = None
    ) -> PredictionResult:
        """
        Combine predictions from both models.

        Args:
            lstm_prediction: Predicted price from LSTM model
            xgboost_prediction: Predicted price from XGBoost model
            current_price: Current stock price
            historical_volatility: Recent price volatility (optional)

        Returns:
            PredictionResult with ensemble prediction and confidence
        """
        # Apply bias corrections
        lstm_pred = lstm_prediction + self.lstm_bias_correction
        xgb_pred = xgboost_prediction + self.xgboost_bias_correction

        # Weighted ensemble prediction
        ensemble_prediction = (
            self.lstm_weight * lstm_pred +
            self.xgboost_weight * xgb_pred
        )

        # Calculate price change
        price_change = ensemble_prediction - current_price
        price_change_percent = (price_change / current_price) * 100

        # Determine direction
        if abs(price_change_percent) < self.neutral_threshold * 100:
            direction = 'neutral'
        elif price_change > 0:
            direction = 'up'
        else:
            direction = 'down'

        # Calculate confidence based on model agreement
        confidence = self._calculate_confidence(
            lstm_pred, xgb_pred, current_price, historical_volatility
        )

        return PredictionResult(
            predicted_price=round(ensemble_prediction, 2),
            direction=direction,
            confidence=round(confidence, 2),
            lstm_prediction=round(lstm_pred, 2),
            xgboost_prediction=round(xgb_pred, 2),
            current_price=round(current_price, 2),
            price_change=round(price_change, 2),
            price_change_percent=round(price_change_percent, 2)
        )

    def _calculate_confidence(
        self,
        lstm_pred: float,
        xgb_pred: float,
        current_price: float,
        volatility: Optional[float] = None
    ) -> float:
        """
        Calculate confidence score based on:
        1. Agreement between models
        2. Magnitude of predicted change relative to volatility
        """
        # Model agreement (how close are the predictions)
        prediction_diff = abs(lstm_pred - xgb_pred)
        avg_prediction = (lstm_pred + xgb_pred) / 2
        relative_diff = prediction_diff / avg_prediction if avg_prediction > 0 else 0

        # Agreement score: 100% when predictions match, decreases with divergence
        agreement_score = max(0, 1 - relative_diff * 10)

        # Direction agreement bonus
        lstm_direction = np.sign(lstm_pred - current_price)
        xgb_direction = np.sign(xgb_pred - current_price)
        direction_bonus = 0.1 if lstm_direction == xgb_direction else -0.1

        # Volatility adjustment
        volatility_factor = 1.0
        if volatility is not None and volatility > 0:
            predicted_change = abs(avg_prediction - current_price)
            # Higher confidence if prediction is within normal volatility range
            if predicted_change <= volatility * current_price * 2:
                volatility_factor = 1.0
            else:
                volatility_factor = 0.8

        # Final confidence calculation
        confidence = (agreement_score + direction_bonus) * volatility_factor

        # Clamp to 0-100 range
        return max(0, min(100, confidence * 100))

    def calibrate(
        self,
        lstm_predictions: np.ndarray,
        xgboost_predictions: np.ndarray,
        actual_prices: np.ndarray
    ):
        """
        Calibrate the ensemble based on historical performance.

        Args:
            lstm_predictions: Array of LSTM predictions
            xgboost_predictions: Array of XGBoost predictions
            actual_prices: Array of actual prices
        """
        # Calculate bias (mean error)
        self.lstm_bias_correction = np.mean(actual_prices - lstm_predictions)
        self.xgboost_bias_correction = np.mean(actual_prices - xgboost_predictions)

        # Optionally adjust weights based on historical accuracy
        lstm_mae = np.mean(np.abs(lstm_predictions - actual_prices))
        xgb_mae = np.mean(np.abs(xgboost_predictions - actual_prices))

        total_error = lstm_mae + xgb_mae
        if total_error > 0:
            # Weight inversely proportional to error
            self.lstm_weight = xgb_mae / total_error
            self.xgboost_weight = lstm_mae / total_error

        print(f"Calibrated weights - LSTM: {self.lstm_weight:.3f}, XGBoost: {self.xgboost_weight:.3f}")
        print(f"Bias corrections - LSTM: {self.lstm_bias_correction:.3f}, XGBoost: {self.xgboost_bias_correction:.3f}")

    def save_config(self, filepath: str):
        """Save ensemble configuration."""
        config = {
            'lstm_weight': self.lstm_weight,
            'xgboost_weight': self.xgboost_weight,
            'neutral_threshold': self.neutral_threshold,
            'lstm_bias_correction': self.lstm_bias_correction,
            'xgboost_bias_correction': self.xgboost_bias_correction
        }

        os.makedirs(os.path.dirname(filepath) or '.', exist_ok=True)
        with open(filepath, 'w') as f:
            json.dump(config, f, indent=2)

    def load_config(self, filepath: str):
        """Load ensemble configuration."""
        with open(filepath, 'r') as f:
            config = json.load(f)

        self.lstm_weight = config['lstm_weight']
        self.xgboost_weight = config['xgboost_weight']
        self.neutral_threshold = config['neutral_threshold']
        self.lstm_bias_correction = config.get('lstm_bias_correction', 0.0)
        self.xgboost_bias_correction = config.get('xgboost_bias_correction', 0.0)


def backtest_ensemble(
    lstm_predictions: np.ndarray,
    xgboost_predictions: np.ndarray,
    actual_prices: np.ndarray,
    initial_price: float,
    lstm_weight: float = 0.6
) -> Dict[str, float]:
    """
    Backtest the ensemble model.

    Returns metrics about prediction accuracy.
    """
    ensemble = EnsemblePredictor(lstm_weight=lstm_weight, xgboost_weight=1-lstm_weight)

    correct_direction = 0
    total_mae = 0
    total_mse = 0

    results = []

    for i in range(len(actual_prices)):
        current_price = actual_prices[i-1] if i > 0 else initial_price

        result = ensemble.predict(
            lstm_predictions[i],
            xgboost_predictions[i],
            current_price
        )

        actual_direction = 'up' if actual_prices[i] > current_price else 'down'
        if abs(actual_prices[i] - current_price) / current_price < 0.005:
            actual_direction = 'neutral'

        if result.direction == actual_direction:
            correct_direction += 1

        error = abs(result.predicted_price - actual_prices[i])
        total_mae += error
        total_mse += error ** 2

        results.append({
            'predicted': result.predicted_price,
            'actual': actual_prices[i],
            'error': error,
            'direction_correct': result.direction == actual_direction
        })

    n = len(actual_prices)

    return {
        'direction_accuracy': correct_direction / n * 100,
        'mae': total_mae / n,
        'rmse': np.sqrt(total_mse / n),
        'mape': total_mae / np.mean(actual_prices) * 100
    }


if __name__ == "__main__":
    # Test ensemble predictor
    print("Testing Ensemble Predictor...")

    ensemble = EnsemblePredictor()

    # Simulate predictions
    current_price = 150.0
    lstm_pred = 152.5
    xgb_pred = 151.8

    result = ensemble.predict(lstm_pred, xgb_pred, current_price, volatility=0.02)

    print(f"\nCurrent Price: ${current_price}")
    print(f"LSTM Prediction: ${lstm_pred}")
    print(f"XGBoost Prediction: ${xgb_pred}")
    print(f"\nEnsemble Result:")
    print(f"  Predicted Price: ${result.predicted_price}")
    print(f"  Direction: {result.direction}")
    print(f"  Confidence: {result.confidence}%")
    print(f"  Price Change: ${result.price_change} ({result.price_change_percent}%)")
