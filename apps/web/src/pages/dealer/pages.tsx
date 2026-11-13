import { Fragment, useState, type FormEvent, type ReactNode } from 'react';
import { lintManifest, resolveAssetUrl, SPEC_CATEGORIES, VehicleManifest, type Branding, type Contact, type SpecSheet, type SpecValue, type Variant, type VehicleColor, type VehicleInput } from '@showroom/shared';
import { api, ApiError } from '../../lib/api';
import { useAsync, type Async } from '../../lib/hooks';
import { formatPrice } from '../../lib/tenant';
import { Spinner, StatusBadge } from '../../components/ui';
import type { DealerUser } from './DealerApp';

// --- Types & helpers -------------------------------------------------------------------------
type DVehicle = VehicleInput & { id: string; updatedAt: string };
type DVehicleDetail = DVehicle & { variants: Variant[]; colors: VehicleColor[]; inventory: InventoryItem[] };
interface InventoryItem { id: string; vehicleId: string; variantId: string | null; colorName: string; vin: string | null; status: 'in_stock' | 'incoming' | 'reserved' | 'sold'; quantity: number; notes: string }
interface Lead { id: string; type: string; status: string; name: string; phone: string; email: string | null; preferredContact: string; message: string | null; summary: { label: string; value: string }[]; estimatedPrice: number | null; currency: string | null; notes: string; createdAt: string; vehicle: string | null }

const LEAD_STATUS: Record<string, string> = { new: 'Шинэ', contacted: 'Холбогдсон', qualified: 'Боломжит', won: 'Амжилттай', lost: 'Алдсан' };
const LEAD_TYPE: Record<string, string> = { quote: 'Үнийн санал', contact: 'Холбоо барих', test_drive: 'Туршилтын жолоодлого' };
const EVENT_LABEL: Record<string, string> = { vehicle_view: 'Машин үзсэн', section_view: 'Хэсэг үзсэн', component_select: 'Эд анги сонгосон', configurator_open: 'Тохируулагч нээсэн', configuration_saved: 'Тохиргоо хадгалсан', lead_submitted: 'Хүсэлт илгээсэн', screenshot: 'Зураг авсан' };
const dt = (d: string) => new Date(d).toLocaleString('mn-MN');
const errText = (e: unknown) => e instanceof ApiError ? (e.issues?.length ? `${e.message}: ${e.issues.map((i) => `${i.path || 'field'} — ${i.message}`).join('; ')}` : e.message) : e instanceof Error ? e.message : 'Амжилтгүй';

function Header({ title, kicker, children }: { title: string; kicker?: string; children?: ReactNode }) {
  return (
    <div className="mb-8 flex flex-col gap-4 border-b hairline pb-6 sm:flex-row sm:items-end sm:justify-between">
      <div>{kicker && <p className="kicker">{kicker}</p>}<h1 className="display mt-2 text-3xl">{title}</h1></div>
      {children && <div className="flex flex-wrap gap-2">{children}</div>}
    </div>
  );
}
function Loadable<T>({ state, children }: { state: Async<T>; children: (d: T) => ReactNode }) {
  if (state.status === 'loading') return <Spinner />;
  if (state.status === 'error') return <div role="alert" className="text-sm text-danger">{state.error} <button className="underline" onClick={state.retry}>Дахин оролдох</button></div>;
  return <>{children(state.data)}</>;
}
function useMessage() {
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  return {
    node: msg && <p role={msg.ok ? 'status' : 'alert'} className={`text-sm ${msg.ok ? 'text-ok' : 'text-danger'}`}>{msg.text}</p>,
    ok: (text: string) => { setMsg({ ok: true, text }); setTimeout(() => setMsg(null), 2500); },
    fail: (e: unknown) => setMsg({ ok: false, text: errText(e) }),
  };
}
const Table = ({ head, children }: { head: string[]; children: ReactNode }) => (
  <div className="overflow-x-auto border hairline">
    <table className="w-full min-w-[640px] text-sm">
      <thead className="bg-ink-2"><tr>{head.map((h) => <th key={h} scope="col" className="kicker px-4 py-3 text-left font-normal">{h}</th>)}</tr></thead>
      <tbody className="divide-y divide-line">{children}</tbody>
    </table>
  </div>
);
const Td = ({ children, className = '' }: { children: ReactNode; className?: string }) => <td className={`px-4 py-3 align-top ${className}`}>{children}</td>;
const num = (v: FormDataEntryValue | null) => (v === null || String(v).trim() === '' ? null : Number(v));

function useVehicles() { return useAsync(() => api<DVehicle[]>('/api/dealer/vehicles'), []); }
function VehiclePicker({ vehicles, value, onChange }: { vehicles: DVehicle[]; value: string | null; onChange: (id: string) => void }) {
  return (
    <label className="block max-w-sm"><span className="label">Машин</span>
      <select className="field" value={value ?? ''} onChange={(e) => onChange(e.target.value)}>
        {vehicles.map((v) => <option key={v.id} value={v.id}>{v.brand} {v.model} ({v.year})</option>)}
      </select>
    </label>
  );
}
/** Pick a vehicle, then load its detail. */
function WithVehicle({ children }: { children: (v: DVehicleDetail, reload: () => void) => ReactNode }) {
  const list = useVehicles();
  const [id, setId] = useState<string | null>(null);
  const [n, setN] = useState(0);
  const selected = id ?? (list.status === 'ok' ? list.data[0]?.id ?? null : null);
  const detail = useAsync(() => (selected ? api<DVehicleDetail>(`/api/dealer/vehicles/${selected}`) : Promise.resolve(null)), [selected, n]);
  return (
    <Loadable state={list}>{(vs) => vs.length === 0 ? <p className="text-sm text-fg-2">Эхлээд машин нэмнэ үү.</p> : (
      <>
        <VehiclePicker vehicles={vs} value={selected} onChange={setId} />
        <div className="mt-8"><Loadable state={detail}>{(d) => d && children(d, () => setN((x) => x + 1))}</Loadable></div>
      </>
    )}</Loadable>
  );
}

