/**
 * ILLMProvider - Common interface for all LLM providers
 *
 * Defines standard contract for LLM communication:
 * - Initialization with credentials
 * - API calls with retry logic
 * - Connection testing
 * - Model enumeration
 *
 * Supported providers:
 * - Anthropic (Claude)
 * - OpenAI (GPT)
 * - Google (Gemini)
 * - Ollama (Local models)
 * - LLama.cpp (Local server)
 */

import { LLMCallOptions } from '../../types';

/**
 * LLM Provider Interface
 * All providers must implement this contract
 */
export interface ILLMProvider {
  /**
   * Initialize the provider client
   * Called before making API requests
   *
   * @throws Error if initialization fails
   */
  initialize(): void;

  /**
   * Call LLM API with system and user prompts
   * Implements retry logic and error handling
   *
   * @param systemPrompt - System instruction for LLM
   * @param userPrompt - User message content
   * @param options - Temperature, max tokens, timeout
   * @returns LLM response text
   * @throws Error with user-friendly message on failure
   */
  callAPI(
    systemPrompt: string,
    userPrompt: string,
    options?: LLMCallOptions
  ): Promise<string>;

  /**
   * Test API connection
   * Makes minimal request to validate credentials
   *
   * @returns true if connection successful
   * @throws Error with user-friendly message if failed
   */
  testConnection(): Promise<boolean>;

  /**
   * Get list of available models for this provider
   * May return static list or fetch dynamically
   *
   * @returns Array of model identifiers
   */
  getAvailableModels(): string[] | Promise<string[]>;

  /**
   * Check if client is initialized
   * @returns true if ready to use
   */
  isInitialized(): boolean;

  /**
   * Get current model identifier
   * @returns Model name/ID
   */
  getModel(): string;

  /**
   * Update model to use
   * @param model - New model identifier
   */
  setModel(model: string): void;
}

/**
 * Provider configuration interface
 * Used to create provider instances
 */
export interface ProviderConfig {
  /** API key (required for cloud providers) */
  apiKey?: string;

  /** Model identifier */
  model: string;

  /** Custom endpoint URL (for Ollama/LlamaCpp) */
  endpoint?: string;

  /** Provider-specific options */
  options?: Record<string, any>;
}
