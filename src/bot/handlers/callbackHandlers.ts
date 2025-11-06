/**
 * Callback query handlers
 * Handles inline button clicks (approve plan, publish branch/PR, delete session, etc.)
 */

import type { BotContext } from '../bot';
import { getGroupId, getTopicId } from '../bot';
import {
  getJulesToken,
  getSession,
  deleteSession as deleteSessionKV,
  removeFromSessionsIndex,
  setPendingPlan,
} from '../../kv/storage';
import { createJulesClient } from '../../jules/api';
import { extractGitHubLinks, formatGitHubLinks } from '../../utils/github';
import { escapeHtml } from '../../utils/formatters';

/**
 * Handle callback query for approving plan
 * Pattern: approve_plan:{session_id}
 */
export async function handleApprovePlanCallback(ctx: BotContext): Promise<void> {
  const data = ctx.callbackQuery?.data;

  if (!data || !data.startsWith('approve_plan:')) {
    return;
  }

  const sessionId = data.replace('approve_plan:', '');

  const groupId = getGroupId(ctx);
  const topicId = getTopicId(ctx);

  if (!groupId || !topicId) {
    await ctx.answerCallbackQuery({ text: '⚠️ Invalid context' });
    return;
  }

  const token = await getJulesToken(ctx.env, groupId);

  if (!token) {
    await ctx.answerCallbackQuery({ text: '⚠️ Jules token not configured' });
    return;
  }

  try {
    const julesClient = createJulesClient(token);
    await julesClient.approvePlan(sessionId);

    // Clear pending plan flag
    await setPendingPlan(ctx.env, groupId, topicId, false);

    // Update message to remove button
    await ctx.editMessageReplyMarkup({ reply_markup: undefined });

    // Send confirmation
    await ctx.reply(
      '✅ <b>Plan approved!</b>\n\nJules will start working on the implementation.',
      { parse_mode: 'HTML', disable_notification: true }
    );

    await ctx.answerCallbackQuery({ text: '✅ Plan approved!' });
  } catch (error) {
    console.error('Error approving plan:', error);
    await ctx.answerCallbackQuery({ text: '❌ Failed to approve plan' });
  }
}

/**
 * Handle callback query for publishing branch
 * Pattern: publish_branch:{session_id}
 */
export async function handlePublishBranchCallback(ctx: BotContext): Promise<void> {
  const data = ctx.callbackQuery?.data;

  if (!data || !data.startsWith('publish_branch:')) {
    return;
  }

  const sessionId = data.replace('publish_branch:', '');

  const groupId = getGroupId(ctx);

  if (!groupId) {
    await ctx.answerCallbackQuery({ text: '⚠️ Invalid context' });
    return;
  }

  const token = await getJulesToken(ctx.env, groupId);

  if (!token) {
    await ctx.answerCallbackQuery({ text: '⚠️ Jules token not configured' });
    return;
  }

  try {
    const julesClient = createJulesClient(token);

    // Note: Jules API may not have publishBranch endpoint
    // This is a placeholder - may need to be implemented differently
    try {
      const result = await julesClient.publishBranch(sessionId);

      // Update message to show branch link
      await ctx.editMessageText(
        ctx.callbackQuery?.message?.text + '\n\n✅ <b>Branch published!</b>\n🌿 ' + result.branchUrl,
        { parse_mode: 'HTML' }
      );

      await ctx.answerCallbackQuery({ text: '✅ Branch published!' });
    } catch (error) {
      // If endpoint doesn't exist, inform user
      await ctx.answerCallbackQuery({
        text: '⚠️ This feature requires manual action via jules.google',
        show_alert: true,
      });
    }
  } catch (error) {
    console.error('Error publishing branch:', error);
    await ctx.answerCallbackQuery({ text: '❌ Failed to publish branch' });
  }
}

/**
 * Handle callback query for publishing PR
 * Pattern: publish_pr:{session_id}
 */
export async function handlePublishPRCallback(ctx: BotContext): Promise<void> {
  const data = ctx.callbackQuery?.data;

  if (!data || !data.startsWith('publish_pr:')) {
    return;
  }

  const sessionId = data.replace('publish_pr:', '');

  const groupId = getGroupId(ctx);

  if (!groupId) {
    await ctx.answerCallbackQuery({ text: '⚠️ Invalid context' });
    return;
  }

  const token = await getJulesToken(ctx.env, groupId);

  if (!token) {
    await ctx.answerCallbackQuery({ text: '⚠️ Jules token not configured' });
    return;
  }

  try {
    const julesClient = createJulesClient(token);

    // Note: Jules API may not have publishPR endpoint
    // This is a placeholder - may need to be implemented differently
    try {
      const result = await julesClient.publishPR(sessionId);

      // Update message to show PR link
      await ctx.editMessageText(
        ctx.callbackQuery?.message?.text + '\n\n✅ <b>Pull Request created!</b>\n🔀 ' + result.prUrl,
        { parse_mode: 'HTML' }
      );

      await ctx.answerCallbackQuery({ text: '✅ PR created!' });
    } catch (error) {
      // If endpoint doesn't exist, inform user
      await ctx.answerCallbackQuery({
        text: '⚠️ This feature requires manual action via jules.google',
        show_alert: true,
      });
    }
  } catch (error) {
    console.error('Error publishing PR:', error);
    await ctx.answerCallbackQuery({ text: '❌ Failed to publish PR' });
  }
}

