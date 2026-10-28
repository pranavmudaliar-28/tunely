import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="flex flex-col items-center gap-3 px-4 py-24 text-center">
      <h1 className="text-3xl font-bold">This channel isn’t available</h1>
      <p className="text-text-muted max-w-md">It may have been removed, or the link is wrong.</p>
      <Link
        href="/browse"
        className="bg-surface-raised text-text mt-3 flex h-11 items-center rounded-[8px] px-5 font-semibold no-underline"
      >
        Browse channels
      </Link>
    </div>
  );
}
