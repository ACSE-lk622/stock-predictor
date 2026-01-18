import * as tf from '@tensorflow/tfjs';

interface ModelConfig {
  symbol: string;
  sequenceLength: number;
  featureColumns: string[];
  trainedAt: string;
  metrics: {
    direction_accuracy: number;
    mae: number;
    rmse: number;
    mape: number;
  };
}

interface ScalerParams {
  min_: number[];
  scale_: number[];
  data_min_: number[];
  data_max_: number[];
  data_range_: number[];
}

interface EnsembleConfig {
  lstm_weight: number;
  xgboost_weight: number;
  neutral_threshold: number;
  lstm_bias_correction: number;
  xgboost_bias_correction: number;
}

interface LoadedModel {
  lstmModel: tf.LayersModel | null;
  scalerParams: ScalerParams | null;
  ensembleConfig: EnsembleConfig | null;
  modelConfig: ModelConfig | null;
}

class ModelLoader {
  private modelCache: Map<string, LoadedModel> = new Map();
  private loadingPromises: Map<string, Promise<LoadedModel>> = new Map();

  async loadModels(symbol: string): Promise<LoadedModel> {
    const upperSymbol = symbol.toUpperCase();
    const lowerSymbol = symbol.toLowerCase();

    // Return cached model if available
    if (this.modelCache.has(upperSymbol)) {
      return this.modelCache.get(upperSymbol)!;
    }

    // Return existing loading promise if in progress
    if (this.loadingPromises.has(upperSymbol)) {
      return this.loadingPromises.get(upperSymbol)!;
    }

    // Start loading
    const loadPromise = this.loadModelsInternal(lowerSymbol);
    this.loadingPromises.set(upperSymbol, loadPromise);

    try {
      const result = await loadPromise;
      this.modelCache.set(upperSymbol, result);
      return result;
    } finally {
      this.loadingPromises.delete(upperSymbol);
    }
  }

  private async loadModelsInternal(symbol: string): Promise<LoadedModel> {
    const basePath = `/models/${symbol}`;

    const result: LoadedModel = {
      lstmModel: null,
      scalerParams: null,
      ensembleConfig: null,
      modelConfig: null,
    };

    // Load all components in parallel
    const [lstmModel, scalerParams, ensembleConfig, modelConfig] =
      await Promise.allSettled([
        this.loadLSTMModel(`${basePath}/lstm/model.json`),
        this.loadJSON<ScalerParams>(`${basePath}/scaler_params.json`),
        this.loadJSON<EnsembleConfig>(`${basePath}/ensemble_config.json`),
        this.loadJSON<ModelConfig>(`${basePath}/preprocessing_config.json`),
      ]);

    if (lstmModel.status === 'fulfilled') {
      result.lstmModel = lstmModel.value;
    } else {
      console.warn(`Failed to load LSTM model for ${symbol}:`, lstmModel.reason);
    }

    if (scalerParams.status === 'fulfilled') {
      result.scalerParams = scalerParams.value;
    } else {
      console.warn(`Failed to load scaler for ${symbol}:`, scalerParams.reason);
    }

    if (ensembleConfig.status === 'fulfilled') {
      result.ensembleConfig = ensembleConfig.value;
    } else {
      console.warn(`Failed to load ensemble config for ${symbol}:`, ensembleConfig.reason);
    }

    if (modelConfig.status === 'fulfilled') {
      result.modelConfig = modelConfig.value;
    } else {
      console.warn(`Failed to load model config for ${symbol}:`, modelConfig.reason);
    }

    return result;
  }

  private async loadLSTMModel(modelPath: string): Promise<tf.LayersModel> {
    return await tf.loadLayersModel(modelPath);
  }

  private async loadJSON<T>(path: string): Promise<T> {
    const response = await fetch(path);
    if (!response.ok) {
      throw new Error(`Failed to fetch ${path}: ${response.status}`);
    }
    return response.json();
  }

  async getAvailableModels(): Promise<string[]> {
    try {
      const response = await fetch('/models/models_index.json');
      if (!response.ok) {
        return [];
      }
      const index = await response.json();
      return index.map((m: { symbol: string }) => m.symbol);
    } catch {
      return [];
    }
  }

  isModelLoaded(symbol: string): boolean {
    return this.modelCache.has(symbol.toUpperCase());
  }

  clearCache(symbol?: string): void {
    if (symbol) {
      const upper = symbol.toUpperCase();
      const model = this.modelCache.get(upper);
      if (model?.lstmModel) {
        model.lstmModel.dispose();
      }
      this.modelCache.delete(upper);
    } else {
      this.modelCache.forEach((model) => {
        if (model.lstmModel) {
          model.lstmModel.dispose();
        }
      });
      this.modelCache.clear();
    }
  }
}

export const modelLoader = new ModelLoader();
export type { LoadedModel, ModelConfig, ScalerParams, EnsembleConfig };
