import type { Env, SessionData, GroupConfig } from '../types/env';

/**
 * KV Storage Helper Functions
 * Provides multi-tenant isolation by prefixing all keys with group_id
 */

// Key patterns for multi-tenant isolation
const keys = {
  julesToken: (groupId: string) => `group:${groupId}:jules_token`,
  source: (groupId: string) => `group:${groupId}:source`,
  defaultBranch: (groupId: string) => `group:${groupId}:default_branch`,
  automationMode: (groupId: string) => `group:${groupId}:automation_mode`,
  requireApproval: (groupId: string) => `group:${groupId}:require_approval`,
  sessionsIndex: (groupId: string) => `group:${groupId}:sessions_index`,
  session: (groupId: string, topicId: number) => `group:${groupId}:topic:${topicId}:session`,
  lastActivityId: (groupId: string, topicId: number) => `group:${groupId}:topic:${topicId}:last_activity_id`,
  pendingPlan: (groupId: string, topicId: number) => `group:${groupId}:topic:${topicId}:pending_plan`,
  readyForReview: (groupId: string, topicId: number) => `group:${groupId}:topic:${topicId}:ready_for_review`,
};

/**
 * Get Jules API token for a group
 */
export async function getJulesToken(env: Env, groupId: string): Promise<string | null> {
  return await env.KV.get(keys.julesToken(groupId));
}

/**
 * Set Jules API token for a group
 */
export async function setJulesToken(env: Env, groupId: string, token: string): Promise<void> {
  await env.KV.put(keys.julesToken(groupId), token);
}

/**
 * Get configured source for a group
 */
export async function getSource(env: Env, groupId: string): Promise<string | null> {
  return await env.KV.get(keys.source(groupId));
}

/**
 * Set source for a group
 */
export async function setSource(env: Env, groupId: string, source: string): Promise<void> {
  await env.KV.put(keys.source(groupId), source);
}

/**
 * Get default branch for a group
 */
export async function getDefaultBranch(env: Env, groupId: string): Promise<string | null> {
  return await env.KV.get(keys.defaultBranch(groupId));
}

/**
 * Set default branch for a group
 */
export async function setDefaultBranch(env: Env, groupId: string, branch: string): Promise<void> {
  await env.KV.put(keys.defaultBranch(groupId), branch);
}

/**
 * Get automation mode for a group
 */
export async function getAutomationMode(env: Env, groupId: string): Promise<'AUTO_PR' | 'MANUAL' | null> {
  const mode = await env.KV.get(keys.automationMode(groupId));
  return mode as 'AUTO_PR' | 'MANUAL' | null;
}

/**
 * Set automation mode for a group
 */
export async function setAutomationMode(env: Env, groupId: string, mode: 'AUTO_PR' | 'MANUAL'): Promise<void> {
  await env.KV.put(keys.automationMode(groupId), mode);
}

/**
 * Get require approval setting for a group
 */
export async function getRequireApproval(env: Env, groupId: string): Promise<boolean> {
  const value = await env.KV.get(keys.requireApproval(groupId));
  return value === 'true';
}

/**
 * Set require approval setting for a group
 */
export async function setRequireApproval(env: Env, groupId: string, require: boolean): Promise<void> {
  await env.KV.put(keys.requireApproval(groupId), require ? 'true' : 'false');
}

/**
 * Get session data for a topic
 */
export async function getSession(env: Env, groupId: string, topicId: number): Promise<SessionData | null> {
  const data = await env.KV.get(keys.session(groupId, topicId));
  return data ? JSON.parse(data) : null;
}

/**
 * Set session data for a topic
 */
export async function setSession(env: Env, groupId: string, topicId: number, session: SessionData): Promise<void> {
  session.updated_at = new Date().toISOString();
  await env.KV.put(keys.session(groupId, topicId), JSON.stringify(session));
}

/**
 * Delete session data for a topic
 */
export async function deleteSession(env: Env, groupId: string, topicId: number): Promise<void> {
  await env.KV.delete(keys.session(groupId, topicId));
  await env.KV.delete(keys.lastActivityId(groupId, topicId));
  await env.KV.delete(keys.pendingPlan(groupId, topicId));
  await env.KV.delete(keys.readyForReview(groupId, topicId));
}

/**
 * Get sessions index for a group
 * Returns array of session_ids
 */
export async function getSessionsIndex(env: Env, groupId: string): Promise<string[]> {
  const data = await env.KV.get(keys.sessionsIndex(groupId));
  return data ? JSON.parse(data) : [];
}

/**
 * Add session to sessions index
 */
