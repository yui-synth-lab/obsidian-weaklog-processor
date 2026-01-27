/**
 * AnthropicProvider - Anthropic Claude API implementation
 *
 * Implements ILLMProvider for Anthropic's Claude models:
 * - API initialization with key validation
 * - Retry logic with exponential backoff
 * - Timeout handling
 * - Error sanitization for security
 * - Connection testing
 */

import Anthropic from '@anthropic-ai/sdk';
import { ILLMProvider } from './ILLMProvider';
import { LLMCallOptions } from '../../types';

/**
 * Anthropic Claude provider implementation
 * Supports Claude 3.5 Sonnet, Claude 3 Opus, and other models
 */
export class AnthropicProvider implements ILLMProvider {
  private client: Anthropic | null = null;
  private apiKey: string;
  private model: string;

  constructor(apiKey: string, model: string) {
    this.apiKey = apiKey;
    this.model = model;
  }

  // ========================================================================
  // Initialization
  // ========================================================================

  /**
   * Initialize Anthropic client
   * Call before making API requests
   */
  initialize(): void {
    if (!this.apiKey || this.apiKey.trim().length === 0) {
      throw new Error('API key is required');
    }

    try {
      this.client = new Anthropic({
        apiKey: this.apiKey,
      });
      console.log('[Weaklog] Anthropic provider initialized');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to initialize Anthropic provider: ${errorMessage}`);
    }
  }

  // ========================================================================
  // API Communication
  // ========================================================================

  /**
   * Call Anthropic API with retry logic
   * Implements exponential backoff for transient errors
   *
   * @param systemPrompt - System instruction for Claude
   * @param userPrompt - User message content
   * @param options - Temperature, max tokens, timeout
   * @returns API response text
   */
  async callAPI(
    systemPrompt: string,
    userPrompt: string,
    options: LLMCallOptions = {}
  ): Promise<string> {
    if (!this.client) {
      this.initialize();
    }

    const {
      temperature = 0.5,
      maxTokens = 1000,
      timeoutMs = 30000,
    } = options;

    const maxRetries = 3;
    const baseDelay = 1000; // 1 second

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`[Weaklog] Anthropic API call attempt ${attempt}/${maxRetries}`);

        // Create timeout promise
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error('API request timeout')), timeoutMs);
        });

        // Create API call promise
        const apiPromise = this.client!.messages.create({
          model: this.model,
          max_tokens: maxTokens,
          temperature: temperature,
          system: systemPrompt,
          messages: [
            {
              role: 'user',
              content: userPrompt,
            },
          ],
        });

        // Race between API call and timeout
        const response = await Promise.race([apiPromise, timeoutPromise]);

        // Extract text from response
        if (response.content && response.content.length > 0) {
          const textBlock = response.content.find((block: any) => block.type === 'text');
          if (textBlock && 'text' in textBlock) {
            console.log('[Weaklog] Anthropic API call successful');
            return textBlock.text;
          }
        }

        throw new Error('No text content in API response');

      } catch (error) {
        const errorMessage = this.sanitizeError(error);
        console.error(`[Weaklog] Anthropic API call attempt ${attempt} failed:`, errorMessage);

        // Handle specific error types
        if (error instanceof Error) {
          // Auth errors - don't retry
          if (error.message.includes('401') || error.message.includes('authentication')) {
            throw new Error('Invalid API key. Please check your Anthropic API key in settings.');
          }

          // Rate limits - retry with longer backoff
          if (error.message.includes('429') || error.message.includes('rate limit')) {
            if (attempt === maxRetries) {
              throw new Error('Rate limit exceeded. Please try again later.');
            }

            const delay = baseDelay * Math.pow(2, attempt) * 2; // Double backoff for rate limits
            console.log(`[Weaklog] Rate limited, waiting ${delay}ms before retry`);
            await this.sleep(delay);
            continue;
          }

          // Timeout - retry with standard backoff
          if (error.message.includes('timeout')) {
            if (attempt === maxRetries) {
              throw new Error('API request timed out. Please check your connection and try again.');
            }

            const delay = baseDelay * Math.pow(2, attempt - 1);
            console.log(`[Weaklog] Timeout, waiting ${delay}ms before retry`);
            await this.sleep(delay);
            continue;
          }
        }

        // Network or other transient errors - retry
        if (attempt === maxRetries) {
          throw new Error(`API call failed after ${maxRetries} attempts: ${errorMessage}`);
        }

        const delay = baseDelay * Math.pow(2, attempt - 1);
        console.log(`[Weaklog] Waiting ${delay}ms before retry`);
        await this.sleep(delay);
      }
    }

    throw new Error('API call failed: Maximum retries exceeded');
  }

  // ========================================================================
  // Connection Testing
  // ========================================================================

  /**
   * Test API connection
   * Makes minimal API call to validate key
   *
   * @returns true if connection successful
   * @throws Error with user-friendly message if failed
   */
  async testConnection(): Promise<boolean> {
    try {
      if (!this.client) {
        this.initialize();
      }

      console.log('[Weaklog] Testing Anthropic API connection');

      // Make minimal API call
      await this.client!.messages.create({
        model: this.model,
        max_tokens: 10,
        temperature: 0,
        messages: [
          {
            role: 'user',
            content: 'Test',
          },
        ],
      });

      console.log('[Weaklog] Anthropic API connection test successful');
      return true;

    } catch (error) {
      const errorMessage = this.sanitizeError(error);
      console.error('[Weaklog] Anthropic API connection test failed:', errorMessage);

      // Provide user-friendly error messages
      if (error instanceof Error) {
        if (error.message.includes('401') || error.message.includes('authentication')) {
          throw new Error('Invalid API key. Please check your Anthropic API key.');
        }

        if (error.message.includes('429') || error.message.includes('rate limit')) {
          throw new Error('Rate limit exceeded. Please wait a moment and try again.');
        }

        if (error.message.includes('network') || error.message.includes('ENOTFOUND')) {
          throw new Error('Network error. Please check your internet connection.');
        }
      }

      throw new Error(`Connection test failed: ${errorMessage}`);
    }
  }

  // ========================================================================
  // Model Management
  // ========================================================================

  /**
   * Get available Anthropic models
   * Returns static list of supported models
   */
  getAvailableModels(): string[] {
    return [
      'claude-3-5-sonnet-20241022',
      'claude-3-5-sonnet-20240620',
      'claude-3-opus-20240229',
      'claude-3-sonnet-20240229',
      'claude-3-haiku-20240307',
    ];
  }

  /**
   * Check if client is initialized
   * @returns true if client ready to use
   */
  isInitialized(): boolean {
    return this.client !== null;
  }

  /**
   * Get current model
   * @returns Model identifier
   */
  getModel(): string {
    return this.model;
  }

  /**
   * Update model
   * @param model - New model to use
   */
  setModel(model: string): void {
    this.model = model;
    console.log(`[Weaklog] Anthropic model updated to ${model}`);
  }

  // ========================================================================
  // Utility Methods
  // ========================================================================

  /**
   * Sleep for specified milliseconds
   * Used for retry backoff
   *
   * @param ms - Milliseconds to sleep
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Sanitize error messages to remove sensitive data
   * Never expose API keys or sensitive information
   *
   * @param error - Error to sanitize
   * @returns Safe error message
   */
  private sanitizeError(error: unknown): string {
    if (error instanceof Error) {
      let message = error.message;

      // Remove any API keys (sk-ant-...)
      message = message.replace(/sk-ant-[a-zA-Z0-9-_]+/g, '[API_KEY_REDACTED]');

      // Remove any authorization headers
      message = message.replace(/authorization:?\s*[^\s]+/gi, 'authorization: [REDACTED]');

      return message;
    }

    return 'Unknown error';
  }
}
