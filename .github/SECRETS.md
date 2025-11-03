# GitHub Actions Secrets Configuration

This guide explains how to configure the required secrets for GitHub Actions workflows to work properly.

## Why Some Workflows May Fail

If you just forked or cloned this repository, some GitHub Actions workflows may show warnings or be skipped because they require secrets that aren't configured yet. **This is normal and expected!**

### What Works Without Secrets

✅ **These workflows will always work:**
- Type checking and linting
- Running tests
- Security audits
- PR linting and labeling
- CodeQL security analysis

❌ **These workflows need secrets:**
- Cloudflare Workers deployment
- Bundle size checking (uses Wrangler)
- Automatic webhook configuration

## Required Secrets

To enable all workflows, configure these secrets in your GitHub repository:

### Navigation

Go to: **Repository → Settings → Secrets and variables → Actions → New repository secret**

### Cloudflare Configuration

#### `CLOUDFLARE_API_TOKEN`
**Required for**: Deployment workflows, bundle size checking

**How to get it:**
1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com)
2. Click on your profile (top right) → API Tokens
3. Create Token → Use template "Edit Cloudflare Workers"
4. Copy the token and add it as a secret

#### `CLOUDFLARE_ACCOUNT_ID`
**Required for**: Deployment workflows

**How to get it:**
1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com)
2. Click on "Workers & Pages"
3. Your Account ID is shown on the right sidebar
4. Copy and add as a secret

### Telegram Bot Configuration

#### `BOT_TOKEN` (Production)
**Required for**: Production deployment

**How to get it:**
1. Open Telegram and search for [@BotFather](https://t.me/BotFather)
2. Send `/newbot` and follow instructions
3. Copy the token provided
4. Add as secret

#### `BOT_TOKEN_DEV` (Staging)
**Required for**: Staging deployment (optional)

**How to get it:**
1. Create another bot with @BotFather (different from production)
2. This bot is for testing on staging environment
3. Copy the token and add as secret

### Worker URLs

#### `PRODUCTION_WORKER_URL`
**Required for**: Webhook configuration in production

**Format**: `https://your-worker-name.workers.dev`

**How to set:**
1. After first deployment, you'll get the Worker URL
2. Add it as a secret
3. Format: `https://jot-telegram-jules-bot.workers.dev`

#### `STAGING_WORKER_URL`
**Required for**: Webhook configuration in staging (optional)

**Format**: `https://your-worker-name-dev.workers.dev`

### Optional Secrets

#### `CODECOV_TOKEN`
**Required for**: Code coverage reporting (optional)

**How to get it:**
1. Go to [Codecov.io](https://codecov.io)
2. Connect your repository
3. Copy the upload token
4. Add as secret

## Configuration Steps

### 1. Configure Cloudflare Secrets (Minimum Required)

```bash
# These are the minimum secrets needed for deployment
CLOUDFLARE_API_TOKEN=<your-token>
CLOUDFLARE_ACCOUNT_ID=<your-account-id>
```

### 2. Configure Bot Tokens

```bash
# Production bot
BOT_TOKEN=<your-production-bot-token>

# Optional: Staging bot (recommended for testing)
BOT_TOKEN_DEV=<your-staging-bot-token>
```

### 3. Configure Worker URLs (After First Deploy)

```bash
# These are set after your first deployment
PRODUCTION_WORKER_URL=https://your-worker.workers.dev
STAGING_WORKER_URL=https://your-worker-dev.workers.dev
```

## Workflow Behavior Without Secrets

| Workflow | Without Secrets | With Secrets |
|----------|----------------|--------------|
| **CI** | ✅ Runs (skips Wrangler build) | ✅ Full build check |
| **Deploy** | ❌ Skipped (no secrets) | ✅ Auto-deploys |
| **Performance** | ℹ️ Skips bundle size check | ✅ Full bundle analysis |
| **PR Lint** | ✅ Always works | ✅ Always works |
| **CodeQL** | ✅ Always works | ✅ Always works |
| **Release** | ✅ Always works | ✅ Always works |

## Testing Locally

To test workflows locally without secrets:

```bash
# Type checking
npm run build

# Tests
npm test

# Wrangler build (requires secrets)
wrangler login
wrangler deploy --dry-run
```

## Troubleshooting

### "Build failed" in CI workflow
**Cause**: Cloudflare secrets not configured
**Solution**: Add `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` secrets

### "Bundle size check skipped"
**Cause**: Wrangler can't build without Cloudflare secrets
**Solution**: This is expected without secrets. Configure Cloudflare secrets to enable.

### Deployment workflow doesn't run
**Cause**: Missing deployment secrets
**Solution**: Add all Cloudflare and bot token secrets

### Webhook configuration fails
**Cause**: Worker URL secrets not configured
**Solution**: Deploy manually first, then add the Worker URL secrets

## Deployment Without CI/CD

If you prefer to deploy manually without using GitHub Actions:

```bash
# Login to Cloudflare
wrangler login

# Set bot token
wrangler secret put BOT_TOKEN

# Deploy
wrangler deploy

# Configure webhook manually
curl "https://api.telegram.org/bot<YOUR_BOT_TOKEN>/setWebhook?url=https://your-worker.workers.dev/webhook"
```

## Security Best Practices

1. **Never commit secrets** to the repository
2. **Use different bot tokens** for production and staging
3. **Rotate tokens** periodically
4. **Limit token permissions** to minimum required (Cloudflare: Workers edit only)
5. **Review token access** in Cloudflare and Telegram regularly

## Getting Help

If you're having issues with secrets configuration:

1. Check the [GitHub Actions logs](../../actions) for detailed error messages
2. Review [Cloudflare Workers documentation](https://developers.cloudflare.com/workers/)
3. Check [Telegram Bot API docs](https://core.telegram.org/bots/api)
4. Open an issue in this repository

---

**Note**: This project follows security best practices and will never ask for your secrets in issues or pull requests. Secrets are only configured through GitHub's secure secrets management system.
