/**
 * SynthesisGuide - AI-powered synthesis question generation
 *
 * Generates deepening questions to transform raw entries into
 * universal, transferable creative works.
 *
 * Focuses on:
 * - Universal aspects (not just personal details)
 * - "Why/how" questions (not just "what")
 * - Deepening reflection and insight
 */

import { LLMClient } from './LLMClient';
import { SynthesisGuide as SynthesisGuideType, TriageResult, ResponseLanguage } from '../types';

/**
 * Generate system prompt for synthesis question generation
 * Guides LLM to create reflective, deepening questions in specified language
 */
function getSynthesisSystemPrompt(language: ResponseLanguage): string {
  const languageInstruction = language === 'japanese'
    ? '\n\nIMPORTANT: Generate ALL questions in Japanese (日本語). The suggestedTone should also be in Japanese.'
    : '\n\nIMPORTANT: Generate ALL questions in English.';

  return `You are a creative writing coach helping transform personal journal entries into universal, transferable creative works.

Your task is to generate 3-5 deepening questions that help the author:
1. Move from personal experience to universal insight
2. Explore the "why" and "how", not just the "what"
3. Discover patterns and transferable wisdom
4. Transform weakness into creative strength

Guidelines for questions:
- Focus on universal aspects (not overly personal details)
- Encourage reflection on patterns and meanings
- Help extract transferable insights
- Prompt deeper "why/how" exploration
- Keep questions clear and thought-provoking

Generate exactly 3-5 questions. Do NOT number them.

Respond with JSON in this exact format:
{
  "questions": [
    "Question 1 text here?",
    "Question 2 text here?",
    "Question 3 text here?"
  ],
  "suggestedTone": "reflective" or "analytical" or "exploratory"
}${languageInstruction}`;
}

/**
 * Get fallback questions when parsing fails
 * Conservative, generic questions that work for most entries
 */
function getFallbackQuestions(language: ResponseLanguage): string[] {
  if (language === 'japanese') {
    return [
      'この経験が示す普遍的なパターンや真実は何ですか？',
      '同じような状況に直面している他の人は、この洞察からどのような恩恵を受けるでしょうか？',
      'より深く探求したい問いは何ですか？',
      'もしこれが未来の自分へのレッスンだとしたら、それは何でしょうか？',
    ];
  }

  return [
    'What universal pattern or truth does this experience reveal?',
    'How might others facing similar situations benefit from this insight?',
    'What question would you want to explore more deeply?',
    'If this were a lesson for your future self, what would it be?',
  ];
}

/**
 * SynthesisGuide class
 * Generates AI-powered questions for entry transformation
 */
export class SynthesisGuide {
  private llmClient: LLMClient;
  private temperature: number;

  constructor(llmClient: LLMClient, temperature: number = 0.7) {
    this.llmClient = llmClient;
    this.temperature = temperature;
  }

  // ========================================================================
  // Main Generation Method
  // ========================================================================

  /**
   * Generate synthesis questions for an entry
   * Uses triage result context to inform question generation
   *
   * @param content - Raw entry content
   * @param triageResult - Results from triage analysis
   * @param language - Response language for AI output
   * @returns SynthesisGuide with 3-5 questions
   */
  async generateQuestions(
    content: string,
    triageResult: TriageResult,
    language: ResponseLanguage = 'english'
  ): Promise<SynthesisGuideType> {
    if (!content || content.trim().length === 0) {
      throw new Error('Content cannot be empty');
    }

    console.log('[Weaklog] Generating synthesis questions');

    try {
      // Build user prompt with context from triage
      const userPrompt = this.buildUserPrompt(content, triageResult);

      // Get system prompt for specified language
      const systemPrompt = getSynthesisSystemPrompt(language);

      // Call API
      const response = await this.llmClient.callAPI(
        systemPrompt,
        userPrompt,
        {
          temperature: this.temperature,
          maxTokens: 500,
          timeoutMs: 20000,
        }
      );

      console.log('[Weaklog] Received synthesis response');

      // Parse response
      const guide = this.parseSynthesisResponse(response, language);

      console.log(`[Weaklog] Generated ${guide.questions.length} synthesis questions`);

      return guide;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('[Weaklog] Synthesis generation failed:', errorMessage);
      throw new Error(`Synthesis generation failed: ${errorMessage}`);
    }
  }

  // ========================================================================
  // Prompt Building
  // ========================================================================

