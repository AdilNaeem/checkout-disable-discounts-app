## Project Context & Infrastructure Setup

### App Overview
Shopify app called "Checkout Disable Discounts App" built with:
- Remix / React Router v7
- Prisma ORM with PostgreSQL (Prisma Postgres via Vercel)
- Shopify Functions (discount-function-js, discount-code-owner)
- @shopify/shopify-app-react-router for auth/session

### Repository
GitHub: AdilNaeem/checkout-disable-discounts-app
- `develop` branch → Preview environment (dev/testing)
- `main` branch → Production environment (live)

### Vercel Deployment
Two stable domains:
- Production: https://checkout-disable-discounts-app.vercel.app (main branch)
- Preview/Dev: https://checkout-discounts-dev.vercel.app (develop branch)

Vercel env vars set:
- SHOPIFY_API_KEY=<see Vercel env vars>
- SHOPIFY_API_SECRET=<see Vercel env vars — never commit this>
- SCOPES=write_discounts,write_products,write_metaobjects,write_metaobject_definitions
- SHOPIFY_APP_URL=https://checkout-disable-discounts-app.vercel.app (Production)
- SHOPIFY_APP_URL=https://checkout-discounts-dev.vercel.app (Preview)
- DATABASE_URL, POSTGRES_URL, PRISMA_DATABASE_URL — all auto-set by Vercel Prisma Postgres integration

### Database
- Local dev: SQLite (file:dev.sqlite) via .env
- Vercel (both environments): Prisma Postgres
- schema.prisma uses: provider = "postgresql", url = env("DATABASE_URL")
- Migration applied: 20240530213853_create_session_table (fixed DATETIME → TIMESTAMP(3) for PostgreSQL compatibility)

### Shopify App Config (shopify.app.toml)
- client_id: <see shopify.app.toml>
- application_url: https://checkout-disable-discounts-app.vercel.app
- redirect_urls: both production and dev Vercel URLs
- scopes: write_discounts, write_products, write_metaobjects, write_metaobject_definitions
- automatically_update_urls_on_dev: true

### App Entry Point
app/shopify.server.js reads:
- process.env.SHOPIFY_API_KEY
- process.env.SHOPIFY_API_SECRET
- process.env.SCOPES
- process.env.SHOPIFY_APP_URL (critical — must not be empty)

### Deployment Rules
- Web app (UI/routes/API changes): just `git push origin develop` → Vercel auto-deploys
- Shopify Functions (anything in /extensions): must run `npx shopify app deploy` manually after push
- To go live: merge develop into main → `git push origin main` → Vercel auto-deploys production

### Workflow
Daily development
git checkout develop
make changes
git add .

git commit -m "feat: your change"

git push origin develop
If extensions changed:
npx shopify app deploy
Release to production
git checkout main

git merge develop

git push origin main
If extensions changed:
npx shopify app deploy

### Store
- boxraw-au.myshopify.com is the live store also used for testing
- App installed on boxraw-au using production Vercel URL

### Known Issues Resolved
- SQLite → PostgreSQL migration: DATETIME replaced with TIMESTAMP(3)
- SHOPIFY_APP_URL must be set in Vercel env vars or app crashes with "empty appUrl" error
- Vercel preview URLs change on every deploy — use stable custom domains instead
- .env.local pulled from Vercel via `vercel link` then `vercel env pull .env.local`
- Local .env uses DATABASE_URL=file:dev.sqlite for SQLite, Vercel uses Prisma Postgres URL

### Do Not Break
- Prisma schema provider must stay "postgresql"
- SHOPIFY_APP_URL env var must always be set
- shopify.app.toml application_url and redirect_urls must match Vercel domains
- Extensions require manual `shopify app deploy` — Vercel does not handle them
- .env and .env.local are gitignored — never commit them