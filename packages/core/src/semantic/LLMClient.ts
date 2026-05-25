import type { LLMConfig, LLMRequest, LLMResponse } from '@livingdocs/shared';

/**
 * LLMClient - Unified interface for OpenAI and Anthropic APIs
 */
export class LLMClient {
  private config: LLMConfig;

  constructor(config: LLMConfig) {
    this.config = config;
  }

  /**
   * Complete a prompt using the configured LLM provider
   */
  async complete(request: LLMRequest): Promise<LLMResponse> {
    if (this.config.provider === 'openai') {
      return this.completeOpenAI(request);
    } else if (this.config.provider === 'anthropic') {
      return this.completeAnthropic(request);
    } else {
      throw new Error(`Unsupported LLM provider: ${this.config.provider}`);
    }
  }

  /**
   * Complete using OpenAI API
   */
  private async completeOpenAI(request: LLMRequest): Promise<LLMResponse> {
    const model = this.config.model || 'gpt-4o';
    const maxTokens = request.maxTokens || this.config.maxTokens || 2000;
    const temperature = request.temperature ?? this.config.temperature ?? 0.7;

    const messages: Array<{ role: string; content: string }> = [];

    if (request.systemPrompt) {
      messages.push({ role: 'system', content: request.systemPrompt });
    }

    messages.push({ role: 'user', content: request.prompt });

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.config.apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages,
        max_tokens: maxTokens,
        temperature,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OpenAI API error: ${response.status} ${error}`);
    }

    const data = await response.json();

    return {
      content: data.choices[0].message.content,
      usage: {
        promptTokens: data.usage.prompt_tokens,
        completionTokens: data.usage.completion_tokens,
        totalTokens: data.usage.total_tokens,
      },
    };
  }

  /**
   * Complete using Anthropic API
   */
  private async completeAnthropic(request: LLMRequest): Promise<LLMResponse> {
    const model = this.config.model || 'claude-3-5-sonnet-20241022';
    const maxTokens = request.maxTokens || this.config.maxTokens || 2000;
    const temperature = request.temperature ?? this.config.temperature ?? 0.7;

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.config.apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model,
        max_tokens: maxTokens,
        temperature,
        system: request.systemPrompt,
        messages: [
          { role: 'user', content: request.prompt },
        ],
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Anthropic API error: ${response.status} ${error}`);
    }

    const data = await response.json();

    return {
      content: data.content[0].text,
      usage: {
        promptTokens: data.usage.input_tokens,
        completionTokens: data.usage.output_tokens,
        totalTokens: data.usage.input_tokens + data.usage.output_tokens,
      },
    };
  }

  /**
   * Create LLMClient from environment variables
   */
  static fromEnv(): LLMClient {
    const provider = (process.env.LLM_PROVIDER || 'openai') as 'openai' | 'anthropic';
    const apiKey = provider === 'openai'
      ? process.env.OPENAI_API_KEY
      : process.env.ANTHROPIC_API_KEY;

    if (!apiKey) {
      throw new Error(`Missing API key for provider: ${provider}. Set ${provider === 'openai' ? 'OPENAI_API_KEY' : 'ANTHROPIC_API_KEY'}`);
    }

    return new LLMClient({
      provider,
      apiKey,
      model: process.env.LLM_MODEL,
      maxTokens: process.env.LLM_MAX_TOKENS ? parseInt(process.env.LLM_MAX_TOKENS) : undefined,
      temperature: process.env.LLM_TEMPERATURE ? parseFloat(process.env.LLM_TEMPERATURE) : undefined,
    });
  }
}
