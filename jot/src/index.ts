import { Bot, webhookCallback, InlineKeyboard } from 'grammy';
import { getKV, setKV, getSession, setSession, addActiveSession, deleteKV, removeActiveSession } from './kv';
import { listSources, createSession, createSessionWithImage, approvePlan, deleteSession } from './jules';
import { pollActivities } from './activities';
import { downloadAndConvertImageToBase64 } from './media';

// Define the environment variables and bindings expected by the Worker.
export interface Env {
	// Telegram Bot Token
	BOT_TOKEN: string;
	// KV Namespace
	JOT_KV: KVNamespace;
}

// Helper function to validate the Jules token
const validateJulesToken = async (token: string): Promise<boolean> => {
	try {
		const response = await fetch('https://jules.googleapis.com/v1alpha/sessions', {
			method: 'GET',
			headers: {
				'Authorization': `Bearer ${token}`,
				'Content-Type': 'application/json',
			},
		});
		return response.ok;
	} catch (error) {
		console.error('Error validating Jules token:', error);
		return false;
	}
};

export default {
	async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
		try {
			// Instantiate the bot
			const bot = new Bot(env.BOT_TOKEN);

			// Add a simple /start command handler
			bot.command('start', (ctx) => ctx.reply('Welcome! Up and running.'));

			// Command to set the Jules token for a group
			bot.command('set_jules_token', async (ctx) => {
				if (ctx.chat.type === 'private') {
					return ctx.reply('This command can only be used in a group.');
				}

				const token = ctx.match;
				if (!token) {
					return ctx.reply('Please provide a Jules token. Usage: /set_jules_token <token>');
				}

				const chatAdmins = await ctx.getChatAdministrators();
				const isAdmin = chatAdmins.some((admin) => admin.user.id === ctx.from.id);

				if (!isAdmin) {
					return ctx.reply('Only group admins can set the Jules token.');
				}

				const isValid = await validateJulesToken(token);
				if (!isValid) {
					return ctx.reply('The provided Jules token is invalid.');
				}

				await setKV(env.JOT_KV, ctx.chat.id, 'jules_token', token);
				return ctx.reply('Jules token has been set successfully for this group.');
			});

			// Command to check the status of the group's configuration
			bot.command('status', async (ctx) => {
				if (ctx.chat.type === 'private') {
					return ctx.reply('This command can only be used in a group.');
				}

				const token = await getKV(env.JOT_KV, ctx.chat.id, 'jules_token');
				const source = await getKV(env.JOT_KV, ctx.chat.id, 'source');
				let statusMessage = '';

				if (token) {
					statusMessage += 'Jules token is configured.\n';
				} else {
					statusMessage += 'Jules token is not configured.\n';
				}

				if (source) {
					statusMessage += `Source is set to: ${source}`;
				} else {
					statusMessage += 'Source is not configured.';
				}

				return ctx.reply(statusMessage);
			});

			// Command to list available sources
			bot.command('list_sources', async (ctx) => {
				if (ctx.chat.type === 'private') {
					return ctx.reply('This command can only be used in a group.');
				}

				const token = await getKV(env.JOT_KV, ctx.chat.id, 'jules_token');
				if (!token) {
					return ctx.reply('Jules token is not configured for this group.');
				}

				try {
					const sources = await listSources(token);
					const sourceNames = sources.sources.map((s: any) => s.name).join('\n');
					return ctx.reply(`Available sources:\n${sourceNames}`);
				} catch (error: any) {
					return ctx.reply(`Error listing sources: ${error.message}`);
				}
			});

			// Command to set the source for the group
			bot.command('set_source', async (ctx) => {
				if (ctx.chat.type === 'private') {
					return ctx.reply('This command can only be used in a group.');
				}

				const source = ctx.match;
				if (!source) {
					return ctx.reply('Please provide a source. Usage: /set_source <source>');
				}

				await setKV(env.JOT_KV, ctx.chat.id, 'source', source);
				return ctx.reply(`Source has been set to: ${source}`);
			});

			// Command to get the current source for the group
			bot.command('get_source', async (ctx) => {
				if (ctx.chat.type === 'private') {
					return ctx.reply('This command can only be used in a group.');
				}

				const source = await getKV(env.JOT_KV, ctx.chat.id, 'source');
				if (source) {
					return ctx.reply(`Current source is: ${source}`);
				} else {
					return ctx.reply('Source is not configured for this group.');
				}
			});

			// Message handler for session management
			bot.on('message:text', async (ctx) => {
				const isTopicMessage = ctx.message.is_topic_message;
				const chatId = ctx.chat.id;
				const messageText = ctx.message.text;

				if (isTopicMessage && ctx.message.message_thread_id && messageText) {
					const topicId = ctx.message.message_thread_id;
					const session = await getSession(env.JOT_KV, chatId, topicId);

					if (session) {
						// Session exists, continue conversation
						return ctx.reply(`Continuing conversation in session: ${session.id}`);
					} else {
						// No session, create a new one
						const token = await getKV(env.JOT_KV, chatId, 'jules_token');
						const source = await getKV(env.JOT_KV, chatId, 'source');

						if (!token || !source) {
							return ctx.reply('This group is not fully configured. Please set the Jules token and source.');
						}

						try {
							await bot.api.sendChatAction(chatId, 'typing', { message_thread_id: topicId });
							const newSession = await createSession(token, messageText, source);
							await setSession(env.JOT_KV, chatId, topicId, newSession);
							await addActiveSession(env.JOT_KV, chatId, topicId, newSession.name);
							return ctx.reply(`New Jules session created: ${newSession.name}`);
						} catch (error: any) {
							return ctx.reply(`Error creating session: ${error.message}`);
						}
					}
				}
			});

			// Handler for photo messages
			bot.on('message:photo', async (ctx) => {
				const isTopicMessage = ctx.message.is_topic_message;
				const chatId = ctx.chat.id;

				if (isTopicMessage && ctx.message.message_thread_id) {
					const topicId = ctx.message.message_thread_id;
					const caption = ctx.message.caption || 'Analyze this image';

					const file = await ctx.getFile();
					const filePath = file.file_path;

					if (!filePath) {
						return ctx.reply('Could not get file path for photo.');
					}

					const token = await getKV(env.JOT_KV, chatId, 'jules_token');
					const source = await getKV(env.JOT_KV, chatId, 'source');

					if (!token || !source) {
						return ctx.reply('This group is not fully configured. Please set the Jules token and source.');
					}

					try {
						await bot.api.sendChatAction(chatId, 'typing', { message_thread_id: topicId });
						const base64Image = await downloadAndConvertImageToBase64(filePath, env.BOT_TOKEN);
						const newSession = await createSessionWithImage(token, caption, source, base64Image);
						await setSession(env.JOT_KV, chatId, topicId, newSession);
						await addActiveSession(env.JOT_KV, chatId, topicId, newSession.name);
						return ctx.reply(`New Jules session created with image: ${newSession.name}`);
					} catch (error: any) {
						return ctx.reply(`Error creating session with image: ${error.message}`);
					}
				}
			});

			// Command to approve a plan
			bot.command('approve_plan', async (ctx) => {
				if (ctx.message?.is_topic_message && ctx.message.message_thread_id) {
					const chatId = ctx.chat.id;
					const topicId = ctx.message.message_thread_id;
					const pendingPlan = await getKV(env.JOT_KV, chatId, `topic:${topicId}:pending_plan`);
					if (pendingPlan) {
						const session = await getSession(env.JOT_KV, chatId, topicId);
						const token = await getKV(env.JOT_KV, chatId, 'jules_token');
						if (session && token) {
							await approvePlan(token, session.name);
							await deleteKV(env.JOT_KV, chatId, `topic:${topicId}:pending_plan`);
							return ctx.reply('Plan approved!');
						}
					} else {
						return ctx.reply('No pending plan to approve in this topic.');
					}
				}
			});

			// Command to delete a session
			bot.command('delete_session', async (ctx) => {
				if (ctx.message?.is_topic_message && ctx.message.message_thread_id) {
					const session = await getSession(env.JOT_KV, ctx.chat.id, ctx.message.message_thread_id);
					if (session) {
						const keyboard = new InlineKeyboard().text("⚠️ Confirm Deletion", `delete_session:${session.name}`);
						return ctx.reply('Are you sure you want to delete this session?', { reply_markup: keyboard });
					} else {
						return ctx.reply('No active session in this topic.');
					}
				}
			});

			// Callback query handlers
			bot.on('callback_query:data', async (ctx) => {
				const [action, sessionId] = ctx.callbackQuery.data.split(':');
				const chatId = ctx.chat.id;
				const topicId = ctx.message?.message_thread_id;

				if (!chatId || !topicId) {
					return ctx.answerCallbackQuery({ text: 'Error: Could not determine chat or topic ID.' });
				}

				const token = await getKV(env.JOT_KV, chatId, 'jules_token');
				if (!token) {
					return ctx.answerCallbackQuery({ text: 'Error: Jules token not configured.' });
				}

				switch(action) {
					case 'approve_plan':
						try {
							await approvePlan(token, sessionId);
							await deleteKV(env.JOT_KV, chatId, `topic:${topicId}:pending_plan`);
							await ctx.editMessageText('✅ Plan approved! Jules will start working.');
						} catch (error: any) {
							await ctx.answerCallbackQuery({ text: `Error: ${error.message}` });
						}
						break;
					case 'delete_session':
						try {
							await deleteSession(token, sessionId);
							await removeActiveSession(env.JOT_KV, sessionId);
							await deleteKV(env.JOT_KV, chatId, `topic:${topicId}:session`);
							await ctx.editMessageText('Session deleted successfully.');
						} catch (error: any) {
							await ctx.answerCallbackQuery({ text: `Error: ${error.message}` });
						}
						break;
					case 'publish_branch':
					case 'publish_pr':
						await ctx.answerCallbackQuery({ text: 'This functionality is under development.' });
						break;
				}

				return ctx.answerCallbackQuery();
			});

			// Create a webhook callback
			const handleUpdate = webhookCallback(bot, 'cloudflare-mod');

			return await handleUpdate(request);
		} catch (e: any) {
			return new Response(e.message);
		}
	},

	async scheduled(controller: ScheduledController, env: Env, ctx: ExecutionContext): Promise<void> {
		const bot = new Bot(env.BOT_TOKEN);
		await pollActivities(bot, env);
	},
} satisfies ExportedHandler<Env>;
