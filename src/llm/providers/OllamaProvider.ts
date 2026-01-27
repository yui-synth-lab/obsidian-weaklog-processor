/**
 * OllamaProvider - Ollama local LLM server implementation (fetch-based)
 *
 * Implements ILLMProvider for Ollama locally hosted models:
 * - Direct REST API calls using fetch (no npm dependencies)
 * - Connection to local Ollama server
 * - Retry logic with exponential backoff
 * - Timeout handling
 * - Dynamic model listing
 * - Connection testing
 */

import { ILLMProvider } from './ILLMProvider';
import { LLMCallOptions } from '../../types';

/**
 * Ollama API response interfaces
 */
interface OllamaMessage {
  role: string;
  content: string;
}

interface OllamaChatResponse {
  model: string;
  message: OllamaMessage;
  done: boolean;
}

interface OllamaModel {
  name: string;
  modified_at: string;
  size: number;
}

interface OllamaListResponse {
  models: OllamaModel[];
}

/**
 * Ollama provider implementation using fetch API
 * Supports any locally available Ollama models (llama2, mistral, etc.)
 */
export class OllamaProvider implements ILLMProvider {
  private endpoint: string;
  private model: string;
  private initialized: boolean = false;

  constructor(endpoint: string, model: string) {
    this.endpoint = endpoint.replace(/\/$/, ''); // Remove trailing slash
    this.model = model;
  }

  // ========================================================================
  // Initialization
  // ========================================================================

  /**
   * Initialize Ollama client
   * Validates endpoint format
   */
  initialize(): void {
    if (!this.endpoint || this.endpoint.trim().length === 0) {
      throw new Error('Endpoint is required');
    }

    try {
      // Validate endpoint is a URL
      new URL(this.endpoint);
      this.initialized = true;
      console.log('[Weaklog] Ollama provider initialized with endpoint:', this.endpoint);
    } catch (error) {
      throw new Error(`Invalid Ollama endpoint URL: ${this.endpoint}`);
    }
  }

  // ========================================================================
  // API Communication
  // ========================================================================

  /**
   * Call Ollama API with retry logic
   * Uses fetch to call /api/chat endpoint
   *
   * @param systemPrompt - System instruction
   * @param userPrompt - User message content
   * @param options - Temperature, max tokens, timeout
   * @returns API response text
   */
  async callAPI(
    systemPrompt: string,
    userPrompt: string,
    options: LLMCallOptions = {}
  ): Promise<string> {
    if (!this.initialized) {
      this.initialize();
    }

    const {
      temperature = 0.5,
      maxTokens = 1000,
      timeoutMs = 60000, // Ollama can be slower on local hardware
    } = options;

    const maxRetries = 3;
    const baseDelay = 2000; // 2 seconds

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`[Weaklog] Ollama API call attempt ${attempt}/${maxRetries}`);

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

