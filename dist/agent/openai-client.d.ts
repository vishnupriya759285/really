export interface AgentConfig {
    apiKey?: string;
    model?: string;
    baseURL?: string;
}
export declare class OpenAIClientWrapper {
    private client;
    private model;
    constructor(config?: AgentConfig);
    isConfigured(): boolean;
    getModel(): string;
    completePrompt(systemPrompt: string, userPrompt: string): Promise<string>;
}
