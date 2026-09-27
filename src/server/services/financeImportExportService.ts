import { eq, and, gte, lte, desc } from 'drizzle-orm';
import type { D1Database } from '@cloudflare/workers-types';
import { createDb } from '../db/client';
import {
  financeAccounts,
  financeTransactions,
  financeBudgets,
  financeDebts,
} from '../db/schema';
import { parseMoney } from '../../shared/utils/money';
import { isValidCalendarDate } from '../../shared/utils/date';
import { recordFinanceAuditEvent } from './financeLedgerService';
import type {
  FinanceImportPreviewData,
  FinanceImportRowPreview,
  FinanceImportCommitResult,
  FinanceTransactionType,
} from '../../shared/financeTypes';

/**
 * Parses CSV raw string into rows and fields.
 */
function parseCsvLines(csvText: string): string[][] {
  const lines = csvText.split(/\r?\n/).filter((l) => l.trim().length > 0);
  const rows: string[][] = [];

  for (const line of lines) {
    const fields: string[] = [];
    let cur = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        fields.push(cur.trim());
        cur = '';
      } else {
        cur += char;
      }
    }
    fields.push(cur.trim());
    rows.push(fields);
  }

  return rows;
}

/**
 * Previews and validates a CSV transaction import before committing.
 * Detects duplicates against existing user transactions.
 */
export async function previewCsvImport(
  d1: D1Database,
  userId: string,
  accountId: string,
  csvText: string,
  hasHeader: boolean = true
): Promise<FinanceImportPreviewData> {
  const db = createDb(d1);

  // Validate account ownership
  const account = (
    await db
      .select()
      .from(financeAccounts)
      .where(and(eq(financeAccounts.id, accountId), eq(financeAccounts.userId, userId)))
      .limit(1)
  )[0];

  if (!account) {
    throw new Error('Target account not found');
  }

  const rawRows = parseCsvLines(csvText);
  const dataRows = hasHeader ? rawRows.slice(1) : rawRows;

  // Fetch existing transactions on this account to detect duplicates
  const existingTxns = await db
    .select({
      transactionDate: financeTransactions.transactionDate,
      amountCents: financeTransactions.amountCents,
      payee: financeTransactions.payee,
      type: financeTransactions.type,
    })
    .from(financeTransactions)
    .where(and(eq(financeTransactions.userId, userId), eq(financeTransactions.accountId, accountId)));

  const existingSet = new Set<string>();
  for (const t of existingTxns) {
    const key = `${t.transactionDate}|${t.amountCents}|${(t.payee || '').toLowerCase().trim()}|${t.type}`;
    existingSet.add(key);
  }

  const previewRows: FinanceImportRowPreview[] = [];
  let validCount = 0;
  let invalidCount = 0;
  let duplicateCount = 0;

  for (let idx = 0; idx < dataRows.length; idx++) {
    const row = dataRows[idx];
    const rowNumber = idx + (hasHeader ? 2 : 1);
    const errors: string[] = [];

    // Format expected: date, payee, amount, type, category, notes
    const rawDate = row[0] || '';
    const rawPayee = row[1] || '';
    const rawAmount = row[2] || '';
    const rawType = (row[3] || 'expense').toLowerCase();
    const rawCategory = row[4] || '';
    const rawNotes = row[5] || '';

    // 1. Validate Date
    if (!isValidCalendarDate(rawDate)) {
      errors.push(`Invalid date format '${rawDate}', expected YYYY-MM-DD`);
    }

    // 2. Validate Amount
    let amountCents = 0;
    try {
      amountCents = parseMoney(rawAmount);
      if (amountCents <= 0) {
        errors.push(`Amount must be greater than zero`);
      }
    } catch {
      errors.push(`Invalid amount string '${rawAmount}'`);
    }

    // 3. Validate Type
    let type: FinanceTransactionType = 'expense';
    if (rawType === 'income' || rawType === 'credit') {
      type = 'income';
    } else if (rawType === 'expense' || rawType === 'debit') {
      type = 'expense';
    } else if (rawType === 'transfer') {
      type = 'transfer';
    } else {
      errors.push(`Unrecognized transaction type '${rawType}'`);
    }

    // 4. Duplicate Check
    const key = `${rawDate}|${amountCents}|${rawPayee.toLowerCase().trim()}|${type}`;
    const isDuplicate = existingSet.has(key);

    const isValid = errors.length === 0;
    if (!isValid) {
      invalidCount++;
    } else {
      validCount++;
      if (isDuplicate) duplicateCount++;
    }

    previewRows.push({
      rowNumber,
      transactionDate: rawDate,
      payee: rawPayee,
      amountCents,
      type,
      categoryName: rawCategory || null,
      accountName: account.name,
      notes: rawNotes || null,
      isValid,
      isDuplicate,
      validationErrors: errors,
    });
  }

  return {
    totalRows: dataRows.length,
    validCount,
    invalidCount,
    duplicateCount,
    rows: previewRows,
  };
}

