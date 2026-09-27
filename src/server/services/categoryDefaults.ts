import { eq, and } from 'drizzle-orm';
import type { D1Database } from '@cloudflare/workers-types';
import { createDb } from '../db/client';
import { categories } from '../db/schema';
import { slugify } from '../../shared/utils/pagination';
import type { CategoryDomain } from '../../shared/platformTypes';

interface DefaultCategoryPreset {
  domain: CategoryDomain;
  name: string;
  icon?: string;
  color?: string;
  description?: string;
  subcategories?: Array<{
    name: string;
    icon?: string;
    color?: string;
  }>;
}

export const DEFAULT_CATEGORY_PRESETS: DefaultCategoryPreset[] = [
  // Finance
  {
    domain: 'finance',
    name: 'Food & Dining',
    icon: '🌮',
    color: '#10b981', // emerald
    subcategories: [
      { name: 'Groceries', icon: '🛒', color: '#10b981' },
      { name: 'Breakfast', icon: '🍳', color: '#f59e0b' },
      { name: 'Lunch', icon: '🥗', color: '#10b981' },
      { name: 'Dinner', icon: '🍲', color: '#ec4899' },
      { name: 'Beverages', icon: '☕', color: '#8b5cf6' },
      { name: 'Restaurants & Takeout', icon: '🍔', color: '#ef4444' },
      { name: 'Coffee & Snacks', icon: '🍿', color: '#f97316' },
    ],
  },
  {
    domain: 'finance',
    name: 'Housing',
    icon: '🏠',
    color: '#3b82f6', // blue
    subcategories: [
      { name: 'Rent / Mortgage', icon: '🔑', color: '#3b82f6' },
      { name: 'Utilities', icon: '⚡', color: '#06b6d4' },
      { name: 'Maintenance & Repairs', icon: '🔨', color: '#f59e0b' },
      { name: 'Home Supplies', icon: '🧻', color: '#64748b' },
    ],
  },
  {
    domain: 'finance',
    name: 'Transportation',
    icon: '🚗',
    color: '#f59e0b', // amber
    subcategories: [
      { name: 'Fuel', icon: '⛽', color: '#ef4444' },
      { name: 'Public Transit', icon: '🚇', color: '#3b82f6' },
      { name: 'Vehicle Maintenance', icon: '🔧', color: '#f59e0b' },
      { name: 'Parking & Tolls', icon: '🅿️', color: '#8b5cf6' },
    ],
  },
  {
    domain: 'finance',
    name: 'Health & Wellness',
    icon: '💊',
    color: '#ec4899', // pink
    subcategories: [
      { name: 'Medical & Dental', icon: '🩺', color: '#ec4899' },
      { name: 'Pharmacy', icon: '💊', color: '#f43f5e' },
      { name: 'Fitness & Gym', icon: '🏋️', color: '#06b6d4' },
      { name: 'Mental Health', icon: '🧘', color: '#8b5cf6' },
    ],
  },
  {
    domain: 'finance',
    name: 'Personal & Entertainment',
    icon: '🛍️',
    color: '#8b5cf6', // violet
    subcategories: [
      { name: 'Subscriptions', icon: '📺', color: '#8b5cf6' },
      { name: 'Shopping & Clothes', icon: '👕', color: '#ec4899' },
      { name: 'Electronics & Gadgets', icon: '📱', color: '#3b82f6' },
      { name: 'Travel & Vacations', icon: '✈️', color: '#06b6d4' },
      { name: 'Hobbies & Games', icon: '🎮', color: '#10b981' },
    ],
  },
  {
    domain: 'finance',
    name: 'Income',
    icon: '💵',
    color: '#059669', // dark green
    subcategories: [
      { name: 'Salary & Wages', icon: '💼', color: '#059669' },
      { name: 'Freelance & Consulting', icon: '💻', color: '#10b981' },
      { name: 'Dividends & Capital Gains', icon: '📈', color: '#3b82f6' },
      { name: 'Gifts & Reimbursements', icon: '🎁', color: '#f59e0b' },
    ],
  },

  // Tasks
  {
    domain: 'task',
    name: 'Work',
    icon: 'briefcase',
    color: '#3b82f6',
    subcategories: [
      { name: 'Deep Work' },
      { name: 'Meetings' },
      { name: 'Administrative' },
    ],
  },
  {
    domain: 'task',
    name: 'Personal',
    icon: 'user',
    color: '#10b981',
    subcategories: [
      { name: 'Home & Family' },
      { name: 'Errands' },
      { name: 'Learning' },
    ],
  },

  // Notes
  {
    domain: 'note',
    name: 'Daily Log',
    icon: 'calendar',
    color: '#6366f1',
  },
  {
    domain: 'note',
    name: 'Knowledge & Ideas',
    icon: 'lightbulb',
    color: '#eab308',
  },
  {
    domain: 'note',
    name: 'Meetings',
    icon: 'users',
    color: '#14b8a6',
  },

  // Fitness
  {
    domain: 'fitness',
    name: 'Strength Training',
    icon: 'dumbbell',
    color: '#ef4444',
  },
  {
    domain: 'fitness',
    name: 'Cardio & Endurance',
    icon: 'activity',
    color: '#f97316',
  },
  {
    domain: 'fitness',
    name: 'Mobility & Recovery',
    icon: 'sun',
    color: '#06b6d4',
  },

  // Tracker
  {
    domain: 'tracker',
    name: 'Habits',
    icon: 'check-circle-2',
    color: '#10b981',
  },
  {
    domain: 'tracker',
    name: 'Wellness & Mood',
    icon: 'smile',
    color: '#a855f7',
  },

  // Goal
  {
    domain: 'goal',
    name: 'Career & Skills',
    icon: 'trending-up',
    color: '#3b82f6',
  },
  {
    domain: 'goal',
    name: 'Financial Independence',
    icon: 'piggy-bank',
    color: '#10b981',
  },
  {
    domain: 'goal',
    name: 'Health & Vitality',
    icon: 'flame',
    color: '#f43f5e',
  },
];

