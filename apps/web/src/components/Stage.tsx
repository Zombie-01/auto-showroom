import { useEffect, useMemo, type ReactNode } from 'react';
import { useProgress } from '@react-three/drei';
import type { VehicleManifest } from '@showroom/shared';
import { useEngine } from '../engine/store';
import { detectWebGL, initialQuality } from '../lib/device';
import { loadManifest, useAsync, useReducedMotion } from '../lib/hooks';

/** One-time engine environment setup shared by every 3D page. */
export function useEngineEnvironment() {
  const reduced = useReducedMotion();
  useEffect(() => { useEngine.setState({ reducedMotion: reduced }); }, [reduced]);
  useEffect(() => { useEngine.setState({ quality: initialQuality() }); }, []);
  return useMemo(() => detectWebGL(), []);
}

export function useManifest(url: string | null | undefined) {
  return useAsync<VehicleManifest | null>(() => (url ? loadManifest(url) : Promise.resolve(null)), [url]);
}

/** Thin progress line + label while the first system loads. Hidden once it's ready. */
export function LoadingVeil({ label }: { label: string }) {
  const { progress, active } = useProgress();
  const loaded = useEngine((s) => s.loaded.includes('exterior'));
  const failed = useEngine((s) => s.failed.exterior);
  if (failed) {
    return (
      <div role="alert" className="absolute inset-0 z-20 grid place-items-center bg-ink">
        <div className="max-w-sm px-6 text-center">
          <p className="kicker">3D загвар ачаалагдсангүй</p>
          <p className="mt-3 text-sm text-fg-2">Машины загварыг ачаалж чадсангүй ({failed}). Үзүүлэлт болон дилерт хандах маягт доор байгаа.</p>
          <button className="btn-ghost mt-6" onClick={() => location.reload()}>Дахин ачаалах</button>
        </div>
      </div>
    );
  }
  return (
    <div aria-hidden={loaded} className={`pointer-events-none absolute inset-0 z-20 grid place-items-center bg-ink transition-opacity duration-1000 ${loaded ? 'opacity-0' : 'opacity-100'}`}>
      <div className="w-48 text-center" role="status" aria-live="polite">
        <p className="kicker">{label}</p>
        <div className="mt-4 h-px w-full bg-line-strong"><div className="h-px bg-fg transition-[width] duration-300" style={{ width: `${active ? Math.max(8, progress) : loaded ? 100 : 8}%` }} /></div>
      </div>
    </div>
  );
}

export function NoWebGL({ reason, children }: { reason: string; children?: ReactNode }) {
  return (
    <div className="flex h-full w-full items-center justify-center bg-[radial-gradient(100%_70%_at_50%_100%,#17171a_0%,#0a0a0b_70%)] p-8">
      <div className="max-w-md text-center">
        <p className="kicker">Интерактив 3D боломжгүй</p>
        <p className="mt-3 text-sm text-fg-2">{reason} Та үзүүлэлт харах, машин харьцуулах, дилертэй холбогдох боломжтой хэвээр.</p>
        {children}
      </div>
    </div>
  );
}
