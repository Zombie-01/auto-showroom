import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import type { Configuration } from '@showroom/shared';
import { ApiError, publicApi } from '../lib/api';
import { formatPrice, useTenant } from '../lib/tenant';

export type LeadType = 'quote' | 'contact' | 'test_drive';
export const LEAD_TITLES: Record<LeadType, string> = { quote: 'Үнийн санал авах', contact: 'Дилертэй холбогдох', test_drive: 'Туршилтын жолоодлого захиалах' };

type Result = { estimatedPrice: number | null; currency: string | null; summary: { label: string; value: string }[] };

export function LeadForm({ type, configuration, onDone }: { type: LeadType; configuration?: Configuration; onDone?: () => void }) {
  const id = useId();
  const tenant = useTenant();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [result, setResult] = useState<Result | null>(null);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setBusy(true); setError(null); setFieldErrors({});
    try {
      const r = await publicApi.submitLead({
        type,
        name: String(f.get('name') ?? ''),
        phone: String(f.get('phone') ?? ''),
        email: String(f.get('email') ?? '') || undefined,
        preferredContact: (f.get('preferred') as 'phone' | 'email' | 'whatsapp' | 'any') ?? 'phone',
        message: String(f.get('message') ?? '') || undefined,
        website: String(f.get('website') ?? ''),
        configuration,
      });
      setResult(r);
    } catch (err) {
      if (err instanceof ApiError && err.issues) setFieldErrors(Object.fromEntries(err.issues.map((i) => [i.path, i.message])));
      setError(err instanceof ApiError && err.issues?.length ? 'Мэдээллээ шалгана уу.' : err instanceof Error ? err.message : 'Алдаа гарлаа');
    } finally { setBusy(false); }
  }

  if (result) {
    const price = formatPrice(result.estimatedPrice != null ? { amount: result.estimatedPrice, currency: result.currency! } : null);
    return (
      <div role="status" className="space-y-6">
        <p className="kicker text-ok">Хүсэлт илгээгдлээ</p>
        <p className="display text-2xl">Баярлалаа. {tenant?.branding.displayName ?? 'Дилер'} тантай удахгүй холбогдоно.</p>
        {configuration && (
          <dl className="border-t hairline">
            {result.summary.map((s) => <div key={s.label} className="flex justify-between border-b hairline py-2.5 text-sm"><dt className="text-mute">{s.label}</dt><dd>{s.value}</dd></div>)}
            <div className="flex justify-between py-2.5 text-sm"><dt className="text-mute">Тооцоолсон үнэ</dt><dd>{price ?? 'Хүсэлтээр'}</dd></div>
          </dl>
        )}
        {onDone && <button className="btn-ghost" onClick={onDone}>Хаах</button>}
      </div>
    );
  }

  const err = (k: string) => fieldErrors[k] && <p id={`${id}-${k}-err`} className="mt-1.5 text-xs text-danger">{fieldErrors[k]}</p>;
  return (
    <form onSubmit={submit} className="space-y-5" noValidate>
      <div>
        <label htmlFor={`${id}-name`} className="label">Овог нэр</label>
        <input id={`${id}-name`} name="name" required minLength={2} maxLength={120} autoComplete="name" className="field" aria-invalid={!!fieldErrors.name} aria-describedby={`${id}-name-err`} />
        {err('name')}
      </div>
      <div>
        <label htmlFor={`${id}-phone`} className="label">Утасны дугаар</label>
        <input id={`${id}-phone`} name="phone" type="tel" required inputMode="tel" autoComplete="tel" placeholder="+976 9911 2233" className="field" aria-invalid={!!fieldErrors.phone} aria-describedby={`${id}-phone-err`} />
        {err('phone')}
      </div>
      <div>
        <label htmlFor={`${id}-email`} className="label">И-мэйл <span className="normal-case tracking-normal">(заавал биш)</span></label>
        <input id={`${id}-email`} name="email" type="email" autoComplete="email" className="field" aria-invalid={!!fieldErrors.email} aria-describedby={`${id}-email-err`} />
        {err('email')}
      </div>
      <fieldset>
        <legend className="label">Холбогдох хэлбэр</legend>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {[['phone', 'Утас'], ['whatsapp', 'WhatsApp'], ['email', 'И-мэйл'], ['any', 'Аль нь ч']].map(([v, l], i) => (
            <label key={v} className="flex h-10 cursor-pointer items-center justify-center border border-line-strong text-[0.8125rem] text-fg-2 has-[:checked]:border-accent has-[:checked]:text-fg has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-accent">
              <input type="radio" name="preferred" value={v} defaultChecked={i === 0} className="sr-only" />{l}
            </label>
          ))}
        </div>
      </fieldset>
      <div>
        <label htmlFor={`${id}-message`} className="label">Зурвас <span className="normal-case tracking-normal">(заавал биш)</span></label>
        <textarea id={`${id}-message`} name="message" rows={3} maxLength={2000} className="field h-auto py-2.5" />
      </div>
      {/* Honeypot: hidden from people, filled by bots. */}
      <div aria-hidden className="absolute -left-[9999px] h-0 w-0 overflow-hidden"><label>Website<input name="website" tabIndex={-1} autoComplete="off" /></label></div>
      {error && <p role="alert" className="text-sm text-danger">{error}</p>}
      <button type="submit" disabled={busy} className="btn-primary w-full">{busy ? 'Илгээж байна…' : LEAD_TITLES[type]}</button>
      <p className="text-[0.6875rem] leading-relaxed text-mute">Таны мэдээллийг зөвхөн энэ дилерт, хүсэлтэд тань хариулах зорилгоор илгээнэ.</p>
    </form>
  );
}

/** Accessible modal dialog using the native <dialog> element. */
export function LeadDialog({ type, configuration, onClose }: { type: LeadType | null; configuration?: Configuration; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (type && !d.open) d.showModal();
    if (!type && d.open) d.close();
  }, [type]);
  return (
    <dialog ref={ref} onClose={onClose} aria-labelledby="lead-title"
      className="m-auto max-h-[92svh] w-[min(520px,calc(100vw-2rem))] overflow-y-auto border border-line-strong bg-ink-2 p-0 text-fg backdrop:bg-black/70">
      {type && (
        <div className="p-6 sm:p-8">
          <div className="mb-8 flex items-start justify-between gap-4">
            <h2 id="lead-title" className="display text-2xl">{LEAD_TITLES[type]}</h2>
            <button onClick={onClose} className="btn-quiet -mr-3 -mt-2 h-9" aria-label="Хаах">✕</button>
          </div>
          <LeadForm type={type} configuration={configuration} onDone={onClose} />
        </div>
      )}
    </dialog>
  );
}
