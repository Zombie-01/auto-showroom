import { useEffect, useMemo, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router';
import { decodeConfiguration, encodeConfiguration, type Configuration, type MaterialGroup, type VehicleColor, type VehicleManifest } from '@showroom/shared';
import { VehicleScene } from '../engine/VehicleScene';
import { useEngine, type MaterialChoice } from '../engine/store';
import { sampleTimeline, type Pose } from '../engine/timeline';
import { publicApi, type PublicVehicle } from '../lib/api';
import { track } from '../lib/analytics';
import { useAsync } from '../lib/hooks';
import { formatPrice } from '../lib/tenant';
import { DemoBadge, ErrorState, Nav, PageShell, Spinner } from '../components/ui';
import { LeadDialog, type LeadType } from '../components/LeadForm';
import { LoadingVeil, NoWebGL, useEngineEnvironment, useManifest } from '../components/Stage';

type Tab = 'exterior' | 'interior' | 'summary';
const AVAIL: Record<string, string> = { 'factory-verified': 'Үйлдвэрийн сонголт', 'dealer-option': 'Дилерийн сонголт', demonstration: 'Үзүүлэн сонголт' };
const TAB_LABEL: Record<string, string> = { exterior: 'Гадна', interior: 'Салон', summary: 'Дүгнэлт' };
/** Pseudo material group for interior colour packages (stored as vehicle colours with group "interior_theme"). */
const THEME_GROUP: MaterialGroup = { id: 'interior_theme', label: 'Дотор заслын өнгө', materials: ['-'], surface: 'interior', default: { hex: '#545046', metalness: 0, roughness: 0.6, clearcoat: 0 } };
const draftKey = (slug: string) => `showroom:config:${slug}`;

function emptyConfig(slug: string, v: PublicVehicle): Configuration {
  return { vehicleSlug: slug, variantId: v.variants[0]?.id ?? null, colors: {}, switches: {} };
}

function readDraft(slug: string): Configuration | null {
  try { const raw = localStorage.getItem(draftKey(slug)); return raw ? decodeConfiguration(raw) : null; } catch { return null; }
}

function posesFor(m: VehicleManifest): Record<'exterior' | 'interior', Pose> {
  const base = sampleTimeline(m.story.keyframes, 0);
  const ext = { ...base, ...m.configurator, yaw: 0, explode: { ...base.explode, exterior: 0 }, opacity: { exterior: 1, engine: 0, transmission: 0, suspension: 0, interior: 1 } };
  const cam = m.cameras.interior ?? m.configurator;
  return { exterior: ext, interior: { ...ext, ...cam } };
}

function Swatches({ group, colors, value, onChange }: { group: MaterialGroup; colors: VehicleColor[]; value: string | undefined; onChange: (id: string) => void }) {
  const current = colors.find((c) => c.id === value);
  const options = [{ id: 'default', name: 'Загварын үндсэн', hex: group.default.hex, availability: 'demonstration' as const, priceDelta: null as number | null }, ...colors];
  return (
    <fieldset className="border-b hairline py-6">
      <div className="flex items-baseline justify-between gap-4">
        <legend className="kicker text-fg-2">{group.label}</legend>
        <span className="text-sm">{current?.name ?? 'Загварын үндсэн'}</span>
      </div>
      <div className="mt-4 flex flex-wrap gap-2.5">
        {options.map((c) => {
          const active = (value ?? 'default') === c.id;
          return (
            <button key={c.id} type="button" onClick={() => onChange(c.id)} aria-pressed={active} aria-label={`${c.name}${c.id !== 'default' ? `, ${AVAIL[c.availability]}` : ''}`} title={c.name}
              className={`relative h-10 w-10 rounded-full border transition-[box-shadow,transform] duration-300 hover:scale-105 ${active ? 'border-transparent shadow-[0_0_0_2px_var(--color-ink),0_0_0_3.5px_var(--color-fg)]' : 'border-white/15'}`}
              style={{ background: `radial-gradient(circle at 35% 30%, color-mix(in srgb, ${c.hex} 70%, white) 0%, ${c.hex} 45%, color-mix(in srgb, ${c.hex} 70%, black) 100%)` }} />
          );
        })}
      </div>
      {current && <p className="tech mt-3 text-[0.6875rem] text-mute">{AVAIL[current.availability]}{current.availability === 'demonstration' ? ' — үйлдвэрийн боломжит эсэх нь баталгаажаагүй' : ''}{current.priceDelta ? ` · +${formatPrice({ amount: current.priceDelta, currency: 'MNT' })}` : ''}</p>}
    </fieldset>
  );
}

function Configurator({ vehicle, manifest, initial }: { vehicle: PublicVehicle; manifest: VehicleManifest; initial: Configuration }) {
  const [cfg, setCfg] = useState<Configuration>(initial);
  const [tab, setTab] = useState<Tab>('exterior');
  const [lead, setLead] = useState<LeadType | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [savedCode, setSavedCode] = useState<string | null>(null);
  const storeManifest = useEngine((s) => s.manifest);
  const poses = useMemo(() => posesFor(manifest), [manifest]);

  useEffect(() => {
    const st = useEngine.getState();
    st.reset();
    useEngine.setState({ manifest, manifestUrl: vehicle.manifestUrl, mode: 'orbit', staticPose: poses.exterior, requested: ['exterior', 'interior'], interactive: [], quality: st.quality, reducedMotion: matchMedia('(prefers-reduced-motion: reduce)').matches });
    track('configurator_open', vehicle.slug, undefined, true);
    return () => useEngine.getState().reset();
  }, [manifest, vehicle, poses]);

  useEffect(() => { useEngine.setState({ staticPose: tab === 'interior' ? poses.interior : poses.exterior }); }, [tab, poses]);

  // Configuration → engine materials and switches.
  useEffect(() => {
    const materials: Record<string, MaterialChoice> = {};
    for (const g of manifest.materialGroups) {
      const c = vehicle.colors.find((x) => x.id === cfg.colors[g.id] && x.group === g.id);
      if (c) materials[g.id] = { hex: c.hex, ...c.finish };
    }
    // An interior colour package sets seats, trim, dashboard and accents together so they always match.
    const theme = vehicle.colors.find((x) => x.group === THEME_GROUP.id && x.id === cfg.colors[THEME_GROUP.id]);
    for (const [g, hex] of Object.entries(theme?.finish.members ?? {})) {
      const mg = manifest.materialGroups.find((x) => x.id === g);
      if (mg) materials[g] = { hex, metalness: mg.default.metalness, roughness: mg.default.roughness, clearcoat: mg.default.clearcoat };
    }
    useEngine.setState({ materials, switches: cfg.switches });
    try { localStorage.setItem(draftKey(vehicle.slug), encodeConfiguration(cfg)); } catch { /* storage unavailable */ }
    setSavedCode(null);
  }, [cfg, manifest, vehicle]);

  const groups = (surface: 'exterior' | 'interior') => manifest.materialGroups.filter((g) => g.surface === surface && vehicle.colors.some((c) => c.group === g.id));
  const variant = vehicle.variants.find((v) => v.id === cfg.variantId);
  const chosen = Object.entries(cfg.colors).map(([g, id]) => vehicle.colors.find((c) => c.id === id && c.group === g)).filter(Boolean) as VehicleColor[];
  const estimate = variant?.price != null ? { amount: variant.price + chosen.reduce((a, c) => a + (c.priceDelta ?? 0), 0), currency: variant.currency } : null;
  const flash = (m: string) => { setNotice(m); setTimeout(() => setNotice(null), 3200); };

  const shareUrl = () => `${location.origin}/vehicles/${vehicle.slug}/configure?c=${encodeConfiguration(cfg)}`;
  async function copy(text: string, msg: string) {
    try { await navigator.clipboard.writeText(text); flash(msg); } catch { prompt('Энэ холбоосыг хуулна уу', text); }
  }
  async function save() {
    try {
      const { code } = await publicApi.saveConfiguration(cfg);
      setSavedCode(code);
      track('configuration_saved', vehicle.slug);
      await copy(`${location.origin}/vehicles/${vehicle.slug}/configure?code=${code}`, 'Хадгаллаа — холбоосыг хуулсан');
    } catch (e) { flash(e instanceof Error ? e.message : 'Хадгалж чадсангүй'); }
  }
  function screenshot() {
    const url = useEngine.getState().capture?.();
    if (!url) return flash('Зураг авах боломжгүй');
    const a = document.createElement('a');
    a.href = url; a.download = `${vehicle.slug}-configuration.png`; a.click();
    track('screenshot', vehicle.slug);
  }
  const setSwitch = (id: string, opts: string[]) => setCfg((c) => ({ ...c, switches: { ...c.switches, [id]: opts } }));

  const summary: [string, string][] = [
    ['Машин', `${vehicle.brand} ${vehicle.model}`],
    ['Хувилбар', variant?.name ?? '—'],
    ...manifest.materialGroups.filter((g) => vehicle.colors.some((c) => c.group === g.id)).map((g): [string, string] => [g.label, vehicle.colors.find((c) => c.id === cfg.colors[g.id])?.name ?? 'Загварын үндсэн']),
    ...(vehicle.colors.some((c) => c.group === THEME_GROUP.id) ? [[THEME_GROUP.label, vehicle.colors.find((c) => c.id === cfg.colors[THEME_GROUP.id])?.name ?? 'Загварын үндсэн'] as [string, string]] : []),
    ...manifest.switches.map((s): [string, string] => [s.label, (cfg.switches[s.id] ?? s.default).map((o) => s.options.find((x) => x.id === o)?.label ?? o).join(', ') || 'Байхгүй']),
  ];

  return (
    <div className="flex min-h-[100svh] flex-col pt-16 lg:h-[100svh] lg:flex-row">
      <div className="relative h-[52svh] shrink-0 lg:h-auto lg:flex-1">
        {storeManifest === manifest && <VehicleScene manifest={manifest} className="absolute inset-0" orbitLimits={tab === 'interior' ? { minDistance: 0.05, maxDistance: 1.4, maxPolarAngle: Math.PI } : { minDistance: 4.5, maxDistance: 11 }} label={`${vehicle.brand} ${vehicle.model} — 3D тохируулагч. Чирж эргүүлнэ.`} />}
        <LoadingVeil label="Тохируулагчийг ачаалж байна" />
        <div className="pointer-events-none absolute bottom-4 left-4 right-4 flex items-end justify-between gap-4">
          <p className="kicker hidden sm:block">Чирж эргүүлэх{tab === 'interior' ? ' · салоны харагдац' : ' · гүйлгэж ойртуулах'}</p>
          {manifest.assetStatus !== 'production' && <div className="pointer-events-auto hidden md:block"><DemoBadge text={manifest.disclaimer} status={manifest.assetStatus} /></div>}
        </div>
      </div>

      <aside className="flex w-full flex-col border-t hairline bg-ink lg:w-[440px] lg:border-l lg:border-t-0" aria-label="Тохиргооны сонголтууд">
        <div className="px-6 pt-8">
          <p className="kicker">Тохируулах</p>
          <h1 className="display mt-3 text-3xl">{vehicle.model}</h1>
          <div role="tablist" aria-label="Тохиргооны хэсгүүд" className="mt-8 grid grid-cols-3 border-b hairline">
            {(['exterior', 'interior', 'summary'] as Tab[]).map((t) => (
              <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)}
                className={`-mb-px border-b py-3 text-[0.8125rem] tracking-wide transition-colors ${tab === t ? 'border-accent text-fg' : 'border-transparent text-mute hover:text-fg'}`}>{TAB_LABEL[t]}</button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-6 pb-6" role="tabpanel">
          {tab === 'exterior' && (
            <>
              {vehicle.variants.length > 0 && (
                <fieldset className="border-b hairline py-6">
                  <legend className="kicker text-fg-2">Хувилбар</legend>
                  <div className="mt-4 space-y-2">
                    {vehicle.variants.map((v) => (
                      <label key={v.id} className="flex cursor-pointer items-start justify-between gap-4 border border-line-strong p-4 has-[:checked]:border-fg has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-accent">
                        <input type="radio" name="variant" className="sr-only" checked={cfg.variantId === v.id} onChange={() => setCfg((c) => ({ ...c, variantId: v.id }))} />
                        <span><span className="block text-sm">{v.name}</span><span className="tech mt-1 block text-[0.6875rem] text-mute">{[v.engine, v.transmission, v.drivetrain].filter(Boolean).join(' · ')}</span></span>
                        <span className="shrink-0 text-sm text-fg-2">{formatPrice(v.price != null ? { amount: v.price, currency: v.currency } : null) ?? 'Лавлана уу'}</span>
                      </label>
                    ))}
                  </div>
                </fieldset>
              )}
              {groups('exterior').map((g) => <Swatches key={g.id} group={g} colors={vehicle.colors.filter((c) => c.group === g.id)} value={cfg.colors[g.id]} onChange={(id) => setCfg((c) => ({ ...c, colors: { ...c.colors, [g.id]: id } }))} />)}
              {manifest.switches.map((s) => {
                const on = cfg.switches[s.id] ?? s.default;
                return (
                  <fieldset key={s.id} className="border-b hairline py-6">
                    <legend className="kicker text-fg-2">{s.label}</legend>
                    <div className="mt-4 grid grid-cols-2 gap-2">
                      {s.options.map((o) => {
                        const active = on.includes(o.id);
                        return (
                          <button key={o.id} type="button" aria-pressed={active}
                            onClick={() => setSwitch(s.id, s.kind === 'exclusive' ? [o.id] : active ? on.filter((x) => x !== o.id) : [...on, o.id])}
                            className={`border p-3 text-left text-[0.8125rem] transition-colors ${active ? 'border-fg text-fg' : 'border-line-strong text-fg-2 hover:text-fg'}`}>
                            {o.label}<span className="tech mt-1 block text-[0.625rem] text-mute">{AVAIL[o.availability]}</span>
                          </button>
                        );
                      })}
                    </div>
                  </fieldset>
                );
              })}
            </>
          )}
          {tab === 'interior' && vehicle.colors.some((c) => c.group === THEME_GROUP.id) && (
            <>
              <Swatches group={THEME_GROUP} colors={vehicle.colors.filter((c) => c.group === THEME_GROUP.id)} value={cfg.colors[THEME_GROUP.id]} onChange={(id) => setCfg((c) => ({ ...c, colors: { ...c.colors, [THEME_GROUP.id]: id } }))} />
              <p className="pt-4 text-xs leading-relaxed text-mute">Суудлын бүрээс, хаалга ба самбарын доторлогоо, чимэглэл нэг багцаар зохицон өөрчлөгдөнө.</p>
            </>
          )}
          {tab === 'interior' && groups('interior').map((g) => <Swatches key={g.id} group={g} colors={vehicle.colors.filter((c) => c.group === g.id)} value={cfg.colors[g.id]} onChange={(id) => setCfg((c) => ({ ...c, colors: { ...c.colors, [g.id]: id } }))} />)}
          {tab === 'summary' && (
            <div className="py-6">
              <dl>{summary.map(([k, v]) => <div key={k} className="flex justify-between gap-6 border-b hairline py-3 text-sm"><dt className="text-mute">{k}</dt><dd className="text-right">{v}</dd></div>)}</dl>
              <div className="mt-6 flex items-baseline justify-between">
                <span className="kicker">Тооцоолсон үнэ</span>
                <span className="display text-xl">{formatPrice(estimate) ?? 'Лавлана уу'}</span>
              </div>
              <p className="mt-2 text-[0.6875rem] leading-relaxed text-mute">{estimate ? 'Дилерийн тохируулсан үнэд үндэслэсэн тооцоо. Эцсийн үнийг дилер баталгаажуулна.' : 'Дилер энэ тохиргооны үнийг нийтлээгүй байна.'}</p>
            </div>
          )}
        </div>

        <div className="border-t hairline bg-ink-2 p-6">
          <div className="flex items-baseline justify-between">
            <span className="kicker">{estimate ? 'Тооцоолсон' : 'Үнэ'}</span>
            <span className="text-sm">{formatPrice(estimate) ?? 'Лавлана уу'}</span>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2">
            <button className="btn-primary col-span-2" onClick={() => setLead('quote')}>Үнийн санал авах</button>
            <button className="btn-ghost" onClick={() => setLead('test_drive')}>Туршилтын жолоодлого</button>
            <button className="btn-ghost" onClick={() => setLead('contact')}>Дилертэй холбогдох</button>
          </div>
          <div className="mt-3 flex flex-wrap justify-between gap-1">
            <button className="btn-quiet h-9 px-2 text-[0.75rem]" onClick={save}>{savedCode ? 'Хадгалсан ✓' : 'Хадгалах'}</button>
            <button className="btn-quiet h-9 px-2 text-[0.75rem]" onClick={() => copy(shareUrl(), 'Холбоосыг хуулсан')}>Хуваалцах</button>
            <button className="btn-quiet h-9 px-2 text-[0.75rem]" onClick={screenshot}>Зураг авах</button>
            <button className="btn-quiet h-9 px-2 text-[0.75rem]" onClick={() => setCfg(emptyConfig(vehicle.slug, vehicle))}>Шинэчлэх</button>
          </div>
          <p aria-live="polite" className="mt-2 h-4 text-center text-[0.6875rem] text-ok">{notice}</p>
        </div>
      </aside>
      <LeadDialog type={lead} configuration={cfg} onClose={() => setLead(null)} />
    </div>
  );
}

export default function ConfiguratorPage() {
  const { slug = '' } = useParams();
  const [params] = useSearchParams();
  const webgl = useEngineEnvironment();
  const vehicle = useAsync(() => publicApi.vehicle(slug), [slug]);
  const manifest = useManifest(vehicle.status === 'ok' ? vehicle.data.manifestUrl : null);
  const initial = useAsync<Configuration | null>(async () => {
    const code = params.get('code');
    if (code) return publicApi.loadConfiguration(code).catch(() => null);
    const c = params.get('c');
    return (c && decodeConfiguration(c)) || readDraft(slug);
  }, [slug]);

  if (vehicle.status === 'error') return <PageShell><ErrorState title="Машиныг ачаалж чадсангүй" message={vehicle.error} /></PageShell>;
  if (vehicle.status === 'loading' || manifest.status === 'loading' || initial.status === 'loading') return <div className="grid h-[100svh] place-items-center"><Spinner /></div>;
  const v = vehicle.data;
  if (!v.manifestUrl || manifest.status === 'error' || !webgl.ok) {
    return (
      <PageShell>
        <div className="h-[60svh]"><NoWebGL reason={!v.manifestUrl ? 'Энэ машины тохируулагч хараахан бэлэн болоогүй байна.' : !webgl.ok ? webgl.reason : (manifest as { error: string }).error}>
          <Link to={`/vehicles/${v.slug}`} className="btn-ghost mt-8">Үзүүлэлт харах</Link>
        </NoWebGL></div>
      </PageShell>
    );
  }
  const init = initial.status === 'ok' && initial.data?.vehicleSlug === slug ? initial.data : emptyConfig(slug, v);
  // Drop references that no longer exist (deleted colours/variants).
  const sanitized: Configuration = {
    ...init,
    variantId: v.variants.some((x) => x.id === init.variantId) ? init.variantId : v.variants[0]?.id ?? null,
    colors: Object.fromEntries(Object.entries(init.colors).filter(([g, id]) => id === 'default' || v.colors.some((c) => c.id === id && c.group === g))),
  };
  return (
    <>
      <Nav overlay />
      <main><Configurator vehicle={v} manifest={manifest.data!} initial={sanitized} /></main>
    </>
  );
}
