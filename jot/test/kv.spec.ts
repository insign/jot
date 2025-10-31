// jot/test/kv.spec.ts
import { describe, it, expect, beforeEach } from 'vitest';
import {
    getKV,
    setKV,
    deleteKV,
    getSession,
    setSession,
    getActiveSessions,
    addActiveSession,
    removeActiveSession,
} from '../src/kv';

// A simple in-memory mock for the KVNamespace
const createMockKv = () => {
    let store: Record<string, string> = {};

    return {
        get: async (key: string) => store[key] ?? null,
        put: async (key: string, value: string) => {
            store[key] = value;
        },
        delete: async (key: string) => {
            delete store[key];
        },
        // Helper to inspect the store
        _getStore: () => store,
        // Helper to reset the store
        _reset: () => {
            store = {};
        },
    };
};

const mockKv = createMockKv();

describe('KV Helpers', () => {
    beforeEach(() => {
        mockKv._reset();
    });

    it('should set and get a simple value with group isolation', async () => {
        const groupId = 12345;
        const key = 'test_key';
        const value = 'test_value';

        await setKV(mockKv as any, groupId, key, value);
        const retrievedValue = await getKV(mockKv as any, groupId, key);

        expect(retrievedValue).toBe(value);
        // Check that the key is constructed correctly in the underlying store
        expect(mockKv._getStore()[`group:${groupId}:${key}`]).toBe(value);
    });

    it('should delete a value', async () => {
        const groupId = 12345;
        const key = 'test_key';
        const value = 'test_value';

        await setKV(mockKv as any, groupId, key, value);
        let retrievedValue = await getKV(mockKv as any, groupId, key);
        expect(retrievedValue).toBe(value);

        await deleteKV(mockKv as any, groupId, key);
        retrievedValue = await getKV(mockKv as any, groupId, key);
        expect(retrievedValue).toBeNull();
    });

    it('should set and get a session object', async () => {
        const groupId = 54321;
        const topicId = 111;
        const session = { id: 'session-abc', data: { prompt: 'hello' } };

        await setSession(mockKv as any, groupId, topicId, session);
        const retrievedSession = await getSession(mockKv as any, groupId, topicId);

        expect(retrievedSession).toEqual(session);
        // Check that the stored value is a JSON string
        const rawValue = mockKv._getStore()[`group:${groupId}:topic:${topicId}:session`];
        expect(rawValue).toBe(JSON.stringify(session));
    });

    it('should return null if a session is not found', async () => {
        const retrievedSession = await getSession(mockKv as any, 999, 888);
        expect(retrievedSession).toBeNull();
    });

    it('should manage the active sessions index correctly', async () => {
        // Initially empty
        let activeSessions = await getActiveSessions(mockKv as any);
        expect(activeSessions).toEqual([]);

        // Add one session
        await addActiveSession(mockKv as any, 1, 101, 'session-1');
        activeSessions = await getActiveSessions(mockKv as any);
        expect(activeSessions).toHaveLength(1);
        expect(activeSessions).toEqual([{ groupId: 1, topicId: 101, sessionId: 'session-1' }]);

        // Add a second session
        await addActiveSession(mockKv as any, 2, 202, 'session-2');
        activeSessions = await getActiveSessions(mockKv as any);
        expect(activeSessions).toHaveLength(2);

        // Remove the first session
        await removeActiveSession(mockKv as any, 'session-1');
        activeSessions = await getActiveSessions(mockKv as any);
        expect(activeSessions).toHaveLength(1);
        expect(activeSessions).toEqual([{ groupId: 2, topicId: 202, sessionId: 'session-2' }]);

        // Remove the remaining session
        await removeActiveSession(mockKv as any, 'session-2');
        activeSessions = await getActiveSessions(mockKv as any);
        expect(activeSessions).toEqual([]);
    });
});
