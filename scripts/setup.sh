#!/bin/bash

echo "🚀 Stock Predictor Setup"
echo "========================"

# Check for Node.js
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed."
    echo ""
    echo "Please install Node.js first:"
    echo "  Option 1: brew install node"
    echo "  Option 2: https://nodejs.org/en/download/"
    exit 1
fi

echo "✅ Node.js $(node -v) found"

# Check for npm
if ! command -v npm &> /dev/null; then
    echo "❌ npm is not installed."
    exit 1
fi

echo "✅ npm $(npm -v) found"

# Install Node.js dependencies
echo ""
echo "📦 Installing Node.js dependencies..."
npm install

# Check for Python (optional)
echo ""
if command -v python3 &> /dev/null; then
    echo "✅ Python $(python3 --version) found"
    echo ""
    read -p "Do you want to set up the ML environment? (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo "📦 Setting up Python ML environment..."
        cd ml
        python3 -m venv venv
        source venv/bin/activate
        pip install -r requirements.txt
        cd ..
        echo "✅ ML environment ready"
    fi
else
    echo "⚠️  Python not found. ML training features will be unavailable."
    echo "   Install Python 3.10+ to train custom models."
fi

# Create .env.local if not exists
if [ ! -f .env.local ]; then
    echo ""
    echo "📝 Creating .env.local from template..."
    cp .env.example .env.local
    echo "   Edit .env.local to add your Alpha Vantage API key"
fi

echo ""
echo "✅ Setup complete!"
echo ""
echo "To start the development server:"
echo "  npm run dev"
echo ""
echo "Then open http://localhost:3000"
