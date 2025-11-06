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
   */
  async listSources(): Promise<JulesSource[]> {
    const response = await retryWithBackoff(() =>
      this.request<{ sources: JulesSource[] }>('/sources')
    );

    return response.sources || [];
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
    automationMode?: 'INTERACTIVE' | 'PLAN' | 'AUTO';
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

    // Only send automation_mode if explicitly specified
    // Default might be handled by the API
    if (params.automationMode) {
      if (params.automationMode === 'INTERACTIVE') {
        body.automation_mode = 1;
      } else if (params.automationMode === 'PLAN') {
        body.automation_mode = 2;
      } else if (params.automationMode === 'AUTO') {
        body.automation_mode = 3;
      }
    }

    // Only send optional fields if provided
    if (params.requirePlanApproval !== undefined && params.requirePlanApproval !== null) {
      body.require_plan_approval = params.requirePlanApproval;
    }

    if (params.startingBranch && params.startingBranch.trim() !== '') {
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
    await retryWithBackoff<void>(() =>
      this.request<void>(`/sessions/${sessionId}:sendMessage`, {
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
    await retryWithBackoff<void>(() =>
      this.request<void>(`/sessions/${sessionId}:approvePlan`, {
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
