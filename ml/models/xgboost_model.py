"""
XGBoost model for stock price prediction.
"""

import numpy as np
import xgboost as xgb
from sklearn.model_selection import GridSearchCV
from typing import Optional, Dict, Any, Tuple
import joblib
import json
import os


class XGBoostPredictor:
    """XGBoost-based stock predictor."""

    def __init__(
        self,
        n_estimators: int = 100,
        max_depth: int = 6,
        learning_rate: float = 0.1,
        subsample: float = 0.8,
        colsample_bytree: float = 0.8,
        min_child_weight: int = 1,
        random_state: int = 42
    ):
        self.params = {
            'n_estimators': n_estimators,
            'max_depth': max_depth,
            'learning_rate': learning_rate,
            'subsample': subsample,
            'colsample_bytree': colsample_bytree,
            'min_child_weight': min_child_weight,
            'random_state': random_state,
            'objective': 'reg:squarederror',
            'tree_method': 'hist'
        }
        self.model: Optional[xgb.XGBRegressor] = None
        self.feature_names: Optional[list] = None
        self.feature_importance: Optional[Dict[str, float]] = None

    def train(
        self,
        X_train: np.ndarray,
        y_train: np.ndarray,
        X_val: Optional[np.ndarray] = None,
        y_val: Optional[np.ndarray] = None,
        feature_names: Optional[list] = None,
        early_stopping_rounds: int = 10,
        verbose: bool = True
    ) -> 'XGBoostPredictor':
        """Train the XGBoost model."""
        self.feature_names = feature_names

        self.model = xgb.XGBRegressor(**self.params)

        eval_set = [(X_train, y_train)]
        if X_val is not None and y_val is not None:
            eval_set.append((X_val, y_val))

        self.model.fit(
            X_train, y_train,
            eval_set=eval_set,
            verbose=verbose
        )

        # Store feature importance
        if self.feature_names:
            importance = self.model.feature_importances_
            self.feature_importance = dict(zip(self.feature_names, importance))

        return self

    def tune_hyperparameters(
        self,
        X_train: np.ndarray,
        y_train: np.ndarray,
        param_grid: Optional[Dict[str, list]] = None,
        cv: int = 5,
        verbose: int = 1
    ) -> Dict[str, Any]:
        """Tune hyperparameters using grid search."""
        if param_grid is None:
            param_grid = {
                'max_depth': [3, 5, 7],
                'learning_rate': [0.01, 0.1, 0.2],
                'n_estimators': [50, 100, 200],
                'subsample': [0.8, 0.9, 1.0]
            }

        base_model = xgb.XGBRegressor(
            objective='reg:squarederror',
            random_state=self.params['random_state']
        )

        grid_search = GridSearchCV(
            base_model,
            param_grid,
            cv=cv,
            scoring='neg_mean_squared_error',
            verbose=verbose,
            n_jobs=-1
        )

        grid_search.fit(X_train, y_train)

        # Update parameters with best found
        self.params.update(grid_search.best_params_)
        self.model = grid_search.best_estimator_

        return {
            'best_params': grid_search.best_params_,
            'best_score': -grid_search.best_score_,
            'cv_results': grid_search.cv_results_
        }

    def predict(self, X: np.ndarray) -> np.ndarray:
        """Make predictions."""
        if self.model is None:
            raise ValueError("Model not trained. Call train() first.")
        return self.model.predict(X)

    def get_feature_importance(self, top_n: int = 20) -> Dict[str, float]:
        """Get top N most important features."""
        if self.feature_importance is None:
            raise ValueError("No feature importance available.")

        sorted_features = sorted(
            self.feature_importance.items(),
            key=lambda x: x[1],
            reverse=True
        )
        return dict(sorted_features[:top_n])

    def save(self, filepath: str):
        """Save model to file."""
        if self.model is None:
            raise ValueError("No model to save.")

        # Save the model
        joblib.dump(self.model, filepath)

        # Save metadata
        metadata_path = filepath.replace('.joblib', '_metadata.json')
        metadata = {
            'params': self.params,
            'feature_names': self.feature_names,
            'feature_importance': self.feature_importance
        }
        with open(metadata_path, 'w') as f:
            json.dump(metadata, f, indent=2)

        print(f"Model saved to {filepath}")

    def load(self, filepath: str):
        """Load model from file."""
        self.model = joblib.load(filepath)

        # Load metadata
        metadata_path = filepath.replace('.joblib', '_metadata.json')
        if os.path.exists(metadata_path):
            with open(metadata_path, 'r') as f:
                metadata = json.load(f)
                self.params = metadata.get('params', self.params)
                self.feature_names = metadata.get('feature_names')
                self.feature_importance = metadata.get('feature_importance')

        print(f"Model loaded from {filepath}")

    def export_for_js(self, output_dir: str):
        """
        Export model parameters for JavaScript implementation.
        Note: XGBoost models need to be converted to a custom format
        or use ONNX for JavaScript inference.
        """
        if self.model is None:
            raise ValueError("No model to export.")

        os.makedirs(output_dir, exist_ok=True)

        # Save as JSON for potential JS parsing
        model_config = {
            'type': 'xgboost',
            'params': self.params,
            'feature_names': self.feature_names,
            'n_features': len(self.feature_names) if self.feature_names else None
        }

        config_path = os.path.join(output_dir, 'xgboost_config.json')
        with open(config_path, 'w') as f:
            json.dump(model_config, f, indent=2)

        # Save the booster as JSON (can be loaded by xgboost in various languages)
        booster_path = os.path.join(output_dir, 'xgboost_model.json')
        self.model.save_model(booster_path)

        print(f"XGBoost model exported to {output_dir}")


if __name__ == "__main__":
    # Test model creation and training
    print("Testing XGBoost model...")

    # Generate dummy data
    np.random.seed(42)
    X_dummy = np.random.randn(500, 125)  # 5 days * 25 features
    y_dummy = np.random.randn(500)

    feature_names = [f"feature_{i}" for i in range(125)]

    predictor = XGBoostPredictor()
    predictor.train(
        X_dummy[:400], y_dummy[:400],
        X_dummy[400:], y_dummy[400:],
        feature_names=feature_names
    )

    predictions = predictor.predict(X_dummy[400:])
    print(f"Predictions shape: {predictions.shape}")

    print("\nTop 10 important features:")
    for name, importance in predictor.get_feature_importance(10).items():
        print(f"  {name}: {importance:.4f}")
