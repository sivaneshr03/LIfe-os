import { create } from 'zustand';
import { type LocalRecord, generateMockRecords } from '../utils/mockData';

export interface LocalRecordStoreState {
  records: LocalRecord[];
  isLocalDev: boolean;
  setRecords: (records: LocalRecord[]) => void;
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
  // Vite sets import.meta.env.DEV = true in dev mode, false in production builds.
  isLocalDev: import.meta.env.DEV === true,

  setRecords: (records: LocalRecord[]) => set({ records }),

  addRecords: (newRows: LocalRecord[]) =>
    set((state) => {
      // Prepend newly added records, avoiding duplicate IDs
      const existingIds = new Set(state.records.map((r) => r.id));
      const filteredNew = newRows.filter((r) => !existingIds.has(r.id));
      return { records: [...filteredNew, ...state.records] };
    }),

  resetToDefault: () => set({ records: generateMockRecords(60) }),

  clear: () => set({ records: [] }),

  setIsLocalDev: (isLocalDev: boolean) => set({ isLocalDev }),
}));