/**
 * Seeds default categories and subcategories for a given user.
 * Idempotent: Skips if categories already exist for the user in the domain.
 */
export async function seedDefaultCategories(
  d1: D1Database,
  userId: string,
  domainFilter?: CategoryDomain
): Promise<{ count: number }> {
  const db = createDb(d1);
  const presets = domainFilter
    ? DEFAULT_CATEGORY_PRESETS.filter((p) => p.domain === domainFilter)
    : DEFAULT_CATEGORY_PRESETS;

  let insertedCount = 0;

  for (let i = 0; i < presets.length; i++) {
    const preset = presets[i];
    const parentSlug = slugify(preset.name);

    // Check if category already exists for user and domain
    const existing = await db
      .select({ id: categories.id })
      .from(categories)
      .where(
        and(
          eq(categories.userId, userId),
          eq(categories.domain, preset.domain),
          eq(categories.slug, parentSlug)
        )
      )
      .limit(1);

    let parentId: string;

    if (existing.length > 0) {
      parentId = existing[0].id;
    } else {
      parentId = `cat_${crypto.randomUUID()}`;
      await db.insert(categories).values({
        id: parentId,
        userId,
        domain: preset.domain,
        parentId: null,
        name: preset.name,
        slug: parentSlug,
        icon: preset.icon || null,
        color: preset.color || null,
        description: preset.description || null,
        isDefault: 1,
        isEnabled: 1,
        sortOrder: i,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      insertedCount++;
    }

    // Insert subcategories if present
    if (preset.subcategories && preset.subcategories.length > 0) {
      for (let j = 0; j < preset.subcategories.length; j++) {
        const sub = preset.subcategories[j];
        const subSlug = slugify(sub.name);

        const existingSub = await db
          .select({ id: categories.id })
          .from(categories)
          .where(
            and(
              eq(categories.userId, userId),
              eq(categories.domain, preset.domain),
              eq(categories.parentId, parentId),
              eq(categories.slug, subSlug)
            )
          )
          .limit(1);

        if (existingSub.length === 0) {
          const subId = `cat_${crypto.randomUUID()}`;
          await db.insert(categories).values({
            id: subId,
            userId,
            domain: preset.domain,
            parentId,
            name: sub.name,
            slug: subSlug,
            icon: sub.icon || preset.icon || null,
            color: sub.color || preset.color || null,
            isDefault: 1,
            isEnabled: 1,
            sortOrder: j,
            createdAt: new Date(),
            updatedAt: new Date(),
          });
          insertedCount++;
        }
      }
    }
  }

  return { count: insertedCount };
}