// --- Overview --------------------------------------------------------------------------------
export function Overview() {
  const s = useAsync(() => api<{ vehicles: number; newLeads: number; leads30: number; views30: number; recentLeads: Lead[] }>('/api/dealer/overview'), []);
  return (
    <>
      <Header kicker="Самбар" title="Тойм" />
      <Loadable state={s}>{(d) => (
        <>
          <div className="grid gap-px border hairline bg-line sm:grid-cols-2 xl:grid-cols-4">
            {[['Шинэ хүсэлт', d.newLeads], ['Хүсэлт (30 хоног)', d.leads30], ['Машин үзсэн (30 хоног)', d.views30], ['Машинууд', d.vehicles]].map(([l, v]) => (
              <div key={l as string} className="bg-ink p-6"><p className="kicker">{l}</p><p className="display mt-4 text-4xl">{v}</p></div>
            ))}
          </div>
          <h2 className="kicker mb-3 mt-12">Сүүлийн хүсэлтүүд</h2>
          {d.recentLeads.length === 0 ? <p className="text-sm text-fg-2">Хүсэлт алга байна.</p> : (
            <Table head={['Хүлээн авсан', 'Харилцагч', 'Төрөл', 'Төлөв', 'Машин']}>
              {d.recentLeads.map((l) => <tr key={l.id}><Td>{dt(l.createdAt)}</Td><Td>{l.name}</Td><Td>{LEAD_TYPE[l.type] ?? l.type}</Td><Td>{LEAD_STATUS[l.status] ?? l.status}</Td><Td>{l.summary[0]?.value ?? '—'}</Td></tr>)}
            </Table>
          )}
        </>
      )}</Loadable>
    </>
  );
}

// --- Vehicles --------------------------------------------------------------------------------
function VehicleForm({ initial, onSubmit, submitLabel }: { initial?: Partial<DVehicle>; onSubmit: (v: Partial<VehicleInput>) => Promise<void>; submitLabel: string }) {
  const m = useMessage();
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    try {
      await onSubmit({
        brand: String(f.get('brand')), model: String(f.get('model')), slug: String(f.get('slug')), year: Number(f.get('year')),
        generation: String(f.get('generation') || '') || null, tagline: String(f.get('tagline') ?? ''), description: String(f.get('description') ?? ''),
        status: f.get('status') === 'published' ? 'published' : 'draft', sortOrder: Number(f.get('sortOrder') ?? 0),
      });
      m.ok('Хадгаллаа');
    } catch (err) { m.fail(err); }
  }
  return (
    <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
      <label><span className="label">Брэнд</span><input name="brand" required defaultValue={initial?.brand} className="field" /></label>
      <label><span className="label">Загвар</span><input name="model" required defaultValue={initial?.model} className="field" /></label>
      <label><span className="label">URL нэр</span><input name="slug" required pattern="[a-z0-9-]+" defaultValue={initial?.slug} className="field" /></label>
      <label><span className="label">Үйлдвэрлэсэн он</span><input name="year" type="number" required min={1950} max={2100} defaultValue={initial?.year ?? new Date().getFullYear()} className="field" /></label>
      <label><span className="label">Үе</span><input name="generation" defaultValue={initial?.generation ?? ''} className="field" /></label>
      <label><span className="label">Төлөв</span><select name="status" defaultValue={initial?.status ?? 'draft'} className="field"><option value="draft">Ноорог</option><option value="published">Нийтлэгдсэн</option></select></label>
      <label className="sm:col-span-2"><span className="label">Уриа</span><input name="tagline" maxLength={160} defaultValue={initial?.tagline} className="field" /></label>
      <label className="sm:col-span-2"><span className="label">Тайлбар</span><textarea name="description" rows={3} maxLength={4000} defaultValue={initial?.description} className="field h-auto py-2" /></label>
      <label><span className="label">Эрэмбэ</span><input name="sortOrder" type="number" defaultValue={initial?.sortOrder ?? 0} className="field" /></label>
      <div className="flex items-end gap-4 sm:col-span-2"><button className="btn-primary">{submitLabel}</button>{m.node}</div>
    </form>
  );
}
export function Vehicles({ me }: { me: DealerUser }) {
  const [n, setN] = useState(0);
  const list = useAsync(() => api<DVehicle[]>('/api/dealer/vehicles'), [n]);
  const [editing, setEditing] = useState<string | 'new' | null>(null);
  const m = useMessage();
  return (
    <>
      <Header kicker="Каталог" title="Машинууд"><button className="btn-primary" onClick={() => setEditing('new')}>Машин нэмэх</button></Header>
      {editing === 'new' && <div className="panel mb-8 p-6"><VehicleForm submitLabel="Машин үүсгэх" onSubmit={async (v) => { await api('/api/dealer/vehicles', { method: 'POST', json: v }); setEditing(null); setN((x) => x + 1); }} /></div>}
      {m.node}
      <Loadable state={list}>{(vs) => (
        <Table head={['Машин', 'Он', 'Төлөв', '3D', '']}>
          {vs.map((v) => (
            <Fragment key={v.id}>
              <tr>
                <Td><span className="text-fg">{v.brand} {v.model}</span><span className="tech block text-mute">/{v.slug}</span></Td>
                <Td>{v.year}</Td>
                <Td><span className={v.status === 'published' ? 'text-ok' : 'text-mute'}>{v.status}</span></Td>
                <Td>{v.manifestUrl ? 'Манифест бий' : <span className="text-mute">Байхгүй</span>}</Td>
                <Td className="text-right whitespace-nowrap">
                  <button className="btn-quiet h-8" onClick={() => setEditing(editing === v.id ? null : v.id)}>{editing === v.id ? 'Хаах' : 'Засах'}</button>
                  {me.role === 'owner' && <button className="btn-quiet h-8 text-danger" onClick={async () => { if (!confirm(`${v.model}-г устгах уу? Түүний хувилбар, өнгө, агуулахын бүртгэл устна.`)) return; try { await api(`/api/dealer/vehicles/${v.id}`, { method: 'DELETE' }); setN((x) => x + 1); } catch (e) { m.fail(e); } }}>Устгах</button>}
                </Td>
              </tr>
              {editing === v.id && <tr><td colSpan={5} className="bg-ink-2 p-6"><VehicleForm initial={v} submitLabel="Өөрчлөлт хадгалах" onSubmit={async (x) => { await api(`/api/dealer/vehicles/${v.id}`, { method: 'PATCH', json: x }); setN((y) => y + 1); }} /></td></tr>}
            </Fragment>
          ))}
        </Table>
      )}</Loadable>
    </>
  );
}

