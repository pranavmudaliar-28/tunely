import { ChannelSummarySchema } from '@tunely/shared';
import { z } from 'zod';
import { FOLDER_LIMIT, FOLDER_NAME_MAX, HISTORY_LIMIT } from './limits';

/** What an account keeps: the browser's library plus its settings. Validated on the server before it is stored. */
export const SyncDocSchema = z.object({
  favorites: z.array(ChannelSummarySchema).max(1000),
  history: z
    .array(
      z.object({
        channel: ChannelSummarySchema,
        lastWatchedAt: z.number().int().nonnegative(),
        watchSeconds: z.number().int().min(0).max(1e9),
      }),
    )
    .max(HISTORY_LIMIT),
  folders: z
    .array(
      z.object({
        id: z.string().min(1).max(64),
        name: z.string().min(1).max(FOLDER_NAME_MAX),
        channelIds: z.array(z.string().max(200)).max(1000),
      }),
    )
    .max(FOLDER_LIMIT),
  // Cleaned by cleanPrefs when it is applied in a browser.
  prefs: z.record(z.string(), z.unknown()).default({}),
});
export type SyncDoc = z.infer<typeof SyncDocSchema>;

/** Biggest document the server accepts (a full library is well under 300 KB). */
export const SYNC_MAX_BYTES = 512 * 1024;
