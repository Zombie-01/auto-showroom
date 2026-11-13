import type { ANALYTICS_EVENTS } from '@showroom/shared';

type EventType = (typeof ANALYTICS_EVENTS)[number];
const sent = new Set<string>();

/** Fire-and-forget; never blocks or breaks the experience. `once` de-duplicates per page load. */
export function track(type: EventType, vehicleSlug?: string, payload?: Record<string, string | number | boolean>, once = false) {
  const key = `${type}|${vehicleSlug}|${JSON.stringify(payload)}`;
  if (once && sent.has(key)) return;
  sent.add(key);
  const body = JSON.stringify({ type, vehicleSlug, payload });
  try {
    if (navigator.sendBeacon?.('/api/public/events', new Blob([body], { type: 'application/json' }))) return;
  } catch { /* fall through */ }
  void fetch('/api/public/events', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body, keepalive: true }).catch(() => {});
}
