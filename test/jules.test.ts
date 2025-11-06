/**
 * Tests for Jules API integration
 * Tests all edge cases and bugs discovered during development
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createJulesClient, isAuthError, isSessionNotFoundError } from '../src/jules/api';

// Mock fetch
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

describe('Jules API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Authentication', () => {
    it('should use X-Goog-Api-Key header (NOT Bearer)', async () => {
      // Setup mock for this test only
      mockFetch.mockReturnValue(
        Promise.resolve({
          ok: true,
          json: async () => ({ sessions: [] }),
        })
      );

      const client = createJulesClient('test-api-key');
      await client.listSessions();

      // Verify X-Goog-Api-Key is used
      const call = mockFetch.mock.calls[0];
      const headers = call[1].headers;
      expect(headers['X-Goog-Api-Key']).toBe('test-api-key');
      expect(headers['Authorization']).toBeUndefined(); // Should NOT have Bearer
      expect(headers['Content-Type']).toBe('application/json');
    });

    it('should detect auth errors (401, 403, unauthorized)', () => {
      const errors = [
        new Error('API error (401): Unauthorized'),
        new Error('API error (403): Forbidden'),
        new Error('unauthorized access'),
      ];

      errors.forEach(error => {
        expect(isAuthError(error)).toBe(true);
      });
    });

    it('should validate token successfully', async () => {
      mockFetch.mockReturnValue(
        Promise.resolve({
          ok: true,
          json: async () => ({ sessions: [] }),
        })
      );

      const client = createJulesClient('valid-token');
      const result = await client.validateToken();

      expect(result).toBe(true);
    });

    it('should handle invalid token', async () => {
      mockFetch.mockReturnValue(
        Promise.resolve({
          ok: false,
          status: 401,
          text: async () => 'Unauthorized',
        })
      );

      const client = createJulesClient('invalid-token');
      const result = await client.validateToken();

      expect(result).toBe(false);
    });
  });

  describe('listSources', () => {
    it('should fetch sources list', async () => {
      mockFetch.mockReturnValue(
        Promise.resolve({
          ok: true,
          json: async () => ({
            sources: [{ name: 'source1' }, { name: 'source2' }],
          }),
        })
      );

      const client = createJulesClient('test-key');
      const sources = await client.listSources();

      expect(sources).toHaveLength(2);
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('should handle empty sources list', async () => {
      mockFetch.mockReturnValue(
        Promise.resolve({
          ok: true,
          json: async () => ({ sources: [] }),
        })
      );

      const client = createJulesClient('test-key');
      const sources = await client.listSources();

      expect(sources).toEqual([]);
    });
  });

  describe('createSession - API Schema', () => {
    it('should use source_context.source format', async () => {
      mockFetch.mockReturnValue(
        Promise.resolve({
          ok: true,
          json: async () => ({ name: 'session-123', state: 'active' }),
        })
      );

      const client = createJulesClient('test-key');
      await client.createSession({
        prompt: 'Fix the bug',
        source: 'sources/github/user/repo',
      });

      const callArgs = mockFetch.mock.calls[0];
      const body = JSON.parse(callArgs[1].body as string);

      expect(body).toHaveProperty('source_context');
      expect(body.source_context).toHaveProperty('source', 'sources/github/user/repo');
      expect(body).not.toHaveProperty('source'); // Old format should not exist
    });

    it('should handle automationMode correctly (INTERACTIVE, PLAN, AUTO)', async () => {
      mockFetch.mockReturnValue(
        Promise.resolve({
          ok: true,
          json: async () => ({ name: 'session-123' }),
        })
      );

      const client = createJulesClient('test-key');

      // Test INTERACTIVE
      await client.createSession({
        prompt: 'Fix bug',
        source: 'sources/github/user/repo',
        automationMode: 'INTERACTIVE',
      });

      let body = JSON.parse(mockFetch.mock.calls[0][1].body as string);
      expect(body.automation_mode).toBe(1); // Interactive mode

      // Test PLAN
      await client.createSession({
        prompt: 'Fix bug',
        source: 'sources/github/user/repo',
        automationMode: 'PLAN',
      });

      body = JSON.parse(mockFetch.mock.calls[1][1].body as string);
      expect(body.automation_mode).toBe(2); // Plan mode only

      // Test AUTO
      await client.createSession({
        prompt: 'Fix bug',
        source: 'sources/github/user/repo',
        automationMode: 'AUTO',
      });

      body = JSON.parse(mockFetch.mock.calls[2][1].body as string);
      expect(body.automation_mode).toBe(3); // Autonomous mode
    });

    it('should handle optional parameters', async () => {
      mockFetch.mockReturnValue(
        Promise.resolve({
          ok: true,
          json: async () => ({ name: 'session-123' }),
        })
      );

      const client = createJulesClient('test-key');
      await client.createSession({
        prompt: 'Fix bug',
        source: 'sources/github/user/repo',
        requirePlanApproval: true,
        startingBranch: 'main',
        media: {
          data: 'base64data',
          mediaType: 'image/png',
        },
      });

      const body = JSON.parse(mockFetch.mock.calls[0][1].body as string);
      expect(body.require_plan_approval).toBe(true);
      expect(body.starting_branch).toBe('main');
      expect(body.media).toEqual({
        data: 'base64data',
        mediaType: 'image/png',
      });
    });
  });

  describe('getSession', () => {
    it('should detect session not found errors (404)', () => {
      const error = new Error('API error (404): Session not found');
      expect(isSessionNotFoundError(error)).toBe(true);
    });

    it('should fetch session details', async () => {
      const mockSession = {
        name: 'session-123',
        state: 'active',
        source: 'sources/github/user/repo',
      };

      mockFetch.mockReturnValue(
        Promise.resolve({
          ok: true,
          json: async () => mockSession,
        })
      );

      const client = createJulesClient('test-key');
      const session = await client.getSession('session-123');

      expect(session.name).toBe('session-123');
      expect(session.state).toBe('active');
    });
  });

  describe('listActivities', () => {
    it('should fetch activities for a session', async () => {
      const mockActivities = [
        {
          name: 'activity-1',
          title: 'Fixed bug',
          createTime: '2024-01-01T10:00:00Z',
        },
        {
          name: 'activity-2',
          title: 'Added tests',
          createTime: '2024-01-01T11:00:00Z',
        },
      ];

      mockFetch.mockReturnValue(
        Promise.resolve({
          ok: true,
          json: async () => ({ activities: mockActivities }),
        })
      );

      const client = createJulesClient('test-key');
      const activities = await client.listActivities('session-123');

      expect(activities).toHaveLength(2);
      expect(activities[0].title).toBe('Fixed bug');
    });

    it('should handle empty activities', async () => {
      mockFetch.mockReturnValue(
        Promise.resolve({
          ok: true,
          json: async () => ({ activities: [] }),
        })
      );

      const client = createJulesClient('test-key');
      const activities = await client.listActivities('session-123');

      expect(activities).toEqual([]);
    });
  });

  describe('Error Handling', () => {
    it('should throw meaningful error messages', async () => {
      mockFetch.mockReturnValue(
        Promise.resolve({
          ok: false,
          status: 500,
          text: async () => 'Internal Server Error',
        })
      );

      const client = createJulesClient('test-key');

      await expect(client.listSessions()).rejects.toThrow(
        'Jules API error (500): Internal Server Error'
      );
    });

    it('should handle network errors', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      const client = createJulesClient('test-key');

      await expect(client.listSessions()).rejects.toThrow('Network error');
    });
  });

  describe('approvePlan', () => {
    it('should approve a plan', async () => {
      mockFetch.mockReturnValue(
        Promise.resolve({
          ok: true,
          json: async () => ({}),
        })
      );

      const client = createJulesClient('test-key');
      await client.approvePlan('session-123');

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/sessions/session-123:approvePlan'),
        expect.objectContaining({
          method: 'POST',
          body: '{}',
        })
      );
    });
  });

  describe('sendMessage', () => {
    it('should send message to session', async () => {
      mockFetch.mockReturnValue(
        Promise.resolve({
          ok: true,
          json: async () => ({}),
        })
      );

      const client = createJulesClient('test-key');
      await client.sendMessage('session-123', {
        prompt: 'Continue the work',
        media: {
          data: 'base64image',
          mediaType: 'image/png',
        },
      });

      const body = JSON.parse(mockFetch.mock.calls[0][1].body as string);
      expect(body.prompt).toBe('Continue the work');
      expect(body.media).toEqual({
        data: 'base64image',
        mediaType: 'image/png',
      });
    });
  });

  describe('publishBranch & publishPR', () => {
    it('should attempt to publish branch', async () => {
      mockFetch.mockRejectedValue(new Error('Method not found'));

      const client = createJulesClient('test-key');

      await expect(client.publishBranch('session-123')).rejects.toThrow('Method not found');
    });

    it('should attempt to publish PR', async () => {
      mockFetch.mockRejectedValue(new Error('Method not found'));

      const client = createJulesClient('test-key');

      await expect(client.publishPR('session-123')).rejects.toThrow('Method not found');
    });
  });

  describe('Rate Limiting Detection', () => {
    it('should handle API_KEY_SERVICE_BLOCKED error', async () => {
      mockFetch.mockReturnValue(
        Promise.resolve({
          ok: false,
          status: 400,
          text: async () => 'API_KEY_SERVICE_BLOCKED',
        })
      );

      const client = createJulesClient('test-key');

      await expect(client.listSources()).rejects.toThrow(
        'Jules API error (400): API_KEY_SERVICE_BLOCKED'
      );
    });
  });
});
