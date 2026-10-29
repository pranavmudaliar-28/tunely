import type { SVGProps } from 'react';

// Stroke icons from the design canvas. Decorative by default; give the parent control the label.
type P = SVGProps<SVGSVGElement> & { size?: number };
const base = ({ size = 22, ...p }: P) => ({
  width: size,
  height: size,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
  focusable: false,
  ...p,
});

export const SearchIcon = (p: P) => (
  <svg {...base(p)}>
    <circle cx="11" cy="11" r="7" />
    <path d="M20 20l-3.5-3.5" />
  </svg>
);
export const HomeIcon = (p: P) => (
  <svg {...base(p)}>
    <path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z" />
  </svg>
);
export const TvIcon = (p: P) => (
  <svg {...base(p)}>
    <rect x="3" y="7" width="18" height="13" rx="2" />
    <path d="M8 3l4 4 4-4" />
  </svg>
);
export const GridIcon = (p: P) => (
  <svg {...base(p)}>
    <rect x="4" y="4" width="7" height="7" rx="1.5" />
    <rect x="13" y="4" width="7" height="7" rx="1.5" />
    <rect x="4" y="13" width="7" height="7" rx="1.5" />
    <rect x="13" y="13" width="7" height="7" rx="1.5" />
  </svg>
);
export const HeartIcon = ({ filled, ...p }: P & { filled?: boolean }) => (
  <svg {...base(p)} fill={filled ? 'currentColor' : 'none'}>
    <path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z" />
  </svg>
);
export const PlayIcon = (p: P) => (
  <svg {...base(p)} fill="currentColor" stroke="none">
    <path d="M7 4v16l13-8z" />
  </svg>
);
export const PauseIcon = (p: P) => (
  <svg {...base(p)} strokeWidth={2.4}>
    <path d="M8 5v14M16 5v14" />
  </svg>
);
export const ChevronUp = (p: P) => (
  <svg {...base(p)}>
    <path d="M18 15l-6-6-6 6" />
  </svg>
);
export const ChevronDown = (p: P) => (
  <svg {...base(p)}>
    <path d="M6 9l6 6 6-6" />
  </svg>
);
export const ChevronLeft = (p: P) => (
  <svg {...base(p)}>
    <path d="M15 6l-6 6 6 6" />
  </svg>
);
export const ChevronRight = (p: P) => (
  <svg {...base(p)}>
    <path d="M9 6l6 6-6 6" />
  </svg>
);
export const VolumeIcon = ({ muted, ...p }: P & { muted?: boolean }) => (
  <svg {...base(p)}>
    <path d="M4 9v6h4l5 4V5L8 9z" />
    {muted ? <path d="M17 9l4 6M21 9l-4 6" /> : <path d="M16.5 8.5a5 5 0 0 1 0 7" />}
  </svg>
);
export const PipIcon = (p: P) => (
  <svg {...base(p)}>
    <rect x="3" y="5" width="18" height="14" rx="2" />
    <rect x="12" y="11" width="7" height="6" rx="1" />
  </svg>
);
export const FullscreenIcon = (p: P) => (
  <svg {...base(p)}>
    <path d="M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5" />
  </svg>
);
export const ShareIcon = (p: P) => (
  <svg {...base(p)}>
    <path d="M4 12v7a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7M16 6l-4-4-4 4M12 2v13" />
  </svg>
);
export const CloseIcon = (p: P) => (
  <svg {...base(p)}>
    <path d="M6 6l12 12M18 6L6 18" />
  </svg>
);
export const SunIcon = (p: P) => (
  <svg {...base(p)}>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
  </svg>
);
export const OfflineIcon = (p: P) => (
  <svg {...base(p)}>
    <path d="M2 8.8a15 15 0 0 1 4.2-2.7M22 8.8A15 15 0 0 0 10.7 5M5 12.4a10 10 0 0 1 3.4-2M19 12.4a10 10 0 0 0-2.2-1.5M8.5 16a5 5 0 0 1 5.6-.7M12 20h.01M3 3l18 18" />
  </svg>
);
export const GlobeIcon = (p: P) => (
  <svg {...base(p)}>
    <circle cx="12" cy="12" r="9" />
    <path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" />
  </svg>
);
export const BlockedIcon = (p: P) => (
  <svg {...base(p)}>
    <rect x="3" y="4" width="18" height="16" rx="2" />
    <path d="M3 9h18M9 13l6 4M15 13l-6 4" />
  </svg>
);
export const LogoMark = ({ size = 34 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 28 28" fill="none" aria-hidden="true">
    <circle cx="14" cy="14" r="12" stroke="var(--accent)" strokeWidth="2" />
    <path d="M11.5 9.5v9l7-4.5z" fill="var(--accent)" />
  </svg>
);
export const InstallIcon = (p: P) => (
  <svg {...base(p)}>
    <path d="M12 3v12" />
    <path d="M7 10l5 5 5-5" />
    <path d="M5 21h14" />
  </svg>
);
