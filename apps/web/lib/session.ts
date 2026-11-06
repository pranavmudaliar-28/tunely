import type { VisitorAge } from '@tunely/shared';

// Random id per browser tab session, sent with playback reports. The API hashes it with a
// daily-rotating salt, so it can count distinct viewers without identifying anyone.
export function sessionId(): string {
  try {
    let id = sessionStorage.getItem('tunely.sid');
    if (!id) {
      id = crypto.randomUUID();
      sessionStorage.setItem('tunely.sid', id);
    }
    return id;
  } catch {
    return crypto.randomUUID();
  }
}

const FIRST_VISIT_KEY = 'tunely.first';

/** Days between two YYYY-MM-DD dates, bucketed: same day, within a week, within a month, older. */
export function visitorAgeBucket(firstDay: string, today: string): VisitorAge {
  const days = Math.round((Date.parse(today) - Date.parse(firstDay)) / 86_400_000);
  if (!(days >= 1)) return 'first_day'; // also a bad or future date
  return days <= 7 ? 'week' : days <= 30 ? 'month' : 'older';
}

/**
 * How long ago this browser first used Tunely, as a coarse bucket for playback reports. The first-visit date stays in
 * this browser; only the bucket is sent. Undefined when storage is blocked (every visit would look new).
 */
export function visitorAge(now = new Date()): VisitorAge | undefined {
  const today = now.toISOString().slice(0, 10);
  try {
    let first = localStorage.getItem(FIRST_VISIT_KEY);
    if (!first || !/^\d{4}-\d{2}-\d{2}$/.test(first)) {
      first = today;
      localStorage.setItem(FIRST_VISIT_KEY, first);
    }
    return visitorAgeBucket(first, today);
  } catch {
    return undefined;
  }
}
