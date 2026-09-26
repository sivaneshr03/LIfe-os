# LifeOS: Deployment & Infrastructure Runbook

## 1. Hosting Architecture
LifeOS is hosted entirely on Cloudflare serverless primitives:
- **Compute & API:** Cloudflare Workers running Hono.
- **Frontend SPA Distribution:** Cloudflare Workers Assets serving Vite static output.
- **Database:** Cloudflare D1 (Serverless Distributed SQLite).
- **Blob Storage:** Cloudflare R2 (deferred until attachments are introduced).

---

## 2. Environments

| Environment | Purpose | Database | Access URL |
| :--- | :--- | :--- | :--- |
| **Local Development** | Engineering & Unit Testing | Local Miniflare SQLite (`.wrangler/state/v3/d1`) | `http://localhost:5173` / `http://localhost:8787` |
| **Preview / Staging** | Pre-release validation | Isolated D1 Staging database | `https://staging.lifeos.internal` (Example) |
| **Production** | Live daily operational usage | Production Cloudflare D1 | Custom user domain (Cloudflare DNS) |

---

## 3. Deployment Gating & Approval Rules
- **No Automatic Deployments:** Agents and automated scripts are strictly prohibited from executing `wrangler deploy` to production without explicit user authorization in the session.
- **Pre-Deployment Checklist:**
  1. TypeScript compilation passes cleanly (`npm run build`).
  2. Test suite passes with 100% green status (`npm test`).
  3. No open unmigrated schema files in Drizzle.
  4. Explicit confirmation from user to proceed with deployment.

---

## 4. Database Migration Protocol

### 4.1 Migration Generation
Migrations are generated locally using Drizzle Kit:
```bash
# Generate SQL migration file
npx drizzle-kit generate
```

### 4.2 Local Migration Application (Permitted)
```bash
# Apply migration to local Miniflare D1
npx wrangler d1 migrations apply lifeos-db --local
```

### 4.3 Remote Migration Application (Requires Explicit Approval)
Applying migrations to remote D1 instances is a **Restricted Action** requiring:
1. Documented explanation of schema changes.
2. Verified export backup of existing remote database.
3. Explicit user approval command.
4. Execution command:
   ```bash
   npx wrangler d1 migrations apply lifeos-db --remote
   ```

---

## 5. Backup & Recovery Procedures

### 5.1 Remote D1 Database Export
Prior to any destructive migration or major release:
```bash
# Export remote database schema and data
npx wrangler d1 export lifeos-db --remote --output=./backups/backup-$(date +%Y%m%d%H%M%S).sql
```

### 5.2 Application Rollback
If a deployment exhibits regressions:
1. Re-deploy the previously known good worker version:
   ```bash
   npx wrangler rollback --version-id=<previous-version-id>
   ```
2. If schema rollback is required, execute the down-migration SQL script against D1.