export async function addToSessionsIndex(env: Env, groupId: string, sessionId: string): Promise<void> {
  const index = await getSessionsIndex(env, groupId);
  if (!index.includes(sessionId)) {
    index.push(sessionId);
    await env.KV.put(keys.sessionsIndex(groupId), JSON.stringify(index));
  }
}

/**
 * Remove session from sessions index
 */
export async function removeFromSessionsIndex(env: Env, groupId: string, sessionId: string): Promise<void> {
  const index = await getSessionsIndex(env, groupId);
  const filtered = index.filter(id => id !== sessionId);
  await env.KV.put(keys.sessionsIndex(groupId), JSON.stringify(filtered));
}

/**
 * Get all active sessions for a group
 * Returns array of SessionData
 */
export async function getActiveSessions(env: Env, groupId: string): Promise<SessionData[]> {
  const index = await getSessionsIndex(env, groupId);
  const sessions: SessionData[] = [];

  // For each session_id in index, we need to find the corresponding topic_id
  // This is a bit tricky - we'll need to list all keys with the pattern
  // For now, we'll just return the sessions we can find
  // A better approach would be to store the topic_id in the sessions index

  // Note: KV doesn't have a native list operation in Workers
  // We need to maintain a mapping of session_id to topic_id
  // This will be handled by storing topic_id in the session data itself

  return sessions;
}

/**
 * Get last activity ID for a session
 */
export async function getLastActivityId(env: Env, groupId: string, topicId: number): Promise<string | null> {
  return await env.KV.get(keys.lastActivityId(groupId, topicId));
}

/**
 * Set last activity ID for a session
 */
export async function setLastActivityId(env: Env, groupId: string, topicId: number, activityId: string): Promise<void> {
  await env.KV.put(keys.lastActivityId(groupId, topicId), activityId);
}

/**
 * Check if session has pending plan
 */
export async function hasPendingPlan(env: Env, groupId: string, topicId: number): Promise<boolean> {
  const value = await env.KV.get(keys.pendingPlan(groupId, topicId));
  return value === 'true';
}

/**
 * Set pending plan flag
 */
export async function setPendingPlan(env: Env, groupId: string, topicId: number, pending: boolean): Promise<void> {
  await env.KV.put(keys.pendingPlan(groupId, topicId), pending ? 'true' : 'false');
}

/**
 * Check if session is ready for review
 */
export async function isReadyForReview(env: Env, groupId: string, topicId: number): Promise<boolean> {
  const value = await env.KV.get(keys.readyForReview(groupId, topicId));
  return value === 'true';
}

/**
 * Set ready for review flag
 */
export async function setReadyForReview(env: Env, groupId: string, topicId: number, ready: boolean): Promise<void> {
  await env.KV.put(keys.readyForReview(groupId, topicId), ready ? 'true' : 'false');
}

/**
 * Get group configuration
 */
export async function getGroupConfig(env: Env, groupId: string): Promise<GroupConfig | null> {
  const token = await getJulesToken(env, groupId);
  if (!token) return null;

  const source = await getSource(env, groupId);
  const defaultBranch = await getDefaultBranch(env, groupId);
  const automationMode = await getAutomationMode(env, groupId);
  const requireApproval = await getRequireApproval(env, groupId);
  const sessionsIndex = await getSessionsIndex(env, groupId);

  return {
    jules_token: token,
    source: source || undefined,
    default_branch: defaultBranch || undefined,
    automation_mode: automationMode || undefined,
    require_approval: requireApproval,
    sessions_index: sessionsIndex,
  };
}

/**
 * Log storage operation (for debugging and security)
 * Logs any attempt to access KV with group context
 */
export function logStorageAccess(groupId: string, operation: string, key: string): void {
  console.log(`[KV Access] Group: ${groupId}, Operation: ${operation}, Key: ${key}`);
}

/**
 * Cache for sources list to avoid API rate limits
 */
export async function getSourcesCache(env: Env, token: string): Promise<any[] | null> {
  const key = `cache:sources:${hashToken(token)}`;
  const cached = await env.KV.get(key);
  if (!cached) return null;
  return JSON.parse(cached);
}

export async function setSourcesCache(env: Env, token: string, sources: any[]): Promise<void> {
  const key = `cache:sources:${hashToken(token)}`;
  // Cache for 1 hour
  await env.KV.put(key, JSON.stringify(sources), { expirationTtl: 3600 });
}

export async function clearSourcesCache(env: Env, token: string): Promise<void> {
  const key = `cache:sources:${hashToken(token)}`;
  await env.KV.delete(key);
}

// Simple hash function for token (for cache key)
function hashToken(token: string): string {
  let hash = 0;
  for (let i = 0; i < token.length; i++) {
    const char = token.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash).toString(36);
}
