import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import type { CategoryData, CategoryDomain } from '../../../shared/types';
import {
  IconSearch,
  IconX,
  IconPlus,
  IconEdit,
  IconTrash,
  IconCheck,
  IconChevronRight,
  IconChevronLeft,
  IconChevronDown,
  IconFolder,
} from './Icons';

export interface CategoryPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedCategoryId?: string | null;
  onSelectCategory: (category: CategoryData) => void;
  domain?: CategoryDomain;
  title?: string;
  categories?: CategoryData[];
  onCategoriesChange?: () => void;
}

const COMMON_EMOJIS = [
  '🌮', '🍳', '🥗', '🍲', '☕', '🍔', '🍿', '🍕', '🍣', '🍩',
  '🍺', '🛒', '🏠', '⚡', '🔨', '🧻', '🚗', '⛽', '🚇', '🔧',
  '🅿️', '💊', '🩺', '🏋️', '🧘', '🛍️', '📺', '👕', '📱', '✈️',
  '🎮', '💵', '💼', '💻', '📈', '🎁', '🎓', '🐾', '❤️', '✨'
];

const PRESET_COLORS = [
  '#10b981', // emerald
  '#3b82f6', // blue
  '#f59e0b', // amber
  '#ec4899', // pink
  '#8b5cf6', // violet
  '#ef4444', // red
  '#06b6d4', // cyan
  '#64748b', // slate
];

