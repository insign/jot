// src/index.ts
import { Bot, webhookCallback, InlineKeyboard } from 'grammy';
import { getKV, setKV, getSession, setSession, addActiveSession, deleteKV, removeActiveSession, getActiveGroups } from './kv';
import { JulesApiError, listSources, createSession, createSessionWithImage, approvePlan, deleteSession, continueSession, publishBranch, publishPr } from './jules';
import { pollActivities } from './activities';
import { downloadAndConvertImageToBase64 } from './media';
import { syncSessionsForGroup } from './sync';
import { extractGitHubLinks } from './utils';

export interface Env {
	BOT_TOKEN: string;
	JOT_KV: KVNamespace;
}

let bot: Bot;
let handleUpdate: (request: Request) => Promise<Response>;

const escapeMarkdownV2 = (str: string) => str.replace(/[_*[\]()~`>#+\-=|{}.!]/g, '\\$&');

export const setupBot = (env: Env) => {
    const localBot = new Bot(env.BOT_TOKEN);

    // ... (error handler and other commands)

    localBot.on('callback_query:data', async (ctx) => {
        const [action, sessionId] = ctx.callbackQuery.data.split(':');
        const chatId = ctx.chat.id;
        const topicId = ctx.message?.message_thread_id;
        if (!chatId || !topicId) return ctx.answerCallbackQuery({ text: 'Error: Context missing.' });

        const token = await getKV(env.JOT_KV, chatId, 'jules_token');
        if (!token) return ctx.answerCallbackQuery({ text: 'Error: Token not configured.' });

        try {
            switch(action) {
                case 'approve_plan':
                    await approvePlan(token, sessionId);
                    await deleteKV(env.JOT_KV, chatId, `topic:${topicId}:pending_plan`);
                    await ctx.editMessageText('✅ Plan approved!');
                    break;
                case 'publish_branch':
                    const branchResult = await publishBranch(token, sessionId);
                    const branchUrl = branchResult.outputs?.branchUrl;
                    if (branchUrl) {
                        await ctx.editMessageText(`🌿 Branch published! [View on GitHub](${escapeMarkdownV2(branchUrl)})`, { parse_mode: 'MarkdownV2' });
                    } else {
                        await ctx.editMessageText('Branch published, but no URL was returned.');
                    }
                    break;
                case 'publish_pr':
                    const prResult = await publishPr(token, sessionId);
                    const prUrl = prResult.outputs?.pullRequestUrl;
                    if (prUrl) {
                        await ctx.editMessageText(`🔀 PR created! [View on GitHub](${escapeMarkdownV2(prUrl)})`, { parse_mode: 'MarkdownV2' });
                    } else {
                        await ctx.editMessageText('PR created, but no URL was returned.');
                    }
                    break;
            }
        } catch (e: any) {
            // handle error
        }
        return ctx.answerCallbackQuery();
    });

    return localBot;
};

const ensureBotInitialized = (env: Env) => {
    if (!bot) {
        bot = setupBot(env);
        handleUpdate = webhookCallback(bot, 'cloudflare-mod');
    }
};

export default {
	async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
		ensureBotInitialized(env);
        return handleUpdate(request);
	},
	async scheduled(controller: ScheduledController, env: Env, ctx: ExecutionContext): Promise<void> {
		ensureBotInitialized(env);
        if (controller.cron === '* * * * *') await pollActivities(bot, env);
        else if (controller.cron === '*/15 * * * *') {
            const configuredGroups = await getActiveGroups(env.JOT_KV);
            for (const groupId of configuredGroups) {
                await syncSessionsForGroup(bot, env, groupId);
            }
        }
	},
};
