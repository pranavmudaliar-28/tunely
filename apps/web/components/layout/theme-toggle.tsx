'use client';

import { SunIcon } from '@/components/ui/icons';

export const THEME_KEY = 'tunely.theme';

/** Runs before paint (inlined in <head>) so the saved theme never flashes. */
export const themeScript = `try{var t=localStorage.getItem('${THEME_KEY}');if(t==='light'||t==='dark')document.documentElement.dataset.theme=t}catch(e){}`;

export function ThemeToggle() {
  const toggle = () => {
    const next = document.documentElement.dataset.theme === 'light' ? 'dark' : 'light';
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem(THEME_KEY, next);
    } catch {
      // Storage blocked: the theme still applies for this page view.
    }
  };
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label="Switch between dark and light theme"
      className="text-text-muted hover:text-text flex min-h-11 w-16 flex-col items-center justify-center gap-1 rounded-[10px] py-2 text-[11px] font-medium min-[720px]:w-[72px]"
    >
      <SunIcon />
      Theme
    </button>
  );
}
