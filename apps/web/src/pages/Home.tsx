import { useEffect } from 'react';
import { Link } from 'react-router';
import type { VehicleManifest } from '@showroom/shared';
import { VehicleScene } from '../engine/VehicleScene';
import { useEngine } from '../engine/store';
import { sampleTimeline } from '../engine/timeline';
import { publicApi, type CatalogVehicle } from '../lib/api';
import { useAsync } from '../lib/hooks';
import { useTenant } from '../lib/tenant';
import { DemoBadge, Footer, Nav, Spinner } from '../components/ui';
import { CatalogGrid } from './Catalog';
import { LoadingVeil, NoWebGL, useEngineEnvironment, useManifest } from '../components/Stage';

function heroPose(m: VehicleManifest) {
  const base = sampleTimeline(m.story.keyframes, 0);
  return { ...base, position: m.hero.position, target: m.hero.target, fov: m.hero.fov, yaw: -0.6 };
}

function Hero({ featured }: { featured: CatalogVehicle | undefined }) {
  const webgl = useEngineEnvironment();
  const manifest = useManifest(featured?.manifestUrl);

  useEffect(() => {
    if (manifest.status !== 'ok' || !manifest.data || !featured) return;
    const m = manifest.data;
    useEngine.getState().reset();
    useEngine.setState({ manifest: m, manifestUrl: featured.manifestUrl, mode: 'turntable', staticPose: heroPose(m), requested: ['exterior'], interactive: [], reducedMotion: matchMedia('(prefers-reduced-motion: reduce)').matches });
  }, [manifest, featured]);

  const storeManifest = useEngine((s) => s.manifest);
  const ready = manifest.status === 'ok' && manifest.data && storeManifest === manifest.data;
  return (
    <section className="relative h-[100svh] min-h-[560px] overflow-hidden" aria-label="Онцлох машин">
      <div className="absolute inset-0">
        {!webgl.ok ? <NoWebGL reason={webgl.reason} /> :
          manifest.status === 'ok' && manifest.data && ready ? (
            <>
              <VehicleScene manifest={manifest.data} className="h-full w-full" label={`${featured!.brand} ${featured!.model} — эргэлдэх 3D харагдац`} />
              <LoadingVeil label="Шоурумыг бэлтгэж байна" />
            </>
          ) : manifest.status === 'error' ? <NoWebGL reason={manifest.error} /> : <div className="grid h-full place-items-center"><Spinner /></div>}
      </div>
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-ink via-ink/40 to-transparent" />

      {featured && (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 mx-auto max-w-[1600px] px-4 pb-20 sm:px-8 sm:pb-24">
          <p className="kicker fade-up">{featured.brand} · {featured.year}{featured.generation ? ` · ${featured.generation}` : ''}</p>
          <h1 className="display-wide fade-up mt-4 text-[clamp(3rem,11vw,10.5rem)]" style={{ animationDelay: '80ms' }}>{featured.model}</h1>
          <div className="mt-8 flex flex-col gap-8 sm:flex-row sm:items-end sm:justify-between">
            <p className="fade-up max-w-md text-base leading-relaxed text-fg-2 sm:text-lg" style={{ animationDelay: '160ms' }}>{featured.tagline}</p>
            <div className="pointer-events-auto fade-up flex gap-3" style={{ animationDelay: '240ms' }}>
              <Link to={`/vehicles/${featured.slug}`} className="btn-primary">Машиныг судлах</Link>
              {featured.has3d && <Link to={`/vehicles/${featured.slug}/configure`} className="btn-ghost">Тохируулах</Link>}
            </div>
          </div>
        </div>
      )}
      {manifest.status === 'ok' && manifest.data && manifest.data.assetStatus !== 'production' && (
        <div className="pointer-events-auto absolute right-4 top-20 hidden sm:right-8 md:block"><DemoBadge text={manifest.data.disclaimer} status={manifest.data.assetStatus} /></div>
      )}
      <div className="pointer-events-none absolute bottom-6 left-1/2 flex -translate-x-1/2 flex-col items-center gap-2" aria-hidden>
        <span className="kicker text-[0.625rem]">Гүйлгэх</span>
        <span className="relative block h-8 w-px overflow-hidden bg-line-strong"><span className="scroll-cue absolute inset-0 bg-fg" /></span>
      </div>
    </section>
  );
}

export default function HomePage() {
  const tenant = useTenant();
  const vehicles = useAsync(() => publicApi.vehicles(), []);
  const featured = vehicles.status === 'ok' ? (vehicles.data.find((v) => v.has3d) ?? vehicles.data[0]) : undefined;

  return (
    <>
      <Nav overlay />
      <main>
        <Hero featured={featured} />
        {featured?.has3d === false && <p className="sr-only">Интерактив 3D машин хараахан алга.</p>}

        <section className="mx-auto max-w-[1600px] px-4 py-24 sm:px-8 sm:py-32" aria-labelledby="how">
          <p className="kicker">Хэрхэн ажилладаг вэ</p>
          <h2 id="how" className="display mt-4 max-w-3xl text-[clamp(2rem,4.5vw,3.75rem)]">Шоурумд ирэхээсээ өмнө машинаа бүрэн танина уу.</h2>
          <ol className="mt-16 grid gap-px border hairline bg-line md:grid-cols-3">
            {[
              ['01', 'Систем бүрийг судлах', 'Гадна тал, хөдөлгүүр, хүч дамжуулалт, явах эд анги, салоныг гүйлгэн үзэж, эд анги бүрийг сонгон үүргийг нь мэдээрэй.'],
              ['02', 'Өөрийнхөөрөө тохируулах', 'Их бие, обуд, дотор заслын өнгийг шууд сольж, тохиргоогоо хадгалах эсвэл хуваалцаарай.'],
              ['03', 'Дилертэй холбогдох', `Тохиргоогоо ${tenant?.branding.displayName ?? 'дилер'}-т илгээж үнийн санал эсвэл туршилтын жолоодлого захиалаарай.`],
            ].map(([n, t, d]) => (
              <li key={n} className="bg-ink p-8 sm:p-10">
                <span className="tech text-mute">{n}</span>
                <h3 className="display mt-10 text-xl">{t}</h3>
                <p className="mt-3 text-sm leading-relaxed text-fg-2">{d}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className="mx-auto max-w-[1600px] px-4 pb-32 sm:px-8" aria-labelledby="lineup">
          <div className="mb-14 flex items-end justify-between gap-6">
            <div><p className="kicker">Загварууд</p><h2 id="lineup" className="display mt-4 text-[clamp(2rem,4.5vw,3.75rem)]">Боломжит машинууд</h2></div>
            <Link to="/vehicles" className="btn-quiet hidden sm:inline-flex">Бүх машин →</Link>
          </div>
          {vehicles.status === 'ok' ? <CatalogGrid vehicles={vehicles.data} brand={null} /> : vehicles.status === 'loading' ? <Spinner /> : <p className="text-sm text-danger">{vehicles.error}</p>}
        </section>
      </main>
      <Footer />
    </>
  );
}
