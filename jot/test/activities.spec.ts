// jot/test/activities.spec.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { pollActivities } from '../src/activities';
import * as kv from '../src/kv';
import * as jules from '../src/jules';
import { Bot, InlineKeyboard } from 'grammy';

// Mock dependencies
vi.mock('../src/kv');
vi.mock('../src/jules');

// Mock Bot instance
const mockBot = {
    api: {
        sendMessage: vi.fn(),
    },
};

const mockEnv = {
    JOT_KV: 'mock_kv' as any,
    BOT_TOKEN: 'mock_bot_token',
};

describe('Activity Polling and Formatting', () => {

    beforeEach(() => {
        // Reset mocks before each test to ensure isolation
        vi.clearAllMocks();

        // Provide a more specific mock for getKV
        vi.mocked(kv.getKV).mockImplementation(async (kv, groupId, key) => {
            if (key.includes('jules_token')) {
                return 'fake-token';
            }
            if (key.includes('last_activity_timestamp')) {
                // Return an old timestamp so new activities are always processed
                return '2020-01-01T00:00:00Z';
            }
            return null;
        });
    });

    it('should correctly format a planGenerated activity with approval required', async () => {
        const mockActivity = {
            type: 'planGenerated',
            planGenerated: {
                plan: {
                    steps: [{ description: 'Step 1' }, { description: 'Step 2' }],
                },
            },
            createTime: new Date().toISOString(),
        };
        const mockSessionInfo = { groupId: 1, topicId: 101, sessionId: 'session-123' };

        vi.mocked(kv.getActiveSessions).mockResolvedValue([mockSessionInfo]);
        vi.mocked(kv.getSession).mockResolvedValue({ requirePlanApproval: true });
        vi.mocked(jules.listActivities).mockResolvedValue({ activities: [mockActivity] });

        await pollActivities(mockBot as any, mockEnv);

        expect(mockBot.api.sendMessage).toHaveBeenCalledOnce();
        const sendMessageCall = mockBot.api.sendMessage.mock.calls[0];
        const text = sendMessageCall[1];
        const options = sendMessageCall[2];

        expect(text).toContain('🎯 <b>PLAN CREATED</b> - <b>APPROVAL REQUIRED</b>');
        expect(text).toContain('<blockquote expandable>');
        expect(options.parse_mode).toBe('HTML');
        expect(options.disable_notification).toBe(false);
        expect(options.reply_markup).toBeInstanceOf(InlineKeyboard);
    });

    it('should correctly format a sessionCompleted activity', async () => {
        const mockActivity = {
            type: 'sessionCompleted',
            createTime: new Date().toISOString(),
        };
        const mockSessionInfo = { groupId: 2, topicId: 202, sessionId: 'session-abc' };

        vi.mocked(kv.getActiveSessions).mockResolvedValue([mockSessionInfo]);
        vi.mocked(jules.listActivities).mockResolvedValue({ activities: [mockActivity] });

        await pollActivities(mockBot as any, mockEnv);

        expect(mockBot.api.sendMessage).toHaveBeenCalledOnce();
        const sendMessageCall = mockBot.api.sendMessage.mock.calls[0];
        const text = sendMessageCall[1];
        const options = sendMessageCall[2];

        expect(text).toBe('✅ <b>Session completed!</b>');
        expect(options.disable_notification).toBe(false);
    });

    it('should correctly format a progressUpdated activity with a bash error', async () => {
        const mockActivity = {
            type: 'progressUpdated',
            progressUpdated: {
                title: 'Running command',
                bashOutput: {
                    command: 'npm install',
                    output: 'Error occurred',
                    exitCode: 1,
                },
            },
            createTime: new Date().toISOString(),
        };
        const mockSessionInfo = { groupId: 3, topicId: 303, sessionId: 'session-def' };

        vi.mocked(kv.getActiveSessions).mockResolvedValue([mockSessionInfo]);
        vi.mocked(jules.listActivities).mockResolvedValue({ activities: [mockActivity] });

        await pollActivities(mockBot as any, mockEnv);

        expect(mockBot.api.sendMessage).toHaveBeenCalledOnce();
        const sendMessageCall = mockBot.api.sendMessage.mock.calls[0];
        const text = sendMessageCall[1];
        const options = sendMessageCall[2];

        expect(text).toContain('⚠️');
        expect(text).toContain('Command executed: <code>npm install</code> (Exit: 1)');
        expect(options.disable_notification).toBe(false);
    });
});
