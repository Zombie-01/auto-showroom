/**
 * Split glTF primitives into disconnected geometric "islands" and regroup them. Used to separate
 * meshes that a source model merged per material (all seats in one mesh, etc.) into individually
 * selectable components.
 */
import type { Document, Mesh, Node, Primitive } from '@gltf-transform/core';
import { compactPrimitive } from '@gltf-transform/functions';
import * as THREE from 'three';

export interface Island { tris: number[]; centre: THREE.Vector3; box: THREE.Box3; count: number }

/** Connected components of a primitive's triangles (vertices shared by index, or by identical position). */
export function islands(prim: Primitive, toWorld: THREE.Matrix4): Island[] {
  const pos = prim.getAttribute('POSITION')!;
  const idxAcc = prim.getIndices();
  const vcount = pos.getCount();
  const index: number[] = idxAcc ? Array.from(idxAcc.getArray()! as ArrayLike<number>) : Array.from({ length: vcount }, (_, i) => i);
  // Merge vertices at identical positions (UV/normal seams would otherwise split islands).
  const key = new Map<string, number>();
  const canon = new Int32Array(vcount);
  const el: number[] = [];
  for (let i = 0; i < vcount; i++) {
    pos.getElement(i, el);
    const k = `${el[0]!.toFixed(5)},${el[1]!.toFixed(5)},${el[2]!.toFixed(5)}`;
    const c = key.get(k);
    canon[i] = c ?? i;
    if (c === undefined) key.set(k, i);
  }
  const parent = new Int32Array(vcount).map((_, i) => i);
  const find = (a: number): number => { while (parent[a] !== a) { parent[a] = parent[parent[a]!]!; a = parent[a]!; } return a; };
  const union = (a: number, b: number) => { const ra = find(a), rb = find(b); if (ra !== rb) parent[ra] = rb; };
  for (let t = 0; t < index.length; t += 3) {
    const a = canon[index[t]!]!, b = canon[index[t + 1]!]!, c = canon[index[t + 2]!]!;
    union(a, b); union(b, c);
  }
  const groups = new Map<number, Island>();
  const v = new THREE.Vector3();
  for (let t = 0; t < index.length; t += 3) {
    const root = find(canon[index[t]!]!);
    let g = groups.get(root);
    if (!g) { g = { tris: [], centre: new THREE.Vector3(), box: new THREE.Box3(), count: 0 }; groups.set(root, g); }
    g.tris.push(index[t]!, index[t + 1]!, index[t + 2]!);
    for (let k = 0; k < 3; k++) { pos.getElement(index[t + k]!, el); v.set(el[0]!, el[1]!, el[2]!).applyMatrix4(toWorld); g.box.expandByPoint(v); }
  }
  for (const g of groups.values()) { g.box.getCenter(g.centre); g.count = g.tris.length / 3; }
  return [...groups.values()];
}

/** Build a new compact primitive containing only the given triangle indices. */
export function subPrimitive(doc: Document, prim: Primitive, tris: number[]): Primitive {
  const p = prim.clone();
  const src = prim.getIndices();
  const ArrayType = tris.length > 0 && Math.max(...tris.slice(0, 1)) > 65535 ? Uint32Array : Uint32Array;
  const acc = doc.createAccessor().setType('SCALAR').setArray(new ArrayType(tris));
  if (src?.getBuffer()) acc.setBuffer(src.getBuffer());
  else acc.setBuffer(doc.getRoot().listBuffers()[0]!);
  p.setIndices(acc);
  return compactPrimitive(p);
}

/**
 * Split every primitive of `mesh` into islands and assign each island to a group via `classify`.
 * Returns group → new Mesh. Islands with the same group (and same material) are merged.
 */
export function splitMesh(doc: Document, node: Node, toWorld: THREE.Matrix4, classify: (i: Island, material: string) => string): Map<string, Mesh> {
  const out = new Map<string, Mesh>();
  for (const prim of node.getMesh()!.listPrimitives()) {
    const mat = prim.getMaterial()?.getName() ?? '';
    const byGroup = new Map<string, number[]>();
    for (const isl of islands(prim, toWorld)) {
      const g = classify(isl, mat);
      const arr = byGroup.get(g) ?? [];
      for (const t of isl.tris) arr.push(t);
      byGroup.set(g, arr);
    }
    for (const [g, tris] of byGroup) {
      const mesh = out.get(g) ?? doc.createMesh(`${node.getName()}__${g}`);
      mesh.addPrimitive(byGroup.size === 1 ? prim.clone() : subPrimitive(doc, prim, tris));
      out.set(g, mesh);
    }
  }
  return out;
}
