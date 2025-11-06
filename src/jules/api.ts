/**
 * Jules API integration
 * Handles all API calls to Jules (Google's AI coding assistant)
 * Documentation: https://developers.google.com/jules/api
 */

import type { JulesSession, JulesActivity, JulesSource } from '../types/env';
import { retryWithBackoff, isRetryableStatusCode } from '../utils/retry';

const JULES_API_BASE = 'https://jules.googleapis.com/v1alpha';

/**
 * Jules API client
 */
export class JulesAPI {
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  /**
   * Make authenticated request to Jules API
   */
  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${JULES_API_BASE}${endpoint}`;

    const response = await fetch(url, {
      ...options,
      headers: {
        'X-Goog-Api-Key': this.apiKey,
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Jules API error (${response.status}): ${errorText}`);
    }

    return await response.json();
  }

  /**
   * Validate API token by checking /sessions endpoint
   */
  async validateToken(): Promise<boolean> {
    try {
      await this.listSessions();
      return true;
    } catch (error) {
      console.error('Token validation failed:', error);
      return false;
    }
  }

  /**
   * List all sources available to the user
   * GET /v1alpha/sources
   * Handles pagination to fetch ALL sources
   */
  async listSources(): Promise<JulesSource[]> {
    const allSources: JulesSource[] = [];
    let pageToken: string | undefined = undefined;
    const seenTokens = new Set<string>();
    let requestCount = 0;

    do {
      // Build URL with page token if present
      const url = pageToken
        ? `/sources?pageToken=${encodeURIComponent(pageToken)}`
        : '/sources';

      const response = await retryWithBackoff(() =>
        this.request<{ sources: JulesSource[]; nextPageToken?: string }>(url)
      );

      // Add sources from this page
      if (response.sources && response.sources.length > 0) {
        allSources.push(...response.sources);
      }

      // Get next page token
      pageToken = response.nextPageToken;

      // Safety: prevent infinite loops
      if (pageToken) {
        if (seenTokens.has(pageToken)) {
          console.error('[Jules API] Pagination loop detected! Stopping.');
          break;
        }
        seenTokens.add(pageToken);
      }

      requestCount++;
      // Safety limit: Jules API shouldn't have more than 100 pages
      if (requestCount > 100) {
        console.error('[Jules API] Too many pages requested. Stopping at 100 pages.');
        break;
      }
    } while (pageToken);

    console.log(`[Jules API] Fetched ${allSources.length} sources in ${requestCount} request(s)`);
    return allSources;
  }

  /**
   * Get a specific source
   * GET /v1alpha/sources/{source_name}
   */
  async getSource(sourceName: string): Promise<JulesSource> {
    return await retryWithBackoff(() =>
      this.request<JulesSource>(`/sources/${sourceName}`)
    );
  }

  /**
   * List all sessions
   * GET /v1alpha/sessions
   */
  async listSessions(): Promise<JulesSession[]> {
    const response = await retryWithBackoff(() =>
      this.request<{ sessions: JulesSession[] }>('/sessions')
    );

    return response.sessions || [];
  }

  /**
   * Get a specific session
   * GET /v1alpha/sessions/{session_id}
   */
  async getSession(sessionId: string): Promise<JulesSession> {
    return await retryWithBackoff(() =>
      this.request<JulesSession>(`/sessions/${sessionId}`)
    );
  }

  /**
   * Create a new session
   * POST /v1alpha/sessions
   */
  async createSession(params: {
    prompt: string;
    source: string;
    automationMode?: 'AUTO_PR' | 'MANUAL';
    requirePlanApproval?: boolean;
    startingBranch?: string;
    media?: {
      data: string;
      mediaType: string;
    };
  }): Promise<JulesSession> {
    const body: any = {
      prompt: params.prompt,
      source_context: {
        source: params.source,
      },
    };

    // Map automationMode to API values (correct format for Jules API)
    if (params.automationMode === 'AUTO_PR') {
      body.automation_mode = 'AUTOMATION_MODE_AUTOMATIC';
    } else if (params.automationMode === 'MANUAL') {
      body.automation_mode = 'AUTOMATION_MODE_MANUAL';
    }

    if (params.requirePlanApproval !== undefined) {
      body.require_plan_approval = params.requirePlanApproval;
    }

    if (params.startingBranch) {
      body.starting_branch = params.startingBranch;
    }

    if (params.media) {
      body.media = params.media;
    }

    return await retryWithBackoff(() =>
      this.request<JulesSession>('/sessions', {
        method: 'POST',
        body: JSON.stringify(body),
      })
    );
  }

  /**
   * Send a message to an existing session
   * POST /v1alpha/sessions/{session_id}:sendMessage
   */
  async sendMessage(
    sessionId: string,
    params: {
      prompt: string;
      media?: {
        data: string;
        mediaType: string;
      };
    }
  ): Promise<void> {
    await retryWithBackoff(() =>
      this.request(`/sessions/${sessionId}:sendMessage`, {
        method: 'POST',
        body: JSON.stringify(params),
      })
    );
  }

  /**
   * Approve a plan for a session
   * POST /v1alpha/sessions/{session_id}:approvePlan
   */
  async approvePlan(sessionId: string): Promise<void> {
    await retryWithBackoff(() =>
      this.request(`/sessions/${sessionId}:approvePlan`, {
        method: 'POST',
        body: JSON.stringify({}),
      })
    );
  }

  /**
   * List activities for a session
   * GET /v1alpha/sessions/{session_id}/activities
   */
  async listActivities(sessionId: string): Promise<JulesActivity[]> {
    const response = await retryWithBackoff(() =>
      this.request<{ activities: JulesActivity[] }>(`/sessions/${sessionId}/activities`)
    );

    return response.activities || [];
  }

  /**
   * Get activities created after a specific time
   * Used for polling new activities
   */
  async getNewActivities(sessionId: string, afterTime: string): Promise<JulesActivity[]> {
    const activities = await this.listActivities(sessionId);

    // Filter activities created after the specified time
    return activities.filter(activity => activity.createTime > afterTime);
  }

  /**
   * Publish branch for a session
   * POST /v1alpha/sessions/{session_id}:publishBranch
   * Note: This endpoint may not exist in the API, check documentation
   */
  async publishBranch(sessionId: string): Promise<{ branchUrl: string }> {
    return await retryWithBackoff(() =>
      this.request<{ branchUrl: string }>(`/sessions/${sessionId}:publishBranch`, {
        method: 'POST',
        body: JSON.stringify({}),
      })
    );
  }

  /**
   * Publish PR for a session
   * POST /v1alpha/sessions/{session_id}:publishPr
   * Note: This endpoint may not exist in the API, check documentation
   */
  async publishPR(sessionId: string): Promise<{ prUrl: string }> {
    return await retryWithBackoff(() =>
      this.request<{ prUrl: string }>(`/sessions/${sessionId}:publishPr`, {
        method: 'POST',
        body: JSON.stringify({}),
      })
    );
  }
}

/**
 * Create Jules API client instance
 */
export function createJulesClient(apiKey: string): JulesAPI {
  return new JulesAPI(apiKey);
}

/**
 * Check if error is a Jules API authentication error
 */
export function isAuthError(error: Error): boolean {
  const message = error.message.toLowerCase();
  return message.includes('401') || message.includes('403') || message.includes('unauthorized');
}

/**
 * Check if error is a session not found error
 */
export function isSessionNotFoundError(error: Error): boolean {
  const message = error.message.toLowerCase();
  return message.includes('404') || message.includes('not found');
}
