"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.collectProjectSourceFiles = collectProjectSourceFiles;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
function collectProjectSourceFiles(rootDir = process.cwd(), maxFiles = 50) {
    const result = {};
    const ignores = ['node_modules', '.git', 'dist', '.bugtwin-sandboxes', '.system_generated', 'tmp'];
    function scan(currentDir) {
        if (Object.keys(result).length >= maxFiles)
            return;
        let entries = [];
        try {
            entries = fs_1.default.readdirSync(currentDir, { withFileTypes: true });
        }
        catch {
            return;
        }
        for (const entry of entries) {
            if (ignores.includes(entry.name))
                continue;
            if (entry.name.startsWith('.'))
                continue;
            const fullPath = path_1.default.join(currentDir, entry.name);
            const relativePath = path_1.default.relative(rootDir, fullPath).replace(/\\/g, '/');
            if (entry.isDirectory()) {
                scan(fullPath);
            }
            else if (entry.isFile()) {
                if ((entry.name.endsWith('.js') || entry.name.endsWith('.ts') || entry.name.endsWith('.json')) &&
                    !entry.name.endsWith('.d.ts') &&
                    !entry.name.includes('.test.') &&
                    !entry.name.includes('.spec.')) {
                    try {
                        result[relativePath] = fs_1.default.readFileSync(fullPath, 'utf8');
                    }
                    catch { }
                }
            }
        }
    }
    scan(rootDir);
    return result;
}
