'use client';

import { attachStream, type PlaybackError } from '@/lib/player/attach';
import { useEffect, useRef, useState } from 'react';

interface Item {
  stream_id: string;
  name: string;
  url: string;
  score: number;
}
type Result = { ok: true; ttffMs: number } | { ok: false; error: PlaybackError };

const TIMEOUT_MS = 15_000;

function playOnce(video: HTMLVideoElement, url: string): Promise<Result> {
  return new Promise((resolve) => {
    const started = performance.now();
    let attached: { destroy(): void } | null = null;
    let done = false;
    const finish = (r: Result) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      video.removeEventListener('playing', onPlaying);
      attached?.destroy();
      resolve(r);
    };
    const onPlaying = () => finish({ ok: true, ttffMs: Math.round(performance.now() - started) });
    const timer = setTimeout(() => finish({ ok: false, error: 'timeout' }), TIMEOUT_MS);
    video.addEventListener('playing', onPlaying);
    void attachStream(video, url, { onError: (error) => finish({ ok: false, error }) }).then((a) => {
      attached = a;
      if (done) a.destroy();
      void video.play().catch(() => {});
    });
  });
}

export function StreamTest({ items }: { items: Item[] }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [results, setResults] = useState<Record<string, Result>>({});

  useEffect(() => {
    let cancelled = false;
    (async () => {
      for (const item of items) {
        if (cancelled || !videoRef.current) return;
        const r = await playOnce(videoRef.current, item.url);
        if (!cancelled) setResults((prev) => ({ ...prev, [item.stream_id]: r }));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [items]);

  const done = Object.values(results);
  const ok = done.filter((r) => r.ok).length;
  const pct = done.length ? Math.round((100 * ok) / done.length) : 0;

  return (
    <div className="mt-6 grid gap-6 md:grid-cols-[320px_1fr]">
      <div>
        <video ref={videoRef} muted playsInline className="aspect-video w-full rounded-[12px] bg-black" />
        <p className="mt-4 text-3xl font-bold" data-testid="success-rate">
          {pct}%{' '}
          <span className="text-text-muted text-base font-normal">
            ({ok}/{done.length} of {items.length})
          </span>
        </p>
        <p className="text-text-muted text-sm">Target: at least 80%.</p>
      </div>
      <table className="text-sm">
        <thead className="text-text-muted text-left">
          <tr>
            <th className="py-1">Channel</th>
            <th>Score</th>
            <th>Result</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => {
            const r = results[item.stream_id];
            return (
              <tr key={item.stream_id} className="border-border border-t">
                <td className="py-1 pr-2">{item.name}</td>
                <td>{item.score}</td>
                <td className={r ? (r.ok ? 'text-success' : 'text-warning') : 'text-text-muted'}>
                  {!r ? '…' : r.ok ? `ok, ${r.ttffMs} ms` : r.error}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