// --- Variants & pricing ----------------------------------------------------------------------
function VariantRow({ v, onChange }: { v: Variant; onChange: () => void }) {
  const m = useMessage();
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    try {
      await api(`/api/dealer/variants/${v.id}`, { method: 'PATCH', json: { name: f.get('name'), engine: f.get('engine'), transmission: f.get('transmission'), drivetrain: f.get('drivetrain') } });
      m.ok('Хадгаллаа'); onChange();
    } catch (err) { m.fail(err); }
  }
  return (
    <form onSubmit={submit} className="grid gap-3 border-b hairline py-5 sm:grid-cols-[1fr_1fr_1fr_1fr_auto]">
      <input aria-label="Нэр" name="name" defaultValue={v.name} className="field" required />
      <input aria-label="Хөдөлгүүр" name="engine" defaultValue={v.engine} className="field" placeholder="Хөдөлгүүр" />
      <input aria-label="Хайрцаг" name="transmission" defaultValue={v.transmission} className="field" placeholder="Хайрцаг" />
      <input aria-label="Хөтлөгч" name="drivetrain" defaultValue={v.drivetrain} className="field" placeholder="Хөтлөгч" />
      <div className="flex items-center gap-2"><button className="btn-ghost h-11">Хадгалах</button>
        <button type="button" className="btn-quiet h-11 text-danger" onClick={async () => { if (confirm(`${v.name} хувилбарыг устгах уу?`)) { await api(`/api/dealer/variants/${v.id}`, { method: 'DELETE' }); onChange(); } }}>Устгах</button></div>
      <div className="sm:col-span-5">{m.node}</div>
    </form>
  );
}
export function Variants() {
  return (
    <>
      <Header kicker="Каталог" title="Хувилбарууд" />
      <WithVehicle>{(v, reload) => (
        <>
          {v.variants.length === 0 && <p className="text-sm text-fg-2">Хувилбар алга байна.</p>}
          {v.variants.map((x) => <VariantRow key={x.id} v={x} onChange={reload} />)}
          <form className="mt-6 flex gap-3" onSubmit={async (e) => { e.preventDefault(); const f = new FormData(e.currentTarget); await api(`/api/dealer/vehicles/${v.id}/variants`, { method: 'POST', json: { name: f.get('name') } }); e.currentTarget.reset(); reload(); }}>
            <input name="name" required placeholder="Шинэ хувилбарын нэр" className="field max-w-xs" aria-label="Шинэ хувилбарын нэр" /><button className="btn-primary">Хувилбар нэмэх</button>
          </form>
        </>
      )}</WithVehicle>
    </>
  );
}
export function Pricing() {
  const m = useMessage();
  return (
    <>
      <Header kicker="Худалдаа" title="Үнэ" />
      <p className="-mt-4 mb-8 max-w-2xl text-sm text-fg-2">Үнийг энд оруулсан тохиолдолд л хэрэглэгчид харагдана. Хоосон үлдээвэл “Үнийг лавлана уу” гэж харагдана. Тооцоолсон үнийг үргэлж сервер эдгээр утгаас бодно.</p>
      <WithVehicle>{(v, reload) => (
        <>
          <Table head={['Хувилбар', 'Үнэ', 'Валют', '']}>
            {v.variants.map((x) => (
              <tr key={x.id}><td colSpan={4} className="p-0">
                <form className="grid grid-cols-[1.5fr_1fr_100px_auto] items-center gap-3 px-4 py-3" onSubmit={async (e) => { e.preventDefault(); const f = new FormData(e.currentTarget); try { await api(`/api/dealer/variants/${x.id}`, { method: 'PATCH', json: { price: num(f.get('price')), currency: String(f.get('currency')).toUpperCase() } }); m.ok('Үнэ хадгалагдлаа'); reload(); } catch (err) { m.fail(err); } }}>
                  <span>{x.name}<span className="block text-xs text-mute">{formatPrice(x.price != null ? { amount: x.price, currency: x.currency } : null) ?? 'Үнийг лавлана уу'}</span></span>
                  <input name="price" type="number" min={0} step="any" defaultValue={x.price ?? ''} placeholder="Лавлана уу" className="field" aria-label={`${x.name} price`} />
                  <input name="currency" defaultValue={x.currency} maxLength={3} className="field uppercase" aria-label="Валют" />
                  <button className="btn-ghost h-11">Хадгалах</button>
                </form>
              </td></tr>
            ))}
          </Table>
          <h2 className="kicker mb-3 mt-10">Өнгө, сонголтын нэмэгдэл үнэ</h2>
          <Table head={['Бүлэг', 'Сонголт', 'Нэмэгдэл', '']}>
            {v.colors.map((c) => (
              <tr key={c.id}><td colSpan={4} className="p-0">
                <form className="grid grid-cols-[1fr_1.5fr_1fr_auto] items-center gap-3 px-4 py-3" onSubmit={async (e) => { e.preventDefault(); const f = new FormData(e.currentTarget); try { await api(`/api/dealer/colors/${c.id}`, { method: 'PATCH', json: { priceDelta: num(f.get('delta')) } }); m.ok('Нэмэгдэл хадгалагдлаа'); reload(); } catch (err) { m.fail(err); } }}>
                  <span className="tech text-mute">{c.group}</span><span>{c.name}</span>
                  <input name="delta" type="number" step="any" defaultValue={c.priceDelta ?? ''} placeholder="Байхгүй" className="field" aria-label={`${c.name} surcharge`} />
                  <button className="btn-ghost h-11">Хадгалах</button>
                </form>
              </td></tr>
            ))}
          </Table>
          <div className="mt-4">{m.node}</div>
        </>
      )}</WithVehicle>
    </>
  );
}

