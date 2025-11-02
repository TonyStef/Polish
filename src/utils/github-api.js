/**
 * GitHub API Wrapper
 * Handles communication with GitHub's REST API for branch creation and file commits
 *
 * IMPORTANT: Module Loading
 *
 * This file is loaded by service-worker.js using importScripts() (classic script loading).
 * No export/import statements allowed - functions are available in global scope.
 *
 * Security Note: This POC uses Personal Access Tokens (PATs).
 * Future versions should migrate to GitHub App + OAuth for production.
 */

const GITHUB_API_BASE = 'https://api.github.com';
const GITHUB_API_VERSION = '2022-11-28';

/**
 * Custom Error Classes for GitHub API
 */
class GitHubAuthError extends Error {
  constructor(message) {
    super(message);
    this.name = 'GitHubAuthError';
  }
}

class GitHubNotFoundError extends Error {
  constructor(message) {
    super(message);
    this.name = 'GitHubNotFoundError';
  }
}

class GitHubRateLimitError extends Error {
  constructor(remaining, resetTime) {
    super(`Rate limit exceeded. Resets at ${new Date(resetTime * 1000).toLocaleString()}`);
    this.name = 'GitHubRateLimitError';
    this.remaining = remaining;
    this.resetTime = resetTime;
  }
}

class GitHubPermissionError extends Error {
  constructor(message) {
    super(message);
    this.name = 'GitHubPermissionError';
  }
}

/**
 * Make a GitHub API request with error handling
 * @param {string} endpoint - API endpoint (e.g., '/user')
 * @param {string} token - GitHub Personal Access Token
 * @param {Object} options - Fetch options (method, body, etc.)
 * @returns {Promise<Object>} - API response data
 */
async function githubApiRequest(endpoint, token, options = {}) {
  const url = `${GITHUB_API_BASE}${endpoint}`;

  const headers = {
    'Authorization': `token ${token}`,
    'Accept': 'application/vnd.github.v3+json',
    'X-GitHub-Api-Version': GITHUB_API_VERSION,
    ...options.headers
  };

  try {
    const response = await fetch(url, {
      ...options,
      headers
    });

    // Check rate limit
    const remaining = response.headers.get('X-RateLimit-Remaining');
    const resetTime = response.headers.get('X-RateLimit-Reset');

    if (response.status === 403 && remaining === '0') {
      throw new GitHubRateLimitError(remaining, resetTime);
    }

    if (response.status === 401) {
      throw new GitHubAuthError('Invalid or expired token');
    }

    if (response.status === 404) {
      throw new GitHubNotFoundError('Repository not found or no access');
    }

    if (response.status === 403) {
      throw new GitHubPermissionError('Insufficient permissions. Ensure your PAT has repo→contents (read/write) access');
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `GitHub API error: ${response.status}`);
    }

    // For 204 No Content responses
    if (response.status === 204) {
      return {};
    }

    return await response.json();

  } catch (error) {
    // Re-throw our custom errors
    if (error instanceof GitHubAuthError ||
        error instanceof GitHubNotFoundError ||
        error instanceof GitHubRateLimitError ||
        error instanceof GitHubPermissionError) {
      throw error;
    }

    // Wrap other errors
    console.error('GitHub API request failed:', error);
    throw error;
  }
}

/**
 * Get authenticated user information
 * @param {string} token - GitHub Personal Access Token
 * @returns {Promise<Object>} - User data { login, name, email, ... }
 */
async function getUser(token) {
  return await githubApiRequest('/user', token);
}

/**
 * Get repository details
 * @param {string} token - GitHub Personal Access Token
 * @param {string} repo - Repository in format "owner/repo"
 * @returns {Promise<Object>} - Repository data
 */
async function getRepoDetails(token, repo) {
  if (!repo || !repo.includes('/')) {
    throw new Error('Repository must be in format "owner/repo"');
  }

  return await githubApiRequest(`/repos/${repo}`, token);
}

/**
 * Get branch reference (includes SHA)
 * @param {string} token - GitHub Personal Access Token
 * @param {string} repo - Repository in format "owner/repo"
 * @param {string} branch - Branch name (e.g., "main")
 * @returns {Promise<Object>} - Reference data { ref, object: { sha } }
 */
async function getBranchRef(token, repo, branch) {
  return await githubApiRequest(`/repos/${repo}/git/refs/heads/${branch}`, token);
}

/**
 * Create a new branch from base SHA
 * @param {string} token - GitHub Personal Access Token
 * @param {string} repo - Repository in format "owner/repo"
 * @param {string} newBranch - New branch name
 * @param {string} baseSha - Base commit SHA to branch from
 * @returns {Promise<Object>} - Created reference data
 */
async function createBranch(token, repo, newBranch, baseSha) {
  return await githubApiRequest(`/repos/${repo}/git/refs`, token, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      ref: `refs/heads/${newBranch}`,
      sha: baseSha
    })
  });
}

/**
 * Create or update a file in repository
 * @param {string} token - GitHub Personal Access Token
 * @param {string} repo - Repository in format "owner/repo"
 * @param {string} path - File path in repo (e.g., "polish-changes/index.html")
 * @param {string} content - File content (will be base64 encoded)
 * @param {string} message - Commit message
 * @param {string} branch - Branch name
 * @param {string} sha - Optional: SHA of file being replaced (for updates)
 * @returns {Promise<Object>} - Commit data
 */
async function createOrUpdateFile(token, repo, path, content, message, branch, sha = null) {
  const body = {
    message,
    content: btoa(unescape(encodeURIComponent(content))), // Encode to base64, handle UTF-8
    branch
  };

  // If updating existing file, include SHA
  if (sha) {
    body.sha = sha;
  }

  return await githubApiRequest(`/repos/${repo}/contents/${path}`, token, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });
}

/**
 * Validate GitHub connection (token + repo access)
 * @param {string} token - GitHub Personal Access Token
 * @param {string} repo - Repository in format "owner/repo"
 * @returns {Promise<Object>} - { valid: true, username, repoName, defaultBranch }
 */
async function validateConnection(token, repo) {
  if (!token) {
    throw new Error('GitHub token is required');
  }

  if (!repo || !repo.includes('/')) {
    throw new Error('Repository must be in format "owner/repo"');
  }

  try {
    // Validate token by getting user
    const user = await getUser(token);

    // Validate repo access
    const repoData = await getRepoDetails(token, repo);

    return {
      valid: true,
      username: user.login,
      repoName: repoData.name,
      defaultBranch: repoData.default_branch || 'main'
    };

  } catch (error) {
    return {
      valid: false,
      error: error.message,
      errorType: error.name
    };
  }
}

/**
 * Create a pull request
 * @param {string} token - GitHub Personal Access Token
 * @param {string} repo - Repository in format "owner/repo"
 * @param {string} title - PR title
 * @param {string} head - Head branch name
 * @param {string} base - Base branch name
 * @param {string} body - PR description
 * @returns {Promise<Object>} - Created PR data
 */
async function createPullRequest(token, repo, title, head, base, body = '') {
  return await githubApiRequest(`/repos/${repo}/pulls`, token, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      title,
      head,
      base,
      body
    })
  });
}
