import { useSearchParams } from 'react-router';
import { SPEC_CATEGORIES, startingPrice, type SpecValue } from '@showroom/shared';
import { publicApi } from '../lib/api';
import { useAsync } from '../lib/hooks';
import { formatPrice } from '../lib/tenant';
import { ErrorState, PageShell, Spinner, StatusBadge } from '../components/ui';

const MAX = 3;
const LABEL: Record<string, string> = { engine: 'Хөдөлгүүр', transmission: 'Хүч дамжуулалт', dimensions: 'Хэмжээ', capacity: 'Багтаамж ба чирэх', performance: 'Гүйцэтгэл ба зарцуулалт', offroad: 'Бартаат зам', safety: 'Аюулгүй байдал', comfort: 'Тав тух ба тоноглол', multimedia: 'Мультимедиа', ownership: 'Баталгаа ба үйлчилгээ' };

export default function ComparePage() {
  const [params, setParams] = useSearchParams();
  const slugs = (params.get('v') ?? '').split(',').filter(Boolean).slice(0, MAX);
  const catalog = useAsync(() => publicApi.vehicles(), []);
  const details = useAsync(() => Promise.all(slugs.map((s) => publicApi.vehicle(s))), [slugs.join(',')]);
  const toggle = (slug: string) => {
    const next = slugs.includes(slug) ? slugs.filter((s) => s !== slug) : [...slugs, slug].slice(-MAX);
    setParams(next.length ? { v: next.join(',') } : {});
  };

  return (
    <PageShell>
      <div className="mx-auto max-w-[1600px] px-4 pb-24 pt-16 sm:px-8 sm:pt-24">
        <p className="kicker">Харьцуулах</p>
        <h1 className="display-wide mt-4 text-[clamp(2.5rem,7vw,6rem)]">Зэрэгцүүлэн харьцуулах</h1>
        <p className="mt-6 max-w-xl text-sm text-fg-2">{MAX} хүртэл машин сонгоно уу. Утга бүрийн баталгаажсан эсэхийг харуулна.</p>

        <div className="mt-10 flex flex-wrap gap-2" role="group" aria-label="Харьцуулах машинууд">
          {catalog.status === 'ok' && catalog.data.map((v) => (
            <button key={v.slug} aria-pressed={slugs.includes(v.slug)} onClick={() => toggle(v.slug)}
              className={`border px-4 py-2.5 text-[0.8125rem] transition-colors ${slugs.includes(v.slug) ? 'border-fg bg-fg text-ink' : 'border-line-strong text-fg-2 hover:text-fg'}`}>
              {v.brand} {v.model}
            </button>
          ))}
          {catalog.status === 'loading' && <Spinner />}
        </div>

        <div className="mt-16">
          {slugs.length === 0 ? <p className="border-y hairline py-16 text-center text-sm text-fg-2">Үзүүлэлтийг харьцуулахын тулд дээрээс машин сонгоно уу.</p>
            : details.status === 'loading' ? <Spinner />
            : details.status === 'error' ? <ErrorState title="Машинуудыг ачаалж чадсангүй" message={details.error} onRetry={details.retry} />
            : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] border-collapse text-sm">
                  <caption className="sr-only">Үзүүлэлтийн харьцуулалт</caption>
                  <thead>
                    <tr className="border-b border-line-strong">
                      <th scope="col" className="w-1/4 py-4 text-left font-normal"><span className="kicker">Үзүүлэлт</span></th>
                      {details.data.map((v) => (
                        <th key={v.slug} scope="col" className="py-4 pr-6 text-left align-bottom font-normal">
                          <span className="kicker block">{v.brand}</span>
                          <span className="display mt-2 block text-xl">{v.model}</span>
                          <span className="mt-1 block text-fg-2">{formatPrice(startingPrice(v.variants)) ?? 'Үнийг лавлана уу'}</span>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  {SPEC_CATEGORIES.map((cat) => {
                    const keys: { key: string; label: string }[] = [];
                    for (const v of details.data) for (const s of v.specifications[cat] ?? []) if (!keys.some((k) => k.key === s.key)) keys.push({ key: s.key, label: s.label });
                    if (!keys.length) return null;
                    return (
                      <tbody key={cat}>
                        <tr><th colSpan={details.data.length + 1} scope="colgroup" className="pb-2 pt-10 text-left font-normal"><span className="kicker text-fg-2">{LABEL[cat]}</span></th></tr>
                        {keys.map((k) => (
                          <tr key={k.key} className="border-b hairline">
                            <th scope="row" className="py-3.5 pr-4 text-left font-normal text-fg-2">{k.label}</th>
                            {details.data.map((v) => {
                              const s: SpecValue | undefined = v.specifications[cat]?.find((x) => x.key === k.key);
                              return (
                                <td key={v.slug} className="py-3.5 pr-6 align-top">
                                  {s?.value ? <span>{s.value}{s.unit ? <span className="text-mute"> {s.unit}</span> : null}</span> : <span className="text-mute">Мэдээлэлгүй</span>}
                                  {s && <span className="ml-2 align-middle"><StatusBadge status={s.status} /></span>}
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                    );
                  })}
                </table>
              </div>
            )}
        </div>
      </div>
    </PageShell>
  );
}
