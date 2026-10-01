import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import type { CategoryData, CategoryDomain } from '../../../shared/types';
import {
  IconSearch,
  IconX,
  IconPlus,
  IconCheck,
  IconChevronDown,
  IconChevronRight,
  IconFolder,
} from './Icons';

export interface CategoryDropdownProps {
  value?: string | null;
  onChange: (categoryId: string, category?: CategoryData | null) => void;
  domain?: CategoryDomain;
  label?: string;
  placeholder?: string;
  required?: boolean;
  categories?: CategoryData[];
  onCategoriesChange?: () => void;
  className?: string;
  disabled?: boolean;
  allowClear?: boolean;
  defaultParentId?: string | null;
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

export function CategoryDropdown({
  value,
  onChange,
  domain = 'finance',
  label = 'Category',
  placeholder = 'Select a category...',
  required = false,
  categories: externalCategories,
  onCategoriesChange,
  className,
  disabled = false,
  allowClear = true,
  defaultParentId = null,
}: CategoryDropdownProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const [isOpen, setIsOpen] = useState(false);
  const [internalCategories, setInternalCategories] = useState<CategoryData[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Inline Creation View inside Dropdown
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [newCatIcon, setNewCatIcon] = useState('🌮');
  const [newCatColor, setNewCatColor] = useState('#10b981');
  const [newCatParentId, setNewCatParentId] = useState<string | null>(defaultParentId);
  const [isSubcategoryMode, setIsSubcategoryMode] = useState<boolean>(Boolean(defaultParentId));
  const [creationError, setCreationError] = useState('');
  const [savingNew, setSavingNew] = useState(false);

  // Fetch categories from API if not supplied externally
  const fetchCategories = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/categories?domain=${domain}`);
      if (res.ok) {
        const json = (await res.json()) as { success: boolean; data: CategoryData[] };
        if (json.success && Array.isArray(json.data)) {
          setInternalCategories(json.data);
        }
      }
    } catch {
      // ignore error
    } finally {
      setLoading(false);
    }
  }, [domain]);

  useEffect(() => {
    if (!externalCategories || externalCategories.length === 0) {
      fetchCategories();
    } else {
      setInternalCategories(externalCategories);
    }
  }, [externalCategories, fetchCategories]);

  // Active category list
  const currentCategories =
    externalCategories && externalCategories.length > 0 ? externalCategories : internalCategories;

  // Flattened lookup and list
  const { categoryMap, flatList, primaryCategories } = useMemo(() => {
    const map = new Map<string, { item: CategoryData; parent: CategoryData | null }>();
    const flat: Array<CategoryData & { parentName?: string; parentIcon?: string }> = [];
    const primaries: CategoryData[] = [];

    for (const cat of currentCategories) {
      primaries.push(cat);
      map.set(cat.id, { item: cat, parent: null });
      flat.push(cat);

      if (cat.subcategories && cat.subcategories.length > 0) {
        for (const sub of cat.subcategories) {
          map.set(sub.id, { item: sub, parent: cat });
          flat.push({
            ...sub,
            parentName: cat.name,
            parentIcon: cat.icon || undefined,
          });
        }
      }
    }
    return { categoryMap: map, flatList: flat, primaryCategories: primaries };
  }, [currentCategories]);

  // Selected details
  const selectedInfo = useMemo(() => {
    if (!value) return null;
    return categoryMap.get(value) || null;
  }, [value, categoryMap]);

  // Handle outside clicks to close dropdown
  useEffect(() => {
    if (!isOpen) return;

    const handleOutsideClick = (e: MouseEvent | TouchEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setIsAddingNew(false);
        setSearchQuery('');
        setCreationError('');
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
        setIsAddingNew(false);
        setSearchQuery('');
        setCreationError('');
      }
    };

    document.addEventListener('mousedown', handleOutsideClick);
    document.addEventListener('touchstart', handleOutsideClick);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('touchstart', handleOutsideClick);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  // Focus search input when dropdown opens
  useEffect(() => {
    if (isOpen && !isAddingNew) {
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);
    }
  }, [isOpen, isAddingNew]);

  // Search filter results
  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return null;
    const q = searchQuery.toLowerCase().trim();
    return flatList.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        (c.parentName && c.parentName.toLowerCase().includes(q))
    );
  }, [searchQuery, flatList]);

  // Open inline add form
  const handleStartAdd = (parentId: string | null = null) => {
    setNewCatName('');
    setNewCatIcon(parentId ? '🍳' : '🌮');
    const parent = parentId ? categoryMap.get(parentId)?.item : null;
    setNewCatColor(parent?.color || '#10b981');
    setNewCatParentId(parentId || (primaryCategories[0]?.id || null));
    setIsSubcategoryMode(Boolean(parentId || primaryCategories.length > 0));
    setCreationError('');
    setIsAddingNew(true);
  };

  // Submit inline creation & instant auto-select
  const handleCreateAndSelect = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!newCatName.trim()) {
      setCreationError('Please enter a name');
      return;
    }

    try {
      setSavingNew(true);
      setCreationError('');

      const parentIdToSend = isSubcategoryMode ? newCatParentId : null;

      const res = await fetch('/api/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          domain,
          name: newCatName.trim(),
          parentId: parentIdToSend,
          icon: newCatIcon.trim() || null,
          color: newCatColor || null,
        }),
      });

      if (!res.ok) {
        const err = (await res.json()) as { error?: { message?: string } };
        throw new Error(err.error?.message || 'Failed to create category');
      }

      const createdRes = (await res.json()) as { success: boolean; data: CategoryData };
      const createdCategory = createdRes.data;

      // Invalidate / refresh categories in background
      await fetchCategories();
      onCategoriesChange?.();

      // Immediately select newly created category and close dropdown
      onChange(createdCategory.id, createdCategory);
      setIsAddingNew(false);
      setIsOpen(false);
      setSearchQuery('');
    } catch (err: unknown) {
      setCreationError(err instanceof Error ? err.message : 'Error creating category');
    } finally {
      setSavingNew(false);
    }
  };

  return (
    <div ref={containerRef} className={twMerge('relative', className)}>
      {label && (
        <label className="block text-xs font-semibold text-foreground/75 mb-1.5 select-none">
          {label} {required && <span className="text-rose-500">*</span>}
        </label>
      )}

      {/* Dropdown Trigger Button */}
      <div className="relative flex items-center">
        <button
          type="button"
          disabled={disabled}
          onClick={() => {
            if (!disabled) {
              setIsOpen((prev) => !prev);
              setIsAddingNew(false);
              setSearchQuery('');
            }
          }}
          className={twMerge(
            clsx(
              'w-full flex items-center justify-between px-3.5 py-2.5 sm:py-2 text-base sm:text-xs min-h-[44px] sm:min-h-[40px]',
              'bg-card border rounded-xl text-left transition-all duration-150 touch-manipulation cursor-pointer select-none',
              'focus:outline-none focus:ring-2 focus:ring-primary',
              isOpen ? 'border-primary ring-2 ring-primary/20 shadow-sm' : 'border-border/80 hover:border-primary/60',
              disabled && 'opacity-50 cursor-not-allowed'
            )
          )}
          aria-haspopup="listbox"
          aria-expanded={isOpen}
        >
          {selectedInfo ? (
            <div className="flex items-center gap-2 min-w-0 pr-6 truncate">
              {/* Parent Category Badge */}
              {selectedInfo.parent && (
                <span className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-muted/70 text-foreground/70 font-semibold text-[11px] truncate shrink-0">
                  <span>{selectedInfo.parent.icon || '🏷️'}</span>
                  <span className="truncate max-w-[110px] sm:max-w-[130px]">{selectedInfo.parent.name}</span>
                  <IconChevronRight size={10} className="shrink-0 text-foreground/40" />
                </span>
              )}

              {/* Subcategory / Category Item */}
              <div className="flex items-center gap-1.5 truncate">
                <span
                  className="w-5 h-5 rounded-md flex items-center justify-center text-xs shrink-0 shadow-2xs"
                  style={{
                    backgroundColor: selectedInfo.item.color
                      ? `${selectedInfo.item.color}25`
                      : 'rgba(16, 185, 129, 0.2)',
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
            <div className="flex items-center gap-2 text-foreground/40 font-normal truncate">
              <IconFolder size={15} className="shrink-0 opacity-60" />
              <span className="truncate">{placeholder}</span>
            </div>
          )}

          {/* Right Chevron & Clear Icon */}
          <div className="flex items-center gap-1 shrink-0 text-foreground/40">
            <IconChevronDown
              size={15}
              className={twMerge('transition-transform duration-200', isOpen && 'rotate-180 text-primary')}
            />
          </div>
        </button>

        {/* Clear selection button */}
        {selectedInfo && allowClear && !disabled && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onChange('', null);
            }}
            className="absolute right-8 p-1.5 text-foreground/40 hover:text-foreground hover:bg-muted/60 rounded-md transition-colors touch-manipulation cursor-pointer"
            title="Clear category"
            aria-label="Clear category"
          >
            <IconX size={14} />
          </button>
        )}
      </div>

      {/* Animated Dropdown Menu Popover */}
      {isOpen && (
        <div
          className={twMerge(
            clsx(
              'absolute z-50 left-0 right-0 mt-1.5 bg-card/95 backdrop-blur-xl border border-border shadow-2xl rounded-2xl overflow-hidden',
              'animate-scale-up origin-top transition-all duration-150',
              'min-w-[290px] max-w-full sm:max-w-md'
            )
          )}
          role="listbox"
        >
          {isAddingNew ? (
            /* Inline Category / Subcategory Creation Form */
            <form onSubmit={handleCreateAndSelect} className="p-4 space-y-3.5 bg-card animate-fade-in">
              <div className="flex items-center justify-between border-b border-border/60 pb-2.5">
                <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                  <IconPlus size={14} className="text-primary" />
                  <span>Create New {isSubcategoryMode ? 'Subcategory' : 'Primary Category'}</span>
                </span>
                <button
                  type="button"
                  onClick={() => setIsAddingNew(false)}
                  className="p-1 text-foreground/40 hover:text-foreground rounded-md touch-manipulation cursor-pointer"
                  aria-label="Back to category list"
                >
                  <IconX size={15} />
                </button>
              </div>

              {creationError && (
                <div className="p-2 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-500 text-xs font-medium">
                  {creationError}
                </div>
              )}

              {/* Category Hierarchy Mode Selector */}
              {primaryCategories.length > 0 && (
                <div className="flex rounded-xl p-0.5 bg-muted/40 border border-border/60">
                  <button
                    type="button"
                    onClick={() => {
                      setIsSubcategoryMode(true);
                      if (!newCatParentId && primaryCategories.length > 0) {
                        setNewCatParentId(primaryCategories[0].id);
                      }
                    }}
                    className={twMerge(
                      clsx(
                        'flex-1 py-1.5 text-[11px] font-bold rounded-lg transition-all touch-manipulation cursor-pointer',
                        isSubcategoryMode
                          ? 'bg-card text-foreground shadow-xs'
                          : 'text-foreground/60 hover:text-foreground'
                      )
                    )}
                  >
                    Nested Subcategory
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsSubcategoryMode(false)}
                    className={twMerge(
                      clsx(
                        'flex-1 py-1.5 text-[11px] font-bold rounded-lg transition-all touch-manipulation cursor-pointer',
                        !isSubcategoryMode
                          ? 'bg-card text-foreground shadow-xs'
                          : 'text-foreground/60 hover:text-foreground'
                      )
                    )}
                  >
                    Primary Category
                  </button>
                </div>
              )}

              {/* If Nested Subcategory, choose Parent Category */}
              {isSubcategoryMode && (
                <div>
                  <label className="block text-[11px] font-semibold text-foreground/75 mb-1">
                    Parent Category
                  </label>
                  <select
                    value={newCatParentId || ''}
                    onChange={(e) => setNewCatParentId(e.target.value)}
                    className="w-full px-3 py-2 text-base sm:text-xs min-h-[42px] sm:min-h-[36px] bg-muted/20 border border-border/80 rounded-xl text-foreground focus:outline-none focus:ring-2 focus:ring-primary touch-manipulation cursor-pointer"
                  >
                    {primaryCategories.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.icon ? `${p.icon} ` : ''}{p.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Name Input */}
              <div>
                <label className="block text-[11px] font-semibold text-foreground/75 mb-1">
                  Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={newCatName}
                  onChange={(e) => setNewCatName(e.target.value)}
                  placeholder={isSubcategoryMode ? 'e.g. Breakfast, Coffee, Takeout' : 'e.g. Food & Dining, Travel'}
                  autoFocus
                  className="w-full px-3 py-2 text-base sm:text-xs min-h-[44px] sm:min-h-[38px] bg-muted/20 border border-border/80 rounded-xl text-foreground focus:outline-none focus:ring-2 focus:ring-primary touch-manipulation"
                />
              </div>

              {/* Emoji / Icon Selector */}
              <div>
                <label className="block text-[11px] font-semibold text-foreground/75 mb-1">
                  Icon / Emoji
                </label>
                <div className="flex items-center gap-2 mb-2">
                  <input
                    type="text"
                    value={newCatIcon}
                    onChange={(e) => setNewCatIcon(e.target.value)}
                    maxLength={8}
                    className="w-14 px-2 py-1.5 text-center text-xl min-h-[40px] bg-muted/40 border border-border/80 rounded-xl text-foreground focus:outline-none focus:ring-2 focus:ring-primary touch-manipulation"
                  />
                  <span className="text-[10px] text-foreground/50">
                    Tap a quick chip or type any emoji
                  </span>
                </div>
                <div className="flex flex-wrap gap-1 max-h-20 overflow-y-auto p-1 bg-muted/20 border border-border/60 rounded-xl no-scrollbar">
                  {COMMON_EMOJIS.map((emoji) => (
                    <button
                      key={emoji}
                      type="button"
                      onClick={() => setNewCatIcon(emoji)}
                      className={twMerge(
                        clsx(
                          'w-7 h-7 rounded-md flex items-center justify-center text-sm hover:bg-card transition-colors touch-manipulation cursor-pointer',
                          newCatIcon === emoji ? 'bg-primary/20 ring-1 ring-primary' : 'bg-transparent'
                        )
                      )}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>

              {/* Color Accent */}
              <div>
                <label className="block text-[11px] font-semibold text-foreground/75 mb-1">
                  Color Accent
                </label>
                <div className="flex items-center gap-2">
                  {PRESET_COLORS.map((col) => (
                    <button
                      key={col}
                      type="button"
                      onClick={() => setNewCatColor(col)}
                      style={{ backgroundColor: col }}
                      className={twMerge(
                        clsx(
                          'w-6 h-6 rounded-full transition-transform touch-manipulation cursor-pointer shrink-0',
                          newCatColor === col ? 'ring-2 ring-foreground scale-110' : 'opacity-70 hover:opacity-100'
                        )
                      )}
                    />
                  ))}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-border/60">
                <button
                  type="button"
                  onClick={() => setIsAddingNew(false)}
                  disabled={savingNew}
                  className="px-3 py-2 text-xs font-semibold text-foreground/70 hover:text-foreground hover:bg-muted/60 rounded-xl min-h-[44px] sm:min-h-[38px] transition-colors touch-manipulation cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingNew}
                  className="px-4 py-2 text-xs font-bold bg-primary text-primary-foreground hover:bg-primary/90 rounded-xl min-h-[44px] sm:min-h-[38px] shadow-sm transition-all touch-manipulation cursor-pointer flex items-center gap-1.5"
                >
                  {savingNew ? (
                    'Saving...'
                  ) : (
                    <>
                      <IconCheck size={14} />
                      <span>Save & Select</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          ) : (
            /* Searchable Grouped Dropdown List */
            <div className="flex flex-col">
              {/* Search Header */}
              <div className="p-2.5 border-b border-border/60 bg-muted/20">
                <div className="relative flex items-center">
                  <IconSearch size={15} className="absolute left-3 text-foreground/40 pointer-events-none" />
                  <input
                    ref={searchInputRef}
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search category or subcategory..."
                    className="w-full pl-8 pr-7 py-2 text-base sm:text-xs min-h-[40px] sm:min-h-[34px] bg-card border border-border/80 rounded-xl text-foreground placeholder:text-foreground/40 focus:outline-none focus:ring-2 focus:ring-primary touch-manipulation"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery('')}
                      className="absolute right-2.5 p-1 text-foreground/40 hover:text-foreground rounded-md touch-manipulation"
                      aria-label="Clear search query"
                    >
                      <IconX size={13} />
                    </button>
                  )}
                </div>
              </div>

              {/* Grouped Options List */}
              <div className="max-h-72 overflow-y-auto divide-y divide-border/30 p-1.5 space-y-1">
                {loading ? (
                  <div className="py-8 text-center text-xs text-foreground/50">
                    Loading categories...
                  </div>
                ) : searchResults ? (
                  /* Flat Search Matches */
                  searchResults.length === 0 ? (
                    <div className="py-8 text-center text-xs text-foreground/50 space-y-2">
                      <p>No categories match "{searchQuery}"</p>
                      <button
                        type="button"
                        onClick={() => {
                          handleStartAdd();
                          setNewCatName(searchQuery);
                        }}
                        className="text-xs font-bold text-primary hover:underline touch-manipulation cursor-pointer"
                      >
                        + Create "{searchQuery}" now
                      </button>
                    </div>
                  ) : (
                    searchResults.map((item) => {
                      const isSelected = value === item.id;
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => {
                            onChange(item.id, item);
                            setIsOpen(false);
                            setSearchQuery('');
                          }}
                          className={twMerge(
                            clsx(
                              'w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-left transition-all duration-150 touch-manipulation cursor-pointer min-h-[44px]',
                              isSelected
                                ? 'bg-primary/10 text-primary font-bold shadow-2xs'
                                : 'hover:bg-muted/50 text-foreground'
                            )
                          )}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <span
                              className="w-6 h-6 rounded-md flex items-center justify-center text-sm shrink-0"
                              style={{
                                backgroundColor: item.color ? `${item.color}20` : 'rgba(16, 185, 129, 0.15)',
                              }}
                            >
                              {item.icon || '🏷️'}
                            </span>
                            <div className="min-w-0">
                              <p className="text-xs font-bold truncate leading-tight">{item.name}</p>
                              {item.parentName && (
                                <p className="text-[10px] text-foreground/50 truncate mt-0.5">
                                  {item.parentIcon ? `${item.parentIcon} ` : ''}{item.parentName}
                                </p>
                              )}
                            </div>
                          </div>
                          {isSelected && <IconCheck size={16} className="text-primary shrink-0 ml-2" />}
                        </button>
                      );
                    })
                  )
                ) : primaryCategories.length === 0 ? (
                  <div className="py-8 text-center text-xs text-foreground/50">
                    No categories configured yet.
                  </div>
                ) : (
                  /* Hierarchically Grouped Categories and Subcategories */
                  primaryCategories.map((parent) => {
                    const isParentSelected = value === parent.id;
                    const hasSubcategories = parent.subcategories && parent.subcategories.length > 0;

                    return (
                      <div key={parent.id} className="pt-1 pb-1">
                        {/* Parent Category Header Tile / Option */}
                        <div
                          className={twMerge(
                            clsx(
                              'flex items-center justify-between px-2.5 py-2 rounded-xl transition-all duration-150',
                              'min-h-[44px] group'
                            )
                          )}
                        >
                          <button
                            type="button"
                            onClick={() => {
                              onChange(parent.id, parent);
                              setIsOpen(false);
                            }}
                            className="flex items-center gap-2 flex-1 text-left min-w-0 touch-manipulation cursor-pointer"
                          >
                            <span
                              className="w-7 h-7 rounded-lg flex items-center justify-center text-base shrink-0 shadow-2xs transition-transform group-hover:scale-105"
                              style={{
                                backgroundColor: parent.color ? `${parent.color}25` : 'rgba(16, 185, 129, 0.2)',
                              }}
                            >
                              {parent.icon || '🏷️'}
                            </span>
                            <span className={twMerge('text-xs font-extrabold truncate', isParentSelected ? 'text-primary' : 'text-foreground')}>
                              {parent.name}
                            </span>
                            {isParentSelected && <IconCheck size={15} className="text-primary ml-1 shrink-0" />}
                          </button>

                          {/* Quick inline subcategory add button */}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleStartAdd(parent.id);
                            }}
                            title={`Add subcategory to ${parent.name}`}
                            aria-label={`Add subcategory to ${parent.name}`}
                            className="p-1.5 text-foreground/40 hover:text-primary hover:bg-muted/80 rounded-lg min-h-[36px] min-w-[36px] flex items-center justify-center transition-colors touch-manipulation cursor-pointer"
                          >
                            <IconPlus size={14} />
                          </button>
                        </div>

                        {/* Indented Nested Subcategories */}
                        {hasSubcategories && (
                          <div className="pl-6 space-y-0.5 mt-0.5 border-l-2 border-border/40 ml-4 mb-1">
                            {parent.subcategories?.map((sub) => {
                              const isSubSelected = value === sub.id;
                              return (
                                <button
                                  key={sub.id}
                                  type="button"
                                  onClick={() => {
                                    onChange(sub.id, sub);
                                    setIsOpen(false);
                                  }}
                                  className={twMerge(
                                    clsx(
                                      'w-full flex items-center justify-between px-3 py-2 rounded-xl text-left transition-all duration-150 touch-manipulation cursor-pointer min-h-[44px]',
                                      isSubSelected
                                        ? 'bg-primary/10 text-primary font-bold shadow-2xs'
                                        : 'hover:bg-muted/40 text-foreground/85'
                                    )
                                  )}
                                >
                                  <div className="flex items-center gap-2 min-w-0">
                                    <span
                                      className="w-5 h-5 rounded-md flex items-center justify-center text-xs shrink-0"
                                      style={{
                                        backgroundColor: sub.color ? `${sub.color}20` : 'rgba(16, 185, 129, 0.15)',
                                      }}
                                    >
                                      {sub.icon || '🏷️'}
                                    </span>
                                    <span className="text-xs font-semibold truncate leading-tight">
                                      {sub.name}
                                    </span>
                                  </div>
                                  {isSubSelected && <IconCheck size={15} className="text-primary shrink-0 ml-2" />}
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>

              {/* Prominent '+ Add Category / Subcategory' Bottom Button */}
              <div className="p-2 border-t border-border/60 bg-muted/20">
                <button
                  type="button"
                  onClick={() => handleStartAdd(null)}
                  className="w-full py-2.5 px-3 rounded-xl border border-dashed border-primary/40 hover:border-primary bg-primary/5 hover:bg-primary/10 text-primary font-bold text-xs flex items-center justify-center gap-1.5 transition-all touch-manipulation cursor-pointer min-h-[44px]"
                >
                  <IconPlus size={16} />
                  <span>+ Add Category / Subcategory</span>
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