// --- Specifications --------------------------------------------------------------------------
function SpecEditor({ vehicle, onSaved }: { vehicle: DVehicleDetail; onSaved: () => void }) {
  const [sheet, setSheet] = useState<SpecSheet>(() => structuredClone(vehicle.specifications));
  const m = useMessage();
  const update = (cat: keyof SpecSheet, i: number, patch: Partial<SpecValue>) => setSheet((s) => ({ ...s, [cat]: s[cat]!.map((x, j) => (j === i ? { ...x, ...patch } : x)) }));
  return (
    <div className="space-y-10">
      {SPEC_CATEGORIES.map((cat) => (
        <section key={cat}>
          <h2 className="kicker mb-3 text-fg-2">{cat}</h2>
          <div className="space-y-2">
            {(sheet[cat] ?? []).map((s, i) => (
              <div key={s.key + i} className="grid gap-2 border hairline p-3 md:grid-cols-[1.2fr_1.2fr_80px_140px_1.6fr_auto]">
                <input aria-label="Нэр" value={s.label} onChange={(e) => update(cat, i, { label: e.target.value })} className="field" />
                <input aria-label="Утга" value={s.value ?? ''} placeholder="Мэдээлэлгүй" onChange={(e) => update(cat, i, { value: e.target.value || null, ...(e.target.value === '' ? { status: 'unavailable' } : s.status === 'unavailable' ? { status: 'reference' } : {}) })} className="field" />
                <input aria-label="Нэгж" value={s.unit ?? ''} placeholder="Нэгж" onChange={(e) => update(cat, i, { unit: e.target.value || undefined })} className="field" />
                <select aria-label="Төлөв" value={s.status} onChange={(e) => update(cat, i, { status: e.target.value as SpecValue['status'] })} className="field">
                  <option value="verified">Баталгаажсан</option><option value="reference">Лавлагаа</option><option value="unavailable">Мэдээлэлгүй</option>
                </select>
                <input aria-label="Эх сурвалж" value={s.source ?? ''} placeholder="Эх сурвалж (мэдээлэлгүйгээс бусад үед заавал)" onChange={(e) => update(cat, i, { source: e.target.value || undefined })} className="field" />
                <button className="btn-quiet h-11 text-danger" aria-label={`${s.label} устгах`} onClick={() => setSheet((x) => ({ ...x, [cat]: x[cat]!.filter((_, j) => j !== i) }))}>✕</button>
              </div>
            ))}
            <button className="btn-quiet h-9 px-0" onClick={() => setSheet((x) => ({ ...x, [cat]: [...(x[cat] ?? []), { key: `custom_${Date.now()}`, label: 'Шинэ үзүүлэлт', value: null, status: 'unavailable' }] }))}>+ Мөр нэмэх</button>
          </div>
        </section>
      ))}
      <div className="sticky bottom-0 flex items-center gap-4 border-t hairline bg-ink py-4">
        <button className="btn-primary" onClick={async () => { try { await api(`/api/dealer/vehicles/${vehicle.id}`, { method: 'PATCH', json: { specifications: sheet } }); m.ok('Үзүүлэлт хадгалагдлаа'); onSaved(); } catch (e) { m.fail(e); } }}>Үзүүлэлт хадгалах</button>
        {m.node}
      </div>
    </div>
  );
}
export function Specifications() {
  return (
    <>
      <Header kicker="Каталог" title="Үзүүлэлт" />
      <p className="-mt-4 mb-8 max-w-3xl text-sm text-fg-2">Утгыг <StatusBadge status="verified" /> гэж зөвхөн өөрийн зах зээл, он, зэрэглэлийн албан ёсны баримттай тулгаж шалгасны дараа тэмдэглэнэ үү. Утга бүрт эх сурвалж заавал. Мэдээлэлгүй бол хоосон үлдээнэ — хэзээ ч таамаглахгүй.</p>
      <WithVehicle>{(v, reload) => <SpecEditor key={v.id + v.updatedAt} vehicle={v} onSaved={reload} />}</WithVehicle>
    </>
  );
}

