// Shown the instant a channel is clicked, while the server renders the watch page.
export default function WatchLoading() {
  return (
    <div aria-busy="true" aria-label="Loading channel">
      <div className="relative flex aspect-video w-full flex-col items-center justify-center gap-3.5 bg-black text-[#F2F4F8]">
        <svg
          width="44"
          height="44"
          viewBox="0 0 44 44"
          fill="none"
          aria-hidden="true"
          className="animate-spin"
        >
          <circle cx="22" cy="22" r="18" stroke="#2A3040" strokeWidth="4" />
          <path d="M22 4a18 18 0 0 1 18 18" stroke="var(--accent)" strokeWidth="4" strokeLinecap="round" />
        </svg>
        <p className="text-base font-semibold">Tuning in…</p>
      </div>
      <div className="flex flex-col gap-3 px-4 pt-7 sm:px-14">
        <span className="bg-surface-raised h-9 w-64 animate-pulse rounded" />
        <span className="bg-surface-raised h-4 w-48 animate-pulse rounded" />
      </div>
    </div>
  );
}
