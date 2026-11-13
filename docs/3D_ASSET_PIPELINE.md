# 3D asset pipeline

The engine renders any vehicle that provides a **manifest** plus **one GLB per system**. Nothing in
the engine is vehicle-specific; replacing demonstration assets with production ones requires no code
changes.

```
public/assets/vehicles/<brand>/<model>/
  vehicle.manifest.json
  exterior/      <file>.glb   (+ optional LOD)
  engine/        <file>.glb
  transmission/  <file>.glb
  suspension/    <file>.glb
  interior/      <file>.glb
  textures/      KTX2 sources (embedded in GLBs at export)
  environments/  optional HDRI (.hdr / .ktx2)
```

In production these live in object storage behind the CDN; `manifestUrl` may be absolute and asset
URLs inside the manifest may be absolute or relative to it.

## Modelling requirements (Blender)

- **Units:** metres. **Axes:** +X forward, +Y up, +Z to the vehicle's right (Blender: export with *+Y up*; model with the nose pointing −Y in Blender, which becomes +X after the rotation below — or simply verify with `assets:validate` and the viewer).
- **Origin:** ground plane at Y = 0, centred between axles.
- **Every system in the same coordinate space** — engine positioned in the engine bay, etc. — so systems overlay exactly.
- **One object (or empty/parent) per selectable component**, named exactly as the manifest's `nodes`. Pivot at the part's centre if it rotates in the exploded view.
- **Symmetric parts** as separate L/R objects (e.g. `headlight_L`, `headlight_R`) — the manifest's `mirror: true` flips Z offsets for parts resting at z < 0.
- **Material names define configurable groups.** Every configurable surface uses a dedicated material (`mat_body`, `mat_roof`, `mat_rim`, `mat_trim`, `mat_seat`, `mat_interior`, `mat_dash_finish`, `mat_interior_trim`). Never share one material across groups — the configurator would recolour both.
- **Variant geometry** (wheel designs, accessories) as separate objects listed in manifest `switches`; the engine shows/hides them.
- **The cabin must be hollow** (no solid body volume through the interior) for cabin camera views.
- PBR metallic-roughness materials only; bake complex shading to textures.

## Export & optimisation

```bash
# From Blender: File → Export → glTF 2.0 (.glb), +Y up, apply modifiers, include custom properties.
# Then compress (gltf-transform CLI):
npx @gltf-transform/cli optimize in.glb out.glb \
  --compress draco --texture-compress ktx2 --texture-size 2048
# Or meshopt instead of Draco (also supported by the loader):
npx @gltf-transform/cli optimize in.glb out.glb --compress meshopt --texture-compress ktx2
```

Do **not** run material dedup across configurable groups (identical body/roof materials would be
merged). The demo generator shows the safe configuration (`scripts/generate-demo-assets.ts`).

Budgets (per system, compressed): exterior ≤ 8 MB, engine ≤ 6 MB, others ≤ 4 MB; textures ≤ 2048 px
(1024 for LOD). Provide `lodUrl` files for low-quality devices when the main file exceeds ~4 MB.

Decoders are self-hosted at `/draco/` and `/basis/` (copied from three.js); no third-party CDN.

## Manifest

Schema: `packages/shared/src/manifest.ts` (validated at runtime; invalid manifests are rejected,
not half-rendered). Key sections:

| Field | Purpose |
|---|---|
| `assetStatus` / `disclaimer` | `demonstration` or `production`. The UI shows the disclaimer for demonstration assets. |
| `assets` | Per-system GLB URL, compression flags, optional `lodUrl` |
| `materialGroups` | Configurable groups → glTF material names, default finish, exterior/interior |
| `switches` | Wheel designs (exclusive) and accessories (toggle) → node names, availability |
| `components` | Component id (matches editorial info in the DB) → system, node names, exploded `offset`/`rotation`/`delay`/`mirror` |
| `story.sections` | Copy, which systems are selectable and which must be loaded |
| `story.keyframes` | Exact camera + explode + per-system opacity states on the timeline (section *i* spans `[i, i+1)`) |
| `hero` / `configurator` / `cameras` | Camera presets (`cameras.interior` drives the configurator cabin view) |
| `cabin` | Optional cabin volume; overhead lights dim while the camera is inside |

