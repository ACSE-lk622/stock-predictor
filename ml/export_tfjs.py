"""
Export trained models to TensorFlow.js format.
"""

import os
import sys
import argparse
import json
import shutil
import tensorflow as tf
import tensorflowjs as tfjs
import joblib


def export_lstm_to_tfjs(model_path: str, output_dir: str):
    """
    Export a Keras LSTM model to TensorFlow.js format.

    Args:
        model_path: Path to the saved Keras model (.keras or SavedModel)
        output_dir: Directory to save the TensorFlow.js model
    """
    print(f"Loading model from {model_path}...")
    model = tf.keras.models.load_model(model_path)

    print(f"Model summary:")
    model.summary()

    print(f"\nExporting to {output_dir}...")
    os.makedirs(output_dir, exist_ok=True)

    tfjs.converters.save_keras_model(model, output_dir)

    print(f"Export complete!")

    # List exported files
    print("\nExported files:")
    for f in os.listdir(output_dir):
        size = os.path.getsize(os.path.join(output_dir, f))
        print(f"  {f}: {size / 1024:.1f} KB")


def prepare_models_for_deployment(trained_dir: str, public_dir: str):
    """
    Prepare all trained models for web deployment.
    Copies necessary files to the public/models directory.

    Args:
        trained_dir: Directory containing trained models
        public_dir: Target public directory for the web app
    """
    print(f"\nPreparing models for deployment...")
    print(f"Source: {trained_dir}")
    print(f"Target: {public_dir}")

    os.makedirs(public_dir, exist_ok=True)

    # Find all trained model directories
    for symbol_dir in os.listdir(trained_dir):
        symbol_path = os.path.join(trained_dir, symbol_dir)
        if not os.path.isdir(symbol_path):
            continue

        print(f"\nProcessing {symbol_dir}...")

        target_symbol_dir = os.path.join(public_dir, symbol_dir)
        os.makedirs(target_symbol_dir, exist_ok=True)

        # Copy LSTM TensorFlow.js model
        lstm_tfjs_dir = os.path.join(symbol_path, 'lstm_tfjs')
        if os.path.exists(lstm_tfjs_dir):
            target_lstm = os.path.join(target_symbol_dir, 'lstm')
            if os.path.exists(target_lstm):
                shutil.rmtree(target_lstm)
            shutil.copytree(lstm_tfjs_dir, target_lstm)
            print(f"  Copied LSTM model")

        # Copy XGBoost JS export
        xgb_js_dir = os.path.join(symbol_path, 'xgboost_js')
        if os.path.exists(xgb_js_dir):
            target_xgb = os.path.join(target_symbol_dir, 'xgboost')
            if os.path.exists(target_xgb):
                shutil.rmtree(target_xgb)
            shutil.copytree(xgb_js_dir, target_xgb)
            print(f"  Copied XGBoost config")

        # Copy ensemble config
        ensemble_config = os.path.join(symbol_path, 'ensemble_config.json')
        if os.path.exists(ensemble_config):
            shutil.copy(ensemble_config, target_symbol_dir)
            print(f"  Copied ensemble config")

        # Copy preprocessing config
        preprocessing_config = os.path.join(symbol_path, 'preprocessing_config.json')
        if os.path.exists(preprocessing_config):
            shutil.copy(preprocessing_config, target_symbol_dir)
            print(f"  Copied preprocessing config")

        # Export scaler parameters as JSON for JS
        scaler_path = os.path.join(symbol_path, 'feature_scaler.joblib')
        if os.path.exists(scaler_path):
            scaler = joblib.load(scaler_path)
            scaler_params = {
                'min_': scaler.min_.tolist(),
                'scale_': scaler.scale_.tolist(),
                'data_min_': scaler.data_min_.tolist(),
                'data_max_': scaler.data_max_.tolist(),
                'data_range_': scaler.data_range_.tolist(),
            }
            scaler_json_path = os.path.join(target_symbol_dir, 'scaler_params.json')
            with open(scaler_json_path, 'w') as f:
                json.dump(scaler_params, f)
            print(f"  Exported scaler parameters")

    # Create models index
    models_index = []
    for symbol_dir in os.listdir(public_dir):
        symbol_path = os.path.join(public_dir, symbol_dir)
        if os.path.isdir(symbol_path):
            config_path = os.path.join(symbol_path, 'preprocessing_config.json')
            if os.path.exists(config_path):
                with open(config_path) as f:
                    config = json.load(f)
                models_index.append({
                    'symbol': config.get('symbol', symbol_dir.upper()),
                    'trained_at': config.get('trained_at'),
                    'metrics': config.get('metrics', {})
                })

    index_path = os.path.join(public_dir, 'models_index.json')
    with open(index_path, 'w') as f:
        json.dump(models_index, f, indent=2)

    print(f"\nCreated models index with {len(models_index)} models")
    print(f"Deployment preparation complete!")


def main():
    parser = argparse.ArgumentParser(description='Export models for TensorFlow.js')
    parser.add_argument('--model', type=str, help='Path to Keras model to export')
    parser.add_argument('--output', type=str, help='Output directory for TF.js model')
    parser.add_argument('--prepare-deployment', action='store_true',
                        help='Prepare all models for web deployment')
    parser.add_argument('--trained-dir', type=str, default='trained_models',
                        help='Directory with trained models')
    parser.add_argument('--public-dir', type=str, default='../public/models',
                        help='Public directory for web app')

    args = parser.parse_args()

    if args.prepare_deployment:
        prepare_models_for_deployment(args.trained_dir, args.public_dir)
    elif args.model and args.output:
        export_lstm_to_tfjs(args.model, args.output)
    else:
        parser.print_help()


if __name__ == "__main__":
    main()
