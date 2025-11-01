// jot/test/kv.spec.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as cache from '../src/cache';
import {
    getKV,
    setKV,
    deleteKV,
    getSession,
    addConfiguredGroup,
    getConfiguredGroups,
} from '../src/kv';

vi.mock('../src/cache');

const createMockKv = () => ({
    get: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
});

let mockKv = createMockKv();

describe('KV Helpers with Cache', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockKv = createMockKv();
    });

    it('getKV should return from cache if available', async () => {
        const key = 'group:123:test_key';
        vi.mocked(cache.getFromCache).mockReturnValue('cached_value');

        const result = await getKV(mockKv as any, 123, 'test_key');

        expect(result).toBe('cached_value');
        expect(cache.getFromCache).toHaveBeenCalledWith(key);
        expect(mockKv.get).not.toHaveBeenCalled();
    });

    it('getKV should fetch from KV and set cache if not cached', async () => {
        const key = 'group:123:test_key';
        vi.mocked(cache.getFromCache).mockReturnValue(null);
        mockKv.get.mockResolvedValue('fetched_value');

        const result = await getKV(mockKv as any, 123, 'test_key');

        expect(result).toBe('fetched_value');
        expect(mockKv.get).toHaveBeenCalledWith(key);
        expect(cache.setInCache).toHaveBeenCalledWith(key, 'fetched_value');
    });

    it('setKV should write to KV and update cache', async () => {
        const key = 'group:123:test_key';
        await setKV(mockKv as any, 123, 'test_key', 'new_value');

        expect(mockKv.put).toHaveBeenCalledWith(key, 'new_value');
        expect(cache.setInCache).toHaveBeenCalledWith(key, 'new_value');
    });

    it('deleteKV should delete from KV and invalidate cache', async () => {
        const key = 'group:123:test_key';
        await deleteKV(mockKv as any, 123, 'test_key');

        expect(mockKv.delete).toHaveBeenCalledWith(key);
        expect(cache.setInCache).toHaveBeenCalledWith(key, null);
    });

    it('should correctly manage the configured groups list', async () => {
        const key = 'configured_groups';
        // Mock the get call for this specific key
        mockKv.get.mockImplementation(async (k) => {
            if (k === key) return JSON.stringify([111]);
            return null;
        });

        // Test adding a new group
        await addConfiguredGroup(mockKv as any, 222);
        expect(mockKv.put).toHaveBeenCalledWith(key, JSON.stringify([111, 222]));

        // Test getting the list
        const groups = await getConfiguredGroups(mockKv as any);
        expect(groups).toEqual([111]);
    });
});
