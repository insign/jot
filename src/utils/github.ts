/**
 * GitHub utilities for extracting and formatting links
 */

/**
 * GitHub link types
 */
export interface GitHubLinks {
  pullRequests: Array<{ number: number; url: string }>;
  branches: Array<{ name: string; url: string }>;
  commits: Array<{ sha: string; url: string }>;
}

/**
 * Extract GitHub links from session outputs
 * Parses outputs for PR, branch, and commit URLs
 */
export function extractGitHubLinks(outputs?: string): GitHubLinks {
  const links: GitHubLinks = {
    pullRequests: [],
    branches: [],
    commits: [],
  };

  if (!outputs) return links;

  // Regular expressions for GitHub URLs
  const prRegex = /https:\/\/github\.com\/([^/]+)\/([^/]+)\/pull\/(\d+)/g;
  const branchRegex = /https:\/\/github\.com\/([^/]+)\/([^/]+)\/tree\/([^/\s]+)/g;
  const commitRegex = /https:\/\/github\.com\/([^/]+)\/([^/]+)\/commit\/([a-f0-9]{7,40})/g;

  // Extract PR links
  let match;
  while ((match = prRegex.exec(outputs)) !== null) {
    links.pullRequests.push({
      number: parseInt(match[3]),
      url: match[0],
    });
  }

  // Extract branch links
  while ((match = branchRegex.exec(outputs)) !== null) {
    links.branches.push({
      name: match[3],
      url: match[0],
    });
  }

  // Extract commit links
  while ((match = commitRegex.exec(outputs)) !== null) {
    links.commits.push({
      sha: match[3],
      url: match[0],
    });
  }

  return links;
}

/**
 * Format GitHub links as Telegram HTML message
 * Uses emojis and clickable links
 */
export function formatGitHubLinks(links: GitHubLinks): string {
  let message = '';

  if (links.pullRequests.length > 0) {
    message += '<b>🔀 Pull Requests:</b>\n';
    for (const pr of links.pullRequests) {
      message += `• <a href="${pr.url}">PR #${pr.number}</a>\n`;
    }
    message += '\n';
  }

  if (links.branches.length > 0) {
    message += '<b>🌿 Branches:</b>\n';
    for (const branch of links.branches) {
      message += `• <a href="${branch.url}">${branch.name}</a>\n`;
    }
    message += '\n';
  }

  if (links.commits.length > 0) {
    message += '<b>📝 Commits:</b>\n';
    for (const commit of links.commits) {
      message += `• <a href="${commit.url}">${commit.sha.slice(0, 7)}</a>\n`;
    }
    message += '\n';
  }

  return message || 'No GitHub links found.';
}

/**
 * Parse source name to GitHub URL for Jules settings
 * Converts "sources/github/user/repo" to "https://jules.google/github/user/repo"
 */
export function parseSourceToGitHubUrl(source: string): string | null {
  // Expected format: "sources/github/owner/repo"
  const match = source.match(/^sources\/github\/([^/]+)\/([^/]+)$/);

  if (!match) {
    return null;
  }

  const owner = match[1];
  const repo = match[2];

  return `https://jules.google/github/${owner}/${repo}`;
}

/**
 * Extract repository info from source name
 * Returns { owner, repo } or null if invalid format
 */
export function parseSourceToRepoInfo(source: string): { owner: string; repo: string } | null {
  const match = source.match(/^sources\/github\/([^/]+)\/([^/]+)$/);

  if (!match) {
    return null;
  }

  return {
    owner: match[1],
    repo: match[2],
  };
}

/**
 * Format repository info as readable string
 */
export function formatRepoInfo(owner: string, repo: string): string {
  return `${owner}/${repo}`;
}

/**
 * Create markdown link for GitHub URL
 * Returns formatted link like "[Ver Pull Request #123](url)"
 */
export function createGitHubMarkdownLink(type: 'pr' | 'branch' | 'commit', text: string, url: string): string {
  const emoji = type === 'pr' ? '🔀' : type === 'branch' ? '🌿' : '📝';
  return `${emoji} [${text}](${url})`;
}
