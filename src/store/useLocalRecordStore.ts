import { create } from 'zustand';
import { type LocalRecord, generateMockRecords } from '../utils/mockData';

export interface SessionMutations {
  created: number;
  updated: number;
  deleted: number;
}

export interface LocalRecordStoreState {
  records: LocalRecord[];
  isLocalDev: boolean;
  sessionMutations: SessionMutations;
  setRecords: (records: LocalRecord[]) => void;
  addRecord: (record: LocalRecord) => void;
  updateRecord: (id: string, updates: Partial<LocalRecord>) => void;
  deleteRecord: (id: string) => void;
  addRecords: (newRows: LocalRecord[]) => void;
  resetToDefault: () => void;
  clear: () => void;
  setIsLocalDev: (val: boolean) => void;
}

const INITIAL_DEFAULT_RECORDS = generateMockRecords(60);

/**
 * Ephemeral in-memory Zustand store for local development and offline mock testing.
 * No data is persisted to localStorage, session cookies, or remote databases.
 *
 * DATA ISOLATION: isLocalDev is driven by Vite's import.meta.env.DEV flag.
 * In production builds (npm run build → Cloudflare Workers deploy), this is
 * always `false`, which hides the LocalDevBar and disables mock-to-API fallback
 * pathways. Mock data can never reach the production D1 database.
 */
export const useLocalRecordStore = create<LocalRecordStoreState>((set) => ({
  records: INITIAL_DEFAULT_RECORDS,
  sessionMutations: { created: 0, updated: 0, deleted: 0 },
  // Vite sets import.meta.env.DEV = true in dev mode, false in production builds.
  isLocalDev: import.meta.env.DEV === true,

  setRecords: (records: LocalRecord[]) => set({ records }),

  addRecord: (record: LocalRecord) =>
    set((state) => ({
      records: [record, ...state.records.filter((r) => r.id !== record.id)],
      sessionMutations: {
        ...state.sessionMutations,
        created: state.sessionMutations.created + 1,
      },
    })),

  updateRecord: (id: string, updates: Partial<LocalRecord>) =>
    set((state) => ({
      records: state.records.map((r) => (r.id === id ? { ...r, ...updates } : r)),
      sessionMutations: {
        ...state.sessionMutations,
        updated: state.sessionMutations.updated + 1,
      },
    })),

  deleteRecord: (id: string) =>
    set((state) => ({
      records: state.records.filter((r) => r.id !== id),
      sessionMutations: {
        ...state.sessionMutations,
        deleted: state.sessionMutations.deleted + 1,
      },
    })),

  addRecords: (newRows: LocalRecord[]) =>
    set((state) => {
      // Prepend newly added records, avoiding duplicate IDs
      const existingIds = new Set(state.records.map((r) => r.id));
      const filteredNew = newRows.filter((r) => !existingIds.has(r.id));
      return {
        records: [...filteredNew, ...state.records],
        sessionMutations: {
          ...state.sessionMutations,
          created: state.sessionMutations.created + filteredNew.length,
        },
      };
    }),

  resetToDefault: () =>
    set({
      records: generateMockRecords(60),
      sessionMutations: { created: 0, updated: 0, deleted: 0 },
    }),

  clear: () =>
    set((state) => ({
      records: [],
      sessionMutations: {
        ...state.sessionMutations,
        deleted: state.sessionMutations.deleted + state.records.length,
      },
    })),

  setIsLocalDev: (isLocalDev: boolean) => set({ isLocalDev }),
}));
