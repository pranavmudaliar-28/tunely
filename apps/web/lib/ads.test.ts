import { expect, test } from 'vitest';
import { adsterraDoc, pageAdsAllowed, parseNativeSrc } from './ads';

test('adsterraDoc builds the banner document from a key', () => {
  const doc = adsterraDoc('abc123def456', 728, 90, 'https://www.highperformanceformat.com/{key}/invoke.js');
  expect(doc).toContain(
    'atOptions={"key":"abc123def456","format":"iframe","height":90,"width":728,"params":{}}',
  );
  expect(doc).toContain('src="https://www.highperformanceformat.com/abc123def456/invoke.js"');
  expect(adsterraDoc('abc123def456', 320, 50, 'https://bauval.org/22/{key}')).toContain(
    'src="https://bauval.org/22/abc123def456"',
  );
});

test('parseNativeSrc takes the key from the script URL and rejects anything else', () => {
  const key = '87ab6ab9f4762f03fc11b60df7bcd177';
  expect(parseNativeSrc(` https://bauval.org/21/${key} `)).toEqual({
    src: `https://bauval.org/21/${key}`,
    key,
  });
  expect(parseNativeSrc(`https://pl1.example.com/${key}/invoke.js`)?.key).toBe(key);
  expect(parseNativeSrc(undefined)).toBeNull();
  expect(parseNativeSrc(`http://bauval.org/21/${key}`)).toBeNull();
  expect(parseNativeSrc(`https://bauval.org/21/${key}"><script>`)).toBeNull();
});

test('page-wide ads stay away from video', () => {
  expect(pageAdsAllowed('/', false)).toBe(true);
  expect(pageAdsAllowed('/browse', false)).toBe(true);
  expect(pageAdsAllowed('/watch/AajTak.in', false)).toBe(false);
  expect(pageAdsAllowed('/', true)).toBe(false); // the mini player is open
});
