# Jules over Telegram (jot) Bot

This is a Telegram bot that acts as a frontend for the Jules API, built with TypeScript, the Grammy framework, and deployed on Cloudflare Workers.

## Features

- Multi-tenant architecture with data isolation between Telegram groups.
- 1:1 mapping of Telegram topics to Jules sessions.
- Session creation from both text and image messages.
- Automated activity polling to fetch updates from the Jules API.
- Rich formatting for activities, including expandable blockquotes.
- Interactive components like inline keyboards for user actions.

## Prerequisites

- Node.js 20+
- A Cloudflare account
- A Telegram Bot Token (obtained from @BotFather)
- A Jules API key

## Installation

1. Clone the repository.
2. Run `npm install` to install the dependencies.
3. Configure `wrangler.jsonc`.

## Configuration

### `wrangler.jsonc`

You need to create a KV namespace in your Cloudflare account and then update the `wrangler.jsonc` file with the correct `id` and `preview_id` for the `JOT_KV` binding.

### `.dev.vars`

For local development with `wrangler dev`, create a `.dev.vars` file in the root of the project with the following content:

```
BOT_TOKEN="your-telegram-bot-token"
```

### Bot Setup

1. Create a new bot with @BotFather on Telegram to get your `BOT_TOKEN`.
2. Add the bot to your Telegram group.
3. Grant the bot "Manage Topics" permission.
4. Use the `/set_jules_token` command in your group to set your Jules API key.
5. Use the `/set_source` command to set the default source for new sessions.

## Usage

- Create a new topic in your Telegram group to start a new Jules session.
- Send a text message or an image with a caption to begin.
- Use the inline keyboards to interact with the bot (e.g., approve plans, publish branches).
- Use the `/open_jules_settings` command to access advanced settings for your source on the Jules website.

## Development

- Run `npm run dev` to start the local development server.
- Run `npm test` to run the test suite.

## Deployment

- Run `npm run deploy` to deploy the worker to your Cloudflare account.
- Set the `BOT_TOKEN` secret with `wrangler secret put BOT_TOKEN`.
- Set up the Telegram webhook by calling the `setWebhook` method of the Telegram Bot API, pointing it to your worker's URL.
