import http from 'http';
import { NetworkCallRecord } from '../tracer/types';

export class DeterministicMockServer {
  private server?: http.Server;
  private port: number;
  private networkCalls: NetworkCallRecord[];
  private matchIndex = 0;

  constructor(networkCalls: NetworkCallRecord[], preferredPort = 9876) {
    this.networkCalls = networkCalls;
    this.port = preferredPort;
  }

  public async start(): Promise<number> {
    return new Promise((resolve, reject) => {
      this.server = http.createServer((req, res) => {
        const method = req.method || 'GET';
        const reqUrl = req.url || '/';

        // Match recorded network call
        const matched = this.findMatchingCall(method, reqUrl);

        if (matched) {
          res.writeHead(matched.status || 200, {
            'content-type': 'application/json',
            'x-bugtwin-mocked': 'true',
            ...(matched.responseHeaders || {})
          });

          const bodyContent =
            typeof matched.responseBody === 'object'
              ? JSON.stringify(matched.responseBody)
              : String(matched.responseBody || '');

          res.end(bodyContent);
        } else {
          res.writeHead(404, { 'content-type': 'application/json' });
          res.end(JSON.stringify({ error: `[BugTwin Mock] No matching recorded call for ${method} ${reqUrl}` }));
        }
      });

      this.server.listen(this.port, () => {
        resolve(this.port);
      });

      this.server.on('error', (err: any) => {
        if (err.code === 'EADDRINUSE') {
          this.port += 1;
          this.server?.listen(this.port);
        } else {
          reject(err);
        }
      });
    });
  }

  private findMatchingCall(method: string, reqUrl: string): NetworkCallRecord | undefined {
    // 1. Try sequential match first
    for (let i = this.matchIndex; i < this.networkCalls.length; i++) {
      const call = this.networkCalls[i];
      if (this.isMatch(call, method, reqUrl)) {
        this.matchIndex = i + 1;
        return call;
      }
    }

    // 2. Fallback to any match
    return this.networkCalls.find(c => this.isMatch(c, method, reqUrl));
  }

  private isMatch(call: NetworkCallRecord, method: string, reqUrl: string): boolean {
    if (call.method.toUpperCase() !== method.toUpperCase()) return false;
    try {
      const parsedCallUrl = new URL(call.url);
      const incomingPath = reqUrl.split('?')[0];
      return parsedCallUrl.pathname === incomingPath || call.url.includes(reqUrl);
    } catch {
      return call.url.includes(reqUrl);
    }
  }

  public stop(): Promise<void> {
    return new Promise((resolve) => {
      if (this.server) {
        this.server.close(() => resolve());
      } else {
        resolve();
      }
    });
  }

  public getPort(): number {
    return this.port;
  }
}
