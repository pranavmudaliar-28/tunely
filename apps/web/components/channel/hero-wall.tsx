import type { ChannelSummary } from '@tunely/shared';
import { monogram, tint } from '@/lib/format';

/** The tilted wall of channel tiles behind the home hero. Decorative only. */
export function HeroWall({ items }: { items: ChannelSummary[] }) {
  if (!items.length) return null;
  const tiles = Array.from({ length: 20 }, (_, i) => items[i % items.length]!);
  return (
    <div
      aria-hidden="true"
      className="absolute -top-10 -right-20 grid w-[110%] rotate-[-6deg] grid-cols-4 gap-3.5 opacity-70 sm:w-[72%] sm:grid-cols-5"
    >
      {tiles.map((c, i) => (
        <span
          key={i}
          className="flex aspect-video items-center justify-center rounded-[8px] text-[26px] font-extrabold text-[#F2F4F8B3]"
          style={{ background: tint(c.id + i) }}
        >
          {monogram(c.name)}
        </span>
      ))}
    </div>
  );
}
