/**
 * Type definitions for Obsidian Weaklog Processor
 *
 * This file contains all TypeScript interfaces and types used throughout the plugin.
 * Defines the core data structures for the 5-step weaklog workflow:
 * Raw → Cooling → Triage → Synthesis → Publishing
 */

// ============================================================================
// LLM Provider Types
// ============================================================================

/**
 * Supported LLM provider types
 * Determines which AI service to use for triage and synthesis
 */
export type LLMProviderType =
  | 'anthropic'  // Anthropic Claude (cloud)
  | 'openai'     // OpenAI GPT (cloud)
  | 'gemini'     // Google Gemini (cloud)
  | 'ollama';    // Ollama (local)

/**
 * Supported response languages
 * Determines the language of LLM responses
 */
export type ResponseLanguage =
  | 'english'    // English
  | 'japanese';  // 日本語

// ============================================================================
// Workflow Status Types
// ============================================================================

/**
 * Status progression through the weaklog workflow
 */
export type WeaklogStatus =
  | 'raw'              // Step 1: Initial capture
  | 'cooling'          // Step 2: Time-based waiting period
  | 'ready-for-triage' // Step 2: Cooling complete, ready for evaluation
  | 'triaged'          // Step 3: AI evaluation complete, approved
  | 'synthesized'      // Step 4: Transformed into transferable content
  | 'published';       // Step 5: Final, ready to share

// ============================================================================
// Triage Types (Step 3)
// ============================================================================

/**
 * Result of a single triage criterion evaluation
 */
export interface CheckResult {
  /** Whether this criterion passed evaluation */
  pass: boolean;

  /** Brief explanation (1-2 sentences, ~30 chars) */
  reason: string;
}

/**
 * Complete AI triage evaluation result
 * Evaluates entry against 4 criteria for creative potential
 */
export interface TriageResult {
  /** Four evaluation criteria with pass/fail and reasons */
  checks: {
    /** Has concrete situations/experiences (not just abstract feelings) */
    hasSpecifics: CheckResult;

    /** Can be condensed to one essential question (<40 chars) */
    canBeCorePhrase: CheckResult;

    /** Universal relevance (not overly personal/niche) */
    isTransferable: CheckResult;

    /** Constructive and safe for readers (not harmful) */
    isNonHarmful: CheckResult;
  };

  /** Score: 0-4 (count of passed checks) */
  score: number;

  /** Recommendation based on score: 4=adopt, 2-3=review, 0-1=reject */
  recommendation: 'adopt' | 'review' | 'reject';

  /** Essential question distilled from entry (max 40 chars) */
  coreQuestion: string;

  /** ISO 8601 timestamp of analysis */
  timestamp: string;
}

// ============================================================================
// Synthesis Types (Step 4)
// ============================================================================

/**
 * AI-generated guidance for synthesis (transformation)
 * Provides questions to deepen and universalize content
 */
export interface SynthesisGuide {
  /** 3-5 questions to guide transformation */
  questions: string[];

  /** Suggested tone for final work (e.g., "reflective", "analytical") */
  suggestedTone: string;

  /** ISO 8601 timestamp of generation */
  timestamp: string;
}

// ============================================================================
// Main Entry Type
// ============================================================================

/**
 * Complete weaklog entry data structure
 * Contains all metadata and results throughout the workflow
 */
export interface WeaklogEntry {
  /** Unique identifier: YYYY-MM-DD_NNN format (e.g., "2026-01-27_001") */
  id: string;

  /** Raw user content (unmodified) */
  content: string;

  /** ISO 8601 timestamp of creation */
  createdAt: string;

  /** Number of days for cooling period (user-configured or default) */
  cooldownDays: number;

  /** Current workflow status */
  status: WeaklogStatus;

  /** Triage evaluation result (populated after Step 3) */
  triageResult?: TriageResult;

  /** Synthesis guidance (populated after Step 4) */
  synthesisGuide?: SynthesisGuide;
}

// ============================================================================
// Plugin Settings Types
// ============================================================================

/**
 * Plugin configuration stored in data.json
 * Note: API key may be stored here (with security warnings) or in SecretStorage
 */
export interface WeaklogSettings {
  /**
   * Anthropic API key (optional, may be in environment variable or SecretStorage)
   * @security Stored unencrypted in data.json - recommend environment variable
   * @deprecated Use provider-specific keys (anthropicApiKey, openaiApiKey, etc.)
   */
  apiKey: string;

  /** Default cooldown period in days (1-365) */
  defaultCooldownDays: number;

  /** Vault folder path for weaklog files (default: "Weaklog") */
  weaklogFolderPath: string;

  /** Claude model to use (default: "claude-3-5-sonnet-20241022") */
  model: string;

  /** Temperature for triage (0.0-1.0, default: 0.3 for objectivity) */
  triageTemperature: number;

  /** Temperature for synthesis (0.0-1.0, default: 0.7 for creativity) */
  synthesisTemperature: number;

  /** Response language for LLM outputs (default: 'english') */
  responseLanguage: ResponseLanguage;

  // ========================================================================
  // Multi-Provider Settings
  // ========================================================================

  /** Selected LLM provider (default: 'anthropic') */
  llmProvider: LLMProviderType;

  /** Anthropic API key (for backward compatibility with apiKey) */
  anthropicApiKey?: string;

  /** OpenAI API key */
  openaiApiKey?: string;

  /** Google Gemini API key */
  geminiApiKey?: string;

  /** Ollama server endpoint (default: 'http://localhost:11434') */
  ollamaEndpoint?: string;
}

// ============================================================================
// Cooldown Tracking Types
// ============================================================================

/**
 * Single entry in cooldown tracking
 * Stored in .cooldown.json for temporal workflow management
 */
export interface CooldownEntry {
  /** Weaklog ID (matches file basename) */
  weaklogId: string;

  /** Relative path from vault root to file */
  filePath: string;

  /** ISO 8601 timestamp when entry was created */
  createdAt: string;

  /** Number of cooldown days configured for this entry */
  cooldownDays: number;

  /** ISO 8601 timestamp when entry becomes ready for triage */
  readyAt: string;
}

/**
 * Complete cooldown tracking data structure
 * Stored in Weaklog/02_Cooling/.cooldown.json
 */
export interface CooldownData {
  /** Array of entries currently in cooling period */
  entries: CooldownEntry[];

  /** ISO 8601 timestamp of last cooldown check */
  lastChecked: string;
}

// ============================================================================
// Utility Types
// ============================================================================

/**
 * Security storage method for API key
 * Used for display and logging purposes
 */
export type SecurityStorageMethod =
  | 'environment'  // Environment variable (most secure)
  | 'secret'       // Obsidian SecretStorage API
  | 'data';        // Unencrypted data.json (least secure)

/**
 * LLM API call options
 */
export interface LLMCallOptions {
  /** Temperature (0.0-1.0) */
  temperature?: number;

  /** Maximum tokens to generate */
  maxTokens?: number;

  /** Timeout in milliseconds */
  timeoutMs?: number;
}
