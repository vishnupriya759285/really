import fs from 'fs';
import path from 'path';
import os from 'os';
import { v4 as uuidv4 } from 'uuid';

export class EphemeralWorkspace {
  private baseDir: string;
  private sandboxDir: string;
  private sessionId: string;

  constructor(baseDir: string = process.cwd()) {
    this.baseDir = path.resolve(baseDir);
    this.sessionId = `sandbox-${Date.now()}-${uuidv4().substring(0, 6)}`;
    this.sandboxDir = path.join(os.tmpdir(), 'bugtwin-sandboxes', this.sessionId);
  }

  public getSandboxPath(): string {
    return this.sandboxDir;
  }

  public getSessionId(): string {
    return this.sessionId;
  }

  public async setup(): Promise<string> {
    if (!fs.existsSync(this.sandboxDir)) {
      fs.mkdirSync(this.sandboxDir, { recursive: true });
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

  private copyDirRecursive(src: string, dest: string, ignores: string[]) {
    const entries = fs.readdirSync(src, { withFileTypes: true });

    for (const entry of entries) {
      if (ignores.includes(entry.name)) continue;

      const srcPath = path.join(src, entry.name);
      const destPath = path.join(dest, entry.name);

      if (entry.isDirectory()) {
        if (entry.name === 'node_modules') {
          // On Windows/Linux, create junction / symlink for node_modules to avoid copying gigabytes
          try {
            fs.symlinkSync(srcPath, destPath, 'junction');
          } catch {
            // If symlink fails, skip or handle
          }
          continue;
        }

        if (!fs.existsSync(destPath)) {
          fs.mkdirSync(destPath, { recursive: true });
        }
        this.copyDirRecursive(srcPath, destPath, ignores);
      } else if (entry.isFile()) {
        fs.copyFileSync(srcPath, destPath);
      }
    }
  }

  public writeFile(relativePath: string, content: string) {
    const target = path.join(this.sandboxDir, relativePath);
    const dir = path.dirname(target);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(target, content, 'utf8');
  }

  public readFile(relativePath: string): string {
    const target = path.join(this.sandboxDir, relativePath);
    return fs.readFileSync(target, 'utf8');
  }

  public exists(relativePath: string): boolean {
    const target = path.join(this.sandboxDir, relativePath);
    return fs.existsSync(target);
  }

  public cleanup() {
    try {
      if (fs.existsSync(this.sandboxDir)) {
        fs.rmSync(this.sandboxDir, { recursive: true, force: true });
      }
    } catch {
      // Ignore cleanup error on windows if files locked
    }
  }
}
