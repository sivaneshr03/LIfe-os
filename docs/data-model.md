# LifeOS: Relational Data Model (Cloudflare D1 & Drizzle ORM)

## 1. Schema Conventions
- **Dialect:** SQLite (Cloudflare D1).
- **Primary Keys:** `TEXT` storing cryptographically random ULIDs or UUIDv4 for collision resistance across edge nodes.
- **Timestamps:** `INTEGER` storing Unix timestamps in milliseconds (`Date.now()`).
- **Monetary Values:** `INTEGER` storing minor units (cents). For example, `$10.50` = `1050`. No floating-point values.
- **Fractional Units (Investments):** `INTEGER` scaled to 6 decimal places (micro-units: `units * 10^6`). For example, `1.250000` shares = `1250000`.

---

## 2. Table Specifications

### 2.1 Users & Authentication

#### `users`
| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | TEXT | PRIMARY KEY | User identifier |
| `email` | TEXT | NOT NULL, UNIQUE | User email address |
| `password_hash` | TEXT | NOT NULL | PBKDF2/Argon2 password hash |
| `name` | TEXT | NOT NULL | Display name |
| `role` | TEXT | NOT NULL, DEFAULT 'member' | `'admin'` or `'member'` |
| `created_at` | INTEGER | NOT NULL | Creation timestamp |
| `updated_at` | INTEGER | NOT NULL | Last update timestamp |

#### `sessions`
| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | TEXT | PRIMARY KEY | Opaque session token |
| `user_id` | TEXT | NOT NULL, REFERENCES users(id) ON DELETE CASCADE | Associated user |
| `expires_at` | INTEGER | NOT NULL | Expiration timestamp |
| `created_at` | INTEGER | NOT NULL | Issuance timestamp |
| `last_active_at` | INTEGER | NOT NULL | Activity tracking timestamp |

---

### 2.2 Tasks & Projects

#### `projects`
| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | TEXT | PRIMARY KEY | Project identifier |
| `user_id` | TEXT | NOT NULL, REFERENCES users(id) ON DELETE CASCADE | Owner |
| `name` | TEXT | NOT NULL | Project title |
| `color` | TEXT | NOT NULL, DEFAULT '#3b82f6' | Project badge color |
| `icon` | TEXT | | Optional icon slug |
| `archived` | INTEGER | NOT NULL, DEFAULT 0 | Boolean flag (0 or 1) |
| `created_at` | INTEGER | NOT NULL | Creation timestamp |
| `updated_at` | INTEGER | NOT NULL | Last update timestamp |

#### `tasks`
| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | TEXT | PRIMARY KEY | Task identifier |
| `user_id` | TEXT | NOT NULL, REFERENCES users(id) ON DELETE CASCADE | Owner |
| `project_id` | TEXT | REFERENCES projects(id) ON DELETE SET NULL | Optional parent project |
| `title` | TEXT | NOT NULL | Task title |
| `description` | TEXT | | Markdown description |
| `status` | TEXT | NOT NULL, DEFAULT 'todo' | `'todo'`, `'in_progress'`, `'done'`, `'archived'` |
| `priority` | TEXT | NOT NULL, DEFAULT 'medium' | `'low'`, `'medium'`, `'high'`, `'urgent'` |
| `due_date` | INTEGER | | Optional due timestamp |
| `recurrence_rule` | TEXT | | RRULE string (e.g., `FREQ=WEEKLY;BYDAY=MO`) |
| `order_index` | INTEGER | NOT NULL, DEFAULT 0 | Kanban ordering position |
| `completed_at` | INTEGER | | Timestamp of completion |
| `created_at` | INTEGER | NOT NULL | Creation timestamp |
| `updated_at` | INTEGER | NOT NULL | Last update timestamp |

---

### 2.3 Notes & Prompts

#### `notes`
| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | TEXT | PRIMARY KEY | Note identifier |
| `user_id` | TEXT | NOT NULL, REFERENCES users(id) ON DELETE CASCADE | Owner |
| `title` | TEXT | NOT NULL | Note title |
| `content` | TEXT | NOT NULL, DEFAULT '' | Markdown note content |
| `is_daily` | INTEGER | NOT NULL, DEFAULT 0 | Boolean flag for daily log |
| `daily_date` | TEXT | | Date string (`YYYY-MM-DD`) if daily note |
| `pinned` | INTEGER | NOT NULL, DEFAULT 0 | Boolean flag |
| `created_at` | INTEGER | NOT NULL | Creation timestamp |
| `updated_at` | INTEGER | NOT NULL | Last update timestamp |

