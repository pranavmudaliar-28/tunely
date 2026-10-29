import { SITE_NAME, SITE_URL } from '@/lib/site';

const linkClass =
  'flex h-12 items-center gap-2 rounded-[8px] px-[18px] text-[15px] font-semibold text-[#0B0D12] no-underline';

/** One-tap WhatsApp and Telegram sharing: word of mouth is how most people find a free TV site. */
export function SocialShare({ name, path }: { name: string; path: string }) {
  const url = `${SITE_URL}${path}`;
  const text = `Watch ${name} live free on ${SITE_NAME}`;
  return (
    <>
      <a
        href={`https://wa.me/?text=${encodeURIComponent(`${text}: ${url}`)}`}
        target="_blank"
        rel="noopener"
        className={linkClass}
        style={{ background: '#25D366' }}
        aria-label={`Share ${name} on WhatsApp`}
      >
        WhatsApp
      </a>
      <a
        href={`https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`}
        target="_blank"
        rel="noopener"
        className={linkClass}
        style={{ background: '#2AABEE' }}
        aria-label={`Share ${name} on Telegram`}
      >
        Telegram
      </a>
    </>
  );
}
