import type { Configuration } from '@showroom/shared';

interface V { id: string; name: string; price: number | null; currency: string }
interface C { id: string; group: string; name: string; priceDelta: number | null; variantIds: string[] }

const LABELS: Record<string, string> = {
  body: 'Их биеийн өнгө', roof: 'Дээврийн өнгө', wheels: 'Обудны өнгө', exterior_trim: 'Гадна чимэглэл', interior_theme: 'Дотор заслын өнгө',
  seats: 'Суудлын өнгө', interior_material: 'Дотор засал', dashboard_finish: 'Хянах самбар', interior_trim: 'Дотор чимэглэл',
  wheel_design: 'Обудны загвар', accessories: 'Дагалдах хэрэгсэл', roof_rack: 'Дээврийн тавиур', side_steps: 'Хажуугийн гишгүүр',
};
const humanize = (s: string) => LABELS[s] ?? s.replace(/[_-]+/g, ' ').replace(/^\w/, (c) => c.toUpperCase());

/**
 * Server-side quote: the client never supplies prices. Returns null when the selected variant
 * has no configured price (we never show an estimate built on a missing number).
 */
export function quote(vehicleLabel: string, variants: V[], colors: C[], cfg: Configuration | undefined) {
  const summary: { label: string; value: string }[] = [{ label: 'Машин', value: vehicleLabel }];
  if (!cfg) return { summary, estimatedPrice: null as number | null, currency: null as string | null };

  const variant = cfg.variantId ? variants.find((v) => v.id === cfg.variantId) : undefined;
  if (variant) summary.push({ label: 'Хувилбар', value: variant.name });

  let delta = 0;
  for (const [group, colorId] of Object.entries(cfg.colors)) {
    const c = colors.find((x) => x.id === colorId && x.group === group);
    if (!c) continue; // unknown or "default"
    if (variant && c.variantIds.length && !c.variantIds.includes(variant.id)) continue;
    summary.push({ label: humanize(group), value: c.name });
    delta += c.priceDelta ?? 0;
  }
  for (const [sw, opts] of Object.entries(cfg.switches)) {
    if (opts.length) summary.push({ label: humanize(sw), value: opts.map(humanize).join(', ') });
  }
  const estimatedPrice = variant?.price != null ? variant.price + delta : null;
  return { summary, estimatedPrice, currency: estimatedPrice != null ? variant!.currency : null };
}
