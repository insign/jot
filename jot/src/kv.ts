// src/kv.ts

/**
 * Constructs a KV key with a group_id prefix to ensure multi-tenant isolation.
 * @param groupId - The ID of the Telegram group.
 * @param key - The specific key for the data.
 * @returns The fully constructed KV key.
 */
const constructKey = (groupId: number, key: string): string => `group:${groupId}:${key}`;

/**
 * Retrieves a value from the KV namespace for a specific group.
 * @param kv - The KVNamespace instance.
 * @param groupId - The ID of the Telegram group.
 * @param key - The key for the data to retrieve.
 * @returns The value from the KV store, or null if not found.
 */
export const getKV = async (kv: KVNamespace, groupId: number, key: string): Promise<string | null> => {
	const constructedKey = constructKey(groupId, key);
	return await kv.get(constructedKey);
};

/**
 * Stores a value in the KV namespace for a specific group.
 * @param kv - The KVNamespace instance.
 * @param groupId - The ID of the Telegram group.
 * @param key - The key for the data to store.
 * @param value - The value to store.
 */
export const setKV = async (kv: KVNamespace, groupId: number, key: string, value: string): Promise<void> => {
	const constructedKey = constructKey(groupId, key);
	await kv.put(constructedKey, value);
};

/**
 * Deletes a value from the KV namespace for a specific group.
 * @param kv - The KVNamespace instance.
 * @param groupId - The ID of the Telegram group.
 * @param key - The key for the data to delete.
 */
export const deleteKV = async (kv: KVNamespace, groupId: number, key: string): Promise<void> => {
	const constructedKey = constructKey(groupId, key);
	await kv.delete(constructedKey);
};

/**
 * Retrieves a session object from the KV namespace for a specific topic.
 * @param kv - The KVNamespace instance.
 * @param groupId - The ID of the Telegram group.
 * @param topicId - The ID of the message thread (topic).
 * @returns The session object, or null if not found.
 */
export const getSession = async (kv: KVNamespace, groupId: number, topicId: number): Promise<any | null> => {
    const sessionKey = `topic:${topicId}:session`;
    const sessionJson = await getKV(kv, groupId, sessionKey);
    return sessionJson ? JSON.parse(sessionJson) : null;
};

/**
 * Stores a session object in the KV namespace for a specific topic.
 * @param kv - The KVNamespace instance.
 * @param groupId - The ID of the Telegram group.
 * @param topicId - The ID of the message thread (topic).
 * @param session - The session object to store.
 */
export const setSession = async (kv: KVNamespace, groupId: number, topicId: number, session: any): Promise<void> => {
    const sessionKey = `topic:${topicId}:session`;
    await setKV(kv, groupId, sessionKey, JSON.stringify(session));
};

// Functions for managing the active sessions index
const ACTIVE_SESSIONS_INDEX_KEY = 'active_sessions_index';

/**
 * Retrieves the list of active sessions from the KV namespace.
 * @param kv - The KVNamespace instance.
 * @returns An array of active session objects.
 */
export const getActiveSessions = async (kv: KVNamespace): Promise<{ groupId: number; topicId: number; sessionId: string }[]> => {
    const indexJson = await kv.get(ACTIVE_SESSIONS_INDEX_KEY);
    return indexJson ? JSON.parse(indexJson) : [];
};

/**
 * Adds a session to the active sessions index.
 * @param kv - The KVNamespace instance.
 * @param groupId - The ID of the Telegram group.
 * @param topicId - The ID of the message thread (topic).
 * @param sessionId - The ID of the Jules session.
 */
export const addActiveSession = async (kv: KVNamespace, groupId: number, topicId: number, sessionId: string): Promise<void> => {
    const sessions = await getActiveSessions(kv);
    sessions.push({ groupId, topicId, sessionId });
    await kv.put(ACTIVE_SESSIONS_INDEX_KEY, JSON.stringify(sessions));
};

/**
 * Removes a session from the active sessions index.
 * @param kv - The KVNamespace instance.
 * @param sessionId - The ID of the Jules session to remove.
 */
export const removeActiveSession = async (kv: KVNamespace, sessionId: string): Promise<void> => {
    let sessions = await getActiveSessions(kv);
    sessions = sessions.filter(session => session.sessionId !== sessionId);
    await kv.put(ACTIVE_SESSIONS_INDEX_KEY, JSON.stringify(sessions));
};
