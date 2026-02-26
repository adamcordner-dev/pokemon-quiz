// ============================================
// Ably Service
// ============================================
// Server-side Ably publishing for real-time multiplayer events.
// In production, ABLY_API_KEY must be set.
// For local development, publishing is a no-op if ABLY_API_KEY is not set.

import Ably from 'ably';

let ablyClient: Ably.Rest | null = null;

/**
 * Get or create the Ably REST client.
 * Returns null if ABLY_API_KEY is not configured (local dev only).
 */
function getAblyClient(): Ably.Rest | null {
  if (ablyClient) return ablyClient;

  const apiKey = process.env.ABLY_API_KEY;
  if (!apiKey) {
    // In production this should never happen; in local dev, allow graceful degradation
    if (process.env.VERCEL_ENV) {
      console.error('[Ably] ABLY_API_KEY not set in production!');
    }
    return null;
  }

  ablyClient = new Ably.Rest({ key: apiKey });
  return ablyClient;
}

/**
 * Publish an event to a game session's Ably channel.
 * No-op if Ably is not configured (allows local single-player dev without Ably).
 *
 * @param sessionId  The session to publish to (channel: `game:{sessionId}`)
 * @param eventName  The event name (e.g. 'player_joined', 'game_started')
 * @param data       The event payload
 */
export async function publishToSession(
  sessionId: string,
  eventName: string,
  data: unknown
): Promise<void> {
  const client = getAblyClient();
  if (!client) {
    // Silently skip — local dev without Ably
    return;
  }

  const channel = client.channels.get(`game:${sessionId}`);
  await channel.publish(eventName, data);
}
