import fs from 'fs';
import path from 'path';

export function collectProjectSourceFiles(
  rootDir: string = process.cwd(),
  maxFiles = 50
): Record<string, string> {
  const result: Record<string, string> = {};
  const ignores = ['node_modules', '.git', 'dist', '.bugtwin-sandboxes', '.system_generated', 'tmp'];

  function scan(currentDir: string) {
    if (Object.keys(result).length >= maxFiles) return;

    let entries: fs.Dirent[] = [];
    try {
      entries = fs.readdirSync(currentDir, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      if (ignores.includes(entry.name)) continue;
      if (entry.name.startsWith('.')) continue;

      const fullPath = path.join(currentDir, entry.name);
      const relativePath = path.relative(rootDir, fullPath).replace(/\\/g, '/');

      if (entry.isDirectory()) {
        scan(fullPath);
      } else if (entry.isFile()) {
        if (
          (entry.name.endsWith('.js') || entry.name.endsWith('.ts') || entry.name.endsWith('.json')) &&
          !entry.name.endsWith('.d.ts') &&
          !entry.name.includes('.test.') &&
          !entry.name.includes('.spec.')
        ) {
          try {
            result[relativePath] = fs.readFileSync(fullPath, 'utf8');
          } catch {}
        }
      }
    }
  }

  scan(rootDir);
  return result;
}