/**
 * Handle callback query for deleting session
 * Pattern: delete_session:{session_id}
 */
export async function handleDeleteSessionCallback(ctx: BotContext): Promise<void> {
  const data = ctx.callbackQuery?.data;

  if (!data || !data.startsWith('delete_session:')) {
    return;
  }

  const sessionId = data.replace('delete_session:', '');

  const groupId = getGroupId(ctx);
  const topicId = getTopicId(ctx);

  if (!groupId || !topicId) {
    await ctx.answerCallbackQuery({ text: '⚠️ Invalid context' });
    return;
  }

  const session = await getSession(ctx.env, groupId, topicId);

  if (!session || session.session_id !== sessionId) {
    await ctx.answerCallbackQuery({ text: '⚠️ Session not found' });
    return;
  }

  try {
    // Remove from KV
    await deleteSessionKV(ctx.env, groupId, topicId);
    await removeFromSessionsIndex(ctx.env, groupId, sessionId);

    // Update message to remove buttons
    await ctx.editMessageReplyMarkup({ reply_markup: undefined });

    await ctx.reply(
      '✅ <b>Session deleted from bot.</b>\n\n' +
      '<i>Note: To delete the session permanently, visit jules.google</i>',
      { parse_mode: 'HTML' }
    );

    await ctx.answerCallbackQuery({ text: '✅ Session deleted' });
  } catch (error) {
    console.error('Error deleting session:', error);
    await ctx.answerCallbackQuery({ text: '❌ Failed to delete session' });
  }
}

/**
 * Handle callback query for canceling deletion
 * Pattern: cancel_delete
 */
export async function handleCancelDeleteCallback(ctx: BotContext): Promise<void> {
  const data = ctx.callbackQuery?.data;

  if (data !== 'cancel_delete') {
    return;
  }

  try {
    // Update message to remove buttons
    await ctx.editMessageReplyMarkup({ reply_markup: undefined });

    await ctx.answerCallbackQuery({ text: '❌ Deletion cancelled' });
  } catch (error) {
    console.error('Error canceling deletion:', error);
  }
}

/**
 * Handle callback query for sources pagination
 * Pattern: sources_page:{page_number}
 */
export async function handleSourcesPageCallback(ctx: BotContext): Promise<void> {
  const data = ctx.callbackQuery?.data;

  if (!data || !data.startsWith('sources_page:')) {
    return;
  }

  const page = parseInt(data.replace('sources_page:', ''));

  if (isNaN(page) || page < 0) {
    await ctx.answerCallbackQuery({ text: '⚠️ Invalid page number' });
    return;
  }

  const groupId = getGroupId(ctx);

  if (!groupId) {
    await ctx.answerCallbackQuery({ text: '⚠️ Invalid context' });
    return;
  }

  const token = await getJulesToken(ctx.env, groupId);

  if (!token) {
    await ctx.answerCallbackQuery({ text: '⚠️ Jules token not configured' });
    return;
  }

  try {
    // Get cached sources
    const { getSourcesCache } = await import('../../kv/storage');
    const sources = await getSourcesCache(ctx.env, token);

    if (!sources || sources.length === 0) {
      await ctx.answerCallbackQuery({ text: '⚠️ Sources cache not found. Use /list_sources again.' });
      return;
    }

    // Show requested page
    await showSourcesPage(ctx, sources, page);

    await ctx.answerCallbackQuery();
  } catch (error) {
    console.error('Error handling sources page:', error);
    await ctx.answerCallbackQuery({ text: '❌ Failed to load page' });
  }
}

/**
 * Handle callback query for selecting a source
 * Pattern: select_source:{source_name}
 */
