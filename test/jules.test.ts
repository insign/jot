/**
 * Tests for Jules API integration
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { JulesAPI, createJulesClient, isAuthError } from '../src/jules/api';
import { retryWithBackoff } from '../src/utils/retry';

// Mock fetch globally
const mockFetch = vi.fn();
globalThis.fetch = mockFetch;

describe('JulesAPI', () => {
  let client: JulesAPI;
  const mockApiKey = 'AIzaSyC1234567890abcdef';

  beforeEach(() => {
    client = createJulesClient(mockApiKey);
    mockFetch.mockClear();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('authentication', () => {
    it('should use X-Goog-Api-Key header for authentication', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ sources: [] }),
        text: async () => '',
      } as Response);

      await client.listSources();

      expect(mockFetch).toHaveBeenCalledWith(
        'https://jules.googleapis.com/v1alpha/sources',
        expect.objectContaining({
          headers: {
            'X-Goog-Api-Key': mockApiKey,
            'Content-Type': 'application/json',
          },
        })
      );
    });

    it('should validate token successfully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ sessions: [] }),
        text: async () => '',
      } as Response);

      const isValid = await client.validateToken();
      expect(isValid).toBe(true);
    });

    it('should return false for invalid token', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => ({
          error: {
            code: 401,
            message: 'Invalid authentication credentials',
          },
        }),
        text: async () => 'Invalid credentials',
      } as Response);

      const isValid = await client.validateToken();
      expect(isValid).toBe(false);
    });
  });

  describe('listSources', () => {
    it('should fetch and return sources', async () => {
      const mockSources = [
        {
          name: 'sources/github/user/repo',
          displayName: 'user/repo',
          description: 'My repository',
          githubRepo: {
            owner: 'user',
            repo: 'repo',
            defaultBranch: { displayName: 'main' },
            branches: [{ displayName: 'main' }],
          },
        },
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ sources: mockSources }),
        text: async () => '',
      } as Response);

      const sources = await client.listSources();
      expect(sources).toEqual(mockSources);
    });

    it('should handle empty sources list', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ sources: [] }),
        text: async () => '',
      } as Response);

      const sources = await client.listSources();
      expect(sources).toEqual([]);
    });
  });

  describe('listSessions', () => {
    it('should fetch and return sessions', async () => {
      const mockSessions = [
        {
          name: 'sessions/123456',
          title: 'Test session',
          createTime: '2025-01-01T00:00:00Z',
          updateTime: '2025-01-01T00:00:00Z',
          source: 'sources/github/user/repo',
          prompt: 'Test prompt',
        },
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ sessions: mockSessions }),
        text: async () => '',
      } as Response);

      const sessions = await client.listSessions();
      expect(sessions).toEqual(mockSessions);
    });
  });

  describe('createSession', () => {
    it('should create a session with required parameters', async () => {
      const mockSession = {
        name: 'sessions/new123',
        title: 'New session',
        createTime: '2025-01-01T00:00:00Z',
        updateTime: '2025-01-01T00:00:00Z',
        source: 'sources/github/user/repo',
        prompt: 'New prompt',
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockSession,
        text: async () => '',
      } as Response);

      const session = await client.createSession({
        prompt: 'New prompt',
        source: 'sources/github/user/repo',
      });

      expect(session).toEqual(mockSession);

      // Verify request was made with correct parameters
      const callArgs = mockFetch.mock.calls[0];
      const requestBody = JSON.parse(callArgs[1].body);
      expect(requestBody.prompt).toBe('New prompt');
      expect(requestBody.source).toBe('sources/github/user/repo');
    });

    it('should include optional parameters when provided', async () => {
      const mockSession = {
        name: 'sessions/new123',
        title: 'New session',
        createTime: '2025-01-01T00:00:00Z',
        updateTime: '2025-01-01T00:00:00Z',
        source: 'sources/github/user/repo',
        prompt: 'New prompt',
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockSession,
        text: async () => '',
      } as Response);

      await client.createSession({
        prompt: 'New prompt',
        source: 'sources/github/user/repo',
        automationMode: 'AUTO_PR',
        requirePlanApproval: true,
        startingBranch: 'develop',
      });

      const callArgs = mockFetch.mock.calls[0];
      const requestBody = JSON.parse(callArgs[1].body);
      expect(requestBody.automationMode).toBe('AUTO_PR');
      expect(requestBody.requirePlanApproval).toBe(true);
      expect(requestBody.startingBranch).toBe('develop');
    });
  });

  describe('error handling', () => {
    it('should throw error for non-OK response', async () => {
      // Mock to always return error response (no retry success)
      mockFetch.mockResolvedValue({
        ok: false,
        status: 401,
        json: async () => ({
          error: {
            code: 401,
            message: 'Invalid authentication credentials',
          },
        }),
        text: async () => '{"error": {"message": "Invalid credentials"}}',
      } as Response);

      await expect(client.listSources()).rejects.toThrow(
        'Jules API error (401)'
      );
    });

    it('should include error details in thrown error', async () => {
      // Mock to always return error response (no retry success)
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        json: async () => ({
          error: {
            code: 500,
            message: 'Internal server error',
          },
        }),
        text: async () => '{"error": {"message": "Internal server error"}}',
      } as Response);

      try {
        await client.listSources();
        fail('Should have thrown an error');
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toContain('500');
        expect((error as Error).message).toContain('Internal server error');
      }
    });
  });

  describe('isAuthError', () => {
    it('should identify 401 errors as auth errors', () => {
      const error = new Error('Jules API error (401): Unauthorized');
      expect(isAuthError(error)).toBe(true);
    });

    it('should identify 403 errors as auth errors', () => {
      const error = new Error('Jules API error (403): Forbidden');
      expect(isAuthError(error)).toBe(true);
    });

    it('should not identify other errors as auth errors', () => {
      const error = new Error('Jules API error (404): Not found');
      expect(isAuthError(error)).toBe(false);
    });
  });

  describe('retryWithBackoff', () => {
    it('should retry on failure and succeed', async () => {
      let callCount = 0;
      const mockFn = vi.fn().mockImplementation(() => {
        callCount++;
        if (callCount < 3) {
          throw new Error('Temporary error');
        }
        return Promise.resolve('Success');
      });

      const result = await retryWithBackoff(mockFn, {
        maxAttempts: 3,
        initialDelayMs: 10,
      });

      expect(result).toBe('Success');
      expect(callCount).toBe(3);
    });

    it('should fail after max attempts', async () => {
      const mockFn = vi.fn().mockRejectedValue(new Error('Permanent error'));

      await expect(
        retryWithBackoff(mockFn, {
          maxAttempts: 2,
          initialDelayMs: 10,
        })
      ).rejects.toThrow('Permanent error');

      expect(mockFn).toHaveBeenCalledTimes(2);
    });
  });
});
