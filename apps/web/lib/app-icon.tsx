import { ImageResponse } from 'next/og';

/** The Tunely mark (same as app/icon.svg) as a PNG, for the install manifest and iOS home screen. */
export function appIcon(size: number) {
  // Logo at 60% so it stays inside the "maskable" safe zone when Android crops the icon to a circle.
  const mark = Math.round(size * 0.6);
  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#0B0D12',
      }}
    >
      <svg width={mark} height={mark} viewBox="0 0 28 28">
        <circle cx="14" cy="14" r="12" fill="none" stroke="#FF4D4F" strokeWidth="2.4" />
        <path d="M11 8.5v11l8.5-5.5z" fill="#FF4D4F" />
      </svg>
    </div>,
    { width: size, height: size },
  );
}
