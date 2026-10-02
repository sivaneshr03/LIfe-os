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
  IconPlus,
  IconEdit,
  IconCheck,
} from '../ui/Icons';
import { downloadMockCsvFile, type LocalRecordCategory, type LocalRecord } from '../../utils/mockData';
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
  const {
    records,
    clear,
    resetToDefault,
    addRecord,
    updateRecord,
    deleteRecord,
    sessionMutations,
  } = useLocalRecordStore();

  // Search & Filter State
  const [search, setSearch] = useState('');
  const [selectedCat, setSelectedCat] = useState<string>('all');

  // View Mode & Pagination State
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('table');
  const [currentPage, setCurrentPage] = useState(1);

  // Import Modal State
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);

  // Create & Edit Modal State
  const [isEntryModalOpen, setIsEntryModalOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<LocalRecord | null>(null);
  const [formTitle, setFormTitle] = useState('');
  const [formCategory, setFormCategory] = useState<LocalRecordCategory>('engineering');
  const [formContent, setFormContent] = useState('');

  // CSV Import mutation pipeline
  const { importCsvAsync } = useImportCsv({
    isLocalDev: true,
    onSuccess: (res) => {
      addToast(`Successfully imported ${res.count} records into browser memory!`, 'success');
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

  // Pagination calculations
  const totalPages = Math.max(1, Math.ceil(filteredRecords.length / PAGE_SIZE));
  const safePage = Math.min(Math.max(1, currentPage), totalPages);
  const paginatedRecords = useMemo(() => {
    const startIdx = (safePage - 1) * PAGE_SIZE;
    return filteredRecords.slice(startIdx, startIdx + PAGE_SIZE);
  }, [filteredRecords, safePage]);

  // ─── Dynamic Reactive Summary Metrics ───
  const totalCount = records.length;
  const matchCount = filteredRecords.length;
  const matchPercentage = totalCount > 0 ? Math.round((matchCount / totalCount) * 100) : 0;
  const hasActiveFilters = selectedCat !== 'all' || search.trim() !== '';

  const topCategory = useMemo(() => {
    let topCat: LocalRecordCategory = 'engineering';
    let max = -1;
    for (const [cat, cnt] of Object.entries(categoryCounts)) {
      if (cat !== 'all' && cnt > max) {
        max = cnt;
        topCat = cat as LocalRecordCategory;
      }
    }
    return { name: topCat, count: Math.max(0, max) };
  }, [categoryCounts]);

  const activeCategoryPercentage = totalCount > 0 ? Math.round((topCategory.count / totalCount) * 100) : 0;
  const totalOps =
    (sessionMutations?.created || 0) +
    (sessionMutations?.updated || 0) +
    (sessionMutations?.deleted || 0);

  // Modal Handlers
  const handleOpenCreateModal = () => {
    setEditingRecord(null);
    setFormTitle('');
    setFormCategory('engineering');
    setFormContent('');
    setIsEntryModalOpen(true);
  };

  const handleOpenEditModal = (rec: LocalRecord) => {
    setEditingRecord(rec);
    setFormTitle(rec.title);
    setFormCategory(rec.category);
    setFormContent(rec.content);
    setIsEntryModalOpen(true);
  };

  const handleSaveEntry = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim() || !formContent.trim()) {
      addToast('Title and content are required', 'error');
      return;
    }

    if (editingRecord) {
      updateRecord(editingRecord.id, {
        title: formTitle.trim(),
        category: formCategory,
        content: formContent.trim(),
      });
      addToast(`Updated record "${formTitle.trim()}"`, 'success');
    } else {
      const newRec: LocalRecord = {
        id: `rec_${Date.now()}`,
        title: formTitle.trim(),
        category: formCategory,
        content: formContent.trim(),
        createdAt: new Date().toISOString().slice(0, 10),
      };
      addRecord(newRec);
      addToast(`Created record "${formTitle.trim()}"`, 'success');
    }
    setIsEntryModalOpen(false);
  };

  const handleDeleteEntry = (rec: LocalRecord) => {
    deleteRecord(rec.id);
    addToast(`Deleted record "${rec.title}"`, 'info');
  };

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
          {/* New Entry Action Button */}
          <Button
            onClick={handleOpenCreateModal}
            variant="outline"
            size="sm"
            className="font-bold shadow-xs flex items-center gap-1.5"
          >
            <IconPlus size={14} />
            <span>New Entry</span>
          </Button>

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
        {/* KPI 1: Total Records Count */}
        <KpiCard
          title="Total Records"
          value={totalCount}
          subtitle="In-memory browser session"
          color="primary"
          className="p-3.5 sm:p-3.5"
          trend={{ value: `${totalCount} items`, isPositive: true }}
        />

        {/* KPI 2: Active Filters Match */}
        <KpiCard
          title="Active Filters Match"
          value={`${matchCount} Items`}
          subtitle={
            hasActiveFilters
              ? `Filtered: ${selectedCat !== 'all' ? selectedCat : 'query'} (${matchPercentage}%)`
              : 'All entries currently match'
          }
          color="indigo"
          className="p-3.5 sm:p-3.5"
          trend={{
            value: `${matchPercentage}%`,
            isPositive: matchCount > 0,
            label: 'match rate',
          }}
        />

        {/* KPI 3: Category Weight & Variance */}
        <KpiCard
          title="Top Domain Share"
          value={`${topCategory.name.toUpperCase()} (${topCategory.count})`}
          subtitle={`${Object.keys(categoryCounts).length - 1} categories active`}
          color="violet"
          className="p-3.5 sm:p-3.5"
          progressBar={{ value: activeCategoryPercentage }}
        />

        {/* KPI 4: Live Real-Time Mutations */}
        <KpiCard
          title="Real-Time Sync Ops"
          value={`${totalOps} Operations`}
          subtitle={`+${sessionMutations.created} Add • ~${sessionMutations.updated} Edit • -${sessionMutations.deleted} Del`}
          color="emerald"
          className="p-3.5 sm:p-3.5"
          trend={{
            value: totalOps > 0 ? 'Live Sync' : 'Ready',
            isPositive: true,
          }}
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
                      <th className="py-2.5 px-3.5 text-right">Actions</th>
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
                        <td className="py-2.5 px-3.5 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              type="button"
                              onClick={() => handleOpenEditModal(rec)}
                              className="p-1 rounded-lg text-foreground/60 hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
                              title="Edit record"
                              aria-label={`Edit ${rec.title}`}
                            >
                              <IconEdit size={13} />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteEntry(rec)}
                              className="p-1 rounded-lg text-rose-500/70 hover:text-rose-600 hover:bg-rose-500/10 transition-colors cursor-pointer"
                              title="Delete record"
                              aria-label={`Delete ${rec.title}`}
                            >
                              <IconTrash size={13} />
                            </button>
                          </div>
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
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => handleOpenEditModal(rec)}
                        className="p-1 rounded-lg text-foreground/60 hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
                        title="Edit record"
                        aria-label={`Edit ${rec.title}`}
                      >
                        <IconEdit size={12} />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteEntry(rec)}
                        className="p-1 rounded-lg text-rose-500/70 hover:text-rose-600 hover:bg-rose-500/10 transition-colors cursor-pointer"
                        title="Delete record"
                        aria-label={`Delete ${rec.title}`}
                      >
                        <IconTrash size={12} />
                      </button>
                    </div>
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

      {/* Create / Edit Record Modal */}
      <Modal
        isOpen={isEntryModalOpen}
        onClose={() => setIsEntryModalOpen(false)}
        title={editingRecord ? 'Edit In-Memory Record' : 'Create New In-Memory Record'}
        description="Immediately updates active entity state and syncs 2x2 KPI metrics in real-time."
        size="md"
      >
        <form onSubmit={handleSaveEntry} className="space-y-4 pt-1">
          <div>
            <label className="block text-xs font-semibold text-foreground/80 mb-1">
              Title
            </label>
            <Input
              value={formTitle}
              onChange={(e) => setFormTitle(e.target.value)}
              placeholder="e.g. Optimize KV Session Cache Latency"
              required
              className="text-xs"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-foreground/80 mb-1">
              Category
            </label>
            <select
              value={formCategory}
              onChange={(e) => setFormCategory(e.target.value as LocalRecordCategory)}
              className="w-full px-3 py-2 rounded-xl text-xs bg-muted/50 border border-border/80 text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="engineering">Engineering</option>
              <option value="design">Design</option>
              <option value="marketing">Marketing</option>
              <option value="support">Support</option>
              <option value="operations">Operations</option>
              <option value="product">Product</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-foreground/80 mb-1">
              Content & Specs
            </label>
            <textarea
              value={formContent}
              onChange={(e) => setFormContent(e.target.value)}
              placeholder="Enter comprehensive implementation details or description..."
              rows={3}
              required
              className="w-full px-3 py-2 rounded-xl text-xs bg-muted/50 border border-border/80 text-foreground focus:outline-none focus:ring-1 focus:ring-primary resize-none"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-border/60">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => setIsEntryModalOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" variant="primary" size="sm">
              {editingRecord ? 'Save Changes' : 'Create Record'}
            </Button>
          </div>
        </form>
      </Modal>

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
