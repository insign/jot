// src/activities.ts
import { Bot, InlineKeyboard } from 'grammy';
import { Env } from './index';
import { getActiveSessions, getKV, setKV, getSession, removeActiveSession } from './kv';
import { listActivities } from './jules';

// A type for the return value of formatActivity
interface FormattedMessage {
    text: string;
    options: {
        message_thread_id: number;
        parse_mode: 'HTML';
        disable_notification?: boolean;
        reply_markup?: InlineKeyboard;
    };
}

/**
 * Polls for new activities for all active sessions and sends them to the appropriate chat.
 */
export const pollActivities = async (bot: Bot, env: Env) => {
	const activeSessions = await getActiveSessions(env.JOT_KV);

	for (const sessionInfo of activeSessions) {
		const token = await getKV(env.JOT_KV, sessionInfo.groupId, 'jules_token');
		if (!token) {
			console.error(`No token found for group ${sessionInfo.groupId}`);
			continue;
		}

		try {
			const lastActivityTimestamp = await getKV(env.JOT_KV, sessionInfo.groupId, `topic:${sessionInfo.topicId}:last_activity_timestamp`) || '1970-01-01T00:00:00Z';
			const response = await listActivities(token, sessionInfo.sessionId);
            const activities = response.activities || [];

			const newActivities = activities
                .filter((activity: any) => activity.createTime > lastActivityTimestamp)
                .sort((a: any, b: any) => new Date(a.createTime).getTime() - new Date(b.createTime).getTime());

			for (const activity of newActivities) {
				const formattedMessage = await formatActivity(activity, sessionInfo, env);
				if (formattedMessage) {
					await bot.api.sendMessage(sessionInfo.groupId, formattedMessage.text, formattedMessage.options);
				}

                if (activity.type === 'sessionCompleted') {
                    await removeActiveSession(env.JOT_KV, sessionInfo.sessionId);
                }

                await setKV(env.JOT_KV, sessionInfo.groupId, `topic:${sessionInfo.topicId}:last_activity_timestamp`, activity.createTime);
			}
		} catch (error) {
			console.error(`Error polling activities for session ${sessionInfo.sessionId}:`, error);
		}
	}
};

/**
 * Formats a long text into an expandable blockquote for Telegram.
 */
const formatExpandable = (title: string, content: string): string => {
    const escapedContent = content.replace(/</g, '&lt;').replace(/>/g, '&gt;');
    return `<b>${title}</b>\n<blockquote expandable><pre><code>${escapedContent}</code></pre></blockquote>`;
};

/**
 * Formats an activity object into a user-friendly message.
 */
const formatActivity = async (activity: any, sessionInfo: any, env: Env): Promise<FormattedMessage | null> => {
	let text = `Unhandled activity type: <code>${activity.type}</code>`;
	let disable_notification = true;
	let reply_markup: InlineKeyboard | undefined = undefined;

    const { groupId, topicId, sessionId } = sessionInfo;

	switch (activity.type) {
		case 'planGenerated':
            const plan = activity.planGenerated.plan;
            const steps = plan.steps.map((step: any, index: number) => `${index + 1}. ${step.description}`).join('\n');
            const session = await getSession(env.JOT_KV, groupId, topicId);
            const approvalRequired = session?.requirePlanApproval ?? true;

            text = `🎯 <b>PLAN CREATED</b>`;
            if (approvalRequired) {
                text += ` - <b>APPROVAL REQUIRED</b>`;
            }
            text += `\n${formatExpandable(`View ${plan.steps.length} Steps`, steps)}`;

            if (approvalRequired) {
                reply_markup = new InlineKeyboard().text("✅ Approve Plan", `approve_plan:${sessionId}`);
                await setKV(env.JOT_KV, groupId, `topic:${topicId}:pending_plan`, 'true');
            } else {
                text += `\n\n<i>Plan will be auto-approved.</i>`;
            }
			disable_notification = false;
			break;

        case 'planApproved':
            text = '✅ Plan approved! Jules will start working.';
            disable_notification = true;
            break;

		case 'progressUpdated':
            const details = activity.progressUpdated;
            if (details.title.includes('Ready for review')) {
                text = `🎉 <b>Ready for review!</b>\n\nJules has finished the changes.`;
                reply_markup = new InlineKeyboard()
                    .text("📦 Publish branch", `publish_branch:${sessionId}`)
                    .text("🔀 Publish PR", `publish_pr:${sessionId}`);
                disable_notification = false;
            } else if (details.bashOutput) {
                const command = details.bashOutput.command;
                const output = details.bashOutput.output;
                const exitCode = details.bashOutput.exitCode;
                text = formatExpandable(`🔧 Command executed: <code>${command}</code> (Exit: ${exitCode})`, output);
                if (exitCode !== 0) {
                    text = `⚠️ ` + text;
                    disable_notification = false;
                }
            } else {
                text = `🔧 <b>Progress:</b> ${details.title}`;
            }
			break;

		case 'sessionCompleted':
            text = `✅ <b>Session completed!</b>`;
            disable_notification = false;
			break;

        default:
            return null;
	}

	return {
		text,
		options: {
			message_thread_id: topicId,
			parse_mode: 'HTML',
			disable_notification,
			reply_markup,
		},
	};
};
