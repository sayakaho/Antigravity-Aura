/**
 * Aura Dashboard · Universal Host Healer (Pure Node.js)
 *
 * Automatically inspects and patches the Antigravity host `app.asar` at Sidecar boot time.
 * Enables `--remote-debugging-port=0` dynamically without requiring user terminal commands,
 * package managers (Bun / npm / yarn), or manual intervention.
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export interface HostHealResult {
  success: boolean;
  healed: boolean;
  alreadyPatched: boolean;
  needsRestart: boolean;
  asarPath?: string;
  backupPath?: string;
  error?: string;
}

/**
 * Resolves the absolute path of Antigravity host's `app.asar`.
 */
export function resolveHostAsarPath(): string | null {
  const candidates: string[] = [];

  // 1. Traverse upward from current process.execPath (Antigravity Helper / Node binary)
  try {
    let cur = path.dirname(process.execPath);
    for (let i = 0; i < 6; i++) {
      const directAsar = path.join(cur, 'Resources', 'app.asar');
      const directAsarLower = path.join(cur, 'resources', 'app.asar');
      if (fs.existsSync(directAsar)) candidates.push(directAsar);
      if (fs.existsSync(directAsarLower)) candidates.push(directAsarLower);
      const parent = path.dirname(cur);
      if (parent === cur) break;
      cur = parent;
    }
  } catch {}

  // 2. Platform default installation paths
  const platform = process.platform;
  const home = os.homedir();

  if (platform === 'darwin') {
    candidates.push(
      '/Applications/Antigravity.app/Contents/Resources/app.asar',
      path.join(home, 'Applications', 'Antigravity.app', 'Contents', 'Resources', 'app.asar')
    );
  } else if (platform === 'win32') {
    const localAppData = process.env.LOCALAPPDATA || path.join(home, 'AppData', 'Local');
    const programFiles = process.env.ProgramFiles || 'C:\\Program Files';
    candidates.push(
      path.join(localAppData, 'Programs', 'Antigravity', 'resources', 'app.asar'),
      path.join(programFiles, 'Antigravity', 'resources', 'app.asar')
    );
  } else {
    candidates.push(
      '/opt/Antigravity/resources/app.asar',
      '/usr/share/antigravity/resources/app.asar',
      '/usr/lib/antigravity/resources/app.asar'
    );
  }

  for (const candidate of candidates) {
    try {
      if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
        return candidate;
      }
    } catch {}
  }

  return null;
}

/**
 * Pure Node.js in-memory asar patcher.
 * Inserts `--remote-debugging-port=0` into `dist/main.js` if missing.
 */
