import { expect, test } from 'vitest';
import { hasFilters, parseQuery, type SearchDictionary } from './smart-search';

const dict: SearchDictionary = {
  categories: [
    { id: 'news', names: ['News'] },
    { id: 'kids', names: ['Kids'] },
    { id: 'movies', names: ['Movies'] },
    { id: 'sports', names: ['Sports'] },
  ],
  languages: [
    { id: 'tam', names: ['Tamil', 'தமிழ்'] },
    { id: 'hin', names: ['Hindi', 'हिन्दी'] },
    { id: 'fra', names: ['French', 'Français'] },
  ],
  countries: [
    { id: 'IN', names: ['India'] },
    { id: 'GB', names: ['United Kingdom'] },
    { id: 'KE', names: ['Kenya'] },
  ],
};

test('names become filters and the rest stays a name search', () => {
  expect(parseQuery('tamil news', dict)).toEqual({ language: 'tam', category: 'news', rest: '' });
  expect(parseQuery('Zee Tamil', dict)).toEqual({ language: 'tam', rest: 'zee' });
  expect(parseQuery('news from kenya', dict)).toEqual({ category: 'news', country: 'KE', rest: 'from' });
  expect(parseQuery('hindi movie', dict)).toEqual({ language: 'hin', category: 'movies', rest: '' }); // singular
});

test('native scripts, accents, multi-word countries and aliases', () => {
  expect(parseQuery('தமிழ் kids', dict)).toEqual({ language: 'tam', category: 'kids', rest: '' });
  expect(parseQuery('francais', dict)).toEqual({ language: 'fra', rest: '' });
  expect(parseQuery('united kingdom news', dict)).toEqual({ country: 'GB', category: 'news', rest: '' });
  expect(parseQuery('uk sports', dict)).toEqual({ country: 'GB', category: 'sports', rest: '' });
});

test('plain channel names are left alone', () => {
  const p = parseQuery('ndtv 24x7', dict);
  expect(p).toEqual({ rest: 'ndtv 24x7' });
  expect(hasFilters(p)).toBe(false);
  expect(parseQuery('  ', dict)).toEqual({ rest: '' });
});
