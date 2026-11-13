import { z } from 'zod';

export const Branding = z.object({
  displayName: z.string().min(1).max(80),
  logoUrl: z.string().max(500).nullable().default(null),
  /** Single accent colour used sparingly (CTAs, focus, active states). */
  accent: z.string().regex(/^#[0-9a-fA-F]{6}$/).default('#c8a46a'),
  tagline: z.string().max(160).default(''),
});
export type Branding = z.infer<typeof Branding>;

export const Contact = z.object({
  phone: z.string().max(40).default(''),
  email: z.string().max(200).default(''),
  address: z.string().max(300).default(''),
  hours: z.string().max(200).default(''),
});
export type Contact = z.infer<typeof Contact>;

export const DomainInput = z.object({
  hostname: z.string().trim().toLowerCase()
    .regex(/^(?=.{1,253}$)([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$|^[a-z0-9-]+\.localhost$/, 'Зөв домэйн нэр оруулна уу'),
});

export interface PublicTenant {
  slug: string;
  branding: Branding;
  contact: Contact;
}

export const ANALYTICS_EVENTS = ['vehicle_view', 'section_view', 'component_select', 'configurator_open', 'configuration_saved', 'lead_submitted', 'screenshot'] as const;
export const AnalyticsEventType = z.enum(ANALYTICS_EVENTS);
