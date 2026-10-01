import { describe, it, expect, beforeEach } from 'vitest';
import {
  generateMockRecords,
  generateMockCsvString,
  localRecordSchema,
  localRecordCsvRowSchema,
  type LocalRecord,
} from '../src/utils/mockData';
import { useLocalRecordStore } from '../src/store/useLocalRecordStore';
import Papa from 'papaparse';

describe('Local Mock Mode & In-Memory Store Test Suite', () => {
  beforeEach(() => {
    useLocalRecordStore.getState().clear();
  });

  describe('1. Mock Data Generator (src/utils/mockData.ts)', () => {
    it('generates between 50 and 100 realistic records matching schema', () => {
      const records = generateMockRecords(75);
      expect(records.length).toBe(75);

      for (const rec of records) {
        const result = localRecordSchema.safeParse(rec);
        expect(result.success).toBe(true);
        expect(rec.id).toBeDefined();
        expect(rec.title.length).toBeGreaterThan(0);
        expect(rec.content.length).toBeGreaterThan(0);
        expect(['engineering', 'design', 'marketing', 'support', 'operations', 'product']).toContain(rec.category);
        expect(rec.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      }
    });

    it('includes all requested realistic categories (engineering, design, marketing, support)', () => {
      const records = generateMockRecords(60);
      const categories = new Set(records.map((r) => r.category));

      expect(categories.has('engineering')).toBe(true);
      expect(categories.has('design')).toBe(true);
      expect(categories.has('marketing')).toBe(true);
      expect(categories.has('support')).toBe(true);
    });

    it('generates a valid CSV text string with proper RFC headers and formatting', () => {
      const csvStr = generateMockCsvString(10);
      expect(csvStr).toContain('id,title,content,category,createdAt');

      const parsed = Papa.parse<Record<string, string>>(csvStr, { header: true, skipEmptyLines: true });
      expect(parsed.errors.length).toBe(0);
      expect(parsed.data.length).toBe(10);
      expect(parsed.data[0].title).toBeDefined();
      expect(parsed.data[0].category).toBeDefined();
    });
  });

  describe('2. Client-Side State / Zustand Store (src/store/useLocalRecordStore.ts)', () => {
    it('initializes with clear and allows setting records', () => {
      const store = useLocalRecordStore.getState();
      expect(store.records.length).toBe(0);

      const sample: LocalRecord[] = [
        {
          id: 'test_1',
          title: 'Implement Local Mode',
          content: 'Zero network calls to Cloudflare D1',
          category: 'engineering',
          createdAt: '2026-09-29',
        },
      ];

      store.setRecords(sample);
      expect(useLocalRecordStore.getState().records.length).toBe(1);
      expect(useLocalRecordStore.getState().records[0].title).toBe('Implement Local Mode');
    });

    it('supports addRecords without duplicating existing IDs', () => {
      const store = useLocalRecordStore.getState();
      store.setRecords([
        {
          id: 'test_1',
          title: 'Existing',
          content: 'Content',
          category: 'design',
          createdAt: '2026-09-29',
        },
      ]);

      store.addRecords([
        {
          id: 'test_1', // duplicate
          title: 'Duplicate Should Be Ignored',
          content: 'Duplicate',
          category: 'design',
          createdAt: '2026-09-29',
        },
        {
          id: 'test_2', // new
          title: 'Brand New Record',
          content: 'Fresh',
          category: 'marketing',
          createdAt: '2026-09-29',
        },
      ]);

      const state = useLocalRecordStore.getState();
      expect(state.records.length).toBe(2);
      expect(state.records[0].id).toBe('test_2');
      expect(state.records[1].id).toBe('test_1');
    });

    it('resets to default and clears records correctly', () => {
      const store = useLocalRecordStore.getState();
      store.clear();
      expect(store.records.length).toBe(0);

      store.resetToDefault();
      expect(useLocalRecordStore.getState().records.length).toBe(60);

      store.clear();
      expect(useLocalRecordStore.getState().records.length).toBe(0);
    });
  });

  describe('3. Local CSV Parser & Zod Validation (Papa.parse)', () => {
    it('parses CSV text and validates rows against Zod schema without network requests', () => {
      const csvData = `id,title,content,category,createdAt
rec_001,UI Layout System,Redesign app navigation,design,2026-09-29
rec_002,API Gateway Caching,Cache read-heavy routes,engineering,2026-09-29
rec_003,Customer Feedback,Summarize NPS responses,support,2026-09-29`;

      const parsed = Papa.parse<Record<string, string>>(csvData, {
        header: true,
        skipEmptyLines: true,
        transformHeader: (h) => h.trim().toLowerCase(),
      });

      expect(parsed.errors.length).toBe(0);

      const validRecords: LocalRecord[] = [];
      for (const row of parsed.data) {
        const validated = localRecordCsvRowSchema.safeParse(row);
        expect(validated.success).toBe(true);
        if (validated.success) {
          validRecords.push({
            id: row.id,
            title: row.title,
            content: row.content,
            category: validated.data.category,
            createdAt: row.createdat,
          });
        }
      }

      expect(validRecords.length).toBe(3);
      useLocalRecordStore.getState().addRecords(validRecords);

      expect(useLocalRecordStore.getState().records.length).toBe(3);
      expect(useLocalRecordStore.getState().records.map((r) => r.id)).toEqual([
        'rec_001',
        'rec_002',
        'rec_003',
      ]);
    });

    it('rejects invalid rows gracefully and reports validation issues', () => {
      const badRow = {
        title: '', // empty title should fail
        content: '',
        category: 'engineering',
      };

      const result = localRecordCsvRowSchema.safeParse(badRow);
      expect(result.success).toBe(false);
    });
  });
});
