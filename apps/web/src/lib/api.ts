import type { Configuration, LeadSubmission, PublicTenant, VehicleColor, Variant, VehicleInput } from '@showroom/shared';

export class ApiError extends Error {
  constructor(public status: number, message: string, public issues?: { path: string; message: string }[]) { super(message); }
}

export async function api<T>(path: string, init: RequestInit & { json?: unknown } = {}): Promise<T> {
  const { json, headers, ...rest } = init;
  let res: Response;
  try {
    res = await fetch(path, {
      credentials: 'same-origin',
      ...rest,
      headers: { ...(json !== undefined ? { 'Content-Type': 'application/json' } : {}), ...headers },
      body: json !== undefined ? JSON.stringify(json) : rest.body,
    });
  } catch {
    throw new ApiError(0, 'Шоурумын сервертэй холбогдож чадсангүй. Интернэт холболтоо шалгаад дахин оролдоно уу.');
  }
  if (res.status === 204) return undefined as T;
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, body.error ?? `Хүсэлт амжилтгүй (${res.status})`, body.issues);
  return body as T;
}

export interface CatalogVehicle {
  id: string; slug: string; brand: string; model: string; generation: string | null; year: number;
  tagline: string; description: string; manifestUrl: string | null; posterUrl: string | null;
  has3d: boolean; startingPrice: { amount: number; currency: string } | null;
}
export type PublicVehicle = Omit<VehicleInput, 'status'> & { id: string; variants: Variant[]; colors: VehicleColor[] };

export const publicApi = {
  tenant: () => api<PublicTenant>('/api/public/tenant'),
  vehicles: () => api<CatalogVehicle[]>('/api/public/vehicles'),
  vehicle: (slug: string) => api<PublicVehicle>(`/api/public/vehicles/${encodeURIComponent(slug)}`),
  submitLead: (lead: LeadSubmission) => api<{ id: string; estimatedPrice: number | null; currency: string | null; summary: { label: string; value: string }[] }>('/api/public/leads', { method: 'POST', json: lead }),
  saveConfiguration: (c: Configuration) => api<{ code: string }>('/api/public/configurations', { method: 'POST', json: c }),
  loadConfiguration: (code: string) => api<Configuration>(`/api/public/configurations/${encodeURIComponent(code)}`),
};
