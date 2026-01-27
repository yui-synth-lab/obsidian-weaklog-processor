/**
 * OpenAIProvider - OpenAI API implementation
 *
 * Implements ILLMProvider for OpenAI's GPT models:
 * - API initialization with key validation
 * - Retry logic with exponential backoff
 * - Timeout handling
 * - Error sanitization for security
 * - Connection testing
 */

import OpenAI from 'openai';
import { ILLMProvider } from './ILLMProvider';
import { LLMCallOptions } from '../../types';

/**
 * OpenAI GPT provider implementation
 * Supports GPT-4, GPT-4 Turbo, GPT-3.5 Turbo, and other models
 */
export class OpenAIProvider implements ILLMProvider {
  private client: OpenAI | null = null;
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
   * Initialize OpenAI client
   * Call before making API requests
   */
  initialize(): void {
    if (!this.apiKey || this.apiKey.trim().length === 0) {
      throw new Error('API key is required');
    }

    try {
      this.client = new OpenAI({
        apiKey: this.apiKey,
        dangerouslyAllowBrowser: true, // Safe for Obsidian (Electron desktop app)
      });
      console.log('[Weaklog] OpenAI provider initialized');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to initialize OpenAI provider: ${errorMessage}`);
    }
  }

  // ========================================================================
  // API Communication
  // ========================================================================

  /**
   * Call OpenAI API with retry logic
   * Implements exponential backoff for transient errors
   *
   * @param systemPrompt - System instruction for GPT
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

    // Check if this is a GPT-5 reasoning model (doesn't support temperature)
    const isReasoningModel = this.model.toLowerCase().startsWith('gpt-5') ||
                             this.model.toLowerCase().startsWith('o1') ||
                             this.model.toLowerCase().startsWith('o3');

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`[Weaklog] OpenAI API call attempt ${attempt}/${maxRetries}`);

        // Create timeout promise
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error('API request timeout')), timeoutMs);
        });

        // Build API parameters (reasoning models don't support temperature)
        const apiParams: any = {
          model: this.model,
          max_completion_tokens: maxTokens, // GPT-5+ uses max_completion_tokens instead of max_tokens
          messages: [
            {
              role: 'system',
              content: systemPrompt,
            },
            {
              role: 'user',
              content: userPrompt,
            },
          ],
        };

        // Only add temperature for non-reasoning models
        if (!isReasoningModel) {
          apiParams.temperature = temperature;
        }

        // Create API call promise
        const apiPromise = this.client!.chat.completions.create(apiParams);

        // Race between API call and timeout
        const response = await Promise.race([apiPromise, timeoutPromise]);

        // Extract text from response
        if (response.choices && response.choices.length > 0) {
          const message = response.choices[0].message;
          if (message && message.content) {
            console.log('[Weaklog] OpenAI API call successful');
            return message.content;
          }
        }

        throw new Error('No content in API response');

      } catch (error) {
        const errorMessage = this.sanitizeError(error);
        console.error(`[Weaklog] OpenAI API call attempt ${attempt} failed:`, errorMessage);

        // Handle specific error types
        if (error instanceof Error) {
          // Auth errors - don't retry
          if (error.message.includes('401') || error.message.includes('authentication') || error.message.includes('invalid_api_key')) {
            throw new Error('Invalid API key. Please check your OpenAI API key in settings.');
          }

          // Rate limits - retry with longer backoff
          if (error.message.includes('429') || error.message.includes('rate_limit')) {
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

          // Insufficient quota
          if (error.message.includes('insufficient_quota')) {
            throw new Error('OpenAI quota exceeded. Please check your billing settings.');
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

      console.log('[Weaklog] Testing OpenAI API connection');

      // Make minimal API call (use minimal parameters for compatibility)
      await this.client!.chat.completions.create({
        model: this.model,
        max_completion_tokens: 5, // GPT-5+ uses max_completion_tokens
        messages: [
          {
            role: 'user',
            content: 'Test',
          },
        ],
      });

      console.log('[Weaklog] OpenAI API connection test successful');
      return true;

    } catch (error) {
      const errorMessage = this.sanitizeError(error);
      console.error('[Weaklog] OpenAI API connection test failed:', errorMessage);

      // Provide user-friendly error messages
      if (error instanceof Error) {
        if (error.message.includes('401') || error.message.includes('authentication') || error.message.includes('invalid_api_key')) {
          throw new Error('Invalid API key. Please check your OpenAI API key.');
        }

        if (error.message.includes('429') || error.message.includes('rate_limit')) {
          throw new Error('Rate limit exceeded. Please wait a moment and try again.');
        }

        if (error.message.includes('insufficient_quota')) {
          throw new Error('OpenAI quota exceeded. Please check your billing settings.');
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
   * Get available OpenAI models
   * Returns static list of supported models
   */
  getAvailableModels(): string[] {
    return [
      'gpt-5.2',
      'gpt-5',
      'gpt-5-mini',
      'gpt-4-turbo-preview',
      'gpt-4',
      'gpt-3.5-turbo',
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
    console.log(`[Weaklog] OpenAI model updated to ${model}`);
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

      // Remove any API keys (sk-...)
      message = message.replace(/sk-[a-zA-Z0-9]+/g, '[API_KEY_REDACTED]');

      // Remove any authorization headers
      message = message.replace(/authorization:?\s*[^\s]+/gi, 'authorization: [REDACTED]');
      message = message.replace(/bearer\s+[^\s]+/gi, 'Bearer [REDACTED]');

      return message;
    }

    return 'Unknown error';
  }
}
