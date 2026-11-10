'use client';

import { magicLinkClient } from 'better-auth/client/plugins';
import { createAuthClient } from 'better-auth/react';

// Same origin (/api/auth), so the session cookie is first-party.
export const authClient = createAuthClient({ plugins: [magicLinkClient()] });
