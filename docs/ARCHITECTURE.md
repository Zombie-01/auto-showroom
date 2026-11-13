# Architecture

## Phase 0 — repository audit (2026-11-04)

`/home/senge/projects` contained 18 unrelated projects (education platforms, scrapers, a trading
bot, the Monte Garden 3D site) and **no automotive codebase**, so this platform is a new project in
`auto-showroom/`. Nothing existing was modified.

Relevant prior art: `monte/` (Vite + three.js + GSAP + Playwright) — this project follows the same
build tool and testing approach. Tooling found: Node 20.20, npm 10, PostgreSQL 16 (local, no
credentials available to this project), Playwright Chromium (cached). Not available: Docker,
Blender, licensed vehicle models.

## Overview

```
Browser (dealer-a.example.mn)
  │  Host header identifies the dealership
  ▼
CDN / edge (TLS, custom hostnames, static + 3D asset caching)
  ├── /assets/vehicles/**   immutable GLB + manifest (object storage)
  ├── /*                    SPA (apps/web/dist)
  └── /api/*  ──────────►  API (apps/api) ──► PostgreSQL
```

### Stack decisions

| Decision | Choice | Why |
|---|---|---|
| Frontend build | Vite + React 19 (SPA) | No SEO-critical server rendering needed for a WebGL-first experience; matches existing `monte/` tooling; simplest hosting (static + API) |
| 3D | three.js + React Three Fiber + Drei | Declarative scene composition, Suspense-based asset loading, mature ecosystem |
| Scroll animation | GSAP ScrollTrigger (scrub) → timeline position → engine damping | Scroll is the single source of truth; the pose is a pure function of position, so reverse scrolling exactly reverses every animation |
| State | Zustand | Frame loop reads state with `getState()` without re-rendering React |
| Styling | Tailwind v4 with design tokens; tenant accent injected as a CSS variable | One accent per dealer; everything else neutral so the vehicle leads |
| API | Express 5 + zod | Small surface, explicit validation shared with the client via `packages/shared` |
| ORM / DB | Drizzle + PostgreSQL; PGlite (embedded Postgres) for dev/tests | Same SQL dialect and migrations everywhere; tests run without a DB server |
| Auth | Opaque session tokens (sha256-hashed at rest), httpOnly SameSite=Lax cookie scoped to `/api/dealer`, scrypt passwords | No JWT revocation problem; sessions are bound to a tenant |

## The 3D engine (`apps/web/src/engine`)

Vehicle-agnostic. Everything specific to a vehicle comes from its manifest + database record.

| Module | Responsibility |
|---|---|
| `VehicleScene` | Canvas, quality tier (DPR, shadows, AA), PerformanceMonitor step-down, context, screenshot capture |
| `VehicleModel` | Loads each system GLB (exterior, engine, transmission, suspension, interior) on demand, clones it privately, registers nodes; pointer handling (hover/select, skipping ghosted or non-interactive systems) |
| `VehicleController` | Computes the target pose for the mode (story / turntable / orbit) and damps the shared pose toward it |
| `VehicleCamera` | Follows the pose; in orbit mode hands control to OrbitControls and glides between presets; aspect-aware FOV and lens shift |
| `VehicleExplodedView` | Applies manifest-defined exploded transforms (pure function of rest transform + amount) and per-system opacity (ghosting) |
| `VehicleComponent` | Emissive highlight on per-component material clones |
| `VehicleConfigurator` | Animates independent material groups to chosen finishes; node switches (wheel designs, accessories) |
| `VehicleLighting` / `VehicleEnvironment` | Studio rig; procedural Lightformer environment (no HDR download); contact shadows; cabin-aware light dimming |
| `timeline.ts` / `explode.ts` | Pure math, unit-tested: keyframe sampling with spherical camera interpolation, staggered explode progress |

Progressive loading: the exterior loads first; the current and next section's systems are requested
as the user scrolls; on capable devices the rest are warmed after the exterior appears. Only the
selected vehicle is loaded; the home page loads one exterior GLB.

