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
  } else {
    // Unknown callback
    await ctx.answerCallbackQuery({ text: '⚠️ Unknown action' });
  }
}
