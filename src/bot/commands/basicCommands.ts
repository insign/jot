/**
 * Basic command handlers
 * Handles /start and /help commands
 */

import type { BotContext } from '../bot';
import { getGroupId } from '../bot';

/**
 * /start command
 * Shows welcome message with explanation of features
 */
export async function handleStart(ctx: BotContext): Promise<void> {
  const groupId = getGroupId(ctx);

  if (!groupId) {
    await ctx.reply(
      'This bot only works in group chats with topics enabled.\n\n' +
      'Please add me to a group and enable topics (Forums) to get started.'
    );
    return;
  }

  const welcomeMessage = `
🤖 <b>Welcome to Jot - Telegram Interface for Jules!</b>

I'm a bridge between Telegram and Jules (Google's AI coding assistant). Here's how to get started:

<b>📋 Initial Setup (Admins only):</b>
1. Get your Jules API key from jules.google
2. Use /set_jules_token &lt;token&gt; to configure
3. Use /list_sources to see available repositories
4. Use /set_source &lt;source&gt; to set default repository

<b>💬 How to Use:</b>
• Create a topic (forum thread) for each coding task
• Send your request as text or image
• I'll create a Jules session and update you automatically
• Each topic = 1 Jules session (1:1 mapping)

<b>📸 Image Support:</b>
• Send screenshots, designs, or diagrams
• Supported formats: JPG, PNG, WebP
• Max size: 20MB

<b>🎯 Features:</b>
• Automatic activity polling (you don't need to ask for updates!)
• Plan approval with inline buttons
• GitHub links extraction (PR, branches, commits)
• Smart notifications (important events have sound)
• Multi-tenant (each group has its own configuration)

<b>⚙️ Advanced Settings:</b>
• Use /open_jules_settings to access Jules web interface
• Configure Setup Script, Environment Variables, and Memories there
• These settings are per-repository and affect all future sessions

<b>📚 Commands:</b>
Use /help to see all available commands.

<b>🔒 Permissions Required:</b>
• I need "Manage Topics" permission to update topic names
• Admins can configure group settings

Let's start coding! 🚀
`;

  await ctx.reply(welcomeMessage, { parse_mode: 'HTML' });
}

/**
 * /help command
 * Shows comprehensive list of commands
 */
export async function handleHelp(ctx: BotContext): Promise<void> {
  const helpMessage = `
<b>📚 Command Reference</b>

<b>🎬 Basic Commands:</b>
/start - Show welcome message
/help - Show this help message

<b>⚙️ Configuration (Admin only):</b>
/set_jules_token &lt;token&gt; - Configure Jules API token
/set_source &lt;source&gt; - Set default repository source
/set_branch &lt;branch&gt; - Set default starting branch
/set_auto_pr &lt;on|off&gt; - Enable/disable automatic PR creation
/require_approval &lt;on|off&gt; - Require plan approval before execution

<b>ℹ️ Information:</b>
/status - Show group configuration and stats
/get_source - Show configured source
/list_sources - List all available sources
/list_sessions - List all active sessions
/session_info - Show current session details (use in topic)
/list_activities - Show activities for current session (use in topic)
/show_plan - Show plan for current session (use in topic)
/show_outputs - Show outputs (PR, branch, commits) for current session
/open_jules_settings - Open Jules web interface for advanced settings

<b>🎬 Actions:</b>
/new_session &lt;prompt&gt; - Create new session in current topic
/approve_plan - Approve pending plan (use in topic)
/delete_session - Delete current session (Admin only, use in topic)
/sync - Manually sync sessions with Jules API (Admin only)

<b>💡 Tips:</b>
• Most commands work in topics (forum threads)
• You don't need to poll for updates - I send them automatically!
• Send images by just uploading them in a topic
• Use inline buttons for quick actions (approve plan, publish PR, etc.)
• Configure advanced settings (Setup Script, Env Vars) via /open_jules_settings

<b>🆘 Need Help?</b>
• Check if bot has "Manage Topics" permission
• Verify Jules token is valid with /status
• Use /sync to manually refresh sessions
• Make sure you're using commands in the right context (topic vs. general chat)

For more information, visit: https://jules.google
`;

  await ctx.reply(helpMessage, { parse_mode: 'HTML' });
}
