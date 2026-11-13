import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FILMS, FINISH_LABEL, ZONES, formatMnt, zonePrice, type Film } from './lib/catalog';
import { blurFloat, featherMask, polygonMask } from './lib/mask';
import { applyFilm, paintWeights, type Finish } from './lib/recolor';
import type { Point } from './segment/protocol';
import { Segmenter, type SegmenterStatus } from './segment/segmenter';
import { OrderForm } from './components/OrderForm';

const MAX_SIDE = 1600;

export interface Region {
  uid: number;
  zoneId: string;
  filmId: string;
  custom: { color: string; finish: Finish } | null;
  tool: 'ai' | 'polygon';
  points: Point[];
  polygon: { x: number; y: number }[];
  closed: boolean;
  /** Skip glass, tyres and lights inside the selection. */
  paintOnly: boolean;
  mask: Uint8Array | null;
  /** Feathered selection. */
  alpha: Float32Array | null;
  /** Feathered selection × paint weights (what the film is actually applied with). */
  paintAlpha: Float32Array | null;
}

export function regionFilm(r: Region): Film {
  const base = FILMS.find((f) => f.id === r.filmId)!;
  if (r.custom && base.service === 'wrap') {
    return { ...base, id: 'custom', label: `Өөрийн өнгө ${r.custom.color} (${FINISH_LABEL[r.custom.finish]})`, swatch: r.custom.color, effect: { kind: 'wrap', ...r.custom } };
  }
  return base;
}

let uidSeq = 1;

