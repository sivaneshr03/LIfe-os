/**
 * Authoritative Money & Currency Helpers (AGENTS.md Rules 7, 33, 34 compliant)
 *
 * Rules:
 * 1. Zero floating-point arithmetic for authoritative values.
 * 2. All monetary currency values are stored as integers representing minor units (USD cents: $12.34 -> 1234).
 * 3. Investment shares are stored as fixed-point integers scaled to 6 decimal places (1.5 -> 1500000).
 */

export const CURRENCY_EXPONENTS: Record<string, number> = {
  USD: 2,
  EUR: 2,
  GBP: 2,
  CAD: 2,
  AUD: 2,
  INR: 2,
  CHF: 2,
  CNY: 2,
  SGD: 2,
  HKD: 2,
  NZD: 2,
  SEK: 2,
  NOK: 2,
  DKK: 2,
  BRL: 2,
  MXN: 2,
  // 0 decimal currencies
  JPY: 0,
  KRW: 0,
  VND: 0,
  CLP: 0,
  HUF: 0,
  PYG: 0,
  UGX: 0,
  // 3 decimal currencies
  BHD: 3,
  KWD: 3,
  OMR: 3,
  JOD: 3,
  TND: 3,
};

export const SHARE_SCALE = 1_000_000; // 10^6 fixed-point scale for investment shares

export function getCurrencyExponent(currency: string): number {
  const code = currency.toUpperCase().trim();
  return CURRENCY_EXPONENTS[code] !== undefined ? CURRENCY_EXPONENTS[code] : 2;
}

export function getMinorUnitFactor(currency: string): number {
  const exponent = getCurrencyExponent(currency);
  return 10 ** exponent;
}

/**
 * Parses a currency string (e.g. "12.34", "$ -12.34", "1,250.00") into integer minor units
 * without any intermediate JavaScript floating-point conversions.
 */
export function parseMoney(input: string, currency: string = 'INR'): number {
  if (typeof input !== 'string') {
    throw new TypeError('Input must be a string');
  }

  const exponent = getCurrencyExponent(currency);
  let cleaned = input.trim();

  // Strip leading currency symbols or letters, spaces, commas
  cleaned = cleaned.replace(/^[^\d\-+]+/, '');
  // Extract sign
  let isNegative = false;
  if (cleaned.startsWith('-')) {
    isNegative = true;
    cleaned = cleaned.substring(1).trim();
  } else if (cleaned.startsWith('+')) {
    cleaned = cleaned.substring(1).trim();
  }

  // Strip non-digit characters except decimal point
  // Remove thousand-separator commas
  cleaned = cleaned.replace(/,/g, '').replace(/[^\d.]/g, '');

  if (!cleaned || cleaned === '.') {
    throw new Error(`Invalid money string: "${input}"`);
  }

  const parts = cleaned.split('.');
  if (parts.length > 2) {
    throw new Error(`Invalid money string with multiple decimal points: "${input}"`);
  }

  const wholeStr = parts[0] || '0';
  let fracStr = parts[1] || '';

  // Zero-decimal currency must not have a fraction
  if (exponent === 0) {
    if (fracStr && parseInt(fracStr, 10) > 0) {
      throw new Error(`Currency ${currency} does not support fractional units`);
    }
    const wholeVal = BigInt(wholeStr);
    const resultVal = isNegative ? -wholeVal : wholeVal;
    const num = Number(resultVal);
    if (!Number.isSafeInteger(num)) {
      throw new RangeError('Money value exceeds JavaScript safe integer limit');
    }
    return num;
  }

  // Pad or truncate fraction to match exact exponent
  if (fracStr.length > exponent) {
    // Check if extra digits would be truncated non-zero
    const extra = fracStr.substring(exponent);
    if (parseInt(extra, 10) > 0) {
      // Half-up rounding on fractional minor unit
      const baseFrac = BigInt(fracStr.substring(0, exponent));
      const firstExtra = parseInt(extra[0], 10);
      const roundedFrac = firstExtra >= 5 ? baseFrac + 1n : baseFrac;
      const totalUnits = BigInt(wholeStr) * BigInt(10 ** exponent) + roundedFrac;
      const finalUnits = isNegative ? -totalUnits : totalUnits;
      const num = Number(finalUnits);
      if (!Number.isSafeInteger(num)) {
        throw new RangeError('Money value exceeds JavaScript safe integer limit');
      }
      return num;
    }
    fracStr = fracStr.substring(0, exponent);
  } else {
    fracStr = fracStr.padEnd(exponent, '0');
  }

  const totalMinorUnits = BigInt(wholeStr) * BigInt(10 ** exponent) + BigInt(fracStr);
  const signedUnits = isNegative ? -totalMinorUnits : totalMinorUnits;
  const num = Number(signedUnits);

  if (!Number.isSafeInteger(num)) {
    throw new RangeError('Money value exceeds JavaScript safe integer limit');
  }

  return num;
}

/**
 * Formats integer minor units into a human-readable currency string.
 * Converts integer to fixed-point string representation before passing to Intl.NumberFormat.
 */
