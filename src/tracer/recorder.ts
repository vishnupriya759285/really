import fs from 'fs';
import path from 'path';
import os from 'os';
import { v4 as uuidv4 } from 'uuid';
import { BugTwinTrace, ExecutionError, NetworkCallRecord, BreadcrumbRecord } from './types';
import { ZeroTrustSanitizer } from './sanitizer';
import { ExecutionInterceptor } from './interceptor';

export interface RecorderOptions {
  appName?: string;
  command?: string;
  outputFilePath?: string;
}

export class TraceRecorder {
  private traceId: string;
  private appName: string;
  private command?: string;
  private outputFilePath: string;
  private startedAt: number;
  private breadcrumbs: BreadcrumbRecord[] = [];
  private networkCalls: NetworkCallRecord[] = [];
  private caughtError?: ExecutionError;
  private sanitizer: ZeroTrustSanitizer;
  private interceptor: ExecutionInterceptor;
  private isFinalized = false;

  constructor(options: RecorderOptions = {}) {
    this.traceId = `bt-trace-${Date.now()}-${uuidv4().substring(0, 8)}`;
    this.appName = options.appName || path.basename(process.cwd());
    this.command = options.command;
    this.outputFilePath = options.outputFilePath || path.resolve(process.cwd(), '.bugtwin.json');
    this.startedAt = Date.now();

    this.sanitizer = new ZeroTrustSanitizer();
    this.interceptor = new ExecutionInterceptor(
      this.sanitizer,
      (record) => this.networkCalls.push(record),
      (breadcrumb) => this.breadcrumbs.push(breadcrumb)
    );
  }

  public start() {
    this.interceptor.install();

    process.on('uncaughtException', (err: Error) => {
      this.recordError(err, true);
      this.finalize();
      process.exit(1);
    });

    process.on('unhandledRejection', (reason: any) => {
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

  public addBreadcrumb(type: BreadcrumbRecord['type'], message: string, data?: any) {
    this.breadcrumbs.push({
      type,
      message: this.sanitizer.sanitizeValue(message),
      timestamp: Date.now(),
      data: this.sanitizer.sanitizeValue(data)
    });
  }

  public recordError(err: Error, unhandled = false) {
    this.caughtError = {
      name: err.name || 'Error',
      message: this.sanitizer.sanitizeValue(err.message),
      stack: this.sanitizer.sanitizeValue(err.stack),
      code: (err as any).code,
      timestamp: Date.now(),
      unhandled
    };
  }

  public finalize(): BugTwinTrace {
    if (this.isFinalized) {
      return this.getTrace();
    }
    this.isFinalized = true;
    this.interceptor.uninstall();

    const trace = this.getTrace();

    // Persist to disk
    try {
      const dir = path.dirname(this.outputFilePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(this.outputFilePath, JSON.stringify(trace, null, 2), 'utf8');
      console.error(`\n[BugTwin] Execution trace saved to: ${this.outputFilePath}`);
      console.error(`[BugTwin] Trace ID: ${this.traceId} (Status: ${trace.status})`);
      if (trace.sanitizationSummary.fieldsRedacted > 0 || trace.sanitizationSummary.tokensMasked > 0) {
        console.error(
          `[BugTwin] Zero-Trust Sanitizer masked ${trace.sanitizationSummary.tokensMasked} tokens and redacted ${trace.sanitizationSummary.fieldsRedacted} fields.`
        );
      }
    } catch (saveErr: any) {
      console.error(`[BugTwin] Failed to save trace file: ${saveErr.message}`);
    }

    return trace;
  }

  public getTrace(): BugTwinTrace {
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
