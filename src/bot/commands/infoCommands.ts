/**
 * Information command handlers
 * Commands for viewing configuration and session information
 */

import type { BotContext } from '../bot';
import { getGroupId, getTopicId } from '../bot';
import {
  getJulesToken,
  getSource,
  getDefaultBranch,
  getAutomationMode,
  getRequireApproval,
  getSessionsIndex,
  getSession,
  getGroupConfig,
} from '../../kv/storage';
import { createJulesClient } from '../../jules/api';
import { formatSessionStatus, formatSourcesList, formatSessionsList, createExpandableBlockquote, formatOutputs, escapeHtml } from '../../utils/formatters';
import { parseSourceToGitHubUrl } from '../../utils/github';
import { InlineKeyboard } from 'grammy';

/**
 * /status command
 * Show group configuration and statistics
 */
export async function handleStatus(ctx: BotContext): Promise<void> {
  const groupId = getGroupId(ctx);

  if (!groupId) {
    await ctx.reply('This command only works in group chats.');
    return;
  }

  const config = await getGroupConfig(ctx.env, groupId);

  if (!config) {
    await ctx.reply(
      '⚠️ Jules token not configured.\n\n' +
      'Use /set_jules_token &lt;token&gt; to get started.',
      { parse_mode: 'HTML' }
    );
    return;
  }

  const status = formatSessionStatus(
    !!config.jules_token,
    config.source,
    config.default_branch,
    config.automation_mode,
    config.require_approval,
    config.sessions_index?.length
  );

  await ctx.reply(status, { parse_mode: 'HTML' });
}

/**
 * /get_source command
 * Show configured source
 */
export async function handleGetSource(ctx: BotContext): Promise<void> {
  const groupId = getGroupId(ctx);

  if (!groupId) {
    await ctx.reply('This command only works in group chats.');
    return;
  }

  const source = await getSource(ctx.env, groupId);

  if (!source) {
    await ctx.reply(
      '⚠️ No source configured.\n\n' +
      'Use /list_sources to see available sources, then /set_source to configure one.',
      { parse_mode: 'HTML' }
    );
    return;
  }

  await ctx.reply(
    `<b>📚 Configured Source:</b>\n<code>${escapeHtml(source)}</code>\n\n` +
    'Use /open_jules_settings to configure advanced settings for this repository.',
    { parse_mode: 'HTML' }
  );
}

/**
 * /list_sources command
 * List all available sources from Jules API
 */
