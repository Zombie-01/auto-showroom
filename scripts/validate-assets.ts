/**
 * Validates a vehicle manifest against its GLB files: every component node, switch node and
 * material-group material referenced by the manifest must exist in the referenced assets.
 *
 * Usage: npx tsx scripts/validate-assets.ts apps/web/public/assets/vehicles/toyota/land-cruiser-300
 * Exit code 1 on any problem. Run this whenever production assets replace the demo ones.
 */
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import draco3d from 'draco3dgltf';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { lintManifest, VehicleManifest } from '../packages/shared/src/index';

async function main() {
  const dir = path.resolve(process.argv[2] ?? 'apps/web/public/assets/vehicles/toyota/land-cruiser-300');
  const manifest = VehicleManifest.parse(JSON.parse(await readFile(path.join(dir, 'vehicle.manifest.json'), 'utf8')));
  const problems = lintManifest(manifest);
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'draco3d.decoder': await draco3d.createDecoderModule() });

  const nodesBySystem = new Map<string, Set<string>>();
  const materials = new Set<string>();
  for (const [system, asset] of Object.entries(manifest.assets)) {
    if (/^(https?:)?\/\//.test(asset!.url)) { console.warn(`skip remote asset ${asset!.url}`); continue; }
    const doc = await io.read(path.join(dir, asset!.url));
    const names = new Set(doc.getRoot().listNodes().map((n) => n.getName()));
    nodesBySystem.set(system, names);
    for (const m of doc.getRoot().listMaterials()) materials.add(m.getName());
    const extras = doc.getRoot().listScenes()[0]?.listChildren()[0]?.getExtras() as { demonstration?: boolean } | undefined;
    if (manifest.assetStatus === 'production' && extras?.demonstration) problems.push(`${system}: manifest says production but asset is flagged demonstration`);
    console.log(`${system.padEnd(13)} ${names.size} nodes`);
  }
  for (const c of manifest.components) {
    const names = nodesBySystem.get(c.system);
    if (!names) continue;
    for (const n of c.nodes) if (!names.has(n)) problems.push(`component "${c.id}": node "${n}" not found in ${c.system} asset`);
  }
  const allNodes = new Set([...nodesBySystem.values()].flatMap((s) => [...s]));
  for (const s of manifest.switches) for (const o of s.options) for (const n of o.nodes) if (!allNodes.has(n)) problems.push(`switch "${s.id}/${o.id}": node "${n}" not found`);
  for (const g of manifest.materialGroups) for (const m of g.materials) if (!materials.has(m)) problems.push(`material group "${g.id}": material "${m}" not found`);

  if (problems.length) { console.error(`\n${problems.length} problem(s):\n- ` + problems.join('\n- ')); process.exit(1); }
  console.log(`\nOK — ${manifest.components.length} components, ${manifest.materialGroups.length} material groups, ${manifest.switches.length} switches validated (${manifest.assetStatus} assets).`);
}
main().catch((e) => { console.error(e); process.exit(1); });