export async function handleSelectSourceCallback(ctx: BotContext): Promise<void> {
  const data = ctx.callbackQuery?.data;

  if (!data || !data.startsWith('select_source:')) {
    return;
  }

  const sourceName = data.replace('select_source:', '');

  const groupId = getGroupId(ctx);

  if (!groupId) {
    await ctx.answerCallbackQuery({ text: '⚠️ Invalid context' });
    return;
  }

  try {
    const { setSource } = await import('../../kv/storage');
    await setSource(ctx.env, groupId, sourceName);

    // Parse source name for display
    const sourceDisplay = sourceName.split('/').slice(3).join('/'); // sources/github/user/repo -> user/repo

    // Update message to show confirmation
    await ctx.editMessageText(
      `<b>✅ Source Selected</b>\n\n` +
      `<code>${escapeHtml(sourceName)}</code>\n\n` +
      `This repository will now be used as default for new sessions.\n` +
      `You can change it anytime with /list_sources`,
      { parse_mode: 'HTML' }
    );

    await ctx.answerCallbackQuery({ text: `✅ Selected: ${sourceDisplay}` });
  } catch (error) {
    console.error('Error selecting source:', error);
    await ctx.answerCallbackQuery({ text: '❌ Failed to select source' });
  }
}

/**
 * Show a specific page of sources with pagination keyboard
 * Shared between handleListSources and handleSourcesPageCallback
 */
export async function showSourcesPage(ctx: BotContext, sources: any[], page: number): Promise<void> {
  const PAGE_SIZE = 10;
  const totalPages = Math.ceil(sources.length / PAGE_SIZE);
  const start = page * PAGE_SIZE;
  const end = Math.min(start + PAGE_SIZE, sources.length);
  const pageSources = sources.slice(start, end);

  let message = `<b>📚 Available Sources (${sources.length} total)</b>\n\n`;
  message += `<i>Page ${page + 1} of ${totalPages}</i>\n\n`;
  message += `<i>Tap a source to select it as default</i>\n\n`;

  // Create pagination keyboard
  const { InlineKeyboard } = await import('grammy');
  const keyboard = new InlineKeyboard();

  // Add buttons for each source (1 per line)
  pageSources.forEach((source, index) => {
    const num = start + index + 1;
    const name = source.displayName || source.name.split('/').pop();
    const displayName = `${num}. ${name}`;

    // Add source button
    keyboard.text(`📦 ${displayName}`, `select_source:${source.name}`);

    // Move to next line for next source
    keyboard.row();
  });

  // Add pagination buttons
  if (totalPages > 1) {
    if (page > 0) {
      keyboard.text(`⬅️ Prev (${page})`, `sources_page:${page - 1}`);
    }

    if (page < totalPages - 1) {
      keyboard.text(`Next (${page + 2}) ➡️`, `sources_page:${page + 1}`);
    }

    // Add close button on new row
    keyboard.row();
    keyboard.text('❌ Close', 'sources_close');
  }

  // Use reply for first message, edit for callback queries
  if (ctx.callbackQuery) {
    await ctx.editMessageText(message, {
      parse_mode: 'HTML',
      reply_markup: keyboard,
    });
  } else {
    await ctx.reply(message, {
      parse_mode: 'HTML',
      reply_markup: keyboard,
    });
  }
}

/**
 * Handle callback query for closing sources list
 * Pattern: sources_close
 */
export async function handleSourcesCloseCallback(ctx: BotContext): Promise<void> {
  const data = ctx.callbackQuery?.data;

  if (data !== 'sources_close') {
    return;
  }

  try {
    await ctx.editMessageReplyMarkup({ reply_markup: undefined });
    await ctx.answerCallbackQuery({ text: '✅ Closed' });
  } catch (error) {
    console.error('Error closing sources:', error);
  }
}

/**
 * Main callback query handler
 * Routes to specific handlers based on callback data pattern
 */
export async function handleCallbackQuery(ctx: BotContext): Promise<void> {
  const data = ctx.callbackQuery?.data;

  if (!data) {
    return;
  }

  // Route to specific handlers
  if (data.startsWith('approve_plan:')) {
    await handleApprovePlanCallback(ctx);
  } else if (data.startsWith('publish_branch:')) {
    await handlePublishBranchCallback(ctx);
  } else if (data.startsWith('publish_pr:')) {
    await handlePublishPRCallback(ctx);
  } else if (data.startsWith('delete_session:')) {
    await handleDeleteSessionCallback(ctx);
  } else if (data === 'cancel_delete') {
    await handleCancelDeleteCallback(ctx);
  } else if (data.startsWith('sources_page:')) {
    await handleSourcesPageCallback(ctx);
  } else if (data.startsWith('select_source:')) {
    await handleSelectSourceCallback(ctx);
  } else if (data === 'sources_close') {
    await handleSourcesCloseCallback(ctx);
  } else {
    // Unknown callback
    await ctx.answerCallbackQuery({ text: '⚠️ Unknown action' });
  }
}
