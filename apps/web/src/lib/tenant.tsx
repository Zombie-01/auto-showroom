import { createContext, useContext, useEffect, type ReactNode } from 'react';
import type { PublicTenant } from '@showroom/shared';
import { publicApi } from './api';
import { useAsync, type Async } from './hooks';

const TenantContext = createContext<Async<PublicTenant>>({ status: 'loading' });

export function TenantProvider({ children }: { children: ReactNode }) {
  const state = useAsync(() => publicApi.tenant(), []);
  useEffect(() => {
    if (state.status !== 'ok') return;
    document.documentElement.style.setProperty('--color-accent', state.data.branding.accent);
    document.title = state.data.branding.displayName;
  }, [state]);
  return <TenantContext.Provider value={state}>{children}</TenantContext.Provider>;
}

export const useTenant = () => {
  const s = useContext(TenantContext);
  return s.status === 'ok' ? s.data : null;
};
export const useTenantState = () => useContext(TenantContext);

export function formatPrice(p: { amount: number; currency: string } | null | undefined): string | null {
  if (!p) return null;
  try {
    return new Intl.NumberFormat('mn-MN', { style: 'currency', currency: p.currency, maximumFractionDigits: 0 }).format(p.amount);
  } catch {
    return `${p.amount.toLocaleString()} ${p.currency}`;
  }
}
