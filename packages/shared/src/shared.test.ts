import { describe, expect, it } from 'vitest';
import { decodeConfiguration, encodeConfiguration, LeadSubmission, mergeSpecs, startingPrice, resolveAssetUrl } from './index';

describe('configuration links', () => {
  it('round-trips', () => {
    const c = { vehicleSlug: 'land-cruiser-300', variantId: 'v1', colors: { body: 'c1', seats: 'default' }, switches: { wheels: ['b'] } };
    expect(decodeConfiguration(encodeConfiguration(c))).toEqual(c);
  });
  it('rejects garbage', () => {
    expect(decodeConfiguration('%%%')).toBeNull();
    expect(decodeConfiguration(encodeConfiguration({ vehicleSlug: 'BAD SLUG', variantId: null, colors: {}, switches: {} } as never))).toBeNull();
  });
});

describe('pricing', () => {
  it('returns null when nothing priced', () => {
    expect(startingPrice([{ price: null, currency: 'MNT' }])).toBeNull();
  });
  it('picks the minimum', () => {
    expect(startingPrice([{ price: 300, currency: 'MNT' }, { price: 200, currency: 'MNT' }, { price: null, currency: 'MNT' }])).toEqual({ amount: 200, currency: 'MNT' });
  });
});

describe('specs', () => {
  it('overrides by key and appends new keys', () => {
    const base = { engine: [{ key: 'hp', label: 'Power', value: '1', status: 'reference' as const }] };
    const over = { engine: [{ key: 'hp', label: 'Power', value: '2', status: 'verified' as const }, { key: 'x', label: 'X', value: null, status: 'unavailable' as const }] };
    expect(mergeSpecs(base, over).engine?.map((s) => s.value)).toEqual(['2', null]);
  });
});

describe('leads', () => {
  it('validates phone and honeypot', () => {
    expect(LeadSubmission.safeParse({ type: 'quote', name: 'Bat', phone: '+976 9911 2233' }).success).toBe(true);
    expect(LeadSubmission.safeParse({ type: 'quote', name: 'Bat', phone: 'abc' }).success).toBe(false);
    expect(LeadSubmission.safeParse({ type: 'quote', name: 'Bat', phone: '99112233', website: 'spam' }).success).toBe(false);
  });
});

describe('asset urls', () => {
  it('resolves relative paths', () => {
    expect(resolveAssetUrl('/assets/v/m.json', 'exterior/a.glb')).toBe('/assets/v/exterior/a.glb');
    expect(resolveAssetUrl('/assets/v/m.json', 'https://cdn.x/a.glb')).toBe('https://cdn.x/a.glb');
  });
});
