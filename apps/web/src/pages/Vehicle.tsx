import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { mergeSpecs, startingPrice, type ComponentInfo, type SpecValue, type VehicleManifest } from '@showroom/shared';
import { VehicleScene } from '../engine/VehicleScene';
import { useEngine } from '../engine/store';
import { sampleTimeline } from '../engine/timeline';
import { publicApi, type PublicVehicle } from '../lib/api';
import { track } from '../lib/analytics';
import { useAsync } from '../lib/hooks';
import { formatPrice } from '../lib/tenant';
import { DemoBadge, ErrorState, Footer, Nav, PageShell, SpecRow, SpecSheetView, Spinner, StatusBadge } from '../components/ui';
import { LeadDialog, type LeadType } from '../components/LeadForm';
import { LoadingVeil, NoWebGL, useEngineEnvironment, useManifest } from '../components/Stage';

gsap.registerPlugin(ScrollTrigger);

/** Scroll length per story section, in svh. */
const S = 180;
const SYSTEM_LABEL: Record<string, string> = { exterior: 'гадна тал', engine: 'хөдөлгүүр', transmission: 'хүч дамжуулалт', suspension: 'явах эд анги', interior: 'салон' };

function allSpecs(v: PublicVehicle): SpecValue[] { return Object.values(v.specifications).flat(); }

function ComponentPanel({ vehicle, manifest }: { vehicle: PublicVehicle; manifest: VehicleManifest }) {
  const selected = useEngine((s) => s.selected);
  const info = vehicle.components.find((c) => c.id === selected);
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => { if (info) { closeRef.current?.focus({ preventScroll: true }); track('component_select', vehicle.slug, { component: info.id }); } }, [info, vehicle.slug]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') useEngine.setState({ selected: null }); };
    addEventListener('keydown', onKey);
    return () => removeEventListener('keydown', onKey);
  }, []);
  if (!info) return null;
  const related = allSpecs(vehicle).filter((s) => info.relatedSpecKeys.includes(s.key));
  return (
    <aside aria-label={`${info.name} — дэлгэрэнгүй`} className="pointer-events-auto fixed inset-x-0 bottom-0 z-30 max-h-[58svh] overflow-y-auto border-t border-line-strong bg-ink-2/[0.97] p-6 md:absolute md:inset-x-auto md:bottom-auto md:right-6 md:top-32 md:max-h-[calc(100svh-10rem)] md:w-[380px] md:border">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="kicker">{SYSTEM_LABEL[info.system]} · {info.category}</p>
          <h2 className="display mt-3 text-2xl">{info.name}</h2>
        </div>
        <button ref={closeRef} onClick={() => useEngine.setState({ selected: null })} className="btn-quiet -mr-3 -mt-1 h-9" aria-label="Дэлгэрэнгүйг хаах">✕</button>
      </div>
      <p className="mt-5 text-sm leading-relaxed text-fg-2">{info.description}</p>
      <h3 className="kicker mt-6">Үүрэг</h3>
      <p className="mt-2 text-sm leading-relaxed text-fg-2">{info.function}</p>
      <h3 className="kicker mt-6">Материал</h3>
      <div className="mt-2 flex items-center gap-2 text-sm">{info.material.value ?? <span className="text-mute">Мэдээлэлгүй</span>}<StatusBadge status={info.material.status} /></div>
      {(info.technical.length > 0 || related.length > 0) && (
        <>
          <h3 className="kicker mt-6">Техникийн мэдээлэл</h3>
          <dl className="mt-1">{[...info.technical, ...related].map((s) => <SpecRow key={s.key} spec={s} />)}</dl>
        </>
      )}
      {manifest.assetStatus !== 'production' && <p className="mt-6 text-[0.6875rem] leading-relaxed text-mute">{manifest.components.find((c) => c.id === info.id)?.note ?? 'Харуулж буй 3D эд анги нь үзүүлэн геометр бөгөөд жинхэнэ хэлбэрийг илэрхийлэхгүй.'}</p>}
    </aside>
  );
}

function HoverLabel({ vehicle }: { vehicle: PublicVehicle }) {
  const hovered = useEngine((s) => s.hovered);
  const selected = useEngine((s) => s.selected);
  const name = vehicle.components.find((c) => c.id === hovered)?.name;
  if (!name || hovered === selected) return null;
  return <div className="pointer-events-none absolute left-1/2 top-32 z-20 md:bottom-8 md:top-auto -translate-x-1/2 border border-line-strong bg-ink/90 px-3 py-1.5 text-[0.8125rem]" aria-hidden>{name} <span className="text-mute">· дарж дэлгэрэнгүй үзэх</span></div>;
}

