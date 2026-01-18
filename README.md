# Stock Predictor

AI-powered stock market prediction application using ensemble machine learning (LSTM + XGBoost) with a Next.js frontend.

## Features

- **Ensemble Predictions**: Combines LSTM deep learning and XGBoost gradient boosting for robust predictions
- **Multiple Data Sources**: Aggregates data from Yahoo Finance and Alpha Vantage
- **Technical Analysis**: RSI, MACD, Bollinger Bands, Moving Averages, and more
- **Real-time Dashboard**: Interactive charts with TradingView's Lightweight Charts
- **Watchlist**: Track your favorite stocks
- **Confidence Scores**: Model agreement-based confidence metrics

## Tech Stack

### Frontend
- Next.js 14 (App Router)
- TypeScript
- TailwindCSS
- TanStack Query
- Zustand (state management)
- Lightweight Charts (TradingView)
- Recharts

### ML/Backend
- Python 3.10+
- TensorFlow/Keras (LSTM)
- XGBoost
- scikit-learn
- TensorFlow.js (browser inference)

## Quick Start

### Prerequisites
- Node.js 18+
- Python 3.10+ (for ML training)

### Installation

1. **Install dependencies**
   ```bash
   cd stock-predictor
   npm install
   ```

2. **Set up environment variables** (optional)
   ```bash
   cp .env.example .env.local
   # Add your Alpha Vantage API key
   ```

3. **Run the development server**
   ```bash
   npm run dev
   ```

4. **Open the app**
   Visit [http://localhost:3000](http://localhost:3000)

## ML Model Training

### Setup Python Environment

```bash
cd ml
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
```

### Train Models

```bash
# Train models for a single stock
python train.py --symbol AAPL --epochs 100

# Train models for multiple stocks
python train.py --symbols AAPL MSFT GOOGL AMZN --epochs 100
```

### Export for Web

```bash
# Export trained models to TensorFlow.js format
python export_tfjs.py --prepare-deployment --trained-dir trained_models --public-dir ../public/models
```

## Project Structure

```
stock-predictor/
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── api/               # API routes
│   │   │   ├── stocks/[symbol]/
│   │   │   ├── predict/
│   │   │   └── search/
│   │   ├── dashboard/         # Dashboard page
│   │   └── page.tsx           # Home page
│   ├── components/
│   │   ├── charts/            # Price and prediction charts
│   │   ├── predictions/       # Prediction cards and indicators
│   │   ├── search/            # Stock search
│   │   └── layout/            # Header and sidebar
│   ├── lib/
│   │   ├── data-sources/      # Yahoo Finance & Alpha Vantage
│   │   ├── ml/                # TensorFlow.js integration
│   │   └── api/               # Validation utilities
│   ├── stores/                # Zustand state management
│   └── types/                 # TypeScript interfaces
├── ml/
│   ├── models/                # Python model definitions
│   │   ├── lstm_model.py
│   │   ├── xgboost_model.py
│   │   └── ensemble.py
│   ├── data_preprocessing.py  # Feature engineering
│   ├── train.py               # Training script
│   └── export_tfjs.py         # Export to TensorFlow.js
├── public/
│   └── models/                # Pre-trained models for browser
└── package.json
```

## API Endpoints

### GET /api/stocks/[symbol]
Fetch stock quote and historical data.

Query params:
- `period`: 1mo, 3mo, 6mo, 1y, 2y, 5y (default: 1y)
- `indicators`: true/false (include technical indicators)

### POST /api/predict
Generate price prediction.

Body:
```json
{
  "symbol": "AAPL",
  "useEnsemble": true
}
```

### GET /api/search
Search for stocks.

Query params:
- `q`: Search query

## Model Architecture

### LSTM Model
- 2 LSTM layers (128, 64 units)
- Dropout regularization (0.2)
- Dense output layer
- Trained on 60-day sequences

### XGBoost Model
- Gradient boosting regressor
- 5-day lookback flattened features
- 100 estimators, max depth 6

### Ensemble
- Weighted average (60% LSTM, 40% XGBoost by default)
- Weights calibrated based on validation performance
- Confidence score from model agreement

## Disclaimer

This application is for **educational and research purposes only**. Stock market predictions are inherently uncertain and should not be considered financial advice. Past performance does not guarantee future results. Always do your own research and consult with a qualified financial advisor before making investment decisions.

## License

MIT
