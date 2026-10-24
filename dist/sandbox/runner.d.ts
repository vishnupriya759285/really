export interface RunResult {
    exitCode: number | null;
    stdout: string;
    stderr: string;
    durationMs: number;
    timedOut: boolean;
}
export interface RunnerOptions {
    cwd: string;
    env?: Record<string, string>;
    timeoutMs?: number;
    mockServerPort?: number;
    onStdout?: (data: string) => void;
    onStderr?: (data: string) => void;
}
export declare class SandboxRunner {
    static executeCommand(command: string, args: string[], options: RunnerOptions): Promise<RunResult>;
    static runTestFile(testFilePath: string, options: RunnerOptions): Promise<RunResult>;
}
