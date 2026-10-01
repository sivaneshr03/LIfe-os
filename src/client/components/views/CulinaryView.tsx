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

const RECIPES: CulinaryRecipe[] = [
  {
    id: 'rc-1',
    name: 'Herb-Crusted Wild Salmon & Quinoa Bowl',
    category: 'high_protein',
    categoryLabel: 'High Protein',
    cuisine: 'Mediterranean',
    prepTimeMinutes: 10,
    cookTimeMinutes: 15,
    baseServings: 2,
    calories: 640,
    proteinGrams: 48,
    carbsGrams: 32,
    fatGrams: 24,
    pantryMatchPercent: 100,
    isPinned: true,
    tags: ['#HighProtein', '#Omega3', '#Prep25m'],
    ingredients: [
      { name: 'Wild Salmon fillet', baseGramsOrMl: 150, unit: 'g' },
      { name: 'Tricolor Quinoa', baseGramsOrMl: 60, unit: 'g' },
      { name: 'Asparagus', baseGramsOrMl: 75, unit: 'g' },
      { name: 'Cold-pressed Olive Oil', baseGramsOrMl: 7.5, unit: 'ml' },
    ],
  },
  {
    id: 'rc-2',
    name: 'Slow-Cooked Black Lentil Dal Makhani & Jeera Rice',
    category: 'meal_prep',
    categoryLabel: 'Batch Cook',
    cuisine: 'North Indian Dal',
    prepTimeMinutes: 15,
    cookTimeMinutes: 60,
    baseServings: 4,
    calories: 510,
    proteinGrams: 26,
    carbsGrams: 72,
    fatGrams: 14,
    pantryMatchPercent: 100,
    tags: ['#PlantProtein', '#BatchCook', '#Vegetarian'],
    ingredients: [
      { name: 'Urad Dal (Black Lentils)', baseGramsOrMl: 75, unit: 'g' },
      { name: 'Basmati Rice', baseGramsOrMl: 60, unit: 'g' },
      { name: 'Aromatic Garam Masala', baseGramsOrMl: 5, unit: 'g' },
      { name: 'Ghee / Coconut Oil', baseGramsOrMl: 10, unit: 'ml' },
    ],
  },
  {
    id: 'rc-3',
    name: 'Cast Iron Free-Range Chicken Breast with Roast Broccolini',
    category: 'high_protein',
    categoryLabel: 'High Protein',
    cuisine: 'Modern Nordic',
    prepTimeMinutes: 8,
    cookTimeMinutes: 14,
    baseServings: 2,
    calories: 540,
    proteinGrams: 52,
    carbsGrams: 18,
    fatGrams: 16,
    pantryMatchPercent: 92,
    tags: ['#LeanProtein', '#LowCarb', '#QuickDinner'],
    ingredients: [
      { name: 'Chicken Breast fillet', baseGramsOrMl: 180, unit: 'g' },
      { name: 'Baby Broccolini', baseGramsOrMl: 100, unit: 'g' },
      { name: 'Rosemary & Thyme', baseGramsOrMl: 4, unit: 'g' },
      { name: 'Avocado Oil', baseGramsOrMl: 8, unit: 'ml' },
    ],
  },
  {
    id: 'rc-4',
    name: 'Crispy Pan-Seared Miso Tofu & Edamame Soba',
    category: 'quick_prep',
    categoryLabel: 'Quick Prep',
    cuisine: 'Pan-Asian / Wok',
    prepTimeMinutes: 10,
    cookTimeMinutes: 10,
    baseServings: 2,
    calories: 460,
    proteinGrams: 30,
    carbsGrams: 45,
    fatGrams: 12,
    pantryMatchPercent: 88,
    tags: ['#CleanFuel', '#LowGI', '#Fermented'],
    ingredients: [
      { name: 'Extra Firm Tofu', baseGramsOrMl: 150, unit: 'g' },
      { name: 'Buckwheat Soba', baseGramsOrMl: 80, unit: 'g' },
      { name: 'White Miso Paste', baseGramsOrMl: 15, unit: 'g' },
      { name: 'Steamed Edamame', baseGramsOrMl: 50, unit: 'g' },
    ],
  },
];

