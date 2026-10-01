import React, { useState, useMemo } from 'react';
import { Modal } from './Modal';
import { CsvDropzone } from './CsvDropzone';
import { Button } from './Button';
import { Badge } from './Badge';
import { Input } from './Input';
import { IconSearch, IconTrash, IconRefresh, IconFileSpreadsheet } from './Icons';
import { useLocalRecordStore } from '../../stores/useLocalRecordStore';
import { useImportCsv } from '../../hooks/useImportCsv';
import { downloadMockCsvFile, type LocalRecordCategory } from '../../utils/mockData';
import { useToast } from './Toast';

export interface LocalMockImportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const CATEGORY_COLORS: Record<LocalRecordCategory, 'indigo' | 'purple' | 'amber' | 'emerald' | 'cyan' | 'default'> = {
  engineering: 'indigo',
  design: 'purple',
  marketing: 'amber',
  support: 'emerald',
  operations: 'cyan',
  product: 'default',
};

export function LocalMockImportModal({ isOpen, onClose }: LocalMockImportModalProps) {
  const { addToast } = useToast();
  const { records, clear, resetToDefault } = useLocalRecordStore();
  const [search, setSearch] = useState('');
  const [selectedCat, setSelectedCat] = useState<string>('all');

  const { importCsvAsync } = useImportCsv({
    isLocalDev: true,
    onSuccess: (res) => {
      addToast(`Added ${res.count} records to local in-memory store!`, 'success');
    },
  });

  const filteredRecords = useMemo(() => {
    return records.filter((r) => {
      const matchesSearch =
        search.trim() === '' ||
        r.title.toLowerCase().includes(search.toLowerCase()) ||
        r.content.toLowerCase().includes(search.toLowerCase()) ||
        r.id.toLowerCase().includes(search.toLowerCase());

      const matchesCat = selectedCat === 'all' || r.category === selectedCat;

      return matchesSearch && matchesCat;
    });
  }, [records, search, selectedCat]);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Local Mock CSV Import & In-Memory Store"
      description="Zero backend writes • Ephemeral browser memory mode • Instant Papa.parse validation"
      size="xl"
    >
      <div className="space-y-6">
        {/* Dropzone configured for Local In-Memory Mode */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-foreground/75 uppercase tracking-wider">
              1. Dropzone UI (Local Client-Side Parser)
            </span>
            <span className="text-[10px] font-mono text-emerald-500 font-semibold px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20">
              ● Local Dev Mode (No D1 Writes)
            </span>
          </div>

          <CsvDropzone
            mutationFn={async ({ csvText, file, rowCount }) => {
              return await importCsvAsync({ csvText, file, rowCount });
            }}
            queryKeyToInvalidate={['local-records']}
            processingMessage="Parsing CSV in browser memory with Papa.parse..."
            title="Drop CSV for Instant In-Memory Import"
            description="Extracts data via file.text(), validates against Zod, and updates local Zustand store in-memory."
            expectedFormatHint="id, title, content, category (engineering/design/marketing/support), createdAt"
          />

          <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-xs">
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => downloadMockCsvFile('sample_lifeos_records.csv', 15)}
              >
                <IconFileSpreadsheet size={13} />
                <span>Download Sample CSV</span>
              </Button>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={resetToDefault}>
                <IconRefresh size={13} />
                <span>Reset Default (25)</span>
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => {
                  clear();
                  addToast('Cleared all local records', 'info');
                }}
              >
                <IconTrash size={13} />
                <span>Clear All</span>
              </Button>
            </div>
          </div>
        </div>

        {/* Live List View of Ephemeral Zustand Records */}
        <div className="space-y-3 pt-4 border-t border-border/70">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-foreground/75 uppercase tracking-wider">
                2. Live In-Memory Records View
              </span>
              <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                {records.length} records in memory
              </span>
            </div>

            {/* Filter pills */}
            <div className="flex flex-wrap items-center gap-1.5 text-xs">
              {['all', 'engineering', 'design', 'marketing', 'support', 'operations', 'product'].map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setSelectedCat(cat)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium capitalize transition-colors ${
                    selectedCat === cat
                      ? 'bg-primary text-primary-foreground font-semibold shadow-xs'
                      : 'bg-muted/70 text-foreground/70 hover:bg-muted'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* Search bar */}
          <div className="relative">
            <IconSearch size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-foreground/40" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Filter by title, content, or record ID..."
              className="pl-9 text-xs"
            />
          </div>

          {/* Table Container */}
          <div className="border border-border/80 rounded-2xl overflow-hidden bg-card/60 backdrop-blur-sm max-h-[340px] overflow-y-auto">
            {filteredRecords.length === 0 ? (
              <div className="p-8 text-center space-y-2">
                <p className="text-xs text-foreground/50">No records match your criteria.</p>
                <Button size="sm" variant="secondary" onClick={resetToDefault}>
                  Reset to Default
                </Button>
              </div>
            ) : (
              <table className="w-full text-left text-xs">
                <thead className="sticky top-0 bg-muted/90 backdrop-blur-md border-b border-border/80 text-[11px] font-mono uppercase tracking-wider text-foreground/60 z-10">
                  <tr>
                    <th className="py-2.5 px-3">ID</th>
                    <th className="py-2.5 px-3">Category</th>
                    <th className="py-2.5 px-3">Title</th>
                    <th className="py-2.5 px-3 hidden md:table-cell">Content Snippet</th>
                    <th className="py-2.5 px-3">Created</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {filteredRecords.map((rec) => (
                    <tr key={rec.id} className="hover:bg-muted/40 transition-colors">
                      <td className="py-2.5 px-3 font-mono text-foreground/50 text-[11px] whitespace-nowrap">
                        {rec.id}
                      </td>
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <Badge variant={CATEGORY_COLORS[rec.category] || 'default'} size="sm" className="capitalize">
                          {rec.category}
                        </Badge>
                      </td>
                      <td className="py-2.5 px-3 font-medium text-foreground max-w-[200px] truncate">
                        {rec.title}
                      </td>
                      <td className="py-2.5 px-3 text-foreground/60 max-w-[300px] truncate hidden md:table-cell">
                        {rec.content}
                      </td>
                      <td className="py-2.5 px-3 font-mono text-foreground/50 text-[11px] whitespace-nowrap">
                        {rec.createdAt}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Modal footer */}
        <div className="flex items-center justify-between pt-3 border-t border-border/60">
          <span className="text-[11px] text-foreground/50 font-mono">
            All data stored in ephemeral browser session memory.
          </span>
          <Button variant="secondary" onClick={onClose} size="sm">
            Close
          </Button>
        </div>
      </div>
    </Modal>
  );
}
