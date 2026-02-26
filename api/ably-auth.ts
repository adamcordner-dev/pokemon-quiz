// ============================================
// GET /api/ably-auth
// ============================================
// Creates a temporary Ably token request for client authentication.
// The client calls this endpoint to get a token without exposing the API key.

import type { VercelRequest, VercelResponse } from '@vercel/node';
import Ably from 'ably';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const apiKey = process.env.ABLY_API_KEY;
    if (!apiKey) {
      return res.status(501).json({
        error: 'Real-time features are not configured (ABLY_API_KEY missing)',
      });
    }

    const client = new Ably.Rest({ key: apiKey });
    const tokenRequest = await client.auth.createTokenRequest({
      capability: { 'game:*': ['subscribe', 'publish'] },
    });

    return res.status(200).json(tokenRequest);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return res.status(500).json({ error: message });
  }
}
