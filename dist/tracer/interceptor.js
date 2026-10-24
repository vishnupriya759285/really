"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ExecutionInterceptor = void 0;
const http_1 = __importDefault(require("http"));
const https_1 = __importDefault(require("https"));
const uuid_1 = require("uuid");
class ExecutionInterceptor {
    sanitizer;
    onNetworkCall;
    onBreadcrumb;
    originalHttpLaunch;
    originalHttpsLaunch;
    originalConsole = {
        log: console.log,
        warn: console.warn,
        error: console.error,
        info: console.info
    };
    constructor(sanitizer, onNetworkCall, onBreadcrumb) {
        this.sanitizer = sanitizer;
        this.onNetworkCall = onNetworkCall;
        this.onBreadcrumb = onBreadcrumb;
    }
    install() {
        this.installHttpInterceptors();
        this.installConsoleInterceptors();
    }
    installConsoleInterceptors() {
        const wrapConsole = (type, origFn) => {
            return (...args) => {
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
    installHttpInterceptors() {
        const wrapRequest = (origRequest, protocol) => {
            const self = this;
            return function (...args) {
                const callId = (0, uuid_1.v4)();
                const startTime = Date.now();
                let options = args[0];
                let callback = args[1];
                let url = '';
                let method = 'GET';
                let headers = {};
                if (typeof options === 'string') {
                    url = options;
                }
                else if (options instanceof URL) {
                    url = options.toString();
                }
                else if (options && typeof options === 'object') {
                    method = options.method || 'GET';
                    headers = { ...(options.headers || {}) };
                    const host = options.host || options.hostname || 'localhost';
                    const port = options.port ? `:${options.port}` : '';
                    const path = options.path || '/';
                    url = `${protocol}//${host}${port}${path}`;
                }
                const networkRecord = {
                    id: callId,
                    timestamp: startTime,
                    method,
                    url,
                    headers: self.sanitizer.sanitizeHeaders(headers)
                };
                const clientReq = origRequest.apply(this, args);
                // Capture request body chunks
                const origWrite = clientReq.write;
                const origEnd = clientReq.end;
                const reqChunks = [];
                clientReq.write = function (chunk, ...writeArgs) {
                    if (chunk) {
                        reqChunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
                    }
                    return origWrite.apply(clientReq, [chunk, ...writeArgs]);
                };
                clientReq.end = function (chunk, ...endArgs) {
                    if (chunk) {
                        reqChunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
                    }
                    if (reqChunks.length > 0) {
                        const rawBody = Buffer.concat(reqChunks).toString('utf8');
                        try {
                            networkRecord.requestBody = self.sanitizer.sanitizeValue(JSON.parse(rawBody));
                        }
                        catch {
                            networkRecord.requestBody = self.sanitizer.sanitizeValue(rawBody);
                        }
                    }
                    return origEnd.apply(clientReq, [chunk, ...endArgs]);
                };
                clientReq.on('response', (res) => {
                    networkRecord.status = res.statusCode;
                    networkRecord.responseHeaders = self.sanitizer.sanitizeHeaders(res.headers);
                    const resChunks = [];
                    res.on('data', (chunk) => {
                        resChunks.push(chunk);
                    });
                    res.on('end', () => {
                        networkRecord.durationMs = Date.now() - startTime;
                        if (resChunks.length > 0) {
                            const rawBody = Buffer.concat(resChunks).toString('utf8');
                            try {
                                networkRecord.responseBody = self.sanitizer.sanitizeValue(JSON.parse(rawBody));
                            }
                            catch {
                                networkRecord.responseBody = self.sanitizer.sanitizeValue(rawBody);
                            }
                        }
                        self.onNetworkCall(networkRecord);
                    });
                });
                clientReq.on('error', (err) => {
                    networkRecord.durationMs = Date.now() - startTime;
                    networkRecord.error = err.message;
                    self.onNetworkCall(networkRecord);
                });
                return clientReq;
            };
        };
        this.originalHttpLaunch = http_1.default.request;
        this.originalHttpsLaunch = https_1.default.request;
        http_1.default.request = wrapRequest(http_1.default.request, 'http:');
        https_1.default.request = wrapRequest(https_1.default.request, 'https:');
    }
    uninstall() {
        if (this.originalHttpLaunch)
            http_1.default.request = this.originalHttpLaunch;
        if (this.originalHttpsLaunch)
            https_1.default.request = this.originalHttpsLaunch;
        console.log = this.originalConsole.log;
        console.warn = this.originalConsole.warn;
        console.error = this.originalConsole.error;
    }
}
exports.ExecutionInterceptor = ExecutionInterceptor;
