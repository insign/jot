/**
 * Activity processor
 * Processes Jules activities and sends formatted notifications to Telegram
 */

import type { JulesActivity } from '../../types/env';
import type { BotContext } from '../bot';
import { sendMessage, sendPhoto } from '../bot';
import {
  formatBashOutput,
  formatChangeSet,
  formatActivityMessage,
  createExpandableBlockquote,
  escapeHtml,
} from '../../utils/formatters';
import { extractGitHubLinks, formatGitHubLinks } from '../../utils/github';
import { base64ToUint8Array } from '../../utils/image';
import { InlineKeyboard, InputFile } from 'grammy';
import { setPendingPlan, setReadyForReview } from '../../kv/storage';

/**
 * Process a single activity and send notification to Telegram
 */
export async function processActivity(
  ctx: BotContext,
  groupId: string,
  topicId: number,
  sessionId: string,
  activity: JulesActivity
): Promise<void> {
  const activityType = getActivityType(activity);

  console.log(`Processing activity: ${activityType} for session ${sessionId}`);

  switch (activityType) {
    case 'planGenerated':
      await processPlanGenerated(ctx, groupId, topicId, sessionId, activity);
      break;

    case 'planApproved':
      await processPlanApproved(ctx, groupId, topicId, activity);
      break;

    case 'readyForReview':
      await processReadyForReview(ctx, groupId, topicId, sessionId, activity);
      break;

    case 'progressUpdated':
      await processProgressUpdated(ctx, groupId, topicId, activity);
      break;

    case 'sessionCompleted':
      await processSessionCompleted(ctx, groupId, topicId, sessionId, activity);
      break;

    default:
      await processGenericActivity(ctx, groupId, topicId, activity);
      break;
  }
}

/**
 * Determine activity type from activity data
 */
function getActivityType(activity: JulesActivity): string {
  const title = activity.title?.toLowerCase() || '';
  const description = activity.description?.toLowerCase() || '';

  if (title.includes('plan generated') || title.includes('plan created')) {
    return 'planGenerated';
  }

  if (title.includes('plan approved')) {
    return 'planApproved';
  }

  if (title.includes('ready for review') || description.includes('ready for review')) {
    return 'readyForReview';
  }

  if (title.includes('progress') || activity.artifacts?.bashOutput || activity.artifacts?.changeSet) {
    return 'progressUpdated';
  }

  if (title.includes('completed') || title.includes('finished')) {
    return 'sessionCompleted';
  }

  return 'generic';
}

/**
 * Process planGenerated activity
 * MAXIMUM ATTENTION - impossible to ignore
 */
async function processPlanGenerated(
  ctx: BotContext,
  groupId: string,
  topicId: number,
  sessionId: string,
  activity: JulesActivity
): Promise<void> {
  // Parse plan steps from description
  const steps = parsePlanSteps(activity.description || '');

  let message = '🎯 <b>PLAN CREATED</b>\n\n';

  // Check if requires approval
  // Note: We should check session.requirePlanApproval from KV
  // For now, we'll add a generic message
  const requiresApproval = true; // TODO: Get from session data

  if (requiresApproval) {
    message += '<b>⚠️ APPROVAL REQUIRED</b>\n\n';
  }

  if (steps.length > 0) {
    const stepsList = steps.map((step, i) => `${i + 1}. ${step}`).join('\n');
    message += createExpandableBlockquote(`🎯 PLAN - ${steps.length} steps`, stepsList);
  } else {
    message += escapeHtml(activity.description || 'Plan generated');
  }

  // Add approve button if requires approval
  let keyboard;
  if (requiresApproval) {
    keyboard = new InlineKeyboard().text('✅ Approve Plan', `approve_plan:${sessionId}`);
    message += '\n\n<i>Click the button below to approve and start execution.</i>';

    // Set pending plan flag
    await setPendingPlan(ctx.env, groupId, topicId, true);
  } else {
    message += '\n\n<i>Plan will be executed automatically.</i>';
  }

  // Send with SOUND (disable_notification=false)
  await ctx.api.sendMessage(groupId, message, {
    message_thread_id: topicId,
    parse_mode: 'HTML',
    disable_notification: false, // WITH SOUND!
    reply_markup: keyboard,
  });
}

/**
 * Process planApproved activity
 * Brief confirmation message, silent
 */
async function processPlanApproved(
  ctx: BotContext,
  groupId: string,
  topicId: number,
  activity: JulesActivity
): Promise<void> {
  const message = '✅ <b>Plan approved!</b>\n\nJules will start working on the implementation.';

  await ctx.api.sendMessage(groupId, message, {
    message_thread_id: topicId,
    parse_mode: 'HTML',
    disable_notification: true, // SILENT
  });
}

/**
 * Process readyForReview activity
 * Show "Ready for review" with publish buttons
 */