function Story({ vehicle, manifest }: { vehicle: PublicVehicle; manifest: VehicleManifest }) {
  const container = useRef<HTMLDivElement>(null);
  const sections = manifest.story.sections;
  const n = sections.length;
  const sectionIndex = useEngine((s) => s.sectionIndex);
  const mode = useEngine((s) => s.mode);
  const loaded = useEngine((s) => s.loaded);
  const failed = useEngine((s) => s.failed);
  const storeManifest = useEngine((s) => s.manifest);
  const selected = useEngine((s) => s.selected);
  const [progress, setProgress] = useState(0);

  useLayoutEffect(() => {
    const st = useEngine.getState();
    st.reset();
    useEngine.setState({
      manifest, manifestUrl: vehicle.manifestUrl, mode: 'story', storyAt: 0, sectionIndex: 0,
      requested: [...new Set(['exterior' as const, ...sections[0]!.requires])],
      interactive: sections[0]!.interactiveSystems, reducedMotion: matchMedia('(prefers-reduced-motion: reduce)').matches,
      quality: st.quality,
    });
    return () => useEngine.getState().reset();
  }, [manifest, vehicle.manifestUrl, sections]);

  // Scroll → timeline position. Scrub smooths input; the engine damps on top for a cinematic feel.
  useLayoutEffect(() => {
    if (!container.current) return;
    const proxy = { at: 0 };
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const tween = gsap.to(proxy, {
      at: n, ease: 'none',
      scrollTrigger: { trigger: container.current, start: 'top top', end: 'bottom bottom', scrub: reduced ? true : 0.6, invalidateOnRefresh: true },
      onUpdate: () => {
        const at = proxy.at;
        const idx = Math.min(n - 1, Math.floor(at));
        const s = useEngine.getState();
        const patch: Partial<typeof s> = { storyAt: at };
        if (idx !== s.sectionIndex) {
          patch.sectionIndex = idx;
          patch.interactive = sections[idx]!.interactiveSystems;
          patch.selected = null;
          patch.hovered = null;
          track('section_view', vehicle.slug, { section: sections[idx]!.id }, true);
        }
        useEngine.setState(patch);
        // Progressive loading: current + next section's assets.
        s.request([...sections[idx]!.requires, ...(sections[idx + 1]?.requires ?? [])]);
        setProgress(at / n);
      },
    });
    return () => { tween.scrollTrigger?.kill(); tween.kill(); };
  }, [n, sections, vehicle.slug]);

  // Once the exterior is in, warm the remaining systems on capable devices.
  useEffect(() => {
    if (!loaded.includes('exterior')) return;
    if (useEngine.getState().quality === 'low') return;
    const id = setTimeout(() => useEngine.getState().request(Object.keys(manifest.assets) as never), 1200);
    return () => clearTimeout(id);
  }, [loaded, manifest]);

  const goTo = (i: number) => {
    const el = container.current;
    if (!el) return;
    const top = el.getBoundingClientRect().top + scrollY + ((i + 0.02) * S * innerHeight) / 100;
    scrollTo({ top, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  };

  const toggleFree = () => {
    const s = useEngine.getState();
    if (s.mode === 'orbit') useEngine.setState({ mode: 'story' });
    else useEngine.setState({ mode: 'orbit', staticPose: structuredClone(sampleTimeline(manifest.story.keyframes, s.storyAt)) });
  };

  const componentsBySystem = useMemo(() => {
    const ids = new Set(manifest.components.map((c) => c.id));
    return (systems: string[]) => vehicle.components.filter((c: ComponentInfo) => systems.includes(c.system) && ids.has(c.id));
  }, [manifest, vehicle.components]);

  return (
    <div ref={container} className="relative" style={{ height: `${n * S + 100}svh` }}>
      <div className="sticky top-0 h-[100svh] overflow-hidden">
        {storeManifest === manifest && <VehicleScene manifest={manifest} className="absolute inset-0" label={`${vehicle.brand} ${vehicle.model} — интерактив 3D харагдац. Хэсэг бүрийн эд ангийн жагсаалтаас сонгож үзнэ үү.`} />}
        <LoadingVeil label={`${vehicle.model} ачаалж байна`} />
        <div className="pointer-events-none absolute inset-x-0 top-16 z-10 h-px bg-line"><div className="h-px bg-accent" style={{ width: `${progress * 100}%` }} /></div>

        <nav aria-label="Хэсгүүд" className="pointer-events-auto absolute left-6 top-1/2 z-10 hidden -translate-y-1/2 lg:block">
          <ol className="space-y-1">
            {sections.map((s, i) => (
              <li key={s.id}>
                <button onClick={() => goTo(i)} aria-current={i === sectionIndex ? 'step' : undefined}
                  className={`group flex items-center gap-3 py-1.5 text-left transition-colors ${i === sectionIndex ? 'text-fg' : 'text-mute hover:text-fg-2'}`}>
                  <span className={`block h-px transition-all duration-500 ${i === sectionIndex ? 'w-8 bg-accent' : 'w-4 bg-line-strong group-hover:w-6'}`} />
                  <span className="tech text-[0.6875rem]">{s.index}</span>
                  <span className={`text-[0.75rem] tracking-wide transition-opacity ${i === sectionIndex ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>{s.kicker}</span>
                </button>
              </li>
            ))}
          </ol>
        </nav>

        <div className="pointer-events-auto absolute right-4 top-20 z-10 flex flex-col items-end gap-3 sm:right-6">
          <button onClick={toggleFree} className="btn-ghost h-9 bg-ink/60 px-4 text-[0.75rem]" aria-pressed={mode === 'orbit'}>{mode === 'orbit' ? 'Хөтөлбөрт аялал руу буцах' : 'Чөлөөтэй харах'}</button>
          {manifest.assetStatus !== 'production' && !selected && <div className="hidden xl:block"><DemoBadge text={manifest.disclaimer} status={manifest.assetStatus} /></div>}
        </div>

        {/* Section copy lives in the sticky stage and cross-fades with the active section. All of it
            stays in the DOM (inactive sections are hidden from assistive tech, not removed). */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 bg-gradient-to-t from-ink via-ink/70 to-transparent pt-24 md:bg-none md:pt-0">
          <div className="relative mx-auto grid px-4 pb-8 sm:px-8 md:pb-14 lg:pl-40">
            {sections.map((s, i) => {
              const pending = s.requires.filter((sys) => !loaded.includes(sys) && !failed[sys]);
              const broken = s.requires.filter((sys) => failed[sys]);
              const comps = componentsBySystem(s.interactiveSystems);
              const active = i === sectionIndex;
              return (
                <section key={s.id} aria-labelledby={`sec-${s.id}`} aria-hidden={!active} inert={!active}
                  className={`col-start-1 row-start-1 max-w-xl self-end transition-[opacity,transform,visibility] duration-700 ease-[var(--ease-out-expo)] ${active ? 'visible translate-y-0 opacity-100' : 'invisible translate-y-4 opacity-0'}`}>
                  <p className="kicker"><span className="text-accent">{s.index}</span> — {s.kicker}</p>
                  <h2 id={`sec-${s.id}`} className="display mt-3 text-[clamp(1.75rem,4.6vw,4rem)] md:mt-4">{s.title}</h2>
                  <p className="mt-3 max-w-md text-sm leading-relaxed text-fg-2 sm:text-base md:mt-4">{s.body}</p>
                  {pending.length > 0 && <p className="mt-3 text-xs text-mute" role="status">{pending.map((p) => SYSTEM_LABEL[p]).join(', ')} загварыг ачаалж байна…</p>}
                  {broken.length > 0 && <p className="mt-3 text-xs text-danger" role="alert">{broken.map((p) => SYSTEM_LABEL[p]).join(', ')} загвар одоогоор ачаалагдахгүй байна.</p>}
                  {i === n - 1 ? (
                    <div className="pointer-events-auto mt-6 flex flex-wrap gap-3 md:mt-8">
                      <Link to={`/vehicles/${vehicle.slug}/configure`} className="btn-primary">Энэ машиныг тохируулах</Link>
                      <a href="#specifications" className="btn-ghost">Үзүүлэлт</a>
                    </div>
                  ) : comps.length > 0 && (
                    <div className="pointer-events-auto -mx-4 mt-4 flex gap-1.5 overflow-x-auto px-4 pb-1 [scrollbar-width:none] md:mx-0 md:mt-6 md:flex-wrap md:overflow-visible md:px-0" aria-label={`${s.kicker} — эд ангиуд`} role="group">
                      {comps.map((c) => (
                        <button key={c.id} onClick={() => useEngine.setState({ selected: c.id })}
                          onMouseEnter={() => useEngine.setState({ hovered: c.id })} onMouseLeave={() => useEngine.setState({ hovered: null })}
                          aria-pressed={selected === c.id}
                          className={`shrink-0 border px-2.5 py-1 text-[0.75rem] transition-colors ${selected === c.id ? 'border-accent text-fg' : 'border-line-strong bg-ink/50 text-fg-2 hover:border-fg/50 hover:text-fg'}`}>
                          {c.name}
                        </button>
                      ))}
                    </div>
                  )}
                </section>
              );
            })}
          </div>
        </div>

        <HoverLabel vehicle={vehicle} />
        <ComponentPanel vehicle={vehicle} manifest={manifest} />
      </div>
    </div>
  );
}

const KEY_FIGURES = ['max_power', 'max_torque', 'towing_braked', 'seats', 'fuel_consumption', 'approach'];
/** The figures buyers compare first, pulled from the (variant-merged) spec sheet when a value exists. */
function KeyFigures({ specs }: { specs: ReturnType<typeof mergeSpecs> }) {
  const all = Object.values(specs).flat();
  const items = KEY_FIGURES.map((k) => all.find((s) => s.key === k && s.value)).filter((s): s is SpecValue => !!s);
  if (!items.length) return null;
  return (
    <dl className="mt-12 grid grid-cols-2 gap-px border hairline bg-line sm:grid-cols-3 xl:grid-cols-6">
      {items.map((s) => (
        <div key={s.key} className="bg-ink p-5">
          <dt className="kicker">{s.label}</dt>
          <dd className="display mt-3 text-lg leading-tight">{s.value?.split(' / ')[0]}{s.unit ? <span className="ml-1 text-sm text-mute">{s.unit}</span> : null}</dd>
          <dd className="mt-2"><StatusBadge status={s.status} /></dd>
        </div>
      ))}
    </dl>
  );
}

function Details({ vehicle }: { vehicle: PublicVehicle }) {
  const [variantId, setVariantId] = useState(vehicle.variants[0]?.id ?? null);
  const [lead, setLead] = useState<LeadType | null>(null);
  const variant = vehicle.variants.find((v) => v.id === variantId);
  const specs = mergeSpecs(vehicle.specifications, variant?.specOverrides);
  const from = formatPrice(startingPrice(vehicle.variants));
  return (
    <>
      <section id="specifications" className="mx-auto max-w-[1600px] scroll-mt-20 px-4 py-24 sm:px-8 sm:py-32" aria-labelledby="specs-h">
        <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="kicker">Техникийн үзүүлэлт</p>
            <h2 id="specs-h" className="display mt-4 text-[clamp(2rem,4.5vw,3.75rem)]">{vehicle.brand} {vehicle.model}</h2>
            <p className="mt-4 max-w-2xl text-sm leading-relaxed text-fg-2">{vehicle.description}</p>
          </div>
          {vehicle.variants.length > 1 && (
            <div role="radiogroup" aria-label="Хувилбар" className="flex flex-wrap gap-px border hairline bg-line">
              {vehicle.variants.map((v) => (
                <button key={v.id} role="radio" aria-checked={v.id === variantId} onClick={() => setVariantId(v.id)}
                  className={`px-4 py-2.5 text-[0.8125rem] transition-colors ${v.id === variantId ? 'bg-fg text-ink' : 'bg-ink text-fg-2 hover:text-fg'}`}>{v.name}</button>
              ))}
            </div>
          )}
        </div>
        <KeyFigures specs={specs} />
        <div className="mt-16"><SpecSheetView specs={specs} /></div>
        <p className="mt-10 max-w-3xl text-xs leading-relaxed text-mute"><StatusBadge status="reference" /> утгууд нь үйлдвэрлэгч, албан ёсны дистрибьютерийн эх сурвалжаас авсан бөгөөд Монгол зах зээл, зэрэглэлд хараахан баталгаажаагүй. Зөвхөн <StatusBadge status="verified" /> утгыг дилер баталгаажуулсан.</p>
      </section>

      {vehicle.variants.length > 0 && (
        <section className="mx-auto max-w-[1600px] px-4 pb-24 sm:px-8" aria-labelledby="variants-h">
          <p className="kicker">Хувилбарууд</p>
          <h2 id="variants-h" className="sr-only">Хувилбарууд</h2>
          <div className="mt-6 grid gap-px border hairline bg-line md:grid-cols-2">
            {vehicle.variants.map((v) => (
              <div key={v.id} className="bg-ink p-8">
                <h3 className="display text-xl">{v.name}</h3>
                <dl className="tech mt-6 space-y-2 text-fg-2">
                  {v.engine && <div className="flex gap-3"><dt className="w-28 text-mute">Хөдөлгүүр</dt><dd>{v.engine}</dd></div>}
                  {v.transmission && <div className="flex gap-3"><dt className="w-28 text-mute">Хайрцаг</dt><dd>{v.transmission}</dd></div>}
                  {v.drivetrain && <div className="flex gap-3"><dt className="w-28 text-mute">Хөтлөгч</dt><dd>{v.drivetrain}</dd></div>}
                </dl>
                <p className="mt-6 text-sm">{formatPrice(v.price != null ? { amount: v.price, currency: v.currency } : null) ?? <span className="text-fg-2">Үнийг лавлана уу</span>}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="border-t hairline">
        <div className="mx-auto flex max-w-[1600px] flex-col gap-8 px-4 py-20 sm:px-8 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="kicker">{from ? `${from}-с эхэлнэ` : 'Үнийг лавлана уу'}</p>
            <p className="display mt-3 text-3xl">{vehicle.model} сонирхож байна уу?</p>
          </div>
          <div className="flex flex-wrap gap-3">
            {vehicle.manifestUrl && <Link to={`/vehicles/${vehicle.slug}/configure`} className="btn-primary">Тохируулах</Link>}
            <button className={vehicle.manifestUrl ? 'btn-ghost' : 'btn-primary'} onClick={() => setLead('quote')}>Үнийн санал авах</button>
            <button className="btn-ghost" onClick={() => setLead('test_drive')}>Туршилтын жолоодлого</button>
          </div>
        </div>
      </section>
      <LeadDialog type={lead} onClose={() => setLead(null)} configuration={{ vehicleSlug: vehicle.slug, variantId, colors: {}, switches: {} }} />
    </>
  );
}

function SpecOnlyHero({ vehicle, reason }: { vehicle: PublicVehicle; reason: string }) {
  return (
    <section className="relative flex min-h-[78svh] items-end overflow-hidden bg-[radial-gradient(120%_80%_at_70%_100%,#1a1a1d_0%,#0a0a0b_65%)]">
      <span aria-hidden className="display-wide pointer-events-none absolute -right-8 top-24 select-none text-[clamp(8rem,26vw,24rem)] text-white/[0.025]">{vehicle.model}</span>
      <div className="relative mx-auto w-full max-w-[1600px] px-4 pb-16 sm:px-8">
        <p className="kicker">{vehicle.brand} · {vehicle.year}{vehicle.generation ? ` · ${vehicle.generation}` : ''}</p>
        <h1 className="display-wide mt-4 text-[clamp(3rem,10vw,9rem)]">{vehicle.model}</h1>
        <p className="mt-6 max-w-lg text-base text-fg-2 sm:text-lg">{vehicle.tagline}</p>
        <p className="tech mt-8 inline-block border border-line-strong px-3 py-2 text-mute">{reason}</p>
      </div>
    </section>
  );
}

export default function VehiclePage() {
  const { slug = '' } = useParams();
  const vehicle = useAsync(() => publicApi.vehicle(slug), [slug]);
  const webgl = useEngineEnvironment();
  const manifest = useManifest(vehicle.status === 'ok' ? vehicle.data.manifestUrl : null);
  useEffect(() => { if (vehicle.status === 'ok') track('vehicle_view', vehicle.data.slug, undefined, true); }, [vehicle]);

  if (vehicle.status === 'loading') return <div className="grid h-[100svh] place-items-center"><Spinner /></div>;
  if (vehicle.status === 'error') {
    return <PageShell><ErrorState title={vehicle.error === 'Машин олдсонгүй' ? 'Машин олдсонгүй' : 'Машиныг ачаалж чадсангүй'} message={vehicle.error === 'Машин олдсонгүй' ? 'Энэ машин энэ дилерийн каталогт байхгүй байна.' : vehicle.error} onRetry={vehicle.error === 'Машин олдсонгүй' ? undefined : vehicle.retry} /></PageShell>;
  }
  const v = vehicle.data;
  const reason = !v.manifestUrl ? 'Интерактив 3D удахгүй нээгдэнэ'
    : !webgl.ok ? webgl.reason
    : manifest.status === 'error' ? `3D нээгдсэнгүй: ${manifest.error}` : null;

  return (
    <>
      <Nav overlay />
      <main>
        {reason ? <SpecOnlyHero vehicle={v} reason={reason} />
          : manifest.status === 'ok' && manifest.data ? <Story vehicle={v} manifest={manifest.data} />
          : <div className="grid h-[100svh] place-items-center"><Spinner /></div>}
        {!webgl.ok && v.manifestUrl && <div className="sr-only"><NoWebGL reason={webgl.reason} /></div>}
        <Details vehicle={v} />
      </main>
      <Footer />
    </>
  );
}

