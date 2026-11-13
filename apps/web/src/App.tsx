import { lazy, Suspense, useEffect } from 'react';
import { BrowserRouter, Route, Routes, useLocation } from 'react-router';
import { TenantProvider, useTenantState } from './lib/tenant';
import { ErrorState, PageShell, Spinner } from './components/ui';
import { CatalogPage } from './pages/Catalog';
import { ContactPage } from './pages/Contact';

// 3D pages and the dashboard are code-split: three.js is only downloaded when a scene is shown.
const HomePage = lazy(() => import('./pages/Home'));
const VehiclePage = lazy(() => import('./pages/Vehicle'));
const ConfiguratorPage = lazy(() => import('./pages/Configurator'));
const ComparePage = lazy(() => import('./pages/Compare'));
const DealerApp = lazy(() => import('./pages/dealer/DealerApp'));

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => { window.scrollTo(0, 0); }, [pathname]);
  return null;
}

function Shell() {
  const tenant = useTenantState();
  if (tenant.status === 'error') {
    return <ErrorState title="Шоурум нээгдсэнгүй" message={tenant.error === 'Тодорхойгүй дилер' ? 'Энэ хаяг ямар нэг дилерт холбогдоогүй байна.' : tenant.error} onRetry={tenant.retry} />;
  }
  return (
    <Suspense fallback={<div className="grid h-[100svh] place-items-center"><Spinner /></div>}>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/vehicles" element={<CatalogPage />} />
        <Route path="/vehicles/:slug" element={<VehiclePage />} />
        <Route path="/vehicles/:slug/configure" element={<ConfiguratorPage />} />
        <Route path="/compare" element={<ComparePage />} />
        <Route path="/contact" element={<ContactPage />} />
        <Route path="/dealer/*" element={<DealerApp />} />
        <Route path="*" element={<PageShell><ErrorState title="Хуудас олдсонгүй" message="Таны хайсан хуудас байхгүй байна." /></PageShell>} />
      </Routes>
    </Suspense>
  );
}

export function App() {
  return (
    <BrowserRouter>
      <TenantProvider>
        <ScrollToTop />
        <Shell />
      </TenantProvider>
    </BrowserRouter>
  );
}
