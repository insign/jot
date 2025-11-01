// src/kv.ts
import { getFromCache, setInCache } from './cache';

const constructKey = (groupId: number, key: string): string => `group:${groupId}:${key}`;

export const getKV = async (kv: KVNamespace, groupId: number, key: string): Promise<string | null> => {
	const constructedKey = constructKey(groupId, key);
    const cachedValue = getFromCache(constructedKey);
    if (cachedValue) {
        return cachedValue;
    }

	const value = await kv.get(constructedKey);
    if (value) {
        setInCache(constructedKey, value);
    }
    return value;
};

export const setKV = async (kv: KVNamespace, groupId: number, key: string, value: string): Promise<void> => {
	const constructedKey = constructKey(groupId, key);
    setInCache(constructedKey, value); // Keep cache in sync
	await kv.put(constructedKey, value);
};

export const deleteKV = async (kv: KVNamespace, groupId: number, key: string): Promise<void> => {
	const constructedKey = constructKey(groupId, key);
    setInCache(constructedKey, null); // Invalidate cache
	await kv.delete(constructedKey);
};

// ... (rest of the functions remain the same)
export const getSession = async (kv: KVNamespace, groupId: number, topicId: number): Promise<any | null> => {
    const sessionKey = `topic:${topicId}:session`;
    const sessionJson = await getKV(kv, groupId, sessionKey);
    return sessionJson ? JSON.parse(sessionJson) : null;
};
export const setSession = async (kv: KVNamespace, groupId: number, topicId: number, session: any): Promise<void> => {
    const sessionKey = `topic:${topicId}:session`;
    await setKV(kv, groupId, sessionKey, JSON.stringify(session));
};
const ACTIVE_SESSIONS_INDEX_KEY = 'active_sessions_index';
const CONFIGURED_GROUPS_KEY = 'configured_groups';
export const getActiveSessions = async (kv: KVNamespace): Promise<{ groupId: number; topicId: number; sessionId: string }[]> => {
    const indexJson = await kv.get(ACTIVE_SESSIONS_INDEX_KEY);
    return indexJson ? JSON.parse(indexJson) : [];
};
export const addActiveSession = async (kv: KVNamespace, groupId: number, topicId: number, sessionId: string): Promise<void> => {
    const sessions = await getActiveSessions(kv);
    if (!sessions.some(s => s.sessionId === sessionId)) {
        sessions.push({ groupId, topicId, sessionId });
        await kv.put(ACTIVE_SESSIONS_INDEX_KEY, JSON.stringify(sessions));
    }
};
export const removeActiveSession = async (kv: KVNamespace, sessionId: string): Promise<void> => {
    let sessions = await getActiveSessions(kv);
    sessions = sessions.filter(session => session.sessionId !== sessionId);
    await kv.put(ACTIVE_SESSIONS_INDEX_KEY, JSON.stringify(sessions));
};
export const getConfiguredGroups = async (kv: KVNamespace): Promise<number[]> => {
    const groupsJson = await kv.get(CONFIGURED_GROUPS_KEY);
    return groupsJson ? JSON.parse(groupsJson) : [];
};
export const addConfiguredGroup = async (kv: KVNamespace, groupId: number): Promise<void> => {
    const groups = await getConfiguredGroups(kv);
    if (!groups.includes(groupId)) {
        groups.push(groupId);
        await kv.put(CONFIGURED_GROUPS_KEY, JSON.stringify(groups));
    }
};
