import { ChannelCardSkeleton } from '@/components/channel/channel-card';

export default function BrowseLoading() {
  return (
    <div
      aria-busy="true"
      aria-label="Loading channels"
      className="flex flex-col gap-6 px-4 pt-8 pb-16 sm:px-14"
    >
      <span className="bg-surface-raised h-9 w-72 animate-pulse rounded" />
      <span className="bg-surface border-border h-[78px] rounded-[12px] border" />
      <div className="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-4">
        {Array.from({ length: 10 }, (_, i) => (
          <ChannelCardSkeleton key={i} variant="grid" />
        ))}
      </div>
    </div>
  );
}
