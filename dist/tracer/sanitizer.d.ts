import { SanitizerConfig } from './types';
export declare class ZeroTrustSanitizer {
    private config;
    private fieldsRedactedCount;
    private tokensMaskedCount;
    constructor(customConfig?: SanitizerConfig);
    private loadConfigFile;
    getStats(): {
        fieldsRedacted: number;
        tokensMasked: number;
    };
    sanitizeHeaders(headers: Record<string, any> | undefined): Record<string, any>;
    sanitizeValue(val: any): any;
    sanitizeEnvironment(env: Record<string, string | undefined>): Record<string, string>;
}
