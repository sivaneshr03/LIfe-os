import { describe, it, expect } from 'vitest';
import {
  toMicroUnits,
  fromMicroUnits,
  calculateHoldingMarketValue,
  calculateHoldingCostBasis,
  calculateUnrealizedGainLoss,
  calculateNewAvgCostBasis,
  calculateRealizedGainLoss,
  calculateDividendAmount,
} from '../src/shared/utils/investment';

describe('Investment Precision & Math Utilities Suite', () => {
  describe('toMicroUnits & fromMicroUnits Conversions', () => {
    it('converts whole shares accurately', () => {
      expect(toMicroUnits(1)).toBe(1_000_000);
      expect(toMicroUnits('10')).toBe(10_000_000);
      expect(toMicroUnits('100')).toBe(100_000_000);
      expect(toMicroUnits(0)).toBe(0);
    });

    it('converts fractional shares up to 6 decimal places with zero floating-point drift', () => {
      // 1.5 shares -> 1,500,000 micro-units
      expect(toMicroUnits('1.5')).toBe(1_500_000);
      // 0.123456 shares -> 123,456 micro-units
      expect(toMicroUnits('0.123456')).toBe(123_456);
      // Smallest unit: 0.000001 -> 1 micro-unit
      expect(toMicroUnits('0.000001')).toBe(1);
      // Truncates beyond 6 decimals deterministically
      expect(toMicroUnits('1.123456789')).toBe(1_123_456);
    });

    it('formats micro-units back to clean decimal strings without trailing zeros', () => {
      expect(fromMicroUnits(1_000_000)).toBe('1');
      expect(fromMicroUnits(1_500_000)).toBe('1.5');
      expect(fromMicroUnits(123_456)).toBe('0.123456');
      expect(fromMicroUnits(1)).toBe('0.000001');
      expect(fromMicroUnits(0)).toBe('0');
      expect(fromMicroUnits(10_050_000)).toBe('10.05');
    });

    it('rejects invalid share quantity strings', () => {
      expect(() => toMicroUnits('abc')).toThrow(TypeError);
      expect(() => toMicroUnits('12.34.56')).toThrow(TypeError);
      expect(() => toMicroUnits('')).toThrow(TypeError);
      expect(() => toMicroUnits(NaN)).toThrow(TypeError);
    });
  });

  describe('calculateHoldingMarketValue & Cost Basis', () => {
    it('calculates market value in integer cents accurately', () => {
      // 10 shares (10_000_000 micro-units) at $150.00 (15,000 cents) = $1,500.00 (150,000 cents)
      const value = calculateHoldingMarketValue(10_000_000, 15_000);
      expect(value).toBe(150_000);
    });

    it('calculates fractional share market value with deterministic integer math', () => {
      // 1.5 shares (1,500,000 micro-units) at $200.00 (20,000 cents) = $300.00 (30,000 cents)
      const val1 = calculateHoldingMarketValue(1_500_000, 20_000);
      expect(val1).toBe(30_000);

      // 0.25 shares (250,000 micro-units) at $100.00 (10,000 cents) = $25.00 (2,500 cents)
      const val2 = calculateHoldingMarketValue(250_000, 10_000);
      expect(val2).toBe(2_500);

      // 0.000001 BTC (1 micro-unit) at $65,000.00 (6,500,000 cents) = $0.06 (6 cents)
      const val3 = calculateHoldingMarketValue(1, 6_500_000);
      expect(val3).toBe(6);
    });

    it('returns 0 for zero or negative quantities or prices', () => {
      expect(calculateHoldingMarketValue(0, 10_000)).toBe(0);
      expect(calculateHoldingMarketValue(1_000_000, 0)).toBe(0);
      expect(calculateHoldingCostBasis(0, 5_000)).toBe(0);
    });
  });

  describe('calculateUnrealizedGainLoss', () => {
    it('calculates unrealized gain and percentage accurately', () => {
      // Cost: $1,000.00 (100,000 cents), Market: $1,250.00 (125,000 cents) -> Gain: +$250.00 (+25%)
      const result = calculateUnrealizedGainLoss(125_000, 100_000);
      expect(result.gainLossCents).toBe(25_000);
      expect(result.gainLossPercentage).toBe(25);
    });

    it('calculates unrealized loss and percentage accurately', () => {
      // Cost: $1,000.00 (100,000 cents), Market: $800.00 (80,000 cents) -> Loss: -$200.00 (-20%)
      const result = calculateUnrealizedGainLoss(80_000, 100_000);
      expect(result.gainLossCents).toBe(-20_000);
      expect(result.gainLossPercentage).toBe(-20);
    });

    it('handles zero cost basis gracefully', () => {
      const result = calculateUnrealizedGainLoss(50_000, 0);
      expect(result.gainLossCents).toBe(50_000);
      expect(result.gainLossPercentage).toBe(0);
    });
  });

  describe('calculateNewAvgCostBasis (Subsequent Purchases)', () => {
    it('calculates weighted average cost basis after a second purchase', () => {
      // Initially held: 10 shares at $100.00 (10,000 cents) -> $1,000.00 total
      // Purchased: 10 shares at $150.00 (15,000 cents) -> $1,500.00 total
      // Total: 20 shares for $2,500.00 -> New average cost: $125.00 (12,500 cents)
      const newAvgCost = calculateNewAvgCostBasis(
        10_000_000, // 10 shares
        10_000,     // $100.00
        10_000_000, // 10 shares
        15_000      // $150.00
      );
      expect(newAvgCost).toBe(12_500);
    });

    it('calculates weighted average cost with fractional shares and fees', () => {
      // Initially: 1 share at $50.00 (5,000 cents)
      // Purchased: 0.5 share at $80.00 (8,000 cents) + $1.00 fee (100 cents)
      // Total cost: 5,000 + 4,000 + 100 = 9,100 cents for 1.5 shares -> 9,100 / 1.5 = 6,066.666 -> 6,066 cents
      const newAvgCost = calculateNewAvgCostBasis(
        1_000_000,
        5_000,
        500_000,
        8_000,
        100
      );
      expect(newAvgCost).toBe(6_066);
    });
  });

  describe('calculateRealizedGainLoss (Sell Trades)', () => {
    it('calculates realized profit on partial position disposal after fees', () => {
      // Sold 5 shares @ $200.00 (20,000 cents) with $5.00 fee (500 cents). Avg cost: $120.00 (12,000 cents)
      // Gross proceeds = 5 * 200 = $1,000.00 (100,000 cents)
      // Net proceeds = 100,000 - 500 = 99,500 cents
      // Disposed cost basis = 5 * 120 = $600.00 (60,000 cents)
      // Realized gain = 99,500 - 60,000 = 39,500 cents ($395.00)
      const pnl = calculateRealizedGainLoss(5_000_000, 20_000, 500, 12_000);
      expect(pnl.grossProceedsCents).toBe(100_000);
      expect(pnl.netProceedsCents).toBe(99_500);
      expect(pnl.disposedCostBasisCents).toBe(60_000);
      expect(pnl.realizedGainCents).toBe(39_500);
    });

    it('calculates realized loss on sell trade', () => {
      // Sold 2 shares @ $80.00 (8,000 cents), fee $0. Avg cost: $100.00 (10,000 cents)
      // Proceeds = 16,000 cents. Disposed cost = 20,000 cents. Loss = -4,000 cents (-$40.00)
      const pnl = calculateRealizedGainLoss(2_000_000, 8_000, 0, 10_000);
      expect(pnl.realizedGainCents).toBe(-4_000);
    });
  });

  describe('calculateDividendAmount', () => {
    it('calculates dividend payout amount accurately in integer cents', () => {
      // 100 shares held with $1.25 dividend per share (125 cents) -> $125.00 (12,500 cents)
      expect(calculateDividendAmount(100_000_000, 125)).toBe(12_500);

      // 2.5 shares held with $0.80 dividend per share (80 cents) -> $2.00 (200 cents)
      expect(calculateDividendAmount(2_500_000, 80)).toBe(200);

      expect(calculateDividendAmount(0, 100)).toBe(0);
    });
  });
});

