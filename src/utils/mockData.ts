import { z } from 'zod';

export const localRecordCategoryEnum = z.enum([
  'engineering',
  'design',
  'marketing',
  'support',
  'operations',
  'product',
]);

export type LocalRecordCategory = z.infer<typeof localRecordCategoryEnum>;

/**
 * Strict schema for local in-memory records.
 */
export const localRecordSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1, 'Title is required'),
  content: z.string().min(1, 'Content is required'),
  category: localRecordCategoryEnum,
  createdAt: z.string(),
});

export type LocalRecord = z.infer<typeof localRecordSchema>;

/**
 * Schema for validating incoming CSV rows before normalizing.
 */
export const localRecordCsvRowSchema = z.object({
  id: z.string().optional(),
  title: z.string().min(1, 'Title cannot be empty'),
  content: z.string().min(1, 'Content cannot be empty'),
  category: z.string().transform((val) => {
    const clean = (val || '').toLowerCase().trim();
    if (['engineering', 'design', 'marketing', 'support', 'operations', 'product'].includes(clean)) {
      return clean as LocalRecordCategory;
    }
    return 'engineering' as LocalRecordCategory;
  }),
  createdAt: z.string().optional(),
});

export type LocalRecordCsvRow = z.infer<typeof localRecordCsvRowSchema>;

// Pre-generated seed templates for realistic records
const TITLES_AND_CONTENTS: Array<{ title: string; content: string; category: LocalRecordCategory }> = [
  // Engineering
  { title: 'Migrate Session Cache to Cloudflare KV', content: 'Evaluating read/write latencies between Cloudflare KV and D1 for ephemeral token validations.', category: 'engineering' },
  { title: 'Implement Edge Rate Limiting with Sliding Window', content: 'Implemented high-throughput sliding window rate limiter at edge proxy using Worker memory caches.', category: 'engineering' },
  { title: 'Optimize Bundle Splitting and Chunk Lazy Loading', content: 'Deconstructed vendor bundles into lightweight asynchronous chunks reducing initial JS payload by 38%.', category: 'engineering' },
  { title: 'Refactor Transaction Ledger to Atomic D1 Batches', content: 'Unified ledger balance calculations into atomic batch statements guaranteeing financial consistency.', category: 'engineering' },
  { title: 'Upgrade WebSocket Telemetry Pipeline', content: 'Integrated native WebSocket connections with automatic reconnection backoff for live updates.', category: 'engineering' },
  { title: 'Configure Strict CSP Headers with Nonces', content: 'Implemented strict content-security-policy headers preventing inline script injection vectors.', category: 'engineering' },
  { title: 'Database Index Optimization for Transaction Timestamps', content: 'Added composite B-Tree index on (user_id, transaction_date DESC) reducing query latency to 3ms.', category: 'engineering' },
  { title: 'Service Worker Background Sync Implementation', content: 'Enabled offline queueing in IndexedDB with automated background synchronization when back online.', category: 'engineering' },
  { title: 'Zod Schema Validation for Webhook Payloads', content: 'Strict runtime schema validation on all third-party webhook ingest endpoints.', category: 'engineering' },
  { title: 'Automated Vitest Regression Suite', content: 'Expanded test coverage across money helpers, ledger integrity invariants, and auth session flows.', category: 'engineering' },

  // Design
  { title: 'Soft Structuralism Design System Refresh', content: 'Defined calibrated CSS design tokens for light/dark modes with custom accent palette variables.', category: 'design' },
  { title: 'Micro-Interactions for Dropzone State Transitions', content: 'Crafted smooth spring-based drag animations with visual glowing borders and haptic feedback.', category: 'design' },
  { title: 'Typography Hierarchy & Readability Audit', content: 'Standardized Plus Jakarta Sans and JetBrains Mono pairings across mobile and desktop breakpoints.', category: 'design' },
  { title: 'Mobile Bottom Sheet Ergonomics', content: 'Designed thumb-friendly transaction and category selection sheets with swipe-to-dismiss gestures.', category: 'design' },
  { title: 'High-Contrast Dark Mode Color Tuning', content: 'Fine-tuned neutral card surfaces and subtle borders for optimal viewing on OLED displays.', category: 'design' },
  { title: 'Financial Cockpit KPI Widget Cards', content: 'Built 3D tilt cards displaying Net Worth, Savings Rate, and Runway with depth perspective.', category: 'design' },
  { title: 'Accessible Form Feedback and Error Tooltips', content: 'WCAG 2.2 AA compliant error banners with high-contrast text and descriptive ARIA attributes.', category: 'design' },
  { title: 'Empty State Illustrations and Zero-Data Prompts', content: 'Minimalist iconography and contextual action cues for empty transaction ledgers.', category: 'design' },

  // Marketing
  { title: 'Q4 Product Launch Announcement Strategy', content: 'Drafted multi-channel launch campaign highlighting edge speed and zero-cloud-lockin privacy.', category: 'marketing' },
  { title: 'SEO Keyword Clustering for Personal Finance OS', content: 'Mapped high-intent search queries around offline-first productivity and personal accounting.', category: 'marketing' },
  { title: 'Interactive ROI Calculator for Landing Page', content: 'Built client-side interactive savings calculator demonstrating compound interest benefits.', category: 'marketing' },
  { title: 'Customer Onboarding Email Sequence Optimization', content: 'Automated 3-part educational email sequence introducing quick-import and budgeting tools.', category: 'marketing' },
  { title: 'Open-Source Community Changelog Format', content: 'Established weekly release notes template spotlighting community contributions and benchmarks.', category: 'marketing' },
  { title: 'Product Hunt Launch Preparation Kit', content: 'Curated asset pack, teaser video, and discussion hooks for upcoming Product Hunt showcase.', category: 'marketing' },

  // Support
  { title: 'Troubleshooting Guide: Bank Statement CSV Mappings', content: 'Documented common CSV delimiter mismatches and how our client-side parser auto-detects headers.', category: 'support' },
  { title: 'PWA Installation FAQ for iOS Safari & Android Chrome', content: 'Step-by-step instructions for adding LifeOS to home screen with standalone display mode.', category: 'support' },
  { title: 'Handling Special Characters in Financial Payee Names', content: 'Guide on escaping quotes and currency symbols in CSV imports to avoid row parsing errors.', category: 'support' },
  { title: 'Password Reset & Account Recovery Playbook', content: 'Customer support SOP for verifying user identity before issuing secure session resets.', category: 'support' },
  { title: 'Data Export and Backup Self-Service Tutorial', content: 'Explaining one-click JSON/CSV ledger exports for archival and tax compliance.', category: 'support' },

  // Operations
  { title: 'Quarterly Infrastructure Cost Audit', content: 'Analyzed Cloudflare Workers requests, D1 read units, and egress bandwidth staying under free limits.', category: 'operations' },
  { title: 'Automated Database Snapshot Verification', content: 'Scheduled nightly headless export integrity tests ensuring point-in-time recovery readiness.', category: 'operations' },
  { title: 'Continuous Integration Pipeline Speedup', content: 'Parallelized linting, typechecks, and vitest runs on GitHub Actions down to 42 seconds.', category: 'operations' },
  { title: 'Zero-Downtime Migration Policy Review', content: 'Refined backward-compatible migration patterns using SQLite schema expansions.', category: 'operations' },

  // Product
  { title: 'Automated Recurring Subscription Detection', content: 'PRD: Algorithmic detection of monthly recurring charges with proactive renewal reminders.', category: 'product' },
  { title: 'Split Transaction Ledger Architecture', content: 'Feature spec: Allow splitting a single transaction across multiple budgetary categories.', category: 'product' },
  { title: 'Multi-Currency Conversion Rate Engine', content: 'Spec for offline-friendly daily FX rates with manual user overrides for foreign purchases.', category: 'product' },
  { title: 'Net Worth Milestone Celebrations', content: 'Gamified progress confetti and milestone badges when users reach financial milestones.', category: 'product' },
];

