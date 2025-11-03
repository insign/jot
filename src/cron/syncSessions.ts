/**
 * Sync sessions cron job
 * Synchronizes local sessions with Jules API
 * Detects deleted sessions and updates status
 * Runs every 15-30 minutes
 */

import type { Env } from '../types/env';
import { Bot } from 'grammy';
import { BotContext } from '../bot/bot';
import {
  getJulesToken,
  getSessionsIndex,
  removeFromSessionsIndex,
} from '../kv/storage';
import { createJulesClient, isAuthError, isSessionNotFoundError } from '../jules/api';

/**
 * Sync sessions for all groups
 * This is called by the scheduled cron trigger
 */
export async function syncSessions(env: Env): Promise<void> {
  console.log('[CRON] Starting sessions sync...');

  // Get all groups with sessions
  // Note: We need to maintain a list of groups in KV
  // For now, this is a placeholder

  // TODO: Implement group tracking

  console.log('[CRON] Sessions sync complete');
}

/**
 * Sync sessions for a specific group
 */
export async function syncSessionsForGroup(
  env: Env,
  bot: Bot<BotContext>,
  groupId: string
): Promise<void> {
  console.log(`[CRON] Syncing sessions for group ${groupId}`);

  // Get Jules token for group
  const token = await getJulesToken(env, groupId);

  if (!token) {
    console.log(`[CRON] No token configured for group ${groupId}, skipping`);
    return;
  }

  try {
    const julesClient = createJulesClient(token);

    // Get remote sessions from Jules
    const remoteSessions = await julesClient.listSessions();
    const remoteSessionIds = new Set(remoteSessions.map(s => s.name));

    // Get local sessions from KV
    const localSessionIds = await getSessionsIndex(env, groupId);

    // Find deleted sessions (in local but not in remote)
    const deletedSessions = localSessionIds.filter(id => !remoteSessionIds.has(id));

    if (deletedSessions.length > 0) {
      console.log(`[CRON] Found ${deletedSessions.length} deleted sessions for group ${groupId}`);

      // Remove deleted sessions from KV
      for (const sessionId of deletedSessions) {
        try {
          await removeFromSessionsIndex(env, groupId, sessionId);

          // TODO: Remove session data from topics
          // This requires maintaining a reverse mapping

          console.log(`[CRON] Removed deleted session ${sessionId}`);

          // TODO: Notify group about deleted session
          // We would need the topic_id to send a message
        } catch (error) {
          console.error(`[CRON] Error removing session ${sessionId}:`, error);
        }
      }
    }

    // TODO: Update status and outputs for existing sessions
    // This would involve fetching each session and updating KV

    console.log(`[CRON] Sync complete for group ${groupId}: ${localSessionIds.length} local, ${remoteSessions.length} remote, ${deletedSessions.length} removed`);
  } catch (error) {
    console.error(`[CRON] Error syncing sessions for group ${groupId}:`, error);

    if (error instanceof Error && isAuthError(error)) {
      console.log(`[CRON] Auth error for group ${groupId}`);
      // TODO: Notify group admins about invalid token
    }
  }
}
