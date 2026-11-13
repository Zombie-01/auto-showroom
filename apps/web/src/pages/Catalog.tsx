import { useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { publicApi, type CatalogVehicle } from '../lib/api';
import { useAsync } from '../lib/hooks';
import { formatPrice } from '../lib/tenant';
import { ErrorState, PageShell, Spinner } from '../components/ui';

/** Brands shown as categories even when a dealer has no models for them yet. */
export const BRANDS = ['Toyota', 'Lexus', 'Jetour', 'BYD'];

function Poster({ v }: { v: CatalogVehicle }) {
  const [failed, setFailed] = useState(false);
  if (v.posterUrl && !failed) {
    return <img src={v.posterUrl} alt="" loading="lazy" decoding="async" onError={() => setFailed(true)} className="absolute inset-0 h-full w-full object-cover transition-transform duration-[1.2s] ease-[var(--ease-out-expo)] group-hover:scale-[1.03]" />;
  }
  return (
    <div className="absolute inset-0 flex items-end bg-[radial-gradient(120%_80%_at_50%_100%,#1b1b1f_0%,#0d0d0f_60%)] p-6">
      <span className="display-wide select-none text-[clamp(3rem,8vw,6rem)] text-white/[0.04]" aria-hidden>{v.model}</span>
    </div>
  );
}

export function VehicleCard({ v }: { v: CatalogVehicle }) {
  const price = formatPrice(v.startingPrice);
  return (
    <Link to={`/vehicles/${v.slug}`} className="group block focus-visible:outline-offset-4" aria-label={`${v.brand} ${v.model} — дэлгэрэнгүй`}>
      <div className="relative aspect-[16/10] overflow-hidden border hairline bg-ink-2">
        <Poster v={v} />
        <span className="tech absolute left-4 top-4 text-[0.625rem] uppercase tracking-[0.16em] text-fg-2">{v.has3d ? 'Интерактив 3D' : '3D удахгүй'}</span>
      </div>
      <div className="mt-5 flex items-start justify-between gap-6">
        <div>
          <p className="kicker">{v.brand} · {v.year}</p>
          <h3 className="display mt-2 text-2xl">{v.model}</h3>
          {v.generation && <p className="mt-1 text-sm text-mute">{v.generation}</p>}
        </div>
        <div className="text-right">
          <p className="kicker">Үнэ</p>
          <p className="mt-2 text-sm">{price ?? <span className="text-fg-2">Үнийг лавлана уу</span>}</p>
        </div>
      </div>
      <span className="mt-5 inline-flex items-center gap-2 text-[0.8125rem] text-fg-2 transition-colors group-hover:text-fg">Дэлгэрэнгүй <span aria-hidden className="transition-transform group-hover:translate-x-1">→</span></span>
    </Link>
  );
}

export function CatalogGrid({ vehicles, brand }: { vehicles: CatalogVehicle[]; brand: string | null }) {
  const list = brand ? vehicles.filter((v) => v.brand.toLowerCase() === brand.toLowerCase()) : vehicles;
  if (!list.length) {
    return <p className="border-y hairline py-16 text-center text-sm text-fg-2">{brand ? `Энэ дилер ${brand} брэндийн загвар хараахан нэмээгүй байна.` : 'Нийтлэгдсэн машин алга байна.'}</p>;
  }
  return <div className="grid gap-x-8 gap-y-16 md:grid-cols-2 xl:grid-cols-3">{list.map((v) => <VehicleCard key={v.id} v={v} />)}</div>;
}

export function CatalogPage() {
  const state = useAsync(() => publicApi.vehicles(), []);
  const [params, setParams] = useSearchParams();
  const brand = params.get('brand');
  const brands = state.status === 'ok' ? [...new Set([...BRANDS, ...state.data.map((v) => v.brand)])] : BRANDS;
  return (
    <PageShell>
      <div className="mx-auto max-w-[1600px] px-4 pb-24 pt-16 sm:px-8 sm:pt-24">
        <p className="kicker">Загварууд</p>
        <h1 className="display-wide mt-4 text-[clamp(2.5rem,7vw,6rem)]">Машинууд</h1>
        <div role="tablist" aria-label="Брэндээр шүүх" className="mt-12 flex flex-wrap gap-x-1 border-b hairline">
          {[null, ...brands].map((b) => (
            <button key={b ?? 'all'} role="tab" aria-selected={brand === b}
              onClick={() => setParams(b ? { brand: b } : {})}
              className={`-mb-px border-b px-4 py-3 text-[0.8125rem] tracking-wide transition-colors ${brand === b ? 'border-fg text-fg' : 'border-transparent text-mute hover:text-fg'}`}>
              {b ?? 'Бүгд'}
            </button>
          ))}
        </div>
        <div className="mt-14">
          {state.status === 'loading' && <Spinner />}
          {state.status === 'error' && <ErrorState title="Машинуудыг ачаалж чадсангүй" message={state.error} onRetry={state.retry} />}
          {state.status === 'ok' && <CatalogGrid vehicles={state.data} brand={brand} />}
        </div>
      </div>
    </PageShell>
  );
}
