import type { ChannelSummary } from '@tunely/shared';

/**
 * The guide's sections: one per category, biggest first, channels in the API's order (best first). A channel sits in
 * each of its categories; one with none goes under "general".
 */
export function guideSections(items: ChannelSummary[]): [category: string, channels: ChannelSummary[]][] {
  const by = new Map<string, ChannelSummary[]>();
  for (const c of items) {
    for (const cat of c.categories.length ? c.categories : ['general']) {
      if (!by.has(cat)) by.set(cat, []);
      by.get(cat)!.push(c);
    }
  }
  return [...by].sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]));
}
