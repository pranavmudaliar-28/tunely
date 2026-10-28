import { expect, test } from 'vitest';
import { ChannelListQuerySchema, PlaybackReportSchema } from './api';

test('channel list query normalizes country and defaults limit', () => {
  expect(ChannelListQuerySchema.parse({ country: 'in' })).toEqual({ country: 'IN', limit: 48 });
  expect(ChannelListQuerySchema.safeParse({ limit: '500' }).success).toBe(false);
});

test('playback report rejects unknown error types', () => {
  const base = { streamId: crypto.randomUUID(), platform: 'web', result: 'error', sessionId: 'abcdefgh12' };
  expect(PlaybackReportSchema.parse({ ...base, errorType: 'offline' }).errorType).toBe('offline');
  expect(PlaybackReportSchema.safeParse({ ...base, errorType: 'hacked' }).success).toBe(false);
});
