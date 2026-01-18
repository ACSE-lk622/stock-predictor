"""
Main training script for stock prediction models.
"""

import os
import sys
import argparse
import numpy as np
from sklearn.model_selection import train_test_split
import json
from datetime import datetime

from data_preprocessing import DataPipeline, fetch_stock_data
from models.lstm_model import LSTMPredictor
from models.xgboost_model import XGBoostPredictor
from models.ensemble import EnsemblePredictor, backtest_ensemble


def train_models(
    symbol: str = "AAPL",
    period: str = "2y",
    sequence_length: int = 60,
    test_size: float = 0.2,
    lstm_epochs: int = 100,
    output_dir: str = "trained_models"
):
    """
    Train both LSTM and XGBoost models for a given stock.

    Args:
        symbol: Stock symbol to train on
        period: Historical data period
        sequence_length: Sequence length for LSTM
        test_size: Fraction of data for testing
        lstm_epochs: Number of training epochs for LSTM
        output_dir: Directory to save trained models
    """
    print(f"\n{'='*60}")
    print(f"Training models for {symbol}")
    print(f"{'='*60}")

    # Create output directory
    model_dir = os.path.join(output_dir, symbol.lower())
    os.makedirs(model_dir, exist_ok=True)

    # Fetch and preprocess data
    print("\n[1/5] Fetching and preprocessing data...")
    df = fetch_stock_data(symbol, period)
    print(f"  Fetched {len(df)} data points")

    pipeline = DataPipeline()
    data = pipeline.fit_transform(df, sequence_length)

    # Split data
    print("\n[2/5] Splitting data...")
    X_lstm = data['lstm']['X']
    y_lstm = data['lstm']['y']
    X_xgb = data['xgboost']['X']
    y_xgb = data['xgboost']['y']

    # Use same test indices for both models
    n_test = int(len(X_lstm) * test_size)

    X_lstm_train, X_lstm_test = X_lstm[:-n_test], X_lstm[-n_test:]
    y_lstm_train, y_lstm_test = y_lstm[:-n_test], y_lstm[-n_test:]

    X_xgb_train, X_xgb_test = X_xgb[:-n_test], X_xgb[-n_test:]
    y_xgb_train, y_xgb_test = y_xgb[:-n_test], y_xgb[-n_test:]

    print(f"  Training samples: {len(X_lstm_train)}")
    print(f"  Test samples: {len(X_lstm_test)}")

    # Train LSTM
    print("\n[3/5] Training LSTM model...")
    lstm = LSTMPredictor(sequence_length=sequence_length)
    lstm.train(
        X_lstm_train, y_lstm_train,
        X_lstm_test, y_lstm_test,
        epochs=lstm_epochs,
        batch_size=32
    )

    lstm_predictions = lstm.predict(X_lstm_test)
    lstm_mae = np.mean(np.abs(lstm_predictions - y_lstm_test))
    print(f"  LSTM Test MAE (normalized): {lstm_mae:.6f}")

    # Train XGBoost
    print("\n[4/5] Training XGBoost model...")
    xgb = XGBoostPredictor()
    xgb.train(
        X_xgb_train, y_xgb_train,
        X_xgb_test, y_xgb_test,
        feature_names=data['xgboost']['feature_names']
    )

    xgb_predictions = xgb.predict(X_xgb_test)
    xgb_mae = np.mean(np.abs(xgb_predictions - y_xgb_test))
    print(f"  XGBoost Test MAE (normalized): {xgb_mae:.6f}")

    # Calibrate ensemble
    print("\n[5/5] Calibrating ensemble...")
    ensemble = EnsemblePredictor()

    # Backtest with actual prices
    y_lstm_test_prices = pipeline.inverse_scale_price(y_lstm_test)
    lstm_pred_prices = pipeline.inverse_scale_price(lstm_predictions)
    xgb_pred_prices = pipeline.inverse_scale_price(xgb_predictions)

    metrics = backtest_ensemble(
        lstm_pred_prices,
        xgb_pred_prices,
        y_lstm_test_prices,
        y_lstm_test_prices[0]
    )

    print(f"\n  Ensemble Backtest Metrics:")
    print(f"    Direction Accuracy: {metrics['direction_accuracy']:.2f}%")
    print(f"    MAE: ${metrics['mae']:.2f}")
    print(f"    RMSE: ${metrics['rmse']:.2f}")
    print(f"    MAPE: {metrics['mape']:.2f}%")

    # Calibrate with test predictions
    ensemble.calibrate(lstm_pred_prices, xgb_pred_prices, y_lstm_test_prices)

    # Save models
    print("\n[Saving models...]")

    # Save LSTM model
    lstm_path = os.path.join(model_dir, 'lstm_model')
    lstm.save(f"{lstm_path}.keras")
    lstm.save_for_tfjs(os.path.join(model_dir, 'lstm_tfjs'))

    # Save XGBoost model
    xgb_path = os.path.join(model_dir, 'xgboost_model.joblib')
    xgb.save(xgb_path)
    xgb.export_for_js(os.path.join(model_dir, 'xgboost_js'))

    # Save ensemble config
    ensemble_path = os.path.join(model_dir, 'ensemble_config.json')
    ensemble.save_config(ensemble_path)

    # Save scaler and preprocessing info
    import joblib
    scaler_path = os.path.join(model_dir, 'feature_scaler.joblib')
    joblib.dump(pipeline.feature_scaler, scaler_path)

    preprocessing_config = {
        'feature_columns': pipeline.feature_columns,
        'sequence_length': sequence_length,
        'symbol': symbol,
        'trained_at': datetime.now().isoformat(),
        'metrics': metrics
    }

    config_path = os.path.join(model_dir, 'preprocessing_config.json')
    with open(config_path, 'w') as f:
        json.dump(preprocessing_config, f, indent=2)

    print(f"\nModels saved to {model_dir}")
    print(f"{'='*60}")

    return {
        'lstm': lstm,
        'xgboost': xgb,
        'ensemble': ensemble,
        'pipeline': pipeline,
        'metrics': metrics
    }


def main():
    parser = argparse.ArgumentParser(description='Train stock prediction models')
    parser.add_argument('--symbol', type=str, default='AAPL', help='Stock symbol')
    parser.add_argument('--period', type=str, default='2y', help='Data period')
    parser.add_argument('--epochs', type=int, default=100, help='LSTM training epochs')
    parser.add_argument('--output', type=str, default='trained_models', help='Output directory')
    parser.add_argument('--symbols', type=str, nargs='+', help='Multiple symbols to train')

    args = parser.parse_args()

    symbols = args.symbols if args.symbols else [args.symbol]

    for symbol in symbols:
        try:
            train_models(
                symbol=symbol,
                period=args.period,
                lstm_epochs=args.epochs,
                output_dir=args.output
            )
        except Exception as e:
            print(f"Error training {symbol}: {e}")
            continue


if __name__ == "__main__":
    main()
