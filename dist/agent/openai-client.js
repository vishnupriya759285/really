"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.OpenAIClientWrapper = void 0;
const openai_1 = __importDefault(require("openai"));
class OpenAIClientWrapper {
    client = null;
    model;
    constructor(config = {}) {
        const apiKey = config.apiKey || process.env.OPENAI_API_KEY;
        this.model = config.model || process.env.OPENAI_MODEL || 'gpt-4o';
        if (apiKey) {
            this.client = new openai_1.default({
                apiKey,
                baseURL: config.baseURL || process.env.OPENAI_BASE_URL
            });
        }
    }
    isConfigured() {
        return Boolean(this.client);
    }
    getModel() {
        return this.model;
    }
    async completePrompt(systemPrompt, userPrompt) {
        if (!this.client) {
            throw new Error('OPENAI_API_KEY environment variable is not configured. Set it in your terminal or .env file.');
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
exports.OpenAIClientWrapper = OpenAIClientWrapper;
