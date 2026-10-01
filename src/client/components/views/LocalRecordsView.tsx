import React, { useState, useMemo, useEffect } from 'react';
import { clsx } from 'clsx';
import { useLocalRecordStore } from '../../stores/useLocalRecordStore';
import { useImportCsv } from '../../hooks/useImportCsv';
import { CsvDropzone } from '../ui/CsvDropzone';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Badge } from '../ui/Badge';
import { Modal } from '../ui/Modal';
import { KpiCard } from '../ui/KpiCard';
import {
  IconSearch,
  IconTrash,
  IconRefresh,
  IconFileSpreadsheet,
  IconUploadCloud,
  IconLayoutGrid,
  IconTable,
  IconChevronLeft,
  IconChevronRight,
} from '../ui/Icons';
import { downloadMockCsvFile, type LocalRecordCategory } from '../../utils/mockData';
import { useToast } from '../ui/Toast';

const CATEGORY_COLORS: Record<LocalRecordCategory, 'indigo' | 'purple' | 'amber' | 'emerald' | 'cyan' | 'default'> = {
  engineering: 'indigo',
  design: 'purple',
  marketing: 'amber',
  support: 'emerald',
  operations: 'cyan',
  product: 'default',
};

const CATEGORIES: Array<{ id: string; label: string }> = [
  { id: 'all', label: 'All Records' },
  { id: 'engineering', label: 'Engineering' },
  { id: 'design', label: 'Design' },
  { id: 'marketing', label: 'Marketing' },
  { id: 'support', label: 'Support' },
  { id: 'operations', label: 'Operations' },
  { id: 'product', label: 'Product' },
];

const PAGE_SIZE = 6;

