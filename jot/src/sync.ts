// src/sync.ts
import { Bot } from 'grammy';
import { Env } from './index';
import { getKV, deleteKV, getActiveSessions, removeActiveSession } from './kv';
import { julesApiRequest } from './jules';

/**
 * Synchronizes the sessions for a given group, removing any that have been deleted on the Jules platform.
 * @param bot - The Grammy bot instance.
 * @param env - The worker environment.
 * @param groupId - The ID of the Telegram group to sync.
 * @returns A summary of the synchronization results.
 */
export const syncSessionsForGroup = async (bot: Bot, env: Env, groupId: number): Promise<string> => {
    const token = await getKV(env.JOT_KV, groupId, 'jules_token');
    if (!token) {
        return 'Jules token is not configured for this group.';
    }

    try {
        const [julesSessionsResponse, activeKvSessions] = await Promise.all([
            julesApiRequest(token, 'sessions'),
            getActiveSessions(env.JOT_KV),
        ]);

        const julesSessionIds = new Set((julesSessionsResponse.sessions || []).map((s: any) => s.name));
        const groupKvSessions = activeKvSessions.filter(s => s.groupId === groupId);

        const sessionsToDelete = groupKvSessions.filter((s: any) => !julesSessionIds.has(s.sessionId));

        let removedCount = 0;
        for (const session of sessionsToDelete) {
            await removeActiveSession(env.JOT_KV, session.sessionId);
            await deleteKV(env.JOT_KV, groupId, `topic:${session.topicId}:session`);
            await deleteKV(env.JOT_KV, groupId, `topic:${session.topicId}:last_activity_timestamp`);
            await deleteKV(env.JOT_KV, groupId, `topic:${session.topicId}:pending_plan`);
            removedCount++;
            // Optionally, notify the group that a session was cleaned up
            await bot.api.sendMessage(groupId, `Cleaned up stale session \`${session.sessionId}\``, { message_thread_id: session.topicId, parse_mode: 'MarkdownV2' });
        }

        const syncedCount = groupKvSessions.length - removedCount;
        return `Sync complete. ${syncedCount} sessions active, ${removedCount} stale sessions removed.`;

    } catch (error: any) {
        return `Error during sync: ${error.message}`;
    }
};