export async function handleListSources(ctx: BotContext): Promise<void> {
  const groupId = getGroupId(ctx);

  if (!groupId) {
    await ctx.reply('This command only works in group chats.');
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

  await ctx.reply('🔄 Fetching sources from Jules...');

  try {
    const julesClient = createJulesClient(token);
    const sources = await julesClient.listSources();

    if (sources.length === 0) {
      await ctx.reply('No sources found. Please connect a repository at https://jules.google');
      return;
    }

    const formattedSources = formatSourcesList(
      sources.map(s => ({
        name: s.name,
        displayName: s.displayName,
        description: s.description,
      }))
    );

    await ctx.reply(formattedSources, { parse_mode: 'HTML' });
  } catch (error) {
    console.error('Error fetching sources:', error);
    await ctx.reply(
      '❌ Failed to fetch sources from Jules.\n\n' +
      'Error: ' + (error instanceof Error ? error.message : 'Unknown error')
    );
  }
}

/**
 * /list_sessions command
 * List all active sessions for the group
 */
export async function handleListSessions(ctx: BotContext): Promise<void> {
  const groupId = getGroupId(ctx);

  if (!groupId) {
    await ctx.reply('This command only works in group chats.');
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

  await ctx.reply('🔄 Fetching sessions from Jules...');

  try {
    const julesClient = createJulesClient(token);
    const sessions = await julesClient.listSessions();

    if (sessions.length === 0) {
      await ctx.reply('No active sessions found.');
      return;
    }

    const sessionsList = sessions.map(s => ({
      session_id: s.name,
      topic_id: 0, // We don't have topic_id from Jules API
      source: s.source,
      status: s.state,
    }));

    const formatted = formatSessionsList(sessionsList);

    await ctx.reply(formatted, { parse_mode: 'HTML' });
  } catch (error) {
    console.error('Error fetching sessions:', error);
    await ctx.reply(
      '❌ Failed to fetch sessions from Jules.\n\n' +
      'Error: ' + (error instanceof Error ? error.message : 'Unknown error')
    );
  }
}

/**
 * /session_info command
 * Show details of current session (use in topic)
 */
export async function handleSessionInfo(ctx: BotContext): Promise<void> {
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

  try {
    const julesClient = createJulesClient(token);
    const julesSession = await julesClient.getSession(session.session_id);

    let info = '<b>📊 Session Info</b>\n\n';
    info += `<b>Session ID:</b> <code>${escapeHtml(session.session_id)}</code>\n`;
    info += `<b>Source:</b> ${escapeHtml(session.source)}\n`;
    info += `<b>Status:</b> ${julesSession.state || 'active'}\n`;
    info += `<b>Automation Mode:</b> ${session.automation_mode || 'MANUAL'}\n`;
    info += `<b>Created:</b> ${new Date(session.created_at).toLocaleString()}\n`;

    if (session.starting_branch) {
      info += `<b>Starting Branch:</b> ${escapeHtml(session.starting_branch)}\n`;
    }

    await ctx.reply(info, { parse_mode: 'HTML' });
  } catch (error) {
    console.error('Error fetching session info:', error);
    await ctx.reply(
      '❌ Failed to fetch session info.\n\n' +
      'Error: ' + (error instanceof Error ? error.message : 'Unknown error')
    );
  }
}

/**
 * /list_activities command
 * Show activities for current session (use in topic)
 */
export async function handleListActivities(ctx: BotContext): Promise<void> {
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

  await ctx.reply('🔄 Fetching activities...');

  try {
    const julesClient = createJulesClient(token);
    const activities = await julesClient.listActivities(session.session_id);

    if (activities.length === 0) {
      await ctx.reply('No activities found for this session.');
      return;
    }

    const activitiesList = activities
      .map(a => `• ${a.title || 'Activity'} (${new Date(a.createTime).toLocaleString()})`)
      .join('\n');

    const formatted = createExpandableBlockquote(
      `📋 Activities (${activities.length} total)`,
      activitiesList
    );

    await ctx.reply(formatted, { parse_mode: 'HTML' });
  } catch (error) {
    console.error('Error fetching activities:', error);
    await ctx.reply(
      '❌ Failed to fetch activities.\n\n' +
      'Error: ' + (error instanceof Error ? error.message : 'Unknown error')
    );
  }
}

/**
 * /show_plan command
 * Show plan for current session (use in topic)
 */
export async function handleShowPlan(ctx: BotContext): Promise<void> {
  const groupId = getGroupId(ctx);
  const topicId = getTopicId(ctx);

  if (!groupId || !topicId) {
    await ctx.reply('⚠️ This command must be used in a topic.');
    return;
  }

  await ctx.reply('⚠️ Plan display not yet implemented. Use /list_activities to see all activities.');
}

/**
 * /show_outputs command
 * Show outputs (PR, branch, commits) for current session
 */
export async function handleShowOutputs(ctx: BotContext): Promise<void> {
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

  try {
    const julesClient = createJulesClient(token);
    const julesSession = await julesClient.getSession(session.session_id);

    const outputs = formatOutputs(julesSession.outputs);

    await ctx.reply(
      `<b>📦 Session Outputs</b>\n\n${outputs}`,
      { parse_mode: 'HTML' }
    );
  } catch (error) {
    console.error('Error fetching outputs:', error);
    await ctx.reply(
      '❌ Failed to fetch outputs.\n\n' +
      'Error: ' + (error instanceof Error ? error.message : 'Unknown error')
    );
  }
}

/**
 * /open_jules_settings command
 * Open Jules web interface for advanced repository settings
 */
export async function handleOpenJulesSettings(ctx: BotContext): Promise<void> {
  const groupId = getGroupId(ctx);

  if (!groupId) {
    await ctx.reply('This command only works in group chats.');
    return;
  }

  const source = await getSource(ctx.env, groupId);

  if (!source) {
    await ctx.reply(
      '⚠️ No source configured.\n\n' +
      'Use /list_sources and /set_source to configure a repository first.',
      { parse_mode: 'HTML' }
    );
    return;
  }

  const julesUrl = parseSourceToGitHubUrl(source);

  if (!julesUrl) {
    await ctx.reply(
      '⚠️ Failed to parse source URL.\n\n' +
      'Please verify your source is in the format: sources/github/user/repo',
      { parse_mode: 'HTML' }
    );
    return;
  }

  const keyboard = new InlineKeyboard().url('🔗 Open Settings', julesUrl);

  await ctx.reply(
    '⚙️ <b>Advanced Jules Settings</b>\n\n' +
    'To configure <b>Setup Script</b>, <b>Environment Variables</b>, and <b>Memories</b>, ' +
    'access the repository settings on the Jules website.\n\n' +
    'These settings are per-repository and affect all future sessions.',
    {
      parse_mode: 'HTML',
      reply_markup: keyboard,
    }
  );
}