  /**
   * Build user prompt with triage context
   * Includes core question and passed criteria for better questions
   *
   * @param content - Entry content
   * @param triageResult - Triage evaluation
   * @returns Formatted prompt
   */
  private buildUserPrompt(content: string, triageResult: TriageResult): string {
    const parts = [
      'Generate synthesis questions for this entry:',
      '',
      `Core Question: ${triageResult.coreQuestion}`,
      '',
      'Entry Content:',
      content,
      '',
      'Context from triage:',
    ];

    // Add triage insights
    const checks = triageResult.checks;
    if (checks.hasSpecifics.pass) {
      parts.push('- Contains concrete specifics');
    }
    if (checks.isTransferable.pass) {
      parts.push('- Has universal relevance');
    }

    return parts.join('\n');
  }

  // ========================================================================
  // Response Parsing
  // ========================================================================

  /**
   * Parse AI response into SynthesisGuide
   * Validates 3-5 question count with fallback
   *
   * @param response - Raw API response
   * @param language - Response language for fallback
   * @returns Structured SynthesisGuide
   */
  private parseSynthesisResponse(response: string, language: ResponseLanguage): SynthesisGuideType {
    try {
      // Extract JSON from response
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }

      const parsed = JSON.parse(jsonMatch[0]);

      // Validate structure
      if (!parsed.questions || !Array.isArray(parsed.questions)) {
        throw new Error('Invalid response structure: missing questions array');
      }

      // Validate question count (3-5)
      if (parsed.questions.length < 3 || parsed.questions.length > 5) {
        console.warn(
          `[Weaklog] Invalid question count: ${parsed.questions.length} (expected 3-5)`
        );
        throw new Error('Invalid question count');
      }

      // Clean and validate questions
      const questions = parsed.questions
        .map((q: any) => {
          if (typeof q !== 'string') return null;
          // Remove numbering if present (e.g., "1. " or "- ")
          return q.replace(/^\d+\.\s*|^-\s*/, '').trim();
        })
        .filter((q: string | null) => q && q.length > 0);

      if (questions.length < 3) {
        throw new Error('Not enough valid questions after cleaning');
      }

      // Get suggested tone (with fallback)
      const suggestedTone = this.validateTone(parsed.suggestedTone);

      return {
        questions: questions.slice(0, 5), // Ensure max 5 questions
        suggestedTone,
        timestamp: new Date().toISOString(),
      };

    } catch (error) {
      console.error('[Weaklog] Failed to parse synthesis response:', error);
      console.log('[Weaklog] Raw response:', response);

      // Return fallback questions
      return this.createFallbackGuide(language);
    }
  }

  /**
   * Validate and normalize tone suggestion
   *
   * @param tone - Suggested tone from API
   * @returns Valid tone string
   */
  private validateTone(tone: any): string {
    const validTones = ['reflective', 'analytical', 'exploratory'];

    if (typeof tone === 'string' && validTones.includes(tone.toLowerCase())) {
      return tone.toLowerCase();
    }

    return 'reflective'; // Default fallback
  }

  /**
   * Create fallback guide when parsing fails
   * Uses generic but effective questions in specified language
   *
   * @param language - Response language for fallback questions
   * @returns Conservative SynthesisGuide
   */
  private createFallbackGuide(language: ResponseLanguage): SynthesisGuideType {
    console.warn('[Weaklog] Using fallback synthesis questions due to parsing error');

    return {
      questions: getFallbackQuestions(language),
      suggestedTone: 'reflective',
      timestamp: new Date().toISOString(),
    };
  }

  // ========================================================================
  // Utility Methods
  // ========================================================================

  /**
   * Update temperature setting
   * @param temperature - New temperature (0.0-1.0)
   */
  setTemperature(temperature: number): void {
    if (temperature < 0 || temperature > 1) {
      throw new Error('Temperature must be between 0.0 and 1.0');
    }
    this.temperature = temperature;
    console.log(`[Weaklog] Synthesis temperature set to ${temperature}`);
  }

  /**
   * Get current temperature
   * @returns Current temperature setting
   */
  getTemperature(): number {
    return this.temperature;
  }

  /**
   * Get fallback questions in specified language
   * Useful for testing or when API is unavailable
   * @param language - Response language
   * @returns Array of fallback questions
   */
  getFallbackQuestions(language: ResponseLanguage = 'english'): string[] {
    return getFallbackQuestions(language);
  }
}
