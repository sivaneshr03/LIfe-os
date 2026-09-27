/**
 * Investment Precision and Valuation Utilities
 * Enforces AGENTS.md Rule 7: Zero floating-point drift for financial and investment calculations.
 *
 * Micro-units scale: 1 unit / share = 1,000,000 micro-units (10^6).
 * Currency values: All represented as integer minor units (cents).
 */

export const MICRO_UNITS_SCALE = 1_000_000n;

/**
 * Converts a decimal string or integer number representation of shares to micro-units.
 * Uses string manipulation to avoid JavaScript floating-point binary representation errors.
 * e.g., "1.25" -> 1250000, "0.000001" -> 1, "10" -> 10000000
 */
export function toMicroUnits(quantity: string | number): number {
  if (typeof quantity === 'number') {
    if (!Number.isFinite(quantity) || Number.isNaN(quantity)) {
      throw new TypeError('Invalid number provided for share quantity');
    }
    // Convert to string safely
    quantity = quantity.toString();
  }

  const trimmed = quantity.trim();
  if (!trimmed || !/^-?\d+(\.\d+)?$/.test(trimmed)) {
    throw new TypeError(`Invalid share quantity format: "${quantity}"`);
  }

  const isNegative = trimmed.startsWith('-');
  const unsigned = isNegative ? trimmed.slice(1) : trimmed;

  const [wholePart, fracPart = ''] = unsigned.split('.');
  // Truncate or pad fractional part to exactly 6 digits
  const paddedFrac = (fracPart + '000000').slice(0, 6);

  const microUnits = BigInt(wholePart) * MICRO_UNITS_SCALE + BigInt(paddedFrac);
  const signedResult = isNegative ? -microUnits : microUnits;

  if (signedResult > BigInt(Number.MAX_SAFE_INTEGER) || signedResult < BigInt(Number.MIN_SAFE_INTEGER)) {
    throw new RangeError('Micro-units quantity exceeds JavaScript MAX_SAFE_INTEGER');
  }

  return Number(signedResult);
}

/**
 * Converts micro-units integer back to a clean decimal string.
 * e.g., 1250000 -> "1.25", 1000000 -> "1", 1 -> "0.000001"
 */
export function fromMicroUnits(microUnits: number | bigint): string {
  const bigMicro = BigInt(microUnits);
  const isNegative = bigMicro < 0n;
  const absMicro = isNegative ? -bigMicro : bigMicro;

  const wholePart = absMicro / MICRO_UNITS_SCALE;
  const remainder = absMicro % MICRO_UNITS_SCALE;

  if (remainder === 0n) {
    return `${isNegative ? '-' : ''}${wholePart.toString()}`;
  }

  // Format remainder to 6 digits with leading zeros
  const fracStr = remainder.toString().padStart(6, '0');
  // Trim trailing zeros
  const trimmedFrac = fracStr.replace(/0+$/, '');

  return `${isNegative ? '-' : ''}${wholePart.toString()}.${trimmedFrac}`;
}

/**
 * Calculates market value of a holding in integer minor units (cents).
 * Formula: (unitsMicro * priceCents) / 10^6
 * e.g., 1.5 shares (1500000 micro-units) at $100.00 (10000 cents) = $150.00 (15000 cents).
 */
export function calculateHoldingMarketValue(unitsMicro: number | bigint, priceCents: number | bigint): number {
  const units = BigInt(unitsMicro);
  const price = BigInt(priceCents);

  if (units <= 0n || price <= 0n) {
    return 0;
  }

  const valueCents = (units * price) / MICRO_UNITS_SCALE;
  return Number(valueCents);
}

/**
 * Calculates cost basis of a holding in integer minor units (cents).
 * Formula: (unitsMicro * avgCostBasisCents) / 10^6
 */
export function calculateHoldingCostBasis(unitsMicro: number | bigint, avgCostBasisCents: number | bigint): number {
  const units = BigInt(unitsMicro);
  const cost = BigInt(avgCostBasisCents);

  if (units <= 0n || cost <= 0n) {
    return 0;
  }

  const basisCents = (units * cost) / MICRO_UNITS_SCALE;
  return Number(basisCents);
}

