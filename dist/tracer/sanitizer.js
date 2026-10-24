"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ZeroTrustSanitizer = void 0;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const DEFAULT_BLOCKED_HEADERS = [
    'authorization',
    'cookie',
    'set-cookie',
    'x-api-key',
    'x-auth-token',
    'proxy-authorization',
    'session-token',
    'secret'
];
const DEFAULT_BLOCKED_KEYS = [
    'password',
    'pass',
    'secret',
    'token',
    'accessToken',
    'refreshToken',
    'apiKey',
    'api_key',
    'auth',
    'private_key',
    'privateKey',
    'ssn',
    'credit_card',
    'creditCard',
    'cvv',
    'pin'
];
// Patterns for strings
const JWT_PATTERN = /eyJ[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}/g;
const BEARER_PATTERN = /Bearer\s+[a-zA-Z0-9._~+/-]+=*/gi;
const OPENAI_KEY_PATTERN = /sk-[a-zA-Z0-9_-]{20,}/gi;
const EMAIL_PATTERN = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/gi;
class ZeroTrustSanitizer {
    config;
    fieldsRedactedCount = 0;
    tokensMaskedCount = 0;
    constructor(customConfig) {
        const fileConfig = this.loadConfigFile();
        this.config = {
            blockedHeaders: [
                ...DEFAULT_BLOCKED_HEADERS,
                ...(fileConfig?.blockedHeaders || []),
                ...(customConfig?.blockedHeaders || [])
            ].map(h => h.toLowerCase()),
            blockedKeys: [
                ...DEFAULT_BLOCKED_KEYS,
                ...(fileConfig?.blockedKeys || []),
                ...(customConfig?.blockedKeys || [])
            ].map(k => k.toLowerCase()),
            customPatterns: [
                ...(fileConfig?.customPatterns || []),
                ...(customConfig?.customPatterns || [])
            ]
        };
    }
    loadConfigFile() {
        try {
            const configPath = path_1.default.resolve(process.cwd(), '.bugtwinignore.json');
            if (fs_1.default.existsSync(configPath)) {
                const content = fs_1.default.readFileSync(configPath, 'utf8');
                return JSON.parse(content);
            }
        }
        catch {
            // Ignore config read failures
        }
        return null;
    }
    getStats() {
        return {
            fieldsRedacted: this.fieldsRedactedCount,
            tokensMasked: this.tokensMaskedCount
        };
    }
    sanitizeHeaders(headers) {
        if (!headers || typeof headers !== 'object')
            return {};
        const sanitized = {};
        for (const [key, value] of Object.entries(headers)) {
            const lowerKey = key.toLowerCase();
            if (this.config.blockedHeaders?.includes(lowerKey)) {
                sanitized[key] = '[REDACTED_HEADER]';
                this.fieldsRedactedCount++;
            }
            else {
                sanitized[key] = this.sanitizeValue(value);
            }
        }
        return sanitized;
    }
    sanitizeValue(val) {
        if (val === null || val === undefined)
            return val;
        if (typeof val === 'string') {
            let result = val;
            if (JWT_PATTERN.test(result)) {
                result = result.replace(JWT_PATTERN, '[REDACTED_JWT]');
                this.tokensMaskedCount++;
            }
            if (BEARER_PATTERN.test(result)) {
                result = result.replace(BEARER_PATTERN, 'Bearer [REDACTED_TOKEN]');
                this.tokensMaskedCount++;
            }
            if (OPENAI_KEY_PATTERN.test(result)) {
                result = result.replace(OPENAI_KEY_PATTERN, 'sk-[REDACTED_KEY]');
                this.tokensMaskedCount++;
            }
            if (EMAIL_PATTERN.test(result)) {
                result = result.replace(EMAIL_PATTERN, (email) => {
                    this.tokensMaskedCount++;
                    const [user, domain] = email.split('@');
                    return `${user.substring(0, 1)}***@${domain}`;
                });
            }
            if (this.config.customPatterns) {
                for (const custom of this.config.customPatterns) {
                    try {
                        const regex = new RegExp(custom.pattern, 'g');
                        if (regex.test(result)) {
                            result = result.replace(regex, custom.replacement);
                            this.tokensMaskedCount++;
                        }
                    }
                    catch {
                        // Ignore invalid regex
                    }
                }
            }
            return result;
        }
        if (Array.isArray(val)) {
            return val.map(item => this.sanitizeValue(item));
        }
        if (typeof val === 'object') {
            const sanitizedObj = {};
            for (const [k, v] of Object.entries(val)) {
                const lowerKey = k.toLowerCase();
                if (this.config.blockedKeys?.some(blocked => lowerKey.includes(blocked))) {
                    sanitizedObj[k] = '[REDACTED_SECRET]';
                    this.fieldsRedactedCount++;
                }
                else {
                    sanitizedObj[k] = this.sanitizeValue(v);
                }
            }
            return sanitizedObj;
        }
        return val;
    }
    sanitizeEnvironment(env) {
        const sanitizedEnv = {};
        for (const [key, value] of Object.entries(env)) {
            if (!value)
                continue;
            const lower = key.toLowerCase();
            const isSensitiveKey = this.config.blockedKeys?.some(blocked => lower.includes(blocked)) ||
                lower.includes('key') ||
                lower.includes('secret') ||
                lower.includes('pass') ||
                lower.includes('token') ||
                lower.includes('cert');
            if (isSensitiveKey) {
                sanitizedEnv[key] = '[REDACTED_ENV_VAR]';
                this.fieldsRedactedCount++;
            }
            else {
                sanitizedEnv[key] = this.sanitizeValue(value);
            }
        }
        return sanitizedEnv;
    }
}
exports.ZeroTrustSanitizer = ZeroTrustSanitizer;
