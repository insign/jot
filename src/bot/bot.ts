/**
 * Grammy Bot configuration and setup
 * Handles bot initialization with optimized settings for Cloudflare Workers
 */

import { Bot, webhookCallback, Context, InputFile } from 'grammy';
import type { Env } from '../types/env';

/**
 * Extended context with environment bindings
 */
export interface BotContext extends Context {
  env: Env;
}

/**
 * Create and configure bot instance
 * Uses botInfo pre-configuration to avoid unnecessary getMe calls
 */
export function createBot(botToken: string, env: Env): Bot<BotContext> {
  const bot = new Bot<BotContext>(botToken);

  // Attach env to context for all handlers
  bot.use(async (ctx, next) => {
    ctx.env = env;
    await next();
  });

  return bot;
}

/**
 * Create webhook callback for handling Telegram updates
 * Used in the main Worker fetch handler
 */
export function createWebhookHandler(bot: Bot<BotContext>) {
  return webhookCallback(bot, 'cloudflare-mod');
}

/**
 * Extract group ID from context
 * Returns null if not in a group chat
 */
export function getGroupId(ctx: Context): string | null {
  const chat = ctx.chat;
  if (!chat) return null;

  // Check if it's a group or supergroup
  if (chat.type === 'group' || chat.type === 'supergroup') {
    return String(chat.id);
  }

  return null;
}

/**
 * Extract topic ID from context
 * Returns null if not in a topic (forum thread)
 */
export function getTopicId(ctx: Context): number | null {
  return ctx.message?.message_thread_id || ctx.callbackQuery?.message?.message_thread_id || null;
}

/**
 * Check if user is admin in the group
 * Used for permission checks on sensitive commands
 */
export async function isUserAdmin(ctx: Context): Promise<boolean> {
  const groupId = getGroupId(ctx);
  const userId = ctx.from?.id;

  if (!groupId || !userId) return false;

  try {
    const member = await ctx.api.getChatMember(groupId, userId);
    return member.status === 'creator' || member.status === 'administrator';
  } catch (error) {
    console.error('Error checking admin status:', error);
    return false;
  }
}

/**
 * Check if bot has permission to manage topics
 * Required for updating topic names with session info
 */
export async function canBotManageTopics(ctx: Context): Promise<boolean> {
  const groupId = getGroupId(ctx);
  if (!groupId) return false;

  try {
    const botMember = await ctx.api.getChatMember(groupId, ctx.me.id);

    // Check if bot is admin and has can_manage_topics permission
    if (botMember.status === 'administrator') {
      return (botMember as any).can_manage_topics === true;
    }

    return false;
  } catch (error) {
    console.error('Error checking bot permissions:', error);
    return false;
  }
}

/**
 * Show typing indicator
 * Makes the bot appear to be typing
 */
export async function showTypingIndicator(ctx: Context): Promise<void> {
  const groupId = getGroupId(ctx);
  const topicId = getTopicId(ctx);

  if (!groupId) return;

  try {
    await ctx.api.sendChatAction(groupId, 'typing', {
      message_thread_id: topicId || undefined,
    });
  } catch (error) {
    console.error('Error sending typing indicator:', error);
  }
}

/**
 * Start typing indicator loop
 * Keeps showing typing indicator every 4-5 seconds
 * Returns a function to stop the loop
 */
export function startTypingLoop(ctx: Context): () => void {
  let stopped = false;

  const loop = async () => {
    while (!stopped) {
      await showTypingIndicator(ctx);
      await new Promise(resolve => setTimeout(resolve, 4500)); // 4.5 seconds
    }
  };

  loop();

  return () => {
    stopped = true;
  };
}

/**
 * Send message with notification control
 * Handles silent notifications based on message importance
 */
export async function sendMessage(
  ctx: Context,
  text: string,
  options: {
    silent?: boolean;
    parseMode?: 'HTML' | 'Markdown' | 'MarkdownV2';
    replyMarkup?: any;
  } = {}
): Promise<void> {
  const groupId = getGroupId(ctx);
  const topicId = getTopicId(ctx);

  if (!groupId) return;

  try {
    await ctx.api.sendMessage(groupId, text, {
      message_thread_id: topicId || undefined,
      disable_notification: options.silent || false,
      parse_mode: options.parseMode || 'HTML',
      reply_markup: options.replyMarkup,
    });
  } catch (error) {
    console.error('Error sending message:', error);
  }
}

/**
 * Update topic title with session info
 * Format: "user/repo session_id"
 */
export async function updateTopicTitle(
  ctx: Context,
  groupId: string,
  topicId: number,
  owner: string,
  repo: string,
  sessionId: string
): Promise<void> {
  try {
    const title = `${owner}/${repo} ${sessionId.split('/').pop()}`;

    await ctx.api.editForumTopic(groupId, topicId, { name: title });
  } catch (error) {
    console.error('Error updating topic title:', error);
  }
}

/**
 * Send photo with caption
 * Used when Jules returns images
 */
export async function sendPhoto(
  ctx: Context,
  photo: Uint8Array,
  caption?: string,
  silent?: boolean
): Promise<void> {
  const groupId = getGroupId(ctx);
  const topicId = getTopicId(ctx);

  if (!groupId) return;

  try {
    await ctx.api.sendPhoto(groupId, new InputFile(photo, 'image.jpg'), {
      message_thread_id: topicId || undefined,
      caption: caption,
      disable_notification: silent || false,
    });
  } catch (error) {
    console.error('Error sending photo:', error);
  }
}
