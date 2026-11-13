import { Link, NavLink } from 'react-router';
import type { ReactNode } from 'react';
import type { SpecSheet, SpecValue, VerificationStatus } from '@showroom/shared';
import { SPEC_CATEGORIES } from '@showroom/shared';
import { useTenant } from '../lib/tenant';

export function Nav({ overlay = false }: { overlay?: boolean }) {
  const tenant = useTenant();
  const link = ({ isActive }: { isActive: boolean }) => `px-3 py-2 text-[0.8125rem] tracking-wide transition-colors ${isActive ? 'text-fg' : 'text-fg-2 hover:text-fg'}`;
  return (
    <header className={`${overlay ? 'fixed' : 'sticky'} top-0 inset-x-0 z-40 ${overlay ? '' : 'bg-ink/90 backdrop-blur-sm border-b hairline'}`}>
      <nav className="mx-auto flex h-16 max-w-[1600px] items-center justify-between px-4 sm:px-8" aria-label="Үндсэн цэс">
        <Link to="/" className="flex items-center gap-3">
          {tenant?.branding.logoUrl
            ? <img src={tenant.branding.logoUrl} alt={tenant.branding.displayName} className="h-7 w-auto" />
            : <span className="display text-[0.95rem] tracking-tight">{tenant?.branding.displayName ?? 'Шоурум'}</span>}
        </Link>
        <div className="flex items-center">
          <NavLink to="/vehicles" className={link}>Машинууд</NavLink>
          <NavLink to="/compare" className={link}>Харьцуулах</NavLink>
          <NavLink to="/contact" className={`${link({ isActive: false })} hidden sm:inline-flex`}>Холбоо барих</NavLink>
        </div>
      </nav>
    </header>
  );
}

export function Footer() {
  const tenant = useTenant();
  return (
    <footer className="border-t hairline">
      <div className="mx-auto grid max-w-[1600px] gap-8 px-4 py-12 sm:grid-cols-3 sm:px-8">
        <div>
          <p className="display text-lg">{tenant?.branding.displayName}</p>
          <p className="mt-2 text-sm text-mute">{tenant?.branding.tagline}</p>
        </div>
        <div className="text-sm text-fg-2 space-y-1">
          {tenant?.contact.phone && <p><a href={`tel:${tenant.contact.phone}`} className="hover:text-fg">{tenant.contact.phone}</a></p>}
          {tenant?.contact.email && <p><a href={`mailto:${tenant.contact.email}`} className="hover:text-fg">{tenant.contact.email}</a></p>}
          {tenant?.contact.address && <p>{tenant.contact.address}</p>}
          {tenant?.contact.hours && <p className="text-mute">{tenant.contact.hours}</p>}
        </div>
        <div className="text-xs text-mute sm:text-right leading-relaxed">
          <p>Үзүүлэлт бүрийг баталгаажсан эсэхийн хамт харуулав. Худалдан авахаас өмнө дилерээс бүх мэдээллийг тодруулна уу.</p>
          <p className="mt-2"><Link to="/dealer" className="hover:text-fg">Дилерийн нэвтрэх хэсэг</Link></p>
        </div>
      </div>
    </footer>
  );
}

const STATUS: Record<VerificationStatus, { label: string; cls: string; title: string }> = {
  verified: { label: 'Баталгаажсан', cls: 'text-ok border-ok/40', title: 'Энэ зах зээл, зэрэглэлд дилер баталгаажуулсан' },
  reference: { label: 'Лавлагаа', cls: 'text-warn border-warn/40', title: 'Үйлдвэрлэгч/дистрибьютерийн албан эх сурвалжаас — энэ зах зээлд хараахан баталгаажаагүй' },
  unavailable: { label: 'Мэдээлэлгүй', cls: 'text-mute border-line-strong', title: 'Найдвартай мэдээлэл алга' },
};
export function StatusBadge({ status }: { status: VerificationStatus }) {
  const s = STATUS[status];
  return <span title={s.title} className={`tech inline-flex h-5 items-center border px-1.5 text-[0.625rem] uppercase tracking-[0.12em] ${s.cls}`}>{s.label}</span>;
}

