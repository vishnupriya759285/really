import http from 'http';
import https from 'https';
import { v4 as uuidv4 } from 'uuid';
import { NetworkCallRecord, BreadcrumbRecord } from './types';
import { ZeroTrustSanitizer } from './sanitizer';

export class ExecutionInterceptor {
  private sanitizer: ZeroTrustSanitizer;
  private onNetworkCall: (record: NetworkCallRecord) => void;
  private onBreadcrumb: (record: BreadcrumbRecord) => void;
  private originalHttpLaunch?: typeof http.request;
  private originalHttpsLaunch?: typeof https.request;
  private originalConsole = {
    log: console.log,
    warn: console.warn,
    error: console.error,
    info: console.info
  };

  constructor(
    sanitizer: ZeroTrustSanitizer,
    onNetworkCall: (record: NetworkCallRecord) => void,
    onBreadcrumb: (record: BreadcrumbRecord) => void
  ) {
    this.sanitizer = sanitizer;
    this.onNetworkCall = onNetworkCall;
    this.onBreadcrumb = onBreadcrumb;
  }

  public install() {
    this.installHttpInterceptors();
    this.installConsoleInterceptors();
  }

  private installConsoleInterceptors() {
    const wrapConsole = (type: 'log' | 'warn' | 'error', origFn: (...args: any[]) => void) => {
      return (...args: any[]) => {
        const message = args
          .map(arg => (typeof arg === 'object' ? JSON.stringify(arg) : String(arg)))
          .join(' ');

        this.onBreadcrumb({
          type,
          message: this.sanitizer.sanitizeValue(message),
          timestamp: Date.now()
        });

        origFn.apply(console, args);
      };
    };

    console.log = wrapConsole('log', this.originalConsole.log);
    console.warn = wrapConsole('warn', this.originalConsole.warn);
    console.error = wrapConsole('error', this.originalConsole.error);
  }

  private installHttpInterceptors() {
    const wrapRequest = (origRequest: any, protocol: string) => {
      const self = this;
      return function (this: any, ...args: any[]) {
        const callId = uuidv4();
        const startTime = Date.now();
        let options: any = args[0];
        let callback: any = args[1];

        let url = '';
        let method = 'GET';
        let headers: Record<string, any> = {};

        if (typeof options === 'string') {
          url = options;
        } else if (options instanceof URL) {
          url = options.toString();
        } else if (options && typeof options === 'object') {
          method = options.method || 'GET';
          headers = { ...(options.headers || {}) };
          const host = options.host || options.hostname || 'localhost';
          const port = options.port ? `:${options.port}` : '';
          const path = options.path || '/';
          url = `${protocol}//${host}${port}${path}`;
        }

        const networkRecord: NetworkCallRecord = {
          id: callId,
          timestamp: startTime,
          method,
          url,
          headers: self.sanitizer.sanitizeHeaders(headers)
        };

        const clientReq: http.ClientRequest = origRequest.apply(this, args);

        // Capture request body chunks
        const origWrite = clientReq.write;
        const origEnd = clientReq.end;
        const reqChunks: Buffer[] = [];

        clientReq.write = function (chunk: any, ...writeArgs: any[]) {
          if (chunk) {
            reqChunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
          }
          return origWrite.apply(clientReq, [chunk, ...writeArgs] as any);
        };

        clientReq.end = function (chunk?: any, ...endArgs: any[]) {
          if (chunk) {
            reqChunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
          }
          if (reqChunks.length > 0) {
            const rawBody = Buffer.concat(reqChunks).toString('utf8');
            try {
              networkRecord.requestBody = self.sanitizer.sanitizeValue(JSON.parse(rawBody));
            } catch {
              networkRecord.requestBody = self.sanitizer.sanitizeValue(rawBody);
            }
          }
          return origEnd.apply(clientReq, [chunk, ...endArgs] as any);
        };

        clientReq.on('response', (res: http.IncomingMessage) => {
          networkRecord.status = res.statusCode;
          networkRecord.responseHeaders = self.sanitizer.sanitizeHeaders(res.headers);
          const resChunks: Buffer[] = [];

          res.on('data', (chunk: Buffer) => {
            resChunks.push(chunk);
          });

          res.on('end', () => {
            networkRecord.durationMs = Date.now() - startTime;
            if (resChunks.length > 0) {
              const rawBody = Buffer.concat(resChunks).toString('utf8');
              try {
                networkRecord.responseBody = self.sanitizer.sanitizeValue(JSON.parse(rawBody));
              } catch {
                networkRecord.responseBody = self.sanitizer.sanitizeValue(rawBody);
              }
            }
            self.onNetworkCall(networkRecord);
          });
        });

        clientReq.on('error', (err: Error) => {
          networkRecord.durationMs = Date.now() - startTime;
          networkRecord.error = err.message;
          self.onNetworkCall(networkRecord);
        });

        return clientReq;
      };
    };

    this.originalHttpLaunch = http.request;
    this.originalHttpsLaunch = https.request;

    (http as any).request = wrapRequest(http.request, 'http:');
    (https as any).request = wrapRequest(https.request, 'https:');
  }

  public uninstall() {
    if (this.originalHttpLaunch) (http as any).request = this.originalHttpLaunch;
    if (this.originalHttpsLaunch) (https as any).request = this.originalHttpsLaunch;
    console.log = this.originalConsole.log;
    console.warn = this.originalConsole.warn;
    console.error = this.originalConsole.error;
  }
}
