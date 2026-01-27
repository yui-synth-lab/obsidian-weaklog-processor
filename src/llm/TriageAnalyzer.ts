/**
 * TriageAnalyzer - AI-powered entry evaluation
 *
 * Analyzes weaklog entries against 4 criteria:
 * 1. HAS_SPECIFICS: Concrete situations vs. abstract feelings
 * 2. CAN_BE_CORE_PHRASE: Condensable to <40 char question
 * 3. IS_TRANSFERABLE: Universal relevance vs. overly personal
 * 4. IS_NON_HARMFUL: Constructive, safe for readers
 *
 * Returns structured evaluation with score and recommendation
 */

import { LLMClient } from './LLMClient';
import { TriageResult, CheckResult, ResponseLanguage } from '../types';

/**
 * Generate system prompt for triage analysis
 * Instructs LLM to evaluate entries objectively in specified language
 */
function getTriageSystemPrompt(language: ResponseLanguage): string {
  const languageInstruction = language === 'japanese'
    ? '\n\nIMPORTANT: Respond in Japanese (日本語). All explanations, reasons, and the core question must be in Japanese.'
    : '\n\nIMPORTANT: Respond in English.';

  return `You are an objective evaluator for a creative writing project.
Your task is to evaluate raw journal entries to determine if they have potential to be transformed into universal, transferable creative works.

Evaluate the entry against these 4 criteria:

1. **HAS_SPECIFICS**: Does it contain concrete situations, experiences, or observations (not just abstract feelings)?
   - Pass: Specific events, moments, scenarios
   - Fail: Only vague emotions or generalizations

2. **CAN_BE_CORE_PHRASE**: Can it be condensed into one essential question (under 40 characters)?
   - Pass: Has a clear, focused theme
   - Fail: Too scattered or unfocused

3. **IS_TRANSFERABLE**: Is it universally relatable (not overly personal or niche)?
   - Pass: Others could relate to similar experiences
   - Fail: Too specific to author's unique circumstances

4. **IS_NON_HARMFUL**: Is it constructive and safe for readers (not harmful or triggering)?
   - Pass: Reflective, growth-oriented
   - Fail: Harmful, destructive, or excessively dark

For each criterion, provide:
- pass: true/false
- reason: Brief explanation (1-2 sentences, ~30 chars)

Also provide:
- coreQuestion: The essential question distilled from the entry (max 40 chars)
- score: Count of passed checks (0-4)
- recommendation: "adopt" (score=4), "review" (score=2-3), or "reject" (score=0-1)

Respond ONLY with JSON in this exact format:
{
  "checks": {
    "hasSpecifics": { "pass": true, "reason": "..." },
    "canBeCorePhrase": { "pass": true, "reason": "..." },
    "isTransferable": { "pass": true, "reason": "..." },
    "isNonHarmful": { "pass": true, "reason": "..." }
  },
  "coreQuestion": "...",
  "score": 4,
  "recommendation": "adopt"
}${languageInstruction}`;
}

/**
 * TriageAnalyzer class
 * Evaluates weaklog entries for creative potential
 */
export class TriageAnalyzer {
  private llmClient: LLMClient;
  private temperature: number;

  constructor(llmClient: LLMClient, temperature: number = 0.3) {
    this.llmClient = llmClient;
    this.temperature = temperature;
  }

  // ========================================================================
  // Main Analysis Method
  // ========================================================================

  /**
   * Analyze weaklog entry with AI triage
   * Sends content to LLM for 4-criteria evaluation
   *
   * @param content - Raw entry content to evaluate
   * @param language - Response language for AI output
   * @returns TriageResult with checks, score, and recommendation
   */
  async analyzeEntry(content: string, language: ResponseLanguage = 'english'): Promise<TriageResult> {
    if (!content || content.trim().length === 0) {
      throw new Error('Content cannot be empty');
    }

    console.log('[Weaklog] Starting triage analysis');

    try {
      // Build user prompt
      const userPrompt = `Evaluate this journal entry:\n\n${content}`;

      // Get system prompt for specified language
      const systemPrompt = getTriageSystemPrompt(language);

      // Call API
      const response = await this.llmClient.callAPI(
        systemPrompt,
        userPrompt,
        {
          temperature: this.temperature,
          maxTokens: 1000,
          timeoutMs: 30000,
        }
      );

      console.log('[Weaklog] Received triage response');

      // Parse response
      const result = this.parseTriageResponse(response, content);

      console.log(`[Weaklog] Triage complete - Score: ${result.score}/4, Recommendation: ${result.recommendation}`);

      return result;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('[Weaklog] Triage analysis failed:', errorMessage);
      throw new Error(`Triage analysis failed: ${errorMessage}`);
    }
  }