export function App() {
  const [image, setImage] = useState<{ canvas: HTMLCanvasElement; data: ImageData; name: string } | null>(null);
  const [regions, setRegions] = useState<Region[]>([]);
  const [activeId, setActiveId] = useState<number | null>(null);
  const [status, setStatus] = useState<SegmenterStatus>({ state: 'idle' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [split, setSplit] = useState(1); // 0..1: share of the image showing the preview (rest = original)
  const [showOrder, setShowOrder] = useState(false);
  const segmenter = useRef<Segmenter | null>(null);
  const viewRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const s = new Segmenter(setStatus);
    segmenter.current = s;
    return () => s.dispose();
  }, []);

  const active = regions.find((r) => r.uid === activeId) ?? null;
  const update = useCallback((uid: number, patch: Partial<Region>) => {
    setRegions((rs) => rs.map((r) => (r.uid === uid ? { ...r, ...patch } : r)));
  }, []);

  // ---------- load a photo ----------
  const onFile = async (file: File) => {
    setError(null);
    if (!file.type.startsWith('image/')) return setError('Зөвхөн зургийн файл (JPG, PNG, WEBP) оруулна уу');
    const bmp = await createImageBitmap(file).catch(() => null);
    if (!bmp) return setError('Зургийг уншиж чадсангүй. JPG эсвэл PNG болгоод дахин оролдоно уу.');
    const scale = Math.min(1, MAX_SIDE / Math.max(bmp.width, bmp.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bmp.width * scale);
    canvas.height = Math.round(bmp.height * scale);
    const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
    ctx.drawImage(bmp, 0, 0, canvas.width, canvas.height);
    bmp.close();
    setImage({ canvas, data: ctx.getImageData(0, 0, canvas.width, canvas.height), name: file.name });
    setRegions([]);
    setActiveId(null);
    setSplit(1);
    segmenter.current!.setImage(canvas).catch((e: Error) => setError(`AI загвар ачаалагдсангүй: ${e.message}. "Гараар зурах" горимыг ашиглана уу.`));
  };

  // ---------- render preview ----------
  const preview = useMemo(() => {
    if (!image) return null;
    const out = new ImageData(new Uint8ClampedArray(image.data.data), image.data.width, image.data.height);
    for (const r of regions) {
      const a = r.paintOnly ? r.paintAlpha : r.alpha;
      if (a) applyFilm(image.data.data, out.data, a, regionFilm(r).effect);
    }
    return out;
  }, [image, regions]);

  useEffect(() => {
    const view = viewRef.current;
    if (!view || !image || !preview) return;
    view.width = image.data.width;
    view.height = image.data.height;
    const ctx = view.getContext('2d', { willReadFrequently: true })!;
    ctx.putImageData(preview, 0, 0);
    if (split < 1) {
      const x = Math.round(split * view.width);
      ctx.putImageData(image.data, 0, 0, x, 0, view.width - x, view.height);
      ctx.fillStyle = '#fff';
      ctx.fillRect(x - 1, 0, 2, view.height);
    }
    if (active) drawOverlay(ctx, active, view.width, view.height);
  }, [image, preview, split, active]);

  // ---------- selecting areas ----------
  const setMaskFor = (uid: number, mask: Uint8Array | null) => {
    if (!image) return;
    const { width, height } = image.data;
    const alpha = mask ? featherMask(mask, width, height, 1) : null;
    let paintAlpha: Float32Array | null = null;
    if (alpha) {
      const w = blurFloat(paintWeights(image.data.data, alpha), width, height, 1);
      paintAlpha = alpha.map((a, i) => a * w[i]!);
    }
    update(uid, { mask, alpha, paintAlpha });
  };

  const runSegment = async (r: Region, points: Point[]) => {
    if (points.length === 0) return setMaskFor(r.uid, null);
    setBusy(true);
    try {
      const m = await segmenter.current!.segment(points);
      setMaskFor(r.uid, m.mask);
    } catch (e) {
      setError(`Хэсгийг таньж чадсангүй: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  };

  const onCanvasPointer = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!active || !image) return;
    e.preventDefault();
    const rect = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    if (active.tool === 'polygon') {
      if (active.closed) return;
      update(active.uid, { polygon: [...active.polygon, { x, y }] });
      return;
    }
    if (status.state !== 'ready' || busy) return;
    const positive = !(e.button === 2 || e.shiftKey || e.altKey);
    const points = [...active.points, { x, y, positive }];
    update(active.uid, { points });
    void runSegment(active, points);
  };

  const closePolygon = (r: Region) => {
    if (!image || r.polygon.length < 3) return;
    update(r.uid, { closed: true });
    setMaskFor(r.uid, polygonMask(r.polygon, image.data.width, image.data.height));
  };

  const undoPoint = (r: Region) => {
    if (r.tool === 'polygon') {
      const polygon = r.polygon.slice(0, -1);
      update(r.uid, { polygon, closed: false, mask: null, alpha: null });
    } else {
      const points = r.points.slice(0, -1);
      update(r.uid, { points });
      void runSegment(r, points);
    }
  };

  const addRegion = () => {
    const uid = uidSeq++;
    const used = new Set(regions.map((r) => r.zoneId));
    const zoneId = regions.length === 0 ? 'full' : ZONES.find((z) => !used.has(z.id) && z.id !== 'full')?.id ?? 'other';
    const tool = status.state === 'error' ? 'polygon' : 'ai';
    setRegions((rs) => [...rs, { uid, zoneId, filmId: 'satin-black', custom: null, tool, points: [], polygon: [], closed: false, paintOnly: true, mask: null, alpha: null, paintAlpha: null }]);
    setActiveId(uid);
    setSplit(1);
  };

  const removeRegion = (uid: number) => {
    setRegions((rs) => rs.filter((r) => r.uid !== uid));
    if (activeId === uid) setActiveId(null);
  };

  const ready = regions.filter((r) => r.alpha);
  const total = ready.reduce((s, r) => s + zonePrice(ZONES.find((z) => z.id === r.zoneId)!, regionFilm(r)), 0);

  // ---------- view ----------
  return (
    <div className="min-h-dvh bg-[var(--bg)] text-[var(--fg)]">
      <header className="flex items-center justify-between border-b border-[var(--line)] px-4 py-4 sm:px-8">
        <div>
          <div className="text-[15px] font-semibold tracking-tight">Хуулгын студи</div>
          <div className="text-xs text-[var(--muted)]">Өнгөт хуулга · Хамгаалалтын хуулга (PPF)</div>
        </div>
        {image && (
          <label className="btn-ghost cursor-pointer">
            Өөр зураг
            <input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} />
          </label>
        )}
      </header>

      {!image ? (
        <Upload onFile={onFile} status={status} error={error} />
      ) : (
        <main className="grid gap-6 px-4 py-6 sm:px-8 lg:grid-cols-[minmax(0,1fr)_380px]">
          <section className="min-w-0">
            <div className="relative overflow-hidden rounded-lg border border-[var(--line)] bg-black" data-seg={busy ? 'busy' : status.state}>
              <canvas
                ref={viewRef}
                className={`block h-auto w-full select-none ${active ? 'cursor-crosshair' : ''}`}
                onMouseDown={onCanvasPointer}
                onContextMenu={(e) => e.preventDefault()}
                onDoubleClick={() => active?.tool === 'polygon' && closePolygon(active)}
              />
              <StatusBadge status={status} busy={busy} />
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
              <span className="text-[var(--muted)]">Өмнө</span>
              <input type="range" min={0} max={1} step={0.001} value={split} onChange={(e) => setSplit(+e.target.value)} className="w-48 accent-[var(--accent)]" aria-label="Өмнө / дараа харьцуулах" />
              <span className="text-[var(--muted)]">Дараа</span>
              <button className="btn-ghost ml-auto" onClick={() => downloadPreview(viewRef.current, image.name)}>Зургийг татах</button>
            </div>
            {active && <Help region={active} />}
            {error && <p className="mt-3 rounded border border-red-900/60 bg-red-950/40 px-3 py-2 text-sm text-red-200">{error}</p>}
          </section>

          <aside className="space-y-4">
            {regions.map((r) => (
              <RegionCard
                key={r.uid}
                region={r}
                active={r.uid === activeId}
                aiAvailable={status.state !== 'error'}
                onActivate={() => setActiveId(r.uid === activeId ? null : r.uid)}
                onChange={(patch) => update(r.uid, patch)}
                onTool={(tool) => update(r.uid, { tool, points: [], polygon: [], closed: false, mask: null, alpha: null, paintAlpha: null })}
                onUndo={() => undoPoint(r)}
                onClose={() => closePolygon(r)}
                onRemove={() => removeRegion(r.uid)}
              />
            ))}
            <button className="btn-ghost w-full py-3" onClick={addRegion}>+ Хэсэг нэмэх</button>

            <div className="rounded-lg border border-[var(--line)] p-4">
              <div className="flex items-baseline justify-between">
                <span className="text-sm text-[var(--muted)]">Урьдчилсан үнэ</span>
                <span className="text-xl font-semibold">{formatMnt(total)}</span>
              </div>
              <p className="mt-1 text-xs text-[var(--muted)]">Жишээ үнэ. Эцсийн үнийг машиныг үзсэний дараа баталгаажуулна.</p>
              <button className="btn-primary mt-4 w-full" disabled={ready.length === 0} onClick={() => setShowOrder(true)}>Захиалга өгөх</button>
            </div>
          </aside>
        </main>
      )}

      {showOrder && image && <OrderForm regions={ready} total={total} onClose={() => setShowOrder(false)} />}
    </div>
  );
}

function drawOverlay(ctx: CanvasRenderingContext2D, r: Region, w: number, h: number) {
  if (r.mask && !(r.tool === 'polygon' && !r.closed)) {
    // Thin animated-looking outline: tint the mask edge.
    const img = ctx.getImageData(0, 0, w, h);
    const m = r.mask;
    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        const i = y * w + x;
        if (!m[i]) continue;
        if (m[i - 1] && m[i + 1] && m[i - w] && m[i + w]) continue;
        const p = i * 4;
        img.data[p] = 255; img.data[p + 1] = 200; img.data[p + 2] = 80;
      }
    }
    ctx.putImageData(img, 0, 0);
  }
  const dot = Math.max(5, w / 220);
  for (const p of r.points) {
    ctx.beginPath();
    ctx.arc(p.x * w, p.y * h, dot, 0, Math.PI * 2);
    ctx.fillStyle = p.positive ? '#34d399' : '#f87171';
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#000';
    ctx.stroke();
  }
  if (r.polygon.length) {
    ctx.beginPath();
    r.polygon.forEach((p, i) => (i ? ctx.lineTo(p.x * w, p.y * h) : ctx.moveTo(p.x * w, p.y * h)));
    if (r.closed) ctx.closePath();
    ctx.lineWidth = Math.max(2, w / 600);
    ctx.strokeStyle = '#ffc850';
    ctx.stroke();
    for (const p of r.polygon) ctx.fillRect(p.x * w - dot / 2, p.y * h - dot / 2, dot, dot);
  }
}

function downloadPreview(canvas: HTMLCanvasElement | null, name: string) {
  if (!canvas) return;
  canvas.toBlob((b) => {
    if (!b) return;
    const a = document.createElement('a');
    a.href = URL.createObjectURL(b);
    a.download = name.replace(/\.[^.]+$/, '') + '-huulga.png';
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }, 'image/png');
}

function Upload({ onFile, status, error }: { onFile: (f: File) => void; status: SegmenterStatus; error: string | null }) {
  const [over, setOver] = useState(false);
  return (
    <main className="mx-auto max-w-3xl px-4 py-12 sm:py-20">
      <h1 className="text-3xl font-semibold tracking-tight sm:text-5xl">Машиндаа хуулга тавихаас өмнө харж үзээрэй</h1>
      <p className="mt-4 max-w-xl text-[var(--muted)]">
        Машиныхаа зургийг оруулаад хуулга тавих хэсэг дээрээ дарж сонгоно. Өнгө, гялгар эсвэл матт гадаргууг сонгоход өөрийн
        зураг дээрээ шууд харагдана. Дараа нь сонгосон хэсгүүдээрээ захиалга өгнө.
      </p>
      <label
        className={`mt-10 flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-16 text-center transition ${over ? 'border-[var(--accent)] bg-white/5' : 'border-[var(--line)]'}`}
        onDragOver={(e) => { e.preventDefault(); setOver(true); }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => { e.preventDefault(); setOver(false); const f = e.dataTransfer.files[0]; if (f) onFile(f); }}
      >
        <span className="text-lg font-medium">Зураг оруулах</span>
        <span className="mt-2 text-sm text-[var(--muted)]">Чирж оруулах эсвэл дарж сонгох · JPG, PNG, WEBP</span>
        <input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} />
      </label>
      <ul className="mt-6 grid gap-2 text-sm text-[var(--muted)] sm:grid-cols-3">
        <li>• Хажуу эсвэл 3/4 өнцгөөс</li>
        <li>• Өдрийн жигд гэрэлд</li>
        <li>• Машин бүтнээрээ харагдах</li>
      </ul>
      {status.state === 'loading' && <p className="mt-6 text-xs text-[var(--muted)]">AI загвар ачаалж байна… {Math.round(status.progress)}%</p>}
      {error && <p className="mt-6 text-sm text-red-300">{error}</p>}
      <p className="mt-10 text-xs text-[var(--muted)]">Зураг таны төхөөрөмж дээр боловсруулагдана — захиалга өгөх хүртэл хаашаа ч илгээгдэхгүй.</p>
    </main>
  );
}

function StatusBadge({ status, busy }: { status: SegmenterStatus; busy: boolean }) {
  let text: string | null = null;
  if (status.state === 'loading') text = `AI загвар ачаалж байна… ${Math.round(status.progress)}%`;
  else if (status.state === 'encoding') text = 'Зургийг шинжилж байна…';
  else if (busy) text = 'Хэсгийг тодорхойлж байна…';
  else if (status.state === 'error') text = 'AI ажиллахгүй байна — гараар зурна уу';
  if (!text) return null;
  return <div className="absolute left-3 top-3 rounded bg-black/75 px-3 py-1.5 text-xs text-white backdrop-blur">{text}</div>;
}

function Help({ region }: { region: Region }) {
  const zone = ZONES.find((z) => z.id === region.zoneId)!;
  return (
    <p className="mt-3 text-sm text-[var(--muted)]">
      {region.tool === 'ai' ? (
        <>
          <b className="text-[var(--fg)]">{zone.hint}.</b> Илүү хэсэг сонгогдвол <kbd>Shift</kbd> + дарах (эсвэл баруун товч)-оор хасна.
        </>
      ) : (
        <>Хэсгийн хүрээг цэгээр тойруулан дарж, давхар дарж эсвэл «Хаах» товчоор дуусгана.</>
      )}
    </p>
  );
}

function RegionCard(props: {
  region: Region; active: boolean; aiAvailable: boolean;
  onActivate: () => void; onChange: (p: Partial<Region>) => void; onTool: (t: Region['tool']) => void;
  onUndo: () => void; onClose: () => void; onRemove: () => void;
}) {
  const { region: r, active } = props;
  const zone = ZONES.find((z) => z.id === r.zoneId)!;
  const film = regionFilm(r);
  const service = film.service;
  return (
    <div className={`rounded-lg border p-4 ${active ? 'border-[var(--accent)]' : 'border-[var(--line)]'}`}>
      <div className="flex items-center gap-2">
        <select className="field min-w-0 flex-1" value={r.zoneId} onChange={(e) => props.onChange({ zoneId: e.target.value })}>
          {ZONES.map((z) => <option key={z.id} value={z.id}>{z.label}</option>)}
        </select>
        <button className="btn-ghost" onClick={props.onActivate}>{active ? 'Болсон' : 'Засах'}</button>
        <button className="btn-ghost px-2" aria-label="Устгах" onClick={props.onRemove}>✕</button>
      </div>

      {active && (
        <div className="mt-3 flex flex-wrap gap-2 text-xs">
          <button className={`chip ${r.tool === 'ai' ? 'chip-on' : ''}`} disabled={!props.aiAvailable} onClick={() => props.onTool('ai')}>AI-аар сонгох</button>
          <button className={`chip ${r.tool === 'polygon' ? 'chip-on' : ''}`} onClick={() => props.onTool('polygon')}>Гараар зурах</button>
          <button className="chip" disabled={r.tool === 'ai' ? !r.points.length : !r.polygon.length} onClick={props.onUndo}>Буцаах</button>
          {r.tool === 'polygon' && !r.closed && <button className="chip" disabled={r.polygon.length < 3} onClick={props.onClose}>Хаах</button>}
          <label className="flex w-full items-center gap-2 pt-1 text-[var(--muted)]">
            <input type="checkbox" className="accent-[var(--accent)]" checked={r.paintOnly} onChange={(e) => props.onChange({ paintOnly: e.target.checked })} />
            Шил, дугуй, гэрлийг автоматаар алгасах
          </label>
        </div>
      )}

      <div className="mt-4 flex gap-1 rounded-md bg-white/5 p-1 text-sm">
        {(['wrap', 'ppf'] as const).map((s) => (
          <button
            key={s}
            className={`flex-1 rounded px-2 py-1.5 ${service === s ? 'bg-[var(--fg)] text-[var(--bg)]' : 'text-[var(--muted)]'}`}
            onClick={() => props.onChange({ filmId: s === 'ppf' ? 'ppf-gloss' : 'satin-black', custom: null })}
          >
            {s === 'wrap' ? 'Өнгөт хуулга' : 'Хамгаалалтын (PPF)'}
          </button>
        ))}
      </div>

      <div className="mt-3 grid grid-cols-7 gap-1.5">
        {FILMS.filter((f) => f.service === service).map((f) => (
          <button
            key={f.id}
            title={f.label}
            aria-label={f.label}
            onClick={() => props.onChange({ filmId: f.id, custom: null })}
            className={`aspect-square rounded-full border-2 ${r.filmId === f.id && !r.custom ? 'border-[var(--accent)]' : 'border-transparent'}`}
            style={{ background: f.service === 'ppf' ? (f.id === 'ppf-matte' ? 'linear-gradient(135deg,#555,#777)' : 'linear-gradient(135deg,#ddd,#fff 45%,#999)') : f.swatch }}
          />
        ))}
      </div>

      {service === 'wrap' && (
        <div className="mt-3 flex items-center gap-2 text-xs">
          <span className="text-[var(--muted)]">Өөрийн өнгө</span>
          <input
            type="color"
            className="h-7 w-10 cursor-pointer rounded border border-[var(--line)] bg-transparent"
            value={r.custom?.color ?? (film.effect.kind === 'wrap' ? film.effect.color : '#000000')}
            onChange={(e) => props.onChange({ custom: { color: e.target.value, finish: r.custom?.finish ?? (film.effect.kind === 'wrap' ? film.effect.finish : 'gloss') } })}
          />
          {r.custom && (
            <select className="field py-1" value={r.custom.finish} onChange={(e) => props.onChange({ custom: { ...r.custom!, finish: e.target.value as Finish } })}>
              {(Object.keys(FINISH_LABEL) as Finish[]).map((f) => <option key={f} value={f}>{FINISH_LABEL[f]}</option>)}
            </select>
          )}
        </div>
      )}

      <div className="mt-3 flex items-baseline justify-between text-sm">
        <span>{film.label}</span>
        <span className="text-[var(--muted)]">{r.alpha ? formatMnt(zonePrice(zone, film)) : 'Хэсэг сонгоогүй'}</span>
      </div>
    </div>
  );
}
