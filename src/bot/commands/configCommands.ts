/**
 * Configuration command handlers
 * Admin-only commands for configuring group settings
 */

import type { BotContext } from '../bot';
import { getGroupId, isUserAdmin } from '../bot';
import {
  setJulesToken,
  setSource,
  setDefaultBranch,
  setAutomationMode,
  setRequireApproval,
} from '../../kv/storage';
import { createJulesClient } from '../../jules/api';

/**
 * /set_jules_token command
 * Configure Jules API token for the group
 */
export async function handleSetJulesToken(ctx: BotContext): Promise<void> {
  const groupId = getGroupId(ctx);

  if (!groupId) {
    await ctx.reply('This command only works in group chats.');
    return;
  }

  // Check if user is admin
  if (!(await isUserAdmin(ctx))) {
    await ctx.reply('⚠️ Only admins can configure the Jules token.');
    return;
  }

  // Extract token from command
  const text = ctx.message?.text || '';
  const parts = text.split(' ');

  if (parts.length < 2) {
    await ctx.reply(
      '⚠️ Please provide the Jules API token.\n\n' +
      'Usage: /set_jules_token &lt;token&gt;\n\n' +
      'Get your token from: https://jules.google',
      { parse_mode: 'HTML' }
    );
    return;
  }

  const token = parts.slice(1).join(' ').trim();

  // Validate token by making a test API call
  await ctx.reply('🔄 Validating token...');

  try {
    const julesClient = createJulesClient(token);
    const isValid = await julesClient.validateToken();

    if (!isValid) {
      await ctx.reply('❌ Invalid token. Please check your Jules API key and try again.');
      return;
    }

    // Store token in KV
    await setJulesToken(ctx.env, groupId, token);

    await ctx.reply(
      '✅ Jules token configured successfully!\n\n' +
      'Next steps:\n' +
      '1. Use /list_sources to see available repositories\n' +
      '2. Use /set_source &lt;source&gt; to set a default repository\n' +
      '3. Create a topic and start chatting!',
      { parse_mode: 'HTML' }
    );
  } catch (error) {
    console.error('Error validating Jules token:', error);
    await ctx.reply(
      '❌ Failed to validate token. Please check your Jules API key.\n\n' +
      'Error: ' + (error instanceof Error ? error.message : 'Unknown error')
    );
  }
}

/**
 * /set_source command
 * Set default source (repository) for the group
 */
export async function handleSetSource(ctx: BotContext): Promise<void> {
  const groupId = getGroupId(ctx);

  if (!groupId) {
    await ctx.reply('This command only works in group chats.');
    return;
  }

  if (!(await isUserAdmin(ctx))) {
    await ctx.reply('⚠️ Only admins can configure the source.');
    return;
  }

  const text = ctx.message?.text || '';
  const parts = text.split(' ');

  if (parts.length < 2) {
    await ctx.reply(
      '⚠️ Please provide the source name.\n\n' +
      'Usage: /set_source &lt;source&gt;\n\n' +
      'Use /list_sources to see available sources.\n' +
      'Example: /set_source sources/github/user/repo',
      { parse_mode: 'HTML' }
    );
    return;
  }

  const source = parts.slice(1).join(' ').trim();

  // Store source in KV
  await setSource(ctx.env, groupId, source);

  await ctx.reply(
    `✅ Default source set to:\n<code>${source}</code>\n\n` +
    'This source will be used for new sessions.\n' +
    'Use /open_jules_settings to configure advanced settings for this repository.',
    { parse_mode: 'HTML' }
  );
}

/**
 * /set_branch command
 * Set default starting branch for sessions
 */
export async function handleSetBranch(ctx: BotContext): Promise<void> {
  const groupId = getGroupId(ctx);

  if (!groupId) {
    await ctx.reply('This command only works in group chats.');
    return;
  }

  if (!(await isUserAdmin(ctx))) {
    await ctx.reply('⚠️ Only admins can configure the default branch.');
    return;
  }

  const text = ctx.message?.text || '';
  const parts = text.split(' ');

  if (parts.length < 2) {
    await ctx.reply(
      '⚠️ Please provide the branch name.\n\n' +
      'Usage: /set_branch &lt;branch&gt;\n\n' +
      'Example: /set_branch main',
      { parse_mode: 'HTML' }
    );
    return;
  }

  const branch = parts.slice(1).join(' ').trim();

  await setDefaultBranch(ctx.env, groupId, branch);

  await ctx.reply(
    `✅ Default branch set to: <code>${branch}</code>\n\n` +
    'This branch will be used as the starting point for new sessions.',
    { parse_mode: 'HTML' }
  );
}

/**
 * /set_auto_pr command
 * Configure automatic PR creation mode
 */
export async function handleSetAutoPR(ctx: BotContext): Promise<void> {
  const groupId = getGroupId(ctx);

  if (!groupId) {
    await ctx.reply('This command only works in group chats.');
    return;
  }

  if (!(await isUserAdmin(ctx))) {
    await ctx.reply('⚠️ Only admins can configure automation mode.');
    return;
  }

  const text = ctx.message?.text || '';
  const parts = text.split(' ');

  if (parts.length < 2) {
    await ctx.reply(
      '⚠️ Please specify on or off.\n\n' +
      'Usage: /set_auto_pr &lt;on|off&gt;\n\n' +
      'on = AUTO mode (automatic PR creation)\n' +
      'off = INTERACTIVE mode (manual control)',
      { parse_mode: 'HTML' }
    );
    return;
  }

  const value = parts[1].toLowerCase();

  if (value !== 'on' && value !== 'off') {
    await ctx.reply('⚠️ Please use "on" or "off".');
    return;
  }

  const mode = value === 'on' ? 'AUTO' : 'INTERACTIVE';

  await setAutomationMode(ctx.env, groupId, mode);

  await ctx.reply(
    `✅ Automation mode set to: <b>${mode}</b>\n\n` +
    (mode === 'AUTO'
      ? 'Jules will automatically create PRs when sessions are complete.'
      : 'You will have manual control over when to publish branches and PRs.'),
    { parse_mode: 'HTML' }
  );
}

/**
 * /require_approval command
 * Configure whether to require plan approval
 */
export async function handleRequireApproval(ctx: BotContext): Promise<void> {
  const groupId = getGroupId(ctx);

  if (!groupId) {
    await ctx.reply('This command only works in group chats.');
    return;
  }

  if (!(await isUserAdmin(ctx))) {
    await ctx.reply('⚠️ Only admins can configure plan approval settings.');
    return;
  }

  const text = ctx.message?.text || '';
  const parts = text.split(' ');

  if (parts.length < 2) {
    await ctx.reply(
      '⚠️ Please specify on or off.\n\n' +
      'Usage: /require_approval &lt;on|off&gt;\n\n' +
      'on = Jules will wait for your approval before executing plans\n' +
      'off = Jules will automatically execute plans',
      { parse_mode: 'HTML' }
    );
    return;
  }

  const value = parts[1].toLowerCase();

  if (value !== 'on' && value !== 'off') {
    await ctx.reply('⚠️ Please use "on" or "off".');
    return;
  }

  const require = value === 'on';

  await setRequireApproval(ctx.env, groupId, require);

  await ctx.reply(
    `✅ Plan approval ${require ? 'enabled' : 'disabled'}.\n\n` +
    (require
      ? 'Jules will wait for your approval before executing plans. You will see an "Approve Plan" button when a plan is generated.'
      : 'Jules will automatically execute plans without waiting for approval.'),
    { parse_mode: 'HTML' }
  );
}