        try {
          const response = await fetch(`${this.endpoint}/api/chat`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              model: this.model,
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
              stream: false,
              options: {
                temperature: temperature,
                num_predict: maxTokens,
              },
            }),
            signal: controller.signal,
          });

          clearTimeout(timeoutId);

          if (!response.ok) {
            const errorText = await response.text();
            if (response.status === 404) {
              throw new Error(`Model "${this.model}" not found. Pull it with: ollama pull ${this.model}`);
            }
            throw new Error(`Ollama API error (${response.status}): ${errorText}`);
          }

          const data: OllamaChatResponse = await response.json();

          if (data && data.message && data.message.content) {
            console.log('[Weaklog] Ollama API call successful');
            return data.message.content;
          }

          throw new Error('No content in API response');

        } catch (fetchError) {
          clearTimeout(timeoutId);
          throw fetchError;
        }

      } catch (error) {
        const errorMessage = this.sanitizeError(error);
        console.error(`[Weaklog] Ollama API call attempt ${attempt} failed:`, errorMessage);

        // Handle specific error types
        if (error instanceof Error) {
          // Abort error = timeout
          if (error.name === 'AbortError') {
            if (attempt === maxRetries) {
              throw new Error('Request timed out. Your local model may be too slow or overloaded.');
            }

            const delay = baseDelay * Math.pow(2, attempt - 1);
            console.log(`[Weaklog] Timeout, waiting ${delay}ms before retry`);
            await this.sleep(delay);
            continue;
          }

          // Connection errors - likely server not running
          if (error.message.includes('Failed to fetch') ||
              error.message.includes('NetworkError') ||
              error.message.includes('fetch failed')) {
            throw new Error(`Cannot connect to Ollama server at ${this.endpoint}. Is Ollama running?`);
          }

          // Model not found - don't retry
          if (error.message.includes('Model') && error.message.includes('not found')) {
            throw error;
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
   * Test connection to Ollama server
   * Checks if server is running and model is available
   *
   * @returns true if connection successful
   * @throws Error with user-friendly message if failed
   */
  async testConnection(): Promise<boolean> {
    try {
      if (!this.initialized) {
        this.initialize();
      }

      console.log('[Weaklog] Testing Ollama server connection');

      // Check if server is running by listing models
      const response = await fetch(`${this.endpoint}/api/tags`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Ollama server returned error: ${response.status}`);
      }

      const data: OllamaListResponse = await response.json();

      if (!data || !data.models) {
        throw new Error('Invalid response from Ollama server');
      }

      // Check if our model is available
      const modelExists = data.models.some((m) =>
        m.name === this.model || m.name.startsWith(this.model)
      );

      if (!modelExists) {
        const availableModels = data.models.map((m) => m.name).join(', ');
        throw new Error(
          `Model "${this.model}" not found. Available models: ${availableModels || 'none'}. Pull with: ollama pull ${this.model}`
        );
      }

      console.log('[Weaklog] Ollama server connection test successful');
      return true;

    } catch (error) {
      const errorMessage = this.sanitizeError(error);
      console.error('[Weaklog] Ollama server connection test failed:', errorMessage);

      // Provide user-friendly error messages
      if (error instanceof Error) {
        if (error.message.includes('Failed to fetch') ||
            error.message.includes('NetworkError') ||
            error.message.includes('fetch failed')) {
          throw new Error(`Cannot connect to Ollama server at ${this.endpoint}. Please ensure Ollama is running.`);
        }

        if (error.message.includes('Model') && error.message.includes('not found')) {
          throw error; // Already user-friendly from above
        }
      }

      throw new Error(`Connection test failed: ${errorMessage}`);
    }
  }

  // ========================================================================
  // Model Management
  // ========================================================================

  /**
   * Get available models from Ollama server
   * Dynamically fetches from local server
   */
  async getAvailableModels(): Promise<string[]> {
    try {
      if (!this.initialized) {
        this.initialize();
      }

      const response = await fetch(`${this.endpoint}/api/tags`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data: OllamaListResponse = await response.json();
        if (data && data.models) {
          return data.models.map((m) => m.name);
        }
      }

      // Fallback to common models if fetch fails
      return this.getFallbackModels();

    } catch (error) {
      console.error('[Weaklog] Failed to fetch Ollama models:', error);
      return this.getFallbackModels();
    }
  }

  /**
   * Get fallback model list
   * Used when cannot connect to Ollama server
   */
  private getFallbackModels(): string[] {
    return [
      'llama2',
      'llama2:13b',
      'mistral',
      'mixtral',
      'codellama',
      'phi',
    ];
  }

  /**
   * Check if client is initialized
   * @returns true if client ready to use
   */
  isInitialized(): boolean {
    return this.initialized;
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
    console.log(`[Weaklog] Ollama model updated to ${model}`);
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
   * Sanitize error messages
   * Ollama runs locally, so less sensitive data concern
   *
   * @param error - Error to sanitize
   * @returns Safe error message
   */
  private sanitizeError(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    }

    return 'Unknown error';
  }
}
