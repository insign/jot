/**
 * Poll activities cron job
 * Automatically fetches new activities for all active sessions and sends to Telegram
 * Runs every 1-2 minutes
 */

import type { Env, SessionData } from '../types/env';
import { Bot } from 'grammy';
import { createBot, BotContext } from '../bot/bot';
import {
  getJulesToken,
  getSessionsIndex,
  getSession,
  getLastActivityId,
  setLastActivityId,
} from '../kv/storage';
import { createJulesClient, isAuthError, isSessionNotFoundError } from '../jules/api';
import { processActivity } from '../bot/handlers/activityProcessor';

/**
 * Poll activities for all active sessions
 * This is called by the scheduled cron trigger
 */
export async function pollActivities(env: Env): Promise<void> {
  console.log('[CRON] Starting activities polling...');

  // Get all groups with sessions
  // Note: We need to maintain a list of groups in KV
  // For now, we'll need to implement a way to track active groups
  // This is a limitation of KV - we can't easily list all keys with a pattern

  // TODO: Implement group tracking
  // For now, this is a placeholder that shows the logic

  console.log('[CRON] Activities polling complete');
}

/**
 * Poll activities for a specific group
 */
export async function pollActivitiesForGroup(
  env: Env,
  bot: Bot<BotContext>,
  groupId: string
): Promise<void> {
  console.log(`[CRON] Polling activities for group ${groupId}`);

  // Get Jules token for group
  const token = await getJulesToken(env, groupId);

  if (!token) {
    console.log(`[CRON] No token configured for group ${groupId}, skipping`);
    return;
  }

  // Get sessions index
  const sessionsIndex = await getSessionsIndex(env, groupId);

  if (sessionsIndex.length === 0) {
    console.log(`[CRON] No active sessions for group ${groupId}`);
    return;
  }

  console.log(`[CRON] Found ${sessionsIndex.length} sessions for group ${groupId}`);

  const julesClient = createJulesClient(token);

  // Process each session
  for (const sessionId of sessionsIndex) {
    try {
      await pollActivitiesForSession(env, bot, groupId, sessionId, julesClient);
    } catch (error) {
      console.error(`[CRON] Error polling session ${sessionId}:`, error);

      // Check if it's an auth error
      if (error instanceof Error && isAuthError(error)) {
        console.log(`[CRON] Auth error for group ${groupId}, stopping polling`);
        // TODO: Notify group admins about invalid token
        break;
      }

      // Check if session was deleted
      if (error instanceof Error && isSessionNotFoundError(error)) {
        console.log(`[CRON] Session ${sessionId} not found, will be cleaned up in sync`);
        continue;
      }
    }
  }
}

/**
 * Poll activities for a specific session
 */
async function pollActivitiesForSession(
  env: Env,
  bot: Bot<BotContext>,
  groupId: string,
  sessionId: string,
  julesClient: any
): Promise<void> {
  // Find the session in KV to get topic_id
  // Note: We need to store a mapping of session_id to topic_id
  // For now, we'll need to iterate through possible topics or maintain a better index

  // TODO: Implement better session indexing
  // Current KV structure makes it hard to get session by session_id
  // We should add a reverse mapping: session_id -> topic_id

  console.log(`[CRON] Polling activities for session ${sessionId}`);

  // Get last activity ID
  // Note: We need topic_id for this
  // This is a design issue that needs to be fixed

  // For now, this is a placeholder
}

/**
 * Process new activities for a session
 */
async function processNewActivities(
  env: Env,
  bot: Bot<BotContext>,
  groupId: string,
  topicId: number,
  sessionId: string,
  julesClient: any
): Promise<void> {
  // Get last activity timestamp
  const lastActivityId = await getLastActivityId(env, groupId, topicId);

  // Get all activities
  const activities = await julesClient.listActivities(sessionId);

  if (activities.length === 0) {
    return;
  }

  // Filter new activities
  let newActivities = activities;

  if (lastActivityId) {
    // Find index of last activity
    const lastIndex = activities.findIndex((a: any) => a.name === lastActivityId);

    if (lastIndex !== -1) {
      // Get activities after last one
      newActivities = activities.slice(lastIndex + 1);
    }
  }

  if (newActivities.length === 0) {
    return;
  }

  console.log(`[CRON] Found ${newActivities.length} new activities for session ${sessionId}`);

  // Create a temporary context for sending messages
  // Note: This is a workaround since we don't have a real context in cron
  const ctx = {
    env,
    api: bot.api,
  } as BotContext;

  // Process each new activity
  for (const activity of newActivities) {
    try {
      await processActivity(ctx, groupId, topicId, sessionId, activity);

      // Update last activity ID
      await setLastActivityId(env, groupId, topicId, activity.name);
    } catch (error) {
      console.error(`[CRON] Error processing activity ${activity.name}:`, error);
    }
  }
}
