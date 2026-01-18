export interface ValidationResult {
  valid: boolean;
  error?: string;
}

export function validateSymbol(symbol: unknown): ValidationResult {
  if (!symbol || typeof symbol !== 'string') {
    return { valid: false, error: 'Symbol is required' };
  }

  const cleanSymbol = symbol.trim().toUpperCase();

  if (cleanSymbol.length === 0) {
    return { valid: false, error: 'Symbol cannot be empty' };
  }

  if (cleanSymbol.length > 10) {
    return { valid: false, error: 'Symbol too long' };
  }

  // Basic symbol validation (alphanumeric with optional dots and dashes)
  if (!/^[A-Z0-9.-]+$/.test(cleanSymbol)) {
    return { valid: false, error: 'Invalid symbol format' };
  }

  return { valid: true };
}

export function validatePeriod(period: unknown): ValidationResult {
  const validPeriods = ['1d', '5d', '1mo', '3mo', '6mo', '1y', '2y', '5y'];

  if (!period || typeof period !== 'string') {
    return { valid: true }; // Use default
  }

  if (!validPeriods.includes(period)) {
    return {
      valid: false,
      error: `Invalid period. Must be one of: ${validPeriods.join(', ')}`,
    };
  }

  return { valid: true };
}

export function validateSearchQuery(query: unknown): ValidationResult {
  if (!query || typeof query !== 'string') {
    return { valid: false, error: 'Search query is required' };
  }

  const cleanQuery = query.trim();

  if (cleanQuery.length === 0) {
    return { valid: false, error: 'Search query cannot be empty' };
  }

  if (cleanQuery.length > 100) {
    return { valid: false, error: 'Search query too long' };
  }

  return { valid: true };
}

export function sanitizeSymbol(symbol: string): string {
  return symbol.trim().toUpperCase();
}

export function sanitizePeriod(
  period: string | null
): '1d' | '5d' | '1mo' | '3mo' | '6mo' | '1y' | '2y' | '5y' {
  const validPeriods = ['1d', '5d', '1mo', '3mo', '6mo', '1y', '2y', '5y'] as const;

  if (period && validPeriods.includes(period as typeof validPeriods[number])) {
    return period as typeof validPeriods[number];
  }

  return '1y';
}
