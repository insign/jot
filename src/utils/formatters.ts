/**
 * Formatting utilities for Telegram messages
 * Handles HTML formatting, expandable blockquotes, and message truncation
 */

/**
 * Escape HTML special characters for Telegram HTML parse mode
 */
export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Create an expandable blockquote (Telegram feature)
 * Used for long content like bash output, file lists, etc.
 */
export function createExpandableBlockquote(title: string, content: string): string {
  const escapedTitle = escapeHtml(title);
  const escapedContent = escapeHtml(content);
  return `<b>${escapedTitle}</b>\n<blockquote expandable>${escapedContent}</blockquote>`;
}

/**
 * Format bash output for display
 * Uses expandable blockquote if output is too long
 */
export function formatBashOutput(command: string, output: string, exitCode: number): string {
  const emoji = exitCode !== 0 ? '⚠️' : '🔧';
  const statusText = exitCode !== 0 ? `(exit code: ${exitCode})` : '';

  // If output is short (< 200 chars), display inline
  if (output.length < 200) {
    return `${emoji} <b>Command:</b> <code>${escapeHtml(command)}</code> ${statusText}\n\n<pre>${escapeHtml(output)}</pre>`;
  }

  // Otherwise, use expandable blockquote
  const title = `${emoji} Command: ${command} ${statusText}`;
  return createExpandableBlockquote(title, output);
}

/**
 * Format changeSet (file changes) for display
 * Uses expandable blockquote if too many files
 */
export function formatChangeSet(files: Array<{ path?: string; changeType?: string }>, gitPatch?: string): string {
  const fileCount = files.length;

  // If few files (< 5), display inline
  if (fileCount <= 5) {
    const filesList = files
      .map(f => {
        const icon = getChangeTypeIcon(f.changeType);
        return `${icon} <code>${escapeHtml(f.path || 'unknown')}</code>`;
      })
      .join('\n');

    return `📁 <b>Files modified (${fileCount}):</b>\n${filesList}`;
  }

  // Otherwise, use expandable blockquote
  const filesList = files
    .map(f => {
      const icon = getChangeTypeIcon(f.changeType);
      return `${icon} ${f.path || 'unknown'}`;
    })
    .join('\n');

  const title = `📁 Files modified (${fileCount} files)`;
  return createExpandableBlockquote(title, filesList);
}

/**
 * Get icon for change type
 */
function getChangeTypeIcon(changeType?: string): string {
  switch (changeType) {
    case 'ADDED':
      return '➕';
    case 'MODIFIED':
      return '✏️';
    case 'DELETED':
      return '❌';
    case 'RENAMED':
      return '🔄';
    default:
      return '📄';
  }
}

/**
 * Format plan steps for display
 * Always uses expandable blockquote for better UX
 */
export function formatPlanSteps(steps: string[]): string {
  const stepsList = steps.map((step, index) => `${index + 1}. ${step}`).join('\n');
  const title = `🎯 PLAN CREATED - ${steps.length} steps`;
  return createExpandableBlockquote(title, stepsList);
}

/**
 * Truncate text to max length with ellipsis
 */
export function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 3) + '...';
}

/**
 * Format session outputs (PR links, branches, etc.)
 * Extracts and formats GitHub links from outputs
 */
export function formatOutputs(outputs?: string): string {
  if (!outputs) return 'No outputs available.';

  // Try to parse as JSON first
  try {
    const parsed = JSON.parse(outputs);
    let result = '';

    if (parsed.pullRequest) {
      result += `🔀 <b>Pull Request:</b> ${parsed.pullRequest.url}\n`;
    }

    if (parsed.branch) {
      result += `🌿 <b>Branch:</b> ${parsed.branch.name}\n`;
    }

    if (parsed.commits && parsed.commits.length > 0) {
      result += `📝 <b>Commits:</b> ${parsed.commits.length}\n`;
    }

    return result || escapeHtml(outputs);
  } catch {
    // If not JSON, return as-is (escaped)
    return escapeHtml(outputs);
  }
}

/**
 * Format activity title and description
 * Handles special cases like "Ready for review"
 */
export function formatActivityMessage(title?: string, description?: string): string {
  // Check for "Ready for review" pattern
  if (title?.toLowerCase().includes('ready for review') || description?.toLowerCase().includes('ready for review')) {
    return '🎉 <b>Ready for review!</b>\n\nJules finalized the changes.';
  }

  let message = '';

  if (title) {
    message += `<b>${escapeHtml(title)}</b>\n`;
  }

  if (description) {
    message += `\n${escapeHtml(description)}`;
  }

  return message || 'Activity received.';
}

/**
 * Format session status for /status command
 */
export function formatSessionStatus(
  hasToken: boolean,
  source?: string,
  defaultBranch?: string,
  automationMode?: string,
  requireApproval?: boolean,
  sessionsCount?: number
): string {
  let status = '<b>⚙️ Group Configuration</b>\n\n';

  status += `<b>Jules Token:</b> ${hasToken ? '✅ Configured' : '❌ Not configured'}\n`;
  status += `<b>Source:</b> ${source ? escapeHtml(source) : '❌ Not configured'}\n`;
  status += `<b>Default Branch:</b> ${defaultBranch || 'main'}\n`;
  status += `<b>Automation Mode:</b> ${automationMode || 'MANUAL'}\n`;
  status += `<b>Require Plan Approval:</b> ${requireApproval ? 'Yes' : 'No'}\n`;
  status += `<b>Active Sessions:</b> ${sessionsCount || 0}\n`;

  return status;
}

/**
 * Format list of sessions for /list_sessions command
 */
export function formatSessionsList(sessions: Array<{ session_id: string; topic_id: number; source: string; status?: string }>): string {
  if (sessions.length === 0) {
    return 'No active sessions found.';
  }

  // If many sessions (> 10), use expandable blockquote
  if (sessions.length > 10) {
    const sessionsList = sessions
      .map(s => `• Session ${s.session_id} (Topic ${s.topic_id}) - ${s.status || 'active'}`)
      .join('\n');

    const title = `📋 Active Sessions (${sessions.length} total)`;
    return createExpandableBlockquote(title, sessionsList);
  }

  // Otherwise, display inline
  let result = `<b>📋 Active Sessions (${sessions.length}):</b>\n\n`;

  for (const session of sessions) {
    result += `• <code>${escapeHtml(session.session_id)}</code>\n`;
    result += `  Topic: ${session.topic_id}\n`;
    result += `  Source: ${escapeHtml(session.source)}\n`;
    result += `  Status: ${session.status || 'active'}\n\n`;
  }

  return result;
}

/**
 * Format list of sources for /list_sources command
 */
export function formatSourcesList(sources: Array<{ name: string; displayName: string; description?: string }>): string {
  if (sources.length === 0) {
    return 'No sources available.';
  }

  let result = `<b>📚 Available Sources (${sources.length}):</b>\n\n`;

  for (const source of sources) {
    result += `• <b>${escapeHtml(source.displayName)}</b>\n`;
    result += `  Name: <code>${escapeHtml(source.name)}</code>\n`;
    if (source.description) {
      result += `  Description: ${escapeHtml(source.description)}\n`;
    }
    result += '\n';
  }

  return result;
}

/**
 * Create inline keyboard button markup
 */
export function createInlineButton(text: string, callbackData: string): any {
  return {
    text,
    callback_data: callbackData,
  };
}

/**
 * Create inline keyboard button with URL
 */
export function createUrlButton(text: string, url: string): any {
  return {
    text,
    url,
  };
}
