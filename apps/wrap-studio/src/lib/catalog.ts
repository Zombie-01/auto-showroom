import type { FilmEffect, Finish } from './recolor';

/**
 * Demonstration catalogue. Prices are placeholders in MNT for an evaluation build — each
 * dealership/installer must set its own (labour + film brand + vehicle size).
 */
export type Service = 'wrap' | 'ppf';

export interface Zone { id: string; label: string; wrapPrice: number; ppfPrice: number; hint: string }

export const ZONES: Zone[] = [
  { id: 'full', label: 'Бүтэн их бие', wrapPrice: 4_800_000, ppfPrice: 7_500_000, hint: 'Машины их бие дээр 2–3 газар дарна уу' },
  { id: 'front', label: 'Урд хэсэг (капот, бампер, гэрэл)', wrapPrice: 1_200_000, ppfPrice: 2_200_000, hint: 'Капот, урд бампер дээр дарна уу' },
  { id: 'hood', label: 'Капот', wrapPrice: 450_000, ppfPrice: 800_000, hint: 'Капот дээр дарна уу' },
  { id: 'roof', label: 'Дээвэр', wrapPrice: 380_000, ppfPrice: 650_000, hint: 'Дээвэр дээр дарна уу' },
  { id: 'front-bumper', label: 'Урд бампер', wrapPrice: 400_000, ppfPrice: 700_000, hint: 'Урд бампер дээр дарна уу' },
  { id: 'rear-bumper', label: 'Хойд бампер', wrapPrice: 380_000, ppfPrice: 650_000, hint: 'Хойд бампер дээр дарна уу' },
  { id: 'door', label: 'Хаалга', wrapPrice: 300_000, ppfPrice: 520_000, hint: 'Хаалга дээр дарна уу' },
  { id: 'mirrors', label: 'Хажуугийн толь', wrapPrice: 120_000, ppfPrice: 180_000, hint: 'Толь бүр дээр дарна уу' },
  { id: 'trim', label: 'Чимэглэл / хром хэсэг', wrapPrice: 250_000, ppfPrice: 300_000, hint: 'Хром эсвэл чимэглэлийн хэсэг дээр дарна уу' },
  { id: 'other', label: 'Бусад хэсэг', wrapPrice: 250_000, ppfPrice: 400_000, hint: 'Хэсэг дээрээ дарна уу' },
];

export interface Film { id: string; service: Service; label: string; effect: FilmEffect; swatch: string; multiplier: number }

const wrap = (id: string, label: string, color: string, finish: Finish, multiplier = 1): Film =>
  ({ id, service: 'wrap', label, effect: { kind: 'wrap', color, finish }, swatch: color, multiplier });

export const FILMS: Film[] = [
  { id: 'ppf-gloss', service: 'ppf', label: 'Тунгалаг гялгар PPF', effect: { kind: 'ppf', finish: 'gloss' }, swatch: 'transparent', multiplier: 1 },
  { id: 'ppf-matte', service: 'ppf', label: 'Тунгалаг матт PPF (stealth)', effect: { kind: 'ppf', finish: 'matte' }, swatch: 'transparent', multiplier: 1.1 },
  wrap('gloss-black', 'Гялгар хар', '#0c0c0e', 'gloss'),
  wrap('satin-black', 'Сатин хар', '#141416', 'satin'),
  wrap('matte-black', 'Матт хар', '#1a1a1c', 'matte'),
  wrap('gloss-white', 'Гялгар цагаан', '#eeeeea', 'gloss'),
  wrap('nardo', 'Нардо саарал', '#6d7174', 'gloss'),
  wrap('satin-grey', 'Сатин хар саарал', '#3b3e42', 'satin'),
  wrap('silver', 'Мөнгөлөг металлик', '#a9adb2', 'metallic', 1.15),
  wrap('midnight', 'Шөнийн хөх металлик', '#1b2a4c', 'metallic', 1.15),
  wrap('blue', 'Гялгар цэнхэр', '#1f5fbf', 'gloss'),
  wrap('red', 'Гялгар улаан', '#b3121b', 'gloss'),
  wrap('green', 'Матт цэргийн ногоон', '#3f4a36', 'matte'),
  wrap('sand', 'Сатин элсэн шаргал', '#b9a27a', 'satin'),
  wrap('orange', 'Гялгар улбар шар', '#e2631b', 'gloss'),
  wrap('gold', 'Сатин алтлаг', '#b08d57', 'satin', 1.2),
];

export const FINISH_LABEL: Record<Finish, string> = { gloss: 'Гялгар', satin: 'Сатин', matte: 'Матт', metallic: 'Металлик' };

export const zonePrice = (zone: Zone, film: Film) =>
  Math.round(((film.service === 'ppf' ? zone.ppfPrice : zone.wrapPrice) * film.multiplier) / 10_000) * 10_000;

export const formatMnt = (n: number) => `${n.toLocaleString('en-US').replace(/,/g, ' ')} ₮`;
