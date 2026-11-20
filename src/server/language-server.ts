import { execSync } from 'node:child_process';

export type ExecCmdFn = (cmd: string, options?: any) => string | Buffer;

export interface RestartLanguageServerOptions {
  lsAddress?: string;
  csrfToken?: string;
  waitRestartMs?: number;
  execCmd?: ExecCmdFn;
  fetchFn?: typeof fetch;
}

/**
 * Finds the process ID of the Antigravity local Language Server.
 */
export function findLanguageServerPid(execCmd: ExecCmdFn = execSync as any): number | null {
  try {
    const output = execCmd('ps -axo pid,command', { encoding: 'utf8' } as any);
    for (const line of String(output).split('\n')) {
      if (
        line.includes('language_server') &&
        line.includes('--subclient_type hub') &&
        line.includes('antigravity')
      ) {
        const match = line.trim().match(/^(\d+)/);
        if (match) {
          const pid = parseInt(match[1], 10);
          if (!isNaN(pid) && pid > 0 && pid !== process.pid) {
            return pid;
          }
        }
      }
    }
  } catch (err) {
    console.warn('[LanguageServer] Failed to scan processes for Language Server PID:', err);
  }
  return null;
}

/**
 * Triggers a graceful exit of the Language Server.
 * Electron's main process monitors the child process and automatically restarts it
 * after a ~2000ms cooldown, loading the freshly switched Keychain credentials.
 */
export async function restartLanguageServer(options?: RestartLanguageServerOptions): Promise<boolean> {
  const waitRestartMs = options?.waitRestartMs ?? 2500;
  const lsAddress = options?.lsAddress || process.env.ANTIGRAVITY_LS_ADDRESS;
  const csrfToken = options?.csrfToken || process.env.ANTIGRAVITY_CSRF_TOKEN;
  const fetchImpl = options?.fetchFn || fetch;

  let stopped = false;

  // 1. Try graceful Exit RPC first
  if (lsAddress && csrfToken) {
    try {
      const url = `http://${lsAddress}/exa.language_server_pb.LanguageServerService/Exit`;
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 1500);
      const res = await fetchImpl(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'connect-protocol-version': '1',
          'x-codeium-csrf-token': csrfToken
        },
        body: '{}',
        signal: controller.signal
      });
      clearTimeout(timer);
      if (res.ok || res.status === 200) {
        stopped = true;
      }
    } catch {}
  }

  // 2. Fallback to process SIGTERM if RPC was not handled
  if (!stopped) {
    const pid = findLanguageServerPid(options?.execCmd);
    if (pid) {
      try {
        process.kill(pid, 'SIGTERM');
        stopped = true;
      } catch (err) {
        console.warn(`[LanguageServer] Failed to send SIGTERM to PID ${pid}:`, err);
      }
    }
  }

  if (stopped) {
    // Wait for Electron's crash monitor cooldown (2000ms) to re-spawn the new Language Server
    await new Promise((resolve) => setTimeout(resolve, waitRestartMs));
    return true;
  }

  return false;
}
