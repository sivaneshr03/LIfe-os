import React, { useState, useEffect, useCallback } from 'react';
import { clsx } from 'clsx';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Modal } from '../ui/Modal';
import { ConfirmationModal } from '../ui/ConfirmationModal';
import { LoadingState, EmptyState } from '../ui/States';
import { useToast } from '../ui/Toast';
import { CategoryDropdown } from '../ui/CategoryDropdown';
import {
  IconFileText,
  IconPlus,
  IconPin,
  IconCopy,
  IconChevronLeft,
  IconChevronRight,
  IconCalendar,
  IconSparkles,
  IconTrash,
} from '../ui/Icons';
import type {
  NoteData,
  DailyNoteData,
  PromptData,
  CategoryData,
  ApiSuccessResponse,
  ApiPaginatedResponse,
} from '../../../shared/types';
import { safeParseJson } from '../../lib/api';

export function NotesView() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'notes' | 'daily' | 'prompts'>('notes');

  // General notes state
  const [notes, setNotes] = useState<NoteData[]>([]);
  const [noteSearch, setNoteSearch] = useState('');
  const [categories, setCategories] = useState<CategoryData[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('all');
  const [filterPinned, setFilterPinned] = useState(false);

  // Daily notes state
  const [dailyDate, setDailyDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [, setDailyNote] = useState<DailyNoteData | null>(null);
  const [dailyContent, setDailyContent] = useState('');
  const [dailyMood, setDailyMood] = useState('good');
  const [dailyEnergy, setDailyEnergy] = useState<number>(4);

  // Prompts state
  const [prompts, setPrompts] = useState<PromptData[]>([]);
  const [promptSearch, setPromptSearch] = useState('');

  // Modals
  const [isNoteModalOpen, setIsNoteModalOpen] = useState(false);
  const [isPromptModalOpen, setIsPromptModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [noteToDelete, setNoteToDelete] = useState<NoteData | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Note form state
  const [noteTitle, setNoteTitle] = useState('');
  const [noteContent, setNoteContent] = useState('');
  const [noteCategory, setNoteCategory] = useState('');
  const [isPinned, setIsPinned] = useState(false);

  // Prompt form state
  const [promptTitle, setPromptTitle] = useState('');
  const [promptDesc, setPromptDesc] = useState('');
  const [promptContent, setPromptContent] = useState('');
  const [promptCategory, setPromptCategory] = useState('');

  // Fetch general notes
  const fetchNotes = useCallback(async () => {
    try {
      const qParams = new URLSearchParams();
      if (noteSearch) qParams.set('q', noteSearch);
      if (selectedCategoryId !== 'all') qParams.set('categoryId', selectedCategoryId);
      if (filterPinned) qParams.set('isPinned', 'true');

      const res = await fetch(`/api/notes?${qParams.toString()}`);
      if (res.ok) {
        const { data: json } = await safeParseJson<ApiPaginatedResponse<NoteData>>(res);
        if (json?.data?.items) {
          setNotes(json.data.items);
        }
      }
    } catch {
      // silently handle
    }
  }, [noteSearch, selectedCategoryId, filterPinned]);

  // Fetch daily note for the currently selected calendar date
  const fetchDailyNoteForDate = useCallback(async (date: string) => {
    try {
      const res = await fetch(`/api/daily-notes/${date}`);
      if (res.ok) {
        const { data: json } = await safeParseJson<ApiSuccessResponse<DailyNoteData>>(res);
        if (json && json.data) {
          setDailyNote(json.data);
          setDailyContent(json.data.content);
          setDailyMood(json.data.mood || 'good');
          setDailyEnergy(json.data.energy || 4);
        } else {
          setDailyNote(null);
          setDailyContent('');
          setDailyMood('good');
          setDailyEnergy(4);
        }
      } else {
        setDailyNote(null);
        setDailyContent('');
        setDailyMood('good');
        setDailyEnergy(4);
      }
    } catch {
      setDailyNote(null);
      setDailyContent('');
    }
  }, []);

  // Fetch prompts
  const fetchPrompts = useCallback(async () => {
    try {
      const qParams = new URLSearchParams();
      if (promptSearch) qParams.set('q', promptSearch);
      const res = await fetch(`/api/prompts?${qParams.toString()}`);
      if (res.ok) {
        const { data: json } = await safeParseJson<ApiPaginatedResponse<PromptData>>(res);
        const promptList = Array.isArray(json?.data)
          ? json.data
          : (json?.data?.items || []);
        setPrompts(promptList);
      }
    } catch {
      // silently handle
    }
  }, [promptSearch]);

  // Fetch categories
  const fetchCategories = useCallback(async () => {
    try {
      const res = await fetch('/api/categories?domain=note');
      if (res.ok) {
        const { data: json } = await safeParseJson<ApiSuccessResponse<CategoryData[]>>(res);
        if (json && json.data) {
          setCategories(json.data);
        }
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    Promise.all([fetchNotes(), fetchDailyNoteForDate(dailyDate), fetchPrompts(), fetchCategories()]).finally(
      () => setLoading(false)
    );
  }, [fetchNotes, fetchDailyNoteForDate, dailyDate, fetchPrompts, fetchCategories]);

  // Calendar day shifts
  const shiftDailyDate = (offsetDays: number) => {
    const current = new Date(`${dailyDate}T00:00:00Z`);
    current.setUTCDate(current.getUTCDate() + offsetDays);
    const newDateStr = current.toISOString().slice(0, 10);
    setDailyDate(newDateStr);
    fetchDailyNoteForDate(newDateStr);
  };

  const handleSaveDailyNote = async () => {
    try {
      setSubmitting(true);
      const res = await fetch(`/api/daily-notes/${dailyDate}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: dailyContent,
          mood: dailyMood,
          energy: dailyEnergy,
        }),
      });

      if (!res.ok) {
        throw new Error('Failed to update daily note');
      }

      toast(`Daily entry for ${dailyDate} saved`, 'success');
      fetchDailyNoteForDate(dailyDate);
    } catch (err: unknown) {
      toast(err instanceof Error ? err.message : 'Error saving daily note', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!noteTitle.trim()) return;

    try {
      setSubmitting(true);
      const res = await fetch('/api/notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: noteTitle.trim(),
          content: noteContent,
          categoryId: noteCategory || undefined,
          isPinned,
        }),
      });

      if (!res.ok) {
        throw new Error('Failed to create note');
      }

      toast('Note saved to knowledge base', 'success');
      setIsNoteModalOpen(false);
      setNoteTitle('');
      setNoteContent('');
      setNoteCategory('');
      setIsPinned(false);
      fetchNotes();
    } catch (err: unknown) {
      toast(err instanceof Error ? err.message : 'Error creating note', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreatePrompt = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!promptTitle.trim() || !promptContent.trim()) return;

    try {
      setSubmitting(true);
      const res = await fetch('/api/prompts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: promptTitle.trim(),
          description: promptDesc.trim() || undefined,
          template: promptContent.trim(),
          categoryId: promptCategory || undefined,
        }),
      });

      if (!res.ok) {
        throw new Error('Failed to create prompt');
      }

      toast('Prompt saved to library', 'success');
      setIsPromptModalOpen(false);
      setPromptTitle('');
      setPromptDesc('');
      setPromptContent('');
      setPromptCategory('');
      fetchPrompts();
    } catch (err: unknown) {
      toast(err instanceof Error ? err.message : 'Error creating prompt', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCopyPrompt = (template: string) => {
    navigator.clipboard.writeText(template);
    toast('Prompt copied to clipboard', 'info');
  };

  const confirmDeleteNote = async () => {
    if (!noteToDelete) return;
    const note = noteToDelete;
    try {
      setIsDeleting(true);
      const res = await fetch(`/api/notes/${note.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete note');
      setNotes((prev) => (Array.isArray(prev) ? prev : []).filter((n) => n.id !== note.id));
      setNoteToDelete(null);

      toast.success(`Note "${note.title}" deleted`, {
        action: {
          label: 'Undo',
          onClick: async () => {
            try {
              const restoreRes = await fetch('/api/notes', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  title: note.title,
                  content: note.content,
                  categoryId: note.categoryId || undefined,
                  isPinned: note.isPinned,
                }),
              });
              if (!restoreRes.ok) throw new Error('Failed to restore note');
              fetchNotes();
              toast.info(`Restored note "${note.title}"`);
            } catch {
              toast.error('Failed to undo note removal');
            }
          },
        },
        duration: 5000,
      });
    } catch {
      toast.error('Error deleting note');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-up">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight text-foreground">
            Notes & AI Prompts
          </h1>
          <p className="text-xs text-foreground/60 mt-0.5">
            Knowledge repository, calendar-linked daily scratchpads, mood/energy logs & prompt library
          </p>
        </div>
        <div className="flex items-center gap-2.5 w-full sm:w-auto">
          {tab === 'prompts' ? (
            <Button onClick={() => setIsPromptModalOpen(true)} size="sm" className="w-full sm:w-auto justify-center">
              <IconPlus size={14} />
              <span>New Prompt</span>
            </Button>
          ) : (
            <Button onClick={() => setIsNoteModalOpen(true)} size="sm" className="w-full sm:w-auto justify-center">
              <IconPlus size={14} />
              <span>New Note</span>
            </Button>
          )}
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex border-b border-border/80 text-xs sm:text-sm font-semibold space-x-2 sm:space-x-6 overflow-x-auto no-scrollbar -mx-3 px-3 sm:mx-0 sm:px-0">
        {[
          { id: 'notes', label: `Knowledge Base (${Array.isArray(notes) ? notes.length : 0})` },
          { id: 'daily', label: 'Daily Notes & Reflections' },
          { id: 'prompts', label: `Prompt Library (${Array.isArray(prompts) ? prompts.length : 0})` },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id as typeof tab)}
            className={clsx(
              'min-h-[44px] shrink-0 pb-3 px-2 sm:px-1 transition-all duration-150 border-b-2 cursor-pointer whitespace-nowrap flex items-center touch-manipulation',
              tab === t.id
                ? 'border-primary text-primary font-bold'
                : 'border-transparent text-foreground/60 hover:text-foreground'
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Loading state */}
      {loading ? (
        <LoadingState message="Loading your documents..." />
      ) : (
        <>
          {/* General Notes Tab */}
          {tab === 'notes' && (
            <div className="space-y-4">
              {/* Search & Filter Bar */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-3 bg-card/60 backdrop-blur-sm border border-border/80 rounded-2xl shadow-xs">
                <div className="flex items-center gap-2.5 w-full sm:w-auto">
                  <div className="w-full sm:w-72">
                    <Input
                      value={noteSearch}
                      onChange={(e) => setNoteSearch(e.target.value)}
                      placeholder="Search knowledge notes..."
                      size="sm"
                    />
                  </div>
                  <button
                    onClick={() => setFilterPinned((prev) => !prev)}
                    className={clsx(
                      'px-3 py-1.5 text-xs font-semibold rounded-lg border transition-all duration-150 shrink-0 flex items-center gap-1.5 cursor-pointer',
                      filterPinned
                        ? 'bg-amber-500/10 text-amber-500 border-amber-500/30'
                        : 'bg-card border-border/80 text-foreground/60 hover:text-foreground hover:bg-muted/70'
                    )}
                  >
                    <IconPin size={13} />
                    <span>Pinned Only</span>
                  </button>
                </div>
                {Array.isArray(categories) && categories.length > 0 && (
                  <select
                    value={selectedCategoryId}
                    onChange={(e) => setSelectedCategoryId(e.target.value)}
                    className="p-2 text-xs bg-card border border-border/80 rounded-xl text-foreground font-medium cursor-pointer w-full sm:w-auto"
                  >
                    <option value="all">All Categories</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* Notes Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {(!Array.isArray(notes) || notes.length === 0) ? (
                  <div className="col-span-full">
                    <EmptyState
                      title="No notes found"
                      description="Create your first knowledge note or clear your search criteria."
                      actionLabel="Create Note"
                      onAction={() => setIsNoteModalOpen(true)}
                      icon={<IconFileText size={32} className="text-primary" />}
                    />
                  </div>
                ) : (
                  notes.map((note) => (
                    <div
                      key={note.id}
                      className="p-5 bg-card/70 backdrop-blur-sm border border-border/80 rounded-2xl glass-inner shadow-xs space-y-3 hover:border-primary/50 hover:shadow-md transition-all duration-200 flex flex-col justify-between group"
                    >
                      <div className="space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <h2 className="text-sm font-bold text-foreground truncate group-hover:text-primary transition-colors">
                            {note.title}
                          </h2>
                          <div className="flex items-center gap-1.5 shrink-0">
                            {note.isPinned && (
                              <span className="text-[10px] px-2 py-0.5 bg-amber-500/10 text-amber-500 rounded-full font-semibold shrink-0 flex items-center gap-1 border border-amber-500/20">
                                <IconPin size={10} />
                                <span>Pinned</span>
                              </span>
                            )}
                            <button
                              type="button"
                              onClick={() => setNoteToDelete(note)}
                              title="Delete note"
                              aria-label={`Delete note ${note.title}`}
                              className="p-1 text-foreground/30 hover:text-rose-500 rounded-lg hover:bg-rose-500/10 transition-colors cursor-pointer"
                            >
                              <IconTrash size={14} />
                            </button>
                          </div>
                        </div>
                        <p className="text-xs text-foreground/70 line-clamp-4 whitespace-pre-wrap leading-relaxed">
                          {note.content}
                        </p>
                      </div>
                      <div className="text-[10px] text-foreground/45 border-t border-border/50 pt-2.5 flex items-center justify-between font-mono">
                        <span>{note.readingTimeMinutes} min read ({note.wordCount} words)</span>
                        <span>{new Date(note.updatedAt).toLocaleDateString()}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* Daily Notes & Calendar Navigation Tab */}
          {tab === 'daily' && (
            <div className="space-y-4 max-w-4xl mx-auto">
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-4 bg-card/60 backdrop-blur-sm border border-border/80 rounded-2xl shadow-xs">
                <div className="grid grid-cols-3 sm:flex items-center gap-2 w-full sm:w-auto">
                  <Button onClick={() => shiftDailyDate(-1)} variant="secondary" size="sm" className="w-full sm:w-auto justify-center">
                    <IconChevronLeft size={14} />
                    <span>Prev</span>
                  </Button>
                  <Button
                    onClick={() => {
                      const todayStr = new Date().toISOString().slice(0, 10);
                      setDailyDate(todayStr);
                      fetchDailyNoteForDate(todayStr);
                    }}
                    variant="secondary"
                    size="sm"
                    className="w-full sm:w-auto justify-center"
                  >
                    Today
                  </Button>
                  <Button onClick={() => shiftDailyDate(1)} variant="secondary" size="sm" className="w-full sm:w-auto justify-center">
                    <span>Next</span>
                    <IconChevronRight size={14} />
                  </Button>
                </div>

                <div className="flex items-center justify-between sm:justify-start gap-2 w-full sm:w-auto">
                  <span className="inline-flex items-center gap-1.5 text-xs text-foreground/60 sm:hidden">
                    <IconCalendar size={14} className="text-foreground/50" />
                    <span>Date:</span>
                  </span>
                  <input
                    type="date"
                    value={dailyDate}
                    onChange={(e) => {
                      setDailyDate(e.target.value);
                      fetchDailyNoteForDate(e.target.value);
                    }}
                    className="flex-1 sm:flex-initial px-3 py-2 text-base sm:text-xs min-h-[44px] sm:min-h-[36px] bg-card border border-border/80 rounded-xl text-foreground font-mono cursor-pointer touch-manipulation"
                  />
                </div>
              </div>

              <div className="p-6 bg-card/80 backdrop-blur-sm border border-border/80 rounded-2xl glass-inner shadow-xs space-y-5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-foreground/75 mb-1.5">
                      Mindset & Mood
                    </label>
                    <select
                      value={dailyMood}
                      onChange={(e) => setDailyMood(e.target.value)}
                      className="w-full p-2.5 text-xs bg-card border border-border/80 rounded-xl text-foreground focus:outline-none focus:ring-2 focus:ring-primary font-medium cursor-pointer"
                    >
                      <option value="ecstatic">Optimal / Ecstatic</option>
                      <option value="good">Positive / Focused</option>
                      <option value="neutral">Neutral / Steady</option>
                      <option value="tired">Tired / Low Energy</option>
                      <option value="stressed">Overwhelmed / Stressed</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-foreground/75 mb-1.5">
                      Energy Level (1–5 Scale)
                    </label>
                    <select
                      value={dailyEnergy}
                      onChange={(e) => setDailyEnergy(Number(e.target.value))}
                      className="w-full p-2.5 text-xs bg-card border border-border/80 rounded-xl text-foreground focus:outline-none focus:ring-2 focus:ring-primary font-medium cursor-pointer"
                    >
                      <option value={5}>Level 5 — Peak Focus & Energy</option>
                      <option value={4}>Level 4 — High Productivity</option>
                      <option value={3}>Level 3 — Balanced Routine</option>
                      <option value={2}>Level 2 — Sluggish</option>
                      <option value={1}>Level 1 — Exhausted / Rest Needed</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-foreground/75 mb-1.5">
                    Reflections, Highlights & Focus for {dailyDate}
                  </label>
                  <textarea
                    rows={8}
                    value={dailyContent}
                    onChange={(e) => setDailyContent(e.target.value)}
                    placeholder="Log daily wins, lessons learned, or tactical scratchpad items..."
                    className="w-full p-4 text-xs bg-background border border-border/80 rounded-xl text-foreground focus:outline-none focus:ring-2 focus:ring-primary leading-relaxed shadow-xs"
                  />
                </div>

                <div className="flex items-center justify-between border-t border-border/60 pt-4">
                  <span className="text-[11px] text-foreground/45 font-mono">
                    Word count: {dailyContent.trim() ? dailyContent.trim().split(/\s+/).length : 0}
                  </span>
                  <Button
                    onClick={handleSaveDailyNote}
                    isLoading={submitting}
                    disabled={submitting}
                    size="sm"
                  >
                    Save Daily Note
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* AI Prompts Tab */}
          {tab === 'prompts' && (
            <div className="space-y-4">
              <div className="p-3 bg-card/60 backdrop-blur-sm border border-border/80 rounded-2xl shadow-xs">
                <Input
                  value={promptSearch}
                  onChange={(e) => setPromptSearch(e.target.value)}
                  placeholder="Search prompts by title, description, or template text..."
                  size="sm"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {(!Array.isArray(prompts) || prompts.length === 0) ? (
                  <div className="col-span-full">
                    <EmptyState
                      title="No prompt templates found"
                      description="Add prompt templates for LLMs, system workflows, and automation."
                      actionLabel="Create Prompt"
                      onAction={() => setIsPromptModalOpen(true)}
                      icon={<IconSparkles size={32} className="text-primary" />}
                    />
                  </div>
                ) : (
                  prompts.map((p) => {
                    const template = p.latestVersion?.template || '';
                    return (
                      <div
                        key={p.id}
                        className="p-5 bg-card/70 backdrop-blur-sm border border-border/80 rounded-2xl glass-inner shadow-xs space-y-3.5 hover:border-primary/50 hover:shadow-md transition-all duration-200 flex flex-col justify-between"
                      >
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <h2 className="text-sm font-bold text-foreground">{p.title}</h2>
                            <span className="text-[10px] px-2 py-0.5 bg-primary/10 text-primary border border-primary/20 rounded-md font-mono font-semibold">
                              v{p.currentVersion}
                            </span>
                          </div>
                          {p.description && (
                            <p className="text-xs text-foreground/60">{p.description}</p>
                          )}
                          <div className="p-3 bg-muted/40 border border-border/70 rounded-xl font-mono text-[11px] text-foreground/80 whitespace-pre-wrap max-h-40 overflow-y-auto">
                            {template}
                          </div>
                        </div>

                        <div className="flex items-center justify-between pt-3 border-t border-border/60">
                          <span className="text-[10px] text-foreground/45 font-mono truncate max-w-xs">
                            Variables:{' '}
                            {template.match(/\{\{([^}]+)\}\}/g)?.join(', ') || 'None'}
                          </span>
                          <Button
                            onClick={() => handleCopyPrompt(template)}
                            variant="secondary"
                            size="sm"
                          >
                            <IconCopy size={13} />
                            <span>Copy</span>
                          </Button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </>
      )}

      {/* New Note Modal */}
      <Modal
        isOpen={isNoteModalOpen}
        onClose={() => setIsNoteModalOpen(false)}
        title="Create Knowledge Note"
        size="md"
      >
        <form onSubmit={handleCreateNote} className="space-y-4">
          <Input
            label="Title"
            required
            value={noteTitle}
            onChange={(e) => setNoteTitle(e.target.value)}
            placeholder="e.g. Architecture Decisions, System Design"
            autoFocus
          />

          <CategoryDropdown
            value={noteCategory}
            onChange={(id) => setNoteCategory(id)}
            domain="note"
            categories={categories}
            onCategoriesChange={fetchCategories}
            label="Category (Optional)"
            placeholder="Search or select category..."
          />

          <div>
            <label className="block text-xs font-semibold text-foreground/75 mb-1.5">
              Content (Markdown)
            </label>
            <textarea
              rows={6}
              value={noteContent}
              onChange={(e) => setNoteContent(e.target.value)}
              placeholder="Write your note contents..."
              className="w-full p-3 text-base sm:text-xs bg-background border border-border/80 rounded-xl text-foreground focus:outline-none focus:ring-2 focus:ring-primary touch-manipulation min-h-[140px]"
            />
          </div>

          <div className="flex items-center gap-2.5 min-h-[44px]">
            <input
              type="checkbox"
              id="pinNote"
              checked={isPinned}
              onChange={(e) => setIsPinned(e.target.checked)}
              className="h-5 w-5 sm:h-4 sm:w-4 rounded border-border text-primary focus:ring-primary cursor-pointer touch-manipulation"
            />
            <label htmlFor="pinNote" className="text-xs font-medium text-foreground/75 cursor-pointer touch-manipulation">
              Pin to top of knowledge base
            </label>
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-border/60">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setIsNoteModalOpen(false)}
              disabled={submitting}
              size="sm"
              className="flex-1 sm:flex-initial"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              isLoading={submitting}
              disabled={submitting}
              size="sm"
              className="flex-1 sm:flex-initial"
            >
              Save Note
            </Button>
          </div>
        </form>
      </Modal>

      {/* New Prompt Modal */}
      <Modal
        isOpen={isPromptModalOpen}
        onClose={() => setIsPromptModalOpen(false)}
        title="Add AI Prompt Template"
        size="md"
      >
        <form onSubmit={handleCreatePrompt} className="space-y-4">
          <Input
            label="Title"
            required
            value={promptTitle}
            onChange={(e) => setPromptTitle(e.target.value)}
            placeholder="e.g. Code Review Assistant"
            autoFocus
          />

          <Input
            label="Description"
            value={promptDesc}
            onChange={(e) => setPromptDesc(e.target.value)}
            placeholder="When to use this prompt..."
          />

          <div>
            <label className="block text-xs font-semibold text-foreground/75 mb-1.5">
              Prompt Template (Use {'{{variable}}'} placeholders) <span className="text-rose-500">*</span>
            </label>
            <textarea
              rows={5}
              required
              value={promptContent}
              onChange={(e) => setPromptContent(e.target.value)}
              placeholder="Review the following code for security and edge cases: {{code}}"
              className="w-full p-3 font-mono text-base sm:text-xs bg-background border border-border/80 rounded-xl text-foreground focus:outline-none focus:ring-2 focus:ring-primary shadow-xs touch-manipulation min-h-[120px]"
            />
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-border/60">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setIsPromptModalOpen(false)}
              disabled={submitting}
              size="sm"
              className="flex-1 sm:flex-initial"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              isLoading={submitting}
              disabled={submitting}
              size="sm"
              className="flex-1 sm:flex-initial"
            >
              Save Prompt
            </Button>
          </div>
        </form>
      </Modal>

      {/* Reusable Confirmation Modal for Destructive Delete */}
      <ConfirmationModal
        isOpen={Boolean(noteToDelete)}
        onClose={() => setNoteToDelete(null)}
        onConfirm={confirmDeleteNote}
        isLoading={isDeleting}
        title="Delete Knowledge Note"
        description={
          noteToDelete
            ? `Are you sure you want to permanently delete "${noteToDelete.title}"? You will have 5 seconds to undo.`
            : 'Are you sure you want to delete this note?'
        }
        confirmLabel="Delete Note"
      />
    </div>
  );
}
