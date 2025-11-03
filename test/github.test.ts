/**
 * Tests for GitHub utilities
 */

import { describe, it, expect } from 'vitest';
import {
  extractGitHubLinks,
  parseSourceToGitHubUrl,
  parseSourceToRepoInfo,
  formatRepoInfo,
} from '../src/utils/github';

describe('github utilities', () => {
  describe('extractGitHubLinks', () => {
    it('should extract PR links', () => {
      const outputs = 'Check out https://github.com/user/repo/pull/123 for details';
      const links = extractGitHubLinks(outputs);

      expect(links.pullRequests).toHaveLength(1);
      expect(links.pullRequests[0].number).toBe(123);
      expect(links.pullRequests[0].url).toBe('https://github.com/user/repo/pull/123');
    });

    it('should extract branch links', () => {
      const outputs = 'Branch: https://github.com/user/repo/tree/feature-branch';
      const links = extractGitHubLinks(outputs);

      expect(links.branches).toHaveLength(1);
      expect(links.branches[0].name).toBe('feature-branch');
    });

    it('should extract commit links', () => {
      const outputs = 'Commit: https://github.com/user/repo/commit/abc1234567890def';
      const links = extractGitHubLinks(outputs);

      expect(links.commits).toHaveLength(1);
      expect(links.commits[0].sha).toBe('abc1234567890def');
    });

    it('should extract multiple links', () => {
      const outputs = `
        PR: https://github.com/user/repo/pull/123
        Branch: https://github.com/user/repo/tree/feature
        Commit: https://github.com/user/repo/commit/abc1234567
      `;
      const links = extractGitHubLinks(outputs);

      expect(links.pullRequests).toHaveLength(1);
      expect(links.branches).toHaveLength(1);
      expect(links.commits).toHaveLength(1);
    });

    it('should return empty arrays for no links', () => {
      const links = extractGitHubLinks('No links here');

      expect(links.pullRequests).toHaveLength(0);
      expect(links.branches).toHaveLength(0);
      expect(links.commits).toHaveLength(0);
    });
  });

  describe('parseSourceToGitHubUrl', () => {
    it('should parse valid source to Jules URL', () => {
      const source = 'sources/github/username/repository';
      const url = parseSourceToGitHubUrl(source);

      expect(url).toBe('https://jules.google/github/username/repository');
    });

    it('should return null for invalid format', () => {
      expect(parseSourceToGitHubUrl('invalid')).toBeNull();
      expect(parseSourceToGitHubUrl('sources/gitlab/user/repo')).toBeNull();
      expect(parseSourceToGitHubUrl('sources/github/user')).toBeNull();
    });
  });

  describe('parseSourceToRepoInfo', () => {
    it('should parse valid source to repo info', () => {
      const source = 'sources/github/octocat/hello-world';
      const info = parseSourceToRepoInfo(source);

      expect(info).toEqual({
        owner: 'octocat',
        repo: 'hello-world',
      });
    });

    it('should return null for invalid format', () => {
      expect(parseSourceToRepoInfo('invalid')).toBeNull();
    });
  });

  describe('formatRepoInfo', () => {
    it('should format repo info as owner/repo', () => {
      const formatted = formatRepoInfo('octocat', 'hello-world');
      expect(formatted).toBe('octocat/hello-world');
    });
  });
});