export function LocalRecordsView() {
  const { addToast } = useToast();
  const { records, clear, resetToDefault } = useLocalRecordStore();

  // Search & Filter State
  const [search, setSearch] = useState('');
  const [selectedCat, setSelectedCat] = useState<string>('all');

  // View Mode & Pagination State
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('table');
  const [currentPage, setCurrentPage] = useState(1);

  // Import Modal State
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);

  // CSV Import mutation pipeline
  const { importCsvAsync } = useImportCsv({
    isLocalDev: true,
    onSuccess: (res) => {
      addToast(`Successfully imported ${res.count} records into browser memory!`, 'success');
      // Auto-close modal upon successful zero-click import
      setTimeout(() => {
        setIsImportModalOpen(false);
      }, 350);
    },
  });

  // Calculate live category counts
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = { all: records.length };
    records.forEach((r) => {
      counts[r.category] = (counts[r.category] || 0) + 1;
    });
    return counts;
  }, [records]);

  // Filter records by search text and category
  const filteredRecords = useMemo(() => {
    return records.filter((r) => {
      const q = search.trim().toLowerCase();
      const matchesSearch =
        q === '' ||
        r.title.toLowerCase().includes(q) ||
        r.content.toLowerCase().includes(q) ||
        r.id.toLowerCase().includes(q);

      const matchesCat = selectedCat === 'all' || r.category === selectedCat;
      return matchesSearch && matchesCat;
    });
  }, [records, search, selectedCat]);

  // Reset to page 1 whenever filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [search, selectedCat]);

  // Pagination calculations (strictly limited to PAGE_SIZE items per page to prevent Y-scrolling)
  const totalPages = Math.max(1, Math.ceil(filteredRecords.length / PAGE_SIZE));
  const safePage = Math.min(Math.max(1, currentPage), totalPages);
  const paginatedRecords = useMemo(() => {
    const startIdx = (safePage - 1) * PAGE_SIZE;
    return filteredRecords.slice(startIdx, startIdx + PAGE_SIZE);
  }, [filteredRecords, safePage]);

  return (
    <div className="space-y-4 max-w-7xl mx-auto pb-6">
      {/* 1. View Header with Compact Actions Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-card/60 backdrop-blur-md p-3.5 sm:p-4 rounded-2xl border border-border/80 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-lg sm:text-xl font-black text-foreground tracking-tight">
              CSV Bulk Data & Records
            </h1>
            <span className="text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
              In-Memory Mode
            </span>
          </div>
          <p className="text-xs text-foreground/60 mt-0.5">
            Zero Cloudflare D1 writes • Client-side Papa.parse validation • Live browser state
          </p>
        </div>

        {/* Action Buttons Toolbar */}
        <div className="flex flex-wrap items-center gap-2">
          {/* REQUIREMENT 2: Compact Import CSV Action Button */}
          <Button
            onClick={() => setIsImportModalOpen(true)}
            variant="primary"
            size="sm"
            className="font-bold shadow-xs flex items-center gap-1.5"
          >
            <IconUploadCloud size={15} />
            <span>Import CSV</span>
          </Button>

          {/* Download Sample CSV */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              downloadMockCsvFile('sample_records_test.csv', 15);
              addToast('Downloaded sample CSV file for drop testing', 'info');
            }}
            title="Download Sample CSV for drop testing"
            className="flex items-center gap-1.5 text-foreground/70 hover:text-foreground"
          >
            <IconFileSpreadsheet size={15} />
            <span className="hidden md:inline">Sample CSV</span>
          </Button>

          {/* Reset to Default 60 */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              resetToDefault();
              addToast('Reset to default 60 mock records', 'info');
            }}
            title="Reset to initial 60 records"
            className="flex items-center gap-1 text-foreground/70 hover:text-foreground"
          >
            <IconRefresh size={14} />
            <span className="hidden md:inline">Reset</span>
          </Button>

          {/* Clear Store */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              clear();
              addToast('Cleared all in-memory records', 'info');
            }}
            title="Clear all records"
            className="text-rose-500 hover:text-rose-600 hover:bg-rose-500/10"
          >
            <IconTrash size={14} />
          </Button>
        </div>
      </div>

      {/* REQUIREMENT 1: Strict 2x2 KPI Cards Grid (Mobile/Tablet 2-col, Desktop 4-col, Compact p-3.5) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard
          title="Total Records"
          value={records.length}
          subtitle="In-memory browser session"
          color="primary"
          className="p-3.5 sm:p-3.5"
          trend={{ value: `${records.length} items`, isPositive: true }}
        />

        <KpiCard
          title="Engineering & Ops"
          value={(categoryCounts['engineering'] || 0) + (categoryCounts['operations'] || 0)}
          subtitle="System & architecture specs"
          color="indigo"
          className="p-3.5 sm:p-3.5"
        />

        <KpiCard
          title="Design & Product"
          value={(categoryCounts['design'] || 0) + (categoryCounts['product'] || 0)}
          subtitle="UI/UX & feature specs"
          color="violet"
          className="p-3.5 sm:p-3.5"
        />

        <KpiCard
          title="Database Writes"
          value="0 Writes"
          subtitle="Isolated from Cloudflare D1"
          color="emerald"
          className="p-3.5 sm:p-3.5"
        />
      </div>

      {/* REQUIREMENT 4: Horizontal Category Tabs (No Y-scroll) + Search & View Mode Switcher */}
      <div className="bg-card/75 backdrop-blur-md border border-border/80 rounded-2xl p-3 sm:p-4 shadow-xs space-y-3">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          {/* Horizontal Category Tabs / Filter Pill List (Scrollable horizontally on mobile, zero vertical overflow) */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
            {CATEGORIES.map((cat) => {
              const count = categoryCounts[cat.id] || 0;
              const isActive = selectedCat === cat.id;
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setSelectedCat(cat.id)}
                  className={clsx(
                    'px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all shrink-0 flex items-center gap-1.5 cursor-pointer touch-manipulation',
                    isActive
                      ? 'bg-primary text-primary-foreground shadow-xs'
                      : 'bg-muted/70 hover:bg-muted text-foreground/70 hover:text-foreground border border-border/50'
                  )}
                >
                  <span>{cat.label}</span>
                  <span
                    className={clsx(
                      'px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold',
                      isActive ? 'bg-primary-foreground/25 text-primary-foreground' : 'bg-card text-foreground/60'
                    )}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Right Toolbar: Search Input & REQUIREMENT 3: View Mode Segmented Control */}
          <div className="flex items-center gap-2 w-full lg:w-auto">
            {/* Search Input */}
            <div className="relative flex-1 lg:w-64">
              <IconSearch size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-foreground/40" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search records..."
                className="pl-9 h-8 text-xs bg-background/80"
              />
            </div>

            {/* REQUIREMENT 3: Segmented View Mode Toggle (Grid vs Table) */}
            <div className="flex items-center p-0.5 rounded-xl bg-muted/80 border border-border/60 shrink-0">
              <button
                type="button"
                onClick={() => setViewMode('table')}
                className={clsx(
                  'flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer touch-manipulation',
                  viewMode === 'table'
                    ? 'bg-card text-foreground shadow-xs font-bold'
                    : 'text-foreground/60 hover:text-foreground'
                )}
                title="Table View"
                aria-pressed={viewMode === 'table'}
              >
                <IconTable size={14} />
                <span className="hidden sm:inline">Table</span>
              </button>

              <button
                type="button"
                onClick={() => setViewMode('grid')}
                className={clsx(
                  'flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer touch-manipulation',
                  viewMode === 'grid'
                    ? 'bg-card text-foreground shadow-xs font-bold'
                    : 'text-foreground/60 hover:text-foreground'
                )}
                title="Grid View"
                aria-pressed={viewMode === 'grid'}
              >
                <IconLayoutGrid size={14} />
                <span className="hidden sm:inline">Grid</span>
              </button>
            </div>
          </div>
        </div>

        {/* Content Container (Grid vs Table) with Client-Side Pagination */}
        <div className="min-h-[290px] flex flex-col justify-between">
          {filteredRecords.length === 0 ? (
            <div className="p-10 text-center space-y-3 my-auto">
              <p className="text-xs sm:text-sm text-foreground/60 font-medium">
                No mock records found matching your filter criteria.
              </p>
              <div className="flex items-center justify-center gap-2">
                <Button size="sm" variant="secondary" onClick={resetToDefault}>
                  Reset to Default 60
                </Button>
              </div>
            </div>
          ) : viewMode === 'table' ? (
            /* TABLE VIEW */
            <div className="border border-border/80 rounded-xl overflow-hidden bg-card/60 backdrop-blur-md shadow-xs">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-muted/80 backdrop-blur-sm border-b border-border/80 text-[11px] font-mono uppercase tracking-wider text-foreground/60">
                    <tr>
                      <th className="py-2.5 px-3.5">ID</th>
                      <th className="py-2.5 px-3.5">Category</th>
                      <th className="py-2.5 px-3.5">Title</th>
                      <th className="py-2.5 px-3.5 hidden md:table-cell">Content / Summary</th>
                      <th className="py-2.5 px-3.5">Created</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/40">
                    {paginatedRecords.map((rec) => (
                      <tr key={rec.id} className="hover:bg-muted/30 transition-colors">
                        <td className="py-2.5 px-3.5 font-mono text-primary font-semibold text-[11px] whitespace-nowrap">
                          {rec.id}
                        </td>
                        <td className="py-2.5 px-3.5 whitespace-nowrap">
                          <Badge
                            variant={CATEGORY_COLORS[rec.category] || 'default'}
                            size="sm"
                            className="capitalize font-mono text-[10px]"
                          >
                            {rec.category}
                          </Badge>
                        </td>
                        <td className="py-2.5 px-3.5 font-semibold text-foreground max-w-[220px] truncate">
                          {rec.title}
                        </td>
                        <td className="py-2.5 px-3.5 text-foreground/65 max-w-[340px] truncate hidden md:table-cell">
                          {rec.content}
                        </td>
                        <td className="py-2.5 px-3.5 font-mono text-foreground/50 text-[11px] whitespace-nowrap">
                          {rec.createdAt}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            /* GRID VIEW */
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {paginatedRecords.map((rec) => (
                <div
                  key={rec.id}
                  className="p-3.5 rounded-xl border border-border/80 bg-card/70 hover:bg-card/95 hover:border-primary/40 transition-all duration-200 shadow-xs flex flex-col justify-between space-y-2.5 group"
                >
                  <div className="flex items-center justify-between text-[11px]">
                    <Badge
                      variant={CATEGORY_COLORS[rec.category] || 'default'}
                      size="sm"
                      className="capitalize font-mono text-[10px]"
                    >
                      {rec.category}
                    </Badge>
                    <span className="font-mono text-foreground/40 text-[10px]">{rec.createdAt}</span>
                  </div>

                  <div>
                    <h3 className="text-xs sm:text-sm font-bold text-foreground group-hover:text-primary transition-colors line-clamp-1">
                      {rec.title}
                    </h3>
                    <p className="text-[11px] text-foreground/65 line-clamp-2 mt-1 leading-relaxed">
                      {rec.content}
                    </p>
                  </div>

                  <div className="pt-2 border-t border-border/40 flex items-center justify-between text-[10px] font-mono text-foreground/50">
                    <span className="text-primary font-semibold">{rec.id}</span>
                    <span className="text-emerald-600 dark:text-emerald-400 font-medium">In-Memory</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* REQUIREMENT 4: Client-Side Pagination Bar (Zero Vertical Page Overflow) */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-border/60 text-xs">
            <div className="text-foreground/60 font-mono text-[11px]">
              Showing{' '}
              <span className="font-bold text-foreground">
                {filteredRecords.length === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1}
              </span>{' '}
              to{' '}
              <span className="font-bold text-foreground">
                {Math.min(safePage * PAGE_SIZE, filteredRecords.length)}
              </span>{' '}
              of <span className="font-bold text-foreground">{filteredRecords.length}</span> records
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={safePage <= 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                className="px-2.5 py-1 text-xs min-h-[32px] flex items-center gap-1"
              >
                <IconChevronLeft size={13} />
                <span>Prev</span>
              </Button>

              <span className="px-2 font-mono text-xs text-foreground/80 font-semibold select-none">
                Page {safePage} of {totalPages}
              </span>

              <Button
                variant="outline"
                size="sm"
                disabled={safePage >= totalPages}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                className="px-2.5 py-1 text-xs min-h-[32px] flex items-center gap-1"
              >
                <span>Next</span>
                <IconChevronRight size={13} />
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* REQUIREMENT 2: Animated Accessible Modal for Drag-and-Drop CSV Dropzone */}
      <Modal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        title="Import CSV Bulk Records"
        description="Drop your CSV file below. The system automatically parses rows client-side via Papa.parse and validates against our Zod schema with zero Cloudflare D1 writes."
        size="lg"
      >
        <div className="pt-1">
          <CsvDropzone
            mutationFn={async ({ csvText, file, rowCount }) => {
              return await importCsvAsync({ csvText, file, rowCount });
            }}
            queryKeyToInvalidate={['local-records']}
            processingMessage="Parsing CSV with Papa.parse and syncing to local in-memory store..."
            title="Drop CSV File Here for Instant In-Memory Import"
            description="Automatic zero-click upload. Modal will close automatically upon successful validation."
            expectedFormatHint="id, title, content, category (engineering, design, marketing, support, operations, product), createdAt"
          />

          <div className="mt-4 flex items-center justify-between pt-3 border-t border-border/60 text-xs">
            <button
              type="button"
              onClick={() => {
                downloadMockCsvFile('sample_lifeos_records.csv', 15);
                addToast('Downloaded test CSV for import verification', 'info');
              }}
              className="text-primary hover:underline font-medium flex items-center gap-1"
            >
              <IconFileSpreadsheet size={14} />
              <span>Need a test file? Download Sample CSV (15 rows)</span>
            </button>

            <Button
              variant="secondary"
              size="sm"
              onClick={() => setIsImportModalOpen(false)}
            >
              Cancel
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
