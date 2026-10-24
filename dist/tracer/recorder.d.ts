import { BugTwinTrace, BreadcrumbRecord } from './types';
export interface RecorderOptions {
    appName?: string;
    command?: string;
    outputFilePath?: string;
}
export declare class TraceRecorder {
    private traceId;
    private appName;
    private command?;
    private outputFilePath;
    private startedAt;
    private breadcrumbs;
    private networkCalls;
    private caughtError?;
    private sanitizer;
    private interceptor;
    private isFinalized;
    constructor(options?: RecorderOptions);
    start(): void;
    addBreadcrumb(type: BreadcrumbRecord['type'], message: string, data?: any): void;
    recordError(err: Error, unhandled?: boolean): void;
    finalize(): BugTwinTrace;
    getTrace(): BugTwinTrace;
}
