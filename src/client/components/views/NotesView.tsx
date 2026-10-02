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
  IconEdit,
  IconStar,
  IconEye,
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

  // Modals & CRUD state
  const [isNoteModalOpen, setIsNoteModalOpen] = useState(false);
  const [isPromptModalOpen, setIsPromptModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [editingNote, setEditingNote] = useState<NoteData | null>(null);
  const [noteToDelete, setNoteToDelete] = useState<NoteData | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Prompt CRUD specific state
  const [editingPrompt, setEditingPrompt] = useState<PromptData | null>(null);
  const [promptToDelete, setPromptToDelete] = useState<PromptData | null>(null);
  const [viewingPrompt, setViewingPrompt] = useState<PromptData | null>(null);
  const [isPromptDeleting, setIsPromptDeleting] = useState(false);

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
  const [promptTargetModel, setPromptTargetModel] = useState('gpt-4o');
  const [promptIsFavorite, setPromptIsFavorite] = useState(false);

  // Fetch general notes - Zero mock baseline
  const fetchNotes = useCallback(async () => {
    try {
      const qParams = new URLSearchParams();
      if (noteSearch) qParams.set('q', noteSearch);
      if (selectedCategoryId !== 'all') qParams.set('categoryId', selectedCategoryId);
      if (filterPinned) qParams.set('isPinned', 'true');

      const res = await fetch(`/api/notes?${qParams.toString()}`);
      if (res.ok) {
        const { data: json } = await safeParseJson<ApiPaginatedResponse<NoteData>>(res);
        const items = json?.data?.items || (Array.isArray(json?.data) ? json.data : []);
        setNotes(items);
        return;
      }
      setNotes([]);
    } catch {
      setNotes([]);
    }
  }, [noteSearch, selectedCategoryId, filterPinned]);

  // Fetch daily note for date - Zero mock baseline
  const fetchDailyNoteForDate = useCallback(async (date: string) => {
    try {
      const res = await fetch(`/api/daily-notes/${date}`);
      if (res.ok) {
        const { data: json } = await safeParseJson<ApiSuccessResponse<DailyNoteData>>(res);
        if (json && json.data) {
          setDailyNote(json.data);
          setDailyContent(json.data.content || '');
          setDailyMood(json.data.mood != null ? String(json.data.mood) : 'good');
          setDailyEnergy(json.data.energy ?? 4);
          return;
        }
      }
      setDailyNote(null);
      setDailyContent('');
      setDailyMood('good');
      setDailyEnergy(4);
    } catch {
      setDailyNote(null);
      setDailyContent('');
    }
  }, []);

  // Fetch prompts - Zero mock baseline
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
        return;
      }
      setPrompts([]);
    } catch {
      setPrompts([]);
    }
  }, [promptSearch]);

  // Fetch categories - Zero mock baseline
  const fetchCategories = useCallback(async () => {
    try {
      const res = await fetch('/api/categories?domain=note');
      if (res.ok) {
        const { data: json } = await safeParseJson<ApiSuccessResponse<CategoryData[]>>(res);
        if (json && json.data && json.data.length > 0) {
          setCategories(json.data);
          return;
        }
      }
      setCategories([]);
    } catch {
      setCategories([]);
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

  const handleOpenCreateNote = () => {
    setEditingNote(null);
    setNoteTitle('');
    setNoteContent('');
    setNoteCategory('');
    setIsPinned(false);
    setIsNoteModalOpen(true);
  };

  const handleOpenEditNote = (note: NoteData) => {
    setEditingNote(note);
    setNoteTitle(note.title);
    setNoteContent(note.content);
    setNoteCategory(note.categoryId || '');
    setIsPinned(Boolean(note.isPinned));
    setIsNoteModalOpen(true);
  };

  const handleSaveNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!noteTitle.trim()) return;

    try {
      setSubmitting(true);
      if (editingNote) {
        const res = await fetch(`/api/notes/${editingNote.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: noteTitle.trim(),
            content: noteContent,
            categoryId: noteCategory || null,
            isPinned,
          }),
        });

        if (!res.ok) {
          throw new Error('Failed to update note');
        }

        toast.success(`Note "${noteTitle.trim()}" updated`);
        setNotes((prev) =>
          (Array.isArray(prev) ? prev : []).map((n) =>
            n.id === editingNote.id
              ? {
                  ...n,
                  title: noteTitle.trim(),
                  content: noteContent,
                  categoryId: noteCategory || null,
                  isPinned,
                }
              : n
          )
        );
      } else {
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

        toast.success('Note saved to knowledge base');
      }

      setIsNoteModalOpen(false);
      setEditingNote(null);
      setNoteTitle('');
      setNoteContent('');
      setNoteCategory('');
      setIsPinned(false);
      fetchNotes();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Error saving note');
    } finally {
      setSubmitting(false);
    }
  };

  const handleOpenCreatePrompt = () => {
    setEditingPrompt(null);
    setPromptTitle('');
    setPromptDesc('');
    setPromptContent('');
    setPromptCategory('');
    setPromptTargetModel('gpt-4o');
    setPromptIsFavorite(false);
    setIsPromptModalOpen(true);
  };

  const handleOpenEditPrompt = (prompt: PromptData) => {
    setEditingPrompt(prompt);
    setPromptTitle(prompt.title);
    setPromptDesc(prompt.description || '');
    setPromptContent(prompt.latestVersion?.template || '');
    setPromptCategory(prompt.categoryId || '');
    setPromptTargetModel(prompt.targetModel || 'gpt-4o');
    setPromptIsFavorite(Boolean(prompt.isFavorite));
    setIsPromptModalOpen(true);
  };

  const handleSavePrompt = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!promptTitle.trim() || !promptContent.trim()) return;

    try {
      setSubmitting(true);
      if (editingPrompt) {
        // 1. Update metadata
        const patchRes = await fetch(`/api/prompts/${editingPrompt.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: promptTitle.trim(),
            description: promptDesc.trim() || undefined,
            targetModel: promptTargetModel || undefined,
            categoryId: promptCategory || undefined,
            isFavorite: promptIsFavorite,
          }),
        });

        if (!patchRes.ok) {
          throw new Error('Failed to update prompt details');
        }

        // 2. If template was edited, publish a new version
        const originalTemplate = editingPrompt.latestVersion?.template || '';
        if (promptContent.trim() !== originalTemplate.trim()) {
          const versionRes = await fetch(`/api/prompts/${editingPrompt.id}/versions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              template: promptContent.trim(),
              changeNotes: 'Updated template via Prompt Library',
            }),
          });
          if (!versionRes.ok) {
            toast.error('Prompt metadata updated, but version bump failed');
          }
        }

        toast.success(`Prompt "${promptTitle.trim()}" updated`);
      } else {
        const res = await fetch('/api/prompts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: promptTitle.trim(),
            description: promptDesc.trim() || undefined,
            template: promptContent.trim(),
            targetModel: promptTargetModel || undefined,
            categoryId: promptCategory || undefined,
            isFavorite: promptIsFavorite,
          }),
        });

        if (!res.ok) {
          throw new Error('Failed to create prompt');
        }

        toast.success(`Prompt "${promptTitle.trim()}" added to library`);
      }

      setIsPromptModalOpen(false);
      setEditingPrompt(null);
      setPromptTitle('');
      setPromptDesc('');
      setPromptContent('');
      setPromptCategory('');
      fetchPrompts();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Error saving prompt');
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleFavoritePrompt = async (prompt: PromptData, e: React.MouseEvent) => {
    e.stopPropagation();
    const newFav = !prompt.isFavorite;
    setPrompts((prev) =>
      (Array.isArray(prev) ? prev : []).map((p) =>
        p.id === prompt.id ? { ...p, isFavorite: newFav } : p
      )
    );

    try {
      const res = await fetch(`/api/prompts/${prompt.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isFavorite: newFav }),
      });
      if (!res.ok) {
        fetchPrompts();
      } else {
        toast.info(newFav ? 'Prompt marked as favorite' : 'Removed from favorites');
      }
    } catch {
      fetchPrompts();
    }
  };

  const confirmDeletePrompt = async () => {
    if (!promptToDelete) return;
    try {
      setIsPromptDeleting(true);
      const res = await fetch(`/api/prompts/${promptToDelete.id}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        throw new Error('Failed to delete prompt');
      }
      toast.success(`Prompt "${promptToDelete.title}" deleted`);
      setPrompts((prev) => (Array.isArray(prev) ? prev : []).filter((p) => p.id !== promptToDelete.id));
      setPromptToDelete(null);
      if (viewingPrompt?.id === promptToDelete.id) {
        setViewingPrompt(null);
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Error deleting prompt');
    } finally {
      setIsPromptDeleting(false);
    }
  };

  const handleCopyPrompt = (template: string) => {
    navigator.clipboard.writeText(template);
    toast.info('Prompt copied to clipboard');
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
    <div className="space-y-6 max-w-7xl mx-auto pb-12 animate-fade-up">
      {/* ─── Executive Header & Actions ─── */}
      <div className="bg-surface-container-lowest rounded-2xl p-5 sm:p-6 border border-border/70 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5 flex-wrap">
            <h1 className="font-headline-lg text-2xl sm:text-3xl font-bold tracking-tight text-on-surface">
              Notes & Prompt Library
            </h1>
            <span className="font-label-caps text-xs px-2.5 py-0.5 rounded-full bg-secondary-container/40 text-secondary font-mono font-semibold">
              {notes.length} Notes • {prompts.length} Prompts
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2.5 w-full sm:w-auto">
          {tab === 'prompts' ? (
            <button
              onClick={handleOpenCreatePrompt}
              className="flex items-center gap-2 bg-primary hover:bg-primary-container text-on-primary px-4 py-2 rounded-xl font-label-md text-label-md font-semibold shadow-sm hover:shadow-[0_4px_16px_rgba(70,72,212,0.28)] transition-all cursor-pointer w-full sm:w-auto justify-center"
            >
              <IconPlus size={16} />
              <span>New Prompt</span>
            </button>
          ) : (
            <button
              onClick={handleOpenCreateNote}
              className="flex items-center gap-2 bg-primary hover:bg-primary-container text-on-primary px-4 py-2 rounded-xl font-label-md text-label-md font-semibold shadow-sm hover:shadow-[0_4px_16px_rgba(70,72,212,0.28)] transition-all cursor-pointer w-full sm:w-auto justify-center"
            >
              <IconPlus size={16} />
              <span>New Note</span>
            </button>
          )}
        </div>
      </div>

      {/* ─── Navigation Tabs ─── */}
      <div className="flex border-b border-border/70 text-xs sm:text-sm font-semibold space-x-2 sm:space-x-6 overflow-x-auto no-scrollbar">
        {[
          { id: 'notes', label: `Knowledge Base (${Array.isArray(notes) ? notes.length : 0})` },
          { id: 'daily', label: 'Daily Notes & Reflections' },
          { id: 'prompts', label: `Prompt Library (${Array.isArray(prompts) ? prompts.length : 0})` },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id as typeof tab)}
            className={clsx(
              'min-h-[44px] shrink-0 pb-3 px-2 sm:px-1 transition-all duration-150 border-b-2 cursor-pointer whitespace-nowrap flex items-center font-title-sm text-title-sm',
              tab === t.id
                ? 'border-primary text-primary font-bold'
                : 'border-transparent text-on-surface-variant hover:text-on-surface'
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
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-3 bg-surface-container-lowest border border-border/70 rounded-2xl shadow-sm">
                <div className="flex items-center gap-2.5 w-full sm:w-auto">
                  <div className="w-full sm:w-72">
                    <Input
                      value={noteSearch}
                      onChange={(e) => setNoteSearch(e.target.value)}
                      placeholder="Search knowledge notes..."
                    />
                  </div>
                  <button
                    onClick={() => setFilterPinned((prev) => !prev)}
                    className={clsx(
                      'px-3 py-1.5 text-xs font-semibold rounded-xl border transition-all duration-150 shrink-0 flex items-center gap-1.5 cursor-pointer',
                      filterPinned
                        ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30 font-bold'
                        : 'bg-surface-container-low text-on-surface-variant border-border/60 hover:text-on-surface'
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
                    className="p-2 text-xs bg-surface-container-low border border-border/70 rounded-xl text-on-surface font-medium cursor-pointer w-full sm:w-auto"
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
                      onAction={handleOpenCreateNote}
                      icon={<IconFileText size={32} className="text-primary" />}
                    />
                  </div>
                ) : (
                  notes.map((note) => (
                    <div
                      key={note.id}
                      className="p-5 bg-surface-container-lowest border border-border/70 rounded-2xl space-y-3 hover:border-primary/40 hover:shadow-md transition-all duration-200 flex flex-col justify-between group shadow-sm"
                    >
                      <div className="space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <h2 className="font-title-sm text-title-sm font-bold text-on-surface truncate group-hover:text-primary transition-colors">
                            {note.title}
                          </h2>
                          <div className="flex items-center gap-1.5 shrink-0">
                            {note.isPinned && (
                              <span className="text-[10px] px-2 py-0.5 bg-amber-500/15 text-amber-600 dark:text-amber-400 rounded-full font-semibold shrink-0 flex items-center gap-1">
                                <IconPin size={10} />
                                <span>Pinned</span>
                              </span>
                            )}
                            <button
                              type="button"
                              onClick={() => handleOpenEditNote(note)}
                              title="Edit note"
                              aria-label={`Edit note ${note.title}`}
                              className="p-1.5 text-outline hover:text-on-surface hover:bg-surface-container rounded-lg transition-colors cursor-pointer"
                            >
                              <IconEdit size={14} />
                            </button>
                            <button
                              type="button"
                              onClick={() => setNoteToDelete(note)}
                              title="Delete note"
                              aria-label={`Delete note ${note.title}`}
                              className="p-1.5 text-outline hover:text-rose-500 hover:bg-rose-500/10 rounded-lg transition-colors cursor-pointer"
                            >
                              <IconTrash size={14} />
                            </button>
                          </div>
                        </div>
                        <p className="font-body-sm text-body-sm text-on-surface-variant line-clamp-4 whitespace-pre-wrap leading-relaxed">
                          {note.content}
                        </p>
                      </div>
                      <div className="text-[10px] text-outline border-t border-border/50 pt-2.5 flex items-center justify-between font-mono">
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

              <div className="p-6 bg-surface-container-lowest border border-border/70 rounded-2xl shadow-sm space-y-5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-on-surface mb-1.5">
                      Mindset & Mood
                    </label>
                    <select
                      value={dailyMood}
                      onChange={(e) => setDailyMood(e.target.value)}
                      className="w-full p-2.5 text-xs bg-surface-container-low border border-border/70 rounded-xl text-on-surface focus:outline-none focus:ring-2 focus:ring-primary font-medium cursor-pointer"
                    >
                      <option value="ecstatic">Optimal / Ecstatic</option>
                      <option value="good">Positive / Focused</option>
                      <option value="neutral">Neutral / Steady</option>
                      <option value="tired">Tired / Low Energy</option>
                      <option value="stressed">Overwhelmed / Stressed</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-on-surface mb-1.5">
                      Energy Level (1–5 Scale)
                    </label>
                    <select
                      value={dailyEnergy}
                      onChange={(e) => setDailyEnergy(Number(e.target.value))}
                      className="w-full p-2.5 text-xs bg-surface-container-low border border-border/70 rounded-xl text-on-surface focus:outline-none focus:ring-2 focus:ring-primary font-medium cursor-pointer"
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
                  <label className="block text-xs font-semibold text-on-surface mb-1.5">
                    Reflections, Highlights & Focus for {dailyDate}
                  </label>
                  <textarea
                    rows={8}
                    value={dailyContent}
                    onChange={(e) => setDailyContent(e.target.value)}
                    placeholder="Log daily wins, lessons learned, or tactical scratchpad items..."
                    className="w-full p-4 text-xs bg-surface-container-low border border-border/70 rounded-xl text-on-surface focus:outline-none focus:ring-2 focus:ring-primary leading-relaxed shadow-xs"
                  />
                </div>

                <div className="flex items-center justify-between border-t border-border/50 pt-4">
                  <span className="text-[11px] text-outline font-mono">
                    Word count: {dailyContent.trim() ? dailyContent.trim().split(/\s+/).length : 0}
                  </span>
                  <Button
                    onClick={handleSaveDailyNote}
                    isLoading={submitting}
                    disabled={submitting}
                    size="sm"
                    className="rounded-xl shadow-sm hover:shadow-[0_4px_16px_rgba(70,72,212,0.28)]"
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
              <div className="p-3 bg-surface-container-lowest border border-border/70 rounded-2xl shadow-sm flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                <div className="w-full sm:w-96">
                  <Input
                    value={promptSearch}
                    onChange={(e) => setPromptSearch(e.target.value)}
                    placeholder="Search prompts by title, description, or template text..."
                  />
                </div>
                <div className="flex items-center gap-2 text-xs font-mono text-on-surface-variant">
                  <span>{prompts.length} prompt templates configured</span>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {(!Array.isArray(prompts) || prompts.length === 0) ? (
                  <div className="col-span-full">
                    <EmptyState
                      title="No prompt templates found"
                      description="Create modular prompt templates with variables for automated AI reasoning and system workflows."
                      actionLabel="Create Prompt"
                      onAction={handleOpenCreatePrompt}
                      icon={<IconSparkles size={32} className="text-primary" />}
                    />
                  </div>
                ) : (
                  prompts.map((p) => {
                    const template = p.latestVersion?.template || '';
                    return (
                      <div
                        key={p.id}
                        className="p-5 bg-surface-container-lowest border border-border/70 rounded-2xl space-y-3.5 hover:border-primary/40 hover:shadow-md transition-all duration-200 flex flex-col justify-between shadow-sm group"
                      >
                        <div className="space-y-2">
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2 min-w-0">
                              <button
                                type="button"
                                onClick={(e) => handleToggleFavoritePrompt(p, e)}
                                title={p.isFavorite ? 'Starred (Click to unfavorite)' : 'Click to star'}
                                className="p-1 text-on-surface-variant hover:text-amber-400 rounded-lg transition-colors cursor-pointer shrink-0"
                              >
                                <IconStar
                                  size={16}
                                  fill={p.isFavorite ? 'currentColor' : 'none'}
                                  className={p.isFavorite ? 'text-amber-400 fill-amber-400' : 'text-on-surface-variant/40'}
                                />
                              </button>
                              <h2 className="font-title-sm text-title-sm font-bold text-on-surface truncate">
                                {p.title}
                              </h2>
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0">
                              {p.targetModel && (
                                <span className="px-2 py-0.5 bg-surface-container text-on-surface-variant rounded-md font-mono text-[10px]">
                                  {p.targetModel}
                                </span>
                              )}
                              <span className="px-2 py-0.5 bg-primary-fixed/40 text-primary rounded-md font-mono text-[10px] font-semibold">
                                v{p.currentVersion}
                              </span>
                            </div>
                          </div>

                          {p.description && (
                            <p className="font-body-sm text-body-sm text-on-surface-variant line-clamp-2">
                              {p.description}
                            </p>
                          )}

                          <div
                            onClick={() => setViewingPrompt(p)}
                            className="p-3 bg-surface-container-low border border-border/60 rounded-xl font-mono text-[11px] text-on-surface whitespace-pre-wrap max-h-36 overflow-hidden relative cursor-pointer hover:border-primary/40 transition-colors"
                            title="Click to view full prompt template"
                          >
                            {template}
                            <div className="absolute inset-x-0 bottom-0 h-6 bg-gradient-to-t from-surface-container-low to-transparent pointer-events-none" />
                          </div>
                        </div>

                        <div className="flex items-center justify-between pt-3 border-t border-border/50 gap-2 flex-wrap">
                          <span className="text-[10px] text-outline font-mono truncate max-w-[140px] sm:max-w-[180px]">
                            {template.match(/\{\{([^}]+)\}\}/g)?.join(', ') || 'No variables'}
                          </span>

                          {/* Clear UI Action Controls: View, Copy, Edit, Delete */}
                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              type="button"
                              onClick={() => setViewingPrompt(p)}
                              title="View prompt details"
                              className="p-1.5 rounded-lg bg-surface-container-low hover:bg-surface-container text-on-surface font-title-sm text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                            >
                              <IconEye size={14} />
                              <span className="hidden sm:inline">View</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleCopyPrompt(template)}
                              title="Copy prompt"
                              className="p-1.5 rounded-lg bg-surface-container-low hover:bg-surface-container text-on-surface font-title-sm text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                            >
                              <IconCopy size={14} />
                              <span className="hidden sm:inline">Copy</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleOpenEditPrompt(p)}
                              title="Edit prompt"
                              className="p-1.5 rounded-lg bg-surface-container-low hover:bg-surface-container text-on-surface font-title-sm text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                            >
                              <IconEdit size={14} />
                              <span className="hidden sm:inline">Edit</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => setPromptToDelete(p)}
                              title="Delete prompt"
                              className="p-1.5 rounded-lg bg-surface-container-low hover:bg-rose-500/10 text-on-surface-variant hover:text-rose-500 font-title-sm text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                            >
                              <IconTrash size={14} />
                            </button>
                          </div>
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

      {/* Note Create / Edit Modal */}
      <Modal
        isOpen={isNoteModalOpen}
        onClose={() => {
          setIsNoteModalOpen(false);
          setEditingNote(null);
        }}
        title={editingNote ? 'Edit Knowledge Note' : 'Create Knowledge Note'}
        size="md"
      >
        <form onSubmit={handleSaveNote} className="space-y-4">
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
              onClick={() => {
                setIsNoteModalOpen(false);
                setEditingNote(null);
              }}
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
              {editingNote ? 'Save Changes' : 'Save Note'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Prompt Create / Edit Modal */}
      <Modal
        isOpen={isPromptModalOpen}
        onClose={() => {
          setIsPromptModalOpen(false);
          setEditingPrompt(null);
        }}
        title={editingPrompt ? 'Edit AI Prompt Template' : 'Add AI Prompt Template'}
        size="md"
      >
        <form onSubmit={handleSavePrompt} className="space-y-4">
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

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-foreground/75 mb-1.5">
                Target Model
              </label>
              <select
                value={promptTargetModel}
                onChange={(e) => setPromptTargetModel(e.target.value)}
                className="w-full p-2.5 text-xs bg-background border border-border/80 rounded-xl text-foreground focus:outline-none focus:ring-2 focus:ring-primary font-medium"
              >
                <option value="gpt-4o">OpenAI GPT-4o</option>
                <option value="claude-3-5-sonnet">Claude 3.5 Sonnet</option>
                <option value="gemini-1.5-pro">Gemini 1.5 Pro</option>
                <option value="deepseek-r1">DeepSeek R1</option>
                <option value="general">General / Agnostic</option>
              </select>
            </div>

            <CategoryDropdown
              value={promptCategory}
              onChange={(id) => setPromptCategory(id)}
              domain="note"
              categories={categories}
              onCategoriesChange={fetchCategories}
              label="Category (Optional)"
              placeholder="Select category..."
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-foreground/75 mb-1.5">
              Prompt Template (Use {'{{variable}}'} placeholders) <span className="text-rose-500">*</span>
            </label>
            <textarea
              rows={6}
              required
              value={promptContent}
              onChange={(e) => setPromptContent(e.target.value)}
              placeholder="Review the following code for security and edge cases: {{code}}"
              className="w-full p-3 font-mono text-base sm:text-xs bg-background border border-border/80 rounded-xl text-foreground focus:outline-none focus:ring-2 focus:ring-primary shadow-xs touch-manipulation min-h-[140px]"
            />
          </div>

          <div className="flex items-center gap-2.5">
            <input
              type="checkbox"
              id="favoritePrompt"
              checked={promptIsFavorite}
              onChange={(e) => setPromptIsFavorite(e.target.checked)}
              className="h-4 w-4 rounded border-border text-primary focus:ring-primary cursor-pointer"
            />
            <label htmlFor="favoritePrompt" className="text-xs font-medium text-foreground/75 cursor-pointer">
              Favorite prompt (starred on prompt card)
            </label>
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-border/60">
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setIsPromptModalOpen(false);
                setEditingPrompt(null);
              }}
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
              {editingPrompt ? 'Save Changes' : 'Save Prompt'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Inspect / View Prompt Details Modal */}
      {viewingPrompt && (
        <Modal
          isOpen={Boolean(viewingPrompt)}
          onClose={() => setViewingPrompt(null)}
          title={viewingPrompt.title}
          size="lg"
        >
          <div className="space-y-4">
            <div className="flex items-center justify-between text-xs text-on-surface-variant border-b border-border/50 pb-2.5">
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded bg-surface-container font-mono text-[11px] font-semibold text-primary">
                  {viewingPrompt.targetModel || 'General'}
                </span>
                <span className="font-mono text-[11px]">Version {viewingPrompt.currentVersion}</span>
              </div>
              <span className="font-mono text-[11px]">{new Date(viewingPrompt.updatedAt).toLocaleDateString()}</span>
            </div>

            {viewingPrompt.description && (
              <p className="text-xs text-on-surface-variant leading-relaxed">
                {viewingPrompt.description}
              </p>
            )}

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-semibold text-on-surface">Template Text</label>
                <button
                  type="button"
                  onClick={() => handleCopyPrompt(viewingPrompt.latestVersion?.template || '')}
                  className="text-xs text-primary hover:underline font-semibold flex items-center gap-1 cursor-pointer"
                >
                  <IconCopy size={12} />
                  <span>Copy</span>
                </button>
              </div>
              <pre className="p-3.5 bg-surface-container-low border border-border/70 rounded-xl font-mono text-xs text-on-surface whitespace-pre-wrap max-h-72 overflow-y-auto">
                {viewingPrompt.latestVersion?.template || 'No template text'}
              </pre>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-border/60">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  const p = viewingPrompt;
                  setViewingPrompt(null);
                  handleOpenEditPrompt(p);
                }}
              >
                <IconEdit size={13} className="mr-1" /> Edit Prompt
              </Button>
              <Button
                size="sm"
                onClick={() => setViewingPrompt(null)}
              >
                Close
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Note Delete Confirmation Modal */}
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

      {/* Prompt Delete Confirmation Modal */}
      <ConfirmationModal
        isOpen={Boolean(promptToDelete)}
        onClose={() => setPromptToDelete(null)}
        onConfirm={confirmDeletePrompt}
        isLoading={isPromptDeleting}
        title="Delete Prompt Template"
        description={
          promptToDelete
            ? `Are you sure you want to permanently delete "${promptToDelete.title}" and its version history? This action cannot be undone.`
            : 'Are you sure you want to delete this prompt template?'
        }
        confirmLabel="Delete Prompt"
        variant="destructive"
      />
    </div>
  );
}
