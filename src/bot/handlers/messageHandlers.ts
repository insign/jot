/**
 * Message handlers
 * Handles text and photo messages for continuous conversation with Jules
 */

import type { BotContext } from '../bot';
import { getGroupId, getTopicId, startTypingLoop, updateTopicTitle } from '../bot';
import {
  getJulesToken,
  getSource,
  getSession,
  setSession,
  addToSessionsIndex,
  getDefaultBranch,
  getAutomationMode,
  getRequireApproval,
} from '../../kv/storage';
import { createJulesClient } from '../../jules/api';
import { downloadAndConvertImageToBase64 } from '../../utils/image';
import { parseSourceToRepoInfo } from '../../utils/github';
import type { SessionData } from '../../types/env';

/**
 * Handle text messages in topics
 * Creates new session or sends message to existing session
 */
export async function handleTextMessage(ctx: BotContext): Promise<void> {
  const groupId = getGroupId(ctx);
  const topicId = getTopicId(ctx);

  // Ignore messages not in topics
  if (!groupId || !topicId) {
    return;
  }

  // Ignore commands (they have their own handlers)
  const text = ctx.message?.text || '';
  if (text.startsWith('/')) {
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

  // Check if session exists for this topic
  let session = await getSession(ctx.env, groupId, topicId);

  const julesClient = createJulesClient(token);

  try {
    if (!session) {
      // Create new session
      const stopTyping = startTypingLoop(ctx);

      try {
        const defaultBranch = await getDefaultBranch(ctx.env, groupId);
        const automationMode = await getAutomationMode(ctx.env, groupId);
        const requireApproval = await getRequireApproval(ctx.env, groupId);

        const julesSession = await julesClient.createSession({
          prompt: text,
          source,
          automationMode: automationMode || 'MANUAL',
          requirePlanApproval: requireApproval,
          startingBranch: defaultBranch || undefined,
        });

        // Store session in KV
        const sessionData: SessionData = {
          session_id: julesSession.name,
          group_id: groupId,
          topic_id: topicId,
          source: julesSession.source,
          automation_mode: julesSession.automationMode,
          require_plan_approval: julesSession.requirePlanApproval,
          starting_branch: julesSession.startingBranch,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };

        await setSession(ctx.env, groupId, topicId, sessionData);
        await addToSessionsIndex(ctx.env, groupId, julesSession.name);

        // Update topic title
        const repoInfo = parseSourceToRepoInfo(source);
        if (repoInfo) {
          await updateTopicTitle(ctx, groupId, topicId, repoInfo.owner, repoInfo.repo, julesSession.name);
        }

        stopTyping();

        await ctx.reply(
          '✅ <b>Session created!</b>\n\n' +
          'I will send you updates automatically as Jules works on your request.',
          { parse_mode: 'HTML', disable_notification: true }
        );
      } finally {
        stopTyping();
      }
    } else {
      // Send message to existing session
      const stopTyping = startTypingLoop(ctx);

      try {
        await julesClient.sendMessage(session.session_id, {
          prompt: text,
        });

        stopTyping();

        await ctx.reply(
          '✅ Message sent to Jules.',
          { disable_notification: true }
        );
      } finally {
        stopTyping();
      }
    }
  } catch (error) {
    console.error('Error handling text message:', error);
    await ctx.reply(
      '❌ Failed to process message.\n\n' +
      'Error: ' + (error instanceof Error ? error.message : 'Unknown error')
    );
  }
}

/**
 * Handle photo messages in topics
 * Downloads photo, converts to base64, and sends to Jules
 */
export async function handlePhotoMessage(ctx: BotContext): Promise<void> {
  const groupId = getGroupId(ctx);
  const topicId = getTopicId(ctx);

  // Ignore photos not in topics
  if (!groupId || !topicId) {
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

  // Get highest resolution photo
  const photos = ctx.message?.photo;
  if (!photos || photos.length === 0) {
    return;
  }

  const photo = photos[photos.length - 1];

  // Get caption (or use default)
  const caption = ctx.message?.caption || 'Analyze this image';

  await ctx.reply('🔄 Processing image...');

  try {
    // Download and convert image to base64
    const file = await ctx.api.getFile(photo.file_id);

    if (!file.file_path) {
      await ctx.reply('❌ Failed to get image file path.');
      return;
    }

    const imageData = await downloadAndConvertImageToBase64(file.file_path, ctx.env.BOT_TOKEN);

    if (!imageData) {
      await ctx.reply('❌ Failed to download or convert image. Please try again.');
      return;
    }

    // Check if session exists for this topic
    let session = await getSession(ctx.env, groupId, topicId);

    const julesClient = createJulesClient(token);

    if (!session) {
      // Create new session with image
      const stopTyping = startTypingLoop(ctx);

      try {
        const defaultBranch = await getDefaultBranch(ctx.env, groupId);
        const automationMode = await getAutomationMode(ctx.env, groupId);
        const requireApproval = await getRequireApproval(ctx.env, groupId);

        const julesSession = await julesClient.createSession({
          prompt: caption,
          source,
          automationMode: automationMode || 'MANUAL',
          requirePlanApproval: requireApproval,
          startingBranch: defaultBranch || undefined,
          media: imageData,
        });

        // Store session in KV
        const sessionData: SessionData = {
          session_id: julesSession.name,
          group_id: groupId,
          topic_id: topicId,
          source: julesSession.source,
          automation_mode: julesSession.automationMode,
          require_plan_approval: julesSession.requirePlanApproval,
          starting_branch: julesSession.startingBranch,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };

        await setSession(ctx.env, groupId, topicId, sessionData);
        await addToSessionsIndex(ctx.env, groupId, julesSession.name);

        // Update topic title
        const repoInfo = parseSourceToRepoInfo(source);
        if (repoInfo) {
          await updateTopicTitle(ctx, groupId, topicId, repoInfo.owner, repoInfo.repo, julesSession.name);
        }

        stopTyping();

        await ctx.reply(
          '✅ <b>Session created with image!</b>\n\n' +
          'I will send you updates automatically as Jules works on your request.',
          { parse_mode: 'HTML', disable_notification: true }
        );
      } finally {
        stopTyping();
      }
    } else {
      // Send message with image to existing session
      const stopTyping = startTypingLoop(ctx);

      try {
        await julesClient.sendMessage(session.session_id, {
          prompt: caption,
          media: imageData,
        });

        stopTyping();

        await ctx.reply(
          '✅ Image sent to Jules.',
          { disable_notification: true }
        );
      } finally {
        stopTyping();
      }
    }
  } catch (error) {
    console.error('Error handling photo message:', error);
    await ctx.reply(
      '❌ Failed to process image.\n\n' +
      'Error: ' + (error instanceof Error ? error.message : 'Unknown error')
    );
  }
}
