import React, { useState, useEffect, useMemo } from 'react';
import { clsx } from 'clsx';
import { useToast } from '../ui/Toast';
import { Button } from '../ui/Button';
import { Modal } from '../ui/Modal';
import { Input } from '../ui/Input';
import {
  IconChefHat,
  IconCheck,
  IconClock,
  IconPlus,
  IconDownload,
  IconZap,
  IconSearch,
  IconRotateCcw,
  IconTrash,
  IconEdit,
} from '../ui/Icons';

export interface CulinaryRecipe {
  id: string;
  name: string;
  category: 'high_protein' | 'quick_prep' | 'meal_prep' | 'low_gi' | 'dessert';
  categoryLabel: string;
  cuisine: string;
  prepTimeMinutes: number;
  cookTimeMinutes: number;
  baseServings: number;
  calories: number;
  proteinGrams: number;
  carbsGrams: number;
  fatGrams: number;
  pantryMatchPercent: number;
  isPinned?: boolean;
  tags: string[];
  ingredients: Array<{
    name: string;
    baseGramsOrMl: number;
    unit: string;
  }>;
}

interface KitchenTimer {
  id: string;
  name: string;
  stage: string;
  totalSeconds: number;
  remainingSeconds: number;
  isRunning: boolean;
  isUrgent?: boolean;
}

interface ChecklistTask {
  id: string;
  phase: 1 | 2 | 3;
  text: string;
  badge: string;
  isDone: boolean;
}

const CATEGORY_LABELS: Record<string, string> = {
  high_protein: 'High Protein',
  quick_prep: 'Quick Prep',
  meal_prep: 'Meal Prep',
  low_gi: 'Low GI / Fuel',
  dessert: 'Healthy Dessert',
};

const DAYS_OF_WEEK = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

interface CulinaryViewProps {
  onNavigate?: (view: string) => void;
}

