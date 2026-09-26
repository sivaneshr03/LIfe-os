# [ADR-0002] Integer Minor Units for Monetary Arithmetic

## Status
Accepted

## Context & Problem Statement
JavaScript IEEE-754 binary floating-point numbers (`0.1 + 0.2 === 0.30000000000000004`) introduce rounding discrepancies that corrupt financial ledger totals, account reconciliations, and debt amortization schedules over time.

## Decision Drivers
- Strict mathematical integrity and deterministic calculations across all financial views.
- Absolute prevention of rounding errors and phantom penny losses.
- Seamless compatibility with database integer types in SQLite/Cloudflare D1.

## Considered Options
1. JavaScript native `number` floating-point storage (e.g. `12.99`).
2. String-based decimal types parsed at runtime.
3. Integer minor units (cents, e.g. `$12.99` stored as `1299`) and fixed-point integer scaling for investments ($10^6$).

## Decision Outcome
Chosen option: **Integer minor units (cents)** for all currency values and **fixed-point integer scaling ($10^6$)** for fractional investment shares.

### Positive Consequences
- Exact integer addition, subtraction, and multiplication without precision drift.
- Native SQLite `INTEGER` columns are fast, compact, and perfectly indexed.
- Formatting and localized currency display are relegated to dedicated presentation utilities (`Intl.NumberFormat`).

### Negative Consequences / Trade-offs
- Developers must be disciplined to avoid accidental float conversions when taking user input or displaying values. Enforced via unit tests and Zod transformation pipelines.
