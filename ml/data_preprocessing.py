"""
Data preprocessing module for stock prediction models.
Handles feature engineering, normalization, and sequence creation.
"""

import numpy as np
import pandas as pd
from sklearn.preprocessing import MinMaxScaler
import ta
from typing import Tuple, Dict, Any
import yfinance as yf


def fetch_stock_data(symbol: str, period: str = "2y") -> pd.DataFrame:
    """Fetch historical stock data from Yahoo Finance."""
    ticker = yf.Ticker(symbol)
    df = ticker.history(period=period)
    df.reset_index(inplace=True)
    return df


def add_technical_indicators(df: pd.DataFrame) -> pd.DataFrame:
    """Add technical indicators to the dataframe."""
    df = df.copy()

    # RSI
    df['RSI'] = ta.momentum.RSIIndicator(df['Close'], window=14).rsi()

    # MACD
    macd = ta.trend.MACD(df['Close'])
    df['MACD'] = macd.macd()
    df['MACD_Signal'] = macd.macd_signal()
    df['MACD_Hist'] = macd.macd_diff()

    # Bollinger Bands
    bollinger = ta.volatility.BollingerBands(df['Close'], window=20)
    df['BB_Upper'] = bollinger.bollinger_hband()
    df['BB_Middle'] = bollinger.bollinger_mavg()
    df['BB_Lower'] = bollinger.bollinger_lband()
    df['BB_Width'] = (df['BB_Upper'] - df['BB_Lower']) / df['BB_Middle']

    # Moving Averages
    df['SMA_20'] = ta.trend.SMAIndicator(df['Close'], window=20).sma_indicator()
    df['SMA_50'] = ta.trend.SMAIndicator(df['Close'], window=50).sma_indicator()
    df['SMA_200'] = ta.trend.SMAIndicator(df['Close'], window=200).sma_indicator()
    df['EMA_12'] = ta.trend.EMAIndicator(df['Close'], window=12).ema_indicator()
    df['EMA_26'] = ta.trend.EMAIndicator(df['Close'], window=26).ema_indicator()

    # Additional features
    df['Daily_Return'] = df['Close'].pct_change()
    df['Volatility'] = df['Daily_Return'].rolling(window=20).std()
    df['Volume_SMA'] = df['Volume'].rolling(window=20).mean()
    df['Volume_Ratio'] = df['Volume'] / df['Volume_SMA']

    # Price momentum
    df['Momentum_5'] = df['Close'] / df['Close'].shift(5) - 1
    df['Momentum_10'] = df['Close'] / df['Close'].shift(10) - 1
    df['Momentum_20'] = df['Close'] / df['Close'].shift(20) - 1

    # Price position relative to MAs
    df['Price_SMA20_Ratio'] = df['Close'] / df['SMA_20']
    df['Price_SMA50_Ratio'] = df['Close'] / df['SMA_50']

    return df


def prepare_features(df: pd.DataFrame) -> Tuple[np.ndarray, list]:
    """Prepare feature matrix from dataframe."""
    feature_columns = [
        'Open', 'High', 'Low', 'Close', 'Volume',
        'RSI', 'MACD', 'MACD_Signal', 'MACD_Hist',
        'BB_Upper', 'BB_Middle', 'BB_Lower', 'BB_Width',
        'SMA_20', 'SMA_50', 'EMA_12', 'EMA_26',
        'Daily_Return', 'Volatility', 'Volume_Ratio',
        'Momentum_5', 'Momentum_10', 'Momentum_20',
        'Price_SMA20_Ratio', 'Price_SMA50_Ratio'
    ]

    # Filter columns that exist
    available_columns = [col for col in feature_columns if col in df.columns]

    # Drop rows with NaN values
    df_clean = df[available_columns].dropna()

    return df_clean.values, available_columns


def create_sequences(
    data: np.ndarray,
    sequence_length: int = 60,
    prediction_horizon: int = 1
) -> Tuple[np.ndarray, np.ndarray]:
    """
    Create sequences for LSTM training.

    Args:
        data: Feature matrix
        sequence_length: Number of time steps in each sequence
        prediction_horizon: Number of days to predict ahead

    Returns:
        X: Input sequences
        y: Target values (closing price)
    """
    X, y = [], []

    for i in range(sequence_length, len(data) - prediction_horizon + 1):
        X.append(data[i - sequence_length:i])
        # Target is the closing price (index 3) at prediction_horizon days ahead
        y.append(data[i + prediction_horizon - 1, 3])

    return np.array(X), np.array(y)


