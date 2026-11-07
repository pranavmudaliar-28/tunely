// "Remind me" for a programme, without accounts or a server: a calendar event with a 5-minute alarm.

export interface ReminderInput {
  channelId: string;
  channelName: string;
  title: string;
  start: string;
  stop: string;
  /** The watch page, absolute. */
  url: string;
}

/** 20261106T103000Z */
const utc = (iso: string) => new Date(iso).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');

/** RFC 5545 text: backslash, semicolon, comma and newlines escaped. */
const text = (s: string) => s.replace(/[\\;,]/g, (m) => `\\${m}`).replace(/\r?\n/g, '\\n');

/** Lines longer than 75 octets continue on the next line after a space (RFC 5545 §3.1), never inside a character. */
function fold(line: string) {
  const out: string[] = [];
  let cur = '';
  let bytes = 0;
  for (const ch of line) {
    const n = new TextEncoder().encode(ch).length;
    if (bytes + n > (out.length ? 74 : 75)) {
      out.push(cur);
      cur = '';
      bytes = 0;
    }
    cur += ch;
    bytes += n;
  }
  out.push(cur);
  return out.join('\r\n ');
}

export function icsEvent(r: ReminderInput, now = new Date()) {
  const summary = `${r.title} on ${r.channelName}`;
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Tunely//Guide//EN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${r.channelId.replace(/[^A-Za-z0-9.-]/g, '-')}-${utc(r.start)}@tunely`,
    `DTSTAMP:${utc(now.toISOString())}`,
    `DTSTART:${utc(r.start)}`,
    `DTEND:${utc(r.stop)}`,
    `SUMMARY:${text(summary)}`,
    `DESCRIPTION:${text(`Watch live on Tunely: ${r.url}`)}`,
    `URL:${r.url}`,
    'BEGIN:VALARM',
    'ACTION:DISPLAY',
    `DESCRIPTION:${text(`${summary} starts in 5 minutes`)}`,
    'TRIGGER:-PT5M',
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
    '',
  ]
    .map(fold)
    .join('\r\n');
}

/** Google Calendar's "add event" page: Android's calendar can't open a downloaded .ics file, this works there. */
export function googleCalendarUrl(r: ReminderInput) {
  const p = new URLSearchParams({
    action: 'TEMPLATE',
    text: `${r.title} on ${r.channelName}`,
    dates: `${utc(r.start)}/${utc(r.stop)}`,
    details: `Watch live on Tunely: ${r.url}`,
  });
  return `https://calendar.google.com/calendar/render?${p}`;
}

export function addReminder(r: ReminderInput) {
  if (/Android/i.test(navigator.userAgent)) {
    window.open(googleCalendarUrl(r), '_blank', 'noopener');
    return;
  }
  const href = URL.createObjectURL(new Blob([icsEvent(r)], { type: 'text/calendar' }));
  const a = Object.assign(document.createElement('a'), {
    href,
    download: `${r.title.replace(/[^\p{L}\p{N} -]/gu, '').slice(0, 60).trim() || 'programme'}.ics`,
  });
  a.click();
  setTimeout(() => URL.revokeObjectURL(href), 10_000);
}