export function CulinaryView({ onNavigate: _onNavigate }: CulinaryViewProps) {
  const { toast } = useToast();

  const [activeTab, setActiveTab] = useState<'list' | 'execution'>('list');
  const [recipes, setRecipes] = useState<CulinaryRecipe[]>([]);
  const [activeRecipeId, setActiveRecipeId] = useState<string | null>(null);
  const [servings, setServings] = useState<number>(2);
  const [filterPill, setFilterPill] = useState<string>('all');
  const [cuisineFilter, setCuisineFilter] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Execution Tab States
  const [timers, setTimers] = useState<KitchenTimer[]>([]);
  const [checklist, setChecklist] = useState<ChecklistTask[]>([]);
  const [isAddTimerModalOpen, setIsAddTimerModalOpen] = useState(false);
  const [newTimerName, setNewTimerName] = useState('');
  const [newTimerMinutes, setNewTimerMinutes] = useState('5');
  const [newStepText, setNewStepText] = useState<{ [phase: number]: string }>({ 1: '', 2: '', 3: '' });

  // Add / Edit Recipe Modal State
  const [isAddRecipeModalOpen, setIsAddRecipeModalOpen] = useState(false);
  const [editingRecipe, setEditingRecipe] = useState<CulinaryRecipe | null>(null);
  const [recipeName, setRecipeName] = useState('');
  const [recipeCategory, setRecipeCategory] = useState<'high_protein' | 'quick_prep' | 'meal_prep' | 'low_gi' | 'dessert'>('high_protein');
  const [recipeCuisine, setRecipeCuisine] = useState('Mediterranean');
  const [recipePrepTime, setRecipePrepTime] = useState('10');
  const [recipeCookTime, setRecipeCookTime] = useState('15');
  const [recipeServings, setRecipeServings] = useState('2');
  const [recipeCalories, setRecipeCalories] = useState('550');
  const [recipeProtein, setRecipeProtein] = useState('45');
  const [recipeCarbs, setRecipeCarbs] = useState('35');
  const [recipeFat, setRecipeFat] = useState('18');
  const [recipeTags, setRecipeTags] = useState('#HighProtein, #QuickDinner');
  const [recipePinToday, setRecipePinToday] = useState(false);
  const [recipeIngredients, setRecipeIngredients] = useState<Array<{ name: string; baseGramsOrMl: number; unit: string }>>([
    { name: '', baseGramsOrMl: 150, unit: 'g' },
  ]);

  // Derived Active Recipe
  const activeRecipe = useMemo(
    () => recipes.find((r) => r.id === activeRecipeId) || (recipes.length > 0 ? recipes[0] : null),
    [recipes, activeRecipeId]
  );

  // Multi-timer interval tick
  useEffect(() => {
    const interval = setInterval(() => {
      setTimers((prev) =>
        prev.map((t) => {
          if (!t.isRunning || t.remainingSeconds <= 0) return t;
          return { ...t, remainingSeconds: t.remainingSeconds - 1 };
        })
      );
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const toggleTimerRunning = (id: string) => {
    setTimers((prev) =>
      prev.map((t) => (t.id === id ? { ...t, isRunning: !t.isRunning } : t))
    );
  };

  const resetTimer = (id: string) => {
    setTimers((prev) =>
      prev.map((t) => (t.id === id ? { ...t, remainingSeconds: t.totalSeconds, isRunning: false } : t))
    );
    toast('Timer reset to initial duration', 'info');
  };

  const handleDeleteTimer = (id: string) => {
    setTimers((prev) => prev.filter((t) => t.id !== id));
    toast('Timer removed', 'info');
  };

  const handleAddTimer = (e: React.FormEvent) => {
    e.preventDefault();
    const mins = parseFloat(newTimerMinutes);
    if (!newTimerName.trim() || isNaN(mins) || mins <= 0) {
      toast('Please enter a valid timer name and duration.', 'error');
      return;
    }
    const secs = Math.round(mins * 60);
    const newTimer: KitchenTimer = {
      id: `t-${Date.now()}`,
      name: newTimerName.trim(),
      stage: `Custom Timer • ${mins}m`,
      totalSeconds: secs,
      remainingSeconds: secs,
      isRunning: true,
    };
    setTimers([...timers, newTimer]);
    setIsAddTimerModalOpen(false);
    setNewTimerName('');
    setNewTimerMinutes('5');
    toast(`Timer "${newTimer.name}" started for ${mins} minutes`, 'success');
  };

  const toggleChecklist = (id: string) => {
    setChecklist((prev) =>
      prev.map((t) => (t.id === id ? { ...t, isDone: !t.isDone } : t))
    );
  };

  const handleDeleteChecklistItem = (id: string) => {
    setChecklist((prev) => prev.filter((t) => t.id !== id));
    toast('Checklist step removed', 'info');
  };

  const handleAddInlineStep = (phase: 1 | 2 | 3) => {
    const text = (newStepText[phase] || '').trim();
    if (!text) {
      toast('Please enter step instructions.', 'error');
      return;
    }
    const newTask: ChecklistTask = {
      id: `cl-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      phase,
      text,
      badge: phase === 1 ? 'Cold Prep' : phase === 2 ? 'Active Heat' : 'Plating',
      isDone: false,
    };
    setChecklist((prev) => [...prev, newTask]);
    setNewStepText((prev) => ({ ...prev, [phase]: '' }));
    toast('Checklist step added', 'success');
  };

  const completedChecklistCount = useMemo(
    () => checklist.filter((c) => c.isDone).length,
    [checklist]
  );

  // Recipe Creation
  const handleAddIngredientRow = () => {
    setRecipeIngredients((prev) => [...prev, { name: '', baseGramsOrMl: 50, unit: 'g' }]);
  };

  const handleRemoveIngredientRow = (index: number) => {
    setRecipeIngredients((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleIngredientChange = (
    index: number,
    field: 'name' | 'baseGramsOrMl' | 'unit',
    value: string | number
  ) => {
    setRecipeIngredients((prev) =>
      prev.map((ing, idx) => (idx === index ? { ...ing, [field]: value } : ing))
    );
  };

  const handleOpenCreateRecipe = () => {
    setEditingRecipe(null);
    setRecipeName('');
    setRecipeCategory('high_protein');
    setRecipeCuisine('Mediterranean');
    setRecipePrepTime('10');
    setRecipeCookTime('15');
    setRecipeServings('2');
    setRecipeCalories('550');
    setRecipeProtein('45');
    setRecipeCarbs('35');
    setRecipeFat('18');
    setRecipeTags('#HighProtein, #QuickDinner');
    setRecipePinToday(false);
    setRecipeIngredients([{ name: '', baseGramsOrMl: 150, unit: 'g' }]);
    setIsAddRecipeModalOpen(true);
  };

  const handleOpenEditRecipe = (r: CulinaryRecipe) => {
    setEditingRecipe(r);
    setRecipeName(r.name);
    setRecipeCategory(r.category);
    setRecipeCuisine(r.cuisine);
    setRecipePrepTime(r.prepTimeMinutes.toString());
    setRecipeCookTime(r.cookTimeMinutes.toString());
    setRecipeServings(r.baseServings.toString());
    setRecipeCalories(r.calories.toString());
    setRecipeProtein(r.proteinGrams.toString());
    setRecipeCarbs(r.carbsGrams.toString());
    setRecipeFat(r.fatGrams.toString());
    setRecipeTags(r.tags.join(', '));
    setRecipePinToday(Boolean(r.isPinned));
    setRecipeIngredients(
      r.ingredients && r.ingredients.length > 0
        ? r.ingredients.map((ing) => ({ ...ing }))
        : [{ name: '', baseGramsOrMl: 150, unit: 'g' }]
    );
    setIsAddRecipeModalOpen(true);
  };

  const handleCreateRecipe = (e: React.FormEvent) => {
    e.preventDefault();
    if (!recipeName.trim()) {
      toast('Please enter a recipe name.', 'error');
      return;
    }

    const validIngredients = recipeIngredients.filter((i) => i.name.trim().length > 0);
    if (validIngredients.length === 0) {
      toast('Please specify at least one ingredient with a name.', 'error');
      return;
    }

    if (editingRecipe) {
      const updatedRecipe: CulinaryRecipe = {
        ...editingRecipe,
        name: recipeName.trim(),
        category: recipeCategory,
        categoryLabel: CATEGORY_LABELS[recipeCategory] || 'Custom',
        cuisine: recipeCuisine.trim() || 'General',
        prepTimeMinutes: Math.max(1, parseInt(recipePrepTime, 10) || 10),
        cookTimeMinutes: Math.max(1, parseInt(recipeCookTime, 10) || 15),
        baseServings: Math.max(1, parseInt(recipeServings, 10) || 2),
        calories: Math.max(0, parseInt(recipeCalories, 10) || 500),
        proteinGrams: Math.max(0, parseInt(recipeProtein, 10) || 30),
        carbsGrams: Math.max(0, parseInt(recipeCarbs, 10) || 40),
        fatGrams: Math.max(0, parseInt(recipeFat, 10) || 15),
        isPinned: recipePinToday,
        tags: recipeTags
          .split(',')
          .map((t) => t.trim())
          .filter((t) => t.length > 0)
          .map((t) => (t.startsWith('#') ? t : `#${t}`)),
        ingredients: validIngredients,
      };

      setRecipes((prev) => prev.map((r) => (r.id === editingRecipe.id ? updatedRecipe : r)));
      setIsAddRecipeModalOpen(false);
      setEditingRecipe(null);
      setRecipeName('');
      setRecipeCategory('high_protein');
      setRecipeCuisine('Mediterranean');
      setRecipePrepTime('10');
      setRecipeCookTime('15');
      setRecipeServings('2');
      setRecipeCalories('550');
      setRecipeProtein('45');
      setRecipeCarbs('35');
      setRecipeFat('18');
      setRecipeTags('#HighProtein, #QuickDinner');
      setRecipePinToday(false);
      setRecipeIngredients([{ name: '', baseGramsOrMl: 150, unit: 'g' }]);
      toast(`Recipe "${updatedRecipe.name}" updated successfully!`, 'success');
      return;
    }

    const newRecipe: CulinaryRecipe = {
      id: `rc-${Date.now()}`,
      name: recipeName.trim(),
      category: recipeCategory,
      categoryLabel: CATEGORY_LABELS[recipeCategory] || 'Custom',
      cuisine: recipeCuisine.trim() || 'General',
      prepTimeMinutes: Math.max(1, parseInt(recipePrepTime, 10) || 10),
      cookTimeMinutes: Math.max(1, parseInt(recipeCookTime, 10) || 15),
      baseServings: Math.max(1, parseInt(recipeServings, 10) || 2),
      calories: Math.max(0, parseInt(recipeCalories, 10) || 500),
      proteinGrams: Math.max(0, parseInt(recipeProtein, 10) || 30),
      carbsGrams: Math.max(0, parseInt(recipeCarbs, 10) || 40),
      fatGrams: Math.max(0, parseInt(recipeFat, 10) || 15),
      pantryMatchPercent: 100,
      isPinned: recipePinToday,
      tags: recipeTags
        .split(',')
        .map((t) => t.trim())
        .filter((t) => t.length > 0)
        .map((t) => (t.startsWith('#') ? t : `#${t}`)),
      ingredients: validIngredients,
    };

    setRecipes((prev) => [newRecipe, ...prev]);
    if (recipePinToday || !activeRecipeId) {
      setActiveRecipeId(newRecipe.id);
    }

    // Reset Form
    setRecipeName('');
    setRecipeCategory('high_protein');
    setRecipeCuisine('Mediterranean');
    setRecipePrepTime('10');
    setRecipeCookTime('15');
    setRecipeServings('2');
    setRecipeCalories('550');
    setRecipeProtein('45');
    setRecipeCarbs('35');
    setRecipeFat('18');
    setRecipeTags('#HighProtein, #QuickDinner');
    setRecipePinToday(false);
    setRecipeIngredients([{ name: '', baseGramsOrMl: 150, unit: 'g' }]);

    setIsAddRecipeModalOpen(false);
    toast(`Recipe "${newRecipe.name}" added to culinary library!`, 'success');
  };

  const handleDeleteRecipe = (id: string) => {
    const r = recipes.find((item) => item.id === id);
    setRecipes((prev) => prev.filter((item) => item.id !== id));
    if (activeRecipeId === id) {
      setActiveRecipeId(null);
    }
    if (r) {
      toast(`Recipe "${r.name}" removed from library`, 'info');
    }
  };

  const togglePinRecipe = (id: string) => {
    setRecipes((prev) =>
      prev.map((r) => {
        if (r.id === id) {
          const nextState = !r.isPinned;
          toast(nextState ? `Pinned "${r.name}" to today's schedule` : `Unpinned "${r.name}"`, 'info');
          return { ...r, isPinned: nextState };
        }
        return r;
      })
    );
  };

  const startKitchenMode = (recipe: CulinaryRecipe) => {
    setActiveRecipeId(recipe.id);
    setServings(recipe.baseServings);

    // If timers are empty, initialize default thermal countdown for this recipe
    if (timers.length === 0 && recipe.cookTimeMinutes > 0) {
      const defaultTimer: KitchenTimer = {
        id: `t-${Date.now()}`,
        name: `${recipe.name} Thermal Stage`,
        stage: 'Timer 1 • Active Cook',
        totalSeconds: recipe.cookTimeMinutes * 60,
        remainingSeconds: recipe.cookTimeMinutes * 60,
        isRunning: true,
        isUrgent: false,
      };
      setTimers([defaultTimer]);
    }

    // If checklist is empty, initialize recipe-specific checklist steps
    if (checklist.length === 0) {
      const tasks: ChecklistTask[] = [
        {
          id: `cl-${Date.now()}-1`,
          phase: 1,
          text: `Weigh & portion ingredients: ${recipe.ingredients.map((i) => `${i.name} (${i.baseGramsOrMl}${i.unit})`).join(', ')}`,
          badge: 'Mise-en-Place',
          isDone: false,
        },
        {
          id: `cl-${Date.now()}-2`,
          phase: 1,
          text: `Cold prep: clean produce, mince aromatics, prep cookware`,
          badge: 'Cold Prep',
          isDone: false,
        },
        {
          id: `cl-${Date.now()}-3`,
          phase: 2,
          text: `Preheat cookware and start active cooking sequence for ${recipe.cookTimeMinutes} min`,
          badge: 'Active Heat',
          isDone: false,
        },
        {
          id: `cl-${Date.now()}-4`,
          phase: 3,
          text: `Plate ${recipe.baseServings} portions of ${recipe.name}`,
          badge: 'Plating',
          isDone: false,
        },
        {
          id: `cl-${Date.now()}-5`,
          phase: 3,
          text: `Deplete pantry inventory and log ${recipe.calories} kcal into LifeOS habit node`,
          badge: 'Auto-Sync',
          isDone: false,
        },
      ];
      setChecklist(tasks);
    }

    setActiveTab('execution');
    toast(`Kitchen Mode activated for "${recipe.name}"`, 'success');
  };

  const filteredRecipes = useMemo(() => {
    return recipes.filter((r) => {
      if (filterPill !== 'all') {
        if (filterPill === 'high_protein' && r.category !== 'high_protein') return false;
        if (filterPill === 'quick_prep' && r.category !== 'quick_prep') return false;
        if (filterPill === 'meal_prep' && r.category !== 'meal_prep') return false;
        if (filterPill === 'low_gi' && r.category !== 'low_gi') return false;
      }
      if (cuisineFilter !== 'All' && r.cuisine !== cuisineFilter) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          r.name.toLowerCase().includes(q) ||
          r.cuisine.toLowerCase().includes(q) ||
          r.tags.some((t) => t.toLowerCase().includes(q))
        );
      }
      return true;
    });
  }, [recipes, filterPill, cuisineFilter, searchQuery]);

  // Derived telemetry metrics
  const avgPantryMatch = useMemo(() => {
    if (recipes.length === 0) return 0;
    return Math.round(recipes.reduce((acc, r) => acc + r.pantryMatchPercent, 0) / recipes.length);
  }, [recipes]);

  const avgCalories = useMemo(() => {
    if (recipes.length === 0) return 0;
    return Math.round(recipes.reduce((acc, r) => acc + r.calories, 0) / recipes.length);
  }, [recipes]);

  const avgProtein = useMemo(() => {
    if (recipes.length === 0) return 0;
    return Math.round(recipes.reduce((acc, r) => acc + r.proteinGrams, 0) / recipes.length);
  }, [recipes]);

  const pinnedRecipesCount = useMemo(
    () => recipes.filter((r) => r.isPinned).length,
    [recipes]
  );

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12 animate-fade-up">
      {/* Top Identity & Tab Switcher Bar */}
      <div className="bg-surface-container-lowest rounded-2xl p-5 sm:p-6 border border-border/70 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5 flex-wrap">
            <h1 className="font-headline-lg text-2xl sm:text-3xl font-bold tracking-tight text-on-surface">
              {activeTab === 'list'
                ? 'Cooking & Recipe Library'
                : 'Kitchen Mode & Execution'}
            </h1>
            <span className="font-label-caps text-xs px-2.5 py-0.5 rounded-full bg-secondary-container/40 text-secondary font-mono font-semibold">
              {activeTab === 'list' ? `${recipes.length} Recipes` : activeRecipe ? activeRecipe.name : 'Standby'}
            </span>
          </div>
        </div>

        {/* Global Tab Switcher & Actions */}
        <div className="flex items-center gap-2 shrink-0 flex-wrap">
          <div className="p-1 bg-surface-container-low border border-border/60 rounded-xl flex items-center gap-1">
            <button
              type="button"
              onClick={() => setActiveTab('list')}
              className={clsx(
                'px-3.5 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-all',
                activeTab === 'list'
                  ? 'bg-surface-container-lowest text-primary shadow-xs font-bold border border-border/50'
                  : 'text-on-surface-variant hover:text-on-surface'
              )}
            >
              Recipe Library
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('execution')}
              className={clsx(
                'px-3.5 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-all flex items-center gap-1.5',
                activeTab === 'execution'
                  ? 'bg-surface-container-lowest text-primary shadow-xs font-bold border border-border/50'
                  : 'text-on-surface-variant hover:text-on-surface'
              )}
            >
              <span className={clsx("w-2 h-2 rounded-full", activeRecipe ? "bg-secondary animate-pulse" : "bg-border")} />
              Kitchen Mode
            </button>
          </div>

          <Button
            onClick={handleOpenCreateRecipe}
            variant="primary"
            size="sm"
            className="cursor-pointer text-xs rounded-xl shadow-xs"
          >
            <IconPlus size={14} className="mr-1.5" /> Create Recipe
          </Button>

          {activeTab === 'list' ? (
            <Button
              onClick={() => toast(recipes.length > 0 ? 'Grocery list synchronized with recipe ingredients' : 'Create recipes first to generate grocery lists', recipes.length > 0 ? 'success' : 'info')}
              variant="outline"
              size="sm"
              className="cursor-pointer text-xs rounded-xl shadow-xs"
            >
              <IconZap size={14} className="mr-1.5 text-secondary" /> Sync Grocery
            </Button>
          ) : (
            <Button
              onClick={() => {
                if (!activeRecipe) {
                  toast('Select an active recipe first to generate a prep sheet.', 'info');
                  return;
                }
                toast(`Mise-en-place prep sheet for "${activeRecipe.name}" exported to PDF`, 'success');
              }}
              variant="outline"
              size="sm"
              className="cursor-pointer text-xs rounded-xl shadow-xs"
            >
              <IconDownload size={14} className="mr-1.5" /> Print Prep Sheet
            </Button>
          )}
        </div>
      </div>

      {/* TAB 1: RECIPE LIBRARY */}
      {activeTab === 'list' && (
        <div className="space-y-6">
          {/* Telemetry Bento Row (Strict 2x2 Mobile Grid) */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            <div className="bg-surface-container-lowest rounded-2xl p-4 sm:p-5 border border-border/70 shadow-[0_2px_8px_rgba(0,0,0,0.04),inset_0_1px_0_rgba(255,255,255,0.7)] dark:shadow-[0_4px_16px_rgba(0,0,0,0.3),inset_0_1px_0_rgba(255,255,255,0.06)] hover:shadow-[0_6px_20px_rgba(0,0,0,0.06)] transition-all flex flex-col justify-between">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-semibold uppercase tracking-widest text-on-surface-variant/90 select-none truncate block">
                  Active Recipes
                </span>
                <span className="p-1 rounded-lg bg-primary-fixed text-on-primary-fixed shadow-xs">
                  <IconChefHat size={16} />
                </span>
              </div>
              <div className="flex items-baseline gap-2 my-1">
                <span className="text-2xl sm:text-3xl font-bold font-mono tracking-tight tabular-nums text-on-surface">
                  {recipes.length}
                </span>
                <span className="text-xs text-on-surface-variant">Saved</span>
              </div>
              <div className="flex items-center gap-2 pt-2 border-t border-border/40 text-[11px]">
                <span className="bg-secondary-fixed text-on-secondary-fixed font-mono px-1.5 py-0.5 rounded font-semibold text-[10px]">
                  {recipes.length === 0 ? 'Zero baseline' : `${recipes.length} in catalog`}
                </span>
                <span className="text-on-surface-variant">• {pinnedRecipesCount} Pinned</span>
              </div>
            </div>

            <div className="bg-surface-container-lowest rounded-2xl p-4 sm:p-5 border border-border/70 shadow-[0_2px_8px_rgba(0,0,0,0.04),inset_0_1px_0_rgba(255,255,255,0.7)] dark:shadow-[0_4px_16px_rgba(0,0,0,0.3),inset_0_1px_0_rgba(255,255,255,0.06)] hover:shadow-[0_6px_20px_rgba(0,0,0,0.06)] transition-all flex flex-col justify-between">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-semibold uppercase tracking-widest text-on-surface-variant/90 select-none truncate block">
                  Meal Plan
                </span>
                <span className="p-1 rounded-lg bg-secondary-container/30 text-secondary shadow-xs">
                  <IconClock size={16} />
                </span>
              </div>
              <div className="flex items-baseline gap-2 my-1">
                <span className="text-2xl sm:text-3xl font-bold font-mono tracking-tight tabular-nums text-on-surface">
                  {Math.min(recipes.length, 7)}<span className="text-sm text-on-surface-variant">/7</span>
                </span>
                <span className="text-xs text-on-surface-variant">Days Slated</span>
              </div>
              <div className="flex items-center gap-2 pt-2 border-t border-border/40 text-[11px]">
                <div className="w-20 bg-surface-container h-1.5 rounded-full overflow-hidden">
                  <div
                    className="bg-secondary h-full rounded-full transition-all duration-500"
                    style={{ width: `${recipes.length === 0 ? 0 : Math.min(100, Math.round((recipes.length / 7) * 100))}%` }}
                  />
                </div>
                <span className="text-on-surface-variant font-mono text-[11px]">{avgCalories > 0 ? `${avgCalories} avg kcal` : '0 kcal'}</span>
              </div>
            </div>

            <div className="bg-surface-container-lowest rounded-2xl p-4 sm:p-5 border border-border/70 shadow-[0_2px_8px_rgba(0,0,0,0.04),inset_0_1px_0_rgba(255,255,255,0.7)] dark:shadow-[0_4px_16px_rgba(0,0,0,0.3),inset_0_1px_0_rgba(255,255,255,0.06)] hover:shadow-[0_6px_20px_rgba(0,0,0,0.06)] transition-all flex flex-col justify-between">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-semibold uppercase tracking-widest text-on-surface-variant/90 select-none truncate block">
                  Pantry In-Stock
                </span>
                <span className="p-1 rounded-lg bg-surface-container text-on-surface shadow-xs">
                  <IconZap size={16} />
                </span>
              </div>
              <div className="flex items-baseline gap-2 my-1">
                <span className="text-2xl sm:text-3xl font-bold font-mono tracking-tight tabular-nums text-secondary">
                  {avgPantryMatch}%
                </span>
                <span className="text-xs text-on-surface-variant">Match</span>
              </div>
              <div className="flex items-center gap-1.5 pt-2 border-t border-border/40 text-[11px]">
                <span className={clsx("w-1.5 h-1.5 rounded-full", recipes.length > 0 ? "bg-secondary" : "bg-border")} />
                <span className="text-on-surface-variant font-medium">
                  {recipes.length === 0 ? 'No deficit alerts' : `${recipes.filter((r) => r.pantryMatchPercent < 100).length} deficit alerts`}
                </span>
              </div>
            </div>

            <div className="bg-surface-container-lowest rounded-2xl p-4 sm:p-5 border border-border/70 shadow-[0_2px_8px_rgba(0,0,0,0.04),inset_0_1px_0_rgba(255,255,255,0.7)] dark:shadow-[0_4px_16px_rgba(0,0,0,0.3),inset_0_1px_0_rgba(255,255,255,0.06)] hover:shadow-[0_6px_20px_rgba(0,0,0,0.06)] transition-all flex flex-col justify-between">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-semibold uppercase tracking-widest text-on-surface-variant/90 select-none truncate block">
                  Macro Target
                </span>
                <span className="p-1 rounded-lg bg-surface-container-high text-primary shadow-xs">
                  <IconCheck size={16} />
                </span>
              </div>
              <div className="flex items-baseline gap-2 my-1">
                <span className="text-2xl sm:text-3xl font-bold font-mono tracking-tight tabular-nums text-on-surface">
                  {avgProtein}g
                </span>
                <span className="text-xs text-on-surface-variant">Avg Protein</span>
              </div>
              <div className="flex items-center gap-1.5 pt-2 border-t border-border/40 text-[11px]">
                <span className="text-secondary font-semibold font-mono">
                  {recipes.length > 0 ? `${recipes.length} tracked meals` : '0 tracked meals'}
                </span>
                <span className="text-on-surface-variant">• {recipes.length > 0 ? 'Active' : 'Empty'}</span>
              </div>
            </div>
          </div>

          {/* Filter & Categorization Bar */}
          <div className="bg-surface-container-lowest p-4 rounded-2xl border border-border/70 shadow-sm flex flex-col xl:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-2 w-full xl:w-auto">
              <div className="flex items-center gap-2 bg-surface-container-low px-3 py-2 rounded-xl w-full sm:w-80 border border-border/50">
                <IconSearch size={16} className="text-on-surface-variant" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search recipes, tags, or ingredients..."
                  className="bg-transparent border-none outline-none text-xs text-on-surface w-full placeholder:text-on-surface-variant"
                />
              </div>
            </div>

            <div className="flex items-center gap-1.5 overflow-x-auto w-full xl:w-auto no-scrollbar">
              {[
                { id: 'all', label: `All Recipes (${recipes.length})` },
                { id: 'high_protein', label: `High Protein (${recipes.filter((r) => r.category === 'high_protein').length})` },
                { id: 'quick_prep', label: `Quick Prep (${recipes.filter((r) => r.category === 'quick_prep').length})` },
                { id: 'meal_prep', label: `Meal Prep (${recipes.filter((r) => r.category === 'meal_prep').length})` },
                { id: 'low_gi', label: `Low GI (${recipes.filter((r) => r.category === 'low_gi').length})` },
              ].map((pill) => (
                <button
                  key={pill.id}
                  type="button"
                  onClick={() => setFilterPill(pill.id)}
                  className={clsx(
                    'px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap cursor-pointer transition-all',
                    filterPill === pill.id
                      ? 'bg-primary text-on-primary shadow-xs'
                      : 'bg-surface-container-low text-on-surface-variant hover:bg-surface-container'
                  )}
                >
                  {pill.label}
                </button>
              ))}

              <div className="h-5 w-px bg-border/80 mx-1 hidden sm:block" />

              <select
                value={cuisineFilter}
                onChange={(e) => setCuisineFilter(e.target.value)}
                className="bg-surface-container-low text-on-surface text-xs rounded-xl py-1.5 px-3 border border-border/60 outline-none cursor-pointer"
              >
                <option value="All">All Cuisines</option>
                <option value="Mediterranean">Mediterranean</option>
                <option value="Pan-Asian / Wok">Pan-Asian / Wok</option>
                <option value="North Indian Dal">North Indian Dal</option>
                <option value="Modern Nordic">Modern Nordic</option>
                <option value="Italian">Italian</option>
                <option value="Mexican">Mexican</option>
              </select>
            </div>
          </div>

          {/* Recipes Matrix (8 Cols + 4 Cols) */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Primary Recipe Cards (8 Cols) */}
            <div className="lg:col-span-8 grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredRecipes.length === 0 ? (
                <div className="md:col-span-2 p-10 rounded-2xl bg-surface-container-lowest border border-dashed border-border/80 text-center flex flex-col items-center justify-center gap-3 shadow-xs">
                  <div className="w-14 h-14 rounded-2xl bg-surface-container flex items-center justify-center text-primary shadow-xs">
                    <IconChefHat size={30} />
                  </div>
                  <div className="space-y-1">
                    <h3 className="font-bold text-base text-on-surface">No Recipes in Catalog</h3>
                    <p className="text-xs text-on-surface-variant max-w-md mx-auto">
                      Your recipe collection is currently at an empty baseline. Create your first culinary dish to track macros, portion ingredients, and launch kitchen execution timers.
                    </p>
                  </div>
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => setIsAddRecipeModalOpen(true)}
                    className="cursor-pointer text-xs rounded-xl shadow-xs mt-2"
                  >
                    <IconPlus size={14} className="mr-1.5" /> Create Recipe
                  </Button>
                </div>
              ) : (
                filteredRecipes.map((recipe) => (
                  <div
                    key={recipe.id}
                    className={clsx(
                      'bg-surface-container-lowest rounded-2xl p-5 border border-border/70 shadow-sm flex flex-col justify-between hover:border-border transition-all relative overflow-hidden',
                      recipe.isPinned && 'md:col-span-2'
                    )}
                  >
                    {recipe.isPinned && (
                      <div className="absolute top-0 left-0 right-0 h-1 bg-primary" />
                    )}

                    <div>
                      {/* Header Badges */}
                      <div className="flex items-start justify-between gap-2 mb-3">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {recipe.isPinned && (
                            <span className="bg-primary text-on-primary font-label-caps text-[10px] px-2 py-0.5 rounded-full font-bold flex items-center gap-1">
                              PINNED & SCHEDULED TODAY
                            </span>
                          )}
                          <span className="bg-secondary-fixed text-on-secondary-fixed font-label-caps text-[10px] px-2 py-0.5 rounded-full font-bold">
                            {recipe.categoryLabel}
                          </span>
                          <span className="bg-surface-container text-on-surface font-label-caps text-[10px] px-2 py-0.5 rounded-full font-bold">
                            {recipe.cuisine}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono text-xs text-on-surface-variant font-semibold">
                            {recipe.prepTimeMinutes + recipe.cookTimeMinutes} min
                          </span>
                          <button
                            type="button"
                            onClick={() => handleOpenEditRecipe(recipe)}
                            className="p-1 rounded-lg hover:bg-surface-container text-on-surface-variant hover:text-primary transition-all cursor-pointer"
                            title="Edit Recipe"
                          >
                            <IconEdit size={14} />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteRecipe(recipe.id)}
                            className="p-1 rounded-lg hover:bg-error-container/30 text-on-surface-variant hover:text-error transition-all cursor-pointer"
                            title="Delete Recipe"
                          >
                            <IconTrash size={14} />
                          </button>
                        </div>
                      </div>

                      <h3 className="font-headline-md text-base font-bold text-on-surface leading-snug">
                        {recipe.name}
                      </h3>

                      {/* Tags */}
                      {recipe.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mt-2">
                          {recipe.tags.map((t) => (
                            <span
                              key={t}
                              className="font-label-caps text-[10px] bg-surface-container px-2 py-0.5 rounded-md text-on-surface-variant font-medium"
                            >
                              {t}
                            </span>
                          ))}
                        </div>
                      )}

                      {/* Macros Grid */}
                      <div className="grid grid-cols-4 gap-2 bg-surface-container-low rounded-xl p-2.5 mt-3 text-center border border-border/50">
                        <div>
                          <span className="font-label-caps text-[10px] text-on-surface-variant block uppercase">
                            Cal
                          </span>
                          <span className="font-title-sm text-xs font-bold text-on-surface font-mono">
                            {recipe.calories}
                          </span>
                        </div>
                        <div>
                          <span className="font-label-caps text-[10px] text-primary block uppercase">Prot</span>
                          <span className="font-title-sm text-xs font-bold text-primary font-mono">
                            {recipe.proteinGrams}g
                          </span>
                        </div>
                        <div>
                          <span className="font-label-caps text-[10px] text-on-surface-variant block uppercase">
                            Carb
                          </span>
                          <span className="font-title-sm text-xs font-bold text-on-surface font-mono">
                            {recipe.carbsGrams}g
                          </span>
                        </div>
                        <div>
                          <span className="font-label-caps text-[10px] text-on-surface-variant block uppercase">
                            Fat
                          </span>
                          <span className="font-title-sm text-xs font-bold text-on-surface font-mono">
                            {recipe.fatGrams}g
                          </span>
                        </div>
                      </div>

                      {/* Ingredients Matrix */}
                      <div className="bg-surface-container-low/70 rounded-xl p-3 mt-4 border border-border/40">
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-label-caps text-[11px] text-on-surface-variant uppercase font-bold">
                            Ingredients ({recipe.ingredients.length})
                          </span>
                          <div className="flex items-center gap-1.5 bg-surface-container-lowest px-2 py-1 rounded-lg border border-border/60">
                            <span className="text-[11px] text-on-surface-variant font-semibold">Servings:</span>
                            <button
                              type="button"
                              onClick={() => setServings((s) => Math.max(1, s - 1))}
                              className="w-5 h-5 rounded bg-surface-container hover:bg-surface-container-high flex items-center justify-center text-xs font-bold cursor-pointer"
                            >
                              -
                            </button>
                            <span className="font-bold text-xs text-primary w-4 text-center font-mono">
                              {servings}
                            </span>
                            <button
                              type="button"
                              onClick={() => setServings((s) => s + 1)}
                              className="w-5 h-5 rounded bg-surface-container hover:bg-surface-container-high flex items-center justify-center text-xs font-bold cursor-pointer"
                            >
                              +
                            </button>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                          {recipe.ingredients.map((ing) => (
                            <div
                              key={ing.name}
                              className="bg-surface-container-lowest p-2 rounded-lg border border-border/40 flex flex-col"
                            >
                              <span className="text-[11px] text-on-surface font-medium truncate">
                                {ing.name}
                              </span>
                              <span className="text-xs text-primary font-bold font-mono">
                                {Math.round((ing.baseGramsOrMl * servings) / recipe.baseServings)}
                                {ing.unit}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Actions Footer */}
                    <div className="flex items-center justify-between pt-4 mt-3 border-t border-border/50 text-xs">
                      <button
                        type="button"
                        onClick={() => togglePinRecipe(recipe.id)}
                        className="text-on-surface-variant hover:text-primary font-semibold flex items-center gap-1 font-mono transition-colors cursor-pointer"
                      >
                        <IconCheck size={14} className={recipe.isPinned ? "text-primary" : "text-border"} />
                        {recipe.isPinned ? 'Scheduled Today' : 'Schedule Today'}
                      </button>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => startKitchenMode(recipe)}
                          className="px-3.5 py-1.5 rounded-xl bg-primary text-on-primary font-semibold shadow-xs hover:bg-primary-container transition-all cursor-pointer text-xs"
                        >
                          Start Kitchen Mode
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Contextual Side Rail (4 Cols) */}
            <div className="lg:col-span-4 flex flex-col gap-4">
              {/* Weekly Meal Planner */}
              <div className="bg-surface-container-lowest rounded-2xl p-5 border border-border/70 shadow-sm flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-title-sm font-bold text-on-surface">Weekly Meal Schedule</h3>
                  <span className="font-label-caps text-xs text-secondary font-bold font-mono">Active Week</span>
                </div>
                {recipes.length === 0 ? (
                  <div className="p-6 rounded-xl bg-surface-container-low border border-dashed border-border/60 text-center">
                    <p className="text-xs font-semibold text-on-surface">No Scheduled Meals</p>
                    <p className="text-[11px] text-on-surface-variant mt-1">
                      Add recipes to your collection and pin them to slate your weekly nutrition plan.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2 text-xs">
                    {DAYS_OF_WEEK.map((day, idx) => {
                      const recipeForDay = recipes[idx % recipes.length];
                      const isToday = idx === 0;
                      return (
                        <div
                          key={day}
                          className={clsx(
                            'p-2.5 rounded-xl flex items-center justify-between border',
                            isToday
                              ? 'bg-primary/5 border-primary/30 text-primary font-bold'
                              : 'bg-surface-container-low border-border/40 text-on-surface'
                          )}
                        >
                          <span className="font-mono font-bold w-10">{day}</span>
                          <span className="truncate flex-1 font-medium">{recipeForDay ? recipeForDay.name : 'Rest / Flex Day'}</span>
                          <span className="font-label-caps text-[10px] text-on-surface-variant font-mono">
                            {isToday ? 'Today' : 'Slated'}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Pantry Staples Reorder Radar */}
              <div className="bg-surface-container-lowest rounded-2xl p-5 border border-border/70 shadow-sm flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-title-sm font-bold text-on-surface">Pantry Inventory Radar</h3>
                  <span className="px-2 py-0.5 rounded-full bg-secondary-container/40 text-secondary font-label-caps text-[10px] font-bold">
                    {recipes.length === 0 ? 'Zero Items' : 'Monitored'}
                  </span>
                </div>
                {recipes.length === 0 ? (
                  <div className="p-6 rounded-xl bg-surface-container-low border border-dashed border-border/60 text-center">
                    <p className="text-xs font-semibold text-on-surface">Pantry in Standby</p>
                    <p className="text-[11px] text-on-surface-variant mt-1">
                      Ingredients listed in your saved recipes will be automatically monitored here.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2 text-xs">
                    {recipes
                      .flatMap((r) => r.ingredients)
                      .slice(0, 4)
                      .map((it, idx) => (
                        <div
                          key={`${it.name}-${idx}`}
                          className="p-2.5 rounded-xl bg-surface-container-low border border-border/40 flex items-center justify-between"
                        >
                          <span className="font-bold text-on-surface truncate pr-2">{it.name}</span>
                          <span className="font-mono text-xs text-secondary font-semibold shrink-0">
                            {it.baseGramsOrMl} {it.unit}
                          </span>
                        </div>
                      ))}
                    <Button
                      onClick={() => toast('Grocery list synchronized with household inventory', 'success')}
                      size="sm"
                      variant="outline"
                      className="w-full text-xs rounded-xl cursor-pointer mt-1"
                    >
                      <IconPlus size={14} className="mr-1" /> Add Ingredients to Grocery List
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: UPCOMING COOK & KITCHEN EXECUTION MODE */}
      {activeTab === 'execution' && (
        <div className="space-y-6">
          {!activeRecipe ? (
            <div className="bg-surface-container-lowest rounded-2xl p-10 border border-dashed border-border/70 shadow-sm text-center flex flex-col items-center justify-center gap-3">
              <div className="w-14 h-14 rounded-2xl bg-surface-container flex items-center justify-center text-primary shadow-xs">
                <IconChefHat size={32} />
              </div>
              <div className="space-y-1">
                <h2 className="font-headline-md text-lg font-bold text-on-surface">No Active Cooking Session</h2>
                <p className="text-xs text-on-surface-variant max-w-md mx-auto">
                  Select a recipe from your Recipe Library or create a new recipe to start Kitchen Mode with real-time countdown timers and mise-en-place checklists.
                </p>
              </div>
              <div className="flex items-center gap-2 mt-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setActiveTab('list')}
                  className="cursor-pointer text-xs rounded-xl"
                >
                  Browse Recipe Library
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => setIsAddRecipeModalOpen(true)}
                  className="cursor-pointer text-xs rounded-xl shadow-xs"
                >
                  <IconPlus size={14} className="mr-1.5" /> Create Recipe
                </Button>
              </div>
            </div>
          ) : (
            <>
              {/* Active Cooking Mode Top Bento Banner */}
              <div className="bg-surface-container-lowest rounded-2xl p-6 border border-border/70 shadow-sm flex flex-col gap-4">
                <div className="flex flex-col md:flex-row md:items-center justify-between pb-3 border-b border-border/60 gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-surface-container flex items-center justify-center text-primary shadow-xs">
                      <IconChefHat size={26} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-label-caps text-[11px] uppercase text-primary font-bold tracking-wider">
                          CURRENTLY EXECUTING
                        </span>
                        <span className="text-on-surface-variant">•</span>
                        <span className="font-label-md text-xs text-on-surface-variant font-medium">
                          {activeRecipe.cuisine}
                        </span>
                      </div>
                      <span className="font-headline-md text-lg font-bold text-on-surface">
                        {activeRecipe.name}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap font-mono text-xs">
                    <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-surface-container-low text-on-surface border border-border/50">
                      <span className="font-bold">{servings} Servings</span>
                      <span className="text-on-surface-variant">
                        ({Math.round((activeRecipe.calories * servings) / activeRecipe.baseServings)} kcal total)
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-secondary-container/30 text-secondary font-bold">
                      <IconClock size={14} />
                      <span>Est. Cook: {activeRecipe.cookTimeMinutes} min</span>
                    </div>
                  </div>
                </div>

                {/* Active Multi-Timer Bento Dock */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  {timers.map((timer) => {
                    const percent = timer.totalSeconds > 0
                      ? Math.round(((timer.totalSeconds - timer.remainingSeconds) / timer.totalSeconds) * 100)
                      : 0;
                    return (
                      <div
                        key={timer.id}
                        className="bg-surface-container-low p-4 rounded-xl border border-border/60 flex flex-col justify-between shadow-xs relative overflow-hidden group"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex flex-col">
                            <span
                              className={clsx(
                                'font-label-caps text-[11px] uppercase tracking-wider font-semibold',
                                timer.isUrgent ? 'text-error' : 'text-on-surface-variant'
                              )}
                            >
                              {timer.stage}
                            </span>
                            <span className="font-title-sm text-xs font-bold text-on-surface mt-0.5">
                              {timer.name}
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <span
                              className={clsx(
                                'w-2.5 h-2.5 rounded-full',
                                timer.isUrgent
                                  ? 'bg-error animate-ping'
                                  : timer.isRunning
                                  ? 'bg-secondary animate-pulse'
                                  : 'bg-border'
                              )}
                            />
                            <button
                              type="button"
                              onClick={() => handleDeleteTimer(timer.id)}
                              className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-error-container/30 text-on-surface-variant hover:text-error transition-all"
                              title="Delete Timer"
                            >
                              <IconTrash size={12} />
                            </button>
                          </div>
                        </div>

                        <div className="my-3 flex items-baseline justify-between font-mono">
                          <span
                            className={clsx(
                              'font-metric-stat text-2xl font-bold tracking-tight',
                              timer.isUrgent ? 'text-error' : 'text-on-surface'
                            )}
                          >
                            {formatTime(timer.remainingSeconds)}
                          </span>
                          <span
                            className={clsx(
                              'font-label-caps text-[10px] font-bold px-2 py-0.5 rounded-full',
                              timer.isUrgent
                                ? 'bg-error-container/60 text-error'
                                : timer.isRunning
                                ? 'bg-secondary-container/40 text-secondary'
                                : 'bg-surface-container text-on-surface-variant'
                            )}
                          >
                            {timer.isUrgent ? 'Urgent' : timer.isRunning ? 'Active' : 'Paused'}
                          </span>
                        </div>

                        {/* Progress Bar */}
                        <div className="w-full bg-surface-container h-1.5 rounded-full overflow-hidden mb-2.5">
                          <div
                            className={clsx(
                              'h-full rounded-full transition-all duration-300',
                              timer.isUrgent ? 'bg-error' : 'bg-secondary'
                            )}
                            style={{ width: `${percent}%` }}
                          />
                        </div>

                        <div className="flex items-center gap-1.5 pt-1">
                          <button
                            type="button"
                            onClick={() => toggleTimerRunning(timer.id)}
                            className="flex-1 py-1 rounded-lg bg-surface-container-lowest hover:bg-surface-container text-on-surface font-semibold text-xs text-center border border-border/50 transition-colors cursor-pointer"
                          >
                            {timer.isRunning ? 'Pause' : 'Resume'}
                          </button>
                          <button
                            type="button"
                            onClick={() => resetTimer(timer.id)}
                            className="p-1 rounded-lg bg-surface-container-lowest hover:bg-surface-container text-on-surface-variant hover:text-error transition-colors cursor-pointer border border-border/50"
                            title="Reset Timer"
                          >
                            <IconRotateCcw size={14} />
                          </button>
                        </div>
                      </div>
                    );
                  })}

                  {/* Add Custom Timer Slot */}
                  <button
                    type="button"
                    onClick={() => setIsAddTimerModalOpen(true)}
                    className="bg-surface-container-lowest hover:bg-surface-container-low p-4 rounded-xl border border-dashed border-border/80 flex flex-col items-center justify-center gap-1.5 text-on-surface-variant hover:text-primary transition-all cursor-pointer text-center min-h-[140px]"
                  >
                    <div className="w-9 h-9 rounded-full bg-surface-container flex items-center justify-center">
                      <IconPlus size={18} />
                    </div>
                    <span className="font-title-sm text-xs font-bold text-on-surface mt-1">
                      Add Synchronized Timer
                    </span>
                    <span className="text-[11px] text-on-surface-variant">
                      Sear, rest, simmer, or convection stage
                    </span>
                  </button>
                </div>
              </div>

              {/* Two-Column Kitchen Workflow Layout */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                {/* LEFT COLUMN: Mise-en-Place Chef Checklist (8 cols) */}
                <div className="lg:col-span-8 flex flex-col gap-4">
                  <div className="bg-surface-container-lowest rounded-2xl p-6 border border-border/70 shadow-sm flex flex-col gap-4">
                    <div className="flex items-center justify-between pb-3 border-b border-border/60">
                      <div>
                        <span className="font-label-caps text-xs text-secondary font-bold uppercase tracking-wider">
                          Mise-en-Place Sequence Protocol
                        </span>
                        <h2 className="font-headline-md text-base font-bold text-on-surface">
                          Standardized Chef Checklist
                        </h2>
                      </div>
                      <span className="font-mono text-xs px-3 py-1 bg-surface-container rounded-full text-on-surface font-bold">
                        {completedChecklistCount} of {checklist.length} Complete ({checklist.length > 0 ? Math.round((completedChecklistCount / checklist.length) * 100) : 0}%)
                      </span>
                    </div>

                    {/* Phase 1 */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-xs font-bold text-on-surface pb-1">
                        <span className="text-secondary">Phase 1: Cold Prep & Ingredient Portioning</span>
                        <span className="font-mono text-on-surface-variant text-[11px]">Cold Prep</span>
                      </div>
                      {checklist
                        .filter((c) => c.phase === 1)
                        .map((item) => (
                          <div
                            key={item.id}
                            className={clsx(
                              'flex items-center gap-3 p-3 rounded-xl border transition-colors group',
                              item.isDone
                                ? 'bg-surface-container-low/40 border-border/40'
                                : 'bg-surface-container-low border-border/70 hover:bg-surface-container'
                            )}
                          >
                            <input
                              type="checkbox"
                              checked={item.isDone}
                              onChange={() => toggleChecklist(item.id)}
                              className="w-4 h-4 rounded text-primary accent-primary cursor-pointer"
                            />
                            <span
                              onClick={() => toggleChecklist(item.id)}
                              className={clsx(
                                'flex-1 text-xs font-medium cursor-pointer',
                                item.isDone ? 'line-through text-on-surface-variant' : 'text-on-surface'
                              )}
                            >
                              {item.text}
                            </span>
                            <span className="font-label-caps text-[10px] bg-surface-container px-2 py-0.5 rounded font-mono text-on-surface-variant">
                              {item.badge}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleDeleteChecklistItem(item.id)}
                              className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-error-container/30 text-on-surface-variant hover:text-error transition-all"
                            >
                              <IconTrash size={12} />
                            </button>
                          </div>
                        ))}
                      <div className="flex items-center gap-2 pt-1">
                        <input
                          type="text"
                          value={newStepText[1] || ''}
                          onChange={(e) => setNewStepText((prev) => ({ ...prev, 1: e.target.value }))}
                          onKeyDown={(e) => e.key === 'Enter' && handleAddInlineStep(1)}
                          placeholder="Add cold prep task..."
                          className="flex-1 bg-surface-container-low text-on-surface text-xs px-3 py-1.5 rounded-lg border border-border/50 outline-none"
                        />
                        <Button size="sm" variant="outline" onClick={() => handleAddInlineStep(1)} className="text-xs py-1 rounded-lg">
                          Add
                        </Button>
                      </div>
                    </div>

                    {/* Phase 2 */}
                    <div className="space-y-2 pt-2">
                      <div className="flex items-center justify-between text-xs font-bold text-on-surface pb-1">
                        <span className="text-primary">Phase 2: Active Thermal & Cooking Sequence</span>
                        <span className="font-mono text-on-surface-variant text-[11px]">Heat & Pan Temp</span>
                      </div>
                      {checklist
                        .filter((c) => c.phase === 2)
                        .map((item) => (
                          <div
                            key={item.id}
                            className={clsx(
                              'flex items-center gap-3 p-3 rounded-xl border transition-colors group',
                              item.isDone
                                ? 'bg-surface-container-low/40 border-border/40'
                                : 'bg-surface-container-low border-border/70 hover:bg-surface-container'
                            )}
                          >
                            <input
                              type="checkbox"
                              checked={item.isDone}
                              onChange={() => toggleChecklist(item.id)}
                              className="w-4 h-4 rounded text-primary accent-primary cursor-pointer"
                            />
                            <span
                              onClick={() => toggleChecklist(item.id)}
                              className={clsx(
                                'flex-1 text-xs font-medium cursor-pointer',
                                item.isDone ? 'line-through text-on-surface-variant' : 'text-on-surface'
                              )}
                            >
                              {item.text}
                            </span>
                            <span className="font-label-caps text-[10px] bg-surface-container px-2 py-0.5 rounded font-mono text-on-surface-variant">
                              {item.badge}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleDeleteChecklistItem(item.id)}
                              className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-error-container/30 text-on-surface-variant hover:text-error transition-all"
                            >
                              <IconTrash size={12} />
                            </button>
                          </div>
                        ))}
                      <div className="flex items-center gap-2 pt-1">
                        <input
                          type="text"
                          value={newStepText[2] || ''}
                          onChange={(e) => setNewStepText((prev) => ({ ...prev, 2: e.target.value }))}
                          onKeyDown={(e) => e.key === 'Enter' && handleAddInlineStep(2)}
                          placeholder="Add cooking step..."
                          className="flex-1 bg-surface-container-low text-on-surface text-xs px-3 py-1.5 rounded-lg border border-border/50 outline-none"
                        />
                        <Button size="sm" variant="outline" onClick={() => handleAddInlineStep(2)} className="text-xs py-1 rounded-lg">
                          Add
                        </Button>
                      </div>
                    </div>

                    {/* Phase 3 */}
                    <div className="space-y-2 pt-2">
                      <div className="flex items-center justify-between text-xs font-bold text-on-surface pb-1">
                        <span className="text-tertiary">Phase 3: Plating, Seasoning & Nutritional Log</span>
                        <span className="font-mono text-on-surface-variant text-[11px]">Finish</span>
                      </div>
                      {checklist
                        .filter((c) => c.phase === 3)
                        .map((item) => (
                          <div
                            key={item.id}
                            className={clsx(
                              'flex items-center gap-3 p-3 rounded-xl border transition-colors group',
                              item.isDone
                                ? 'bg-surface-container-low/40 border-border/40'
                                : 'bg-surface-container-low border-border/70 hover:bg-surface-container'
                            )}
                          >
                            <input
                              type="checkbox"
                              checked={item.isDone}
                              onChange={() => toggleChecklist(item.id)}
                              className="w-4 h-4 rounded text-primary accent-primary cursor-pointer"
                            />
                            <span
                              onClick={() => toggleChecklist(item.id)}
                              className={clsx(
                                'flex-1 text-xs font-medium cursor-pointer',
                                item.isDone ? 'line-through text-on-surface-variant' : 'text-on-surface'
                              )}
                            >
                              {item.text}
                            </span>
                            <span className="font-label-caps text-[10px] bg-surface-container px-2 py-0.5 rounded font-mono text-on-surface-variant">
                              {item.badge}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleDeleteChecklistItem(item.id)}
                              className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-error-container/30 text-on-surface-variant hover:text-error transition-all"
                            >
                              <IconTrash size={12} />
                            </button>
                          </div>
                        ))}
                      <div className="flex items-center gap-2 pt-1">
                        <input
                          type="text"
                          value={newStepText[3] || ''}
                          onChange={(e) => setNewStepText((prev) => ({ ...prev, 3: e.target.value }))}
                          onKeyDown={(e) => e.key === 'Enter' && handleAddInlineStep(3)}
                          placeholder="Add plating / log step..."
                          className="flex-1 bg-surface-container-low text-on-surface text-xs px-3 py-1.5 rounded-lg border border-border/50 outline-none"
                        />
                        <Button size="sm" variant="outline" onClick={() => handleAddInlineStep(3)} className="text-xs py-1 rounded-lg">
                          Add
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* RIGHT COLUMN: Depletion & Staging Radar (4 cols) */}
                <div className="lg:col-span-4 flex flex-col gap-4">
                  <div className="bg-surface-container-lowest rounded-2xl p-5 border border-border/70 shadow-sm flex flex-col gap-3">
                    <div className="flex items-center justify-between">
                      <h3 className="font-title-sm font-bold text-on-surface">Pantry Inventory Depletion</h3>
                      <span className="font-label-caps text-xs text-secondary font-bold font-mono">D1 Sync Active</span>
                    </div>
                    <p className="text-xs text-on-surface-variant">
                      Finalizing this session deducts the scaled quantities for {servings} serving(s) from household inventory:
                    </p>
                    <div className="space-y-2 text-xs font-mono">
                      {activeRecipe.ingredients.map((ing) => {
                        const scaledQty = Math.round((ing.baseGramsOrMl * servings) / activeRecipe.baseServings);
                        return (
                          <div
                            key={ing.name}
                            className="p-2.5 rounded-xl bg-surface-container-low border border-border/40 flex justify-between"
                          >
                            <span className="text-on-surface">{ing.name}</span>
                            <span className="text-primary font-bold">
                              -{scaledQty}
                              {ing.unit}
                            </span>
                          </div>
                        );
                      })}
                    </div>

                    <Button
                      onClick={() => {
                        toast(
                          `Session finalized! ${Math.round((activeRecipe.calories * servings) / activeRecipe.baseServings)} kcal logged to fitness tracker & pantry inventory deducted.`,
                          'success'
                        );
                        setActiveTab('list');
                      }}
                      variant="primary"
                      size="sm"
                      className="w-full text-xs rounded-xl shadow-xs cursor-pointer mt-2"
                    >
                      <IconCheck size={14} className="mr-1.5" /> Complete Cook & Deduct Pantry
                    </Button>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* Add Synchronized Timer Modal */}
      <Modal
        isOpen={isAddTimerModalOpen}
        onClose={() => setIsAddTimerModalOpen(false)}
        title="Add Synchronized Timer"
        description="Add a precise thermal or resting countdown timer to the active kitchen execution dock."
      >
        <form onSubmit={handleAddTimer} className="space-y-4 text-left">
          <div>
            <label className="font-label-caps text-xs text-on-surface-variant uppercase font-semibold">
              Timer Label
            </label>
            <Input
              value={newTimerName}
              onChange={(e) => setNewTimerName(e.target.value)}
              placeholder="e.g. Steak Rest, Emulsion Whisk"
              className="mt-1 text-xs"
              required
            />
          </div>

          <div>
            <label className="font-label-caps text-xs text-on-surface-variant uppercase font-semibold">
              Duration (Minutes)
            </label>
            <Input
              type="number"
              step="0.5"
              value={newTimerMinutes}
              onChange={(e) => setNewTimerMinutes(e.target.value)}
              className="mt-1 text-xs font-mono"
              required
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-border/60">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsAddTimerModalOpen(false)}
              className="cursor-pointer text-xs rounded-xl"
            >
              Cancel
            </Button>
            <Button type="submit" variant="primary" size="sm" className="cursor-pointer text-xs rounded-xl shadow-xs">
              <IconPlus size={14} className="mr-1" /> Start Timer
            </Button>
          </div>
        </form>
      </Modal>

      {/* Create / Edit Recipe Modal */}
      <Modal
        isOpen={isAddRecipeModalOpen}
        onClose={() => {
          setIsAddRecipeModalOpen(false);
          setEditingRecipe(null);
        }}
        title={editingRecipe ? 'Edit Recipe' : 'Create New Recipe'}
        description={editingRecipe ? 'Update dish parameters, macros, portions, and ingredients.' : 'Add a new dish to your culinary library with personalized macros, portion controls, and ingredient specs.'}
      >
        <form onSubmit={handleCreateRecipe} className="space-y-4 text-left max-h-[75vh] overflow-y-auto pr-1">
          <div>
            <label className="font-label-caps text-xs text-on-surface-variant uppercase font-semibold">
              Recipe Name
            </label>
            <Input
              value={recipeName}
              onChange={(e) => setRecipeName(e.target.value)}
              placeholder="e.g. Herb-Crusted Wild Salmon & Quinoa Bowl"
              className="mt-1 text-xs"
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="font-label-caps text-xs text-on-surface-variant uppercase font-semibold">
                Category
              </label>
              <select
                value={recipeCategory}
                onChange={(e) => setRecipeCategory(e.target.value as any)}
                className="w-full mt-1 bg-surface-container-low text-on-surface text-xs p-2 rounded-xl border border-border/60 outline-none cursor-pointer"
              >
                <option value="high_protein">High Protein</option>
                <option value="quick_prep">Quick Prep (&lt;20m)</option>
                <option value="meal_prep">Meal Prep / Batch</option>
                <option value="low_gi">Low GI / Fuel</option>
                <option value="dessert">Healthy Dessert</option>
              </select>
            </div>
            <div>
              <label className="font-label-caps text-xs text-on-surface-variant uppercase font-semibold">
                Cuisine Style
              </label>
              <Input
                value={recipeCuisine}
                onChange={(e) => setRecipeCuisine(e.target.value)}
                placeholder="e.g. Mediterranean, Pan-Asian"
                className="mt-1 text-xs"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="font-label-caps text-xs text-on-surface-variant uppercase font-semibold">
                Prep Time (min)
              </label>
              <Input
                type="number"
                value={recipePrepTime}
                onChange={(e) => setRecipePrepTime(e.target.value)}
                className="mt-1 text-xs font-mono"
                required
              />
            </div>
            <div>
              <label className="font-label-caps text-xs text-on-surface-variant uppercase font-semibold">
                Cook Time (min)
              </label>
              <Input
                type="number"
                value={recipeCookTime}
                onChange={(e) => setRecipeCookTime(e.target.value)}
                className="mt-1 text-xs font-mono"
                required
              />
            </div>
            <div>
              <label className="font-label-caps text-xs text-on-surface-variant uppercase font-semibold">
                Servings
              </label>
              <Input
                type="number"
                value={recipeServings}
                onChange={(e) => setRecipeServings(e.target.value)}
                className="mt-1 text-xs font-mono"
                required
              />
            </div>
          </div>

          {/* Macros */}
          <div className="bg-surface-container-low p-3 rounded-xl border border-border/50">
            <span className="font-label-caps text-[11px] text-on-surface-variant uppercase font-bold block mb-2">
              Nutritional Macros (Per Base Serving)
            </span>
            <div className="grid grid-cols-4 gap-2">
              <div>
                <label className="text-[10px] text-on-surface-variant uppercase font-semibold">Calories</label>
                <Input
                  type="number"
                  value={recipeCalories}
                  onChange={(e) => setRecipeCalories(e.target.value)}
                  className="mt-0.5 text-xs font-mono"
                />
              </div>
              <div>
                <label className="text-[10px] text-primary uppercase font-semibold">Protein (g)</label>
                <Input
                  type="number"
                  value={recipeProtein}
                  onChange={(e) => setRecipeProtein(e.target.value)}
                  className="mt-0.5 text-xs font-mono"
                />
              </div>
              <div>
                <label className="text-[10px] text-on-surface-variant uppercase font-semibold">Carbs (g)</label>
                <Input
                  type="number"
                  value={recipeCarbs}
                  onChange={(e) => setRecipeCarbs(e.target.value)}
                  className="mt-0.5 text-xs font-mono"
                />
              </div>
              <div>
                <label className="text-[10px] text-on-surface-variant uppercase font-semibold">Fat (g)</label>
                <Input
                  type="number"
                  value={recipeFat}
                  onChange={(e) => setRecipeFat(e.target.value)}
                  className="mt-0.5 text-xs font-mono"
                />
              </div>
            </div>
          </div>

          {/* Dynamic Ingredients List */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="font-label-caps text-xs text-on-surface-variant uppercase font-semibold">
                Ingredients & Quantities
              </label>
              <button
                type="button"
                onClick={handleAddIngredientRow}
                className="text-xs text-primary hover:underline font-semibold flex items-center gap-1 cursor-pointer"
              >
                <IconPlus size={12} /> Add Ingredient
              </button>
            </div>
            <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
              {recipeIngredients.map((ing, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <input
                    type="text"
                    value={ing.name}
                    onChange={(e) => handleIngredientChange(idx, 'name', e.target.value)}
                    placeholder="e.g. Chicken breast fillet"
                    className="flex-1 bg-surface-container-low text-on-surface text-xs px-2.5 py-1.5 rounded-lg border border-border/50 outline-none"
                    required
                  />
                  <input
                    type="number"
                    value={ing.baseGramsOrMl}
                    onChange={(e) => handleIngredientChange(idx, 'baseGramsOrMl', parseFloat(e.target.value) || 0)}
                    placeholder="Qty"
                    className="w-20 bg-surface-container-low text-on-surface text-xs px-2 py-1.5 rounded-lg border border-border/50 outline-none font-mono"
                    required
                  />
                  <input
                    type="text"
                    value={ing.unit}
                    onChange={(e) => handleIngredientChange(idx, 'unit', e.target.value)}
                    placeholder="Unit (g, ml)"
                    className="w-16 bg-surface-container-low text-on-surface text-xs px-2 py-1.5 rounded-lg border border-border/50 outline-none"
                    required
                  />
                  {recipeIngredients.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveIngredientRow(idx)}
                      className="p-1 rounded text-on-surface-variant hover:text-error transition-colors"
                      title="Remove"
                    >
                      <IconTrash size={14} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div>
            <label className="font-label-caps text-xs text-on-surface-variant uppercase font-semibold">
              Tags (Comma separated)
            </label>
            <Input
              value={recipeTags}
              onChange={(e) => setRecipeTags(e.target.value)}
              placeholder="e.g. #HighProtein, #Omega3, #Prep20m"
              className="mt-1 text-xs"
            />
          </div>

          <label className="flex items-center gap-2 p-2 rounded-xl bg-surface-container-low border border-border/50 cursor-pointer">
            <input
              type="checkbox"
              checked={recipePinToday}
              onChange={(e) => setRecipePinToday(e.target.checked)}
              className="w-4 h-4 rounded text-primary accent-primary cursor-pointer"
            />
            <span className="text-xs font-semibold text-on-surface">Pin & schedule for today</span>
          </label>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-border/60">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setIsAddRecipeModalOpen(false);
                setEditingRecipe(null);
              }}
              className="cursor-pointer text-xs rounded-xl"
            >
              Cancel
            </Button>
            <Button type="submit" variant="primary" size="sm" className="cursor-pointer text-xs rounded-xl shadow-xs">
              <IconPlus size={14} className="mr-1" /> {editingRecipe ? 'Save Changes' : 'Save Recipe'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
