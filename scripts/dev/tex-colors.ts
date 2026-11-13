import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import draco3d from 'draco3dgltf';
import { writeFileSync, mkdirSync } from 'node:fs';
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'draco3d.decoder': await draco3d.createDecoderModule() });
mkdirSync(process.argv[3]!, { recursive: true });
for (const f of ['exterior', 'interior']) {
  const doc = await io.read(`apps/web/public/assets/vehicles/toyota/land-cruiser-300/${f}/eval-${f}.glb`);
  for (const m of doc.getRoot().listMaterials()) {
    const t = m.getBaseColorTexture();
    if (t) writeFileSync(`${process.argv[3]}/${m.getName()}.png`, t.getImage()!);
  }
}
