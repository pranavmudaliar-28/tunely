import { expect, test } from 'vitest';
import { sameLanguage, trackLabel } from './tracks';

test('track labels: the stream label, else the language name, else a number', () => {
  expect(trackLabel({ label: 'English CC', language: 'en' }, 0)).toBe('English CC');
  expect(trackLabel({ label: '', language: 'hi' }, 0)).toBe('Hindi');
  expect(trackLabel({ label: '', language: '' }, 1)).toBe('Track 2');
});

test('languages match on their base code', () => {
  expect(sameLanguage('en-US', 'EN')).toBe(true);
  expect(sameLanguage('hi', 'en')).toBe(false);
});