Accessibility: every selectable component is also listed as a button in its story section (keyboard
and screen-reader path that doesn't depend on raycasting); inactive section copy is `inert`;
`prefers-reduced-motion` disables auto-rotation, smoothing and pulsing; the info panel closes with
Escape; WebGL absence shows a full specifications page.

## Data model

All dealer-owned tables carry `tenant_id`. Vehicles are **per-tenant copies** (a dealer edits its own
specifications, colours and prices without affecting others); the shared part is the 3D asset set,
referenced by `manifest_url`.

```
tenants ─┬─ tenant_domains (hostname UNIQUE globally)
         ├─ dealer_users (email UNIQUE) ── sessions (tenant-bound)
         ├─ vehicles (tenant_id, slug UNIQUE) ─┬─ vehicle_variants (price nullable)
         │                                     ├─ vehicle_colors (group ↔ manifest material group, availability)
         │                                     └─ inventory_items
         ├─ leads (configuration JSON + server-computed summary/estimate)
         ├─ saved_configurations (short code)
         └─ analytics_events
```

Specifications are JSON (`SpecSheet`): `{ key, label, value, unit, status: verified|reference|unavailable, source }`.
The schema enforces: a value requires a non-`unavailable` status and a source; `unavailable` must
have no value. Variants carry spec overrides (e.g. the diesel engine figures).

## Tenant isolation

1. The tenant is resolved **only** from the Host header (or `X-Forwarded-Host` when `TRUST_PROXY=true`).
   The `?tenant=` override and default-tenant fallback exist only outside production.
2. Every dealer query filters by the session's `tenant_id`; child resources (variants, colours,
   inventory) are checked against a parent owned by the same tenant.
3. Sessions are bound to a tenant and rejected on any other tenant's hostname; logins are rejected on
   the wrong hostname with the same error as a bad password (no account enumeration).
4. Lead estimates are computed server-side from the tenant's own variants/colours; a variant id from
   another tenant is rejected.
5. `apps/api/src/api.test.ts` contains an isolation suite (cross-tenant read/update/delete/claim
   attempts) that runs on every `npm test`.

Recommended hardening before large-scale launch: PostgreSQL Row-Level Security policies keyed on a
`SET LOCAL app.tenant_id` per request, as defence in depth behind the application checks.

## Honesty rules enforced in code

- Manifests must declare `assetStatus` and a `disclaimer`; the UI renders it whenever assets are
  `demonstration`. Generated GLBs also carry `extras.demonstration = true`, and the validator fails a
  manifest that claims `production` for a flagged asset.
- Prices: no seed prices; "Price on request" unless a dealer enters one; no estimate is shown if
  the selected variant has no price.
- Colours/accessories show their availability (`factory-verified`, `dealer-option`, `demonstration`).
- Component information describes general function; vehicle-specific figures carry status and source.

## Risk assessment

| Risk | Impact | Mitigation |
|---|---|---|
| No licensed 3D models of the actual vehicles | High — the product's core value | Demo pipeline is complete; asset spec in `3D_ASSET_PIPELINE.md`; budget for licensed models or commissioned modelling per vehicle (incl. engine/drivetrain cut-aways, which are rarely available off the shelf) |
| Manufacturer IP / trademarks (brand names, likeness of vehicles) | High for commercial sale | Obtain importer/OEM permission or licensed assets; dealers act as authorised resellers |
| Spec accuracy per market (Mongolian imports vary by origin market) | Medium | Verification workflow: reference vs verified, sources mandatory |
| Low-end mobile GPUs | Medium | Quality tiers, PerformanceMonitor step-down, Draco, per-system lazy loading, optional LOD URLs, no-WebGL fallback |
| Production-quality GLBs are large (50–150 MB raw) | Medium | Draco/meshopt + KTX2 textures, per-system split, CDN caching, LOD variants |
| Single-region PGlite misuse in production | Low | PGlite is dev/test only; production requires `DATABASE_URL` |

## Status update (2026-11-04)

- UI and catalogue content are Mongolian (`lang="mn"`, Montserrat/Inter/JetBrains Mono with Cyrillic-ext).
- Catalogue: LC300, LC250 (Prado), LX 600, GX 550, Jetour T2, Jetour Dashing, BYD Song Plus.
- Spec categories extended for buyers: capacity & towing, off-road, comfort, multimedia, ownership.
- Key-figures strip on the vehicle page; interior colour packages; texture-preserving recolouring.

## Remaining work

- **Assets:** licensed or commissioned GLBs per vehicle — the current evaluation models are not cleared for commercial use (see the licence table in the pipeline doc); HDRI showroom environment; real torque-converter / transfer-case models.
- **Mongolian-market verification:** toyota-mongolia.mn blocks automated access (Cloudflare); a dealer must confirm every *Лавлагаа* value, colours, warranty and prices for Mongolia.
- **i18n:** strings are currently Mongolian in-place; extract to a dictionary to add English/Russian for export markets.
- **Object storage upload** for dealer-managed assets (presigned R2/S3 uploads + manifest editor).
- **Notifications:** email/SMS/Telegram on new leads (provider not chosen).
- **Custom-domain automation:** Cloudflare for SaaS custom hostnames API to issue TLS for dealer domains.
- **Platform admin:** creating tenants and dealer users currently happens via seed/DB; add a super-admin console and staff user management.
- **Localisation:** Mongolian (mn) UI strings and spec labels.
- **Posters:** real vehicle photography or licensed renders for catalogue cards (demo geometry is deliberately not used as a poster).
- **Postgres RLS** as defence in depth (see above).
