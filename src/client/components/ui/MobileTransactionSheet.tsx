/**
 * MobileTransactionSheet.tsx
 *
 * Mobile-first bottom sheet for category selection inside the transaction flow:
 *  - 2×2 KPI compact metric bar (Today Spend, Category Spend, Balance, Budget %)
 *  - Horizontal primary-category tab scroller (thumb zone, 52px touch targets)
 *  - 3-column subcategory emoji grid — auto-dismisses sheet on tap
 *  - Inline +Add / ✏ Edit triggers directly in the header bar
 *  - Zero-lag optimistic selection via immediate state update
 *  - createPortal to document.body @ z-[70] — always above transaction modal
 *  - CSS safe-area-inset-bottom for notched phones
 */

import React, {
  useState,
  useEffect,
  useMemo,
  useCallback,
  useRef,
  memo,
} from 'react';
import { createPortal } from 'react-dom';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import type { CategoryData } from '../../shared/platformTypes';
import {
  IconX,
  IconPlus,
  IconEdit,
  IconCheck,
  IconTrash,
  IconChevronLeft,
  IconSearch,
} from './Icons';
import { formatMoney } from '../../../shared/utils/money';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface KPIData {
  todaySpentCents: number;
  categorySpendCents: number;
  accountBalanceCents: number;
  budgetUsedPercent: number;
  currency?: string;
}

export interface MobileTransactionSheetProps {
  isOpen: boolean;
  onClose: () => void;
  selectedCategoryId?: string | null;
  onSelectCategory: (category: CategoryData) => void;
  categories: CategoryData[];
  onCategoriesChange?: () => void;
  kpi?: KPIData;
  domain?: string;
}

// ─── Common assets ────────────────────────────────────────────────────────────

const QUICK_EMOJIS = [
  '🌮','🍳','🥗','🍲','☕','🍔','🍕','🛒','🏠','⚡',
  '🚗','⛽','💊','🏋️','🛍️','📺','📱','✈️','🎮','💵',
  '💼','💻','📈','🎁','🎓','❤️','✨','🔧','🐾','🧘',
];
const PRESET_COLORS = [
  '#10b981','#3b82f6','#f59e0b','#ec4899',
  '#8b5cf6','#ef4444','#06b6d4','#64748b',
];

// ─── KPI Card ─────────────────────────────────────────────────────────────────

const KpiCard = memo(function KpiCard({
  label,
  value,
  accent = 'default',
}: {
  label: string;
  value: string;
  accent?: 'default' | 'green' | 'red' | 'blue';
}) {
  const valueColor = {
    default: 'text-foreground',
    green: 'text-emerald-500',
    red: 'text-rose-500',
    blue: 'text-primary',
  }[accent];
  return (
    <div className="flex flex-col gap-0.5 px-3 py-2.5 bg-muted/40 border border-border/60 rounded-2xl min-w-0">
      <span className="text-[9px] font-mono font-bold uppercase tracking-widest text-foreground/40 truncate leading-none">
        {label}
      </span>
      <span className={twMerge('text-sm font-mono font-extrabold tracking-tight leading-snug truncate', valueColor)}>
        {value}
      </span>
    </div>
  );
});

// ─── Subcategory Tile (3-col grid) ────────────────────────────────────────────