/**
 * Generates an array of realistic mock records for local development.
 * @param count Number of records to generate (defaults to 60)
 */
export function generateMockRecords(count: number = 60): LocalRecord[] {
  const records: LocalRecord[] = [];
  const baseDate = new Date('2026-09-29T12:00:00.000Z');

  for (let i = 0; i < count; i++) {
    const template = TITLES_AND_CONTENTS[i % TITLES_AND_CONTENTS.length];
    const offsetDays = Math.floor(i / 2);
    const date = new Date(baseDate.getTime() - offsetDays * 86400000);

    records.push({
      id: `rec_local_${String(i + 1).padStart(3, '0')}`,
      title: i >= TITLES_AND_CONTENTS.length ? `${template.title} #${Math.floor(i / TITLES_AND_CONTENTS.length) + 1}` : template.title,
      content: template.content,
      category: template.category,
      createdAt: date.toISOString().split('T')[0],
    });
  }

  return records;
}

/**
 * Returns a default set of 60 realistic mock records.
 */
export const DEFAULT_MOCK_RECORDS: LocalRecord[] = generateMockRecords(60);

/**
 * Generates a valid CSV text string containing mock records for testing CSV file drops.
 */
export function generateMockCsvString(count: number = 15): string {
  const records = generateMockRecords(count);
  const headers = ['id', 'title', 'content', 'category', 'createdAt'];

  const rows = records.map((rec) => [
    rec.id,
    `"${rec.title.replace(/"/g, '""')}"`,
    `"${rec.content.replace(/"/g, '""')}"`,
    rec.category,
    rec.createdAt,
  ].join(','));

  return [headers.join(','), ...rows].join('\n');
}

/**
 * Triggers a browser download of a sample .csv file for instant testing.
 */
export function downloadMockCsvFile(filename: string = 'sample_records_test.csv', count: number = 15): void {
  if (typeof window === 'undefined') return;

  const csvContent = generateMockCsvString(count);
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
