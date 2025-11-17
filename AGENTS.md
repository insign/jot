# AGENTS.md - AI Agent Instructions and Development Guide

This file provides comprehensive guidance for AI agents (Claude Code, GitHub Copilot, etc.) when working with the JoT codebase.

## 📋 Instructions for AI Agents

### Critical Starting Steps

**BEFORE replying to any user request, you MUST:**

1. **Fetch documentation** from these essential sources:

   - https://grammy.dev
   - https://grammy.dev/hosting/cloudflare-workers-nodejs
   - https://developers.cloudflare.com/workers/wrangler/environments/
   - https://grammy.dev/ref/core/webhookcallback
   - https://developers.cloudflare.com/workers/configuration/cron-triggers/
   - https://developers.cloudflare.com/kv/
   - https://developers.google.com/jules/api
   - https://core.telegram.org/bots/api
   - https://developers.google.com/jules/api/reference/rest
   - https://developers.google.com/jules/api/reference/rest/v1alpha/sources
   - https://developers.google.com/jules/api/reference/rest/v1alpha/sessions.activities/list
   - https://grammy.dev/ref/core/api
   - https://core.telegram.org/bots/api#sendphoto
   - https://grammy.dev/plugins/keyboard
   - https://grammy.dev/guide/files
   - https://core.telegram.org/bots/api#formatting-options
   - https://core.telegram.org/bots/api#inlinekeyboardmarkup
   - https://grammy.dev/guide/commands
   - https://developers.cloudflare.com/workers/runtime-apis/durable-objects/
   - https://developers.cloudflare.com/workers/wrangler/commands/#deploy
   - https://vitest.dev
   - https://developers.cloudflare.com/workers/testing/vitest-integration/
   - https://developers.cloudflare.com/workers/testing/miniflare/
   - https://jules.google
   - https://developers.cloudflare.com/workers/observability/logging/