export function SpecRow({ spec }: { spec: SpecValue }) {
  return (
    <div className="grid grid-cols-[1fr_auto] items-baseline gap-x-4 gap-y-1 border-b hairline py-3.5">
      <dt className="text-sm text-fg-2">{spec.label}</dt>
      <dd className="text-right">
        {spec.value ? <span className="text-sm text-fg">{spec.value}{spec.unit ? <span className="text-mute"> {spec.unit}</span> : null}</span> : <span className="text-sm text-mute">Мэдээлэлгүй</span>}
      </dd>
      <div className="col-span-2 flex items-center gap-2"><StatusBadge status={spec.status} />{spec.source && <span className="truncate text-[0.6875rem] text-mute" title={spec.source}>{spec.source}</span>}</div>
    </div>
  );
}

export const CATEGORY_LABEL: Record<string, string> = { engine: 'Хөдөлгүүр', transmission: 'Хүч дамжуулалт', dimensions: 'Хэмжээ', capacity: 'Багтаамж ба чирэх', performance: 'Гүйцэтгэл ба зарцуулалт', offroad: 'Бартаат зам', safety: 'Аюулгүй байдал', comfort: 'Тав тух ба тоноглол', multimedia: 'Мультимедиа', ownership: 'Баталгаа ба үйлчилгээ' };
export function SpecSheetView({ specs }: { specs: SpecSheet }) {
  const cats = SPEC_CATEGORIES.filter((c) => specs[c]?.length);
  if (!cats.length) return <p className="text-sm text-mute">Энэ машины үзүүлэлтийг хараахан оруулаагүй байна.</p>;
  return (
    <div className="grid gap-x-12 gap-y-10 md:grid-cols-2 xl:grid-cols-3">
      {cats.map((c) => (
        <section key={c} aria-labelledby={`spec-${c}`}>
          <h3 id={`spec-${c}`} className="kicker mb-2 border-b hairline pb-3 text-fg-2">{CATEGORY_LABEL[c]}</h3>
          <dl>{specs[c]!.map((s) => <SpecRow key={s.key} spec={s} />)}</dl>
        </section>
      ))}
    </div>
  );
}

export function DemoBadge({ text, status = 'demonstration' }: { text: string; status?: string }) {
  return (
    <div role="note" className="flex max-w-md items-start gap-2.5 border border-warn/30 bg-ink/80 px-3 py-2 text-[0.6875rem] leading-snug text-fg-2">
      <span className="tech mt-px shrink-0 text-warn uppercase tracking-[0.14em]">{status === 'evaluation' ? 'Туршилтын загвар' : 'Үзүүлэн загвар'}</span>
      <span>{text}</span>
    </div>
  );
}

export function Spinner({ label = 'Ачаалж байна' }: { label?: string }) {
  return (
    <div role="status" className="flex items-center gap-3 text-mute">
      <span className="relative block h-px w-16 overflow-hidden bg-line-strong"><span className="loading-seg absolute inset-y-0 left-0 w-1/3 bg-fg" /></span>
      <span className="kicker">{label}</span>
    </div>
  );
}

export function ErrorState({ title, message, onRetry }: { title: string; message: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="mx-auto max-w-lg py-24 text-center">
      <p className="kicker">Алдаа гарлаа</p>
      <h1 className="display mt-4 text-3xl">{title}</h1>
      <p className="mt-4 text-sm text-fg-2">{message}</p>
      {onRetry && <button onClick={onRetry} className="btn-ghost mt-8">Дахин оролдох</button>}
    </div>
  );
}

export function PageShell({ children }: { children: ReactNode }) {
  return <><Nav /><main className="min-h-[70vh]">{children}</main><Footer /></>;
}