export function formatMoney(
  minorUnits: number,
  currency: string = 'INR',
  locale?: string
): string {
  if (!Number.isSafeInteger(minorUnits)) {
    throw new TypeError('minorUnits must be a safe integer');
  }

  const code = (currency || 'INR').toUpperCase().trim();
  const exponent = getCurrencyExponent(code);
  const resolvedLocale = locale || (code === 'INR' ? 'en-IN' : code === 'USD' ? 'en-US' : 'en-US');

  if (exponent === 0) {
    return new Intl.NumberFormat(resolvedLocale, {
      style: 'currency',
      currency: code,
      maximumFractionDigits: 0,
      minimumFractionDigits: 0,
    }).format(minorUnits);
  }

  const isNeg = minorUnits < 0;
  const absUnits = Math.abs(minorUnits);
  const factor = 10 ** exponent;
  const whole = Math.floor(absUnits / factor);
  const frac = (absUnits % factor).toString().padStart(exponent, '0');
  const decimalStr = `${isNeg ? '-' : ''}${whole}.${frac}`;

  const numForFormatting = Number(decimalStr);

  return new Intl.NumberFormat(resolvedLocale, {
    style: 'currency',
    currency: code,
    minimumFractionDigits: exponent,
    maximumFractionDigits: exponent,
  }).format(numForFormatting);
}

/**
 * Safe integer additions and subtractions for money minor units.
 */
export function addMoney(a: number, b: number): number {
  if (!Number.isSafeInteger(a) || !Number.isSafeInteger(b)) {
    throw new TypeError('Operands must be safe integers');
  }
  const result = a + b;
  if (!Number.isSafeInteger(result)) {
    throw new RangeError('Money addition overflow');
  }
  return result;
}

export function subtractMoney(a: number, b: number): number {
  if (!Number.isSafeInteger(a) || !Number.isSafeInteger(b)) {
    throw new TypeError('Operands must be safe integers');
  }
  const result = a - b;
  if (!Number.isSafeInteger(result)) {
    throw new RangeError('Money subtraction overflow');
  }
  return result;
}

/**
 * Integer ratio multiplication with half-up rounding.
 * Used for currency conversion, taxes, percentages, or asset calculations without floating-point errors.
 * Formula: round_half_up((minorUnits * numerator) / denominator)
 */
export function multiplyMoneyRatio(
  minorUnits: number,
  numerator: number,
  denominator: number
): number {
  if (
    !Number.isSafeInteger(minorUnits) ||
    !Number.isSafeInteger(numerator) ||
    !Number.isSafeInteger(denominator)
  ) {
    throw new TypeError('All parameters must be safe integers');
  }
  if (denominator === 0) {
    throw new Error('Denominator cannot be zero');
  }

  const m = BigInt(minorUnits);
  const num = BigInt(numerator);
  const den = BigInt(denominator);

  const isNegative = (m < 0n) !== (num < 0n) !== (den < 0n);
  const absProduct = (m < 0n ? -m : m) * (num < 0n ? -num : num);
  const absDen = den < 0n ? -den : den;

  const div = absProduct / absDen;
  const rem = absProduct % absDen;
  const rounded = rem * 2n >= absDen ? div + 1n : div;
  const signed = isNegative ? -rounded : rounded;

  const finalNum = Number(signed);
  if (!Number.isSafeInteger(finalNum)) {
    throw new RangeError('Money calculation result exceeds safe integer range');
  }
  return finalNum;
}

/**
 * Fixed-point investment unit/share helpers (scaled by 10^6).
 * e.g. 1.500000 shares is stored as 1,500,000.
 */
export function parseShares(input: string): number {
  if (typeof input !== 'string') {
    throw new TypeError('Input must be a string');
  }
  let cleaned = input.trim().replace(/,/g, '');
  let isNegative = false;
  if (cleaned.startsWith('-')) {
    isNegative = true;
    cleaned = cleaned.substring(1).trim();
  } else if (cleaned.startsWith('+')) {
    cleaned = cleaned.substring(1).trim();
  }

  cleaned = cleaned.replace(/[^\d.]/g, '');
  if (!cleaned || cleaned === '.') {
    throw new Error(`Invalid share quantity string: "${input}"`);
  }

  const parts = cleaned.split('.');
  if (parts.length > 2) {
    throw new Error(`Invalid share quantity string: "${input}"`);
  }

  const wholeStr = parts[0] || '0';
  let fracStr = parts[1] || '';

  if (fracStr.length > 6) {
    // Half-up rounding on 6th decimal place
    const baseFrac = BigInt(fracStr.substring(0, 6));
    const extra = parseInt(fracStr[6], 10);
    const roundedFrac = extra >= 5 ? baseFrac + 1n : baseFrac;
    const total = BigInt(wholeStr) * BigInt(SHARE_SCALE) + roundedFrac;
    const signed = isNegative ? -total : total;
    const num = Number(signed);
    if (!Number.isSafeInteger(num)) throw new RangeError('Share units overflow');
    return num;
  }

  fracStr = fracStr.padEnd(6, '0');
  const total = BigInt(wholeStr) * BigInt(SHARE_SCALE) + BigInt(fracStr);
  const signed = isNegative ? -total : total;
  const num = Number(signed);
  if (!Number.isSafeInteger(num)) throw new RangeError('Share units overflow');
  return num;
}

export function formatShares(microShares: number): string {
  if (!Number.isSafeInteger(microShares)) {
    throw new TypeError('microShares must be a safe integer');
  }
  const isNeg = microShares < 0;
  const absShares = Math.abs(microShares);
  const whole = Math.floor(absShares / SHARE_SCALE);
  const frac = (absShares % SHARE_SCALE).toString().padStart(6, '0').replace(/0+$/, '');
  const prefix = isNeg ? '-' : '';
  return frac.length > 0 ? `${prefix}${whole}.${frac}` : `${prefix}${whole}`;
}

/**
 * Calculates investment position total market value in minor units:
 * (microShares * priceMinorUnits) / 10^6 with half-up rounding.
 */
export function calculatePositionValue(microShares: number, priceMinorUnits: number): number {
  return multiplyMoneyRatio(priceMinorUnits, microShares, SHARE_SCALE);
}