  // ========================================================================
  // Response Parsing
  // ========================================================================

  /**
   * Parse AI response into structured TriageResult
   * Handles malformed JSON with fallbacks
   *
   * @param response - Raw API response text
   * @param originalContent - Original entry content (for fallback core question)
   * @returns Structured TriageResult
   */
  private parseTriageResponse(response: string, originalContent: string): TriageResult {
    try {
      // Extract JSON from response (might be wrapped in text)
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }

      const parsed = JSON.parse(jsonMatch[0]);

      // Validate structure
      if (!parsed.checks || !parsed.coreQuestion) {
        throw new Error('Invalid response structure');
      }

      // Build CheckResults
      const checks = {
        hasSpecifics: this.validateCheckResult(parsed.checks.hasSpecifics),
        canBeCorePhrase: this.validateCheckResult(parsed.checks.canBeCorePhrase),
        isTransferable: this.validateCheckResult(parsed.checks.isTransferable),
        isNonHarmful: this.validateCheckResult(parsed.checks.isNonHarmful),
      };

      // Calculate score (count passed checks)
      const score = Object.values(checks).filter((check) => check.pass).length;

      // Determine recommendation
      const recommendation = this.calculateRecommendation(score);

      // Truncate core question to 40 chars
      const coreQuestion = parsed.coreQuestion.substring(0, 40);

      return {
        checks,
        score,
        recommendation,
        coreQuestion,
        timestamp: new Date().toISOString(),
      };

    } catch (error) {
      console.error('[Weaklog] Failed to parse triage response:', error);
      console.log('[Weaklog] Raw response:', response);

      // Return conservative fallback
      return this.createFallbackResult(originalContent);
    }
  }

  /**
   * Validate and normalize a single check result
   *
   * @param check - Raw check object from API
   * @returns Validated CheckResult
   */
  private validateCheckResult(check: any): CheckResult {
    return {
      pass: check?.pass === true,
      reason: typeof check?.reason === 'string' ? check.reason : 'No reason provided',
    };
  }

  /**
   * Calculate recommendation based on score
   * 4 = adopt, 2-3 = review, 0-1 = reject
   *
   * @param score - Score from 0-4
   * @returns Recommendation
   */
  private calculateRecommendation(score: number): 'adopt' | 'review' | 'reject' {
    if (score === 4) return 'adopt';
    if (score >= 2) return 'review';
    return 'reject';
  }

  /**
   * Create fallback result when parsing fails
   * Conservative approach: mark as "review" to let user decide
   *
   * @param content - Original content (for generating fallback core question)
   * @returns Conservative TriageResult
   */
  private createFallbackResult(content: string): TriageResult {
    console.warn('[Weaklog] Using fallback triage result due to parsing error');

    // Generate simple core question from first 40 chars
    const coreQuestion = content.substring(0, 37) + '...';

    return {
      checks: {
        hasSpecifics: { pass: false, reason: 'Analysis failed - please review' },
        canBeCorePhrase: { pass: false, reason: 'Analysis failed - please review' },
        isTransferable: { pass: false, reason: 'Analysis failed - please review' },
        isNonHarmful: { pass: true, reason: 'Assumed safe' },
      },
      score: 1,
      recommendation: 'review',
      coreQuestion,
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
    console.log(`[Weaklog] Triage temperature set to ${temperature}`);
  }

  /**
   * Get current temperature
   * @returns Current temperature setting
   */
  getTemperature(): number {
    return this.temperature;
  }
}
