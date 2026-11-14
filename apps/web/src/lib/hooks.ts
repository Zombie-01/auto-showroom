import { useEffect, useState } from 'react';
import { lintManifest, VehicleManifest } from '@showroom/shared';

export type Async<T> = { status: 'loading' } | { status: 'ok'; data: T } | { status: 'error'; error: string; retry: () => void };

/**
 * Results are tagged with the deps they were produced for. When deps change, the stale result is
 * never returned — callers see "loading" in the very same render, not one render later.
 */
export function useAsync<T>(fn: () => Promise<T>, deps: unknown[]): Async<T> {
  const [attempt, setAttempt] = useState(0);
  const key = JSON.stringify([...deps, attempt]);
  const [state, setState] = useState<{ key: string; value: Async<T> }>({ key: '', value: { status: 'loading' } });
  useEffect(() => {
    let alive = true;
    fn().then(
      (data) => alive && setState({ key, value: { status: 'ok', data } }),
      (e: Error) => alive && setState({ key, value: { status: 'error', error: e.message, retry: () => setAttempt((a) => a + 1) } }),
    );
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return state.key === key ? state.value : { status: 'loading' };
}

const manifestCache = new Map<string, Promise<VehicleManifest>>();
/** Fetch and validate a manifest. Invalid manifests are rejected rather than half-rendered. */
export function loadManifest(url: string): Promise<VehicleManifest> {
  let p = manifestCache.get(url);
  if (!p) {
    p = fetch(url).then(async (r) => {
      // A missing file must not be mistaken for JSON (e.g. an HTML fallback page from the host).
      if (!r.ok || !(r.headers.get('content-type') ?? '').includes('json')) throw new Error('Энэ машины 3D загвар одоогоор байршуулагдаагүй байна.');
      const parsed = VehicleManifest.safeParse(await r.json().catch(() => null));
      if (!parsed.success) throw new Error('3D manifest is invalid: ' + parsed.error.issues.slice(0, 3).map((i) => `${i.path.join('.')} ${i.message}`).join('; '));
      const problems = lintManifest(parsed.data);
      if (problems.length) throw new Error('3D manifest has errors: ' + problems.slice(0, 3).join('; '));
      return parsed.data;
    });
    p.catch(() => manifestCache.delete(url));
    manifestCache.set(url, p);
  }
  return p;
}

export function useReducedMotion() {
  const [reduced, setReduced] = useState(() => typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches);
  useEffect(() => {
    const mq = matchMedia('(prefers-reduced-motion: reduce)');
    const on = () => setReduced(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  return reduced;
}

export function useMediaQuery(q: string) {
  const [m, setM] = useState(() => typeof matchMedia !== 'undefined' && matchMedia(q).matches);
  useEffect(() => {
    const mq = matchMedia(q);
    const on = () => setM(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, [q]);
  return m;
}
