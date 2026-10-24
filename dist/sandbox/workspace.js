"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.EphemeralWorkspace = void 0;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const os_1 = __importDefault(require("os"));
const uuid_1 = require("uuid");
class EphemeralWorkspace {
    baseDir;
    sandboxDir;
    sessionId;
    constructor(baseDir = process.cwd()) {
        this.baseDir = path_1.default.resolve(baseDir);
        this.sessionId = `sandbox-${Date.now()}-${(0, uuid_1.v4)().substring(0, 6)}`;
        this.sandboxDir = path_1.default.join(os_1.default.tmpdir(), 'bugtwin-sandboxes', this.sessionId);
    }
    getSandboxPath() {
        return this.sandboxDir;
    }
    getSessionId() {
        return this.sessionId;
    }
    async setup() {
        if (!fs_1.default.existsSync(this.sandboxDir)) {
            fs_1.default.mkdirSync(this.sandboxDir, { recursive: true });
        }
        this.copyDirRecursive(this.baseDir, this.sandboxDir, [
            '.git',
            '.bugtwin-sandboxes',
            '.bugtwin.json',
            'dist',
            'tmp',
            '.system_generated'
        ]);
        return this.sandboxDir;
    }
    copyDirRecursive(src, dest, ignores) {
        const entries = fs_1.default.readdirSync(src, { withFileTypes: true });
        for (const entry of entries) {
            if (ignores.includes(entry.name))
                continue;
            const srcPath = path_1.default.join(src, entry.name);
            const destPath = path_1.default.join(dest, entry.name);
            if (entry.isDirectory()) {
                if (entry.name === 'node_modules') {
                    // On Windows/Linux, create junction / symlink for node_modules to avoid copying gigabytes
                    try {
                        fs_1.default.symlinkSync(srcPath, destPath, 'junction');
                    }
                    catch {
                        // If symlink fails, skip or handle
                    }
                    continue;
                }
                if (!fs_1.default.existsSync(destPath)) {
                    fs_1.default.mkdirSync(destPath, { recursive: true });
                }
                this.copyDirRecursive(srcPath, destPath, ignores);
            }
            else if (entry.isFile()) {
                fs_1.default.copyFileSync(srcPath, destPath);
            }
        }
    }
    writeFile(relativePath, content) {
        const target = path_1.default.join(this.sandboxDir, relativePath);
        const dir = path_1.default.dirname(target);
        if (!fs_1.default.existsSync(dir)) {
            fs_1.default.mkdirSync(dir, { recursive: true });
        }
        fs_1.default.writeFileSync(target, content, 'utf8');
    }
    readFile(relativePath) {
        const target = path_1.default.join(this.sandboxDir, relativePath);
        return fs_1.default.readFileSync(target, 'utf8');
    }
    exists(relativePath) {
        const target = path_1.default.join(this.sandboxDir, relativePath);
        return fs_1.default.existsSync(target);
    }
    cleanup() {
        try {
            if (fs_1.default.existsSync(this.sandboxDir)) {
                fs_1.default.rmSync(this.sandboxDir, { recursive: true, force: true });
            }
        }
        catch {
            // Ignore cleanup error on windows if files locked
        }
    }
}
exports.EphemeralWorkspace = EphemeralWorkspace;