// --- Colours ---------------------------------------------------------------------------------
export function Colors() {
  const m = useMessage();
  return (
    <>
      <Header kicker="Тохируулагч" title="Өнгө ба өнгөлгөө" />
      <p className="-mt-4 mb-8 max-w-3xl text-sm text-fg-2">Бүлгийн ID нь машины 3D материалын бүлэгтэй таарах ёстой (3D загвар хэсгийг үзнэ үү). Үйлдвэрлэгч таны зах зээлд баталгаажуулсан үед л “Үйлдвэрийн баталгаатай” гэж тэмдэглэнэ үү.</p>
      <WithVehicle>{(v, reload) => {
        const groups = [...new Set(v.colors.map((c) => c.group))];
        return (
          <>
            {groups.map((g) => (
              <section key={g} className="mb-8">
                <h2 className="kicker mb-3 text-fg-2">{g}</h2>
                <Table head={['', 'Нэр', 'Өнгө', 'Боломжит байдал', '']}>
                  {v.colors.filter((c) => c.group === g).map((c) => (
                    <tr key={c.id}><td colSpan={5} className="p-0">
                      <form className="grid grid-cols-[40px_1.4fr_120px_170px_auto] items-center gap-3 px-4 py-2.5" onSubmit={async (e) => { e.preventDefault(); const f = new FormData(e.currentTarget); try { await api(`/api/dealer/colors/${c.id}`, { method: 'PATCH', json: { name: f.get('name'), hex: f.get('hex'), availability: f.get('availability') } }); m.ok('Хадгаллаа'); reload(); } catch (err) { m.fail(err); } }}>
                        <span className="h-7 w-7 rounded-full border border-white/15" style={{ background: c.hex }} />
                        <input name="name" defaultValue={c.name} className="field" aria-label="Нэр" />
                        <input name="hex" defaultValue={c.hex} pattern="#[0-9a-fA-F]{6}" className="field tech" aria-label="Өнгөний код" />
                        <select name="availability" defaultValue={c.availability} className="field" aria-label="Боломжит байдал"><option value="factory-verified">Үйлдвэрийн баталгаатай</option><option value="dealer-option">Дилерийн сонголт</option><option value="demonstration">Үзүүлэн</option></select>
                        <span className="flex"><button className="btn-ghost h-10">Хадгалах</button><button type="button" className="btn-quiet h-10 text-danger" onClick={async () => { await api(`/api/dealer/colors/${c.id}`, { method: 'DELETE' }); reload(); }} aria-label={`${c.name} устгах`}>✕</button></span>
                      </form>
                    </td></tr>
                  ))}
                </Table>
              </section>
            ))}
            <form className="panel grid gap-3 p-5 sm:grid-cols-[1fr_1.4fr_140px_auto]" onSubmit={async (e) => { e.preventDefault(); const f = new FormData(e.currentTarget); try { await api(`/api/dealer/vehicles/${v.id}/colors`, { method: 'POST', json: { group: f.get('group'), name: f.get('name'), hex: f.get('hex') } }); e.currentTarget.reset(); reload(); m.ok('Нэмэгдлээ'); } catch (err) { m.fail(err); } }}>
              <input name="group" required placeholder="Бүлэг (ж: body)" list="color-groups" className="field" aria-label="Бүлэг" />
              <datalist id="color-groups">{groups.map((g) => <option key={g} value={g} />)}</datalist>
              <input name="name" required placeholder="Нэр" className="field" aria-label="Нэр" />
              <input name="hex" required type="color" defaultValue="#888888" className="field h-11 p-1" aria-label="Өнгө" />
              <button className="btn-primary">Сонголт нэмэх</button>
            </form>
            <div className="mt-3">{m.node}</div>
          </>
        );
      }}</WithVehicle>
    </>
  );
}

// --- 3D assets -------------------------------------------------------------------------------
function ManifestCheck({ vehicle }: { vehicle: DVehicleDetail }) {
  const state = useAsync(async () => {
    if (!vehicle.manifestUrl) return null;
    const res = await fetch(vehicle.manifestUrl);
    if (!res.ok) throw new Error(`Манифест олдсонгүй (${res.status})`);
    const parsed = VehicleManifest.safeParse(await res.json());
    if (!parsed.success) throw new Error(parsed.error.issues.slice(0, 5).map((i) => `${i.path.join('.')}: ${i.message}`).join(' · '));
    const m = parsed.data;
    const files = await Promise.all(Object.entries(m.assets).map(async ([sys, a]) => {
      const url = resolveAssetUrl(vehicle.manifestUrl!, a!.url);
      const head = await fetch(url, { method: 'HEAD' }).catch(() => null);
      return { sys, url, ok: !!head?.ok, bytes: Number(head?.headers.get('content-length') ?? a!.bytes ?? 0), draco: a!.draco };
    }));
    const infoIds = new Set(vehicle.components.map((c) => c.id));
    return { m, problems: lintManifest(m), files, missingInfo: m.components.filter((c) => !infoIds.has(c.id)).map((c) => c.id) };
  }, [vehicle.manifestUrl]);
  return (
    <Loadable state={state}>{(r) => !r ? <p className="text-sm text-fg-2">3D манифест тохируулаагүй — машин 3D-гийн оронд үзүүлэлтийн хуудсаар харагдана.</p> : (
      <div className="space-y-6">
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <span className={`tech border px-2 py-1 uppercase ${r.m.assetStatus === 'production' ? 'border-ok/40 text-ok' : 'border-warn/40 text-warn'}`}>{r.m.assetStatus} assets</span>
          <span className="text-fg-2">{r.m.components.length} components · {r.m.materialGroups.length} material groups · {r.m.story.sections.length} story sections</span>
        </div>
        {r.m.assetStatus !== 'production' && <p className="max-w-2xl text-sm text-fg-2">{r.m.disclaimer}</p>}
        <Table head={['Систем', 'Файл', 'Хэмжээ', 'Шахалт', 'Төлөв']}>
          {r.files.map((f) => <tr key={f.sys}><Td>{f.sys}</Td><Td className="tech break-all">{f.url}</Td><Td>{f.bytes ? `${(f.bytes / 1024).toFixed(0)} KB` : '—'}</Td><Td>{f.draco ? 'Draco' : 'Байхгүй'}</Td><Td>{f.ok ? <span className="text-ok">Холбогдсон</span> : <span className="text-danger">Олдсонгүй</span>}</Td></tr>)}
        </Table>
        {r.problems.length > 0 && <div role="alert" className="text-sm text-danger">{r.problems.join(' · ')}</div>}
        {r.missingInfo.length > 0 ? <p className="text-sm text-warn">Components without editorial information: {r.missingInfo.join(', ')}</p> : <p className="text-sm text-ok">3D эд анги бүр тайлбартай.</p>}
      </div>
    )}</Loadable>
  );
}
export function Assets() {
  const m = useMessage();
  return (
    <>
      <Header kicker="3D" title="3D загвар" />
      <div className="mb-8 max-w-3xl space-y-2 text-sm text-fg-2">
        <p>Машин бүр <span className="tech">vehicle.manifest.json</span> файлтай холбогдоно — GLB node, материалыг эд анги, материалын бүлэг, түүхийн keyframe-тэй холбоно. Нийтлэхээс өмнө дараах командаар шалгана уу: <span className="tech">npm run assets:validate &lt;dir&gt;</span> .</p>
        <p className="text-mute">Энэ суулгацад объект хадгалах сан руу шууд байршуулах боломж идэвхжээгүй — GLB файлаа CDN bucket-д байршуулж, манифестийн URL-ыг энд оруулна уу. docs/3D_ASSET_PIPELINE.md-г үзнэ үү.</p>
      </div>
      <WithVehicle>{(v, reload) => (
        <div className="space-y-8">
          <form className="flex max-w-3xl flex-col gap-3 sm:flex-row" onSubmit={async (e) => { e.preventDefault(); const f = new FormData(e.currentTarget); try { await api(`/api/dealer/vehicles/${v.id}`, { method: 'PATCH', json: { manifestUrl: String(f.get('url') || '') || null, posterUrl: String(f.get('poster') || '') || null } }); m.ok('Хадгаллаа'); reload(); } catch (err) { m.fail(err); } }}>
            <label className="flex-1"><span className="label">Манифестийн URL</span><input name="url" defaultValue={v.manifestUrl ?? ''} placeholder="/assets/vehicles/…/vehicle.manifest.json" className="field tech" /></label>
            <label className="flex-1"><span className="label">Постер зургийн URL</span><input name="poster" defaultValue={v.posterUrl ?? ''} className="field tech" /></label>
            <button className="btn-primary self-end">Хадгалах</button>
          </form>
          {m.node}
          <ManifestCheck vehicle={v} />
        </div>
      )}</WithVehicle>
    </>
  );
}

