# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Jot is a Cloudflare Worker that provides a Telegram bot interface for Jules (Google's AI coding assistant). It uses Grammy framework for Telegram integration and implements a multi-tenant architecture where each Telegram group has isolated configuration and sessions. Each Telegram topic (forum thread) maps 1:1 to a Jules session for perfect organization.

**Technology Stack:**
- **Runtime**: Cloudflare Workers (serverless)
- **Language**: TypeScript (ES2022)
- **Telegram Framework**: Grammy
- **Testing**: Vitest with `@cloudflare/vitest-pool-workers`
- **Storage**: Cloudflare KV (multi-tenant)
- **API**: Jules API (Google's AI coding assistant)

## Common Commands

### Development

```bash
# Start local development server
npm run dev
# or
wrangler dev
# Server runs at http://localhost:8787
# Note: Cron triggers don't run in dev mode

# Generate TypeScript types from wrangler.toml
npm run cf-typegen
# or
wrangler types
```

### Testing

```bash
# Run all tests
npm test

# Run tests in watch mode (development)
npm run test:watch

# Run tests with coverage report
npm run test:coverage

# Run tests directly with vitest
npx vitest
npx vitest --run
```

Tests use Vitest with Cloudflare Workers pool for Worker-specific testing. See `vitest.config.ts:3` for configuration.

### Deployment

```bash
# Deploy to production
npm run deploy
# or
wrangler deploy
```

### Setup Commands

```bash
# Install dependencies
npm install

# Create KV namespaces (development and preview)
wrangler kv:namespace create "KV"
wrangler kv:namespace create "KV" --preview

# Set secrets
wrangler secret put BOT_TOKEN
```

## High-Level Architecture

```
┌─────────────┐     Webhook      ┌──────────────────┐
│  Telegram   │ ───────────────► │  Cloudflare      │
│             │                   │  Worker          │
│  User sends │                   │  (Grammy Bot)    │
│  message or │                   │                  │
│  image      │                   └────────┬─────────┘
└─────────────┘                            │
                                           │ API Call
                 ┌─────────────────────────▼────────┐
                 │                                   │
                 │  Jules API                        │
                 │  (sessions, activities, sources)  │
                 │                                   │
                 └───────────────┬───────────────────┘
                                 │
      ┌──────────────────────────┴──────────────────────┐
      │                                                  │
      │  Cron Trigger (every 1 min)                     │
      │  - Poll new activities for all sessions          │
      │  - Process and format activities                 │
      │  - Send to appropriate Telegram topic            │
      │                                                  │
      └──────────────────────────┬───────────────────────┘
                                 │
                                 ▼
                          ┌─────────────┐
                          │  Telegram   │
                          │  (auto      │
                          │  updates)   │
                          └─────────────┘
```

### Core Components

#### 1. **Bot Layer** (`src/bot/`)

- **bot.ts** - Core bot configuration, utility functions for sending messages, checking permissions, managing topics
- **commands/** - Command handlers organized by category
  - `basicCommands.ts` - /start, /help
  - `configCommands.ts` - Admin-only configuration commands (/set_jules_token, /set_source, etc.)
  - `infoCommands.ts` - Information display commands (/status, /list_sessions, etc.)
  - `actionCommands.ts` - Action commands (/new_session, /approve_plan, /delete_session, etc.)
- **handlers/** - Message and event processors
  - `messageHandlers.ts` - Processes text and image messages from users
  - `callbackHandlers.ts` - Handles inline button callbacks (approve plan, publish PR, etc.)
  - `activityProcessor.ts` - Processes Jules API activities and formats them for Telegram

#### 2. **Cron Layer** (`src/cron/`)

Automated background tasks triggered by Cloudflare cron triggers:
- `pollActivities.ts` - Polls Jules API for new activities every minute (src/cron/pollActivities.ts:1)
- `syncSessions.ts` - Syncs local sessions with Jules API every 15 minutes (src/cron/syncSessions.ts:1)

Configured in `wrangler.toml:19-23`.

#### 3. **Jules API Integration** (`src/jules/`)

- `api.ts` - Jules API client for:
  - Session management (create, delete, list)
  - Activity polling
  - Sending prompts and images
  - Approving plans
  - Publishing branches/PRs

#### 4. **Storage Layer** (`src/kv/`)

- `storage.ts` - KV storage abstraction for multi-tenant data:
  - Group configurations (token, source, branch, settings)
  - Session mappings (topic ID ↔ session ID)
  - Activity tracking
  - KV keys follow pattern: `{groupId}:{type}:{key}`

#### 5. **Utilities** (`src/utils/`)

- `formatters.ts` - Formats Jules outputs for Telegram (expanding blockquotes, GitHub link extraction)
- `github.ts` - GitHub integration utilities
- `image.ts` - Image processing for sending screenshots/designs to Jules
- `retry.ts` - Retry logic for API calls

#### 6. **Main Entry** (`src/index.ts`)

Worker entry point with:
- `fetch()` handler for webhook requests (src/index.ts:109)
- `scheduled()` handler for cron triggers (src/index.ts:143)
- Bot setup and handler registration (src/index.ts:59)

## Multi-Tenancy Model

The architecture implements strict isolation between Telegram groups:

1. **Group Configuration**: Each group has isolated configuration stored in KV
   - Jules API token
   - Default source (repository)
   - Default branch
   - Settings (auto PR, approval required, etc.)

2. **Session Mapping**: Each Telegram topic maps to exactly one Jules session
   - Topic ID → Session ID stored in KV
   - Allows multiple concurrent sessions per group
   - Perfect organization with topic-based isolation

3. **Cron Efficiency**: Cron jobs iterate through all active sessions across all groups (see src/cron/pollActivities.ts:15)

## Key Configuration Files

- **wrangler.toml** - Cloudflare Worker configuration
  - KV namespace bindings
  - Cron triggers
  - Environment variables
  - Environment-specific settings (dev/prod)

- **tsconfig.json** - TypeScript configuration
  - ES2022 module system
  - Strict mode enabled
  - Cloudflare Workers types included

- **vitest.config.ts** - Vitest configuration with Cloudflare Workers pool

## Development Workflow

### Local Development

1. Install dependencies: `npm install`
2. Create KV namespaces for dev and preview
3. Set BOT_TOKEN secret: `wrangler secret put BOT_TOKEN`
4. Start dev server: `npm run dev`
5. Tests: `npm run test:watch` (cron triggers don't run in dev)

### Testing Strategy

Tests are written using Vitest with Cloudflare Workers pool for realistic Worker environment testing. Tests can run Worker-specific code including:
- KV operations
- Fetch API
- Environment bindings
- Scheduled events

### Production Deployment

1. Deploy: `npm run deploy`
2. Set Telegram webhook: `curl "https://api.telegram.org/bot<BOT_TOKEN>/setWebhook?url=https://your-worker.workers.dev/webhook"`
3. Cron triggers run automatically (requires Workers Paid plan)

## Critical Implementation Details

### Permission System

- **Bot Permissions**: Must be admin with "Manage Topics" permission (src/bot/bot.ts:87)
- **User Permissions**: Only group admins can run configuration commands (src/bot/bot.ts:68)
- **Privacy Mode**: Must be disabled in @BotFather to read all group messages

### Topic Management

- Bot updates topic titles with session info (src/bot/bot.ts:181)
- Format: `{owner}/{repo} {last-4-chars-of-session-id}`
- Requires "can_manage_topics" permission

### Notification Strategy

- **Important events** (plan ready, errors): Send with notification
- **Routine updates** (typing indicators, progress): Send silently
- See `sendMessage()` in src/bot/bot.ts:151

### Cron Trigger Logic

Cron jobs determine which task to run based on current minute (src/index.ts:154-165):
- Every 15 minutes: Run session sync
- Every minute: Run activity polling

### Error Handling

- All bot handlers wrapped in try-catch (src/index.ts:96)
- KV operations include error handling with fallbacks
- API calls use retry logic from utils/retry.ts
- Silent failures for non-critical operations (e.g., topic title updates)

## Common Patterns

### Creating a New Command

1. Add handler function in appropriate file under `src/bot/commands/`
2. Register in `src/index.ts` setupBot() function
3. Add to relevant command category in README.md
4. Add tests if functionality is complex

### Processing Messages

1. Text messages: Add handler in `src/bot/handlers/messageHandlers.ts:handleTextMessage`
2. Image messages: Add handler in `src/bot/handlers/messageHandlers.ts:handlePhotoMessage`
3. Callback queries: Add handler in `src/bot/handlers/callbackHandlers.ts`

### Adding Cron Jobs

1. Create function in `src/cron/`
2. Register in `wrangler.toml` crons array
3. Add logic in `src/index.ts:scheduled()` to determine when to run
4. Requires Workers Paid plan

### KV Storage Access

Import and use the storage module:
```typescript
import { getGroupConfig, setGroupConfig } from './kv/storage';

// Read
const config = await getGroupConfig(env, groupId);

// Write
await setGroupConfig(env, groupId, { ...config, key: value });
```

## Testing Guidelines

- Tests are in `test/` directory
- Use Vitest with Cloudflare Workers pool
- Mock external APIs (Telegram, Jules)
- Test KV operations with Workers test environment
- Run `npm test` before committing

## Environment Setup

### Required Services

1. **Cloudflare Account** - Workers hosting
   - Free tier works for basic functionality
   - Paid tier ($5/month) required for cron triggers

2. **Telegram Bot Token** - From [@BotFather](https://t.me/BotFather)
   - Privacy mode: Disabled
   - Permissions: Admin, Manage Topics

3. **Jules API Key** - From [jules.google](https://jules.google)
   - Configure via `/set_jules_token` command in Telegram

### KV Namespace Setup

```bash
# Production
wrangler kv:namespace create "KV"

# Development
wrangler kv:namespace create "KV" --preview
```

Update `wrangler.toml:12-15` with namespace IDs.

## CI/CD Pipeline

Comprehensive GitHub Actions workflows in `.github/workflows/`:

- **ci.yml** - Runs on push/PR: Type checking, linting, tests
- **deploy.yml** - Deploys to Cloudflare on main/develop branch
- **codeql.yml** - Security analysis
- **release.yml** - Creates releases on version tags
- **dependabot.yml** - Automated dependency updates

See `.github/README.md` for detailed CI/CD documentation.

## License

AGPL-3.0-or-later - See LICENSE file for full details.
