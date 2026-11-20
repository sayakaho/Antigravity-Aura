import { describe, expect, test } from 'bun:test';
import { findLanguageServerPid, restartLanguageServer } from '../src/server/language-server';

describe('Language Server Lifecycle & Restart', () => {
  test('findLanguageServerPid parses ps output correctly', () => {
    const fakePs = () => `
  PID COMMAND
  101 /Applications/Antigravity.app/Contents/MacOS/Antigravity
  202 /Applications/Antigravity.app/Contents/Resources/bin/language_server --standalone --override_ide_name antigravity --subclient_type hub --csrf_token test
  303 /bin/zsh
`;
    const pid = findLanguageServerPid(fakePs as any);
    expect(pid).toBe(202);
  });

  test('findLanguageServerPid returns null if not running', () => {
    const fakePs = () => `
  PID COMMAND
  101 /Applications/Antigravity.app/Contents/MacOS/Antigravity
  303 /bin/zsh
`;
    const pid = findLanguageServerPid(fakePs as any);
    expect(pid).toBeNull();
  });

  test('restartLanguageServer uses Exit RPC when available', async () => {
    let rpcCalled = false;
    let rpcUrl = '';
    const fakeFetch = (async (url: string) => {
      rpcCalled = true;
      rpcUrl = url;
      return { ok: true, status: 200 } as any;
    }) as typeof fetch;

    const stopped = await restartLanguageServer({
      lsAddress: '127.0.0.1:54321',
      csrfToken: 'test-token',
      waitRestartMs: 10,
      fetchFn: fakeFetch
    });

    expect(stopped).toBe(true);
    expect(rpcCalled).toBe(true);
    expect(rpcUrl).toContain('/exa.language_server_pb.LanguageServerService/Exit');
  });

  test('restartLanguageServer falls back to PID signal if RPC fails', async () => {
    let killedPid = null as number | null;
    let killedSignal = null as string | null;
    const originalKill = process.kill;

    try {
      (process as any).kill = (pid: number, signal: string) => {
        killedPid = pid;
        killedSignal = signal;
        return true;
      };

      const fakePs = () => `
  PID COMMAND
  404 /Applications/Antigravity.app/Contents/Resources/bin/language_server --standalone --override_ide_name antigravity --subclient_type hub
`;

      const stopped = await restartLanguageServer({
        lsAddress: '127.0.0.1:99999',
        csrfToken: 'invalid',
        waitRestartMs: 10,
        execCmd: fakePs as any,
        fetchFn: (async () => {
          throw new Error('RPC connection refused');
        }) as any
      });

      expect(stopped).toBe(true);
      expect(killedPid).toBe(404);
      expect(killedSignal).toBe('SIGTERM');
    } finally {
      process.kill = originalKill;
    }
  });
});
