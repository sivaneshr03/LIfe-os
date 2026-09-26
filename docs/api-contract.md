# LifeOS: API Contract & Endpoint Specifications

## 1. Protocol & Response Envelope Standards
All API endpoints are hosted under `/api/*` and communicate strictly via HTTPS using JSON payloads.

### 1.1 Success Response Envelope
```json
{
  "success": true,
  "data": { ... }
}
```

### 1.2 Error Response Envelope
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Human-readable explanation of error",
    "details": [ ... ]
  }
}
```

### 1.3 Standard HTTP Status Codes
- `200 OK`: Request succeeded.
- `201 Created`: Resource successfully created.
- `400 Bad Request`: Generic client error or malformed JSON.
- `401 Unauthorized`: Session cookie missing, expired, or invalid.
- `403 Forbidden`: Authenticated user lacks required permissions (e.g. non-admin accessing `/admin`).
- `404 Not Found`: Target entity does not exist.
- `422 Unprocessable Content`: Zod schema validation failed for request body/params.
- `500 Internal Server Error`: Unhandled edge error (no sensitive stack traces leaked).

---

## 2. Authentication & Session Endpoints

### `POST /api/auth/login`
- **Description:** Authenticates user and sets session cookie.
- **Request Body (Zod):**
  ```typescript
  z.object({
    email: z.string().email(),
    password: z.string().min(8)
  })
  ```
- **Response:** `200 OK` + `Set-Cookie: session_id=...; HttpOnly; Secure; SameSite=Lax; Path=/`

### `POST /api/auth/logout`
- **Description:** Invalidates the current session in D1 and clears the session cookie.
- **Response:** `200 OK` + `Set-Cookie: session_id=; Max-Age=0`

### `GET /api/auth/me`
- **Description:** Returns the currently authenticated user profile and settings.
- **Response:**
  ```json
  {
    "success": true,
    "data": {
      "id": "usr_01H...",
      "email": "alex@example.com",
      "name": "Alex",
      "role": "admin",
      "settings": {
        "theme_mode": "dark",
        "theme_color": "emerald",
        "base_currency": "USD"
      }
    }
  }
  ```

---

## 3. Tasks & Projects Endpoints

### `GET /api/tasks`
- **Query Params:** `status`, `project_id`, `priority`, `due_before`, `due_after`.
- **Response:** Array of Task objects with project badges.

### `POST /api/tasks`
- **Request Body (Zod):**
  ```typescript
  z.object({
    project_id: z.string().optional(),
    title: z.string().min(1).max(255),
    description: z.string().optional(),
    priority: z.enum(['low', 'medium', 'high', 'urgent']).default('medium'),
    due_date: z.number().int().optional(),
    recurrence_rule: z.string().optional()
  })
  ```

### `PATCH /api/tasks/:id`
- **Request Body:** Partial Task object (title, status, priority, order_index, etc.).

### `DELETE /api/tasks/:id`
- **Response:** `200 OK` with `{ "success": true, "data": { "id": "..." } }`.

---

## 4. Personal Finance & Ledger Endpoints

### `GET /api/finance/accounts`
- **Response:** Array of finance accounts with real-time calculated and cached `balance_cents`.

### `POST /api/finance/accounts`
- **Request Body (Zod):**
  ```typescript
  z.object({
    name: z.string().min(1).max(100),
    type: z.enum(['checking', 'savings', 'credit', 'cash', 'loan', 'investment']),
    currency: z.string().length(3).default('USD'),
    initial_balance_cents: z.number().int().default(0)
  })
  ```

### `GET /api/finance/transactions`
- **Query Params:** `account_id`, `category`, `start_date`, `end_date`, `limit`, `offset`.
- **Response:** List of transactions with total pagination count.

### `POST /api/finance/transactions`
- **Request Body (Zod):**
  ```typescript
  z.object({
    account_id: z.string().min(1),
    category: z.string().min(1),
    amount_cents: z.number().int(), // Signed integer (e.g. -2500 for $25.00 expense)
    transaction_date: z.number().int(),
    payee: z.string().optional(),
    notes: z.string().optional(),
    transfer_account_id: z.string().optional()
  })
  ```

### `GET /api/finance/net-worth`
- **Response:** Aggregation of total assets, total liabilities, and historical monthly snapshots.

---

## 5. Investment Endpoints

### `GET /api/investments/assets`
- **Response:** Array of held assets, current quantity (`units_micro` divided by 10^6), latest quote, and total market value.

### `POST /api/investments/quotes`
- **Description:** Submit a manual price quote for an asset.
- **Request Body (Zod):**
  ```typescript
  z.object({
    asset_id: z.string().min(1),
    price_cents: z.number().int().positive(),
    recorded_at: z.number().int().default(() => Date.now())
  })
  ```

### `POST /api/investments/import/csv`
- **Description:** Multi-row portfolio holding or transaction upload.
- **Request Body:** JSON array of parsed rows from the client CSV reader.
- **Processing:** Dry-run validation check returning warnings/errors, or atomic batch commit.

---

## 6. Notes & Prompts Endpoints

### `GET /api/notes`
- **Query Params:** `tag`, `is_daily`, `daily_date`, `search`.

### `POST /api/notes`
- **Request Body (Zod):**
  ```typescript
  z.object({
    title: z.string().min(1).max(255),
    content: z.string(),
    is_daily: z.boolean().default(false),
    daily_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    pinned: z.boolean().default(false)
  })
  ```

### `GET /api/prompts` & `POST /api/prompts`
- **Description:** Prompt template storage and retrieval with variable definitions.

---

## 7. Habits & Trackers Endpoints

### `GET /api/habits`
- **Response:** Active habits with 30-day streak metadata.

### `POST /api/habits/:id/toggle`
- **Request Body:** `{ "date": "YYYY-MM-DD", "completed": boolean }`
- **Response:** Updated completion status and current streak count.

---

## 8. Administration Endpoints (`/api/admin/*`)
*Requires `role === 'admin'`. Non-admins receive `403 Forbidden`.*

### `GET /api/admin/users`
- **Response:** List of users (passwords omitted), active session count, last active timestamp.

### `POST /api/admin/users`
- **Description:** Provision a new user (capped at 5 users max).
- **Request Body (Zod):**
  ```typescript
  z.object({
    email: z.string().email(),
    password: z.string().min(12),
    name: z.string().min(1),
    role: z.enum(['admin', 'member'])
  })
  ```

### `GET /api/admin/export`
- **Description:** Generates a complete atomic JSON data export containing all user tables for backup.
