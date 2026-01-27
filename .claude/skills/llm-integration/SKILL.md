---
name: llm-integration
description: Patterns for integrating Claude API and prompt engineering
---

# LLM Integration Skill

This skill provides patterns and best practices for integrating the Anthropic Claude API into applications.

## Anthropic API Setup

### Installation
```bash
npm install @anthropic-ai/sdk
```

### Basic Client
```typescript
import Anthropic from '@anthropic-ai/sdk';

class LLMClient {
  private client: Anthropic;

  constructor(apiKey: string) {
    this.client = new Anthropic({
      apiKey: apiKey,
    });
  }

  async complete(prompt: string, options?: CompletionOptions): Promise<string> {
    try {
      const message = await this.client.messages.create({
        model: options?.model || 'claude-3-5-sonnet-20241022',
        max_tokens: options?.maxTokens || 1024,
        temperature: options?.temperature || 0.7,
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ]
      });

      return message.content[0].type === 'text'
        ? message.content[0].text
        : '';
    } catch (error) {
      console.error('[LLM Error]', error);
      throw new Error(`API request failed: ${error.message}`);
    }
  }
}
```

## Structured Output Pattern

### JSON Response Parsing
```typescript
async analyzeWithJSON<T>(
  prompt: string,
  schema: string
): Promise<T> {
  const fullPrompt = `${prompt}\n\n${schema}\n\nRespond ONLY with valid JSON matching this schema.`;

  const response = await this.complete(fullPrompt, {
    temperature: 0.3, // Lower for structured output
    maxTokens: 2000
  });

  try {
    // Extract JSON from markdown code blocks if present
    const jsonMatch = response.match(/```json\n([\s\S]*?)\n```/);
    const jsonText = jsonMatch ? jsonMatch[1] : response;

    return JSON.parse(jsonText) as T;
  } catch (error) {
    console.error('[JSON Parse Error]', response);
    throw new Error('Failed to parse JSON response from LLM');
  }
}
```

### Usage Example
```typescript
interface TriageResult {
  checks: {
    hasSpecifics: { pass: boolean; reason: string };
    canBeCorePhrase: { pass: boolean; reason: string };
    isTransferable: { pass: boolean; reason: string };
    isNonHarmful: { pass: boolean; reason: string };
  };
  score: number;
  recommendation: 'adopt' | 'review' | 'reject';
  coreQuestion: string;
}

const schema = `
{
  "checks": {
    "hasSpecifics": { "pass": boolean, "reason": "string (30 chars max)" },
    ...
  },
  "score": number,
  "recommendation": "adopt" | "review" | "reject",
  "coreQuestion": "string (40 chars max)"
}
`;

const result = await client.analyzeWithJSON<TriageResult>(prompt, schema);
```

## Prompt Engineering Patterns

### Clear Instructions
```typescript
const TRIAGE_PROMPT = `
You are an AI judge evaluating personal writings for creative transformation.

Evaluate the following text against 4 criteria:

---
{text}
---

CRITERIA:
1. Has specifics: Contains concrete situations, not abstract thoughts
2. Can be core phrase: Can condense to one essential question (<40 chars)
3. Is transferable: Has universal relevance, not overly personal
4. Is non-harmful: Constructive, won't harm readers

OUTPUT FORMAT:
Respond with ONLY valid JSON matching this structure:
{
  "checks": {
    "hasSpecifics": { "pass": true/false, "reason": "max 30 chars" },
    "canBeCorePhrase": { "pass": true/false, "reason": "max 30 chars" },
    "isTransferable": { "pass": true/false, "reason": "max 30 chars" },
    "isNonHarmful": { "pass": true/false, "reason": "max 30 chars" }
  },
  "score": 0-4,
  "recommendation": "adopt" | "review" | "reject",
  "coreQuestion": "one sentence, 40 chars max"
}
`;
```

### Temperature Guidelines
- **0.0-0.3**: Deterministic, factual (analysis, classification, JSON output)
- **0.4-0.7**: Balanced (general questions, moderate creativity)
- **0.8-1.0**: Creative (brainstorming, diverse outputs)

For this project:
- Triage: `0.3` (objective evaluation)
- Synthesis questions: `0.7` (creative exploration)

## Error Handling

### Robust API Calls
```typescript
async callWithRetry<T>(
  fn: () => Promise<T>,
  maxRetries = 3,
  delay = 1000
): Promise<T> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      const isLastAttempt = i === maxRetries - 1;

      // Don't retry on auth errors
      if (error.status === 401 || error.status === 403) {
        throw new Error('Invalid API key');
      }

      if (isLastAttempt) {
        throw error;
      }

      // Exponential backoff
      await new Promise(resolve => setTimeout(resolve, delay * Math.pow(2, i)));
    }
  }

  throw new Error('Max retries exceeded');
}
```

### User-Facing Error Messages
```typescript
try {
  const result = await triageAnalyzer.analyze(text);
} catch (error) {
  if (error.message.includes('Invalid API key')) {
    new Notice('API key is invalid. Check plugin settings.', 5000);
  } else if (error.message.includes('timeout')) {
    new Notice('Request timed out. Please try again.', 5000);
  } else {
    new Notice('AI analysis failed. You can triage manually.', 5000);
  }

  // Fallback to manual mode
  return null;
}
```

## Cost Management

### Token Estimation
- 1 token ≈ 4 characters (English)
- 1000 tokens ≈ 750 words

For this project:
- Triage prompt: ~500 tokens
- Synthesis prompt: ~300 tokens
- Responses: 500-1000 tokens

### Cost per Operation (Claude 3.5 Sonnet)
- Input: $3 per million tokens
- Output: $15 per million tokens

Estimated cost per weaklog entry: $0.01-0.02

### Optimization
- Use lower max_tokens when possible
- Cache prompts for repeated calls (future feature)
- Use Haiku model for simpler tasks (future feature)

## Testing LLM Integration

### Mock Client for Testing
```typescript
class MockLLMClient extends LLMClient {
  async complete(prompt: string): Promise<string> {
    // Return deterministic responses for testing
    if (prompt.includes('evaluate')) {
      return JSON.stringify({
        checks: {
          hasSpecifics: { pass: true, reason: "Test reason" },
          // ...
        },
        score: 4,
        recommendation: "adopt",
        coreQuestion: "Test question?"
      });
    }

    return "Mock response";
  }
}
```

### Integration Testing
1. Set up test API key in environment
2. Test with sample inputs
3. Validate JSON parsing
4. Test error scenarios (invalid key, timeout, malformed JSON)

## Security

- **Never log API keys**: Redact in console/debug output
- **Validate API responses**: Check for malicious content injection
- **Rate limiting**: Respect API rate limits (50 requests/min for tier 1)
- **User data**: Never send sensitive personal data to API without consent

## Resources

- Anthropic API Docs: https://docs.anthropic.com/en/api/
- SDK on GitHub: https://github.com/anthropics/anthropic-sdk-typescript
- Prompt Engineering Guide: https://docs.anthropic.com/en/docs/prompt-engineering
