# GitHub Actions Workflows

This directory contains all GitHub Actions workflows for continuous integration, deployment, and automation.

## 📋 Workflows Overview

### 🔄 CI Pipeline (`ci.yml`)

**Trigger**: Push to main/develop/claude branches, Pull Requests

**Jobs**:
1. **Lint & Type Check** - TypeScript compilation and code formatting
2. **Run Tests** - Execute test suite with Vitest
3. **Build Check** - Verify Wrangler can build the worker
4. **Security Audit** - Check for vulnerabilities with npm audit
5. **All Checks Passed** - Confirmation that all checks succeeded

**Purpose**: Ensures code quality and catches issues early in the development process.

---

### 🚀 Deployment (`deploy.yml`)

**Trigger**: Push to main (production) or develop (staging)

**Environments**:
- **Production** (`main` branch)
  - Deploys to: `jot-telegram-jules-bot.workers.dev`
  - Sets Telegram webhook automatically
  - Runs health check

- **Staging** (`develop` branch)
  - Deploys to: `jot-telegram-jules-bot-dev.workers.dev`
  - Uses separate bot token for testing
  - Isolated from production

**Required Secrets**:
- `CLOUDFLARE_API_TOKEN` - API token for Cloudflare Workers
- `CLOUDFLARE_ACCOUNT_ID` - Your Cloudflare account ID
- `BOT_TOKEN` - Production Telegram bot token
- `BOT_TOKEN_DEV` - Staging Telegram bot token
- `PRODUCTION_WORKER_URL` - Production worker URL
- `STAGING_WORKER_URL` - Staging worker URL

**Purpose**: Automated deployment to Cloudflare Workers with environment-specific configuration.

---

### 🤖 Dependabot Auto-Merge (`dependabot-auto-merge.yml`)

**Trigger**: Pull requests from Dependabot

**Behavior**:
- **Auto-merge**: Patch and minor version updates
- **Manual review**: Major version updates (adds warning comment)

**Purpose**: Keeps dependencies up-to-date with minimal manual intervention.

---

### 🏷️ Release Management (`release.yml`)

**Trigger**: Push tags matching `v*.*.*` (e.g., `v1.0.0`)

**Actions**:
1. Runs tests
2. Generates changelog from commits
3. Creates GitHub release
4. Marks as pre-release if version contains alpha/beta/rc

**How to Create a Release**:
```bash
# Tag the commit
git tag v1.0.0

# Push the tag
git push origin v1.0.0
```

**Purpose**: Automated release creation with changelog generation.

---

### ✅ PR Lint (`pr-lint.yml`)

**Trigger**: Pull request opened, edited, or synchronized

**Checks**:
1. **Title Format** - Must follow [Conventional Commits](https://www.conventionalcommits.org/)
   - Types: feat, fix, docs, style, refactor, test, chore, ci, build, perf, revert
   - Example: `feat: Add support for image uploads`

2. **PR Size** - Warns if PR has >1000 line changes

3. **Description** - Ensures PR has a meaningful description (min 50 chars)

4. **Auto-labeling** - Labels PR based on files changed:
   - `bot` - Changes in src/bot/
   - `jules-api` - Changes in src/jules/
   - `storage` - Changes in src/kv/
   - `tests` - Changes in test/
   - `ci/cd` - Changes in .github/
   - `documentation` - Changes to .md files
   - `dependencies` - Changes to package.json
   - `cloudflare` - Changes to wrangler.toml

5. **Statistics** - Comments with PR stats (files changed, additions, deletions, file types)

**Purpose**: Ensures PR quality and consistency.

---

### 🔒 CodeQL Security Analysis (`codeql.yml`)

**Trigger**:
- Push to main/develop
- Pull requests
- Weekly schedule (Monday 00:00 UTC)

**Analysis**:
- Security vulnerabilities
- Code quality issues
- Uses extended security queries

**Purpose**: Automated security scanning to detect vulnerabilities.

---

### 📊 Performance Monitoring (`performance.yml`)

**Trigger**: Pull requests, manual dispatch

**Checks**:
1. **Bundle Size**
   - Measures worker bundle size
   - Warns if exceeds 1MB (Cloudflare Workers Free tier limit)
   - Comments on PR with size report

2. **Test Performance**
   - Runs tests with detailed timing
   - Reports performance metrics

**Purpose**: Monitors bundle size and test performance to prevent regressions.

---

## 📦 Dependabot Configuration (`dependabot.yml`)

**Schedule**: Weekly on Monday at 09:00 UTC

**Managed Dependencies**:
- npm packages
- GitHub Actions versions

**Behavior**:
- Groups minor and patch updates together
- Ignores wrangler major updates (locked to 3.99.0)
- Auto-assigns to @insign
- Labels: `dependencies`, `automated`

---

## 🔐 Required Secrets

To use these workflows, configure the following secrets in your GitHub repository:

### Cloudflare
```
CLOUDFLARE_API_TOKEN=<your-cloudflare-api-token>
CLOUDFLARE_ACCOUNT_ID=<your-cloudflare-account-id>
```

### Telegram Bot Tokens
```
BOT_TOKEN=<production-bot-token>
BOT_TOKEN_DEV=<staging-bot-token>
```

### Worker URLs
```
PRODUCTION_WORKER_URL=https://jot-telegram-jules-bot.workers.dev
STAGING_WORKER_URL=https://jot-telegram-jules-bot-dev.workers.dev
```

### Optional
```
CODECOV_TOKEN=<codecov-token>  # For code coverage reporting
```

---

## 🎯 Workflow Best Practices

### For Contributors

1. **PR Title**: Use conventional commits format
   - ✅ `feat: Add image upload support`
   - ❌ `Added some stuff`

2. **PR Description**: Be descriptive (min 50 characters)
   - Explain what and why
   - Reference related issues

3. **PR Size**: Keep PRs focused and small (<1000 lines when possible)

4. **Tests**: Add tests for new features

5. **Type Safety**: Ensure TypeScript compiles without errors

### For Maintainers

1. **Merging PRs**: Wait for all checks to pass

2. **Creating Releases**:
   ```bash
   git tag v1.0.0
   git push origin v1.0.0
   ```

3. **Emergency Fixes**: Use workflow_dispatch for manual deployments

4. **Monitoring**: Check GitHub Actions dashboard regularly

---

## 🐛 Troubleshooting

### Workflow Failed?

1. **Check logs**: Click on the failed job to see details
2. **Common issues**:
   - Missing secrets
   - Type errors
   - Test failures
   - Bundle size too large

### Deployment Failed?

1. **Verify secrets**: Ensure all Cloudflare secrets are set
2. **Check worker quota**: Free tier has limits
3. **Review error logs**: Cloudflare dashboard shows runtime errors

### CodeQL Alerts?

1. **Review alert**: Check the Security tab
2. **Assess severity**: High/Critical should be fixed immediately
3. **Create PR**: Fix the issue and link to the alert

---

## 📚 Additional Resources

- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [Cloudflare Workers Actions](https://github.com/cloudflare/wrangler-action)
- [Conventional Commits](https://www.conventionalcommits.org/)
- [Semantic Versioning](https://semver.org/)

---

## 🤝 Contributing to Workflows

If you want to improve these workflows:

1. Test changes in a fork first
2. Document any new secrets required
3. Update this README with changes
4. Submit a PR with `ci:` prefix in title

---

*Last updated: 2025-11-03*
