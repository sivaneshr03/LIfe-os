import { useMutation, useQueryClient } from '@tanstack/react-query';
import Papa from 'papaparse';
import { useLocalRecordStore } from '../store/useLocalRecordStore';
import {
  localRecordCsvRowSchema,
  type LocalRecord,
  type LocalRecordCategory,
} from '../utils/mockData';

export interface UseImportCsvOptions {
  isLocalDev?: boolean;
  onSuccess?: (result: { count: number; records: LocalRecord[]; isLocalDev: boolean }, file?: File) => void;
  onError?: (error: Error, file?: File) => void;
}

export interface CsvImportVariables {
  csvText: string;
  file?: File;
  rowCount?: number;
}

export interface CsvImportResult {
  success: boolean;
  count: number;
  records: LocalRecord[];
  isLocalDev: boolean;
  issues?: Array<{ row: number; message: string }>;
}

/**
 * Client-side CSV import hook with local in-memory bypass and Papa.parse validation.
 * When isLocalDev is true (default), absolutely NO network requests are made to Cloudflare D1 or remote APIs.
 */
export function useImportCsv(options: UseImportCsvOptions = {}) {
  const queryClient = useQueryClient();
  const { addRecords, isLocalDev: storeIsLocalDev } = useLocalRecordStore();

  const isLocalDev = options.isLocalDev ?? storeIsLocalDev;

  const mutation = useMutation<CsvImportResult, Error, CsvImportVariables>({
    mutationFn: async ({ csvText, file }) => {
      // 1. LOCAL IN-MEMORY MODE (Zero remote backend / D1 writes)
      if (isLocalDev) {
        // Asynchronous client-side parsing using Papa.parse
        return new Promise<CsvImportResult>((resolve, reject) => {
          Papa.parse<Record<string, string>>(csvText, {
            header: true,
            skipEmptyLines: true,
            transformHeader: (h) => h.trim().toLowerCase(),
            complete: (results) => {
              if (results.errors.length > 0 && results.data.length === 0) {
                return reject(new Error(`CSV Parsing failed: ${results.errors[0].message}`));
              }

              const validRecords: LocalRecord[] = [];
              const issues: Array<{ row: number; message: string }> = [];
              const nowIso = new Date().toISOString().split('T')[0];

              results.data.forEach((row, index) => {
                const rowNum = index + 2; // header is row 1

                // Support both generic headers and domain-specific fallbacks
                const titleVal = row.title || row.name || row.payee || row.subject || '';
                const contentVal = row.content || row.notes || row.description || row.body || '';
                const categoryVal = (row.category || row.type || 'engineering') as LocalRecordCategory;
                const dateVal = row.createdat || row.date || row.transactiondate || nowIso;
                const idVal = row.id || `rec_import_${Date.now()}_${index + 1}`;

                const candidate = {
                  id: idVal,
                  title: titleVal.trim(),
                  content: contentVal.trim(),
                  category: categoryVal,
                  createdAt: dateVal,
                };

                const parseResult = localRecordCsvRowSchema.safeParse(candidate);

                if (parseResult.success) {
                  validRecords.push({
                    id: candidate.id,
                    title: candidate.title,
                    content: candidate.content,
                    category: parseResult.data.category,
                    createdAt: candidate.createdAt,
                  });
                } else {
                  issues.push({
                    row: rowNum,
                    message: parseResult.error.errors.map((e) => e.message).join(', '),
                  });
                }
              });

              if (validRecords.length === 0) {
                return reject(
                  new Error(
                    issues.length > 0
                      ? `No valid records found. Row ${issues[0].row}: ${issues[0].message}`
                      : 'CSV does not contain any valid data rows'
                  )
                );
              }

              // Insert parsed records directly into the local Zustand store
              addRecords(validRecords);

              // Update TanStack Query cache in browser memory
              queryClient.setQueryData<LocalRecord[]>(['local-records'], (old) => [
                ...validRecords,
                ...(old || []),
              ]);
              queryClient.invalidateQueries({ queryKey: ['local-records'] });

              resolve({
                success: true,
                count: validRecords.length,
                records: validRecords,
                isLocalDev: true,
                issues,
              });
            },
            error: (err: Error) => {
              reject(err);
            },
          });
        });
      }

      // 2. REMOTE PRODUCTION MODE (Cloudflare Workers / D1)
      const res = await fetch('/api/import/csv', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ csvData: csvText, fileName: file?.name }),
      });

      const json = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(json?.error?.message || json?.error || 'Remote CSV import failed');
      }

      return {
        success: true,
        count: json?.data?.importedCount ?? 0,
        records: [],
        isLocalDev: false,
      };
    },

    onSuccess: (data, variables) => {
      options.onSuccess?.(data, variables.file);
    },

    onError: (err, variables) => {
      options.onError?.(err, variables.file);
    },
  });

  return {
    ...mutation,
    importCsv: mutation.mutate,
    importCsvAsync: mutation.mutateAsync,
    isLocalDev,
  };
}
