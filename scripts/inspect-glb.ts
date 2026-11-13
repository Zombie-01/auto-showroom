/** Print a GLB's node tree, materials, textures and bounds. Usage: npx tsx scripts/inspect-glb.ts file.glb */
import { NodeIO, type Node } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { getBounds } from '@gltf-transform/functions';
import draco3d from 'draco3dgltf';

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'draco3d.decoder': await draco3d.createDecoderModule() });
const doc = await io.read(process.argv[2]!);
const root = doc.getRoot();
const scene = root.listScenes()[0]!;
const tris = (n: Node) => { const m = n.getMesh(); if (!m) return 0; return m.listPrimitives().reduce((a, p) => a + (p.getIndices()?.getCount() ?? p.getAttribute('POSITION')!.getCount()) / 3, 0); };
const walk = (n: Node, d: number) => {
  const t = tris(n);
  const mats = n.getMesh()?.listPrimitives().map((p) => p.getMaterial()?.getName()).join(',') ?? '';
  if (d < 8) console.log(`${'  '.repeat(d)}${n.getName() || '(unnamed)'}${t ? ` [${Math.round(t)} tris] {${mats}}` : ''}`);
  for (const c of n.listChildren()) walk(c, d + 1);
};
for (const n of scene.listChildren()) walk(n, 0);
console.log('\nMATERIALS:', root.listMaterials().map((m) => `${m.getName()}(${m.getBaseColorTexture() ? 'tex' : m.getBaseColorFactor().map((x) => x.toFixed(2)).join('/')}${m.getAlphaMode() !== 'OPAQUE' ? ' ' + m.getAlphaMode() : ''})`).join('\n  '));
console.log('\nTEXTURES:', root.listTextures().map((t) => `${t.getName() || t.getURI()} ${t.getMimeType()} ${t.getSize()?.join('x')} ${(t.getImage()!.byteLength / 1024).toFixed(0)}KB`).join('\n  '));
const b = getBounds(scene);
console.log('\nBOUNDS min', b.min.map((x) => x.toFixed(3)), 'max', b.max.map((x) => x.toFixed(3)));