#### `prompts`
| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | TEXT | PRIMARY KEY | Prompt template identifier |
| `user_id` | TEXT | NOT NULL, REFERENCES users(id) ON DELETE CASCADE | Owner |
| `title` | TEXT | NOT NULL | Prompt title |
| `content` | TEXT | NOT NULL | Prompt text with `{{var}}` placeholders |
| `category` | TEXT | NOT NULL, DEFAULT 'general' | Category classification |
| `tags` | TEXT | | Comma-separated or JSON string |
| `created_at` | INTEGER | NOT NULL | Creation timestamp |
| `updated_at` | INTEGER | NOT NULL | Last update timestamp |

---

### 2.4 Habits & Trackers

#### `habits`
| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | TEXT | PRIMARY KEY | Habit identifier |
| `user_id` | TEXT | NOT NULL, REFERENCES users(id) ON DELETE CASCADE | Owner |
| `title` | TEXT | NOT NULL | Habit name |
| `frequency_type` | TEXT | NOT NULL, DEFAULT 'daily' | `'daily'`, `'weekly'` |
| `target_days_per_week` | INTEGER | NOT NULL, DEFAULT 7 | Target days |
| `color` | TEXT | NOT NULL, DEFAULT '#10b981' | Color badge |
| `archived` | INTEGER | NOT NULL, DEFAULT 0 | Boolean flag |
| `created_at` | INTEGER | NOT NULL | Creation timestamp |
| `updated_at` | INTEGER | NOT NULL | Last update timestamp |

#### `habit_logs`
| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | TEXT | PRIMARY KEY | Log entry identifier |
| `habit_id` | TEXT | NOT NULL, REFERENCES habits(id) ON DELETE CASCADE | Habit reference |
| `log_date` | TEXT | NOT NULL | Date string (`YYYY-MM-DD`) |
| `completed` | INTEGER | NOT NULL, DEFAULT 1 | Boolean (0 or 1) |
| `created_at` | INTEGER | NOT NULL | Log timestamp |

---

### 2.5 Finance, Budgets & Debts

#### `finance_accounts`
| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | TEXT | PRIMARY KEY | Account identifier |
| `user_id` | TEXT | NOT NULL, REFERENCES users(id) ON DELETE CASCADE | Owner |
| `name` | TEXT | NOT NULL | Account name |
| `type` | TEXT | NOT NULL | `'checking'`, `'savings'`, `'credit'`, `'cash'`, `'loan'`, `'investment'` |
| `balance_cents` | INTEGER | NOT NULL, DEFAULT 0 | Cached reconciled balance in minor units (cents) |
| `currency` | TEXT | NOT NULL, DEFAULT 'USD' | 3-letter currency code |
| `archived` | INTEGER | NOT NULL, DEFAULT 0 | Boolean flag |
| `created_at` | INTEGER | NOT NULL | Creation timestamp |
| `updated_at` | INTEGER | NOT NULL | Last update timestamp |

#### `finance_transactions`
| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | TEXT | PRIMARY KEY | Transaction identifier |
| `user_id` | TEXT | NOT NULL, REFERENCES users(id) ON DELETE CASCADE | Owner |
| `account_id` | TEXT | NOT NULL, REFERENCES finance_accounts(id) ON DELETE CASCADE | Account reference |
| `category` | TEXT | NOT NULL | Spending/income category |
| `amount_cents` | INTEGER | NOT NULL | Signed integer in cents (positive for income, negative for expense) |
| `transaction_date` | INTEGER | NOT NULL | Date timestamp |
| `payee` | TEXT | | Payee or source |
| `notes` | TEXT | | Optional notes |
| `transfer_account_id` | TEXT | REFERENCES finance_accounts(id) ON DELETE SET NULL | Destination account if transfer |
| `created_at` | INTEGER | NOT NULL | Creation timestamp |