// --- Inventory -------------------------------------------------------------------------------
export function Inventory() {
  const vehicles = useVehicles();
  const [n, setN] = useState(0);
  const items = useAsync(() => api<InventoryItem[]>('/api/dealer/inventory'), [n]);
  const m = useMessage();
  return (
    <>
      <Header kicker="Нөөц" title="Агуулах" />
      <Loadable state={vehicles}>{(vs) => (
        <>
          <form className="panel mb-8 grid gap-3 p-5 sm:grid-cols-[1.4fr_1fr_1fr_100px_auto]" onSubmit={async (e) => { e.preventDefault(); const f = new FormData(e.currentTarget); try { await api('/api/dealer/inventory', { method: 'POST', json: { vehicleId: f.get('vehicleId'), colorName: f.get('color'), vin: String(f.get('vin') || '') || null, quantity: Number(f.get('qty') || 1) } }); e.currentTarget.reset(); setN((x) => x + 1); m.ok('Нэмэгдлээ'); } catch (err) { m.fail(err); } }}>
            <select name="vehicleId" className="field" aria-label="Машин">{vs.map((v) => <option key={v.id} value={v.id}>{v.brand} {v.model}</option>)}</select>
            <input name="color" placeholder="Өнгө" className="field" aria-label="Өнгө" />
            <input name="vin" placeholder="VIN (заавал биш)" maxLength={17} className="field tech" aria-label="VIN" />
            <input name="qty" type="number" min={0} defaultValue={1} className="field" aria-label="Тоо" />
            <button className="btn-primary">Нөөц нэмэх</button>
          </form>
          {m.node}
          <Loadable state={items}>{(list) => list.length === 0 ? <p className="text-sm text-fg-2">Агуулахын бүртгэл алга.</p> : (
            <Table head={['Машин', 'Өнгө', 'VIN', 'Тоо', 'Төлөв', '']}>
              {list.map((i) => {
                const v = vs.find((x) => x.id === i.vehicleId);
                return (
                  <tr key={i.id}>
                    <Td>{v ? `${v.brand} ${v.model}` : '—'}</Td><Td>{i.colorName || '—'}</Td><Td className="tech">{i.vin ?? '—'}</Td><Td>{i.quantity}</Td>
                    <Td><select defaultValue={i.status} className="field h-9" aria-label="Төлөв" onChange={async (e) => { await api(`/api/dealer/inventory/${i.id}`, { method: 'PATCH', json: { status: e.target.value } }); m.ok('Шинэчлэгдлээ'); }}>
                      <option value="in_stock">Агуулахад</option><option value="incoming">Ирж яваа</option><option value="reserved">Захиалгатай</option><option value="sold">Зарагдсан</option></select></Td>
                    <Td><button className="btn-quiet h-9 text-danger" onClick={async () => { await api(`/api/dealer/inventory/${i.id}`, { method: 'DELETE' }); setN((x) => x + 1); }}>Хасах</button></Td>
                  </tr>
                );
              })}
            </Table>
          )}</Loadable>
        </>
      )}</Loadable>
    </>
  );
}