async function processReadyForReview(
  ctx: BotContext,
  groupId: string,
  topicId: number,
  sessionId: string,
  activity: JulesActivity
): Promise<void> {
  let message = '🎉 <b>Ready for review!</b>\n\nJules has finalized the changes.\n\n';

  // TODO: Fetch session outputs to show GitHub links
  // For now, we'll add generic buttons

  const keyboard = new InlineKeyboard()
    .text('📦 Publish Branch', `publish_branch:${sessionId}`)
    .text('🔀 Publish PR', `publish_pr:${sessionId}`);

  message += '<i>Click the buttons below to publish your changes.</i>';

  // Set ready for review flag
  await setReadyForReview(ctx.env, groupId, topicId, true);

  // Send with SOUND
  await ctx.api.sendMessage(groupId, message, {
    message_thread_id: topicId,
    parse_mode: 'HTML',
    disable_notification: false, // WITH SOUND!
    reply_markup: keyboard,
  });
}

/**
 * Process progressUpdated activity
 * Shows bash output, file changes, or media
 */
async function processProgressUpdated(
  ctx: BotContext,
  groupId: string,
  topicId: number,
  activity: JulesActivity
): Promise<void> {
  let message = '';
  let hasError = false;
  let hasMedia = false;

  // Process bash output
  if (activity.artifacts?.bashOutput) {
    const bash = activity.artifacts.bashOutput;
    const exitCode = bash.exitCode || 0;

    if (exitCode !== 0) {
      hasError = true;
    }

    message += formatBashOutput(
      bash.command || 'unknown',
      bash.output || '',
      exitCode
    ) + '\n\n';
  }

  // Process changeSet
  if (activity.artifacts?.changeSet) {
    const changeSet = activity.artifacts.changeSet;
    const files = changeSet.files || [];

    if (files.length > 0) {
      message += formatChangeSet(files, changeSet.gitPatch?.unidiffPatch) + '\n\n';
    }
  }

  // Process media
  if (activity.artifacts?.media) {
    hasMedia = true;
    const media = activity.artifacts.media;

    if (media.data) {
      try {
        const imageData = base64ToUint8Array(media.data);
        const caption = activity.title || activity.description || 'Image from Jules';

        await ctx.api.sendPhoto(groupId, new InputFile(imageData, 'image.jpg'), {
          message_thread_id: topicId,
          caption: caption,
          disable_notification: false, // Media always with sound
        });
      } catch (error) {
        console.error('Error sending media:', error);
        message += '⚠️ Failed to send media\n\n';
      }
    }
  }

  // If no artifacts, show title/description
  if (!message && !hasMedia) {
    message = formatActivityMessage(activity.title, activity.description);
  }

  // Send message if we have one
  if (message.trim()) {
    await ctx.api.sendMessage(groupId, message.trim(), {
      message_thread_id: topicId,
      parse_mode: 'HTML',
      disable_notification: !hasError && !hasMedia, // Sound only on errors or media
    });
  }
}

/**
 * Process sessionCompleted activity
 * Shows completion message with GitHub links
 */
async function processSessionCompleted(
  ctx: BotContext,
  groupId: string,
  topicId: number,
  sessionId: string,
  activity: JulesActivity
): Promise<void> {
  let message = '✅ <b>Session completed!</b>\n\n';

  // TODO: Fetch session outputs to extract GitHub links
  // For now, we'll show basic completion message

  message += escapeHtml(activity.description || 'Jules has finished working on this session.');

  // Send with SOUND
  await ctx.api.sendMessage(groupId, message, {
    message_thread_id: topicId,
    parse_mode: 'HTML',
    disable_notification: false, // WITH SOUND!
  });
}

/**
 * Process generic activity
 * Fallback for unrecognized activity types
 */
async function processGenericActivity(
  ctx: BotContext,
  groupId: string,
  topicId: number,
  activity: JulesActivity
): Promise<void> {
  const message = formatActivityMessage(activity.title, activity.description);

  // Generic activities are silent unless they contain keywords
  const hasImportantKeywords =
    message.toLowerCase().includes('error') ||
    message.toLowerCase().includes('failed') ||
    message.toLowerCase().includes('question');

  await ctx.api.sendMessage(groupId, message, {
    message_thread_id: topicId,
    parse_mode: 'HTML',
    disable_notification: !hasImportantKeywords,
  });
}

/**
 * Parse plan steps from description
 * Returns array of step strings
 */
function parsePlanSteps(description: string): string[] {
  const steps: string[] = [];

  // Try to parse numbered list
  const lines = description.split('\n');

  for (const line of lines) {
    const match = line.match(/^\d+\.\s+(.+)$/);
    if (match) {
      steps.push(match[1].trim());
    }
  }

  return steps;
}