interface KitchenTimer {
  id: string;
  name: string;
  stage: string;
  totalSeconds: number;
  remainingSeconds: number;
  isRunning: boolean;
  isUrgent?: boolean;
}

const INITIAL_TIMERS: KitchenTimer[] = [
  {
    id: 't-1',
    name: 'Quinoa Simmer (Low Flame)',
    stage: 'Timer 1 • Simmer',
    totalSeconds: 900,
    remainingSeconds: 525, // 08:45
    isRunning: true,
  },
  {
    id: 't-2',
    name: 'Salmon Sear (Skin-Down)',
    stage: 'Timer 2 • Critical Turn',
    totalSeconds: 300,
    remainingSeconds: 150, // 02:30
    isRunning: true,
    isUrgent: true,
  },
  {
    id: 't-3',
    name: 'Oven Asparagus Roast (200°C)',
    stage: 'Timer 3 • Thermal Convection',
    totalSeconds: 900,
    remainingSeconds: 680, // 11:20
    isRunning: true,
  },
];

interface ChecklistTask {
  id: string;
  phase: 1 | 2 | 3;
  text: string;
  badge: string;
  isDone: boolean;
}

const INITIAL_CHECKLIST: ChecklistTask[] = [
  {
    id: 'cl-1',
    phase: 1,
    text: 'Weigh 300g wild salmon fillets, pat dry thoroughly with paper towels',
    badge: '300g Clean',
    isDone: true,
  },
  {
    id: 'cl-2',
    phase: 1,
    text: 'Rinse 120g tricolor quinoa under cold running water in fine mesh sieve',
    badge: '120g Rinsed',
    isDone: true,
  },
  {
    id: 'cl-3',
    phase: 1,
    text: 'Mince 3 cloves garlic, finely chop fresh dill and flat-leaf parsley',
    badge: 'Aromatics',
    isDone: true,
  },
  {
    id: 'cl-4',
    phase: 1,
    text: 'Trim 150g fresh asparagus ends, toss with olive oil, salt, cracked black pepper',
    badge: '150g Prepped',
    isDone: true,
  },
  {
    id: 'cl-5',
    phase: 2,
    text: 'Bring 240ml water with pinch of pink salt to rolling boil in saucepan',
    badge: 'Rolling Boil',
    isDone: true,
  },
  {
    id: 'cl-6',
    phase: 2,
    text: 'Add rinsed quinoa, reduce flame to minimum, cover with tight lid',
    badge: 'Timer 1 Sync',
    isDone: true,
  },
  {
    id: 'cl-7',
    phase: 2,
    text: 'Preheat heavy stainless pan to 195°C water-drop test (Leidenfrost effect)',
    badge: 'Sear Heat',
    isDone: false,
  },
  {
    id: 'cl-8',
    phase: 2,
    text: 'Place salmon skin-side down with gentle press for 30s to prevent curling',
    badge: 'Timer 2 Sync',
    isDone: false,
  },
  {
    id: 'cl-9',
    phase: 3,
    text: 'Fluff quinoa with fork and fold in chopped herbs and lemon zest',
    badge: 'Warm Plating',
    isDone: false,
  },
  {
    id: 'cl-10',
    phase: 3,
    text: 'Deplete pantry inventory & synchronize daily macro log into LifeOS habit node',
    badge: 'Auto-Sync',
    isDone: false,
  },
];

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
  const [recipes] = useState<CulinaryRecipe[]>(RECIPES);
  const [servings, setServings] = useState<number>(2);
  const [filterPill, setFilterPill] = useState<string>('all');
  const [cuisineFilter, setCuisineFilter] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Execution Tab States
  const [timers, setTimers] = useState<KitchenTimer[]>(INITIAL_TIMERS);
  const [checklist, setChecklist] = useState<ChecklistTask[]>(INITIAL_CHECKLIST);
  const [isAddTimerModalOpen, setIsAddTimerModalOpen] = useState(false);
  const [newTimerName, setNewTimerName] = useState('');
  const [newTimerMinutes, setNewTimerMinutes] = useState('5');

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

  const completedChecklistCount = useMemo(
    () => checklist.filter((c) => c.isDone).length,
    [checklist]
  );

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
              {activeTab === 'list' ? `${recipes.length} Recipes` : 'Live Session'}
            </span>
          </div>
        </div>

        {/* Global Tab Switcher */}
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
              <span className="w-2 h-2 rounded-full bg-secondary animate-pulse" />
              Kitchen Mode
            </button>
          </div>

          {activeTab === 'list' ? (
            <Button
              onClick={() => toast('Grocery list synchronized with inventory deficits', 'success')}
              variant="outline"
              size="sm"
              className="cursor-pointer text-xs rounded-xl shadow-xs"
            >
              <IconZap size={14} className="mr-1.5 text-secondary" /> Sync Grocery List
            </Button>
          ) : (
            <Button
              onClick={() => {
                toast('Mise-en-place prep sheet exported to PDF', 'success');
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
                <span className="text-2xl sm:text-3xl font-bold font-mono tracking-tight tabular-nums text-on-surface">24</span>
                <span className="text-xs text-on-surface-variant">Saved</span>
              </div>
              <div className="flex items-center gap-2 pt-2 border-t border-border/40 text-[11px]">
                <span className="bg-secondary-fixed text-on-secondary-fixed font-mono px-1.5 py-0.5 rounded font-semibold text-[10px]">
                  +3 this week
                </span>
                <span className="text-on-surface-variant">• 6 Pinned</span>
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
                  5<span className="text-sm text-on-surface-variant">/7</span>
                </span>
                <span className="text-xs text-on-surface-variant">Days Slated</span>
              </div>
              <div className="flex items-center gap-2 pt-2 border-t border-border/40 text-[11px]">
                <div className="w-20 bg-surface-container h-1.5 rounded-full overflow-hidden">
                  <div className="bg-secondary h-full rounded-full" style={{ width: '71%' }} />
                </div>
                <span className="text-on-surface-variant font-mono text-[11px]">2,150 kcal</span>
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
                <span className="text-2xl sm:text-3xl font-bold font-mono tracking-tight tabular-nums text-secondary">88%</span>
                <span className="text-xs text-on-surface-variant">Match</span>
              </div>
              <div className="flex items-center gap-1.5 pt-2 border-t border-border/40 text-[11px]">
                <span className="w-1.5 h-1.5 rounded-full bg-error" />
                <span className="text-error font-medium">4 staples deficit</span>
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
                <span className="text-2xl sm:text-3xl font-bold font-mono tracking-tight tabular-nums text-on-surface">165g</span>
                <span className="text-xs text-on-surface-variant">Protein</span>
              </div>
              <div className="flex items-center gap-1.5 pt-2 border-t border-border/40 text-[11px]">
                <span className="text-secondary font-semibold font-mono">42g fiber</span>
                <span className="text-on-surface-variant">• 88% met</span>
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
                { id: 'all', label: 'All Recipes (24)' },
                { id: 'high_protein', label: 'High Protein (12)' },
                { id: 'quick_prep', label: 'Quick Prep (<20m)' },
                { id: 'meal_prep', label: 'Meal Prep (6)' },
                { id: 'low_gi', label: 'Low GI / Fuel' },
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
              </select>
            </div>
          </div>

          {/* Recipes Matrix (8 Cols + 4 Cols) */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Primary Recipe Cards (8 Cols) */}
            <div className="lg:col-span-8 grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredRecipes.map((recipe) => (
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
                          {recipe.pantryMatchPercent}% In Stock
                        </span>
                      </div>
                      <span className="font-mono text-xs text-on-surface-variant font-semibold">
                        {recipe.prepTimeMinutes + recipe.cookTimeMinutes} min
                      </span>
                    </div>

                    <h3 className="font-headline-md text-base font-bold text-on-surface leading-snug">
                      {recipe.name}
                    </h3>

                    {/* Tags */}
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

                    {/* Dynamic Serving Scaler (Pinned card only) */}
                    {recipe.isPinned && (
                      <div className="bg-surface-container-low/70 rounded-xl p-3 mt-4 border border-border/40">
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-label-caps text-[11px] text-on-surface-variant uppercase font-bold">
                            Dynamic Serving Scaler & Ingredient Matrix
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

                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
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
                    )}
                  </div>

                  {/* Actions Footer */}
                  <div className="flex items-center justify-between pt-4 mt-3 border-t border-border/50 text-xs">
                    <span className="text-secondary font-semibold flex items-center gap-1 font-mono">
                      <IconCheck size={14} /> Scheduled 19:30
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setActiveTab('execution')}
                        className="px-3 py-1.5 rounded-xl bg-primary text-on-primary font-semibold shadow-xs hover:bg-primary-container transition-all cursor-pointer text-xs"
                      >
                        Start Kitchen Mode
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Contextual Side Rail (4 Cols) */}
            <div className="lg:col-span-4 flex flex-col gap-4">
              {/* Weekly Meal Planner */}
              <div className="bg-surface-container-lowest rounded-2xl p-5 border border-border/70 shadow-sm flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-title-sm font-bold text-on-surface">Weekly Meal Schedule</h3>
                  <span className="font-label-caps text-xs text-secondary font-bold font-mono">Oct 1 - Oct 7</span>
                </div>
                <div className="space-y-2 text-xs">
                  {[
                    { day: 'Mon', meal: 'Herb-Crusted Salmon & Quinoa', status: 'Today (Active)' },
                    { day: 'Tue', meal: 'Slow-Cooked Black Lentil Dal', status: 'Scheduled' },
                    { day: 'Wed', meal: 'Mediterranean Chicken Broccolini', status: 'Scheduled' },
                    { day: 'Thu', meal: 'Miso Tofu & Soba Noodle Bowl', status: 'Scheduled' },
                    { day: 'Fri', meal: 'Chef Special / Rest Day', status: 'Rest' },
                  ].map((p, idx) => (
                    <div
                      key={p.day}
                      className={clsx(
                        'p-2.5 rounded-xl flex items-center justify-between border',
                        idx === 0
                          ? 'bg-primary/5 border-primary/30 text-primary font-bold'
                          : 'bg-surface-container-low border-border/40 text-on-surface'
                      )}
                    >
                      <span className="font-mono font-bold w-10">{p.day}</span>
                      <span className="truncate flex-1 font-medium">{p.meal}</span>
                      <span className="font-label-caps text-[10px] text-on-surface-variant font-mono">
                        {p.status}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Pantry Staples Reorder Radar */}
              <div className="bg-surface-container-lowest rounded-2xl p-5 border border-border/70 shadow-sm flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-title-sm font-bold text-on-surface">Low Stock Pantry Alerts</h3>
                  <span className="px-2 py-0.5 rounded-full bg-error-container/60 text-error font-label-caps text-[10px] font-bold">
                    4 Deficits
                  </span>
                </div>
                <div className="space-y-2 text-xs">
                  {[
                    { item: 'Cold-Pressed Olive Oil', left: '150ml left', threshold: '500ml target' },
                    { item: 'Tricolor Quinoa', left: '200g left', threshold: '1kg target' },
                    { item: 'White Miso Paste', left: '40g left', threshold: '250g target' },
                    { item: 'Fresh Organic Dill', left: 'Depleted', threshold: 'Reorder now' },
                  ].map((it) => (
                    <div
                      key={it.item}
                      className="p-2.5 rounded-xl bg-surface-container-low border border-border/40 flex items-center justify-between"
                    >
                      <span className="font-bold text-on-surface">{it.item}</span>
                      <span className="font-mono text-xs text-error font-semibold">{it.left}</span>
                    </div>
                  ))}
                </div>
                <Button
                  onClick={() => toast('Deficit staples added to Cloudflare D1 Grocery Checklist', 'success')}
                  size="sm"
                  variant="outline"
                  className="w-full text-xs rounded-xl cursor-pointer mt-1"
                >
                  <IconPlus size={14} className="mr-1" /> Add Deficits to Grocery List
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: UPCOMING COOK & KITCHEN EXECUTION MODE */}
      {activeTab === 'execution' && (
        <div className="space-y-6">
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
                      Tonight, 19:30 Schedule
                    </span>
                  </div>
                  <span className="font-headline-md text-lg font-bold text-on-surface">
                    Herb-Crusted Wild Salmon & Quinoa Bowl
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2 flex-wrap font-mono text-xs">
                <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-surface-container-low text-on-surface border border-border/50">
                  <span className="font-bold">2 Servings</span>
                  <span className="text-on-surface-variant">(640 kcal/serv)</span>
                </div>
                <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-secondary-container/30 text-secondary font-bold">
                  <IconClock size={14} />
                  <span>Est. Remaining: 14 min</span>
                </div>
              </div>
            </div>

            {/* Active Multi-Timer Bento Dock */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {timers.map((timer) => {
                const percent = Math.round(
                  ((timer.totalSeconds - timer.remainingSeconds) / timer.totalSeconds) * 100
                );
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
                  Cast iron, resting, or emulsion stage
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
                    {completedChecklistCount} of {checklist.length} Complete (
                    {Math.round((completedChecklistCount / checklist.length) * 100)}%)
                  </span>
                </div>

                {/* Phase 1 */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs font-bold text-on-surface pb-1">
                    <span className="text-secondary">Phase 1: Mise-en-Place & Ingredient Weighting</span>
                    <span className="font-mono text-on-surface-variant text-[11px]">Cold Prep</span>
                  </div>
                  {checklist
                    .filter((c) => c.phase === 1)
                    .map((item) => (
                      <label
                        key={item.id}
                        className={clsx(
                          'flex items-center gap-3 p-3 rounded-xl border transition-colors cursor-pointer',
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
                          className={clsx(
                            'flex-1 text-xs font-medium',
                            item.isDone ? 'line-through text-on-surface-variant' : 'text-on-surface'
                          )}
                        >
                          {item.text}
                        </span>
                        <span className="font-label-caps text-[10px] bg-surface-container px-2 py-0.5 rounded font-mono text-on-surface-variant">
                          {item.badge}
                        </span>
                      </label>
                    ))}
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
                      <label
                        key={item.id}
                        className={clsx(
                          'flex items-center gap-3 p-3 rounded-xl border transition-colors cursor-pointer',
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
                          className={clsx(
                            'flex-1 text-xs font-medium',
                            item.isDone ? 'line-through text-on-surface-variant' : 'text-on-surface'
                          )}
                        >
                          {item.text}
                        </span>
                        <span className="font-label-caps text-[10px] bg-surface-container px-2 py-0.5 rounded font-mono text-on-surface-variant">
                          {item.badge}
                        </span>
                      </label>
                    ))}
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
                      <label
                        key={item.id}
                        className={clsx(
                          'flex items-center gap-3 p-3 rounded-xl border transition-colors cursor-pointer',
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
                          className={clsx(
                            'flex-1 text-xs font-medium',
                            item.isDone ? 'line-through text-on-surface-variant' : 'text-on-surface'
                          )}
                        >
                          {item.text}
                        </span>
                        <span className="font-label-caps text-[10px] bg-surface-container px-2 py-0.5 rounded font-mono text-on-surface-variant">
                          {item.badge}
                        </span>
                      </label>
                    ))}
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
                  When you complete this session, the following items will be automatically subtracted from your household inventory:
                </p>
                <div className="space-y-2 text-xs font-mono">
                  <div className="p-2.5 rounded-xl bg-surface-container-low border border-border/40 flex justify-between">
                    <span>Wild Salmon fillet</span>
                    <span className="text-primary font-bold">-300g</span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-surface-container-low border border-border/40 flex justify-between">
                    <span>Tricolor Quinoa</span>
                    <span className="text-primary font-bold">-120g</span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-surface-container-low border border-border/40 flex justify-between">
                    <span>Fresh Asparagus</span>
                    <span className="text-primary font-bold">-150g</span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-surface-container-low border border-border/40 flex justify-between">
                    <span>Cold-Pressed Olive Oil</span>
                    <span className="text-primary font-bold">-15ml</span>
                  </div>
                </div>

                <Button
                  onClick={() => {
                    toast('Session finalized! 640 kcal logged to fitness tracker & pantry inventory deducted.', 'success');
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
    </div>
  );
}
