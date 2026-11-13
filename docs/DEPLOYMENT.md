# Deployment

The platform is two deployables plus PostgreSQL:

- **Web** — static SPA in `apps/web/dist` (plus `public/assets/vehicles`, which in production should be served from object storage via the CDN).
- **API** — Node.js 20 process (`apps/api`), stateless, horizontally scalable.
- **PostgreSQL** ≥ 14 (managed: Neon, Cloud SQL, RDS, Supabase…). Migrations run automatically at API start-up.

## Environment (API)

| Variable | Required | Description |
|---|---|---|
| `NODE_ENV` | yes | `production` disables the `?tenant=` override and the default-tenant fallback, and enables `Secure` cookies |
| `DATABASE_URL` | yes (prod) | `postgres://…`. Without it the API uses embedded PGlite (dev only) |
| `PORT` | no | Default `4000` |
| `TRUST_PROXY` | behind a proxy | `true` to resolve the tenant from `X-Forwarded-Host` — only when the proxy overwrites that header |
| `DB_POOL_MAX` | no | Default `10` |
| `SEED_DEMO` | no | `true` seeds demo tenants on an empty database (staging only) |
| `SEED_PASSWORD` | no | Password for seeded demo dealer accounts |
| `RATE_LIMIT` | no | `false` disables rate limiting (tests only) |

## Build

```bash
npm ci
npm test && npm run typecheck
npm run build                 # → apps/web/dist
NODE_ENV=production DATABASE_URL=… npm start -w @showroom/api
```

The API runs TypeScript through `tsx` (no separate compile step). For containers:

```dockerfile
FROM node:20-slim
WORKDIR /app
COPY . .
RUN npm ci --omit=dev --workspaces --include-workspace-root && npm i -g tsx
ENV NODE_ENV=production PORT=4000
CMD ["tsx", "apps/api/src/server.ts"]
```

## Routing

Serve everything from one origin per dealer hostname so session cookies stay first-party:

- `/api/*` → API (preserve the original `Host`, or set `X-Forwarded-Host` and `TRUST_PROXY=true`)
- `/assets/vehicles/*` → object storage, `Cache-Control: public, max-age=31536000, immutable` (version file names when assets change)
- `/draco/*`, `/basis/*`, `/assets/*.js|css|woff2` → static, immutable
- everything else → `index.html` (SPA fallback), `Cache-Control: no-cache`

## Custom domains for dealers (Cloudflare example)

1. Platform zone `showroom-platform.com` with a fallback origin (the load balancer/edge for web + API).
2. Enable **Cloudflare for SaaS**; each dealer adds a CNAME `showroom.dealer.mn → customers.showroom-platform.com`.
3. Create the custom hostname via the Cloudflare API (certificate issued automatically).
4. Add the hostname in the dealer dashboard (**Domains**) — the API then resolves the tenant from it.

Steps 3–4 can be automated together (not yet implemented).

## Operations

- Health check: `GET /api/health`.
- Back up PostgreSQL daily; leads are the business-critical data.
- New tenants: currently via SQL/seed (insert `tenants`, `tenant_domains`, `dealer_users` with a scrypt hash from `apps/api/src/auth.ts#hashPassword`). A platform-admin console is listed under remaining work.
- After deploys, run `BASE=https://<staging-host> npm run e2e` against staging.
