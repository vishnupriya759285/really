export declare class EphemeralWorkspace {
    private baseDir;
    private sandboxDir;
    private sessionId;
    constructor(baseDir?: string);
    getSandboxPath(): string;
    getSessionId(): string;
    setup(): Promise<string>;
    private copyDirRecursive;
    writeFile(relativePath: string, content: string): void;
    readFile(relativePath: string): string;
    exists(relativePath: string): boolean;
    cleanup(): void;
}
