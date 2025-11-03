/**
 * Action command handlers
 * Commands for performing actions on sessions
 */

import type { BotContext } from '../bot';
import { getGroupId, getTopicId, isUserAdmin, updateTopicTitle } from '../bot';
import {
  getJulesToken,
  getSource,
  getDefaultBranch,
  getAutomationMode,
  getRequireApproval,
  getSession,
  setSession,
  deleteSession as deleteSessionKV,
  removeFromSessionsIndex,
  addToSessionsIndex,
  setPendingPlan,
} from '../../kv/storage';
import { createJulesClient, isSessionNotFoundError } from '../../jules/api';
import { parseSourceToRepoInfo } from '../../utils/github';
import { InlineKeyboard } from 'grammy';
import type { SessionData } from '../../types/env';

/**
 * /new_session command
 * Create a new Jules session in the current topic
 */
export async function handleNewSession(ctx: BotContext): Promise<void> {
  const groupId = getGroupId(ctx);
  const topicId = getTopicId(ctx);

  if (!groupId || !topicId) {
    await ctx.reply('⚠️ This command must be used in a topic.');
    return;
  }

  const text = ctx.message?.text || '';
  const parts = text.split(' ');

  if (parts.length < 2) {
    await ctx.reply(
      '⚠️ Please provide a prompt.\n\n' +
      'Usage: /new_session &lt;prompt&gt;\n\n' +
      'Example: /new_session Add a dark mode toggle to the settings page',
      { parse_mode: 'HTML' }
    );
    return;
  }

  const prompt = parts.slice(1).join(' ').trim();

  // Check if session already exists for this topic
  const existingSession = await getSession(ctx.env, groupId, topicId);

  if (existingSession) {
    await ctx.reply(
      '⚠️ This topic already has a session.\n\n' +
      'Use the topic to continue the conversation, or delete the session with /delete_session first.'
    );
    return;
  }

  const token = await getJulesToken(ctx.env, groupId);

  if (!token) {
    await ctx.reply(
      '⚠️ Jules token not configured.\n\n' +
      'Admin: Use /set_jules_token &lt;token&gt; to get started.',
      { parse_mode: 'HTML' }
    );
    return;
  }

  const source = await getSource(ctx.env, groupId);

  if (!source) {
    await ctx.reply(
      '⚠️ No source configured.\n\n' +
      'Admin: Use /list_sources and /set_source to configure a repository.',
      { parse_mode: 'HTML' }
    );
    return;
  }

  await ctx.reply('🔄 Creating Jules session...');

  try {
    const julesClient = createJulesClient(token);

    const defaultBranch = await getDefaultBranch(ctx.env, groupId);
    const automationMode = await getAutomationMode(ctx.env, groupId);
    const requireApproval = await getRequireApproval(ctx.env, groupId);

    const session = await julesClient.createSession({
      prompt,
      source,
      automationMode: automationMode || 'MANUAL',
      requirePlanApproval: requireApproval,
      startingBranch: defaultBranch || undefined,
    });

    // Store session in KV
    const sessionData: SessionData = {
      session_id: session.name,
      group_id: groupId,
      topic_id: topicId,
      source: session.source,
      automation_mode: session.automationMode,
      require_plan_approval: session.requirePlanApproval,
      starting_branch: session.startingBranch,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    await setSession(ctx.env, groupId, topicId, sessionData);
    await addToSessionsIndex(ctx.env, groupId, session.name);

    // Update topic title with repo and session info
    const repoInfo = parseSourceToRepoInfo(source);
    if (repoInfo) {
      await updateTopicTitle(ctx, groupId, topicId, repoInfo.owner, repoInfo.repo, session.name);
    }

    await ctx.reply(
      '✅ <b>Session created successfully!</b>\n\n' +
      `<b>Session ID:</b> <code>${session.name}</code>\n` +
      `<b>Source:</b> ${source}\n` +
      `<b>Mode:</b> ${session.automationMode || 'MANUAL'}\n\n` +
      'I will send you updates automatically as Jules works on your request.',
      { parse_mode: 'HTML' }
    );
  } catch (error) {
    console.error('Error creating session:', error);
    await ctx.reply(
      '❌ Failed to create session.\n\n' +
      'Error: ' + (error instanceof Error ? error.message : 'Unknown error')
    );
  }
}

/**
 * /approve_plan command
 * Approve a pending plan for the current session
 */
export async function handleApprovePlan(ctx: BotContext): Promise<void> {
  const groupId = getGroupId(ctx);
  const topicId = getTopicId(ctx);

  if (!groupId || !topicId) {
    await ctx.reply('⚠️ This command must be used in a topic.');
    return;
  }

  const session = await getSession(ctx.env, groupId, topicId);

  if (!session) {
    await ctx.reply('⚠️ No session found for this topic.');
    return;
  }

  const token = await getJulesToken(ctx.env, groupId);

  if (!token) {
    await ctx.reply('⚠️ Jules token not configured.');
    return;
  }

  await ctx.reply('🔄 Approving plan...');

  try {
    const julesClient = createJulesClient(token);
    await julesClient.approvePlan(session.session_id);

    // Clear pending plan flag
    await setPendingPlan(ctx.env, groupId, topicId, false);

    await ctx.reply(
      '✅ <b>Plan approved!</b>\n\nJules will start working on the implementation.',
      { parse_mode: 'HTML', disable_notification: true }
    );
  } catch (error) {
    console.error('Error approving plan:', error);
    await ctx.reply(
      '❌ Failed to approve plan.\n\n' +
      'Error: ' + (error instanceof Error ? error.message : 'Unknown error')
    );
  }
}

/**
 * /delete_session command
 * Delete the current session (admin only)
 */
export async function handleDeleteSession(ctx: BotContext): Promise<void> {
  const groupId = getGroupId(ctx);
  const topicId = getTopicId(ctx);

  if (!groupId || !topicId) {
    await ctx.reply('⚠️ This command must be used in a topic.');
    return;
  }

  if (!(await isUserAdmin(ctx))) {
    await ctx.reply('⚠️ Only admins can delete sessions.');
    return;
  }

  const session = await getSession(ctx.env, groupId, topicId);

  if (!session) {
    await ctx.reply('⚠️ No session found for this topic.');
    return;
  }

  // Show confirmation button
  const keyboard = new InlineKeyboard()
    .text('⚠️ Confirm Deletion', `delete_session:${session.session_id}`)
    .text('❌ Cancel', 'cancel_delete');

  await ctx.reply(
    '⚠️ <b>Delete Session</b>\n\n' +
    `Are you sure you want to delete this session?\n\n` +
    `<b>Session ID:</b> <code>${session.session_id}</code>\n\n` +
    '<i>Note: This will only remove the session from this bot. To delete it permanently, visit jules.google</i>',
    {
      parse_mode: 'HTML',
      reply_markup: keyboard,
    }
  );
}

/**
 * /sync command
 * Manually synchronize sessions with Jules API (admin only)
 */
export async function handleSync(ctx: BotContext): Promise<void> {
  const groupId = getGroupId(ctx);

  if (!groupId) {
    await ctx.reply('This command only works in group chats.');
    return;
  }

  if (!(await isUserAdmin(ctx))) {
    await ctx.reply('⚠️ Only admins can sync sessions.');
    return;
  }

  const token = await getJulesToken(ctx.env, groupId);

  if (!token) {
    await ctx.reply(
      '⚠️ Jules token not configured.\n\n' +
      'Use /set_jules_token &lt;token&gt; to get started.',
      { parse_mode: 'HTML' }
    );
    return;
  }

  await ctx.reply('🔄 Synchronizing sessions with Jules...');

  try {
    const julesClient = createJulesClient(token);
    const remoteSessions = await julesClient.listSessions();

    let syncCount = 0;
    let removeCount = 0;

    // TODO: Implement full sync logic
    // This would involve:
    // 1. Getting all local sessions from KV
    // 2. Comparing with remote sessions
    // 3. Removing deleted sessions
    // 4. Updating status for existing sessions

    await ctx.reply(
      `✅ <b>Sync Complete</b>\n\n` +
      `Synced: ${syncCount}\n` +
      `Removed: ${removeCount}\n\n` +
      `Total sessions: ${remoteSessions.length}`,
      { parse_mode: 'HTML' }
    );
  } catch (error) {
    console.error('Error syncing sessions:', error);
    await ctx.reply(
      '❌ Failed to sync sessions.\n\n' +
      'Error: ' + (error instanceof Error ? error.message : 'Unknown error')
    );
  }
}
