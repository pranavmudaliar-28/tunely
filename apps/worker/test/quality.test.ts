import { expect, test } from 'vitest';
import { duplicateGroups, missingData, missingImpliedCategories, nameKey, type QualityChannel } from '../src/quality/checks';

const ch = (id: string, name: string, over: Partial<QualityChannel> = {}): QualityChannel => ({
  id,
  name,
  country: 'IN',
  categories: ['news'],
  languages: ['hin'],
  logo: 'https://x/l.png',
  score: 50,
  ...over,
});

test('nameKey ignores case, accents, punctuation and noise words', () => {
  expect(nameKey('Aaj Tak HD')).toBe('aaj tak');
  expect(nameKey('AAJ-TAK')).toBe('aaj tak');
  expect(nameKey('Télé Québec')).toBe('tele quebec');
  expect(nameKey('NDTV 24x7')).toBe('ndtv 24x7');
  expect(nameKey('TV')).toBe('');
  expect(nameKey('ETV+')).not.toBe(nameKey('ETV'));
});

test('duplicateGroups finds same-country look-alikes, best score first', () => {
  const groups = duplicateGroups([
    ch('AajTak.in', 'Aaj Tak', { score: 60 }),
    ch('AajTakHD.in', 'Aaj Tak HD', { score: 90 }),
    ch('AajTak.us', 'Aaj Tak', { country: 'US' }),
    ch('NDTV.in', 'NDTV India'),
    ch('TV1.in', 'TV'),
    ch('TV2.in', 'TV'),
  ]);
  expect(groups.map((g) => g.map((c) => c.id))).toEqual([['AajTakHD.in', 'AajTak.in']]);
});

test('missingImpliedCategories reads the name', () => {
  expect(missingImpliedCategories({ name: 'Republic World News', categories: ['general'] })).toEqual(['news']);
  expect(missingImpliedCategories({ name: 'Star Sports 1', categories: ['sports'] })).toEqual([]);
  expect(missingImpliedCategories({ name: 'Cartoon Network', categories: ['entertainment'] })).toEqual(['kids']);
  expect(missingImpliedCategories({ name: 'Newsmax', categories: [] })).toEqual([]); // a word, not "news"
});

test('missingData lists what a card would lack', () => {
  expect(missingData(ch('a', 'A', { logo: null, languages: [] }))).toEqual(['logo', 'language']);
  expect(missingData(ch('a', 'A'))).toEqual([]);
});