const SubTile = memo(function SubTile({
  sub,
  parentColor,
  isSelected,
  onSelect,
  onEdit,
}: {
  sub: CategoryData;
  parentColor?: string | null;
  isSelected: boolean;
  onSelect: () => void;
  onEdit: (e: React.MouseEvent) => void;
}) {
  const tileColor = sub.color || parentColor || '#10b981';
  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={`Select ${sub.name}`}
      onKeyDown={(e) => e.key === 'Enter' && onSelect()}
      onClick={onSelect}
      className={twMerge(
        clsx(
          'group relative flex flex-col items-center justify-center gap-1',
          'rounded-2xl border text-center cursor-pointer touch-manipulation select-none',
          'transition-all duration-100 active:scale-[0.95] min-h-[80px] p-2',
          isSelected
            ? 'bg-primary/10 border-primary ring-2 ring-primary/25 shadow-sm'
            : 'bg-card hover:bg-muted/50 border-border/70'
        )
      )}
    >
      <button
        type="button"
        onClick={onEdit}
        aria-label={`Edit ${sub.name}`}
        className="absolute top-1.5 right-1.5 p-1 text-foreground/30 hover:text-foreground hover:bg-muted/80 rounded-lg min-h-[28px] min-w-[28px] flex items-center justify-center opacity-0 group-hover:opacity-100 touch-manipulation transition-opacity"
      >
        <IconEdit size={11} />
      </button>
      <div
        className="w-10 h-10 rounded-xl flex items-center justify-center text-lg shadow-sm"
        style={{ backgroundColor: `${tileColor}20` }}
      >
        {sub.icon || '🏷️'}
      </div>
      <span className="text-[10px] font-bold text-foreground line-clamp-2 px-0.5 leading-tight">
        {sub.name}
      </span>
      {isSelected && (
        <div className="absolute top-1.5 left-1.5 w-4 h-4 rounded-full bg-primary flex items-center justify-center">
          <IconCheck size={9} className="text-primary-foreground" />
        </div>
      )}
    </div>
  );
});

// ─── Primary Category Tab Pill ────────────────────────────────────────────────

const CategoryTab = memo(function CategoryTab({
  cat,
  isActive,
  isSelected,
  onClick,
}: {
  cat: CategoryData;
  isActive: boolean;
  isSelected: boolean;
  onClick: () => void;
}) {
  const subCount = cat.subcategories?.length ?? 0;
  return (
    <button
      type="button"
      onClick={onClick}
      className={twMerge(
        clsx(
          'flex items-center gap-2 px-3.5 py-2.5 rounded-2xl border text-left',
          'transition-all duration-100 touch-manipulation cursor-pointer shrink-0',
          'min-h-[52px] min-w-[110px] select-none',
          isActive
            ? 'bg-primary/10 border-primary shadow-sm'
            : isSelected
            ? 'bg-primary/5 border-primary/40'
            : 'bg-card border-border/70 hover:bg-muted/40'
        )
      )}
    >
      <span
        className="w-8 h-8 rounded-xl flex items-center justify-center text-base shrink-0"
        style={{
          backgroundColor: cat.color ? `${cat.color}20` : 'rgba(16,185,129,0.15)',
        }}
      >
        {cat.icon || '🏷️'}
      </span>
      <div className="min-w-0 flex-1">
        <p className={twMerge('text-xs font-extrabold truncate leading-tight', isActive ? 'text-primary' : 'text-foreground')}>
          {cat.name}
        </p>
        {subCount > 0 && (
          <p className="text-[9px] font-mono text-foreground/40 leading-none mt-0.5">{subCount} sub</p>
        )}
      </div>
    </button>
  );
});

// ─── Inline Editor Panel ──────────────────────────────────────────────────────

