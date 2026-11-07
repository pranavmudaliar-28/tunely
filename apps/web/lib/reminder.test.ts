import { expect, test } from 'vitest';
import { googleCalendarUrl, icsEvent } from './reminder';

const r = {
  channelId: 'ABCKids.au',
  channelName: 'ABC Kids',
  title: 'Bluey; Season 3, Part 1',
  start: '2026-11-07T10:30:00.000Z',
  stop: '2026-11-07T11:00:00.000Z',
  url: 'https://tunely-tv.vercel.app/watch/ABCKids.au',
};

test('icsEvent writes a valid event with a 5-minute alarm', () => {
  const ics = icsEvent(r, new Date('2026-11-07T09:00:00Z'));
  const lines = ics.split('\r\n');
  expect(lines).toContain('DTSTART:20261107T103000Z');
  expect(lines).toContain('DTEND:20261107T110000Z');
  expect(lines).toContain('DTSTAMP:20261107T090000Z');
  expect(lines).toContain('UID:ABCKids.au-20261107T103000Z@tunely');
  expect(lines).toContain('SUMMARY:Bluey\\; Season 3\\, Part 1 on ABC Kids');
  expect(lines).toContain('TRIGGER:-PT5M');
  expect(ics.endsWith('END:VCALENDAR\r\n')).toBe(true);
  expect(lines.every((l) => new TextEncoder().encode(l).length <= 75)).toBe(true);
});

test('long lines fold without splitting a character', () => {
  const ics = icsEvent({ ...r, title: 'समाचार '.repeat(20) }, new Date());
  const summary = ics.split('\r\nDESCRIPTION')[0]!.split('SUMMARY:')[1]!;
  expect(summary.split('\r\n ').join('')).toBe(`${'समाचार '.repeat(20)} on ABC Kids`);
  expect(summary.split('\r\n').every((l) => new TextEncoder().encode(l).length <= 75)).toBe(true);
});

test('googleCalendarUrl fills in the event', () => {
  const u = new URL(googleCalendarUrl(r));
  expect(u.origin).toBe('https://calendar.google.com');
  expect(u.searchParams.get('dates')).toBe('20261107T103000Z/20261107T110000Z');
  expect(u.searchParams.get('text')).toBe('Bluey; Season 3, Part 1 on ABC Kids');
});
