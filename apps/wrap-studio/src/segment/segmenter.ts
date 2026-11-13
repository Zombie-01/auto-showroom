import type { Point, WorkerResponse } from './protocol';

export type SegmenterStatus =
  | { state: 'idle' }
  | { state: 'loading'; progress: number }
  | { state: 'encoding' }
  | { state: 'ready'; device: 'webgpu' | 'wasm' }
  | { state: 'error'; message: string };

/** Thin promise wrapper around the SAM worker. Points are normalised (0..1) image coordinates. */
export class Segmenter {
  private worker = new Worker(new URL('./sam.worker.ts', import.meta.url), { type: 'module' });
  private pending = new Map<number, { resolve: (m: { width: number; height: number; mask: Uint8Array }) => void; reject: (e: Error) => void }>();
  private encodeWait: { id: number; resolve: () => void; reject: (e: Error) => void } | null = null;
  private nextRequest = 1;
  private imageId = 0;
  private files = new Map<string, number>();
  device: 'webgpu' | 'wasm' | null = null;

  constructor(private onStatus: (s: SegmenterStatus) => void) {
    this.worker.onmessage = (e: MessageEvent<WorkerResponse>) => this.handle(e.data);
    this.worker.onerror = (e) => this.onStatus({ state: 'error', message: e.message || 'Worker алдаа' });
  }

  private handle(msg: WorkerResponse) {
    switch (msg.type) {
      case 'progress': {
        this.files.set(msg.file, msg.progress);
        const values = [...this.files.values()];
        this.onStatus({ state: 'loading', progress: values.reduce((a, b) => a + b, 0) / values.length });
        break;
      }
      case 'ready':
        this.device = msg.device;
        break;
      case 'encoded':
        if (this.encodeWait?.id === msg.id) { this.encodeWait.resolve(); this.encodeWait = null; }
        this.onStatus({ state: 'ready', device: this.device ?? 'wasm' });
        break;
      case 'mask': {
        const p = this.pending.get(msg.requestId);
        this.pending.delete(msg.requestId);
        p?.resolve(msg);
        break;
      }
      case 'error': {
        const err = new Error(msg.message);
        if (msg.requestId !== undefined) {
          this.pending.get(msg.requestId)?.reject(err);
          this.pending.delete(msg.requestId);
        } else {
          this.encodeWait?.reject(err);
          this.encodeWait = null;
          this.onStatus({ state: 'error', message: msg.message });
        }
      }
    }
  }

  /** Compute the image embedding (slow, once per photo). */
  async setImage(source: HTMLCanvasElement) {
    const id = ++this.imageId;
    const bitmap = await createImageBitmap(source);
    this.onStatus(this.device ? { state: 'encoding' } : { state: 'loading', progress: 0 });
    return new Promise<void>((resolve, reject) => {
      this.encodeWait = { id, resolve, reject };
      this.worker.postMessage({ type: 'encode', id, bitmap }, [bitmap]);
    });
  }

  segment(points: Point[]) {
    const requestId = this.nextRequest++;
    return new Promise<{ width: number; height: number; mask: Uint8Array }>((resolve, reject) => {
      this.pending.set(requestId, { resolve, reject });
      this.worker.postMessage({ type: 'decode', id: this.imageId, requestId, points });
    });
  }

  dispose() { this.worker.terminate(); }
}
