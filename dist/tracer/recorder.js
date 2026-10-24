"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TraceRecorder = void 0;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const uuid_1 = require("uuid");
const sanitizer_1 = require("./sanitizer");
const interceptor_1 = require("./interceptor");
class TraceRecorder {
    traceId;
    appName;
    command;
    outputFilePath;
    startedAt;
    breadcrumbs = [];
    networkCalls = [];
    caughtError;
    sanitizer;
    interceptor;
    isFinalized = false;
    constructor(options = {}) {
        this.traceId = `bt-trace-${Date.now()}-${(0, uuid_1.v4)().substring(0, 8)}`;
        this.appName = options.appName || path_1.default.basename(process.cwd());
        this.command = options.command;
        this.outputFilePath = options.outputFilePath || path_1.default.resolve(process.cwd(), '.bugtwin.json');
        this.startedAt = Date.now();
        this.sanitizer = new sanitizer_1.ZeroTrustSanitizer();
        this.interceptor = new interceptor_1.ExecutionInterceptor(this.sanitizer, (record) => this.networkCalls.push(record), (breadcrumb) => this.breadcrumbs.push(breadcrumb));
    }
    start() {
        this.interceptor.install();
        process.on('uncaughtException', (err) => {
            this.recordError(err, true);
            this.finalize();
            process.exit(1);
        });
        process.on('unhandledRejection', (reason) => {
            const err = reason instanceof Error ? reason : new Error(String(reason));
            this.recordError(err, true);
            this.finalize();
            process.exit(1);
        });
        process.on('exit', () => {
            if (!this.isFinalized) {
                this.finalize();
            }
        });
    }
    addBreadcrumb(type, message, data) {
        this.breadcrumbs.push({
            type,
            message: this.sanitizer.sanitizeValue(message),
            timestamp: Date.now(),
            data: this.sanitizer.sanitizeValue(data)
        });
    }
    recordError(err, unhandled = false) {
        this.caughtError = {
            name: err.name || 'Error',
            message: this.sanitizer.sanitizeValue(err.message),
            stack: this.sanitizer.sanitizeValue(err.stack),
            code: err.code,
            timestamp: Date.now(),
            unhandled
        };
    }
    finalize() {
        if (this.isFinalized) {
            return this.getTrace();
        }
        this.isFinalized = true;
        this.interceptor.uninstall();
        const trace = this.getTrace();
        // Persist to disk
        try {
            const dir = path_1.default.dirname(this.outputFilePath);
            if (!fs_1.default.existsSync(dir)) {
                fs_1.default.mkdirSync(dir, { recursive: true });
            }
            fs_1.default.writeFileSync(this.outputFilePath, JSON.stringify(trace, null, 2), 'utf8');
            console.error(`\n[BugTwin] Execution trace saved to: ${this.outputFilePath}`);
            console.error(`[BugTwin] Trace ID: ${this.traceId} (Status: ${trace.status})`);
            if (trace.sanitizationSummary.fieldsRedacted > 0 || trace.sanitizationSummary.tokensMasked > 0) {
                console.error(`[BugTwin] Zero-Trust Sanitizer masked ${trace.sanitizationSummary.tokensMasked} tokens and redacted ${trace.sanitizationSummary.fieldsRedacted} fields.`);
            }
        }
        catch (saveErr) {
            console.error(`[BugTwin] Failed to save trace file: ${saveErr.message}`);
        }
        return trace;
    }
    getTrace() {
        const stats = this.sanitizer.getStats();
        return {
            version: '1.0',
            traceId: this.traceId,
            appName: this.appName,
            command: this.command,
            startedAt: this.startedAt,
            endedAt: Date.now(),
            status: this.caughtError ? 'failed' : 'success',
            error: this.caughtError,
            breadcrumbs: this.breadcrumbs,
            networkCalls: this.networkCalls,
            environment: {
                nodeVersion: process.version,
                platform: process.platform,
                arch: process.arch,
                timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
                timestamp: Date.now(),
                env: this.sanitizer.sanitizeEnvironment(process.env)
            },
            sanitizationSummary: stats
        };
    }
}
exports.TraceRecorder = TraceRecorder;
