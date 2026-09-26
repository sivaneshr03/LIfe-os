# LifeOS: Product Specification

## 1. System Vision & Scope
LifeOS is a private, high-craft personal productivity and life-management web application engineered for 1–5 authorized users (e.g., an individual, couple, or small household). It unifies task execution, personal finance, investment tracking, knowledge management, habit building, and wellness monitoring into a cohesive, fast, and secure interface.

The system is hosted on Cloudflare's serverless edge infrastructure (Workers, D1, Workers Assets) and operates as an installable Progressive Web Application (PWA).

---

## 2. Core Functional Modules

### 2.1 Tasks & Projects
- **Projects & Areas:** Hierarchical organization of work into Life Areas (e.g., Work, Health, Personal, Home) and distinct Projects.
- **Views:** List view, Kanban board view (customizable columns/stages), and Calendar/Timeline view.
- **Task Hierarchy:** Tasks support description (Markdown), subtasks/checklists, priority levels (`low`, `medium`, `high`, `urgent`), tags, and status (`todo`, `in_progress`, `blocked`, `done`, `archived`).
- **Recurrence Engine:** Flexible recurring schedules (daily, weekly on specific days, monthly on specific dates/weekdays, yearly). Recurrence evaluates on completion or on schedule.
- **Reminders & Due Dates:** Hard due dates, soft target dates, and timed reminders.

### 2.2 Personal Finance & Ledger
- **Account Management:** Checking, savings, credit cards, cash, loan, and asset accounts.
- **Double-Entry/Atomic Ledger:** Every movement of funds is recorded as an immutable transaction with source, destination, category, date, and notes.
- **Integer Cents Representation:** All monetary values stored and calculated as integer cents to avoid floating-point drift.
- **Budgets:** Monthly or custom category budgets with spending thresholds, rollover options, and progress indicators.
- **Debt Tracking:** Dedicated debt payoff planner (snowball / avalanche methods), interest rate tracking, and amortization projections.
- **Net Worth Engine:** Real-time and historical net worth aggregation (Total Assets minus Total Liabilities).

### 2.3 Investments & Portfolio
- **Asset Classes:** Stocks, ETFs, mutual funds, crypto, real estate, and private assets.
- **Holdings Management:** Tracking quantity (up to 6 decimal places), average cost basis, purchase transactions, and current valuation.
- **Manual Pricing Updates:** Quote update interface allowing timestamped manual price updates per asset.
- **CSV Portfolio Import:** Bulk transaction and holding ingestion via CSV with schema preview, error highlighting, and atomic commit. Zero dependency on paid third-party financial market APIs.

### 2.4 Notes, Knowledge & Prompts
- **Daily Notes:** Daily journal entries automatically linked to the calendar with quick scratchpads and task review logs.
- **Knowledge Base:** Hierarchical Markdown notes with tag support, full-text search, and bidirectional note linking.
- **Prompt Manager:** Curated repository for reusable AI prompts, templates with variable placeholders (e.g., `{{topic}}`, `{{audience}}`), and categorization.

### 2.5 Goals, Trackers, Habits & Fitness
- **Goals & Key Results (OKRs):** Strategic milestones linked to projects, habits, and target completion dates.
- **Flexible Trackers:** Generic metric trackers supporting boolean (yes/no), numeric count, duration (minutes), or rating scales (1–5).
- **Habit Streaks:** Habit consistency tracking with streak calculations, completion heatmaps, and customizable weekly targets (e.g., "5 times a week").
- **Fitness Logging:** Workout routines, exercise log with sets/reps/weights, cardiovascular session tracking, and body metrics.

### 2.6 Search, Insights & Data Portability
- **Universal Command Palette (Ctrl/Cmd+K):** Fast cross-entity search spanning tasks, notes, accounts, transactions, habits, and prompts.
- **Advanced Filtering:** Multi-criteria filtering by tag, date range, status, account, and priority across all modules.
- **Insights & Visualizations:** Interactive charts for spending breakdown, monthly savings rate, task completion velocity, and habit consistency.
- **Data Export & Import:** Full workspace JSON export/import and SQLite database backup for self-sovereign data ownership.

### 2.7 Administration Panel (`/admin`)
- **Access Control:** Restricted strictly to users with the `admin` role.
- **User Provisioning:** Create, edit, disable, or reset passwords for up to 5 authorized users.
- **Audit Logs:** View audit records for security events, authentication attempts, database migrations, and administrative actions.
- **System Health:** Database size, storage utilization, and session termination tools.

### 2.8 Global Settings, Theming & PWA
- **Theme Modes:** System default, explicit Light mode, and explicit Dark mode.
- **Dynamic Accent Color:** Customizable primary accent color (e.g., Emerald, Indigo, Amber, Rose, Violet) dynamically applied across the interface using CSS custom properties.
- **PWA Experience:** Installable to mobile and desktop home screens with responsive layout, app icons, splash screens, and offline static asset caching.
