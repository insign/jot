# Jot - Telegram Interface for Jules

[![License: AGPL v3](https://img.shields.io/badge/License-AGPL%20v3-blue.svg)](https://www.gnu.org/licenses/agpl-3.0)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue)](https://www.typescriptlang.org/)
[![Cloudflare Workers](https://img.shields.io/badge/Cloudflare-Workers-orange)](https://workers.cloudflare.com/)

A powerful Telegram bot that provides a seamless interface to Jules (Google's AI coding assistant), built with Grammy and deployed on Cloudflare Workers.

## Overview

Jot bridges the gap between Telegram and Jules, allowing you to interact with Jules directly from your Telegram groups. Each Telegram topic (forum thread) maps 1:1 to a Jules session, providing organized, isolated workspaces for different coding tasks.

The bot automatically polls for updates from Jules and sends them to your Telegram group, so you never miss a beat. It supports text prompts, images (screenshots, designs, diagrams), and provides smart notifications with GitHub link extraction.

## Features

- 🏢 **Multi-tenant Architecture** - Each Telegram group has isolated configuration and sessions
- 🎯 **1:1 Topic-Session Mapping** - Each Telegram topic = one Jules session for perfect organization
- 🔄 **Automatic Activity Polling** - Updates arrive automatically via cron triggers (no manual polling needed!)
- 📸 **Image Support** - Send screenshots, designs, or diagrams directly to Jules
- 🔔 **Smart Notifications** - Important events (plan generated, ready for review, errors) with sound, routine updates are silent
- 🔗 **GitHub Integration** - Automatic extraction and formatting of PR links, branches, and commits
- 💬 **Expandable Blockquotes** - Long outputs (bash, file lists) use Telegram's expandable format for better UX
- ⚡ **Plan Approval System** - Review and approve plans before execution with inline buttons
- 🎨 **Rich Formatting** - HTML formatting with emojis, bold text, code blocks, and clickable links
- 🌐 **Web Settings Access** - Quick access to Jules web interface for advanced configuration

## Architecture

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

## Prerequisites

- Node.js 20+ and npm
- Cloudflare account (Free tier works, Paid tier required for cron triggers)
- Telegram Bot Token (from [@BotFather](https://t.me/BotFather))
- Jules API key (from [jules.google](https://jules.google))

## Installation

1. **Clone the repository**

```bash
git clone https://github.com/yourusername/jot.git
cd jot
```

2. **Install dependencies**

```bash
npm install
```

3. **Install Wrangler CLI globally (optional but recommended)**

```bash
npm install -g wrangler
```

4. **Create KV namespaces**

```bash
# Create production KV namespace
wrangler kv:namespace create "KV"

# Create preview KV namespace for development
wrangler kv:namespace create "KV" --preview
```

Copy the namespace IDs from the output and update `wrangler.toml`:

```toml
[[kv_namespaces]]
binding = "KV"
id = "your_kv_namespace_id_here"
preview_id = "your_preview_kv_namespace_id_here"
```

5. **Configure secrets**

```bash
# Set your Telegram Bot Token
wrangler secret put BOT_TOKEN
```

When prompted, paste your bot token from @BotFather.

## Bot Setup

### Creating Your Telegram Bot

1. Open Telegram and search for [@BotFather](https://t.me/BotFather)
2. Send `/newbot` and follow the instructions
3. Choose a name and username for your bot
4. Save the bot token (you'll need it for `wrangler secret put BOT_TOKEN`)
5. **Important**: Send `/setprivacy` to @BotFather, select your bot, and choose "Disable" to allow the bot to read all messages in groups

### Adding Bot to Group

1. Create or open a Telegram group
2. **Enable Topics (Forums)**: Group Settings → Topics → Enable
3. Add your bot to the group
4. Make the bot an admin with these permissions:
   - ✅ Delete Messages
   - ✅ Manage Topics (required for updating topic names)
   - ✅ Post Messages
5. The bot is now ready to use!

### Getting Jules API Key

1. Visit [jules.google](https://jules.google)
2. Sign in with your Google account
3. Connect your GitHub repositories
4. Generate an API key from your account settings
5. Use `/set_jules_token <token>` in your Telegram group to configure it

## Usage

### Initial Configuration

1. **Set Jules Token** (Admin only)
```
/set_jules_token YOUR_API_KEY_HERE
```

2. **List Available Sources**
```
/list_sources
```

3. **Set Default Source**
```
/set_source sources/github/username/repository
```

4. **Optional Configuration**
```
/set_branch main              # Set default starting branch
/set_auto_pr on               # Enable automatic PR creation
/require_approval on          # Require plan approval before execution
```

### Working with Sessions

1. **Create a topic** in your Telegram group (any name)

2. **Send your request** in the topic:
   - Text: `Add a dark mode toggle to the settings page`
   - Image: Upload a screenshot with caption `Implement this design`

3. **Automatic updates**: The bot will automatically send you updates as Jules works on your request

4. **Approve plans** (if enabled): Click the "✅ Approve Plan" button when a plan is generated

5. **Publish changes**: When ready for review, click "📦 Publish Branch" or "🔀 Publish PR"

### Continuous Conversation

You can continue the conversation in any topic that has an active session:
- Send text messages to ask questions or provide feedback
- Send images for additional context
- The bot will forward everything to Jules and send you the responses

## Commands Reference

### Basic Commands

| Command | Description |
|---------|-------------|
| `/start` | Show welcome message with setup instructions |
| `/help` | Display complete command reference |

### Configuration (Admin Only)

| Command | Description |
|---------|-------------|
| `/set_jules_token <token>` | Configure Jules API token for the group |
| `/set_source <source>` | Set default repository source |
| `/set_branch <branch>` | Set default starting branch (default: main) |
| `/set_auto_pr <on\|off>` | Enable/disable automatic PR creation |
| `/require_approval <on\|off>` | Require plan approval before execution |

### Information

| Command | Description |
|---------|-------------|
| `/status` | Show group configuration and statistics |
| `/get_source` | Display currently configured source |
| `/list_sources` | List all available repositories from Jules |
| `/list_sessions` | List all active sessions in the group |
| `/session_info` | Show details of current session (use in topic) |
| `/list_activities` | Show activities for current session (use in topic) |
| `/show_plan` | Display plan for current session (use in topic) |
| `/show_outputs` | Show outputs (PR, branch, commits) for current session |
| `/open_jules_settings` | Open Jules web interface for advanced settings |

### Actions

| Command | Description |
|---------|-------------|
| `/new_session <prompt>` | Create new session in current topic with prompt |
| `/approve_plan` | Approve pending plan (use in topic) |
| `/delete_session` | Delete current session (Admin only, use in topic) |
| `/sync` | Manually sync sessions with Jules API (Admin only) |

## Image Support

Jot supports sending images to Jules for analysis and implementation:

### Supported Formats
- JPG/JPEG
- PNG
- WebP
- GIF

### Size Limit
- Maximum: 20MB per image

### Usage Examples

1. **Design Implementation**
   - Upload a design mockup
   - Caption: "Implement this login page design"

2. **Bug Reports**
   - Screenshot of an error
   - Caption: "Fix this error in the checkout flow"

3. **Diagram Analysis**
   - Architecture diagram
   - Caption: "Implement this database schema"

## Advanced Configuration

Some Jules features can only be configured via the web interface:

### Setup Script
- Define commands to run before each session
- Example: Install dependencies, set up environment

### Environment Variables
- Configure per-repository environment variables
- Securely store API keys, database URLs, etc.

### Memories (Knowledge Base)
- Add project-specific knowledge for Jules to use
- Example: Architecture decisions, coding standards, deployment procedures

**Access via**: `/open_jules_settings` command or visit `https://jules.google/github/owner/repo`

## Development

### Local Development

```bash
# Start local development server
npm run dev

# Or with wrangler directly
wrangler dev
```

The development server will run at `http://localhost:8787`.

**Note**: Cron triggers don't run in development mode. You'll need to test cron functionality in a deployed environment.

### Testing

```bash
# Run tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage
```

Tests are written using Vitest with `@cloudflare/vitest-pool-workers` for Worker-specific testing.

### Type Generation

```bash
# Generate TypeScript types from wrangler.toml
npm run cf-typegen
```

## Deployment

### Deploy to Cloudflare Workers

```bash
# Deploy to production
npm run deploy

# Or with wrangler directly
wrangler deploy
```

### Set Up Telegram Webhook

After deploying, configure the Telegram webhook:

```bash
curl "https://api.telegram.org/bot<YOUR_BOT_TOKEN>/setWebhook?url=https://jules-over-telegram.cloudatlas.workers.dev/webhook"
```

Replace:
- `<YOUR_BOT_TOKEN>` with your bot token from @BotFather
- Or use custom domain: `jot.helio.me/webhook` (configure in Cloudflare DNS)

### Verify Webhook

```bash
curl "https://api.telegram.org/bot<YOUR_BOT_TOKEN>/getWebhookInfo"
```

You should see `"url": "https://jules-over-telegram.cloudatlas.workers.dev/webhook"` or `"url": "https://jot.helio.me/webhook"` in the response.

### Cron Triggers

Cron triggers are configured in `wrangler.toml`:

```toml
[triggers]
crons = [
  "*/1 * * * *",   # Poll activities every 1 minute
  "*/15 * * * *"   # Sync sessions every 15 minutes
]
```

**Note**: Cron triggers require a Cloudflare Workers Paid plan ($5/month).

## API Limitations

Some features are only available via the Jules web interface, not through the API:

| Feature | API Support | Web Interface |
|---------|-------------|---------------|
| Setup Script | ❌ No | ✅ Yes |
| Environment Variables (per repo) | ❌ No | ✅ Yes |
| Manual Memories | ❌ No | ✅ Yes |
| Session Creation | ✅ Yes | ✅ Yes |
| Send Messages | ✅ Yes | ✅ Yes |
| List Activities | ✅ Yes | ✅ Yes |
| Approve Plans | ✅ Yes | ✅ Yes |

Use `/open_jules_settings` to quickly access the web interface for these features.

## Troubleshooting

### Bot Not Responding

**Check bot permissions:**
- Bot must be admin in the group
- Bot must have "Manage Topics" permission
- Bot must have privacy mode disabled (@BotFather → /setprivacy → Disable)

### "Token not configured" Error

**Solution:**
```
/set_jules_token YOUR_API_KEY
```

Only group admins can configure the token.

### Session Deleted in jules.google

**Symptom**: Bot shows session but Jules API returns 404

**Solution**: Use `/sync` to synchronize with Jules API, or `/delete_session` to remove locally

### Rate Limiting

**Symptom**: Frequent API errors, delayed responses

**Solution**:
- Reduce number of active sessions
- Wait a few minutes before retrying
- Contact Jules support if persistent

### Images Not Working

**Check:**
- Image size < 20MB
- Format is JPG, PNG, WebP, or GIF
- Bot has permission to access messages

### Source Not Configured for /open_jules_settings

**Solution**:
```
/list_sources
/set_source sources/github/username/repo
/open_jules_settings
```

## Contributing

Contributions are welcome! Here's how to contribute:

### Code Style

- **Language**: TypeScript
- **Code**: English (variables, functions, comments)
- **Comments**: Explain important decisions and "why", not "what"
- **Formatting**: Use Prettier (if configured) or match existing style

### Submitting Changes

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes with clear commit messages
4. Add tests for new functionality
5. Ensure all tests pass (`npm test`)
6. Push to your fork
7. Open a Pull Request

### Testing Requirements

- All new features must have tests
- Tests must pass before PR is merged
- Aim for >80% code coverage

## CI/CD Pipeline

This project uses GitHub Actions for continuous integration and deployment.

### Automated Workflows

| Workflow | Trigger | Purpose |
|----------|---------|---------|
| **CI** | Push, PR | Runs tests, type checking, and build verification |
| **Deploy** | Push to main/develop | Automatic deployment to Cloudflare Workers |
| **PR Lint** | Pull requests | Validates PR format, size, and adds labels |
| **CodeQL** | Push, PR, Weekly | Security analysis and vulnerability detection |
| **Release** | Version tags (v*.*.*) | Creates GitHub releases with changelog |
| **Performance** | Pull requests | Monitors bundle size and test performance |
| **Dependabot** | Scheduled | Automated dependency updates |

### Deployment Strategy

- **Production** (`main` branch)
  - Automatic deployment to `jules-over-telegram.cloudatlas.workers.dev`
  - Sets Telegram webhook automatically
  - Runs health checks post-deployment
  - Custom domain: `jot.helio.me` (configure in Cloudflare DNS)

- **Development** (`develop` branch)
  - Automatic deployment to preview URL (`*-jules-over-telegram.cloudatlas.workers.dev`)
  - Uses preview KV namespace
  - Uses preview bot token

### Required Secrets

Configure these in GitHub repository settings:

```
CLOUDFLARE_API_TOKEN      # Cloudflare API token
CLOUDFLARE_ACCOUNT_ID     # Cloudflare account ID
BOT_TOKEN                 # Production Telegram bot token
BOT_TOKEN_PREVIEW        # Preview bot token for development
```

### Creating a Release

```bash
# Tag the commit with semantic version
git tag v1.0.0

# Push the tag to trigger release workflow
git push origin v1.0.0
```

The release workflow will:
- Run all tests
- Generate changelog from commits
- Create GitHub release
- Attach release notes

See [`.github/README.md`](.github/README.md) for detailed CI/CD documentation.

## License

This project is licensed under the **GNU Affero General Public License v3.0 or later** (AGPL-3.0-or-later).

This means:
- ✅ You can use, modify, and distribute this software
- ✅ You must provide source code when distributing
- ✅ You must license derivatives under AGPL-3.0
- ⚠️ **Network use = distribution**: If you run a modified version on a server, you must make your source code available to users

See [LICENSE](LICENSE) file for full details.

## Credits

Built with:
- [Grammy](https://grammy.dev) - Telegram Bot Framework
- [Jules API](https://developers.google.com/jules) - Google's AI Coding Assistant
- [Cloudflare Workers](https://workers.cloudflare.com/) - Serverless Compute Platform
- [TypeScript](https://www.typescriptlang.org/) - Programming Language
- [Vitest](https://vitest.dev) - Testing Framework

## Support

- 📚 [Jules Documentation](https://developers.google.com/jules)
- 💬 [Grammy Documentation](https://grammy.dev)
- 🔧 [Cloudflare Workers Docs](https://developers.cloudflare.com/workers/)

## Roadmap

- [ ] Durable Objects for real-time typing indicators
- [ ] Better session indexing (reverse mapping for faster lookups)
- [ ] Group tracking in KV for cron efficiency
- [ ] Retry logic for failed activity notifications
- [ ] Rich plan visualization with step-by-step breakdown
- [ ] Session templates (predefined prompts)
- [ ] Usage analytics per group
- [ ] Multi-language support for bot messages

---

Made with ❤️ for developers who want to bring Jules to Telegram