// --- Leads & customers -----------------------------------------------------------------------
function LeadDetail({ lead, onChange }: { lead: Lead; onChange: (l: Lead) => void }) {
  const m = useMessage();
  return (
    <div className="grid gap-8 bg-ink-2 p-6 md:grid-cols-2">
      <div className="space-y-3 text-sm">
        <p><span className="kicker mr-2">Утас</span><a href={`tel:${lead.phone}`} className="hover:text-accent">{lead.phone}</a></p>
        {lead.email && <p><span className="kicker mr-2">И-мэйл</span><a href={`mailto:${lead.email}`} className="hover:text-accent">{lead.email}</a></p>}
        <p><span className="kicker mr-2">Сонгосон хэлбэр</span>{({ phone: 'Утас', email: 'И-мэйл', whatsapp: 'WhatsApp', any: 'Аль нь ч' } as Record<string, string>)[lead.preferredContact] ?? lead.preferredContact}</p>
        {lead.message && <p className="whitespace-pre-wrap text-fg-2">“{lead.message}”</p>}
        {lead.summary.length > 0 && (
          <dl className="mt-4 border-t hairline">
            {lead.summary.map((s) => <div key={s.label} className="flex justify-between border-b hairline py-2"><dt className="text-mute">{s.label}</dt><dd>{s.value}</dd></div>)}
            <div className="flex justify-between py-2"><dt className="text-mute">Тооцоолсон үнэ</dt><dd>{formatPrice(lead.estimatedPrice != null ? { amount: lead.estimatedPrice, currency: lead.currency! } : null) ?? 'Үнэгүй'}</dd></div>
          </dl>
        )}
      </div>
      <form className="space-y-3" onSubmit={async (e) => { e.preventDefault(); const f = new FormData(e.currentTarget); try { const updated = await api<Lead>(`/api/dealer/leads/${lead.id}`, { method: 'PATCH', json: { status: f.get('status'), notes: f.get('notes') } }); m.ok('Хадгаллаа'); onChange({ ...lead, ...updated, vehicle: lead.vehicle }); } catch (err) { m.fail(err); } }}>
        <label className="block"><span className="label">Төлөв</span><select name="status" defaultValue={lead.status} className="field">{['new', 'contacted', 'qualified', 'won', 'lost'].map((s) => <option key={s} value={s}>{LEAD_STATUS[s]}</option>)}</select></label>
        <label className="block"><span className="label">Дотоод тэмдэглэл</span><textarea name="notes" rows={4} defaultValue={lead.notes} className="field h-auto py-2" /></label>
        <div className="flex items-center gap-3"><button className="btn-primary">Хадгалах</button>{m.node}</div>
      </form>
    </div>
  );
}
export function Leads() {
  const [status, setStatus] = useState('');
  const [open, setOpen] = useState<string | null>(null);
  const leads = useAsync(() => api<Lead[]>(`/api/dealer/leads${status ? `?status=${status}` : ''}`), [status]);
  // Local edits are patched in place so an open lead stays open after saving.
  const [patches, setPatches] = useState<Record<string, Lead>>({});
  return (
    <>
      <Header kicker="Борлуулалт" title="Хүсэлтүүд">
        <select value={status} onChange={(e) => setStatus(e.target.value)} className="field h-10 w-44" aria-label="Төлөвөөр шүүх">
          <option value="">Бүх төлөв</option>{['new', 'contacted', 'qualified', 'won', 'lost'].map((s) => <option key={s} value={s}>{LEAD_STATUS[s]}</option>)}
        </select>
      </Header>
      <Loadable state={leads}>{(raw) => { const list = raw.map((l) => patches[l.id] ?? l); return list.length === 0 ? <p className="text-sm text-fg-2">No leads{status ? ` with status “${status}”` : ''}.</p> : (
        <Table head={['Хүлээн авсан', 'Харилцагч', 'Төрөл', 'Машин', 'Төлөв', '']}>
          {list.map((l) => (
            <Fragment key={l.id}>
              <tr className={l.status === 'new' ? 'bg-accent/[0.04]' : ''}>
                <Td className="whitespace-nowrap">{dt(l.createdAt)}</Td><Td>{l.name}<span className="tech block text-mute">{l.phone}</span></Td>
                <Td>{LEAD_TYPE[l.type] ?? l.type}</Td><Td>{l.vehicle ?? '—'}</Td><Td>{LEAD_STATUS[l.status] ?? l.status}</Td>
                <Td className="text-right"><button className="btn-quiet h-8" aria-expanded={open === l.id} onClick={() => setOpen(open === l.id ? null : l.id)}>{open === l.id ? 'Хаах' : 'Нээх'}</button></Td>
              </tr>
              {open === l.id && <tr><td colSpan={6} className="p-0"><LeadDetail lead={l} onChange={(u) => setPatches((p) => ({ ...p, [u.id]: u }))} /></td></tr>}
            </Fragment>
          ))}
        </Table>
      ); }}</Loadable>
    </>
  );
}
export function Customers() {
  const c = useAsync(() => api<{ phone: string; name: string; email: string | null; leads: number; lastContact: string; won: number }[]>('/api/dealer/customers'), []);
  return (
    <>
      <Header kicker="Борлуулалт" title="Харилцагчид" />
      <p className="-mt-4 mb-6 text-sm text-fg-2">Харилцагчдыг утасны дугаараар нь бүх хүсэлтийг нэгтгэн харуулав.</p>
      <Loadable state={c}>{(list) => list.length === 0 ? <p className="text-sm text-fg-2">Харилцагч алга байна.</p> : (
        <Table head={['Нэр', 'Утас', 'И-мэйл', 'Хүсэлт', 'Амжилттай', 'Сүүлд холбогдсон']}>
          {list.map((x) => <tr key={x.phone}><Td>{x.name}</Td><Td className="tech">{x.phone}</Td><Td>{x.email ?? '—'}</Td><Td>{x.leads}</Td><Td>{x.won}</Td><Td>{new Date(x.lastContact).toLocaleDateString('mn-MN')}</Td></tr>)}
        </Table>
      )}</Loadable>
    </>
  );
}

// --- Analytics -------------------------------------------------------------------------------
function Bars({ title, rows }: { title: string; rows: { label: string; n: number }[] }) {
  const max = Math.max(1, ...rows.map((r) => r.n));
  return (
    <section className="border hairline p-5">
      <h2 className="kicker mb-4">{title}</h2>
      {rows.length === 0 ? <p className="text-sm text-mute">Мэдээлэл алга.</p> : (
        <ul className="space-y-2.5">{rows.map((r) => (
          <li key={r.label} className="grid grid-cols-[140px_1fr_48px] items-center gap-3 text-[0.8125rem]">
            <span className="truncate text-fg-2" title={r.label}>{r.label}</span>
            <span className="h-1.5 bg-line"><span className="block h-1.5 bg-accent" style={{ width: `${(r.n / max) * 100}%` }} /></span>
            <span className="tech text-right">{r.n}</span>
          </li>
        ))}</ul>
      )}
    </section>
  );
}
export function Analytics() {
  const [days, setDays] = useState(30);
  const a = useAsync(() => api<{ byType: { type: string; n: number }[]; byVehicle: { vehicle: string | null; n: number }[]; byDay: { day: string; n: number }[]; sections: { section: string; n: number }[]; componentsTop: { component: string; n: number }[] }>(`/api/dealer/analytics?days=${days}`), [days]);
  return (
    <>
      <Header kicker="Тайлан" title="Статистик">
        <select value={days} onChange={(e) => setDays(Number(e.target.value))} className="field h-10 w-40" aria-label="Хугацаа"><option value={7}>Сүүлийн 7 хоног</option><option value={30}>Сүүлийн 30 хоног</option><option value={90}>Сүүлийн 90 хоног</option></select>
      </Header>
      <Loadable state={a}>{(d) => (
        <div className="grid gap-6 lg:grid-cols-2">
          <Bars title="Үйлдлүүд" rows={d.byType.map((x) => ({ label: EVENT_LABEL[x.type] ?? x.type, n: x.n }))} />
          <Bars title="Машин үзсэн" rows={d.byVehicle.map((x) => ({ label: x.vehicle ?? '—', n: x.n }))} />
          <Bars title="Үзсэн хэсгүүд" rows={d.sections.map((x) => ({ label: x.section, n: x.n }))} />
          <Bars title="Хамгийн их үзсэн эд ангиуд" rows={d.componentsTop.map((x) => ({ label: x.component.replace(/_/g, ' '), n: x.n }))} />
          <div className="lg:col-span-2"><Bars title="Өдрийн идэвх" rows={d.byDay.map((x) => ({ label: x.day, n: x.n }))} /></div>
        </div>
      )}</Loadable>
    </>
  );
}