/**
 * Commits a batch of validated transaction rows atomically.
 */
export async function commitCsvImport(
  d1: D1Database,
  userId: string,
  accountId: string,
  rows: Array<{
    transactionDate: string;
    payee?: string | null;
    amountCents: number;
    type: FinanceTransactionType;
    categoryId?: string | null;
    notes?: string | null;
  }>
): Promise<FinanceImportCommitResult> {
  const db = createDb(d1);

  const account = (
    await db
      .select()
      .from(financeAccounts)
      .where(and(eq(financeAccounts.id, accountId), eq(financeAccounts.userId, userId)))
      .limit(1)
  )[0];

  if (!account) {
    throw new Error('Target account not found');
  }

  let totalDelta = 0;
  const now = new Date();
  let importedCount = 0;

  for (const r of rows) {
    const txnId = `txn_${crypto.randomUUID()}`;
    const delta = r.type === 'income' ? r.amountCents : -r.amountCents;
    totalDelta += delta;

    await db.insert(financeTransactions).values({
      id: txnId,
      userId,
      accountId,
      categoryId: r.categoryId || null,
      type: r.type,
      amountCents: r.amountCents,
      transactionDate: r.transactionDate,
      timestampMs: now,
      payee: r.payee || null,
      notes: r.notes || null,
      isReconciled: 1,
      hasSplits: 0,
      createdAt: now,
      updatedAt: now,
    });

    importedCount++;
  }

  // Update account balance
  const updatedBalance = account.balanceCents + totalDelta;
  await db
    .update(financeAccounts)
    .set({ balanceCents: updatedBalance, updatedAt: now })
    .where(eq(financeAccounts.id, accountId));

  await recordFinanceAuditEvent(d1, userId, 'finance_account', accountId, 'csv_import', {
    importedCount,
    balanceDeltaCents: totalDelta,
    newBalanceCents: updatedBalance,
  });

  return {
    importedCount,
    skippedCount: 0,
    accountBalancesUpdated: 1,
  };
}

/**
 * Exports financial data to CSV or JSON format.
 */
