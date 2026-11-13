# Auto Showroom — interactive 3D automotive showroom platform

A multi-tenant platform for car dealerships: a cinematic, scroll-driven 3D presentation of each
vehicle (exterior → exploded view → engine → drivetrain → chassis → interior), a real-time
configurator, specifications with verification status, vehicle comparison, lead capture, and a dealer
dashboard. Built to be sold to dealerships in Mongolia and internationally.

> **Important — 3D assets are for evaluation only.** No licensed vehicle models are included.
> Locally the site uses third-party Sketchfab models imported by `scripts/import-*.ts`; several are
> non-commercial (CC BY-NC-SA) or of unverified provenance (some contain game-asset names), so they
> are git-ignored, labelled "Туршилтын загвар" in the UI, and **must be replaced with licensed models
> before commercial use**. Without them the LC300 falls back to generated demonstration geometry.
> See [docs/3D_ASSET_PIPELINE.md](docs/3D_ASSET_PIPELINE.md).
>
> The UI is in **Mongolian**. Specifications cite their source (official distributor documents where
> available) and are marked *Лавлагаа* until a dealer verifies them for the Mongolian market.

## Quick start

Requirements: Node.js ≥ 20.19, npm ≥ 10. No database server is needed for development (the API
uses embedded PostgreSQL via PGlite unless `DATABASE_URL` is set).

```bash
npm install
npm run assets:demo        # (re)generate the demonstration GLBs + manifest (already committed)
npm run dev                # API on :4000, web on :5173
```

Open a tenant by hostname — `*.localhost` resolves to your machine in Chrome, Firefox and Safari:

| URL | Tenant |
|---|---|
| http://dealer-a.localhost:5173 | Demo Motors A (Land Cruiser 300, LX 600, Jetour T2) |
| http://dealer-b.localhost:5173 | Demo Motors B (Land Cruiser 300, LX 600) |
| http://localhost:5173 | Falls back to `dealer-a` in development only |

Dealer dashboard: `/dealer` — `owner@dealer-a.example.com` or `owner@dealer-b.example.com`,
password `showroom-demo-2026` (override with `SEED_PASSWORD`). Accounts only work on their own
dealership's hostnames.

Useful URL flags: `?quality=low|medium|high` (force render quality), `?nowebgl` (test the fallback).

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | API (tsx watch) + Vite dev server |
| `npm test` | Shared, API (incl. tenant-isolation suite) and engine unit tests |
| `npm run typecheck` | TypeScript across all packages |
| `npm run build` | Production web build (`apps/web/dist`) + API typecheck |
| `npm run e2e` | Playwright browser check against a running dev stack (`BASE=http://dealer-a.localhost:5173`) — screenshots in `test-results/` |
| `npm run assets:demo` | Generate demonstration GLBs (Draco) and `demo.manifest.json` |
| `npx tsx scripts/import-lc300.ts` | Build the LC300 evaluation assets (5 systems, 46 components) from `incoming/` models |
| `npx tsx scripts/import-showcase.ts [id…]` | Import whole-vehicle evaluation models (LX 600, GX 550, LC 250, Dashing, Song Plus) |
| `npm run assets:validate -- <dir>` | Check a manifest against its GLBs (nodes, materials, switches) |
| `npm run db:generate` | Generate a SQL migration after editing `apps/api/src/db/schema.ts` |
| `npm run db:seed` | Seed demo tenants into an empty database |

## Repository layout

```
packages/shared/     Domain contracts (zod): vehicle, specs + verification status, 3D manifest, leads, tenant
apps/api/            Express + Drizzle + PostgreSQL/PGlite. Tenant resolution, public & dealer APIs
  src/catalog/       Seed catalogue content (specs with sources and status)
  drizzle/           SQL migrations
apps/web/            React + Vite + Tailwind v4 + React Three Fiber + GSAP + Zustand
  src/engine/        Reusable, vehicle-agnostic 3D engine (VehicleScene, VehicleModel, VehicleCamera, …)
  src/pages/         Home, Catalog, Vehicle (scroll story), Configurator, Compare, Contact, dealer/*
  public/assets/vehicles/<brand>/<model>/   Manifest + per-system GLBs
scripts/             Demo asset generator, asset validator, browser check
docs/                Architecture & audit, deployment, 3D asset pipeline
```

## What is real and what is not

| Area | Status |
|---|---|
| Scroll-driven story, exploded views, component selection, configurator, leads, dashboard, multi-tenancy | **Working** — tested end-to-end in a browser |
| 3D geometry | **Evaluation models** (third-party, see licence table in the pipeline doc) — LC300 exterior/interior/chassis are the real model split into parts; engine is an illustrative CC BY twin-turbo V6; gearbox internals are real CAD planetary/hypoid gears; torque converter & transfer case remain demo geometry |
| Specifications | **Reference** values with cited sources (Toyota Iraq / Toyota Australia / Jetour UAE / Lexus USA official documents; a few third-party values are labelled as such) or **not available**. Nothing is marked verified; dealers verify per market |
| Prices | **None seeded**. Shown only when a dealer enters them; estimates are computed server-side |
| Colours | LC300 body colours are the 5 official Toyota colours (hex approximated); other options and interior packages are labelled demonstration |
| Object-storage upload of 3D assets, email/SMS lead notifications, custom-domain TLS automation | **Not implemented** — see [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md#remaining-work) |

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for the audit, design decisions and risks, and
[docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) to run it in production.
