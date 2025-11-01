# Project Roadmap: Jules over Telegram (jot)

This document outlines the implementation status of the features described in the original project plan.

---

## ✅ Implemented Features

The following features form the core functional foundation of the bot and are considered complete.

-   **1. Initial Project Setup:**
    -   Cloudflare Worker project created with TypeScript, Grammy, and Wrangler.
-   **2. Bot Configuration:**
    -   Core bot instance, webhook handler, and cron trigger (`scheduled`) are implemented.
-   **3. KV Namespace for Multi-Tenancy:**
    -   Multi-tenant KV storage is implemented with helper functions that ensure data isolation between Telegram groups.
-   **4. Authentication and Admin Control:**
    -   `/set_jules_token` command allows admins to configure the bot for their group.
    -   `/status` command reports the current configuration.
-   **5. 1:1 Topic-Session Management:**
    -   The bot correctly maps one Telegram topic to one Jules session, storing session data in KV.
-   **6. Jules API Integration (Sources):**
    -   Commands `/list_sources`, `/set_source`, and `/get_source` are functional.
-   **7. Jules API Integration (Session Creation):**
    -   New sessions are correctly created via the API when a user sends the first message in a new topic.
-   **8. "Typing..." Status Indicator:**
    -   The `sendChatAction('typing')` indicator is used before making API calls.
-   **10. Activity Polling via Cron Trigger:**
    -   The 1-minute cron job is configured and correctly polls for new activities for all active sessions.
-   **11. Core Activity Processing:**
    -   The bot processes key activities like `planGenerated`, `progressUpdated`, and `sessionCompleted`.
    -   Rich formatting, including **expandable blockquotes** for long content, is implemented.
-   **12. Publish Button Handlers:**
    -   The inline buttons for "📦 Publish branch" and "🔀 Publish PR" are functional and update the message with the resulting GitHub link.
-   **13. Image Support:**
    -   The bot can receive images, convert them to base64, and use them to create or continue sessions.
-   **17. Delete Session Command:**
    -   The `/delete_session` command with an inline confirmation button is implemented.
-   **18. Plan Approval:**
    -   The `/approve_plan` command and the inline "✅ Approve Plan" button are functional.
-   **19. Continuous Conversation:**
    -   Follow-up text and image messages sent in a topic are correctly added to the existing Jules session.
-   **22. Jules Settings Command:**
    -   The `/open_jules_settings` command correctly parses the source and generates a direct link to the Jules website.
-   **23. Core Command System:**
    -   Most of the planned commands have been implemented.
-   **28. Testing:**
    -   A comprehensive test suite using Vitest has been created, covering the backend logic in `kv.ts`, `jules.ts`, and `activities.ts`.

---

## ⏳ Pending Features & Refinements

The following features from the original plan are not yet implemented or require further refinement.

-   **9. Smart Notification System:**
    -   **Status:** Partially Implemented.
    -   **Details:** While basic notifications are sent, the fine-grained logic for sending **silent** vs. **sound** notifications based on specific activity content (e.g., a `bashOutput` with a `exitCode !== 0` getting a sound notification) has not been implemented.
-   **15. Session Synchronization via Cron:**
    -   **Status:** Partially Implemented.
    -   **Details:** The 15-minute cron job is configured, but the logic to get a list of *all* configured group IDs has a placeholder. This needs to be implemented for the sync to work globally.
-   **16. Manual Synchronization Command:**
    -   **Status:** Implemented.
-   **21. GitHub Link Extraction Utility:**
    -   **Status:** Partially Implemented.
    -   **Details:** While the publish buttons format their own links, a generic `extractGitHubLinks` function to parse *all* types of outputs (PRs, branches, commits) for display with commands like `/show_outputs` is still needed.
-   **23. Remaining Commands:**
    -   **Status:** Not Implemented.
    -   **Details:** The following commands are still missing:
        -   `/list_sessions`, `/session_info`, `/show_plan`, `/show_outputs`
        -   `/set_branch`, `/set_auto_pr`, `/require_approval`
        -   A comprehensive `/help` command (current one is a placeholder).
-   **24. General Chat Guidance:**
    -   **Status:** Not Implemented.
    -   **Details:** The bot does not yet guide users in the main group chat (non-topic messages) to use topics for starting sessions.
-   **27. Advanced Error Handling:**
    -   **Status:** Partially Implemented.
    -   **Details:** The API client includes a retry mechanism, but the user-facing error messages in the bot could be more specific (e.g., telling an admin their token is invalid vs. a generic API error).
-   **28. Integration Test Fixes:**
    -   **Status:** Not Implemented.
    -   **Details:** The integration tests for the command handlers (`index.spec.ts`) are currently failing and need to be fixed to ensure full test coverage.
-   **30. Optimizations:**
    -   **Status:** Not Implemented.
    -   **Details:** Advanced performance optimizations like in-memory caching or using Durable Objects have not been implemented.
