import { app } from 'electron';
import fs from 'node:fs';
import path from 'node:path';

const VAULT_DIR_NAME = 'ai-vault';
const MAX_READ_BYTES = 512 * 1024;
const MAX_WRITE_BYTES = 512 * 1024;

export const getVaultRootPath = (): string => {
  if (!app.isReady()) {
    throw new Error('Cannot access userData before app is ready.');
  }
  return path.join(app.getPath('userData'), VAULT_DIR_NAME);
};

export const ensureVaultDir = (): void => {
  fs.mkdirSync(getVaultRootPath(), { recursive: true });
};

const safeResolvedPath = (relativePath: string): string => {
  const root = path.resolve(getVaultRootPath());
  const segments = relativePath.replace(/\\/g, '/').split('/').filter(Boolean);
  if (segments.length === 0) {
    throw new Error('路径不能为空');
  }
  for (const s of segments) {
    if (s === '..' || s === '.') {
      throw new Error('路径不能包含 . 或 ..');
    }
    if (s.includes('\0')) {
      throw new Error('非法路径');
    }
  }
  const full = path.resolve(root, ...segments);
  const rel = path.relative(root, full);
  if (rel.startsWith('..') || path.isAbsolute(rel)) {
    throw new Error('路径必须位于资料夹内');
  }
  return full;
};

export const vaultListFiles = (): string[] => {
  ensureVaultDir();
  const root = getVaultRootPath();
  const out: string[] = [];

  const walk = (dir: string, prefix: string): void => {
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      const rel = prefix ? `${prefix}/${e.name}` : e.name;
      const full = path.join(dir, e.name);
      if (e.isDirectory()) {
        walk(full, rel);
      } else if (e.isFile()) {
        out.push(rel.replace(/\\/g, '/'));
      }
    }
  };

  walk(root, '');
  return out.sort();
};

export const vaultReadFile = (relativePath: string): string => {
  ensureVaultDir();
  const full = safeResolvedPath(relativePath);
  if (!fs.existsSync(full) || !fs.statSync(full).isFile()) {
    throw new Error('文件不存在');
  }
  const buf = fs.readFileSync(full);
  if (buf.length > MAX_READ_BYTES) {
    throw new Error(`文件过大（>${MAX_READ_BYTES} 字节）`);
  }
  return buf.toString('utf8');
};

export const vaultWriteFile = (relativePath: string, content: string): void => {
  ensureVaultDir();
  const utf8 = Buffer.from(content, 'utf8');
  if (utf8.length > MAX_WRITE_BYTES) {
    throw new Error(`内容过大（>${MAX_WRITE_BYTES} 字节）`);
  }
  const full = safeResolvedPath(relativePath);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, utf8, { encoding: 'utf8' });
};

/** 供 LLM 工具调用：返回 JSON 字符串，便于作为 tool 消息 content */
export const runVaultTool = (name: string, argsJson: string): string => {
  let args: Record<string, unknown>;
  try {
    args = JSON.parse(argsJson || '{}') as Record<string, unknown>;
  } catch {
    return JSON.stringify({ ok: false, error: 'arguments 不是合法 JSON' });
  }

  try {
    switch (name) {
      case 'vault_list': {
        const files = vaultListFiles();
        return JSON.stringify({ ok: true, files });
      }
      case 'vault_read': {
        const p = String(args.path ?? '');
        if (!p) {
          return JSON.stringify({ ok: false, error: '缺少 path' });
        }
        const content = vaultReadFile(p);
        return JSON.stringify({ ok: true, path: p, content });
      }
      case 'vault_write': {
        const p = String(args.path ?? '');
        const content = String(args.content ?? '');
        if (!p) {
          return JSON.stringify({ ok: false, error: '缺少 path' });
        }
        vaultWriteFile(p, content);
        return JSON.stringify({ ok: true, path: p, bytes: Buffer.byteLength(content, 'utf8') });
      }
      default:
        return JSON.stringify({ ok: false, error: `未知工具: ${name}` });
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return JSON.stringify({ ok: false, error: msg });
  }
};
