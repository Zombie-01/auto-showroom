import { useEffect, useState, type FormEvent } from 'react';
import { NavLink, Navigate, Route, Routes, useNavigate } from 'react-router';
import { api, ApiError } from '../../lib/api';
import { Spinner } from '../../components/ui';
import * as P from './pages';

export interface DealerUser { email: string; name: string; role: 'owner' | 'staff'; tenant: { slug: string; branding: { displayName: string } } }

function Login({ onLogin }: { onLogin: () => void }) {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setBusy(true); setError(null);
    try { await api('/api/dealer/auth/login', { method: 'POST', json: { email: f.get('email'), password: f.get('password') } }); onLogin(); }
    catch (err) { setError(err instanceof Error ? err.message : 'Нэвтэрч чадсангүй'); }
    finally { setBusy(false); }
  }
  return (
    <main className="grid min-h-[100svh] place-items-center px-4">
      <form onSubmit={submit} className="w-full max-w-sm space-y-5" aria-labelledby="login-h">
        <p className="kicker">Дилерийн удирдлага</p>
        <h1 id="login-h" className="display text-3xl">Нэвтрэх</h1>
        <div><label htmlFor="email" className="label">И-мэйл</label><input id="email" name="email" type="email" required autoComplete="username" className="field" /></div>
        <div><label htmlFor="password" className="label">Нууц үг</label><input id="password" name="password" type="password" required autoComplete="current-password" className="field" /></div>
        {error && <p role="alert" className="text-sm text-danger">{error}</p>}
        <button disabled={busy} className="btn-primary w-full">{busy ? 'Нэвтэрч байна…' : 'Нэвтрэх'}</button>
        <p className="text-xs text-mute">Бүртгэл зөвхөн энэ дилерийн домэйнд хүчинтэй.</p>
      </form>
    </main>
  );
}

const NAV: [string, string][] = [
  ['', 'Тойм'], ['vehicles', 'Машинууд'], ['variants', 'Хувилбарууд'], ['specifications', 'Үзүүлэлт'], ['pricing', 'Үнэ'],
  ['colors', 'Өнгө'], ['assets', '3D загвар'], ['inventory', 'Агуулах'], ['leads', 'Хүсэлтүүд'], ['customers', 'Харилцагчид'],
  ['analytics', 'Статистик'], ['branding', 'Брэнд'], ['domains', 'Домэйн'],
];

export default function DealerApp() {
  const [me, setMe] = useState<DealerUser | null | undefined>(undefined);
  const [menuOpen, setMenuOpen] = useState(false);
  const navigate = useNavigate();
  const load = () => api<DealerUser>('/api/dealer/me').then(setMe, (e) => { if (e instanceof ApiError && e.status === 401) setMe(null); else setMe(null); });
  useEffect(() => { void load(); }, []);

  if (me === undefined) return <div className="grid h-[100svh] place-items-center"><Spinner /></div>;
  if (me === null) return <Login onLogin={load} />;

  const logout = async () => { await api('/api/dealer/auth/logout', { method: 'POST' }).catch(() => {}); setMe(null); navigate('/dealer'); };
  return (
    <div className="min-h-[100svh] lg:grid lg:grid-cols-[232px_1fr]">
      <aside className="border-b hairline bg-ink-2 lg:sticky lg:top-0 lg:h-[100svh] lg:border-b-0 lg:border-r">
        <div className="flex items-center justify-between px-5 py-5">
          <div><p className="display text-[0.95rem]">{me.tenant.branding.displayName}</p><p className="kicker mt-1 text-[0.5625rem]">Дилерийн удирдлага</p></div>
          <button className="btn-quiet h-9 lg:hidden" aria-expanded={menuOpen} aria-controls="dealer-nav" onClick={() => setMenuOpen((o) => !o)}>Цэс</button>
        </div>
        <nav id="dealer-nav" aria-label="Самбар" className={`${menuOpen ? 'block' : 'hidden'} px-2 pb-4 lg:block`}>
          {NAV.map(([to, label]) => (
            <NavLink key={to} to={`/dealer/${to}`} end={to === ''} onClick={() => setMenuOpen(false)}
              className={({ isActive }) => `block px-3 py-2 text-[0.8125rem] transition-colors ${isActive ? 'bg-white/[0.06] text-fg' : 'text-fg-2 hover:text-fg'}`}>{label}</NavLink>
          ))}
          <div className="mt-6 border-t hairline px-3 pt-4 text-xs text-mute">
            <p className="truncate">{me.email}</p><p className="capitalize">{me.role}</p>
            <div className="mt-3 flex gap-4"><a href="/" className="hover:text-fg">Сайт үзэх</a><button onClick={logout} className="hover:text-fg">Гарах</button></div>
          </div>
        </nav>
      </aside>
      <main className="min-w-0 px-4 py-8 sm:px-8 lg:py-10">
        <Routes>
          <Route index element={<P.Overview />} />
          <Route path="vehicles" element={<P.Vehicles me={me} />} />
          <Route path="variants" element={<P.Variants />} />
          <Route path="specifications" element={<P.Specifications />} />
          <Route path="pricing" element={<P.Pricing />} />
          <Route path="colors" element={<P.Colors />} />
          <Route path="assets" element={<P.Assets />} />
          <Route path="inventory" element={<P.Inventory />} />
          <Route path="leads" element={<P.Leads />} />
          <Route path="customers" element={<P.Customers />} />
          <Route path="analytics" element={<P.Analytics />} />
          <Route path="branding" element={<P.BrandingPage me={me} />} />
          <Route path="domains" element={<P.Domains me={me} />} />
          <Route path="*" element={<Navigate to="/dealer" replace />} />
        </Routes>
      </main>
    </div>
  );
}
