/**
 * LLMClient - Multi-provider LLM client factory
 *
 * Provides unified interface for multiple LLM providers:
 * - Anthropic (Claude)
 * - OpenAI (GPT)
 * - Google (Gemini)
 * - Ollama (Local models)
 * - LLama.cpp (Local server)
 *
 * Uses factory pattern to instantiate appropriate provider
 * based on configuration.
 */

import { ILLMProvider, ProviderConfig } from './providers/ILLMProvider';
import { AnthropicProvider } from './providers/AnthropicProvider';
import { OpenAIProvider } from './providers/OpenAIProvider';
import { GeminiProvider } from './providers/GeminiProvider';
import { OllamaProvider } from './providers/OllamaProvider';
import { LLMCallOptions } from '../types';

/**
 * LLMClient - Main client class with provider abstraction
 * Delegates all operations to underlying provider
 */
export class LLMClient {
  private provider: ILLMProvider;

  /**
   * Legacy constructor for backward compatibility
   * Creates Anthropic provider with given API key and model
   *
   * @param apiKey - Anthropic API key
   * @param model - Claude model identifier
   */
  constructor(apiKey: string, model: string) {
    this.provider = new AnthropicProvider(apiKey, model);
  }

  // ========================================================================
  // Factory Methods
  // ========================================================================

  /**
   * Create LLMClient from provider type and configuration
   * Factory method that instantiates appropriate provider
   *
   * @param providerType - Type of provider to use
   * @param config - Provider configuration
   * @returns Configured LLMClient instance
   */
  static createFromConfig(
    providerType: string,
    config: ProviderConfig
  ): LLMClient {
    let provider: ILLMProvider;

    switch (providerType.toLowerCase()) {
      case 'anthropic':
        if (!config.apiKey) {
          throw new Error('Anthropic provider requires API key');
        }
        provider = new AnthropicProvider(config.apiKey, config.model);
        break;

      case 'openai':
        if (!config.apiKey) {
          throw new Error('OpenAI provider requires API key');
        }
        provider = new OpenAIProvider(config.apiKey, config.model);
        break;

      case 'gemini':
        if (!config.apiKey) {
          throw new Error('Gemini provider requires API key');
        }
        provider = new GeminiProvider(config.apiKey, config.model);
        break;

      case 'ollama':
        if (!config.endpoint) {
          throw new Error('Ollama provider requires endpoint');
        }
        provider = new OllamaProvider(config.endpoint, config.model);
        break;

      default:
        throw new Error(`Unknown provider type: ${providerType}`);
    }

    const client = Object.create(LLMClient.prototype);
    client.provider = provider;
    return client;
  }

  // ========================================================================
  // Provider Delegation Methods
  // ========================================================================

  /**
   * Initialize the underlying provider
   * Must be called before making API requests
   */
  initialize(): void {
    this.provider.initialize();
  }

  /**
   * Call LLM API via provider
   *
   * @param systemPrompt - System instruction
   * @param userPrompt - User message
   * @param options - Call options (temperature, tokens, timeout)
   * @returns LLM response text
   */
  async callAPI(
    systemPrompt: string,
    userPrompt: string,
    options?: LLMCallOptions
  ): Promise<string> {
    return await this.provider.callAPI(systemPrompt, userPrompt, options);
  }

  /**
   * Test connection to LLM provider
   * @returns true if successful
   * @throws Error with user-friendly message if failed
   */
  async testConnection(): Promise<boolean> {
    return await this.provider.testConnection();
  }

  /**
   * Get available models for current provider
   * @returns Array of model identifiers
   */
  getAvailableModels(): string[] | Promise<string[]> {
    return this.provider.getAvailableModels();
  }

  /**
   * Check if provider is initialized
   * @returns true if ready
   */
  isInitialized(): boolean {
    return this.provider.isInitialized();
  }

  /**
   * Get current model identifier
   * @returns Model name
   */
  getModel(): string {
    return this.provider.getModel();
  }

  /**
   * Update model to use
   * @param model - New model identifier
   */
  setModel(model: string): void {
    this.provider.setModel(model);
  }

  /**
   * Get underlying provider instance
   * For advanced use cases
   * @returns Current provider
   */
  getProvider(): ILLMProvider {
    return this.provider;
  }
}
