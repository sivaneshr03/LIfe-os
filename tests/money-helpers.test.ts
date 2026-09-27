import { describe, it, expect } from 'vitest';
import {
  parseMoney,
  formatMoney,
  addMoney,
  subtractMoney,
  multiplyMoneyRatio,
  parseShares,
  formatShares,
  calculatePositionValue,
  getCurrencyExponent,
  getMinorUnitFactor,
} from '../src/shared/utils/money';

describe('Authoritative Money & Currency Helpers (AGENTS.md Compliant)', () => {
  describe('Exponents and Factors', () => {
    it('returns correct exponent and factor for standard 2-decimal currencies', () => {
      expect(getCurrencyExponent('USD')).toBe(2);
      expect(getMinorUnitFactor('USD')).toBe(100);
      expect(getCurrencyExponent('EUR')).toBe(2);
      expect(getMinorUnitFactor('EUR')).toBe(100);
      expect(getCurrencyExponent('GBP')).toBe(2);
      expect(getMinorUnitFactor('GBP')).toBe(100);
    });

    it('returns correct exponent and factor for 0-decimal currencies', () => {
      expect(getCurrencyExponent('JPY')).toBe(0);
      expect(getMinorUnitFactor('JPY')).toBe(1);
      expect(getCurrencyExponent('KRW')).toBe(0);
      expect(getMinorUnitFactor('KRW')).toBe(1);
    });

    it('returns correct exponent and factor for 3-decimal currencies', () => {
      expect(getCurrencyExponent('KWD')).toBe(3);
      expect(getMinorUnitFactor('KWD')).toBe(1000);
      expect(getCurrencyExponent('BHD')).toBe(3);
      expect(getMinorUnitFactor('BHD')).toBe(1000);
    });
  });

  describe('parseMoney (No Floating-Point Arithmetic)', () => {
    it('parses standard positive and negative 2-decimal currencies into integer cents', () => {
      expect(parseMoney('12.34', 'USD')).toBe(1234);
      expect(parseMoney('$12.34', 'USD')).toBe(1234);
      expect(parseMoney('  $ 12.34  ', 'USD')).toBe(1234);
      expect(parseMoney('-12.34', 'USD')).toBe(-1234);
      expect(parseMoney('-$12.34', 'USD')).toBe(-1234);
      expect(parseMoney('0.05', 'USD')).toBe(5);
      expect(parseMoney('0.5', 'USD')).toBe(50);
      expect(parseMoney('100', 'USD')).toBe(10000);
      expect(parseMoney('0', 'USD')).toBe(0);
    });

    it('handles commas as thousand separators properly', () => {
      expect(parseMoney('1,250.75', 'USD')).toBe(125075);
      expect(parseMoney('1,000,000.00', 'USD')).toBe(100000000);
    });

    it('performs half-up rounding on fractional sub-minor units', () => {
      expect(parseMoney('12.345', 'USD')).toBe(1235);
      expect(parseMoney('12.344', 'USD')).toBe(1234);
      expect(parseMoney('12.349', 'USD')).toBe(1235);
    });

    it('parses 0-decimal currencies without fractions', () => {
      expect(parseMoney('500', 'JPY')).toBe(500);
      expect(parseMoney('¥1,500', 'JPY')).toBe(1500);
      expect(() => parseMoney('500.5', 'JPY')).toThrow('does not support fractional units');
    });

    it('parses 3-decimal currencies accurately', () => {
      expect(parseMoney('1.250', 'KWD')).toBe(1250);
      expect(parseMoney('1.25', 'KWD')).toBe(1250);
      expect(parseMoney('1.2', 'KWD')).toBe(1200);
      expect(parseMoney('5', 'KWD')).toBe(5000);
    });

    it('parses INR currency strings and defaults to INR', () => {
      expect(parseMoney('12.34')).toBe(1234);
      expect(parseMoney('₹12.34')).toBe(1234);
      expect(parseMoney('₹1,23,456.78', 'INR')).toBe(12345678);
    });

    it('rejects invalid inputs', () => {
      expect(() => parseMoney('', 'USD')).toThrow();
      expect(() => parseMoney('abc', 'USD')).toThrow();
      expect(() => parseMoney('12.34.56', 'USD')).toThrow();
    });
  });

  describe('formatMoney', () => {
    it('formats INR integer paise by default with Indian numbering and ₹ symbol', () => {
      const formatted = formatMoney(12345678);
      expect(formatted).toContain('1,23,456.78');
      expect(formatted).toContain('₹');
    });

    it('formats USD integer cents to currency string', () => {
      const formatted = formatMoney(1234, 'USD');
      expect(formatted).toContain('12.34');
      expect(formatted).toContain('$');
    });

    it('formats negative values correctly', () => {
      const formatted = formatMoney(-1234, 'USD');
      expect(formatted).toContain('12.34');
    });

    it('formats zero-decimal currencies without decimals', () => {
      const formatted = formatMoney(1500, 'JPY');
      expect(formatted).toContain('1,500');
      expect(formatted).not.toContain('.00');
    });
  });

  describe('addMoney & subtractMoney', () => {
    it('adds and subtracts integer minor units safely', () => {
      expect(addMoney(1050, 450)).toBe(1500);
      expect(subtractMoney(1500, 450)).toBe(1050);
      expect(addMoney(-500, 200)).toBe(-300);
    });

    it('throws when operands are not safe integers', () => {
      expect(() => addMoney(1.5, 2)).toThrow();
      expect(() => subtractMoney(2, 1.5)).toThrow();
    });
  });

  describe('multiplyMoneyRatio (Integer Ratio Math with Half-Up Rounding)', () => {
    it('calculates 50% of $10.00 accurately', () => {
      // 1000 cents * 1 / 2 = 500 cents ($5.00)
      expect(multiplyMoneyRatio(1000, 1, 2)).toBe(500);
    });

    it('performs half-up rounding on fractional minor unit results', () => {
      // 100 cents * 1 / 3 = 33.333... -> 33
      expect(multiplyMoneyRatio(100, 1, 3)).toBe(33);
      // 200 cents * 1 / 3 = 66.666... -> 67
      expect(multiplyMoneyRatio(200, 1, 3)).toBe(67);
      // 1 cent * 1 / 2 = 0.5 -> 1 (half-up)
      expect(multiplyMoneyRatio(1, 1, 2)).toBe(1);
    });

    it('handles negative numbers with half-up rounding', () => {
      expect(multiplyMoneyRatio(-100, 1, 2)).toBe(-50);
      expect(multiplyMoneyRatio(-200, 1, 3)).toBe(-67);
    });

    it('throws on division by zero', () => {
      expect(() => multiplyMoneyRatio(100, 1, 0)).toThrow('Denominator cannot be zero');
    });
  });

  describe('Investment Shares Fixed-Point Helpers (10^6 scale)', () => {
    it('parses share strings into micro-shares integer', () => {
      expect(parseShares('1')).toBe(1000000);
      expect(parseShares('1.5')).toBe(1500000);
      expect(parseShares('0.000001')).toBe(1);
      expect(parseShares('10.123456')).toBe(10123456);
      expect(parseShares('-2.5')).toBe(-2500000);
    });

    it('rounds micro-shares on 7th decimal place with half-up rounding', () => {
      // 1.0000005 -> 1000001
      expect(parseShares('1.0000005')).toBe(1000001);
      // 1.0000004 -> 1000000
      expect(parseShares('1.0000004')).toBe(1000000);
    });

    it('formats micro-shares back to clean string', () => {
      expect(formatShares(1500000)).toBe('1.5');
      expect(formatShares(1000000)).toBe('1');
      expect(formatShares(10123456)).toBe('10.123456');
      expect(formatShares(1)).toBe('0.000001');
      expect(formatShares(-2500000)).toBe('-2.5');
    });

    it('calculates position total market value correctly', () => {
      // 2.5 shares (2,500,000 micro-shares) at $100.00 (10000 cents) = $250.00 (25000 cents)
      const shares = parseShares('2.5');
      const priceCents = parseMoney('100.00', 'USD');
      expect(calculatePositionValue(shares, priceCents)).toBe(25000);

      // 0.333333 shares at $150.00 (15000 cents) = 4999.995 -> 5000 cents ($50.00)
      const fractional = parseShares('0.333333');
      expect(calculatePositionValue(fractional, 15000)).toBe(5000);
    });
  });
});
