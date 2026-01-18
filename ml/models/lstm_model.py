"""
LSTM model for stock price prediction.
"""

import numpy as np
import tensorflow as tf
from tensorflow import keras
from tensorflow.keras import layers, Model
from typing import Tuple, Optional
import os


def create_lstm_model(
    sequence_length: int,
    n_features: int,
    lstm_units: list = [128, 64],
    dropout_rate: float = 0.2,
    learning_rate: float = 0.001
) -> Model:
    """
    Create an LSTM model for stock prediction.

    Args:
        sequence_length: Number of time steps in input sequence
        n_features: Number of features per time step
        lstm_units: List of units for each LSTM layer
        dropout_rate: Dropout rate for regularization
        learning_rate: Learning rate for optimizer

    Returns:
        Compiled Keras model
    """
    inputs = keras.Input(shape=(sequence_length, n_features))

    x = inputs

    # LSTM layers
    for i, units in enumerate(lstm_units):
        return_sequences = i < len(lstm_units) - 1
        x = layers.LSTM(
            units,
            return_sequences=return_sequences,
            kernel_regularizer=keras.regularizers.l2(0.01)
        )(x)
        x = layers.Dropout(dropout_rate)(x)

    # Dense layers
    x = layers.Dense(32, activation='relu')(x)
    x = layers.Dropout(dropout_rate)(x)

    # Output layer - predict normalized price
    outputs = layers.Dense(1)(x)

    model = Model(inputs=inputs, outputs=outputs)

    model.compile(
        optimizer=keras.optimizers.Adam(learning_rate=learning_rate),
        loss='mse',
        metrics=['mae']
    )

    return model


def create_bidirectional_lstm_model(
    sequence_length: int,
    n_features: int,
    lstm_units: int = 64,
    dropout_rate: float = 0.2,
    learning_rate: float = 0.001
) -> Model:
    """
    Create a Bidirectional LSTM model for potentially better pattern recognition.
    """
    inputs = keras.Input(shape=(sequence_length, n_features))

    x = layers.Bidirectional(
        layers.LSTM(lstm_units, return_sequences=True)
    )(inputs)
    x = layers.Dropout(dropout_rate)(x)

    x = layers.Bidirectional(
        layers.LSTM(lstm_units // 2, return_sequences=False)
    )(x)
    x = layers.Dropout(dropout_rate)(x)

    x = layers.Dense(32, activation='relu')(x)
    x = layers.Dropout(dropout_rate / 2)(x)

    outputs = layers.Dense(1)(x)

    model = Model(inputs=inputs, outputs=outputs)

    model.compile(
        optimizer=keras.optimizers.Adam(learning_rate=learning_rate),
        loss='mse',
        metrics=['mae']
    )

    return model


class LSTMPredictor:
    """LSTM-based stock predictor with training and prediction capabilities."""

    def __init__(
        self,
        sequence_length: int = 60,
        lstm_units: list = [128, 64],
        dropout_rate: float = 0.2,
        learning_rate: float = 0.001,
        bidirectional: bool = False
    ):
        self.sequence_length = sequence_length
        self.lstm_units = lstm_units
        self.dropout_rate = dropout_rate
        self.learning_rate = learning_rate
        self.bidirectional = bidirectional
        self.model: Optional[Model] = None
        self.history = None

    def build(self, n_features: int):
        """Build the model architecture."""
        if self.bidirectional:
            self.model = create_bidirectional_lstm_model(
                self.sequence_length,
                n_features,
                self.lstm_units[0] if self.lstm_units else 64,
                self.dropout_rate,
                self.learning_rate
            )
        else:
            self.model = create_lstm_model(
                self.sequence_length,
                n_features,
                self.lstm_units,
                self.dropout_rate,
                self.learning_rate
            )

    def train(
        self,
        X_train: np.ndarray,
        y_train: np.ndarray,
        X_val: Optional[np.ndarray] = None,
        y_val: Optional[np.ndarray] = None,
        epochs: int = 100,
        batch_size: int = 32,
        early_stopping_patience: int = 10,
        verbose: int = 1
    ) -> keras.callbacks.History:
        """Train the LSTM model."""
        if self.model is None:
            self.build(X_train.shape[2])

        callbacks = [
            keras.callbacks.EarlyStopping(
                monitor='val_loss' if X_val is not None else 'loss',
                patience=early_stopping_patience,
                restore_best_weights=True
            ),
            keras.callbacks.ReduceLROnPlateau(
                monitor='val_loss' if X_val is not None else 'loss',
                factor=0.5,
                patience=5,
                min_lr=1e-6
            )
        ]

        validation_data = (X_val, y_val) if X_val is not None else None

        self.history = self.model.fit(
            X_train, y_train,
            epochs=epochs,
            batch_size=batch_size,
            validation_data=validation_data,
            callbacks=callbacks,
            verbose=verbose
        )

        return self.history

    def predict(self, X: np.ndarray) -> np.ndarray:
        """Make predictions."""
        if self.model is None:
            raise ValueError("Model not trained. Call train() first.")
        return self.model.predict(X, verbose=0).flatten()

    def save(self, filepath: str):
        """Save model to file."""
        if self.model is None:
            raise ValueError("No model to save.")
        self.model.save(filepath)

    def load(self, filepath: str):
        """Load model from file."""
        self.model = keras.models.load_model(filepath)

    def save_for_tfjs(self, output_dir: str):
        """Save model in TensorFlow.js format."""
        if self.model is None:
            raise ValueError("No model to save.")

        import tensorflowjs as tfjs
        os.makedirs(output_dir, exist_ok=True)
        tfjs.converters.save_keras_model(self.model, output_dir)
        print(f"Model saved for TensorFlow.js at {output_dir}")


if __name__ == "__main__":
    # Test model creation
    print("Testing LSTM model creation...")

    model = create_lstm_model(
        sequence_length=60,
        n_features=25
    )
    model.summary()

    # Test with dummy data
    X_dummy = np.random.randn(100, 60, 25)
    y_dummy = np.random.randn(100)

    predictor = LSTMPredictor()
    predictor.build(25)
    print("\nModel built successfully!")
