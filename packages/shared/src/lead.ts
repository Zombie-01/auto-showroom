import { z } from 'zod';

/** A customer's chosen configuration. Keys reference manifest material groups / switches. */
export const Configuration = z.object({
  vehicleSlug: z.string().regex(/^[a-z0-9-]+$/),
  variantId: z.string().max(64).nullable().default(null),
  /** materialGroupId -> VehicleColor id (or "default"). */
  colors: z.record(z.string().max(40), z.string().max(64)).default({}),
  /** switchId -> option ids. */
  switches: z.record(z.string().max(40), z.array(z.string().max(40)).max(12)).default({}),
});
export type Configuration = z.infer<typeof Configuration>;

export const LeadType = z.enum(['quote', 'contact', 'test_drive']);
export const ContactMethod = z.enum(['phone', 'email', 'whatsapp', 'any']);
export const LeadStatus = z.enum(['new', 'contacted', 'qualified', 'won', 'lost']);
export type LeadStatus = z.infer<typeof LeadStatus>;

export const LeadSubmission = z.object({
  type: LeadType,
  name: z.string().trim().min(2).max(120),
  phone: z.string().trim().regex(/^\+?[0-9 ()-]{6,24}$/, 'Зөв утасны дугаар оруулна уу'),
  email: z.string().trim().email().max(200).optional().or(z.literal('').transform(() => undefined)),
  preferredContact: ContactMethod.default('phone'),
  message: z.string().trim().max(2000).optional(),
  configuration: Configuration.optional(),
  /** Honeypot. Must be empty. */
  website: z.string().max(0).optional(),
});
export type LeadSubmission = z.infer<typeof LeadSubmission>;

/** Compact, URL-safe encoding for shareable configuration links. */
export function encodeConfiguration(c: Configuration): string {
  const json = JSON.stringify([c.vehicleSlug, c.variantId, c.colors, c.switches]);
  const b64 = typeof btoa === 'function'
    ? btoa(unescape(encodeURIComponent(json)))
    : Buffer.from(json, 'utf8').toString('base64');
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function decodeConfiguration(s: string): Configuration | null {
  try {
    const b64 = s.replace(/-/g, '+').replace(/_/g, '/');
    const json = typeof atob === 'function'
      ? decodeURIComponent(escape(atob(b64)))
      : Buffer.from(b64, 'base64').toString('utf8');
    const [vehicleSlug, variantId, colors, switches] = JSON.parse(json) as unknown[];
    const parsed = Configuration.safeParse({ vehicleSlug, variantId, colors, switches });
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}
