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
 * Takes longer but gets complete list (up to 1000 sources = 10 pages)
 * @param env - Cloudflare Worker environment
 * @param token - Jules API token
 * @param maxPages - Maximum number of pages to fetch (default: 10 = 1000 sources)
 */
export async function refreshSourcesForToken(env: Env, token: string, maxPages: number = 10): Promise<{ count: number; hasMore: boolean }> {
  console.log(`[refreshSourcesCache] Starting sources fetch (max ${maxPages} pages)...`);
  const startTime = Date.now();

  try {
    const julesClient = createJulesClient(token);
    const allSources: any[] = [];
    let nextPageToken: string | undefined;
    let pageNum = 0;
    const pageSize = 100;

    // Fetch all pages
    do {
      pageNum++;
      let url = `/sources?pageSize=${pageSize}`;
      if (nextPageToken) {
        url += `&pageToken=${encodeURIComponent(nextPageToken)}`;
      }

      console.log(`[refreshSourcesCache] Fetching page ${pageNum}...`);

      // Direct API call without timeout since we have more time in cron/manual refresh
      const response = await fetch(`https://jules.googleapis.com/v1alpha${url}`, {
        headers: {
          'X-Goog-Api-Key': token,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        console.error(`[refreshSourcesCache] API error: ${response.status}`);
        break;
      }

      const data: any = await response.json();

      if (data.sources && data.sources.length > 0) {
        const mapped = data.sources.map((s: any) => ({
          name: s.name,
          displayName: s.displayName,
          description: s.description,
        }));
        allSources.push(...mapped);

        console.log(`[refreshSourcesCache] Page ${pageNum}: +${data.sources.length} sources (total: ${allSources.length})`);
      }

      nextPageToken = data.nextPageToken;

      // Safety limit to avoid excessive API calls
      if (pageNum >= maxPages) {
        console.log(`[refreshSourcesCache] Reached page limit (${maxPages})`);
        break;
      }
    } while (nextPageToken);

    // Update cache (1 hour TTL)
    if (allSources.length > 0) {
      await setSourcesCache(env, token, allSources);
    }

    const duration = Date.now() - startTime;
    const hasMore = !!nextPageToken;
    console.log(`[refreshSourcesCache] Complete: ${allSources.length} sources in ${duration}ms (${pageNum} pages, hasMore: ${hasMore})`);

    return { count: allSources.length, hasMore };
  } catch (error) {
    console.error('[refreshSourcesCache] Error fetching sources:', error);
    return { count: 0, hasMore: false };
  }
}

/**
 * Main cron handler
 * Refreshes sources cache for all active tokens (tokens used in last 2 hours)
 */
export async function refreshSourcesCache(env: Env): Promise<void> {
  console.log('[refreshSourcesCache] Starting sources cache refresh cron...');
  const startTime = Date.now();

  try {
    // Get all active tokens from registry
    const { getActiveTokens } = await import('../kv/storage');
    const tokens = await getActiveTokens(env);

    if (tokens.length === 0) {
      console.log('[refreshSourcesCache] No active tokens to refresh');
      return;
    }

    console.log(`[refreshSourcesCache] Found ${tokens.length} active tokens to refresh`);

    // Refresh each token's sources cache
    let successCount = 0;
    let errorCount = 0;

    for (const token of tokens) {
      try {
        const result = await refreshSourcesForToken(env, token);
        if (result.count > 0) {
          successCount++;
          console.log(`[refreshSourcesCache] ✓ Refreshed token: ${result.count} sources`);
        } else {
          errorCount++;
          console.log(`[refreshSourcesCache] ✗ Failed to refresh token`);
        }
      } catch (error) {
        errorCount++;
        console.error(`[refreshSourcesCache] ✗ Error refreshing token:`, error);
      }
    }

    const duration = Date.now() - startTime;
    console.log(`[refreshSourcesCache] Complete: ${successCount} success, ${errorCount} errors in ${duration}ms`);
  } catch (error) {
    console.error('[refreshSourcesCache] Error in cache refresh cron:', error);
  }
}
