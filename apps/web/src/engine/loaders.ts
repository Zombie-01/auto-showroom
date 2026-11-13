import type { WebGLRenderer } from 'three';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { KTX2Loader } from 'three/examples/jsm/loaders/KTX2Loader.js';
import type { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';

// Decoders are self-hosted (public/draco, public/basis) — no third-party CDN at runtime.
let draco: DRACOLoader | null = null;
let ktx2: KTX2Loader | null = null;

export function configureGltfLoader(gl: WebGLRenderer) {
  return (loader: GLTFLoader) => {
    if (!draco) { draco = new DRACOLoader().setDecoderPath('/draco/'); draco.preload(); }
    if (!ktx2) { ktx2 = new KTX2Loader().setTranscoderPath('/basis/').detectSupport(gl); }
    loader.setDRACOLoader(draco);
    loader.setKTX2Loader(ktx2);
    loader.setMeshoptDecoder(MeshoptDecoder);
  };
}
