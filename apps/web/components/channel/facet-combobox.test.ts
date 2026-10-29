import { expect, test } from 'vitest';
import { filterOptions } from './facet-combobox';

const o = (name: string, id = name) => ({ id, name, count: 1 });
const names = (list: { name: string }[]) => list.map((x) => x.name);

test('A–Z with no search', () => {
  expect(names(filterOptions([o('India'), o('Brazil'), o('Åland Islands'), o('albania')], ''))).toEqual([
    'Åland Islands',
    'albania',
    'Brazil',
    'India',
  ]);
});

test('names starting with the search come first; case and accents ignored', () => {
  const list = [o('British Indian Ocean Territory'), o('India'), o('Indonesia'), o('Réunion'), o('Brazil')];
  expect(names(filterOptions(list, 'ind'))).toEqual(['India', 'Indonesia', 'British Indian Ocean Territory']);
  expect(names(filterOptions(list, 'REU'))).toEqual(['Réunion']);
});

test('the selected option stays listed even when it does not match', () => {
  expect(names(filterOptions([o('India', 'IN'), o('Brazil', 'BR')], 'ind', 'BR'))).toEqual([
    'India',
    'Brazil',
  ]);
});
