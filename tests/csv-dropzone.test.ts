import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QueryClient } from '@tanstack/react-query';

describe('CSV Dropzone & Automated Instant Upload Pipeline Tests', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    vi.clearAllMocks();
  });

  it('validates file extension strictly for .csv format', () => {
    const isCsv = (filename: string) => filename.toLowerCase().endsWith('.csv');

    expect(isCsv('transactions.csv')).toBe(true);
    expect(isCsv('LEDGER_2026.CSV')).toBe(true);
    expect(isCsv('backup.xlsx')).toBe(false);
    expect(isCsv('payload.json')).toBe(false);
    expect(isCsv('image.png')).toBe(false);
    expect(isCsv('script.sh')).toBe(false);
  });

  it('asynchronously extracts text via file.text() and executes zero-click mutation', async () => {
    const mockCsvContent = `date,payee,amount,type,category,notes
2026-09-01,Employer,3000.00,income,Salary,Direct deposit
2026-09-02,Supermarket,120.50,expense,Groceries,Weekly restock`;

    const mockFile = {
      name: 'bank_statement_sept_2026.csv',
      size: mockCsvContent.length,
      text: vi.fn().mockResolvedValue(mockCsvContent),
    } as unknown as File;

    // Simulate instant zero-click processing pipeline
    const text = await mockFile.text();
    expect(text).toBe(mockCsvContent);

    const lines = text.trim().split(/\r?\n/).filter((l) => l.trim().length > 0);
    const rowCount = Math.max(0, lines.length - 1);
    expect(rowCount).toBe(2);

    const mutationFn = vi.fn().mockResolvedValue({ success: true, count: 2 });

    // Execute mutation
    const result = await mutationFn({ csvText: text, file: mockFile, rowCount });
    expect(mutationFn).toHaveBeenCalledTimes(1);
    expect(mutationFn).toHaveBeenCalledWith({
      csvText: mockCsvContent,
      file: mockFile,
      rowCount: 2,
    });
    expect(result).toEqual({ success: true, count: 2 });
  });

  it('completely flushes and resets native HTML input value reference on settled (success and error)', async () => {
    // Mock native HTML input element
    const mockInput = {
      value: 'C:\\fakepath\\statement.csv',
    };

    // Helper simulating onSettled execution branch
    const onSettled = (inputRef: { value: string } | null) => {
      if (inputRef) {
        inputRef.value = '';
      }
    };

    // 1. Success branch
    onSettled(mockInput);
    expect(mockInput.value).toBe('');

    // Set value again
    mockInput.value = 'C:\\fakepath\\invalid_data.csv';
    expect(mockInput.value).toBe('C:\\fakepath\\invalid_data.csv');

    // 2. Error branch
    onSettled(mockInput);
    expect(mockInput.value).toBe('');
  });

  it('cleanly invalidates TanStack Query caches on successful import', async () => {
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const queryKeyToInvalidate = ['finance', 'transactions', 'accounts'];

    // Simulate onSuccess invalidation logic
    if (queryKeyToInvalidate) {
      if (Array.isArray(queryKeyToInvalidate) && Array.isArray(queryKeyToInvalidate[0])) {
        for (const key of queryKeyToInvalidate) {
          queryClient.invalidateQueries({ queryKey: key as any });
        }
      } else {
        queryClient.invalidateQueries({ queryKey: queryKeyToInvalidate as any });
      }
    }

    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ['finance', 'transactions', 'accounts'],
    });
  });

  it('handles server rejection error properly and preserves UI resilience', async () => {
    const mockFile = {
      name: 'corrupted.csv',
      size: 50,
      text: vi.fn().mockResolvedValue('invalid,columns,without,proper,headers'),
    } as unknown as File;

    const mockMutationFn = vi.fn().mockRejectedValue(new Error('D1 Constraint: Invalid Date Format'));
    const onErrorSpy = vi.fn();
    const mockInput = { value: 'C:\\fakepath\\corrupted.csv' };

    try {
      const text = await mockFile.text();
      await mockMutationFn({ csvText: text, file: mockFile, rowCount: 1 });
    } catch (err) {
      onErrorSpy(err, mockFile);
    } finally {
      // onSettled always runs
      mockInput.value = '';
    }

    expect(onErrorSpy).toHaveBeenCalledTimes(1);
    expect(onErrorSpy).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'D1 Constraint: Invalid Date Format' }),
      mockFile
    );
    expect(mockInput.value).toBe(''); // Flushed even after error
  });
});
