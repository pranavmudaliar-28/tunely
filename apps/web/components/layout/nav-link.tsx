'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

export function NavLink({
  href,
  label,
  children,
}: {
  href: string;
  label: string;
  children: React.ReactNode;
}) {
  const path = usePathname();
  const active = href === '/' ? path === '/' : path.startsWith(href);
  return (
    <Link
      href={href}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'flex min-h-11 w-16 flex-col items-center justify-center gap-1 rounded-[10px] py-2 text-[11px] font-medium min-[720px]:w-[72px]',
        active ? 'bg-surface-raised text-text font-semibold' : 'text-text-muted hover:text-text',
      )}
    >
      {children}
      {label}
    </Link>
  );
}