2. **Read repomix-output.xml** if it exists in the root directory (it's kept up-to-date)

3. **Check for related documentation files** in the repository

### 🎯 Best Practices and Work Rules

#### Code Quality Standards

- **Language**: All code, variables, and comments MUST be in English
- **Comments**: Add comments explaining important decisions throughout the code
- **Keep comments updated**: Comments MUST always reflect the current reality
- **Clarity is crucial**: Having comments in code is critical for maintaining extreme clarity

#### Problem-Solving Approach

- **Research first**: When stuck on an error, search the internet for solutions before asking the user
- **Deep context analysis**: Always seek deeper context within the current code to understand errors
- **Avoid assumptions**: Don't rush to solutions; analyze files deeply to identify possible effects
- **Self-reflection**: Frequently repeat to yourself:
  - The original request
  - What has been done
  - What remains to be done
  - Protection directives against hallucination

#### Search and Documentation Strategy

- **Use web search tools**: Brave Search for errors and documentation
- **Use Context7**: For "straight to the point" documentation
- **Rate limiting**: Limit 2 seconds between each search call to avoid rate limits
- **Generic before specific**: Start with simple, generic search terms before advancing to very specific ones
  - ✅ Example: "laravel code coverage common errors"
  - ❌ Avoid: "laravel code coverage pcov null postgres docker compose error"

#### Error Handling Protocol

- **Always search online**: When encountering an error, ALWAYS search the internet to compare your solution idea with actual solutions
- **Compare approaches**: Don't implement the first solution that comes to mind

#### Git Workflow

- **Create branches**: If working with git on main/master, create a branch to work more freely (unless user says to work on main)
- **In plan mode**: Ask the user how they want to proceed with branching
- **No co-authors**: NEVER add co-authors in commits, not even Claude
- **The `gh` command**: Is available and authenticated in the system

#### Environment and Tools

- **Container tool**: Use `podman` and `podman-compose` instead of Docker (already installed in system)
- **Check project structure**: Before starting, review files like docker-compose.yml and Makefile to better understand the system

#### Task Management

- **Always create todo lists**: Keep the user aware of the process
- **Adapt todos**: When one ends and new demands arise, create a new todo or adapt the current one if relevant

#### Quality Checks (TypeScript Projects)

- **Type checking**: If project uses TypeScript, always use project's `tsc` to verify code before advancing/completing task
- **Linting**: If project uses ESLint, verify ESLint errors equally

#### Completion Protocol

- **Notify user**: When needing attention or finishing work, call `mcp__notifications__play_notification` before the final function
- **Auto mode**: If user ends a sentence with exactly the word "auto":
  1. After successfully completing the task
  2. Make commit with summary of operations
  3. Push changes
  4. Call notification as usual
- **Update repomix**: If task succeeds and `repomix-output.xml` exists in root, execute `npx repomix` or call equivalent tool

---

## 🏗️ Project Overview

### What is JoT?

JoT stands for "Jules over Telegram". It is a Cloudflare Worker that provides a Telegram bot interface for Jules (Google's AI asynchronous coding assistant). It uses the Grammy framework for Telegram integration and implements a multi-tenant architecture where each Telegram group has isolated configuration and sessions. Each Telegram topic (forum thread) maps 1:1 to a Jules session for perfect organization.

**Technology Stack:**

- **Runtime**: Cloudflare Workers (serverless)
- **Language**: TypeScript (ES2022)
- **Telegram Framework**: Grammy
- **Testing**: Vitest with `@cloudflare/vitest-pool-workers`
- **Storage**: Cloudflare KV (multi-tenant)
- **API**: Jules API (Google's AI asynchronous coding assistant)

### Common Commands

#### Development

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

#### Testing

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

#### Deployment

```bash
# Deploy to production
npm run deploy
# or
wrangler deploy
```

#### Setup Commands

```bash
# Install dependencies
npm install

# Create KV namespaces (development and preview)
wrangler kv namespace create "KV"
wrangler kv namespace create "KV" --preview

# Set secrets
wrangler secret put BOT_TOKEN
```

### High-Level Architecture

```
┌─────────────┐     Webhook      ┌──────────────────┐
│  Telegram   │ ───────────────► │  Cloudflare      │
│             │                  │  Worker          │
│  User sends │                  │  (Grammy Bot)    │
│  message or │                  │                  │
│  image      │                  └─────────┬────────┘
└─────────────┘                            │
                                           │ API Call
                 ┌─────────────────────────▼────────┐
                 │                                  │
                 │  Jules API                       │
                 │  (sessions, activities, sources) │
                 │                                  │
                 └───────────────┬──────────────────┘
                                 │
      ┌──────────────────────────┴──────────────────────┐
      │                                                 │
      │  Cron Trigger (every 1 min)                     │
      │  - Poll new activities for all sessions         │
      │  - Process and format activities                │
      │  - Send to appropriate Telegram topic           │
      │                                                 │
      └──────────────────────────┬──────────────────────┘
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

### Multi-Tenancy Model

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

### Key Configuration Files

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

### Development Workflow

#### Local Development

1. Install dependencies: `npm install`
2. Create KV namespaces for dev and preview
3. Set BOT_TOKEN secret: `wrangler secret put BOT_TOKEN`
4. Start dev server: `npm run dev`
5. Tests: `npm run test:watch` (cron triggers don't run in dev)

#### Testing Strategy

Tests are written using Vitest with Cloudflare Workers pool for realistic Worker environment testing. Tests can run Worker-specific code including:

- KV operations
- Fetch API
- Environment bindings
- Scheduled events

#### Production Deployment

1. Deploy: `npm run deploy`
2. Set Telegram webhook: `curl "https://api.telegram.org/bot<BOT_TOKEN>/setWebhook?url=https://your-worker.workers.dev/webhook"`
3. Cron triggers run automatically (requires Workers Paid plan)

### Critical Implementation Details

#### Permission System

- **Bot Permissions**: Must be admin with "Manage Topics" permission (src/bot/bot.ts:87)
- **User Permissions**: Only group admins can run configuration commands (src/bot/bot.ts:68)
- **Privacy Mode**: Must be disabled in @BotFather to read all group messages

#### Topic Management

- Bot updates topic titles with session info (src/bot/bot.ts:181)
- Format: `{owner}/{repo} {last-4-chars-of-session-id}`
- Requires "can_manage_topics" permission

#### Notification Strategy

- **Important events** (plan ready, errors): Send with notification
- **Routine updates** (typing indicators, progress): Send silently
- See `sendMessage()` in src/bot/bot.ts:151

#### Cron Trigger Logic

Cron jobs determine which task to run based on current minute (src/index.ts:154-165):

- Every 15 minutes: Run session sync
- Every minute: Run activity polling

#### Error Handling

- All bot handlers wrapped in try-catch (src/index.ts:96)
- KV operations include error handling with fallbacks
- API calls use retry logic from utils/retry.ts
- Silent failures for non-critical operations (e.g., topic title updates)

### Common Patterns

#### Creating a New Command

1. Add handler function in appropriate file under `src/bot/commands/`
2. Register in `src/index.ts` setupBot() function
3. Add to relevant command category in README.md
4. Add tests if functionality is complex

#### Processing Messages

1. Text messages: Add handler in `src/bot/handlers/messageHandlers.ts:handleTextMessage`
2. Image messages: Add handler in `src/bot/handlers/messageHandlers.ts:handlePhotoMessage`
3. Callback queries: Add handler in `src/bot/handlers/callbackHandlers.ts`

#### Adding Cron Jobs

1. Create function in `src/cron/`
2. Register in `wrangler.toml` crons array
3. Add logic in `src/index.ts:scheduled()` to determine when to run
4. Requires Workers Paid plan

#### KV Storage Access

Import and use the storage module:

```typescript
import { getGroupConfig, setGroupConfig } from "./kv/storage";

// Read
const config = await getGroupConfig(env, groupId);

// Write
await setGroupConfig(env, groupId, { ...config, key: value });
```

### Testing Guidelines

- Tests are in `test/` directory
- Use Vitest with Cloudflare Workers pool
- Mock external APIs (Telegram, Jules)
- Test KV operations with Workers test environment
- Run `npm test` before committing

### Environment Setup

#### Required Services

1. **Cloudflare Account** - Workers hosting

   - Free tier works for basic functionality
   - Paid tier ($5/month) required for cron triggers

2. **Telegram Bot Token** - From [@BotFather](https://t.me/BotFather)

   - Privacy mode: Disabled
   - Permissions: Admin, Manage Topics

3. **Jules API Key** - From [jules.google](https://jules.google)
   - Configure via `/set_jules_token` command in Telegram

#### KV Namespace Setup

```bash
# Production
wrangler kv namespace create "KV"

# Development
wrangler kv namespace create "KV" --preview
```

Update `wrangler.toml:12-15` with namespace IDs.

### CI/CD Pipeline

Comprehensive GitHub Actions workflows in `.github/workflows/`:

- **ci.yml** - Runs on push/PR: Type checking, linting, tests
- **deploy.yml** - Deploys to Cloudflare on main/develop branch
- **codeql.yml** - Security analysis
- **release.yml** - Creates releases on version tags
- **dependabot.yml** - Automated dependency updates

See `.github/README.md` for detailed CI/CD documentation.

### License

AGPL-3.0-or-later - See LICENSE file for full details.

---

## 📝 Development Plan

### Plan Structure Overview

This development plan follows a structured approach to building the Jot Telegram bot. Each section represents a major milestone with specific implementation steps.

### 1. Initial Project Setup

- Create new Cloudflare Worker project using wrangler CLI
- Install Grammy framework as dependency
- Configure basic project structure with TypeScript
- Configure wrangler.toml for development and production environments
- Define Env interface with necessary bindings (KV, environment variables)

**Documentation:**

- https://grammy.dev
- https://grammy.dev/hosting/cloudflare-workers-nodejs
- https://developers.cloudflare.com/workers/wrangler/environments/

### 2. Bot Configuration in Worker

- Create Grammy bot instance using BOT_TOKEN environment variable
- Implement webhookCallback to receive Telegram updates via webhook
- Configure basic Worker fetch handler
- Implement scheduled handler for cron triggers (sync and polling)
- Optimize with pre-configured botInfo to avoid unnecessary getMe calls

**Documentation:**

- https://grammy.dev/hosting/cloudflare-workers-nodejs
- https://grammy.dev/ref/core/webhookcallback
- https://developers.cloudflare.com/workers/configuration/cron-triggers/

### 3. KV Namespace Configuration for Multi-Tenant

- Create KV namespace via wrangler or dashboard
- Configure KV binding in wrangler.toml
- Key structure with group isolation:
  - `group:{group_id}:jules_token`
  - `group:{group_id}:topic:{topic_id}:session`
  - `group:{group_id}:source`
  - `group:{group_id}:automation_mode`
  - `group:{group_id}:require_approval`
  - `group:{group_id}:default_branch`
  - `group:{group_id}:sessions_index`
  - `group:{group_id}:topic:{topic_id}:last_activity_id`
  - `group:{group_id}:topic:{topic_id}:pending_plan`
  - `group:{group_id}:topic:{topic_id}:ready_for_review`
- Implement helpers for KV read/write with group_id as prefix

**Documentation:**

- https://developers.cloudflare.com/kv/

### 4. Authentication System and Per-Group Admin Control

- Implement /set_jules_token command (verifies admin with getChatAdministrators)
- Store token in KV with key `group:{group_id}:jules_token`
- Validate token via GET /v1alpha/sessions before storing
- /status command to verify group configuration
- Ensure total isolation between groups

**Documentation:**

- https://developers.google.com/jules/api
- https://core.telegram.org/bots/api

### 5. 1:1 Topic-Session Management System

- Detect message_thread_id to identify topics
- 1:1 mapping: each topic = 1 Jules session
- Store complete session in KV with status and outputs
- Update topic title: "user/repo session_id" using editForumTopicName
- Verify bot "Manage Topics" permission

**Documentation:**

- https://core.telegram.org/bots/api
- https://developers.google.com/jules/api/reference/rest

### 6. Jules API Integration - Per-Group Sources

- /list_sources command using GET /v1alpha/sources
- Each group sees only their own sources
- /set_source command to define default source
- /get_source command to see configured source
- Store: `group:{group_id}:source`

**Documentation:**

- https://developers.google.com/jules/api/reference/rest/v1alpha/sources

### 7. Jules API Integration - Session Creation

- POST /v1alpha/sessions with {prompt, source, automationMode, requirePlanApproval, startingBranch}
- Extract session_id and store in KV
- Automatically update topic title
- Add to sessions_index
- Start activity polling

**Documentation:**

- https://developers.google.com/jules/api

### 8. "Typing..." Status Indicator

- showTypingIndicator function using sendChatAction "typing"
- Loop repeating every 4-5s (action lasts only 5s)
- Use between sending prompt and receiving activity
- Stop when new activity arrives

**Documentation:**

- https://core.telegram.org/bots/api
- https://grammy.dev/ref/core/api

### 9. Intelligent Notification System

**WITH SOUND (disable_notification=false):**

- planGenerated (MAXIMUM ATTENTION - see section 11)
- sessionCompleted
- "Ready for review"
- progressUpdated with exitCode !== 0
- progressUpdated with artifacts.media
- First activity
- Messages with questions

**SILENT (disable_notification=true):**

- Normal progressUpdated
- bashOutput with exitCode === 0
- Intermediate changeSet
- planApproved
- Informative messages

**Documentation:**

- https://core.telegram.org/bots/api

### 10. Activity Polling via Cron Trigger (AUTOMATIC)

- Cron every 1-2 minutes
- For each active session in each group:
  - GET /v1alpha/sessions/{session_id}/activities
  - Filter new activities (createTime > last_activity_id)
  - **Process and AUTOMATICALLY SEND each activity to correct topic**
  - Update last_activity_id in KV
  - Fetch updated session to get outputs (PRs, branches)
- Implement rate limiting
- **User doesn't need to do anything, activities arrive automatically!**

**Documentation:**

- https://developers.cloudflare.com/workers/configuration/cron-triggers/
- https://developers.google.com/jules/api/reference/rest/v1alpha/sessions.activities/list

### 11. Activity Processing by Type with Special Attention

**planGenerated (MAXIMUM ATTENTION - IMPOSSIBLE TO IGNORE):**

- **Catchy emoji: 🎯**
- **Title in BOLD: "🎯 PLAN CREATED"**
- If requirePlanApproval=true: add **"- APPROVAL REQUIRED"** in bold
- List steps using **expandable blockquote**:
  - Visible title: "🎯 **PLAN CREATED** - X steps"
  - Expandable: `<blockquote expandable>` with complete numbered step list
- Highlighted inline button: "✅ Approve Plan" if requirePlanApproval=true
- If requirePlanApproval=false: inform "Plan will be auto-approved"
- **MANDATORY SOUND NOTIFICATION**
- Use parse_mode: "HTML" for formatting

**planApproved:**

- Brief message: "✅ Plan approved! Jules will start working."
- SILENT

**"Ready for review 🎉":**

- Detect "Ready for review" in title/description
- Format: "🎉 **Ready for review!**\n\nJules finished changes."
- Fetch updated session for outputs
- Inline buttons: "📦 Publish branch" and "🔀 Publish PR"
- Store ready_for_review flag in KV
- WITH SOUND NOTIFICATION

**progressUpdated:**

- If long bashOutput: use expandable blockquote
  - Title: "🔧 Command executed: `command`"
  - Expandable: `<blockquote expandable>` with complete output
- If large changeSet: use expandable blockquote
  - Title: "📁 Modified files (X files)"
  - Expandable: complete file list
- If artifacts.media: download and send as photo
- exitCode !== 0: emoji ⚠️ + WITH NOTIFICATION
- exitCode === 0: emoji 🔧 + SILENT

**sessionCompleted:**

- Emoji ✅ + title: "**Session completed!**"
- Fetch final outputs
- Extract and show GitHub links (PR, branch, commits) with emojis
- Clickable links in Markdown: `[View Pull Request #123](URL)`
- If many details: use expandable blockquote
- WITH SOUND NOTIFICATION

**Other activities:**

- If long: use expandable blockquote
- Decide notification based on content

**Documentation:**

- https://developers.google.com/jules/api/reference/rest/v1alpha/sessions.activities
- https://core.telegram.org/bots/api

### 12. Handlers for Publication Buttons

**callback_query "publish_branch:{session_id}":**

- Validate group
- Call Jules API to publish branch
- Update message (remove "Publish branch" button)
- Show branch link: "✅ Branch published! 🌿 [View on GitHub](URL)"

**callback_query "publish_pr:{session_id}":**

- Validate group
- Call Jules API to create PR
- Update message (remove buttons)
- Show PR link: "✅ Pull Request created! 🔀 [View on GitHub](URL)"

**Documentation:**

- https://grammy.dev/plugins/keyboard

### 13. Support for Receiving User Images

- Handler bot.on("message:photo")
- Extract highest resolution photo: `ctx.message.photo[ctx.message.photo.length - 1]`
- Use ctx.getFile() to get file_path
- Download: `https://api.telegram.org/file/bot<TOKEN>/<file_path>`
- Convert to base64
- Extract caption (or use "Analyze this image")
- POST sendMessage: `{prompt, media: {data: base64, mediaType: "image/jpeg"}}`
- Start "typing..." indicator

**Documentation:**

- https://grammy.dev/guide/files
- https://core.telegram.org/bots/api

### 14. Image to Base64 Conversion

- Function downloadAndConvertImageToBase64(file_path, bot_token)
- Fetch image
- Convert to ArrayBuffer → Buffer
- Convert to base64
- Return base64 + mediaType
- Retry logic with exponential backoff
- 30s timeout

**Documentation:**

- https://grammy.dev/guide/files

### 15. Session Sync via Cron

- Cron every 15-30 minutes
- GET /v1alpha/sessions for each group
- Compare with sessions_index in KV
- Detect deleted sessions
- Remove from KV and notify silently
- Update status and outputs

**Documentation:**

- https://developers.google.com/jules/api/reference/rest

### 16. Manual Sync Command

- /sync (admin only)
- Sync only current group
- GET /v1alpha/sessions
- Compare with KV
- If many sessions: use expandable blockquote
- Report: "X synced, Y removed"
- Update titles and show GitHub links

**Documentation:**

- https://grammy.dev/guide/commands

### 17. Delete Session Command

- /delete_session (admin only)
- Verify admin
- Confirmation button: "⚠️ Confirm Deletion"
- Remove from KV and sessions_index
- Notify: "Session removed locally. To permanently delete, visit jules.google"

**Documentation:**

- https://grammy.dev/plugins/keyboard

### 18. Plan Approval

- /approve_plan in topic with pending plan
- Verify pending_plan in KV
- POST /v1alpha/sessions/{session_id}:approvePlan
- Remove pending_plan from KV
- Confirmation: "✅ Plan approved! Jules will start working."
- Callback_query handler for inline button

**Documentation:**

- https://developers.google.com/jules/api/reference/rest

### 19. Continuous Conversation (Text and Images)

**Text in topic with session:**

- POST sendMessage with {prompt}
- Start "typing..."

**Image in topic with session:**

- Download, convert to base64
- POST sendMessage with {prompt, media}
- Start "typing..."

**Without session:**

- Create new session (text or image)

**General chat:**

- Guide to use topics

**Documentation:**

- https://developers.google.com/jules/api

### 20. Artifact Formatting with Expandable Blockquote

**bashOutput:**

- If short: normal code block
- If long: use expandable blockquote
  - Title: "🔧 Command: `command`"
  - Expandable: `<blockquote expandable>complete output</blockquote>`
- Show exitCode
- Emoji ⚠️ if error

**changeSet:**

- If few files: list normally
- If many: use expandable blockquote
  - Title: "📁 Modified files (X files)"
  - Expandable: `<blockquote expandable>complete list</blockquote>`
- Parse gitPatch.unidiffPatch
- Show +/- lines

**media:**

- Decode base64
- sendPhoto with InputFile
- Caption with title and description

**Documentation:**

- https://core.telegram.org/bots/api#sendphoto

### 21. GitHub Link Extraction

- Function extractGitHubLinks(session.outputs)
- Regex for PR, branch, commit URLs:
  - PR: `https://github.com/[^/]+/[^/]+/pull/\d+`
  - Branch: `https://github.com/[^/]+/[^/]+/tree/[^/\s]+`
  - Commit: `https://github.com/[^/]+/[^/]+/commit/[a-f0-9]+`
- Format as clickable Markdown
- Emojis: 🔀 PR, 🌿 branch, 📝 commit
- Examples:
  - `🔀 [View Pull Request #123](URL)`
  - `🌿 [View Branch feature-xyz](URL)`
  - `📝 [View Commit abc123](URL)`

**Documentation:**

- https://core.telegram.org/bots/api#formatting-options

### 22. Command to Open Jules Settings

**Implement /open_jules_settings:**

- Verify if group has configured source in KV
- If no source: respond "Configure a source first using /set_source"
- If has source:
  - Extract user/repo from source (format: "sources/github/user/repo")
  - Build Jules URL: `https://jules.google/github/{user}/{repo}`
  - Send message with inline button:
    - Text: "⚙️ **Advanced Jules Settings**\n\nTo configure Setup Script, Environment Variables and Memories, access repository settings on Jules website."
    - Button: "🔗 Open Settings" (url: direct link)
- Add note: "These settings are per-repository and affect all future sessions."
- Works in any context (general chat or topic)

**Technical implementation:**

- Helper function: `parseSourceToGitHubUrl(source: string): string`
  - Input: "sources/github/verseles/dartian"
  - Output: "https://jules.google/github/verseles/dartian"
- Use Grammy's InlineKeyboard to create URL button
- Parse mode: "HTML" or "MarkdownV2" for formatting

**Documentation:**

- https://grammy.dev/plugins/keyboard
- https://core.telegram.org/bots/api#inlinekeyboardmarkup

### 23. Command System (with underscore)

**Basic:**

- /start - Welcome with explanation of topics, images, configuration
- /help - Complete list with examples

**Configuration (admin):**

- /set_jules_token <token>
- /set_source <source_name>
- /set_branch <branch_name>
- /set_auto_pr <on|off>
- /require_approval <on|off>

**Information:**

- /status
- /get_source
- /list_sources
- /list_sessions (use blockquote if many)
- /session_info (use blockquote for details)
- /list_activities (use expandable blockquote)
- /show_plan (use expandable blockquote)
- /show_outputs
- **/open_jules_settings** - Open repository settings on Jules website

**Action:**

- /new_session <prompt>
- /approve_plan
- /delete_session
- /sync

**Documentation:**

- https://grammy.dev/guide/commands

### 24. Message Handlers with Image Support

- Extract group_id
- Verify configured token
- Detect type (text, photo)

**Topic + text:**

- If has session: POST sendMessage
- If not: create new session

**Topic + photo:**

- Download, convert to base64
- POST sendMessage with media
- Create session if necessary

**General chat:**

- Guide to use topics

**Documentation:**

- https://grammy.dev/guide/files

### 25. Multi-Tenant Isolation Layer

- Helper functions always with group_id
- getJulesToken(group_id)
- getSession(group_id, topic_id)
- getActiveSessions(group_id)
- getSource(group_id)
- parseSourceToGitHubUrl(source) - new function
- Validate all KV operations include group_id
- Log cross-group access attempts
- Validate callback_query data

**Documentation:**

- https://developers.cloudflare.com/kv/

### 26. Notification and Feedback System

- Use intelligent notification logic
- Send to correct topic with message_thread_id
- Inline buttons:
  - "✅ Approve Plan"
  - "📦 Publish branch"
  - "🔀 Publish PR"
  - "⚠️ Delete Session"
  - "🔄 View Details"
  - "🔗 Open Settings" (for /open_jules_settings)
  - "❌ Cancel"
- Callback_query handlers
- Update messages after action (editMessageText, editMessageReplyMarkup)

**Documentation:**

- https://grammy.dev/plugins/keyboard

### 27. Error Handling and Logs

- Try-catch in all Jules API calls
- Log with group_id, session_id, activity_id, user_id
- Friendly error messages WITH notification
- Rate limiting per group
- Retry logic (3 attempts, exponential backoff)
- Handle 404 (deleted session - remove from KV)
- Handle 401/403 (invalid token - notify admin)
- Image download errors (size, format)
- Image timeout (30s)
- Source parsing error: notify and request /set_source again

**Documentation:**

- https://developers.cloudflare.com/workers/observability/logging/

### 28. Testing with Vitest

- Configure Vitest with @cloudflare/vitest-pool-workers
- Create vitest.config.ts using defineWorkersConfig
- Unit tests:
  - helpers
  - formatters
  - parsers
  - extractGitHubLinks
  - parseSourceToGitHubUrl
- Integration tests: handlers, activity processing, blockquote formatting
- Mock tests: Jules API and Telegram API
- KV tests: read/write operations (miniflare already included)
- Use wrangler dev for local development
- **Note: Miniflare comes integrated in Wrangler 2.0+, no separate installation needed**

**Documentation:**

- https://developers.cloudflare.com/workers/testing/vitest-integration/
- https://developers.cloudflare.com/workers/testing/miniflare/
- https://vitest.dev

### 29. Deploy and Production Configuration

- Environment variables with wrangler secret (BOT_TOKEN)
- Cron triggers in wrangler.toml:
  - `*/1 * * * *` (activity polling - every 1 minute)
  - `*/15 * * * *` (session sync - every 15 minutes)
- wrangler deploy
- Configure Telegram webhook: `https://api.telegram.org/bot<TOKEN>/setWebhook?url=https://<WORKER>.workers.dev/`
- Test complete flow in multiple groups:
  - Create session (text and image)
  - Receive activities automatically via cron
  - Approve plan
  - Ready for review + buttons
  - Publish branch/PR + GitHub links
  - /open_jules_settings
  - Expandable blockquote in long messages
  - Delete session
- Test isolation, notifications, "typing..." indicator
- Monitor logs in dashboard

**Documentation:**

- https://developers.cloudflare.com/workers/wrangler/commands/#deploy
- https://grammy.dev/hosting/cloudflare-workers-nodejs

### 30. Optimizations

- Token cache per group (in memory)
- Sources cache
- Generated Jules URLs cache
- Temporary image cache
- Process only active sessions
- Exponential retry logic
- Consider Durable Objects for continuous "typing..." (5s loop)
- Consider Durable Objects for real-time polling
- Workers Analytics
- Automatic cleanup of old sessions (30 days)
- Debounce for repeated activities
- Compression of long messages or use blockquote
- Streams for large images
- Connection pool for parallel downloads

**Documentation:**

- https://developers.cloudflare.com/workers/runtime-apis/durable-objects/

### 31. Known Jules API Limitations

**Features available ONLY on web interface:**

1. **Setup Script:**

   - No API endpoint to configure/edit setup script
   - Must be configured via web interface at Environment → Setup script
   - Affects all future sessions for the repository

2. **Environment Variables per Source:**

   - No endpoint to configure env vars at repository level
   - Must be configured via web interface at Environment → Environment variables
   - Affects all future sessions for the repository

3. **Memories/Knowledge:**
   - No endpoint to add/manage memories manually
   - Memories are automatically generated during sessions
   - Manual memories must be added via web interface at Knowledge → Add Memory

**Solution in bot:**

- /open_jules_settings command directs user to web interface
- Clearly document these limitations in README
- Add note in relevant commands guiding to use web interface

**Documentation:**

- https://developers.google.com/jules/api
- https://jules.google (web interface)

### 32. Complete README (English, AGPLv3)

**README.md structure:**

- **Title + Badges**: license (AGPLv3), build status, version
- **Description**: What the bot does (2-3 paragraphs)
- **Features**: List with emojis (multi-tenant, topics=sessions, images, GitHub links, etc)
- **Prerequisites**: Node.js 20+, Cloudflare account, Telegram Bot Token (via @BotFather), Jules API key
- **Installation**:
  - Clone repo
  - `npm install`
  - Configure wrangler.toml
  - Create KV namespace
- **Configuration**:
  - Environment variables (BOT_TOKEN via wrangler secret)
  - KV binding setup
  - Cron triggers configuration
- **Bot Setup** (README only):
  - How to create bot in @BotFather
  - How to get bot token
  - How to add bot to group
  - How to grant "Manage Topics" permission
  - How to get Jules API key at jules.google
- **Usage**:
  - Add bot to Telegram group
  - Use /set_jules_token to configure
  - Create topics to organize sessions
  - Send text messages or images
  - System works automatically (cron sends activities)
  - Use /open_jules_settings for advanced settings
- **Commands Reference**: Complete table with all commands and descriptions
- **Image Support**:
  - How to send images to Jules
  - Supported formats (jpg, png, webp)
  - Size limit (20MB)
  - Examples of prompts with images
- **Advanced Configuration**:
  - Setup Script, Environment Variables and Memories must be configured via web interface
  - Use /open_jules_settings for quick access
  - Direct link: https://jules.google/github/{user}/{repo}
- **Architecture**:
  - Flow diagram (Telegram → Worker → Jules API → Activities → Telegram)
  - Multi-tenant with per-group isolation
  - Cron for automatic activity polling
- **Development**:
  - `wrangler dev` for local development
  - `npm test` to run tests with Vitest
  - **Note: Don't use Docker** (Workers uses V8 Isolates, not containers)
- **Testing**:
  - How to run tests: `npm test`
  - Vitest with @cloudflare/vitest-pool-workers
  - Miniflare already included in Wrangler 2.0+
- **Deployment**:
  - `wrangler deploy`
  - Configure Telegram webhook
  - Monitor logs
- **API Limitations**:
  - Setup Script: web only
  - Environment Variables (per source): web only
  - Manual Memories: web only
  - Use /open_jules_settings to access web interface
- **Troubleshooting**:
  - Required permissions (admin + "Manage Topics")
  - Invalid/expired token
  - Session deleted on jules.google
  - Rate limiting
  - Images too large
  - Unsupported formats
  - Source not configured (required for /open_jules_settings)
- **Contributing**:
  - Code style: TypeScript, code in English, explanatory comments
  - PR process
  - Mandatory tests
- **License**: AGPLv3 with link to LICENSE file
- **Credits**: Grammy, Jules API, Cloudflare Workers, TypeScript

**Documentation:**

- https://grammy.dev
- https://developers.cloudflare.com/workers/
- https://jules.google

---

## 🐛 Known Issues and Debugging

### Bug Reports - Status: REPORTED

**Date:** 06/11/2025
**Conversation:** Continuation session needed

---

### Issue 1: `/list_sources` Infinite Loop ❌

**Status:** REPORTED - Still failing after all fixes
**Error:** Bot sends "🔄 Loading sources..." repeatedly in a loop

### Issue 2: `/new_session` INVALID_ARGUMENT Error ❌

**Status:** REPORTED - Still failing after multiple attempts
**Error:** `Jules API error (400): Request contains an invalid argument.`

---

### Detailed Analysis

#### Issue 2 - `/new_session` Failure Deep Dive

##### Error Message

```
Jules over Telegram, [06/11/2025 02:45]
❌ Failed to create session.

Error: Jules API error (400): {
  "error": {
    "code": 400,
    "message": "Request contains an invalid argument.",
    "status": "INVALID_ARGUMENT"
  }
}
```

##### Root Cause Investigation

**Initial Hypothesis:** automation_mode format issue

- Changed from `'AUTO_PR' | 'MANUAL'` to `'INTERACTIVE' | 'PLAN' | 'AUTO'`
- Updated to send numeric enums (1, 2, 3) to Jules API
- **Result:** FAILED - Same error persists

**Second Attempt:** Only send automation_mode when explicitly set

- Modified code to NOT send `automation_mode` field when null/undefined
- Let Jules API use its default
- **Result:** FAILED - Same error persists

**Code Applied:**

```typescript
// src/bot/commands/actionCommands.ts (lines 92-108)
const defaultBranch = await getDefaultBranch(ctx.env, groupId);
const automationMode = await getAutomationMode(ctx.env, groupId);
const requireApproval = await getRequireApproval(ctx.env, groupId);

const createParams: any = {
  prompt,
  source,
  requirePlanApproval: requireApproval,
  startingBranch: defaultBranch || undefined,
};

// Only add automationMode if explicitly configured
if (automationMode) {
  createParams.automationMode = automationMode;
}

const session = await julesClient.createSession(createParams);
```

**Third Attempt:** Remove ALL optional fields

- Tried sending only `prompt` and `source_context`
- **Result:** NOT TESTED YET

##### Jules API Schema (from src/jules/api.ts)

```typescript
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
}): Promise<JulesSession>

// Maps to body:
const body: any = {
  prompt: params.prompt,
  source_context: {
    source: params.source,
  },
};

// Only send automation_mode if explicitly specified
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
```

##### What Was Changed (Type System)

**All automation mode types updated:**

1. `src/types/env.ts` - SessionData, GroupConfig, JulesSession interfaces
2. `src/kv/storage.ts` - getAutomationMode(), setAutomationMode()
3. `src/bot/commands/actionCommands.ts` - `/new_session` command
4. `src/bot/commands/configCommands.ts` - `/set_auto_pr` command
5. `src/bot/commands/infoCommands.ts` - `/session_info` command
6. `src/bot/handlers/messageHandlers.ts` - Auto-create session (2 locations)
7. `src/utils/formatters.ts` - Status display

**Config Command Changes:**

- `on` → `'AUTO'` (was `'AUTO_PR'`)
- `off` → `'INTERACTIVE'` (was `'MANUAL'`)
- Messages updated accordingly

##### Debugging Data Needed

The user should provide:

1. What automation mode is configured? Run `/status`
2. What is the source? Run `/get_source`
3. What is default branch? Run `/status`
4. Are there any KV values set? Need to check KV namespace

---

### What Was Fixed ✅

#### 1. TypeScript Compilation Errors

- **Problem:** CI pipeline failing on "Run TypeScript type check"
- **Cause:** Type mismatch between `'AUTO_PR' | 'MANUAL'` and `'INTERACTIVE' | 'PLAN' | 'AUTO'`
- **Solution:** Updated all type references across 7 files
- **Status:** ✅ FIXED - All 40 tests pass

#### 2. Deployment Pipeline

- **Problem:** GitHub Actions CI failing
- **Cause:** TypeScript errors blocking merge
- **Solution:** Fixed all type mismatches
- **Status:** ✅ FIXED - Can deploy successfully

---

### Current Deployment State

**Worker URL:** https://jules-over-telegram.cloudatlas.workers.dev
**Current Version:** 4b92c9c3-769e-49d1-a85b-4cc1a55e2c79
**Deployment Time:** 06/11/2025 02:46
**Test Status:** ✅ All 40 tests passing
**TypeScript:** ✅ No compilation errors

---

### Next Debugging Steps (for continuation conversation)

#### Step 1: Test Minimal Request

Create a test that sends ONLY the required fields:

```typescript
// In actionCommands.ts line 96, replace with:
const session = await julesClient.createSession({
  prompt,
  source,
  // NO optional fields
});
```

#### Step 2: Check KV Values

Verify what values are actually stored in KV:

```bash
# Check automation mode
wrangler kv key get --binding=KV "group:{groupId}:automation_mode"

# Check require approval
wrangler kv key get --binding=KV "group:{groupId}:require_approval"

# Check default branch
wrangler kv key get --binding=KV "group:{groupId}:default_branch"
```

#### Step 3: Add Debug Logging

Add console.log to see what body is being sent:

```typescript
// In api.ts createSession(), before request:
console.log("Request body:", JSON.stringify(body, null, 2));
```

#### Step 4: Check Jules API Documentation

Look at actual API documentation to verify correct schema:

- URL: https://developers.google.com/jules/api/reference/rest/v1alpha/sessions

#### Step 5: Verify Source Format

Check if source format is correct:

- Current: `sources/github/insign/1kb.club`
- Is this the correct format?
- Should it be just `github/insign/1kb.club`?

---

### File Changes Summary

#### Modified Files (automation mode fix)

1. `src/types/env.ts` - Updated interface types
2. `src/kv/storage.ts` - Updated function signatures
3. `src/bot/commands/actionCommands.ts` - Added conditional automation_mode
4. `src/bot/commands/configCommands.ts` - Changed on/off mapping
5. `src/bot/commands/infoCommands.ts` - Updated display text
6. `src/bot/handlers/messageHandlers.ts` - Added conditional automation_mode (2 places)
7. `src/utils/formatters.ts` - Updated display text

#### Cache Implementation (already exists)

- `src/kv/storage.ts` - Cache functions with 5-minute TTL
- `src/bot/commands/infoCommands.ts` - handleListSources uses cache
- `src/bot/handlers/callbackHandlers.ts` - Pagination with inline keyboards

---

### Jules API Reference

#### Official Documentation

- Base URL: https://jules.googleapis.com/v1alpha
- Sessions: https://developers.google.com/jules/api/reference/rest/v1alpha/sessions
- Sources: https://developers.google.com/jules/api/reference/rest/v1alpha/sources

#### API Endpoints Used

1. `GET /sessions` - List sessions
2. `POST /sessions` - Create session ⭐ (failing)
3. `GET /sessions/{id}` - Get session
4. `POST /sessions/{id}:approvePlan` - Approve plan
5. `GET /sources` - List sources
6. `GET /activities` - List activities

#### Authentication

- Header: `X-Goog-Api-Key: {token}`
- ❌ NOT using Bearer token

---

### Commands Reference

#### Working Commands ✅

- `/start` - Bot introduction
- `/help` - Show available commands
- `/status` - Show group configuration
- `/get_source` - Show configured source
- `/list_sources` - List available sources (but may loop)
- `/set_jules_token <token>` - Set Jules API token
- `/set_source <source>` - Set default source
- `/list_sessions` - List active sessions

#### Failing Commands ❌

- `/new_session <prompt>` - Create new session (INVALID_ARGUMENT)
- `/session_info` - Show session details (depends on new_session working)

---

### Testing Commands (for user to run)

Run these in Telegram bot and report results:

1. `/status` - What automation mode is shown?
2. `/get_source` - What source is configured?
3. `/list_sources` - Does it loop or work?
4. `/new_session test` - Does it still fail with INVALID_ARGUMENT?

---

### CI/CD Pipeline

#### GitHub Actions Workflows

- `.github/workflows/ci.yml` - Lint, Type Check, Tests ✅
- `.github/workflows/deploy.yml` - Deploy to Cloudflare ✅
- `.github/workflows/codeql.yml` - Security analysis ✅

#### Status

- **CI:** ✅ Passing (after type fixes)
- **Deploy:** ✅ Passing
- **Type Check:** ✅ Passing (40/40 tests)

---

### Cron Jobs

Configured in `wrangler.toml`:

- `*/1 * * * *` - Poll activities every minute
- `*/15 * * * *` - Sync sessions every 15 minutes

---

### Key Decisions Made

1. **Cache TTL:** 5 minutes (reduced from 1 hour) - User feedback
2. **Pagination:** Inline keyboard with page:index pattern
3. **Automation Modes:** INTERACTIVE (default), PLAN, AUTO
4. **Config Command:** on=AUTO, off=INTERACTIVE
5. **API Schema:** Numeric enums (1,2,3) for automation_mode

---

### Unresolved Questions

1. Why does Jules API reject the request even without automation_mode?
2. Is the source format correct? `sources/github/user/repo` or `github/user/repo`?
3. What is the exact minimum required fields for createSession?
4. Does Jules API require any specific field ordering?
5. Are there any hidden required fields we're missing?

---

### Continuation Instructions

When starting new conversation, reference this file and:

1. Start from "Next Debugging Steps" section
2. Try Step 1 (minimal request) first
3. Add debug logging to see actual request body
4. Verify Jules API documentation for correct schema
5. Check KV values to see what user has configured

---

## 📚 Additional Resources

### External Documentation Links

- [Grammy Documentation](https://grammy.dev)
- [Cloudflare Workers Documentation](https://developers.cloudflare.com/workers/)
- [Jules API Documentation](https://developers.google.com/jules/api)
- [Telegram Bot API](https://core.telegram.org/bots/api)
- [Vitest Documentation](https://vitest.dev)

### Project-Specific Resources

- [GitHub Repository](https://github.com/your-org/jot)
- [Issue Tracker](https://github.com/your-org/jot/issues)
- [Cloudflare Workers Dashboard](https://dash.cloudflare.com/)
- [Jules Console](https://jules.google)

---

**Last Updated:** 2025-11-17
**Document Version:** 1.0.0
**License:** AGPL-3.0-or-later
