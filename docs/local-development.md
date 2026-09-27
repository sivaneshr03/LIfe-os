# LifeOS: Local Development & Cloudflare Guide

## 1. Overview
LifeOS uses a single Cloudflare Worker that combines Hono API routing under `/api/*` and serves static frontend assets created by Vite.

---

## 2. Prerequisites
- **Node.js:** v20.0.0 or higher (v24 LTS recommended)
- **Package Manager:** npm (bundled with Node)

---

## 3. Quick Start (Local Development)

### 3.1 Step 1: Install Dependencies
```bash
npm install
```

### 3.2 Step 2: Configure Local Environment Variables
Copy the example file to `.dev.vars` (recognized automatically by Wrangler):
```bash
cp .dev.vars.example .dev.vars
```

### 3.3 Step 3: Run the Development Server

**Option A: Single Command (Frontend + Backend concurrently):**
```bash
npm run dev
# Starts both the Wrangler worker backend (http://localhost:8787) and Vite frontend (http://localhost:5173)
```

**Option B: Separate Terminals:**

**Terminal 1 (Backend Worker & Miniflare D1):**
```bash
npm run dev:server
# Serves on http://localhost:8787 with local SQLite database in .wrangler/state/v3/d1
```

**Terminal 2 (Vite Frontend with HMR):**
```bash
npm run dev:client
# Serves on http://localhost:5173 with proxy for /api/* to http://localhost:8787
```

---

## 4. Database Migrations (Local)

To generate migration files from Drizzle schema:
```bash
npm run db:generate
```

To apply migrations to your local Miniflare D1 database:
```bash
npm run db:migrate:local
```

---

## 5. Quality Verification Commands

Before submitting pull requests or requesting reviews, ensure all checks pass:

```bash
# 1. Run ESLint
npm run lint

# 2. Run TypeScript strict type-checking
npm run typecheck

# 3. Run unit and integration tests
npm run test

# 4. Compile production frontend bundle
npm run build
```

---

## 6. Cloudflare Remote Setup (Manual One-Time Operations)

When ready to provision remote preview and production environments, execute:

```bash
# 1. Authenticate with Cloudflare
npx wrangler login

# 2. Create the Preview D1 database
npx wrangler d1 create lifeos-d1-preview
# Copy the returned database_id into wrangler.jsonc under env.preview.d1_databases[0].database_id

# 3. Create the Production D1 database
npx wrangler d1 create lifeos-d1-prod
# Copy the returned database_id into wrangler.jsonc under env.production.d1_databases[0].database_id
```
