# [ADR-0001] Core Technology Stack: React, Vite, Hono, Cloudflare D1 & Drizzle

## Status
Accepted

## Context & Problem Statement
LifeOS requires an edge-native, zero-maintenance, low-latency, and cost-efficient platform to host a private personal life-management system for 1–5 users. The system must operate without persistent virtual machines or complex Kubernetes infrastructure while maintaining transactional integrity.

## Decision Drivers
- Zero ongoing fixed server costs within Cloudflare's generous free/low-tier limits.
- High-craft, responsive user experience on mobile and desktop.
- End-to-end TypeScript type safety between database schema, backend API, and frontend components.
- Direct SQLite transactional capabilities at the edge.

## Considered Options
1. Traditional Node.js/Express + PostgreSQL + Docker hosting (Render/Fly.io/VPS).
2. Next.js full-stack framework deployed on Vercel.
3. React + Vite SPA on Cloudflare Workers Assets + Hono API + Cloudflare D1 with Drizzle ORM.

## Decision Outcome
Chosen option: **React + Vite SPA on Cloudflare Workers Assets + Hono API + Cloudflare D1 with Drizzle ORM**.

### Positive Consequences
- Exceptional global latency with compute executed at Cloudflare edge locations.
- Zero server maintenance, automated scaling, and negligible infrastructure costs.
- Instant development server feedback with Vite and Miniflare local emulation.
- Complete data ownership in standard SQLite format via D1.

### Negative Consequences / Trade-offs
- Cloudflare D1 has single-writer SQLite transaction limits, acceptable for 1–5 users but not for massive multi-tenant SaaS.
- Edge runtime environment requires Web Standard APIs (no native Node.js C++ bindings).
