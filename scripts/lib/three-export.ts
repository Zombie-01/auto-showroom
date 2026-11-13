/** Export a three.js object to a gltf-transform Document (Node: polyfills FileReader for GLTFExporter). */
import * as THREE from 'three';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import type { NodeIO, Document } from '@gltf-transform/core';

class NodeFileReader {
  result: ArrayBuffer | string | null = null;
  onload: ((e: unknown) => void) | null = null;
  onloadend: ((e: unknown) => void) | null = null;
  readAsArrayBuffer(blob: Blob) { void blob.arrayBuffer().then((b) => { this.result = b; this.onload?.({ target: this }); this.onloadend?.({ target: this }); }); }
  readAsDataURL(blob: Blob) { void blob.arrayBuffer().then((b) => { this.result = `data:${blob.type || 'application/octet-stream'};base64,${Buffer.from(b).toString('base64')}`; this.onload?.({ target: this }); this.onloadend?.({ target: this }); }); }
}
(globalThis as unknown as { FileReader: unknown }).FileReader ??= NodeFileReader;

export async function threeToDocument(io: NodeIO, root: THREE.Object3D): Promise<Document> {
  const scene = new THREE.Scene();
  scene.add(root);
  const glb = (await new GLTFExporter().parseAsync(scene, { binary: true, onlyVisible: false })) as ArrayBuffer;
  return io.readBinary(new Uint8Array(glb));
}