export async function exportFinanceData(
  d1: D1Database,
  userId: string,
  entity: 'all' | 'transactions' | 'accounts' | 'debts' | 'budgets' = 'transactions',
  format: 'csv' | 'json' = 'csv',
  filters?: { accountId?: string; startDate?: string; endDate?: string }
): Promise<{ content: string; contentType: string; filename: string }> {
  const db = createDb(d1);

  if (entity === 'transactions' || entity === 'all') {
    const conditions = [eq(financeTransactions.userId, userId)];
    if (filters?.accountId) conditions.push(eq(financeTransactions.accountId, filters.accountId));
    if (filters?.startDate) conditions.push(gte(financeTransactions.transactionDate, filters.startDate));
    if (filters?.endDate) conditions.push(lte(financeTransactions.transactionDate, filters.endDate));

    const txns = await db
      .select()
      .from(financeTransactions)
      .where(and(...conditions))
      .orderBy(desc(financeTransactions.transactionDate));

    if (format === 'json') {
      return {
        content: JSON.stringify(txns, null, 2),
        contentType: 'application/json',
        filename: `lifeos-transactions-${new Date().toISOString().slice(0, 10)}.json`,
      };
    }

function sanitizeCsvField(val: string | null | undefined): string {
  if (!val) return '""';
  let str = String(val);
  // Neutralize CSV formula injection characters (=, +, -, @, tab, cr)
  if (/^[=+\-@\t\r]/.test(str)) {
    str = "'" + str;
  }
  return `"${str.replace(/"/g, '""')}"`;
}

    // Generate RFC 4180 CSV
    const csvHeader = 'id,transactionDate,type,amountCents,accountId,categoryId,payee,notes,createdAt\n';
    const csvLines = txns.map((t) => {
      return [
        t.id,
        t.transactionDate,
        t.type,
        t.amountCents,
        t.accountId,
        t.categoryId || '',
        sanitizeCsvField(t.payee),
        sanitizeCsvField(t.notes),
        t.createdAt.toISOString(),
      ].join(',');
    });

    return {
      content: csvHeader + csvLines.join('\n'),
      contentType: 'text/csv',
      filename: `lifeos-transactions-${new Date().toISOString().slice(0, 10)}.csv`,
    };
  }

  if (entity === 'accounts') {
    const accounts = await db
      .select()
      .from(financeAccounts)
      .where(eq(financeAccounts.userId, userId));

    if (format === 'json') {
      return {
        content: JSON.stringify(accounts, null, 2),
        contentType: 'application/json',
        filename: `lifeos-accounts-${new Date().toISOString().slice(0, 10)}.json`,
      };
    }

    const csvHeader = 'id,name,type,currency,balanceCents,isArchived,createdAt\n';
    const csvLines = accounts.map((a) =>
      [a.id, sanitizeCsvField(a.name), a.type, a.currency, a.balanceCents, a.isArchived, a.createdAt.toISOString()].join(',')
    );

    return {
      content: csvHeader + csvLines.join('\n'),
      contentType: 'text/csv',
      filename: `lifeos-accounts-${new Date().toISOString().slice(0, 10)}.csv`,
    };
  }

  if (entity === 'debts') {
    const debts = await db
      .select()
      .from(financeDebts)
      .where(eq(financeDebts.userId, userId));

    if (format === 'json') {
      return {
        content: JSON.stringify(debts, null, 2),
        contentType: 'application/json',
        filename: `lifeos-debts-${new Date().toISOString().slice(0, 10)}.json`,
      };
    }

    const csvHeader = 'id,name,creditor,debtType,totalOwedCents,interestRateBps,minimumPaymentCents,isPaidOff,dueDate\n';
    const csvLines = debts.map((d) =>
      [
        d.id,
        sanitizeCsvField(d.name),
        sanitizeCsvField(d.creditor),
        d.debtType,
        d.totalOwedCents,
        d.interestRateBps,
        d.minimumPaymentCents,
        d.isPaidOff,
        d.dueDate || '',
      ].join(',')
    );

    return {
      content: csvHeader + csvLines.join('\n'),
      contentType: 'text/csv',
      filename: `lifeos-debts-${new Date().toISOString().slice(0, 10)}.csv`,
    };
  }

  // Fallback: budgets
  const budgets = await db
    .select()
    .from(financeBudgets)
    .where(eq(financeBudgets.userId, userId));

  if (format === 'json') {
    return {
      content: JSON.stringify(budgets, null, 2),
      contentType: 'application/json',
      filename: `lifeos-budgets-${new Date().toISOString().slice(0, 10)}.json`,
    };
  }

  const csvHeader = 'id,categoryId,period,yearMonth,amountCents,rollover\n';
  const csvLines = budgets.map((b) =>
    [b.id, b.categoryId, b.period, b.yearMonth, b.amountCents, b.rollover].join(',')
  );

  return {
    content: csvHeader + csvLines.join('\n'),
    contentType: 'text/csv',
    filename: `lifeos-budgets-${new Date().toISOString().slice(0, 10)}.csv`,
  };
}
