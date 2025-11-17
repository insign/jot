/**
 * Jot - Telegram Interface for Jules
 * Main Cloudflare Worker entry point
 *
 * This worker provides a Telegram bot interface for Jules (Google's AI coding assistant)
 * Features:
 * - Multi-tenant support (each Telegram group is isolated)
 * - 1:1 mapping between Telegram topics and Jules sessions
 * - Automatic activity polling via cron triggers
 * - Image support (send screenshots/designs to Jules)
 * - Smart notifications (important events with sound, others silent)
 * - GitHub links extraction and formatting
 *
 * License: AGPL-3.0-or-later
 */

import { createBot, createWebhookHandler } from './bot/bot';
import type { BotContext } from './bot/bot';
import type { Env } from './types/env';

// Import command handlers
import { handleStart, handleHelp } from './bot/commands/basicCommands';
import {
  handleSetJulesToken,
  handleSetSource,
  handleSetBranch,
  handleSetAutoPR,
  handleRequireApproval,
} from './bot/commands/configCommands';
import {
  handleStatus,
  handleGetSource,
  handleListSources,
  handleSearchSources,
  handleListSessions,
  handleSessionInfo,
  handleListActivities,
  handleShowPlan,
  handleShowOutputs,
  handleOpenJulesSettings,
} from './bot/commands/infoCommands';
import {
  handleNewSession,
  handleApprovePlan,
  handleDeleteSession,
  handleSync,
} from './bot/commands/actionCommands';

// Import message handlers
import { handleTextMessage, handlePhotoMessage } from './bot/handlers/messageHandlers';
import { handleCallbackQuery } from './bot/handlers/callbackHandlers';

// Import cron handlers
import { pollActivities } from './cron/pollActivities';
import { syncSessions } from './cron/syncSessions';

/**
 * Setup bot with all command and message handlers
 */
function setupBot(bot: ReturnType<typeof createBot>): void {
  // Basic commands
  bot.command('start', handleStart);
  bot.command('help', handleHelp);

  // Configuration commands (admin only)
  bot.command('set_jules_token', handleSetJulesToken);
  bot.command('set_source', handleSetSource);
  bot.command('set_branch', handleSetBranch);
  bot.command('set_auto_pr', handleSetAutoPR);
  bot.command('require_approval', handleRequireApproval);

  // Information commands
  bot.command('status', handleStatus);
  bot.command('get_source', handleGetSource);
  bot.command('list_sources', handleListSources);
  bot.command('search_sources', handleSearchSources);
  bot.command('list_sessions', handleListSessions);
  bot.command('session_info', handleSessionInfo);
  bot.command('list_activities', handleListActivities);
  bot.command('show_plan', handleShowPlan);
  bot.command('show_outputs', handleShowOutputs);
  bot.command('open_jules_settings', handleOpenJulesSettings);

  // Action commands
  bot.command('new_session', handleNewSession);
  bot.command('approve_plan', handleApprovePlan);
  bot.command('delete_session', handleDeleteSession);
  bot.command('sync', handleSync);

  // Message handlers
  bot.on('message:text', handleTextMessage);
  bot.on('message:photo', handlePhotoMessage);

  // Callback query handlers (inline buttons)
  bot.on('callback_query:data', handleCallbackQuery);

  // Error handler
  bot.catch((err) => {
    console.error('Bot error:', err);
  });
}

/**
 * Main Worker export
 * Handles HTTP requests (webhooks) and scheduled events (cron)
 */
export default {
  /**
   * Handle HTTP requests (Telegram webhook)
   */
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    // Check if request is from Telegram
    const url = new URL(request.url);

    // Health check endpoint
    if (url.pathname === '/health') {
      return new Response('OK', { status: 200 });
    }

    // Webhook endpoint
    if (url.pathname === '/' || url.pathname === '/webhook') {
      try {
        // Create bot instance
        const bot = createBot(env.BOT_TOKEN, env);

        // Setup handlers
        setupBot(bot);

        // Handle webhook
        const webhookHandler = createWebhookHandler(bot);
        return await webhookHandler(request);
      } catch (error) {
        console.error('Error handling webhook:', error);
        return new Response('Internal Server Error', { status: 500 });
      }
    }

    // Unknown endpoint
    return new Response('Not Found', { status: 404 });
  },

  /**
   * Handle scheduled events (cron triggers)
   */
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    console.log('[CRON] Scheduled event triggered:', event.cron);

    try {
      // Determine which cron job to run based on schedule
      // Note: Cloudflare doesn't pass the cron pattern, so we need to infer it

      // For now, we'll run both jobs on every trigger
      // In production, you should use different endpoints or time-based logic

      // Check the minute to determine which job to run
      const now = new Date();
      const minute = now.getMinutes();

      if (minute % 15 === 0) {
        // Run session sync every 15 minutes
        console.log('[CRON] Running session sync...');
        await syncSessions(env);
      }

      // Run activity polling every minute
      console.log('[CRON] Running activity polling...');
      await pollActivities(env);

      console.log('[CRON] Scheduled event complete');
    } catch (error) {
      console.error('[CRON] Error in scheduled event:', error);
    }
  },
};