export function autoHealHostAsar(): HostHealResult {
  const asarPath = resolveHostAsarPath();
  if (!asarPath) {
    return {
      success: false,
      healed: false,
      alreadyPatched: false,
      needsRestart: false,
      error: 'Host app.asar could not be located on this machine.'
    };
  }

  try {
    const fileBuf = fs.readFileSync(asarPath);
    if (fileBuf.length < 16) {
      return {
        success: false,
        healed: false,
        alreadyPatched: false,
        needsRestart: false,
        asarPath,
        error: 'Corrupted or unreadable app.asar file.'
      };
    }

    const headerSize = fileBuf.readUInt32LE(12);
    const headerJsonStr = fileBuf.slice(16, 16 + headerSize).toString('utf8');
    const header = JSON.parse(headerJsonStr);
    const baseOffset = 16 + headerSize;

    // Collect in-archive files into Map<relativePath, Buffer>
    const fileMap = new Map<string, Buffer>();

    const walk = (node: any, currentPath: string) => {
      if (node.files) {
        for (const [name, child] of Object.entries(node.files)) {
          walk(child, currentPath ? `${currentPath}/${name}` : name);
        }
      } else if (node.offset !== undefined && node.size !== undefined && !node.unpacked) {
        const offset = parseInt(node.offset, 10);
        const size = node.size;
        const content = fileBuf.slice(baseOffset + offset, baseOffset + offset + size);
        fileMap.set(currentPath, content);
      }
    };

    walk(header, '');

    const targetFile = 'dist/main.js';
    const mainJsBuf = fileMap.get(targetFile);
    if (!mainJsBuf) {
      return {
        success: false,
        healed: false,
        alreadyPatched: false,
        needsRestart: false,
        asarPath,
        error: 'dist/main.js entrypoint not found in app.asar.'
      };
    }

    let mainJsText = mainJsBuf.toString('utf8');

    // 1. Fast idempotency check
    if (mainJsText.includes("appendSwitch('remote-debugging-port'")) {
      return {
        success: true,
        healed: false,
        alreadyPatched: true,
        needsRestart: false,
        asarPath
      };
    }

    // 2. Identify reliable anchor point in main.js
    const anchor = "electron_1.app.commandLine.appendSwitch('disable-blink-features', 'AutomationControlled');";
    if (!mainJsText.includes(anchor)) {
      return {
        success: false,
        healed: false,
        alreadyPatched: false,
        needsRestart: false,
        asarPath,
        error: 'Expected Electron startup anchor not found in dist/main.js.'
      };
    }

    const patchCode = `if (!electron_1.app.commandLine.hasSwitch('remote-debugging-port')) {\n    electron_1.app.commandLine.appendSwitch('remote-debugging-port', '0');\n}\n`;
    mainJsText = mainJsText.replace(anchor, `${patchCode}${anchor}`);
    fileMap.set(targetFile, Buffer.from(mainJsText, 'utf8'));

    // 3. Rebuild asar header with newly computed file offsets
    let currentOffset = 0;
    const rebuildHeader = (node: any, currentPath: string): any => {
      if (node.files) {
        const newFiles: Record<string, any> = {};
        for (const [name, child] of Object.entries(node.files)) {
          newFiles[name] = rebuildHeader(child, currentPath ? `${currentPath}/${name}` : name);
        }
        return { ...node, files: newFiles };
      } else if (node.unpacked) {
        return { ...node };
      } else {
        const buf = fileMap.get(currentPath);
        if (!buf) return { ...node };
        const size = buf.length;
        const entry = {
          ...node,
          size,
          offset: currentOffset.toString()
        };
        currentOffset += size;
        return entry;
      }
    };

    const newHeader = rebuildHeader(header, '');
    const newHeaderJson = JSON.stringify(newHeader);
    const headerBuf = Buffer.from(newHeaderJson, 'utf8');

    // Asar alignment: padded to 4 bytes
    const padding = (4 - (headerBuf.length % 4)) % 4;
    const paddedHeaderSize = headerBuf.length + padding;

    const totalSize = 16 + paddedHeaderSize + currentOffset;
    const outBuf = Buffer.alloc(totalSize);

    // Asar 16-byte magic header
    outBuf.writeUInt32LE(4, 0);
    outBuf.writeUInt32LE(paddedHeaderSize + 8, 4);
    outBuf.writeUInt32LE(paddedHeaderSize + 4, 8);
    outBuf.writeUInt32LE(headerBuf.length, 12);

    headerBuf.copy(outBuf, 16);
    outBuf.fill(0, 16 + headerBuf.length, 16 + paddedHeaderSize);

    let writePos = 16 + paddedHeaderSize;
    for (const [, buf] of fileMap.entries()) {
      buf.copy(outBuf, writePos);
      writePos += buf.length;
    }

    // 4. Safe backup
    const backupPath = `${asarPath}.bak`;
    if (!fs.existsSync(backupPath)) {
      try {
        fs.copyFileSync(asarPath, backupPath);
      } catch (backupErr) {
        console.warn('[Aura Host Healer] Warning: Failed to create app.asar.bak:', backupErr);
      }
    }

    // 5. Atomic write via temp file
    const tmpPath = `${asarPath}.tmp.${Date.now()}`;
    fs.writeFileSync(tmpPath, outBuf);
    fs.renameSync(tmpPath, asarPath);

    console.log('[Aura Host Healer] Host app.asar successfully auto-healed for CDP injection.');
    return {
      success: true,
      healed: true,
      alreadyPatched: false,
      needsRestart: true,
      asarPath,
      backupPath
    };
  } catch (err: any) {
    console.error('[Aura Host Healer] Error while healing host app.asar:', err);
    return {
      success: false,
      healed: false,
      alreadyPatched: false,
      needsRestart: false,
      asarPath,
      error: String(err?.message || err)
    };
  }
}
