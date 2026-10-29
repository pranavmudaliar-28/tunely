import Link from 'next/link';
import { GridIcon, HeartIcon, HomeIcon, LogoMark, TvIcon } from '@/components/ui/icons';
import { NavLink } from './nav-link';
import { GlobalPlayer } from '@/components/player/global-player';
import { SearchCommand } from '@/components/search/search-command';
import { InstallButton } from './install-button';
import { ThemeToggle } from './theme-toggle';
import { FOOTER_PAGES, SUPPORT_URL } from '@/lib/site';

const NAV = [
  { href: '/', label: 'Home', icon: HomeIcon },
  { href: '/browse', label: 'Live TV', icon: TvIcon },
  { href: '/categories', label: 'Categories', icon: GridIcon },
  { href: '/favorites', label: 'Favorites', icon: HeartIcon },
];

/** Left icon rail on desktop; under 720 px a slim top header and a bottom tab bar (thumb reach, like native apps). */
export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col min-[720px]:flex-row">
      <a
        href="#main"
        className="bg-surface-raised sr-only z-50 rounded-lg px-4 py-3 focus:not-sr-only focus:fixed focus:top-2 focus:left-2"
      >
        Skip to content
      </a>
      <header className="border-border bg-bg sticky top-0 z-30 flex items-center justify-between border-b py-1 pr-1 pl-4 min-[720px]:hidden">
        <Link href="/" aria-label="Tunely home" className="flex min-h-11 items-center rounded-lg">
          <LogoMark />
        </Link>
        <div className="flex items-center">
          <InstallButton />
          <ThemeToggle />
        </div>
      </header>
      <nav
        aria-label="Main"
        className="border-border bg-bg fixed inset-x-0 bottom-0 z-30 flex shrink-0 items-center justify-around gap-1 border-t px-2 pt-1 pb-[max(4px,env(safe-area-inset-bottom))] min-[720px]:sticky min-[720px]:top-0 min-[720px]:h-dvh min-[720px]:w-[88px] min-[720px]:flex-col min-[720px]:justify-start min-[720px]:border-t-0 min-[720px]:border-r min-[720px]:py-5"
      >
        <Link
          href="/"
          aria-label="Tunely home"
          className="mb-4 hidden size-12 items-center justify-center rounded-lg min-[720px]:flex"
        >
          <LogoMark />
        </Link>
        {NAV.map((item) => (
          <NavLink key={item.href} href={item.href} label={item.label}>
            <item.icon />
          </NavLink>
        ))}
        <span className="hidden grow min-[720px]:block" />
        <span className="hidden min-[720px]:contents">
          <InstallButton />
          <ThemeToggle />
        </span>
      </nav>
      <div className="flex min-w-0 grow flex-col pb-[calc(60px+env(safe-area-inset-bottom))] min-[720px]:pb-0">
        <main id="main" className="grow">
          {children}
        </main>
        <footer className="border-border text-text-muted flex flex-wrap items-center justify-between gap-x-8 gap-y-4 border-t px-4 py-7 text-[13px] sm:px-14">
          <p className="max-w-[560px] leading-relaxed">
            Tunely links to publicly available streams and does not host any video. Channel data from the
            open-source{' '}
            <a
              href="https://github.com/iptv-org/iptv"
              className="underline underline-offset-2"
              rel="noopener"
            >
              iptv-org
            </a>{' '}
            project.
          </p>
          <nav aria-label="Site" className="flex flex-wrap gap-x-5 gap-y-2">
            {FOOTER_PAGES.map((p) => (
              <Link key={p.href} href={p.href} className="text-text-muted hover:text-text">
                {p.label}
              </Link>
            ))}
            {SUPPORT_URL && (
              <a href={SUPPORT_URL} target="_blank" rel="noopener" className="text-accent font-semibold">
                ♥ Support Tunely
              </a>
            )}
          </nav>
        </footer>
      </div>
      <SearchCommand />
      <GlobalPlayer />
    </div>
  );
}
