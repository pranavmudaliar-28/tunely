import { expect, test } from 'vitest';
import { parseProgrammes, pickFiles, splitSiteId, xmltvTime, xmlText } from '../src/guide/xmltv';

test('xmltvTime reads XMLTV timestamps with or without an offset', () => {
  expect(xmltvTime('20261105232643 +0000')?.toISOString()).toBe('2026-11-05T23:26:43.000Z');
  expect(xmltvTime('20261106053000 +0530')?.toISOString()).toBe('2026-11-06T00:00:00.000Z');
  expect(xmltvTime('20261106000000 -0500')?.toISOString()).toBe('2026-11-06T05:00:00.000Z');
  expect(xmltvTime('20261106000000')?.toISOString()).toBe('2026-11-06T00:00:00.000Z');
  expect(xmltvTime('tomorrow')).toBeNull();
  expect(xmltvTime(undefined)).toBeNull();
});

test('xmlText decodes entities, unwraps CDATA and drops markup', () => {
  expect(xmlText(' Tom &amp; Jerry &#x2014; &#8220;Live&#8221; ')).toBe('Tom & Jerry — “Live”');
  expect(xmlText('<![CDATA[News <b>at</b> 9]]>')).toBe('News at 9');
  expect(xmlText('<script>alert(1)</script>Hi')).toBe('alert(1) Hi');
  expect(xmlText('&#0;&#9999999;ok')).toBe('ok');
});

const xml = `<?xml version="1.0"?><tv>
  <channel id="a"><display-name>A</display-name></channel>
  <programme channel="a" start="20261106100000 +0000" stop="20261106110000 +0000">
    <title lang="en">Morning &amp; More</title><desc>First.</desc>
  </programme>
  <programme channel="a" start="20261106110000 +0000" stop="20261106120000 +0000"><title>Noon</title></programme>
  <programme channel="a" start="20261106050000 +0000" stop="20261106060000 +0000"><title>Ended</title></programme>
  <programme channel="a" start="20261106130000 +0000" stop="20261106120000 +0000"><title>Backwards</title></programme>
  <programme channel="a" start="20261106120000 +0000" stop="20261106130000 +0000"><title></title></programme>
  <programme channel="b" start="20261106100000 +0000" stop="20261106110000 +0000"><title>Not wanted</title></programme>
</tv>`;

test('parseProgrammes keeps valid, wanted programmes in the window', () => {
  const wanted = new Map([['a', ['A.us', 'A2.us']]]);
  const rows = parseProgrammes(
    xml,
    wanted,
    new Date('2026-11-06T09:00:00Z'),
    new Date('2026-11-07T00:00:00Z'),
  );
  expect(rows.map((r) => [r.channelId, r.title, r.description])).toEqual([
    ['A.us', 'Morning & More', 'First.'],
    ['A2.us', 'Morning & More', 'First.'],
    ['A.us', 'Noon', null],
    ['A2.us', 'Noon', null],
  ]);
});

test('splitSiteId accepts only plain file paths', () => {
  expect(splitSiteId('Plex/us#5e20-ab')).toEqual({ file: 'Plex/us', channel: '5e20-ab' });
  expect(splitSiteId('../etc/passwd#x')).toBeNull();
  expect(splitSiteId('https://evil.example/x#y')).toBeNull();
  expect(splitSiteId('Plex/us')).toBeNull();
});

test('pickFiles covers every channel with the fewest files', () => {
  const listings = [
    { channelId: 'A', file: 'Plex/us', channel: 'a1' },
    { channelId: 'B', file: 'Plex/us', channel: 'b1' },
    { channelId: 'A', file: 'Plex/gb', channel: 'a2' },
    { channelId: 'C', file: 'Roku/all', channel: 'c1' },
    { channelId: 'B', file: 'Roku/all', channel: 'b2' },
  ];
  const picked = pickFiles(listings, 10);
  expect(picked.map((p) => p.file)).toEqual(['Plex/us', 'Roku/all']);
  // B is listed in both: read from both, in case one listing is stale.
  expect([...picked[1]!.wanted]).toEqual([
    ['c1', ['C']],
    ['b2', ['B']],
  ]);
  expect(pickFiles(listings, 1)).toHaveLength(1);
});
