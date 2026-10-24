import OpenAI from 'openai';

export interface AgentConfig {
  apiKey?: string;
  model?: string;
  baseURL?: string;
}

export class OpenAIClientWrapper {
  private client: OpenAI | null = null;
  private model: string;

  constructor(config: AgentConfig = {}) {
    const apiKey = config.apiKey || process.env.OPENAI_API_KEY;
    this.model = config.model || process.env.OPENAI_MODEL || 'gpt-4o';

    if (apiKey) {
      this.client = new OpenAI({
        apiKey,
        baseURL: config.baseURL || process.env.OPENAI_BASE_URL
      });
    }
  }

  public isConfigured(): boolean {
    return Boolean(this.client);
  }

  public getModel(): string {
    return this.model;
  }

  public async completePrompt(systemPrompt: string, userPrompt: string): Promise<string> {
    if (!this.client) {
      throw new Error(
        'OPENAI_API_KEY environment variable is not configured. Set it in your terminal or .env file.'
      );
    }

    const response = await this.client.chat.completions.create({
      model: this.model,
      temperature: 0.2,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ]
    });

    return response.choices[0]?.message?.content?.trim() || '';
  }
}
