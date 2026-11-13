import { useState } from 'react';
import { ZONES, formatMnt, zonePrice } from '../lib/catalog';
import { regionFilm, type Region } from '../App';

/**
 * Sends the order as a "quote" lead to the existing showroom API, so it lands in the dealer
 * dashboard (/dealer) next to configurator quotes. The photo itself is not uploaded yet.
 */
export function OrderForm({ regions, total, onClose }: { regions: Region[]; total: number; onClose: () => void }) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [car, setCar] = useState('');
  const [note, setNote] = useState('');
  const [state, setState] = useState<'idle' | 'sending' | 'done' | 'error'>('idle');
  const [error, setError] = useState('');

  const lines = regions.map((r) => {
    const zone = ZONES.find((z) => z.id === r.zoneId)!;
    const film = regionFilm(r);
    return { zone: zone.label, film: film.label, service: film.service, price: zonePrice(zone, film) };
  });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setState('sending');
    const message = [
      `ХУУЛГЫН ЗАХИАЛГА${car ? ` — ${car}` : ''}`,
      ...lines.map((l) => `• ${l.zone}: ${l.service === 'ppf' ? 'PPF' : 'Өнгөт хуулга'} — ${l.film} (${formatMnt(l.price)})`),
      `Урьдчилсан нийт: ${formatMnt(total)}`,
      note && `Тэмдэглэл: ${note}`,
    ].filter(Boolean).join('\n');
    try {
      const res = await fetch('/api/public/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'quote', name, phone, preferredContact: 'phone', message }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => null))?.error ?? `HTTP ${res.status}`);
      setState('done');
    } catch (err) {
      setError((err as Error).message);
      setState('error');
    }
  };

  return (
    <div className="fixed inset-0 z-10 flex items-end justify-center bg-black/70 p-4 sm:items-center" onClick={onClose}>
      <div className="w-full max-w-md rounded-xl border border-[var(--line)] bg-[var(--bg)] p-6" onClick={(e) => e.stopPropagation()}>
        {state === 'done' ? (
          <>
            <h2 className="text-xl font-semibold">Захиалга илгээгдлээ</h2>
            <p className="mt-2 text-sm text-[var(--muted)]">Манай ажилтан тантай удахгүй холбогдож, цаг товлох болно.</p>
            <button className="btn-primary mt-6 w-full" onClick={onClose}>Хаах</button>
          </>
        ) : (
          <form onSubmit={submit} className="space-y-3">
            <h2 className="text-xl font-semibold">Захиалга өгөх</h2>
            <ul className="space-y-1 border-y border-[var(--line)] py-3 text-sm">
              {lines.map((l, i) => (
                <li key={i} className="flex justify-between gap-3"><span>{l.zone} · <span className="text-[var(--muted)]">{l.film}</span></span><span>{formatMnt(l.price)}</span></li>
              ))}
              <li className="flex justify-between pt-2 font-semibold"><span>Нийт (жишээ)</span><span>{formatMnt(total)}</span></li>
            </ul>
            <input className="field w-full" placeholder="Нэр" required minLength={2} value={name} onChange={(e) => setName(e.target.value)} />
            <input className="field w-full" placeholder="Утас" required pattern="\+?[0-9 \(\)\-]{6,24}" value={phone} onChange={(e) => setPhone(e.target.value)} />
            <input className="field w-full" placeholder="Машины загвар, он (ж: Land Cruiser 300, 2023)" value={car} onChange={(e) => setCar(e.target.value)} />
            <textarea className="field w-full" rows={2} placeholder="Нэмэлт тэмдэглэл" value={note} onChange={(e) => setNote(e.target.value)} />
            {state === 'error' && <p className="text-sm text-red-300">Илгээж чадсангүй: {error}</p>}
            <div className="flex gap-2 pt-2">
              <button type="button" className="btn-ghost flex-1" onClick={onClose}>Болих</button>
              <button className="btn-primary flex-1" disabled={state === 'sending'}>{state === 'sending' ? 'Илгээж байна…' : 'Илгээх'}</button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
