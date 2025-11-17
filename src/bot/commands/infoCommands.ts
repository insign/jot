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
 * List all available sources from Jules API with pagination
 */
export async function handleListSources(ctx: BotContext): Promise<void> {
  const groupId = getGroupId(ctx);

  if (!groupId) {
    await ctx.reply('This command only works in group chats.');
    return;
  }

  console.log('[DEBUG] Group ID:', groupId);
  const token = await getJulesToken(ctx.env, groupId);
  console.log('[DEBUG] Token from KV:', token ? token.substring(0, 20) + '...' : 'null');

  if (!token) {
    await ctx.reply(
      '⚠️ Jules token not configured.\n\n' +
      'Use /set_jules_token &lt;token&gt; to get started.',
      { parse_mode: 'HTML' }
    );
    return;
  }

  await ctx.reply('🔄 Loading sources...');

  try {
    // Try to get from cache first
    const { getSourcesCache, setSourcesCache, registerActiveToken } = await import('../../kv/storage');
    let sources = await getSourcesCache(ctx.env, token);
    let hasMore = false;

    // If not in cache, fetch from API with extended timeout
    if (!sources) {
      const julesClient = createJulesClient(token);
      console.log('[DEBUG] JulesClient created, calling listSources...');

      // Use 9s timeout to get first batch quickly
      const result = await julesClient.listSources(9000);

      if (result.sources.length === 0) {
        await ctx.reply('No sources found. Please connect a repository at https://jules.google');
        return;
      }

      sources = result.sources.map(s => ({
        name: s.name,
        displayName: s.displayName,
        description: s.description,
      }));
      hasMore = result.hasMore;

      // Cache the initial results for 1 hour
      await setSourcesCache(ctx.env, token, sources);

      // Register token as active for cron refresh
      await registerActiveToken(ctx.env, token);

      console.log(`[DEBUG] Cached ${sources.length} sources (hasMore: ${hasMore})`);
    }

    // Show first page (10 sources per page)
    const { showSourcesPage } = await import('../handlers/callbackHandlers');
    await showSourcesPage(ctx, sources, 0, hasMore);
  } catch (error) {
    console.error('Error fetching sources:', error);
    await ctx.reply(
      '❌ Failed to fetch sources from Jules.\n\n' +
      'Error: ' + (error instanceof Error ? error.message : 'Unknown error')
    );
  }
}

/**
 * /refresh_sources command
 * Manually refresh the sources cache to fetch all available sources
 * Uses background processing to avoid Worker timeout (10s limit)
 */
export async function handleRefreshSources(ctx: BotContext): Promise<void> {
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

  try {
    // Register token as active for cron refresh
    const { registerActiveToken, clearSourcesCache } = await import('../../kv/storage');
    await registerActiveToken(ctx.env, token);

    // Clear current cache to force fresh fetch
    await clearSourcesCache(ctx.env, token);

    // Respond immediately to avoid timeout
    await ctx.reply(
      '🔄 <b>Sources cache refresh started!</b>\n\n' +
      '⏱️ This process will fetch all your repositories in the background.\n\n' +
      '💡 The cron job will complete the refresh within 15 minutes.\n' +
      'Use /list_sources in 1-2 minutes to see updated sources.',
      { parse_mode: 'HTML' }
    );

    // Try to do partial refresh in background (3 pages max = 300 sources)
    // This may or may not complete depending on Worker lifecycle
    if (ctx.waitUntil) {
      ctx.waitUntil(
        (async () => {
          try {
            console.log('[refresh_sources] Starting background partial refresh...');
            const { refreshSourcesForToken } = await import('../../cron/refreshSourcesCache');
            // Limit to 3 pages to fit in Worker extended time
            const result = await refreshSourcesForToken(ctx.env, token, 3);
            console.log(`[refresh_sources] Background refresh: ${result.count} sources (hasMore: ${result.hasMore})`);
          } catch (error) {
            console.error('[refresh_sources] Background refresh error:', error);
          }
        })()
      );
    }
  } catch (error) {
    console.error('Error initiating refresh:', error);
    await ctx.reply(
      '❌ Failed to initiate refresh.\n\n' +
      'Error: ' + (error instanceof Error ? error.message : 'Unknown error')
    );
  }
}

/**
 * /search_sources command
 * Search sources by owner/repo name
 */
export async function handleSearchSources(ctx: BotContext): Promise<void> {
  const groupId = getGroupId(ctx);

  if (!groupId) {
    await ctx.reply('This command only works in group chats.');
    return;
  }

  // Get search query from command arguments
  const text = ctx.message?.text || '';
  const query = text.replace(/^\/search_sources(@\w+)?\s*/, '').trim();

  if (!query) {
    await ctx.reply(
      '🔍 <b>Search Sources</b>\n\n' +
      'Usage: <code>/search_sources query</code>\n\n' +
      'Examples:\n' +
      '• <code>/search_sources myproject</code>\n' +
      '• <code>/search_sources owner/repo</code>\n' +
      '• <code>/search_sources org-name</code>',
      { parse_mode: 'HTML' }
    );
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

  await ctx.reply(`🔍 Searching for "<code>${escapeHtml(query)}</code>"...`, { parse_mode: 'HTML' });

  try {
    // Try to get from cache first
    const { getSourcesCache } = await import('../../kv/storage');
    let sources = await getSourcesCache(ctx.env, token);

    // If not in cache, fetch from API
    if (!sources) {
      const julesClient = createJulesClient(token);
      const result = await julesClient.listSources();

      if (result.sources.length === 0) {
        await ctx.reply('No sources found. Please connect a repository at https://jules.google');
        return;
      }

      sources = result.sources.map(s => ({
        name: s.name,
        displayName: s.displayName,
        description: s.description,
      }));

      // Cache for future searches
      const { setSourcesCache } = await import('../../kv/storage');
      await setSourcesCache(ctx.env, token, sources);
    }

    // Filter sources by query (case-insensitive search in name)
    const queryLower = query.toLowerCase();
    const filteredSources = sources.filter(s => {
      const nameLower = s.name.toLowerCase();
      const displayNameLower = (s.displayName || '').toLowerCase();

      return nameLower.includes(queryLower) || displayNameLower.includes(queryLower);
    });

    if (filteredSources.length === 0) {
      await ctx.reply(
        `❌ No sources found matching "<code>${escapeHtml(query)}</code>"\n\n` +
        'Try a different search term or use /list_sources to see all repositories.',
        { parse_mode: 'HTML' }
      );
      return;
    }

    // Show results (first page)
    const { showSourcesPage } = await import('../handlers/callbackHandlers');
    await showSourcesPage(ctx, filteredSources, 0, false);
  } catch (error) {
    console.error('Error searching sources:', error);
    await ctx.reply(
      '❌ Failed to search sources.\n\n' +
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
    info += `<b>Automation Mode:</b> ${session.automation_mode || 'INTERACTIVE'}\n`;
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
