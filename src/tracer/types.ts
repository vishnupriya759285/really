export interface NetworkCallRecord {
  id: string;
  timestamp: number;
  method: string;
  url: string;
  headers: Record<string, string | string[] | undefined>;
  requestBody?: any;
  status?: number;
  responseHeaders?: Record<string, string | string[] | undefined>;
  responseBody?: any;
  durationMs?: number;
  error?: string;
}

export interface BreadcrumbRecord {
  type: 'log' | 'warn' | 'error' | 'navigation' | 'custom' | 'db' | 'fs';
  message: string;
  timestamp: number;
  data?: any;
}

export interface ExecutionError {
  name: string;
  message: string;
  stack?: string;
  code?: string | number;
  timestamp: number;
  unhandled: boolean;
}

export interface EnvironmentSnapshot {
  nodeVersion: string;
  platform: string;
  arch: string;
  timezone: string;
  timestamp: number;
  env: Record<string, string>;
}

export interface BugTwinTrace {
  version: '1.0';
  traceId: string;
  appName: string;
  command?: string;
  startedAt: number;
  endedAt: number;
  status: 'failed' | 'success';
  error?: ExecutionError;
  breadcrumbs: BreadcrumbRecord[];
  networkCalls: NetworkCallRecord[];
  environment: EnvironmentSnapshot;
  sanitizationSummary: {
    fieldsRedacted: number;
    tokensMasked: number;
  };
}

export interface SanitizerConfig {
  blockedHeaders?: string[];
  blockedKeys?: string[];
  customPatterns?: { pattern: string; replacement: string }[];
}
