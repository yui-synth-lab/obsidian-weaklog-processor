/**
 * GeminiProvider - Google Gemini API implementation
 *
 * Implements ILLMProvider for Google's Gemini models:
 * - API initialization with key validation
 * - Retry logic with exponential backoff
 * - Timeout handling
 * - Error sanitization for security
 * - Connection testing
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import { ILLMProvider } from './ILLMProvider';
import { LLMCallOptions } from '../../types';

/**
 * Google Gemini provider implementation
 * Supports Gemini Pro, Gemini Pro Vision, and other models
 */
export class GeminiProvider implements ILLMProvider {
  private client: GoogleGenerativeAI | null = null;
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
   * Initialize Gemini client
   * Call before making API requests
   */
  initialize(): void {
    if (!this.apiKey || this.apiKey.trim().length === 0) {
      throw new Error('API key is required');
    }

    try {
      this.client = new GoogleGenerativeAI(this.apiKey);
      console.log('[Weaklog] Gemini provider initialized');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to initialize Gemini provider: ${errorMessage}`);
    }
  }

  // ========================================================================
  // API Communication
  // ========================================================================

  /**
   * Call Gemini API with retry logic
   * Implements exponential backoff for transient errors
   *
   * @param systemPrompt - System instruction for Gemini
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
        console.log(`[Weaklog] Gemini API call attempt ${attempt}/${maxRetries}`);

        // Get generative model
        const generativeModel = this.client!.getGenerativeModel({
          model: this.model,
        });

        // Create timeout promise
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error('API request timeout')), timeoutMs);
        });

        // Combine system and user prompts
        // Gemini doesn't have separate system/user roles, so we combine them
        const combinedPrompt = `${systemPrompt}\n\n${userPrompt}`;

        // Create API call promise
        const apiPromise = generativeModel.generateContent({
          contents: [{ role: 'user', parts: [{ text: combinedPrompt }] }],
          generationConfig: {
            temperature: temperature,
            maxOutputTokens: maxTokens,
          },
        });

        // Race between API call and timeout
        const response = await Promise.race([apiPromise, timeoutPromise]);

        // Extract text from response
        const result = response.response;
        if (result && result.text) {
          const text = result.text();
          console.log('[Weaklog] Gemini API call successful');
          return text;
        }

        throw new Error('No text content in API response');

      } catch (error) {
        const errorMessage = this.sanitizeError(error);
        console.error(`[Weaklog] Gemini API call attempt ${attempt} failed:`, errorMessage);

        // Handle specific error types
        if (error instanceof Error) {
          // Auth errors - don't retry
          if (error.message.includes('401') ||
              error.message.includes('403') ||
              error.message.includes('API_KEY_INVALID') ||
              error.message.includes('authentication')) {
            throw new Error('Invalid API key. Please check your Gemini API key in settings.');
          }

          // Rate limits - retry with longer backoff
          if (error.message.includes('429') ||
              error.message.includes('RESOURCE_EXHAUSTED') ||
              error.message.includes('rate limit')) {
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

          // Quota exceeded
          if (error.message.includes('quota') || error.message.includes('QUOTA_EXCEEDED')) {
            throw new Error('Gemini quota exceeded. Please check your billing settings.');
          }

          // Safety block
          if (error.message.includes('SAFETY') || error.message.includes('blocked')) {
            throw new Error('Content was blocked by Gemini safety filters. Please try different input.');
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

      console.log('[Weaklog] Testing Gemini API connection');

      // Get generative model
      const generativeModel = this.client!.getGenerativeModel({
        model: this.model,
      });

      // Make minimal API call
      await generativeModel.generateContent({
        contents: [{ role: 'user', parts: [{ text: 'Test' }] }],
        generationConfig: {
          maxOutputTokens: 5,
        },
      });

      console.log('[Weaklog] Gemini API connection test successful');
      return true;

    } catch (error) {
      const errorMessage = this.sanitizeError(error);
      console.error('[Weaklog] Gemini API connection test failed:', errorMessage);

      // Provide user-friendly error messages
      if (error instanceof Error) {
        if (error.message.includes('401') ||
            error.message.includes('403') ||
            error.message.includes('API_KEY_INVALID') ||
            error.message.includes('authentication')) {
          throw new Error('Invalid API key. Please check your Gemini API key.');
        }

        if (error.message.includes('429') ||
            error.message.includes('RESOURCE_EXHAUSTED') ||
            error.message.includes('rate limit')) {
          throw new Error('Rate limit exceeded. Please wait a moment and try again.');
        }

        if (error.message.includes('quota') || error.message.includes('QUOTA_EXCEEDED')) {
          throw new Error('Gemini quota exceeded. Please check your billing settings.');
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
   * Get available Gemini models
   * Returns static list of supported models
   */
  getAvailableModels(): string[] {
    return [
      'gemini-3-pro',
      'gemini-3-flash',
      'gemini-2.0-flash',
      'gemini-1.5-pro',
      'gemini-1.5-flash',
      'gemini-pro',
      'gemini-pro-vision',
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
    console.log(`[Weaklog] Gemini model updated to ${model}`);
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

      // Remove any API keys (AIza...)
      message = message.replace(/AIza[a-zA-Z0-9_-]+/g, '[API_KEY_REDACTED]');

      // Remove any authorization headers
      message = message.replace(/authorization:?\s*[^\s]+/gi, 'authorization: [REDACTED]');
      message = message.replace(/x-goog-api-key:?\s*[^\s]+/gi, 'x-goog-api-key: [REDACTED]');

      return message;
    }

    return 'Unknown error';
  }
}