function EditorPanel({
  mode,
  parentId,
  editTarget,
  domain,
  onSaved,
  onClose,
}: {
  mode: 'create' | 'edit';
  parentId: string | null;
  editTarget: CategoryData | null;
  domain: string;
  onSaved: () => void;
  onClose: () => void;
}) {
  const [name, setName] = useState(editTarget?.name ?? '');
  const [icon, setIcon] = useState(editTarget?.icon ?? '🌮');
  const [color, setColor] = useState(editTarget?.color ?? '#10b981');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const t = setTimeout(() => inputRef.current?.focus(), 120);
    return () => clearTimeout(t);
  }, []);

  const save = async () => {
    if (!name.trim()) { setError('Name is required'); return; }
    try {
      setSaving(true); setError('');
      if (mode === 'edit' && editTarget) {
        const res = await fetch(`/api/categories/${editTarget.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: name.trim(), icon, color }),
        });
        if (!res.ok) throw new Error('Update failed');
      } else {
        const res = await fetch('/api/categories', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ domain, name: name.trim(), parentId, icon, color }),
        });
        if (!res.ok) throw new Error('Create failed');
      }
      onSaved();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error');
    } finally { setSaving(false); }
  };

  const del = async () => {
    if (!editTarget || !window.confirm(`Delete "${editTarget.name}"?`)) return;
    try {
      setSaving(true);
      await fetch(`/api/categories/${editTarget.id}`, { method: 'DELETE' });
      onSaved();
    } catch { setError('Delete failed'); setSaving(false); }
  };

  return (
    <div className="flex flex-col gap-3 px-4 pt-3 pb-[calc(1.25rem+env(safe-area-inset-bottom,0px))]">
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold text-foreground">
          {mode === 'edit'
            ? `Edit ${editTarget?.parentId ? 'Subcategory' : 'Category'}`
            : `New ${parentId ? 'Subcategory' : 'Category'}`}
        </span>
        <button type="button" onClick={onClose}
          className="p-1.5 text-foreground/50 hover:text-foreground rounded-lg min-h-[36px] min-w-[36px] flex items-center justify-center touch-manipulation cursor-pointer">
          <IconX size={15} />
        </button>
      </div>

      {error && (
        <div className="px-3 py-2 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-500 text-xs font-medium">
          {error}
        </div>
      )}

      <input
        ref={inputRef}
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder={parentId ? 'e.g. Breakfast, Coffee...' : 'e.g. Food, Housing...'}
        className="w-full px-3.5 py-3 text-base min-h-[48px] bg-muted/30 border border-border/80 rounded-xl text-foreground placeholder:text-foreground/40 focus:outline-none focus:ring-2 focus:ring-primary touch-manipulation"
      />

      <div>
        <div className="flex items-center gap-2 mb-2">
          <input type="text" value={icon} onChange={(e) => setIcon(e.target.value)} maxLength={8}
            className="w-14 h-12 text-center text-xl bg-muted/40 border border-border/80 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary touch-manipulation" />
          <span className="text-[10px] text-foreground/50">Tap chip or type emoji</span>
        </div>
        <div className="flex flex-wrap gap-1.5 max-h-[84px] overflow-y-auto p-1.5 bg-muted/20 border border-border/60 rounded-xl no-scrollbar">
          {QUICK_EMOJIS.map((em) => (
            <button key={em} type="button" onClick={() => setIcon(em)}
              className={twMerge(clsx(
                'w-8 h-8 rounded-lg flex items-center justify-center text-base transition-colors touch-manipulation cursor-pointer',
                icon === em ? 'bg-primary/20 ring-1 ring-primary' : 'bg-transparent hover:bg-card'
              ))}>
              {em}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        {PRESET_COLORS.map((c) => (
          <button key={c} type="button" onClick={() => setColor(c)}
            style={{ backgroundColor: c }}
            className={twMerge(clsx(
              'w-8 h-8 rounded-full transition-transform touch-manipulation cursor-pointer',
              color === c ? 'ring-2 ring-offset-2 ring-foreground scale-110' : 'opacity-70 hover:opacity-100'
            ))} />
        ))}
      </div>

      <div className="flex items-center gap-2 pt-1 border-t border-border/60">
        {mode === 'edit' && (
          <button type="button" onClick={del} disabled={saving}
            className="flex items-center gap-1.5 px-3 py-2.5 text-xs font-semibold text-rose-500 hover:bg-rose-500/10 rounded-xl transition-colors touch-manipulation cursor-pointer min-h-[44px]">
            <IconTrash size={13} /> Delete
          </button>
        )}
        <div className="flex items-center gap-2 ml-auto">
          <button type="button" onClick={onClose} disabled={saving}
            className="px-3 py-2.5 text-xs font-semibold text-foreground/70 hover:bg-muted/80 rounded-xl transition-colors touch-manipulation cursor-pointer min-h-[44px]">
            Cancel
          </button>
          <button type="button" onClick={save} disabled={saving}
            className="px-5 py-2.5 text-xs font-bold bg-primary text-primary-foreground rounded-xl shadow-sm hover:bg-primary/90 transition-all touch-manipulation cursor-pointer min-h-[44px]">
            {saving ? 'Saving...' : mode === 'edit' ? 'Update' : 'Create'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Sheet Component ─────────────────────────────────────────────────────

export function MobileTransactionSheet({
  isOpen,
  onClose,
  selectedCategoryId,
  onSelectCategory,
  categories,
  onCategoriesChange,
  kpi,
  domain = 'finance',
}: MobileTransactionSheetProps) {
  const [mounted, setMounted] = useState(false);
  const [activeCatId, setActiveCatId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [editorState, setEditorState] = useState<{
    mode: 'create' | 'edit';
    parentId: string | null;
    target: CategoryData | null;
  } | null>(null);

  const tabBarRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setMounted(true); }, []);

  // Pre-select active parent on open
  useEffect(() => {
    if (!isOpen) return;
    setSearchQuery(''); setEditorState(null);
    if (selectedCategoryId) {
      for (const cat of categories) {
        if (cat.id === selectedCategoryId) { setActiveCatId(cat.id); return; }
        if (cat.subcategories?.some((s) => s.id === selectedCategoryId)) {
          setActiveCatId(cat.id); return;
        }
      }
    }
    setActiveCatId(null);
  }, [isOpen, selectedCategoryId, categories]);

  // Scroll active tab into view
  useEffect(() => {
    if (!activeCatId || !tabBarRef.current) return;
    const el = tabBarRef.current.querySelector<HTMLElement>(`[data-catid="${activeCatId}"]`);
    el?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
  }, [activeCatId]);

  // Flat list for search
  type FlatCat = CategoryData & { parentName?: string; parentIcon?: string | null };
  const flatAll = useMemo<FlatCat[]>(() => {
    const out: FlatCat[] = [];
    for (const cat of categories) {
      out.push(cat);
      for (const sub of cat.subcategories ?? []) {
        out.push({ ...sub, parentName: cat.name, parentIcon: cat.icon });
      }
    }
    return out;
  }, [categories]);

  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return null;
    const q = searchQuery.toLowerCase();
    return flatAll.filter(
      (c) => c.name.toLowerCase().includes(q) || (c.parentName?.toLowerCase().includes(q) ?? false)
    );
  }, [searchQuery, flatAll]);

  const activeCat = useMemo(
    () => categories.find((c) => c.id === activeCatId) ?? null,
    [categories, activeCatId]
  );

  const handleEditorSaved = useCallback(() => {
    setEditorState(null);
    onCategoriesChange?.();
  }, [onCategoriesChange]);

  const handleSelectCategory = useCallback(
    (cat: CategoryData) => { onSelectCategory(cat); onClose(); },
    [onSelectCategory, onClose]
  );

  if (!mounted || typeof document === 'undefined' || !isOpen) return null;

  const cur = kpi?.currency ?? 'INR';

  const content = (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Category Selection"
      className="fixed inset-0 z-[70] flex flex-col justify-end sm:items-center sm:justify-center p-0 sm:p-6"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/55 backdrop-blur-sm animate-fade-in"
        aria-hidden="true"
        onClick={onClose}
      />

      {/* Sheet panel */}
      <div
        className={twMerge(clsx(
          'relative z-10 w-full sm:max-w-lg flex flex-col',
          'bg-card border-t sm:border border-border/80',
          'rounded-t-3xl sm:rounded-3xl',
          'max-h-[92dvh] sm:max-h-[88vh]',
          'shadow-[0_-12px_48px_-8px_rgba(0,0,0,0.35)]',
          'animate-slide-up sm:animate-scale-in',
        ))}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drag handle — mobile only */}
        <div className="flex justify-center pt-3 pb-1 sm:hidden shrink-0" aria-hidden="true">
          <div className="w-10 h-1 rounded-full bg-foreground/20" />
        </div>

        {/* ── 2×2 KPI compact grid ─────────────────────────────────── */}
        {kpi && (
          <div className="grid grid-cols-2 gap-2 px-4 pt-2 pb-3 shrink-0">
            <KpiCard label="Today's Spend"  value={formatMoney(kpi.todaySpentCents, cur)} accent="red" />
            <KpiCard label="Cat. Spend"     value={activeCat ? formatMoney(kpi.categorySpendCents, cur) : '—'} accent="blue" />
            <KpiCard label="Balance"        value={formatMoney(kpi.accountBalanceCents, cur)} accent="green" />
            <KpiCard label="Budget Used"    value={`${Math.min(kpi.budgetUsedPercent, 999)}%`}
              accent={kpi.budgetUsedPercent > 100 ? 'red' : 'default'} />
          </div>
        )}

        {/* ── Sheet header bar ─────────────────────────────────────── */}
        <div className="flex items-center justify-between px-4 pt-1 pb-2.5 border-b border-border/60 shrink-0">
          <div className="flex items-center gap-1.5 min-w-0">
            {activeCat && !searchQuery && !editorState && (
              <button type="button"
                onClick={() => { setActiveCatId(null); setEditorState(null); }}
                className="p-1.5 -ml-1.5 text-foreground/60 hover:text-foreground hover:bg-muted/60 rounded-xl min-h-[40px] min-w-[40px] flex items-center justify-center touch-manipulation cursor-pointer"
                aria-label="Back">
                <IconChevronLeft size={18} />
              </button>
            )}
            <div className="min-w-0">
              <h2 className="text-sm font-extrabold text-foreground tracking-tight truncate leading-tight">
                {editorState
                  ? (editorState.mode === 'create' ? (editorState.parentId ? 'New Subcategory' : 'New Category') : 'Edit Category')
                  : searchQuery ? 'Search Results'
                  : activeCat ? activeCat.name
                  : 'Choose Category'}
              </h2>
              {!editorState && (
                <p className="text-[10px] text-foreground/45 leading-tight mt-0.5">
                  {activeCat
                    ? `${activeCat.subcategories?.length ?? 0} subcategories · tap to select`
                    : 'Scroll & tap a category'}
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            {!editorState && (
              <button type="button"
                onClick={() => setEditorState({ mode: 'create', parentId: activeCatId, target: null })}
                aria-label={activeCat ? 'Add subcategory' : 'Add category'}
                className="p-2 text-foreground/60 hover:text-primary hover:bg-primary/10 rounded-xl min-h-[40px] min-w-[40px] flex items-center justify-center transition-colors touch-manipulation cursor-pointer">
                <IconPlus size={16} />
              </button>
            )}
            {!editorState && activeCat && (
              <button type="button"
                onClick={() => setEditorState({ mode: 'edit', parentId: activeCat.parentId ?? null, target: activeCat })}
                aria-label="Edit category"
                className="p-2 text-foreground/60 hover:text-foreground hover:bg-muted/60 rounded-xl min-h-[40px] min-w-[40px] flex items-center justify-center transition-colors touch-manipulation cursor-pointer">
                <IconEdit size={15} />
              </button>
            )}
            <button type="button" onClick={onClose} aria-label="Close"
              className="p-2 text-foreground/50 hover:text-foreground hover:bg-muted/60 rounded-xl min-h-[40px] min-w-[40px] flex items-center justify-center transition-colors touch-manipulation cursor-pointer">
              <IconX size={16} />
            </button>
          </div>
        </div>

        {/* ── Inline editor replaces grid ──────────────────────────── */}
        {editorState ? (
          <div className="flex-1 overflow-y-auto overscroll-contain">
            <EditorPanel
              mode={editorState.mode}
              parentId={editorState.parentId}
              editTarget={editorState.target}
              domain={domain}
              onSaved={handleEditorSaved}
              onClose={() => setEditorState(null)}
            />
          </div>
        ) : (
          <>
            {/* ── Search bar ───────────────────────────────────────── */}
            <div className="px-4 py-2.5 border-b border-border/50 shrink-0">
              <div className="relative flex items-center">
                <IconSearch size={14} className="absolute left-3 text-foreground/40 pointer-events-none" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search categories..."
                  className="w-full pl-8 pr-7 py-2.5 text-base min-h-[44px] bg-muted/30 border border-border/70 rounded-xl text-foreground placeholder:text-foreground/40 focus:outline-none focus:ring-2 focus:ring-primary touch-manipulation"
                />
                {searchQuery && (
                  <button type="button" onClick={() => setSearchQuery('')}
                    className="absolute right-2.5 p-1 text-foreground/40 hover:text-foreground rounded-md touch-manipulation"
                    aria-label="Clear">
                    <IconX size={13} />
                  </button>
                )}
              </div>
            </div>

            {/* ── Search results ───────────────────────────────────── */}
            {searchResults ? (
              <div className="flex-1 overflow-y-auto overscroll-contain p-4 space-y-1.5 pb-[calc(1rem+env(safe-area-inset-bottom,0px))]">
                {searchResults.length === 0 ? (
                  <div className="py-10 text-center text-xs text-foreground/50">
                    No results for "{searchQuery}"
                  </div>
                ) : (
                  searchResults.map((cat) => {
                    const isSelected = selectedCategoryId === cat.id;
                    return (
                      <button key={cat.id} type="button" onClick={() => handleSelectCategory(cat)}
                        className={twMerge(clsx(
                          'w-full flex items-center justify-between px-3.5 py-3 rounded-2xl border text-left',
                          'transition-all duration-100 touch-manipulation cursor-pointer min-h-[52px]',
                          isSelected
                            ? 'bg-primary/10 border-primary text-primary font-bold'
                            : 'bg-card hover:bg-muted/40 border-border/70 text-foreground'
                        ))}>
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-9 h-9 rounded-xl flex items-center justify-center text-lg shrink-0"
                            style={{ backgroundColor: cat.color ? `${cat.color}20` : 'rgba(16,185,129,0.12)' }}>
                            {cat.icon || '🏷️'}
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-semibold truncate leading-tight">{cat.name}</p>
                            {cat.parentName && (
                              <p className="text-[10px] text-foreground/50 truncate mt-0.5">
                                {cat.parentIcon ? `${cat.parentIcon} ` : ''}{cat.parentName}
                              </p>
                            )}
                          </div>
                        </div>
                        {isSelected && <IconCheck size={16} className="text-primary shrink-0" />}
                      </button>
                    );
                  })
                )}
              </div>

            ) : activeCat ? (
              /* ── 3-column subcategory grid ──────────────────────── */
              <div className="flex-1 overflow-y-auto overscroll-contain p-4 pb-[calc(1rem+env(safe-area-inset-bottom,0px))]">
                {/* Use-parent-as-top-level row */}
                <button type="button" onClick={() => handleSelectCategory(activeCat)}
                  className={twMerge(clsx(
                    'w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl border mb-3 text-left',
                    'transition-all duration-100 touch-manipulation cursor-pointer min-h-[48px]',
                    selectedCategoryId === activeCat.id
                      ? 'bg-primary/10 border-primary text-primary'
                      : 'bg-muted/30 border-border/70 text-foreground hover:bg-muted/50'
                  ))}>
                  <span className="text-lg">{activeCat.icon || '🏷️'}</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold truncate">Entire {activeCat.name}</p>
                    <p className="text-[9px] text-foreground/50 leading-none mt-0.5">Select top-level</p>
                  </div>
                  {selectedCategoryId === activeCat.id && (
                    <IconCheck size={14} className="text-primary shrink-0 ml-auto" />
                  )}
                </button>

                <p className="text-[9px] font-mono font-bold uppercase tracking-widest text-foreground/40 mb-2.5">
                  Subcategories ({activeCat.subcategories?.length ?? 0})
                </p>

                <div className="grid grid-cols-3 gap-2">
                  {activeCat.subcategories?.map((sub) => (
                    <SubTile
                      key={sub.id}
                      sub={sub}
                      parentColor={activeCat.color}
                      isSelected={selectedCategoryId === sub.id}
                      onSelect={() => handleSelectCategory(sub)}
                      onEdit={(e) => {
                        e.stopPropagation();
                        setEditorState({ mode: 'edit', parentId: activeCat.id, target: sub });
                      }}
                    />
                  ))}
                  {/* Add subcategory tile */}
                  <button type="button"
                    onClick={() => setEditorState({ mode: 'create', parentId: activeCat.id, target: null })}
                    className="flex flex-col items-center justify-center gap-1 min-h-[80px] rounded-2xl border border-dashed border-border/80 hover:border-primary/50 bg-muted/10 hover:bg-primary/5 text-foreground/50 hover:text-primary transition-all duration-100 touch-manipulation cursor-pointer">
                    <div className="w-9 h-9 rounded-xl bg-muted/60 flex items-center justify-center">
                      <IconPlus size={16} />
                    </div>
                    <span className="text-[10px] font-semibold">Add</span>
                  </button>
                </div>
              </div>

            ) : (
              /* ── Primary category tab scroller + all-categories grid */
              <div className="flex-1 flex flex-col overflow-hidden">
                {/* Horizontal tab scroller */}
                <div
                  ref={tabBarRef}
                  className="flex gap-2 px-4 py-3 overflow-x-auto no-scrollbar border-b border-border/50 shrink-0"
                >
                  {categories.map((cat) => (
                    <div key={cat.id} data-catid={cat.id}>
                      <CategoryTab
                        cat={cat}
                        isActive={activeCatId === cat.id}
                        isSelected={
                          selectedCategoryId === cat.id ||
                          Boolean(cat.subcategories?.some((s) => s.id === selectedCategoryId))
                        }
                        onClick={() => {
                          setEditorState(null);
                          if ((cat.subcategories?.length ?? 0) > 0) {
                            setActiveCatId(cat.id);
                          } else {
                            handleSelectCategory(cat);
                          }
                        }}
                      />
                    </div>
                  ))}
                </div>

                {/* All-categories 2-col grid */}
                <div className="flex-1 overflow-y-auto overscroll-contain px-4 pt-3 pb-[calc(1rem+env(safe-area-inset-bottom,0px))]">
                  {categories.length === 0 ? (
                    <div className="py-12 text-center text-xs text-foreground/50">
                      <p>No categories yet.</p>
                      <button type="button"
                        onClick={() => setEditorState({ mode: 'create', parentId: null, target: null })}
                        className="mt-3 text-primary font-semibold hover:underline touch-manipulation cursor-pointer">
                        + Create your first category
                      </button>
                    </div>
                  ) : (
                    <>
                      <p className="text-[9px] font-mono font-bold uppercase tracking-widest text-foreground/30 mb-2.5">
                        All categories
                      </p>
                      <div className="grid grid-cols-2 gap-2">
                        {categories.map((cat) => {
                          const isSelected =
                            selectedCategoryId === cat.id ||
                            Boolean(cat.subcategories?.some((s) => s.id === selectedCategoryId));
                          const subCount = cat.subcategories?.length ?? 0;
                          const tileColor = cat.color || '#10b981';
                          return (
                            <button key={cat.id} type="button"
                              onClick={() => {
                                setEditorState(null);
                                if (subCount > 0) { setActiveCatId(cat.id); }
                                else { handleSelectCategory(cat); }
                              }}
                              className={twMerge(clsx(
                                'flex items-center gap-2.5 px-3 py-3 rounded-2xl border text-left',
                                'transition-all duration-100 touch-manipulation cursor-pointer min-h-[56px]',
                                isSelected
                                  ? 'bg-primary/10 border-primary shadow-sm'
                                  : 'bg-card hover:bg-muted/50 border-border/70'
                              ))}>
                              <span className="w-9 h-9 rounded-xl flex items-center justify-center text-lg shrink-0"
                                style={{ backgroundColor: `${tileColor}20` }}>
                                {cat.icon || '🏷️'}
                              </span>
                              <div className="min-w-0 flex-1">
                                <p className={clsx('text-xs font-extrabold truncate leading-tight', isSelected && 'text-primary')}>
                                  {cat.name}
                                </p>
                                {subCount > 0 && (
                                  <p className="text-[9px] text-foreground/40 font-mono mt-0.5">{subCount} sub</p>
                                )}
                              </div>
                              {isSelected && !subCount && (
                                <IconCheck size={14} className="text-primary ml-auto shrink-0" />
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );

  return createPortal(content, document.body);
}