Editorial content per component (name, description, function, material, technical values with
status and source) lives in the database (`vehicles.components`), editable per dealer, joined by id.

## Validation

```bash
npm run assets:validate -- apps/web/public/assets/vehicles/toyota/land-cruiser-300
```

Checks: schema, keyframe ordering, every component/switch node exists in its GLB, every material
group's materials exist, and that a `production` manifest doesn't reference assets flagged as
demonstration. The dealer dashboard's **3D assets** page runs the browser-side subset (schema,
reachability, sizes, components missing editorial info).

## Demonstration assets

`npm run assets:demo` builds stand-in geometry from primitives with the exact node/material contract
above, exports GLB, Draco-compresses it and writes the manifest. They exist to develop and test the
pipeline and **must not be presented as a model of the real vehicle** — the UI labels them, and the
GLB `extras` carry `demonstration: true`.

## Sourcing production assets

Options, in order of fidelity and cost: OEM/importer marketing CAD-derived assets (best; requires
licence), licensed stock models (exterior/interior usually available; engine and drivetrain
cut-aways usually not), or commissioned modelling from reference photography. Whatever the source,
confirm the licence covers commercial web distribution to multiple dealerships.


## Evaluation models currently used (local only, git-ignored)

| Vehicle / part | Source (Sketchfab) | Licence | Status |
|---|---|---|---|
| Toyota Land Cruiser 300 | ddiaz-design “2022 Toyota Land Cruiser 300 VX.R” | CC BY-NC-SA 4.0 | Non-commercial; Unreal-style asset names suggest a game extraction — **do not ship** |
| LC300 engine | cmclain4200 “twin turbo V6 full engine working” | CC BY 4.0 | Commercial use allowed with attribution; generic design, not the V35A-FTS |
| Planetary gearsets | tflexcad “Gearbox (Planetary)” | CC BY 4.0 | Illustrative, attribution required |
| Ring & pinion | cyamahat “Hypoid Gear” | CC BY 4.0 | Illustrative, attribution required |
| Toyota Land Cruiser 250 | ddiaz-design “2025 Toyota Land Cruiser 250” | CC BY-NC-SA 4.0 | Non-commercial — do not ship |
| Lexus GX 550 | ddiaz-design “2023 Lexus GX 550 h Overtrail” | CC BY-NC-SA 4.0 | Non-commercial — do not ship |
| Lexus LX 600 | KINGSLEY_king “LEXUS LX 600” | CC BY 4.0 | Provenance unverified |
| Jetour Dashing | Uzbek3D “Jetour Dashing” | CC BY 4.0 | Contains GTA V asset names — provenance doubtful, do not ship |
| BYD Song Plus | NazhDesign “2023 BYD Song Plus” | CC BY 4.0 | Provenance unverified; single atlas material (no paint configurator) |
| Jetour T2 | — | — | Candidate model had no wheels (GTA mod conversion) → specs page only |

Rejected: re-uploads of ddiaz-design models relabelled “CC BY” by other accounts (identical face
counts, later upload dates) — treated as licence laundering.

Downloads need a Sketchfab API token (`Authorization: Token …`); place each GLB at
`incoming/<id>/model.glb` and run the importers. Neither the token nor `incoming/` is stored in git.

### How the LC300 import splits parts
- Named source nodes → exterior groups (doors, hood, bumpers, lights, mirrors, wheels per corner…).
- Meshes merged per material (all seats in one mesh, the whole chassis in one mesh) are split into
  **connected geometric islands** (`scripts/lib/islands.ts`) and each island is classified by its
  position in vehicle space (front/2nd/3rd-row seats, dashboard, console, cluster, screen; frame,
  springs, control arms, steering, axle, differential, driveshaft).
- Third-party CAD parts are merged into the drivetrain document and placed with explicit matrices.

### Configurable textured materials
Choosing a colour for a textured surface keeps the texture: the shader rescales each pixel's
luminance relative to the texture average and multiplies by the chosen colour; bright pixels (chrome,
white trim in a shared atlas) are left untouched. Interior colours are sold as **packages**
(group `interior_theme`, `finish.members`) so seats, trim and dashboard always match.
