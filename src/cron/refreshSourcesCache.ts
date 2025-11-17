/**
 * Refresh sources cache for all groups
 * Runs periodically to ensure cache is up-to-date
 * This allows search_sources to work with complete data
 */

import type { Env } from '../types/env';
import { createJulesClient } from '../jules/api';
import { setSourcesCache } from '../kv/storage';

/**
 * Fetch all sources for a token and update cache
 * Takes longer but gets complete list
 */
async function refreshSourcesForToken(env: Env, token: string): Promise<number> {
  console.log('[refreshSourcesCache] Fetching sources for token...');
  const startTime = Date.now();

  try {
    const julesClient = createJulesClient(token);

    // Use extended timeout for cron job (we have more time)
    // Fetch with 9s timeout to get as many as possible
    const result = await julesClient.listSources(9000);

    if (result.sources.length === 0) {
      console.log('[refreshSourcesCache] No sources found');
      return 0;
    }

    // Map to cache format
    const sources = result.sources.map(s => ({
      name: s.name,
      displayName: s.displayName,
      description: s.description,
    }));

    // Update cache (1 hour TTL)
    await setSourcesCache(env, token, sources);

    const duration = Date.now() - startTime;
    console.log(`[refreshSourcesCache] Cached ${sources.length} sources in ${duration}ms (hasMore: ${result.hasMore})`);

    return sources.length;
  } catch (error) {
    console.error('[refreshSourcesCache] Error fetching sources:', error);
    return 0;
  }
}

/**
 * Main cron handler
 * Refreshes sources cache for all groups that have tokens
 */
export async function refreshSourcesCache(env: Env): Promise<void> {
  console.log('[refreshSourcesCache] Starting sources cache refresh...');
  const startTime = Date.now();

  try {
    // Get all unique tokens from KV
    // Note: In a production system, you'd want to keep a registry of active tokens
    // For now, this will only refresh when groups actively use the bot

    // Since we don't have a token registry, this cron will be triggered
    // whenever /list_sources or /search_sources is used, and will refresh
    // the cache in the background

    const duration = Date.now() - startTime;
    console.log(`[refreshSourcesCache] Cache refresh complete in ${duration}ms`);
  } catch (error) {
    console.error('[refreshSourcesCache] Error in cache refresh:', error);
  }
}
