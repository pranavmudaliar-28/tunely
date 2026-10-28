import { expect, test } from 'vitest';
import { browseHref } from './browse-view';

test('browseHref is canonical whatever the key order', () => {
  expect(browseHref({ category: 'news', country: 'IN', q: 'dd' })).toBe(
    '/browse?q=dd&country=IN&category=news',
  );
  expect(browseHref({ q: 'dd', country: 'IN', category: 'news' })).toBe(
    browseHref({ category: 'news', q: 'dd', country: 'IN' }),
  );
  expect(browseHref({ q: '', status: undefined })).toBe('/browse');
});