/**
 * Calculates unrealized gain or loss and percentage.
 */
export function calculateUnrealizedGainLoss(
  marketValueCents: number,
  costBasisCents: number
): { gainLossCents: number; gainLossPercentage: number } {
  const gainLossCents = marketValueCents - costBasisCents;
  if (costBasisCents <= 0) {
    return {
      gainLossCents,
      gainLossPercentage: 0,
    };
  }

  // Percentage scaled: (gainLossCents / costBasisCents) * 100 rounded to 2 decimals
  const percentage = Math.round((gainLossCents / costBasisCents) * 10000) / 100;

  return {
    gainLossCents,
    gainLossPercentage: percentage,
  };
}

/**
 * Calculates updated average cost basis per unit (in cents) after purchasing additional units including transaction fees.
 * Formula: ((currentUnits * currentAvgCost) + (newUnits * purchasePrice) + (fees * 10^6)) / (currentUnits + newUnits)
 */
export function calculateNewAvgCostBasis(
  currentUnitsMicro: number,
  currentAvgCostBasisCents: number,
  newUnitsMicro: number,
  purchasePriceCents: number,
  feeCents: number = 0
): number {
  const cUnits = BigInt(currentUnitsMicro);
  const cCost = BigInt(currentAvgCostBasisCents);
  const nUnits = BigInt(newUnitsMicro);
  const nPrice = BigInt(purchasePriceCents);
  const fees = BigInt(feeCents);

  const totalUnits = cUnits + nUnits;
  if (totalUnits <= 0n) {
    return 0;
  }

  // Multiply fees by MICRO_UNITS_SCALE to align units with cost-per-unit base
  const totalCost = cUnits * cCost + nUnits * nPrice + fees * MICRO_UNITS_SCALE;
  const newAvgCost = totalCost / totalUnits;

  return Number(newAvgCost);
}

/**
 * Calculates realized gain or loss on a SELL trade in integer cents.
 * Net proceeds = (sellUnitsMicro * sellPricePerUnitCents) / 10^6 - feeCents
 * Disposed cost basis = (sellUnitsMicro * avgCostBasisCents) / 10^6
 * Realized gain/loss = Net proceeds - Disposed cost basis
 */
export function calculateRealizedGainLoss(
  sellUnitsMicro: number,
  sellPricePerUnitCents: number,
  feeCents: number,
  avgCostBasisCents: number
): {
  grossProceedsCents: number;
  netProceedsCents: number;
  disposedCostBasisCents: number;
  realizedGainCents: number;
} {
  const sUnits = BigInt(sellUnitsMicro);
  const sPrice = BigInt(sellPricePerUnitCents);
  const sFee = BigInt(feeCents);
  const sCost = BigInt(avgCostBasisCents);

  if (sUnits <= 0n) {
    return {
      grossProceedsCents: 0,
      netProceedsCents: 0,
      disposedCostBasisCents: 0,
      realizedGainCents: 0,
    };
  }

  const grossProceeds = (sUnits * sPrice) / MICRO_UNITS_SCALE;
  const netProceeds = grossProceeds - sFee;
  const disposedCostBasis = (sUnits * sCost) / MICRO_UNITS_SCALE;
  const realizedGain = netProceeds - disposedCostBasis;

  return {
    grossProceedsCents: Number(grossProceeds),
    netProceedsCents: Number(netProceeds),
    disposedCostBasisCents: Number(disposedCostBasis),
    realizedGainCents: Number(realizedGain),
  };
}

/**
 * Calculates dividend distribution amount in integer cents.
 * Formula: (holdingUnitsMicro * dividendPerShareCents) / 10^6
 */
export function calculateDividendAmount(
  holdingUnitsMicro: number,
  dividendPerShareCents: number
): number {
  const units = BigInt(holdingUnitsMicro);
  const div = BigInt(dividendPerShareCents);

  if (units <= 0n || div <= 0n) {
    return 0;
  }

  return Number((units * div) / MICRO_UNITS_SCALE);
}