// --- Branding & domains ----------------------------------------------------------------------
export function BrandingPage({ me }: { me: DealerUser }) {
  const s = useAsync(() => api<{ branding: Branding; contact: Contact }>('/api/dealer/branding'), []);
  const m = useMessage();
  const [accent, setAccent] = useState<string | null>(null);
  const disabled = me.role !== 'owner';
  return (
    <>
      <Header kicker="Тохиргоо" title="Брэнд ба холбоо барих" />
      {disabled && <p className="mb-6 text-sm text-warn">Зөвхөн эзэмшигч брэндийг өөрчилж чадна.</p>}
      <Loadable state={s}>{(d) => (
        <form className="grid max-w-3xl gap-4 sm:grid-cols-2" onSubmit={async (e) => {
          e.preventDefault(); const f = new FormData(e.currentTarget);
          try {
            await api('/api/dealer/branding', { method: 'PATCH', json: {
              branding: { displayName: f.get('displayName'), tagline: f.get('tagline'), accent: f.get('accent'), logoUrl: String(f.get('logoUrl') || '') || null },
              contact: { phone: f.get('phone'), email: f.get('email'), address: f.get('address'), hours: f.get('hours') },
            } });
            m.ok('Хадгаллаа — өөрчлөлтийг харахын тулд сайтаа дахин ачаална уу');
          } catch (err) { m.fail(err); }
        }}>
          <fieldset disabled={disabled} className="contents">
            <label><span className="label">Харагдах нэр</span><input name="displayName" required defaultValue={d.branding.displayName} className="field" /></label>
            <label><span className="label">Онцлох өнгө</span><div className="flex gap-2"><input name="accent" type="color" defaultValue={d.branding.accent} onChange={(e) => setAccent(e.target.value)} className="field h-11 w-16 p-1" /><span className="btn-primary pointer-events-none flex-1" style={{ background: accent ?? d.branding.accent }}>Урьдчилан харах</span></div></label>
            <label className="sm:col-span-2"><span className="label">Уриа</span><input name="tagline" defaultValue={d.branding.tagline} maxLength={160} className="field" /></label>
            <label className="sm:col-span-2"><span className="label">Логоны URL (SVG эсвэл PNG)</span><input name="logoUrl" defaultValue={d.branding.logoUrl ?? ''} className="field tech" /></label>
            <label><span className="label">Утас</span><input name="phone" defaultValue={d.contact.phone} className="field" /></label>
            <label><span className="label">И-мэйл</span><input name="email" type="email" defaultValue={d.contact.email} className="field" /></label>
            <label className="sm:col-span-2"><span className="label">Хаяг</span><input name="address" defaultValue={d.contact.address} className="field" /></label>
            <label className="sm:col-span-2"><span className="label">Ажлын цаг</span><input name="hours" defaultValue={d.contact.hours} className="field" /></label>
            <div className="flex items-center gap-4 sm:col-span-2"><button className="btn-primary">Хадгалах</button>{m.node}</div>
          </fieldset>
        </form>
      )}</Loadable>
    </>
  );
}
export function Domains({ me }: { me: DealerUser }) {
  const [n, setN] = useState(0);
  const d = useAsync(() => api<{ id: string; hostname: string }[]>('/api/dealer/domains'), [n]);
  const m = useMessage();
  return (
    <>
      <Header kicker="Тохиргоо" title="Домэйн" />
      <div className="mb-8 max-w-3xl space-y-2 text-sm text-fg-2">
        <p>Домэйноо платформ руу <span className="tech">CNAME</span> бичлэгээр (эсвэл IP хаяг руу <span className="tech">A</span> бичлэгээр) чиглүүлээд энд нэмнэ үү. Сайт болон энэ самбар таны дилерийг домэйн нэрээр нь тодорхойлно.</p>
        <p className="text-mute">TLS гэрчилгээг edge (ж: Cloudflare for SaaS) олгоно — docs/DEPLOYMENT.md-г үзнэ үү.</p>
      </div>
      <Loadable state={d}>{(list) => (
        <Table head={['Домэйн', '']}>
          {list.map((x) => <tr key={x.id}><Td className="tech">{x.hostname}</Td><Td className="text-right">{me.role === 'owner' && <button className="btn-quiet h-8 text-danger" onClick={async () => { if (!confirm(`${x.hostname} хасах уу?`)) return; try { await api(`/api/dealer/domains/${x.id}`, { method: 'DELETE' }); setN((y) => y + 1); } catch (e) { m.fail(e); } }}>Хасах</button>}</Td></tr>)}
        </Table>
      )}</Loadable>
      {me.role === 'owner' && (
        <form className="mt-6 flex max-w-xl gap-3" onSubmit={async (e) => { e.preventDefault(); const f = new FormData(e.currentTarget); try { await api('/api/dealer/domains', { method: 'POST', json: { hostname: f.get('hostname') } }); e.currentTarget.reset(); setN((x) => x + 1); m.ok('Домэйн нэмэгдлээ'); } catch (err) { m.fail(err instanceof ApiError && err.status === 409 ? new Error('Энэ домэйн өөр дилерт холбогдсон байна') : err); } }}>
          <input name="hostname" required placeholder="showroom.example.mn" className="field tech" aria-label="Домэйн" /><button className="btn-primary">Домэйн нэмэх</button>
        </form>
      )}
      <div className="mt-3">{m.node}</div>
    </>
  );
}