#### `finance_budgets`
| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | TEXT | PRIMARY KEY | Budget identifier |
| `user_id` | TEXT | NOT NULL, REFERENCES users(id) ON DELETE CASCADE | Owner |
| `category` | TEXT | NOT NULL | Category name |
| `limit_cents` | INTEGER | NOT NULL | Monthly limit in cents |
| `period` | TEXT | NOT NULL, DEFAULT 'monthly' | Budget cycle |
| `created_at` | INTEGER | NOT NULL | Creation timestamp |

#### `finance_debts`
| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | TEXT | PRIMARY KEY | Debt tracking identifier |
| `user_id` | TEXT | NOT NULL, REFERENCES users(id) ON DELETE CASCADE | Owner |
| `name` | TEXT | NOT NULL | Creditor / Debt name |
| `principal_cents` | INTEGER | NOT NULL | Original amount in cents |
| `remaining_cents` | INTEGER | NOT NULL | Current remaining balance in cents |
| `interest_rate_basis_points` | INTEGER | NOT NULL | APR in basis points (e.g. 5.25% = `525`) |
| `min_payment_cents` | INTEGER | NOT NULL | Minimum payment in cents |
| `due_day_of_month` | INTEGER | | Day of month (1-31) |
| `created_at` | INTEGER | NOT NULL | Creation timestamp |
| `updated_at` | INTEGER | NOT NULL | Last update timestamp |

---

### 2.6 Investments

#### `investment_assets`
| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | TEXT | PRIMARY KEY | Asset identifier |
| `user_id` | TEXT | NOT NULL, REFERENCES users(id) ON DELETE CASCADE | Owner |
| `symbol` | TEXT | NOT NULL | Ticker or asset code (e.g. `AAPL`, `BTC`, `VTI`) |
| `name` | TEXT | NOT NULL | Descriptive name |
| `asset_type` | TEXT | NOT NULL | `'stock'`, `'etf'`, `'crypto'`, `'real_estate'`, `'other'` |
| `units_micro` | INTEGER | NOT NULL, DEFAULT 0 | Current quantity held scaled by $10^6$ |
| `avg_cost_basis_cents` | INTEGER | NOT NULL, DEFAULT 0 | Average cost per unit in cents |
| `latest_price_cents` | INTEGER | NOT NULL, DEFAULT 0 | Latest manual quote in cents |
| `latest_price_at` | INTEGER | | Timestamp of latest quote |
| `created_at` | INTEGER | NOT NULL | Creation timestamp |
| `updated_at` | INTEGER | NOT NULL | Last update timestamp |

#### `investment_quotes`
| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | TEXT | PRIMARY KEY | Historical quote identifier |
| `asset_id` | TEXT | NOT NULL, REFERENCES investment_assets(id) ON DELETE CASCADE | Asset reference |
| `price_cents` | INTEGER | NOT NULL | Recorded price quote in cents |
| `recorded_at` | INTEGER | NOT NULL | Quote timestamp |
| `source` | TEXT | NOT NULL, DEFAULT 'manual' | `'manual'`, `'csv_import'` |

---

### 2.7 Global Settings

#### `app_settings`
| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | TEXT | PRIMARY KEY | Settings entry identifier |
| `user_id` | TEXT | NOT NULL, UNIQUE, REFERENCES users(id) ON DELETE CASCADE | User reference |
| `theme_mode` | TEXT | NOT NULL, DEFAULT 'system' | `'system'`, `'light'`, `'dark'` |
| `theme_color` | TEXT | NOT NULL, DEFAULT 'emerald' | Accent palette key |
| `base_currency` | TEXT | NOT NULL, DEFAULT 'USD' | Preferred base currency |
| `date_format` | TEXT | NOT NULL, DEFAULT 'YYYY-MM-DD' | Date presentation format |
| `updated_at` | INTEGER | NOT NULL | Last update timestamp |

---

## 3. Database Indexes
To maintain optimal query velocity on SQLite edge instances, the following indexes are strictly enforced:
- `idx_sessions_user_expires` ON `sessions (user_id, expires_at)`
- `idx_tasks_user_status_due` ON `tasks (user_id, status, due_date)`
- `idx_transactions_user_account_date` ON `finance_transactions (user_id, account_id, transaction_date DESC)`
- `idx_notes_user_daily` ON `notes (user_id, is_daily, daily_date)`
- `idx_habit_logs_habit_date` ON `habit_logs (habit_id, log_date)`
- `idx_investment_quotes_asset_time` ON `investment_quotes (asset_id, recorded_at DESC)`
