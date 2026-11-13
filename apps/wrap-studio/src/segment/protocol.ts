export type Point = { x: number; y: number; positive: boolean };

export type WorkerRequest =
  | { type: 'load' }
  | { type: 'encode'; id: number; bitmap: ImageBitmap }
  | { type: 'decode'; id: number; requestId: number; points: Point[] };

export type WorkerResponse =
  | { type: 'progress'; file: string; progress: number }
  | { type: 'ready'; device: 'webgpu' | 'wasm' }
  | { type: 'encoded'; id: number }
  | { type: 'mask'; requestId: number; width: number; height: number; mask: Uint8Array; score: number }
  | { type: 'error'; requestId?: number; message: string };