export function CategoryPickerModal({
  isOpen,
  onClose,
  selectedCategoryId,
  onSelectCategory,
  domain = 'finance',
  title = 'Select Category',
  categories: externalCategories,
  onCategoriesChange,
}: CategoryPickerModalProps) {
  const [mounted, setMounted] = useState(false);
  const [internalCategories, setInternalCategories] = useState<CategoryData[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeParent, setActiveParent] = useState<CategoryData | null>(null);

  // Inline creation / editing state
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<CategoryData | null>(null);
  const [editParentId, setEditParentId] = useState<string | null>(null);
  const [formName, setFormName] = useState('');
  const [formIcon, setFormIcon] = useState('🌮');
  const [formColor, setFormColor] = useState('#10b981');
  const [formError, setFormError] = useState('');
  const [formSaving, setFormSaving] = useState(false);

  // Load categories if not provided externally or when domain changes
  const fetchCategories = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/categories?domain=${domain}`);
      if (res.ok) {
        const json = await res.json() as { success: boolean; data: CategoryData[] };
        if (json.success && Array.isArray(json.data)) {
          setInternalCategories(json.data);
        }
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [domain]);

  // Ensure portal target exists
  useEffect(() => {
    setMounted(true);
  }, []);

  // Manage body scroll-lock only when this modal opens and body isn't already locked
  useEffect(() => {
    if (!isOpen) return;
    const alreadyLocked = document.body.style.overflow === 'hidden';
    if (!alreadyLocked) {
      const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
      document.body.style.overflow = 'hidden';
      if (scrollbarWidth > 0) {
        document.body.style.paddingRight = `${scrollbarWidth}px`;
      }
      return () => {
        document.body.style.overflow = '';
        document.body.style.paddingRight = '';
      };
    }
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) {
      if (!externalCategories || externalCategories.length === 0) {
        fetchCategories();
      } else {
        setInternalCategories(externalCategories);
      }
      setSearchQuery('');
      setFormError('');
    }
  }, [isOpen, externalCategories, fetchCategories]);

  // Keep internal categories in sync if externalCategories update
  useEffect(() => {
    if (externalCategories && externalCategories.length > 0) {
      setInternalCategories(externalCategories);
    }
  }, [externalCategories]);

  // Active categories list
  const currentCategories = externalCategories && externalCategories.length > 0
    ? externalCategories
    : internalCategories;

  // Flattened map for quick lookup
  const { categoryMap, allCategoriesFlat } = useMemo(() => {
    const map = new Map<string, CategoryData>();
    const flat: Array<CategoryData & { parentName?: string; parentIcon?: string }> = [];

    for (const cat of currentCategories) {
      map.set(cat.id, cat);
      flat.push(cat);
      if (cat.subcategories) {
        for (const sub of cat.subcategories) {
          map.set(sub.id, sub);
          flat.push({
            ...sub,
            parentName: cat.name,
            parentIcon: cat.icon || undefined,
          });
        }
      }
    }
    return { categoryMap: map, allCategoriesFlat: flat };
  }, [currentCategories]);

  // If a category was already selected when opened, set initial active parent if it's a subcategory
  useEffect(() => {
    if (isOpen && selectedCategoryId) {
      const selected = categoryMap.get(selectedCategoryId);
      if (selected?.parentId) {
        const parent = categoryMap.get(selected.parentId);
        if (parent) {
          setActiveParent(parent);
        }
      }
    }
  }, [isOpen, selectedCategoryId, categoryMap]);

  // Search filtering
  const filteredSearchResults = useMemo(() => {
    if (!searchQuery.trim()) return null;
    const q = searchQuery.toLowerCase().trim();
    return allCategoriesFlat.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        (c.parentName && c.parentName.toLowerCase().includes(q))
    );
  }, [searchQuery, allCategoriesFlat]);

  // Handle open editor for create
  const handleOpenCreate = (parentId: string | null = null) => {
    setEditingCategory(null);
    setEditParentId(parentId);
    setFormName('');
    const defaultIcon = parentId ? '🍳' : '🌮';
    setFormIcon(defaultIcon);
    const parent = parentId ? categoryMap.get(parentId) : null;
    setFormColor(parent?.color || '#10b981');
    setFormError('');
    setIsEditorOpen(true);
  };

  // Handle open editor for edit
  const handleOpenEdit = (cat: CategoryData, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingCategory(cat);
    setEditParentId(cat.parentId || null);
    setFormName(cat.name);
    setFormIcon(cat.icon || '🏷️');
    setFormColor(cat.color || '#10b981');
    setFormError('');
    setIsEditorOpen(true);
  };

  // Save category (Create or Update)
  const handleSaveCategory = async () => {
    if (!formName.trim()) {
      setFormError('Name is required');
      return;
    }

    try {
      setFormSaving(true);
      setFormError('');

      if (editingCategory) {
        // PATCH
        const res = await fetch(`/api/categories/${editingCategory.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: formName.trim(),
            icon: formIcon.trim() || null,
            color: formColor || null,
          }),
        });

        if (!res.ok) {
          const err = await res.json() as { error?: { message?: string } };
          throw new Error(err.error?.message || 'Failed to update category');
        }
      } else {
        // POST
        const res = await fetch('/api/categories', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            domain,
            name: formName.trim(),
            parentId: editParentId,
            icon: formIcon.trim() || null,
            color: formColor || null,
          }),
        });

        if (!res.ok) {
          const err = await res.json() as { error?: { message?: string } };
          throw new Error(err.error?.message || 'Failed to create category');
        }
      }

      setIsEditorOpen(false);
      await fetchCategories();
      onCategoriesChange?.();
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setFormSaving(false);
    }
  };

  // Delete category
  const handleDeleteCategory = async () => {
    if (!editingCategory) return;
    if (!window.confirm(`Are you sure you want to delete "${editingCategory.name}"?`)) {
      return;
    }

    try {
      setFormSaving(true);
      const res = await fetch(`/api/categories/${editingCategory.id}`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        const err = await res.json() as { error?: { message?: string } };
        throw new Error(err.error?.message || 'Failed to delete category');
      }

      setIsEditorOpen(false);
      if (activeParent?.id === editingCategory.id) {
        setActiveParent(null);
      }
      await fetchCategories();
      onCategoriesChange?.();
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : 'Cannot delete category');
    } finally {
      setFormSaving(false);
    }
  };

  if (!isOpen || !mounted || typeof document === 'undefined') return null;

  const modalContent = (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="category-picker-title"
      className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 dark:bg-black/75 backdrop-blur-md animate-fade-in"
      onClick={onClose}
    >
      <div
        className={twMerge(
          clsx(
            'w-full sm:max-w-xl bg-card border border-border/80 shadow-2xl overflow-hidden flex flex-col',
            'rounded-t-3xl sm:rounded-2xl max-h-[92dvh] sm:max-h-[85vh]',
            'pb-[calc(1rem+env(safe-area-inset-bottom,0px))] sm:pb-0'
          )
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3.5 border-b border-border/80 bg-muted/20">
          <div className="flex items-center gap-2.5 min-w-0">
            {activeParent && !searchQuery ? (
              <button
                type="button"
                onClick={() => setActiveParent(null)}
                className="p-1.5 -ml-1 text-foreground/70 hover:text-foreground hover:bg-muted/80 rounded-lg min-h-[38px] min-w-[38px] flex items-center justify-center transition-colors touch-manipulation cursor-pointer"
                title="Back to all categories"
                aria-label="Back to all categories"
              >
                <IconChevronLeft size={20} />
              </button>
            ) : (
              <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center text-sm shrink-0">
                <IconFolder size={17} />
              </div>
            )}
            <div className="min-w-0">
              <h2 id="category-picker-title" className="text-base font-bold text-foreground truncate">
                {searchQuery
                  ? 'Search Results'
                  : activeParent
                  ? activeParent.name
                  : title}
              </h2>
              <p className="text-[11px] text-foreground/50 truncate">
                {searchQuery
                  ? `Showing results for "${searchQuery}"`
                  : activeParent
                  ? 'Select a subcategory tile or the entire category'
                  : 'Select a primary category to view subcategories'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-foreground/60 hover:text-foreground hover:bg-muted/60 rounded-xl min-h-[44px] min-w-[44px] flex items-center justify-center transition-colors touch-manipulation cursor-pointer"
            aria-label="Close category picker"
          >
            <IconX size={18} />
          </button>
        </div>

        {/* Search Bar */}
        <div className="px-4 py-2.5 border-b border-border/60 bg-card/60">
          <div className="relative flex items-center">
            <IconSearch size={16} className="absolute left-3 text-foreground/40 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search category or subcategory (e.g. Food, Coffee, Rent)..."
              className="w-full pl-9 pr-8 py-2 text-base sm:text-xs min-h-[42px] sm:min-h-[36px] bg-muted/30 border border-border/70 rounded-xl text-foreground placeholder:text-foreground/40 focus:outline-none focus:ring-2 focus:ring-primary touch-manipulation"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 p-1 text-foreground/40 hover:text-foreground rounded-md touch-manipulation"
                aria-label="Clear search"
              >
                <IconX size={14} />
              </button>
            )}
          </div>
        </div>

        {/* Modal Body / Tiles Grid */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3.5">
          {loading ? (
            <div className="py-12 text-center text-foreground/50 text-xs">
              Loading categories...
            </div>
          ) : filteredSearchResults ? (
            /* Search Results */
            <div className="space-y-1.5">
              {filteredSearchResults.length === 0 ? (
                <div className="py-12 text-center text-foreground/50 text-xs">
                  No categories match "{searchQuery}"
                </div>
              ) : (
                filteredSearchResults.map((cat) => {
                  const isSelected = selectedCategoryId === cat.id;
                  return (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => {
                        onSelectCategory(cat);
                        onClose();
                      }}
                      className={twMerge(
                        clsx(
                          'w-full flex items-center justify-between p-3 rounded-xl border text-left transition-all duration-150 touch-manipulation cursor-pointer group',
                          isSelected
                            ? 'bg-primary/10 border-primary text-primary font-semibold shadow-xs'
                            : 'bg-card hover:bg-muted/40 border-border/70 text-foreground'
                        )
                      )}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className="w-9 h-9 rounded-xl flex items-center justify-center text-lg shrink-0 shadow-xs"
                          style={{
                            backgroundColor: cat.color ? `${cat.color}20` : 'rgba(16, 185, 129, 0.15)',
                            borderColor: cat.color || '#10b981',
                          }}
                        >
                          {cat.icon || '🏷️'}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold truncate leading-tight">{cat.name}</p>
                          {cat.parentName && (
                            <p className="text-[11px] text-foreground/50 truncate mt-0.5">
                              {cat.parentIcon ? `${cat.parentIcon} ` : ''}{cat.parentName}
                            </p>
                          )}
                        </div>
                      </div>
                      {isSelected && <IconCheck size={18} className="text-primary shrink-0" />}
                    </button>
                  );
                })
              )}
            </div>
          ) : activeParent ? (
            /* Subcategory View for selected Parent */
            <div className="space-y-3.5">
              {/* Option to select the entire parent category */}
              <div className="flex items-center justify-between gap-2 p-3 rounded-xl bg-muted/30 border border-border/80">
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="text-xl shrink-0">{activeParent.icon || '🏷️'}</span>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-foreground truncate">
                      Entire {activeParent.name}
                    </p>
                    <p className="text-[10px] text-foreground/50">Categorize at top level</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    onSelectCategory(activeParent);
                    onClose();
                  }}
                  className={twMerge(
                    clsx(
                      'px-3 py-1.5 text-xs font-semibold rounded-lg transition-all touch-manipulation cursor-pointer',
                      selectedCategoryId === activeParent.id
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-primary/10 text-primary hover:bg-primary/20'
                    )
                  )}
                >
                  {selectedCategoryId === activeParent.id ? 'Selected' : 'Use Parent'}
                </button>
              </div>

              {/* Subcategories Grid */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-foreground/60">
                    Subcategories ({activeParent.subcategories?.length || 0})
                  </span>
                  <button
                    type="button"
                    onClick={() => handleOpenCreate(activeParent.id)}
                    className="text-xs font-semibold text-primary hover:underline flex items-center gap-1 touch-manipulation cursor-pointer"
                  >
                    <IconPlus size={14} />
                    <span>Add New</span>
                  </button>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                  {activeParent.subcategories?.map((sub) => {
                    const isSelected = selectedCategoryId === sub.id;
                    const tileColor = sub.color || activeParent.color || '#10b981';
                    return (
                      <div
                        key={sub.id}
                        onClick={() => {
                          onSelectCategory(sub);
                          onClose();
                        }}
                        className={twMerge(
                          clsx(
                            'group relative flex flex-col items-center justify-center p-3 rounded-2xl border text-center transition-all duration-150',
                            'hover:shadow-md cursor-pointer touch-manipulation select-none active:scale-[0.98]',
                            isSelected
                              ? 'bg-primary/10 border-primary ring-2 ring-primary/30 shadow-xs'
                              : 'bg-card hover:bg-muted/40 border-border/80'
                          )
                        )}
                      >
                        {/* Edit Pencil Action */}
                        <button
                          type="button"
                          onClick={(e) => handleOpenEdit(sub, e)}
                          title="Edit subcategory"
                          aria-label={`Edit ${sub.name}`}
                          className="absolute top-2 right-2 p-1.5 text-foreground/40 hover:text-foreground hover:bg-muted/80 rounded-lg min-h-[30px] min-w-[30px] flex items-center justify-center transition-colors touch-manipulation opacity-80 sm:opacity-0 group-hover:opacity-100"
                        >
                          <IconEdit size={13} />
                        </button>

                        {/* Icon / Emoji badge */}
                        <div
                          className="w-11 h-11 rounded-2xl flex items-center justify-center text-xl mb-2 shadow-xs transition-transform group-hover:scale-105"
                          style={{
                            backgroundColor: `${tileColor}20`,
                            borderColor: `${tileColor}40`,
                          }}
                        >
                          {sub.icon || '🏷️'}
                        </div>

                        {/* Name */}
                        <span className="text-xs font-bold text-foreground line-clamp-2 px-1 leading-snug">
                          {sub.name}
                        </span>

                        {isSelected && (
                          <div className="absolute top-2 left-2 w-4 h-4 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-[10px]">
                            <IconCheck size={11} />
                          </div>
                        )}
                      </div>
                    );
                  })}

                  {/* Add Subcategory Tile */}
                  <button
                    type="button"
                    onClick={() => handleOpenCreate(activeParent.id)}
                    className="flex flex-col items-center justify-center p-3 rounded-2xl border border-dashed border-border/90 hover:border-primary/60 bg-muted/10 hover:bg-primary/5 text-foreground/60 hover:text-primary transition-all duration-150 cursor-pointer touch-manipulation min-h-[100px]"
                  >
                    <div className="w-10 h-10 rounded-xl bg-muted/60 flex items-center justify-center mb-1.5 text-foreground/70">
                      <IconPlus size={18} />
                    </div>
                    <span className="text-[11px] font-semibold">New Subcategory</span>
                  </button>
                </div>
              </div>
            </div>
          ) : (
            /* Primary Categories Grid */
            <div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                {currentCategories.map((cat) => {
                  const subCount = cat.subcategories?.length || 0;
                  const isSelected = selectedCategoryId === cat.id;
                  const tileColor = cat.color || '#10b981';

                  return (
                    <div
                      key={cat.id}
                      onClick={() => {
                        if (subCount > 0) {
                          // Drill down into subcategories
                          setActiveParent(cat);
                        } else {
                          // Select directly
                          onSelectCategory(cat);
                          onClose();
                        }
                      }}
                      className={twMerge(
                        clsx(
                          'group relative flex flex-col items-center justify-center p-3.5 rounded-2xl border text-center transition-all duration-150',
                          'hover:shadow-md cursor-pointer touch-manipulation select-none active:scale-[0.98]',
                          isSelected
                            ? 'bg-primary/10 border-primary ring-2 ring-primary/30 shadow-xs'
                            : 'bg-card hover:bg-muted/40 border-border/80'
                        )
                      )}
                    >
                      {/* Edit Pencil Icon */}
                      <button
                        type="button"
                        onClick={(e) => handleOpenEdit(cat, e)}
                        title="Edit category"
                        aria-label={`Edit ${cat.name}`}
                        className="absolute top-2 right-2 p-1.5 text-foreground/40 hover:text-foreground hover:bg-muted/80 rounded-lg min-h-[30px] min-w-[30px] flex items-center justify-center transition-colors touch-manipulation opacity-80 sm:opacity-0 group-hover:opacity-100"
                      >
                        <IconEdit size={13} />
                      </button>

                      {/* Icon / Emoji badge */}
                      <div
                        className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl mb-2 shadow-xs transition-transform group-hover:scale-105"
                        style={{
                          backgroundColor: `${tileColor}20`,
                          borderColor: `${tileColor}40`,
                        }}
                      >
                        {cat.icon || '🏷️'}
                      </div>

                      {/* Title & Subcount */}
                      <span className="text-xs font-bold text-foreground line-clamp-1 leading-snug">
                        {cat.name}
                      </span>
                      <span className="text-[10px] text-foreground/50 mt-0.5 font-medium flex items-center gap-0.5">
                        {subCount > 0 ? `${subCount} subcategories` : 'Standard'}
                        {subCount > 0 && <IconChevronRight size={11} />}
                      </span>

                      {isSelected && (
                        <div className="absolute top-2 left-2 w-4 h-4 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-[10px]">
                          <IconCheck size={11} />
                        </div>
                      )}
                    </div>
                  );
                })}

                {/* Add Primary Category Tile */}
                <button
                  type="button"
                  onClick={() => handleOpenCreate(null)}
                  className="flex flex-col items-center justify-center p-3.5 rounded-2xl border border-dashed border-border/90 hover:border-primary/60 bg-muted/10 hover:bg-primary/5 text-foreground/60 hover:text-primary transition-all duration-150 cursor-pointer touch-manipulation min-h-[115px]"
                >
                  <div className="w-11 h-11 rounded-xl bg-muted/60 flex items-center justify-center mb-1.5 text-foreground/70">
                    <IconPlus size={20} />
                  </div>
                  <span className="text-xs font-semibold">New Category</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Bottom Bar */}
        <div className="px-4 py-3 border-t border-border/70 bg-muted/20 flex items-center justify-between text-xs text-foreground/60">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <span className="font-mono text-[11px]">Dynamic Taxonomy</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 font-semibold text-foreground/80 hover:text-foreground hover:bg-muted/80 rounded-lg touch-manipulation cursor-pointer"
          >
            Cancel
          </button>
        </div>
      </div>

      {/* Inline Create/Edit Drawer / Modal */}
      {isEditorOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in"
          onClick={() => setIsEditorOpen(false)}
        >
          <div
            className="w-full max-w-sm bg-card border border-border shadow-2xl rounded-2xl p-5 space-y-4 animate-scale-up"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-border/60 pb-3">
              <h3 className="text-sm font-bold text-foreground">
                {editingCategory
                  ? `Edit ${editingCategory.parentId ? 'Subcategory' : 'Category'}`
                  : `New ${editParentId ? 'Subcategory' : 'Category'}`}
              </h3>
              <button
                type="button"
                onClick={() => setIsEditorOpen(false)}
                className="p-1 text-foreground/50 hover:text-foreground rounded-md touch-manipulation"
              >
                <IconX size={16} />
              </button>
            </div>

            {formError && (
              <div className="p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-500 text-xs font-medium">
                {formError}
              </div>
            )}

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-foreground/80 mb-1">
                  Name
                </label>
                <input
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder={editParentId ? 'e.g. Breakfast, Lunch, Coffee' : 'e.g. Food, Housing'}
                  className="w-full px-3 py-2 text-base sm:text-xs min-h-[42px] sm:min-h-[36px] bg-muted/30 border border-border/80 rounded-xl text-foreground focus:outline-none focus:ring-2 focus:ring-primary touch-manipulation"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground/80 mb-1">
                  Icon / Emoji
                </label>
                <div className="flex items-center gap-2 mb-2">
                  <input
                    type="text"
                    value={formIcon}
                    onChange={(e) => setFormIcon(e.target.value)}
                    maxLength={8}
                    className="w-16 px-2 py-1.5 text-center text-xl min-h-[40px] bg-muted/40 border border-border/80 rounded-xl text-foreground focus:outline-none focus:ring-2 focus:ring-primary touch-manipulation"
                  />
                  <span className="text-[11px] text-foreground/50">
                    Pick a chip below or type an emoji
                  </span>
                </div>
                <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto p-1 bg-muted/20 border border-border/60 rounded-xl">
                  {COMMON_EMOJIS.map((emoji) => (
                    <button
                      key={emoji}
                      type="button"
                      onClick={() => setFormIcon(emoji)}
                      className={twMerge(
                        clsx(
                          'w-8 h-8 rounded-lg flex items-center justify-center text-base hover:bg-card transition-colors touch-manipulation cursor-pointer',
                          formIcon === emoji ? 'bg-primary/20 ring-1 ring-primary' : 'bg-transparent'
                        )
                      )}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground/80 mb-1">
                  Color Accent
                </label>
                <div className="flex items-center gap-2">
                  {PRESET_COLORS.map((col) => (
                    <button
                      key={col}
                      type="button"
                      onClick={() => setFormColor(col)}
                      style={{ backgroundColor: col }}
                      className={twMerge(
                        clsx(
                          'w-7 h-7 rounded-full transition-transform touch-manipulation cursor-pointer shrink-0',
                          formColor === col ? 'ring-2 ring-foreground scale-110' : 'opacity-80 hover:opacity-100'
                        )
                      )}
                    />
                  ))}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-border/60">
              {editingCategory ? (
                <button
                  type="button"
                  onClick={handleDeleteCategory}
                  disabled={formSaving}
                  className="px-3 py-2 text-xs font-semibold text-rose-500 hover:bg-rose-500/10 rounded-xl transition-colors touch-manipulation flex items-center gap-1 cursor-pointer"
                >
                  <IconTrash size={14} />
                  <span>Delete</span>
                </button>
              ) : (
                <div />
              )}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsEditorOpen(false)}
                  disabled={formSaving}
                  className="px-3 py-2 text-xs font-semibold text-foreground/70 hover:bg-muted/80 rounded-xl transition-colors touch-manipulation cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveCategory}
                  disabled={formSaving}
                  className="px-4 py-2 text-xs font-bold bg-primary text-primary-foreground rounded-xl shadow-xs hover:bg-primary/90 transition-all touch-manipulation cursor-pointer"
                >
                  {formSaving ? 'Saving...' : editingCategory ? 'Update' : 'Create'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  return createPortal(modalContent, document.body);
}

/**
 * Modern Form Trigger Button for Category Selection
 */
export interface CategoryPickerTriggerProps {
  selectedCategoryId?: string | null;
  categories: CategoryData[];
  onClick: () => void;
  onClear?: () => void;
  label?: string;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

export function CategoryPickerTrigger({
  selectedCategoryId,
  categories,
  onClick,
  onClear,
  label = 'Category',
  placeholder = 'Select a category (e.g. Food 🌮 > Lunch 🥗)...',
  className,
  disabled,
}: CategoryPickerTriggerProps) {
  // Find selected item and parent if applicable
  const selectedInfo = useMemo(() => {
    if (!selectedCategoryId) return null;

    for (const cat of categories) {
      if (cat.id === selectedCategoryId) {
        return { item: cat, parent: null };
      }
      if (cat.subcategories) {
        for (const sub of cat.subcategories) {
          if (sub.id === selectedCategoryId) {
            return { item: sub, parent: cat };
          }
        }
      }
    }
    return null;
  }, [selectedCategoryId, categories]);

  return (
    <div className={className}>
      {label && (
        <label className="block text-xs font-semibold text-foreground/75 mb-1.5">
          {label}
        </label>
      )}
      <div className="relative flex items-center">
        <button
          type="button"
          onClick={onClick}
          disabled={disabled}
          className={twMerge(
            clsx(
              'w-full flex items-center justify-between px-3.5 py-2.5 sm:py-2 text-base sm:text-xs min-h-[44px] sm:min-h-[40px]',
              'bg-card border border-border/80 rounded-xl text-left transition-all duration-150 touch-manipulation cursor-pointer',
              'focus:outline-none focus:ring-2 focus:ring-primary hover:border-primary/60',
              disabled && 'opacity-50 cursor-not-allowed'
            )
          )}
        >
          {selectedInfo ? (
            <div className="flex items-center gap-2 min-w-0 pr-6">
              {/* Parent badge if present */}
              {selectedInfo.parent && (
                <span className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-muted/60 text-foreground/70 font-semibold text-[11px] truncate">
                  <span>{selectedInfo.parent.icon || '🏷️'}</span>
                  <span className="truncate">{selectedInfo.parent.name}</span>
                  <IconChevronRight size={10} className="shrink-0 text-foreground/40" />
                </span>
              )}
              {/* Selected Subcategory / Primary item */}
              <div className="flex items-center gap-1.5 truncate">
                <span
                  className="w-5 h-5 rounded-md flex items-center justify-center text-xs shrink-0"
                  style={{
                    backgroundColor: selectedInfo.item.color ? `${selectedInfo.item.color}25` : 'rgba(16, 185, 129, 0.2)',
                  }}
                >
                  {selectedInfo.item.icon || '🏷️'}
                </span>
                <span className="font-bold text-foreground truncate">
                  {selectedInfo.item.name}
                </span>
              </div>
            </div>
          ) : (
            <span className="text-foreground/40 font-normal truncate">{placeholder}</span>
          )}

          <div className="flex items-center gap-1 shrink-0 text-foreground/40">
            <IconChevronDown size={15} />
          </div>
        </button>

        {selectedInfo && onClear && !disabled && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onClear();
            }}
            className="absolute right-8 p-1 text-foreground/40 hover:text-foreground rounded-md touch-manipulation"
            title="Clear category"
            aria-label="Clear category"
          >
            <IconX size={14} />
          </button>
        )}
      </div>
    </div>
  );
}