def prepare_xgboost_features(
    data: np.ndarray,
    feature_names: list,
    lookback: int = 5
) -> Tuple[np.ndarray, np.ndarray, list]:
    """
    Prepare features for XGBoost model.
    Flattens recent history into a single feature vector.

    Args:
        data: Feature matrix
        feature_names: List of feature names
        lookback: Number of days to look back

    Returns:
        X: Feature matrix for XGBoost
        y: Target values
        new_feature_names: Names of the flattened features
    """
    X, y = [], []
    new_feature_names = []

    # Create feature names for flattened data
    for day in range(lookback):
        for name in feature_names:
            new_feature_names.append(f"{name}_t-{lookback-day}")

    for i in range(lookback, len(data) - 1):
        # Flatten the lookback window
        features = data[i - lookback:i].flatten()
        X.append(features)
        # Target is next day's close
        y.append(data[i, 3])  # Index 3 is Close

    return np.array(X), np.array(y), new_feature_names


class DataPipeline:
    """Complete data preprocessing pipeline."""

    def __init__(self):
        self.price_scaler = MinMaxScaler()
        self.feature_scaler = MinMaxScaler()
        self.feature_columns = None

    def fit_transform(
        self,
        df: pd.DataFrame,
        sequence_length: int = 60
    ) -> Dict[str, Any]:
        """
        Fit scalers and transform data for both models.

        Returns dict with LSTM and XGBoost ready data.
        """
        # Add technical indicators
        df = add_technical_indicators(df)

        # Prepare features
        features, self.feature_columns = prepare_features(df)

        # Scale features
        features_scaled = self.feature_scaler.fit_transform(features)

        # Create LSTM sequences
        X_lstm, y_lstm = create_sequences(features_scaled, sequence_length)

        # Inverse scale y for actual price values
        y_lstm_prices = self.inverse_scale_price(y_lstm)

        # Create XGBoost features
        X_xgb, y_xgb, xgb_feature_names = prepare_xgboost_features(
            features_scaled, self.feature_columns
        )
        y_xgb_prices = self.inverse_scale_price(y_xgb)

        return {
            'lstm': {
                'X': X_lstm,
                'y': y_lstm,
                'y_prices': y_lstm_prices
            },
            'xgboost': {
                'X': X_xgb,
                'y': y_xgb,
                'y_prices': y_xgb_prices,
                'feature_names': xgb_feature_names
            },
            'scalers': {
                'feature_scaler': self.feature_scaler,
                'feature_columns': self.feature_columns
            }
        }

    def inverse_scale_price(self, scaled_prices: np.ndarray) -> np.ndarray:
        """Inverse scale the price values."""
        # Create a dummy array with same shape as original features
        dummy = np.zeros((len(scaled_prices), len(self.feature_columns)))
        dummy[:, 3] = scaled_prices  # Close price is at index 3

        # Inverse transform
        inversed = self.feature_scaler.inverse_transform(dummy)
        return inversed[:, 3]

    def transform(self, df: pd.DataFrame, sequence_length: int = 60) -> Dict[str, Any]:
        """Transform new data using fitted scalers."""
        df = add_technical_indicators(df)
        features, _ = prepare_features(df)
        features_scaled = self.feature_scaler.transform(features)

        X_lstm, _ = create_sequences(features_scaled, sequence_length)
        X_xgb, _, _ = prepare_xgboost_features(
            features_scaled, self.feature_columns
        )

        return {
            'lstm': {'X': X_lstm},
            'xgboost': {'X': X_xgb}
        }


if __name__ == "__main__":
    # Test the pipeline
    print("Testing data preprocessing pipeline...")

    df = fetch_stock_data("AAPL", period="2y")
    print(f"Fetched {len(df)} rows of data")

    pipeline = DataPipeline()
    data = pipeline.fit_transform(df)

    print(f"LSTM X shape: {data['lstm']['X'].shape}")
    print(f"LSTM y shape: {data['lstm']['y'].shape}")
    print(f"XGBoost X shape: {data['xgboost']['X'].shape}")
    print(f"XGBoost y shape: {data['xgboost']['y'].shape}")
    print(f"Feature columns: {len(data['scalers']['feature_columns'])}")
