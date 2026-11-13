/// <reference lib="webworker" />
/**
 * Segment Anything (SlimSAM) in a Web Worker.
 *
 * The heavy step (image encoder) runs once per photo; each click then only runs the light
 * prompt decoder, so refining a region with extra points is interactive (~50–150 ms).
 * WebGPU is used when available, otherwise WASM (slower encode, same result).
 */
import { AutoProcessor, RawImage, SamModel, Tensor, env } from '@huggingface/transformers';
import type { WorkerRequest, WorkerResponse } from './protocol';

const MODEL_ID = 'Xenova/slimsam-77-uniform';
env.allowLocalModels = false;

type Embeddings = Awaited<ReturnType<SamModel['get_image_embeddings']>>;

let model: SamModel | null = null;
let processor: Awaited<ReturnType<typeof AutoProcessor.from_pretrained>> | null = null;
let device: 'webgpu' | 'wasm' = 'wasm';
let current: { id: number; inputs: any; embeddings: Embeddings } | null = null;

const post = (msg: WorkerResponse) => (self as unknown as DedicatedWorkerGlobalScope).postMessage(msg);

async function load() {
  if (model && processor) return;
  const hasGpu = 'gpu' in navigator && !!(await (navigator as any).gpu?.requestAdapter?.().catch(() => null));
  device = hasGpu ? 'webgpu' : 'wasm';
  const progress_callback = (p: any) => {
    if (p.status === 'progress' && typeof p.progress === 'number') post({ type: 'progress', file: p.file, progress: p.progress });
  };
  model = (await SamModel.from_pretrained(MODEL_ID, {
    dtype: device === 'webgpu' ? 'fp16' : 'fp32',
    device,
    progress_callback,
  })) as SamModel;
  processor = await AutoProcessor.from_pretrained(MODEL_ID, { progress_callback });
  post({ type: 'ready', device });
}

async function encode(id: number, bitmap: ImageBitmap) {
  await load();
  const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0);
  bitmap.close();
  const image = RawImage.fromCanvas(canvas).rgb();
  const inputs = await (processor as any)(image);
  const embeddings = await model!.get_image_embeddings(inputs);
  current = { id, inputs, embeddings };
  post({ type: 'encoded', id });
}

async function decode(id: number, requestId: number, points: { x: number; y: number; positive: boolean }[]) {
  if (!current || current.id !== id) return post({ type: 'error', requestId, message: 'Зураг боловсруулагдаагүй байна' });
  const [h, w] = current.inputs.reshaped_input_sizes[0] as [number, number];
  const coords = points.flatMap((p) => [p.x * w, p.y * h]);
  const input_points = new Tensor('float32', Float32Array.from(coords), [1, 1, points.length, 2]);
  const input_labels = new Tensor('int64', BigInt64Array.from(points.map((p) => (p.positive ? 1n : 0n))), [1, 1, points.length]);
  const out = await (model as any)({ ...current.embeddings, input_points, input_labels });
  const masks: Tensor[] = await (processor as any).post_process_masks(
    out.pred_masks, current.inputs.original_sizes, current.inputs.reshaped_input_sizes,
  );
  const scores = out.iou_scores.data as Float32Array;
  let best = 0;
  for (let i = 1; i < scores.length; i++) if (scores[i]! > scores[best]!) best = i;
  const [, , mh, mw] = masks[0]!.dims as number[];
  const all = masks[0]!.data as Uint8Array;
  const plane = mh! * mw!;
  const mask = new Uint8Array(plane);
  const src = all.subarray(best * plane, (best + 1) * plane);
  for (let i = 0; i < plane; i++) mask[i] = src[i] ? 255 : 0;
  post({ type: 'mask', requestId, width: mw!, height: mh!, mask, score: scores[best]! });
}

self.onmessage = async (e: MessageEvent<WorkerRequest>) => {
  const msg = e.data;
  try {
    if (msg.type === 'load') await load();
    else if (msg.type === 'encode') await encode(msg.id, msg.bitmap);
    else if (msg.type === 'decode') await decode(msg.id, msg.requestId, msg.points);
  } catch (err) {
    post({ type: 'error', requestId: 'requestId' in msg ? msg.requestId : undefined, message: err instanceof Error ? err.message : String(err) });
  }
};
