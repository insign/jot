// jot/test/index.spec.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { setupBot } from '../src/index';
import * as kv from '../src/kv';
import * as sync from '../src/sync';
import { Bot } from 'grammy';

vi.mock('../src/kv');
vi.mock('../src/jules');
vi.mock('../src/activities');
vi.mock('../src/sync');
vi.mock('../src/media');
vi.mock('../src/utils');

vi.mock('grammy', () => ({
    Bot: vi.fn().mockImplementation(() => ({
        command: vi.fn(),
        on: vi.fn(),
        api: {
            getChatAdministrators: vi.fn().mockResolvedValue([{ user: { id: 1 } }]),
        },
    })),
    webhookCallback: vi.fn(),
    InlineKeyboard: vi.fn(),
}));

const mockEnv = {
    BOT_TOKEN: 'fake-bot-token',
    JOT_KV: 'fake-kv' as any,
};

describe('Bot Command Registration and Handlers', () => {
    let botInstance: any;

    beforeEach(() => {
        vi.clearAllMocks();
        botInstance = setupBot(mockEnv);
    });

    it('should register essential commands', () => {
        const registeredCommands = botInstance.command.mock.calls.map(call => call[0]);
        expect(registeredCommands).toEqual(expect.arrayContaining([
            'start', 'help', 'set_jules_token', 'set_source', 'sync'
        ]));
    });

    it('/sync command should be admin-only and trigger sync', async () => {
        const handler = botInstance.command.mock.calls.find(call => call[0] === 'sync')[1];

        // Non-admin
        const mockCtxNonAdmin = {
            chat: { type: 'group', id: 123 }, from: { id: 999 },
            reply: vi.fn(), getChatAdministrators: botInstance.api.getChatAdministrators,
        };
        await handler(mockCtxNonAdmin);
        expect(mockCtxNonAdmin.reply).toHaveBeenCalledWith('Only group admins can run this command.');
        expect(sync.syncSessionsForGroup).not.toHaveBeenCalled();

        // Admin
        const mockCtxAdmin = {
            chat: { type: 'group', id: 123 }, from: { id: 1 },
            reply: vi.fn(), getChatAdministrators: botInstance.api.getChatAdministrators,
        };
        vi.mocked(sync.syncSessionsForGroup).mockResolvedValue('Sync done.');
        await handler(mockCtxAdmin);
        expect(sync.syncSessionsForGroup).toHaveBeenCalled();
        expect(mockCtxAdmin.reply).toHaveBeenCalledWith('Sync done.');
    });
});
