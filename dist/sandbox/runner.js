"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SandboxRunner = void 0;
const child_process_1 = require("child_process");
class SandboxRunner {
    static async executeCommand(command, args, options) {
        const startTime = Date.now();
        const timeoutMs = options.timeoutMs || 30000;
        const mergedEnv = {
            ...process.env,
            ...(options.env || {}),
            BUGTWIN_SANDBOX: 'true',
            ...(options.mockServerPort ? { BUGTWIN_MOCK_PORT: String(options.mockServerPort) } : {})
        };
        let stdout = '';
        let stderr = '';
        let timedOut = false;
        return new Promise((resolve) => {
            // Use shell on Windows
            const isWindows = process.platform === 'win32';
            const child = (0, child_process_1.spawn)(command, args, {
                cwd: options.cwd,
                env: mergedEnv,
                shell: isWindows,
                stdio: ['ignore', 'pipe', 'pipe']
            });
            const timer = setTimeout(() => {
                timedOut = true;
                child.kill('SIGKILL');
            }, timeoutMs);
            child.stdout?.on('data', (data) => {
                const text = data.toString('utf8');
                stdout += text;
                if (options.onStdout)
                    options.onStdout(text);
            });
            child.stderr?.on('data', (data) => {
                const text = data.toString('utf8');
                stderr += text;
                if (options.onStderr)
                    options.onStderr(text);
            });
            child.on('close', (exitCode) => {
                clearTimeout(timer);
                resolve({
                    exitCode,
                    stdout,
                    stderr,
                    durationMs: Date.now() - startTime,
                    timedOut
                });
            });
            child.on('error', (err) => {
                clearTimeout(timer);
                stderr += `\n[Spawn Error] ${err.message}`;
                resolve({
                    exitCode: 1,
                    stdout,
                    stderr,
                    durationMs: Date.now() - startTime,
                    timedOut
                });
            });
        });
    }
    static async runTestFile(testFilePath, options) {
        // Run with Node's built-in test runner or jest
        return this.executeCommand('node', ['--test', testFilePath], options);
    }
}
exports.SandboxRunner = SandboxRunner;
