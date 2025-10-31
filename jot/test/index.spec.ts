// jot/test/index.spec.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import worker from '../src/index';
import * as kv from '../src/kv';
import * as jules from '../src/jules';
import { Bot } from 'grammy';

// Mock the entire 'grammy' module
vi.mock('grammy', () => {
    const mockBotInstance = {
        command: vi.fn(),
        on: vi.fn(),
    };
    return {
        Bot: vi.fn(() => mockBotInstance),
        webhookCallback: vi.fn((bot) => async (request: Request) => new Response('mocked webhook response')),
        InlineKeyboard: vi.fn().mockImplementation(() => ({
            text: vi.fn().mockReturnThis(),
        })),
    };
});

// Mock our own modules
vi.mock('../src/kv');
vi.mock('../src/jules');
vi.mock('../src/activities');

const mockEnv = {
    BOT_TOKEN: 'fake-bot-token',
    JOT_KV: 'fake-kv' as any,
};

describe('Bot Command and Message Handlers', () => {
    let botInstance: any;

    beforeEach(() => {
        // Reset mocks before each test
        vi.clearAllMocks();
        // Get a fresh mocked bot instance for each test
        botInstance = new Bot(mockEnv.BOT_TOKEN);
    });

    it('should register a /start command handler', async () => {
        await worker.fetch(new Request('http://localhost'), mockEnv, {} as any);
        expect(botInstance.command).toHaveBeenCalledWith('start', expect.any(Function));
    });

    it('should register a /set_jules_token command handler', async () => {
        await worker.fetch(new Request('http://localhost'), mockEnv, {} as any);
        expect(botInstance.command).toHaveBeenCalledWith('set_jules_token', expect.any(Function));
    });

    it('should register a message:text handler for session management', async () => {
        await worker.fetch(new Request('http://localhost'), mockEnv, {} as any);
        expect(botInstance.on).toHaveBeenCalledWith('message:text', expect.any(Function));
    });

    it('should register a message:photo handler for image sessions', async () => {
        await worker.fetch(new Request('http://localhost'), mockEnv, {} as any);
        expect(botInstance.on).toHaveBeenCalledWith('message:photo', expect.any(Function));
    });

    it('should register a callback_query:data handler for inline buttons', async () => {
        await worker.fetch(new Request('http://localhost'), mockEnv, {} as any);
        expect(botInstance.on).toHaveBeenCalledWith('callback_query:data', expect.any(Function));
    });

    // In-depth test for a specific command's logic
    it('/status command should report configured status', async () => {
        // 1. Setup the specific mock state for this test
        vi.mocked(kv.getKV)
            .mockResolvedValueOnce('a-valid-token') // First call for token
            .mockResolvedValueOnce('sources/github/user/repo'); // Second call for source

        // 2. We need to actually get the handler function that was registered.
        // This is a bit tricky with the current setup, but we can capture it.
        await worker.fetch(new Request('http://localhost'), mockEnv, {} as any);
        const statusHandler = botInstance.command.mock.calls.find(call => call[0] === 'status')[1];

        // 3. Create a mock context (ctx) object for the handler
        const mockCtx = {
            chat: { type: 'group', id: 123 },
            reply: vi.fn(),
        };

        // 4. Execute the handler with the mock context
        await statusHandler(mockCtx);

        // 5. Assert the outcome
        expect(mockCtx.reply).toHaveBeenCalledWith(
            'Jules token is configured.\nSource is set to: sources/github/user/repo'
        );
    });
});
