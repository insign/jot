/**
 * Environment bindings for Cloudflare Worker
 * This interface defines all the bindings available in the worker environment
 */
export interface Env {
  // KV Namespace for multi-tenant storage
  KV: KVNamespace;

  // Bot token from Telegram (@BotFather)
  BOT_TOKEN: string;

  // Environment name (development, production)
  ENVIRONMENT?: string;
}

/**
 * Session data structure stored in KV
 * Maps 1:1 with a Telegram topic and a Jules session
 */
export interface SessionData {
  session_id: string;
  group_id: string;
  topic_id: number;
  source: string;
  automation_mode?: 'INTERACTIVE' | 'PLAN' | 'AUTO';
  require_plan_approval?: boolean;
  starting_branch?: string;
  last_activity_id?: string;
  last_activity_time?: string;
  status?: string;
  pending_plan?: boolean;
  ready_for_review?: boolean;
  created_at: string;
  updated_at: string;
}

/**
 * Group configuration structure
 * Stores per-group settings
 */
export interface GroupConfig {
  jules_token: string;
  source?: string;
  default_branch?: string;
  automation_mode?: 'INTERACTIVE' | 'PLAN' | 'AUTO';
  require_approval?: boolean;
  sessions_index?: string[]; // Array of session_ids
}

/**
 * Jules API Activity structure
 * Based on Jules API documentation
 */
export interface JulesActivity {
  name: string;
  createTime: string;
  updateTime: string;
  title?: string;
  description?: string;
  artifacts?: {
    bashOutput?: {
      command?: string;
      output?: string;
      exitCode?: number;
    };
    changeSet?: {
      gitPatch?: {
        unidiffPatch?: string;
      };
      files?: Array<{
        path?: string;
        changeType?: string;
      }>;
    };
    media?: {
      data?: string;
      mediaType?: string;
    };
  };
}

/**
 * Jules API Session structure
 */
export interface JulesSession {
  name: string;
  source: string;
  prompt: string;
  state?: string;
  automationMode?: 'INTERACTIVE' | 'PLAN' | 'AUTO';
  requirePlanApproval?: boolean;
  startingBranch?: string;
  outputs?: string;
  createTime: string;
  updateTime: string;
}

/**
 * Jules API Source structure
 */
export interface JulesSource {
  name: string;
  displayName: string;
  description?: string;
  repository?: {
    owner?: string;
    name?: string;
  };
}
