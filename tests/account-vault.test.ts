import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  AccountVault,
  parseKeychainPayload
} from '../src/server/account-vault';

describe('AccountVault Unit Tests', () => {
  let tempDir: string;
  let fakeAppStoragePath: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aura-vault-test-'));
    fakeAppStoragePath = path.join(tempDir, 'app_storage.json');
  });

  afterEach(() => {
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {}
  });

  test('parseKeychainPayload parses raw JSON and go-keyring-base64', () => {
    expect(parseKeychainPayload('')).toBeNull();
    expect(parseKeychainPayload('invalid json')).toBeNull();

    // Plain JSON
    const plainJson = JSON.stringify({ id_token_email: 'user1@example.com', token: 'xyz' });
    const parsed1 = parseKeychainPayload(plainJson);
    expect(parsed1?.email).toBe('user1@example.com');
    expect(parsed1?.payload).toBe(plainJson);

    // Base64 JSON with go-keyring-base64: prefix
    const b64Json = 'go-keyring-base64:' + Buffer.from(plainJson).toString('base64');
    const parsed2 = parseKeychainPayload(b64Json);
    expect(parsed2?.email).toBe('user1@example.com');
    expect(parsed2?.payload).toBe(b64Json);
  });

  test('saveCurrentAccount captures credential and lists accounts correctly', () => {
    const fakePayload =
      'go-keyring-base64:' +
      Buffer.from(JSON.stringify({ id_token_email: 'alice@example.com', token: 'tok_alice' })).toString('base64');

    const fakeKeychainStorage: Record<string, string> = {
      'gemini:antigravity': fakePayload
    };

    const mockExec = (args: string[]) => {
      if (args[0] === 'find-generic-password') {
        const key = `${args[2]}:${args[4]}`;
        const val = fakeKeychainStorage[key];
        if (!val) throw new Error('Not found');
        return val;
      }
      if (args[0] === 'add-generic-password') {
        // args: ['add-generic-password', '-U', '-s', 'gemini', '-a', 'antigravity', '-w', payload]
        const sIdx = args.indexOf('-s');
        const aIdx = args.indexOf('-a');
        const wIdx = args.indexOf('-w');
        const key = `${args[sIdx + 1]}:${args[aIdx + 1]}`;
        fakeKeychainStorage[key] = args[wIdx + 1];
        return '';
      }
      throw new Error(`Unexpected command: ${args.join(' ')}`);
    };

    const vault = new AccountVault({
      storageDir: tempDir,
      appStoragePath: fakeAppStoragePath,
      execKeychainCmd: mockExec
    });

    const res = vault.saveCurrentAccount();
    expect(res.success).toBe(true);
    expect(res.email).toBe('alice@example.com');

    const list1 = vault.listAccounts();
    expect(list1.currentEmail).toBe('alice@example.com');
    expect(list1.accounts.length).toBe(1);
    expect(list1.accounts[0].email).toBe('alice@example.com');
    expect(list1.accounts[0].isCurrent).toBe(true);
  });

  test('switchAccount updates Keychain and app_storage.json atomically', () => {
    const payloadA =
      'go-keyring-base64:' +
      Buffer.from(JSON.stringify({ id_token_email: 'a@example.com', token: 'tok_a' })).toString('base64');
    const payloadB =
      'go-keyring-base64:' +
      Buffer.from(JSON.stringify({ id_token_email: 'b@example.com', token: 'tok_b' })).toString('base64');

    const fakeKeychainStorage: Record<string, string> = {
      'gemini:antigravity': payloadA
    };

    const mockExec = (args: string[]) => {
      if (args[0] === 'find-generic-password') {
        const key = `${args[2]}:${args[4]}`;
        const val = fakeKeychainStorage[key];
        if (!val) throw new Error('Not found');
        return val;
      }
      if (args[0] === 'add-generic-password') {
        // args: ['add-generic-password', '-U', '-s', 'gemini', '-a', 'antigravity', '-w', payload]
        const sIdx = args.indexOf('-s');
        const aIdx = args.indexOf('-a');
        const wIdx = args.indexOf('-w');
        const key = `${args[sIdx + 1]}:${args[aIdx + 1]}`;
        fakeKeychainStorage[key] = args[wIdx + 1];
        return '';
      }
      throw new Error(`Unexpected command: ${args.join(' ')}`);
    };

    fs.writeFileSync(fakeAppStoragePath, JSON.stringify({ 'agy.onboarding.lastLoginUsername': 'a@example.com' }));

    const vault = new AccountVault({
      storageDir: tempDir,
      appStoragePath: fakeAppStoragePath,
      execKeychainCmd: mockExec
    });

    // 1. Save A
    vault.saveCurrentAccount();

    // 2. Simulate user switching to B in CLI/App
    fakeKeychainStorage['gemini:antigravity'] = payloadB;
    vault.saveCurrentAccount();

    expect(vault.listAccounts().accounts.length).toBe(2);

    // 3. Switch back to A
    const switchRes = vault.switchAccount('a@example.com');
    expect(switchRes.success).toBe(true);
    expect(switchRes.email).toBe('a@example.com');

    // Verify keychain has payloadA
    expect(fakeKeychainStorage['gemini:antigravity']).toBe(payloadA);

    // Verify app_storage.json is updated to A
    const appStorage = JSON.parse(fs.readFileSync(fakeAppStoragePath, 'utf8'));
    expect(appStorage['agy.onboarding.lastLoginUsername']).toBe('a@example.com');

    // 4. Delete account
    vault.deleteAccount('b@example.com');
    const remaining = vault.listAccounts().accounts;
    expect(remaining.length).toBe(1);
    expect(remaining[0].email).toBe('a@example.com');
  });

  test('syncProfile enriches account with avatarUrl, isPro, and displayName', () => {
    const payload =
      'go-keyring-base64:' +
      Buffer.from(JSON.stringify({ id_token_email: 'kosuzu@example.com', token: 'tok_k' })).toString('base64');

    const fakeKeychainStorage: Record<string, string> = {
      'gemini:antigravity': payload
    };

    const mockExec = (args: string[]) => {
      if (args[0] === 'find-generic-password') {
        return fakeKeychainStorage['gemini:antigravity'];
      }
      return '';
    };

    const vault = new AccountVault({
      storageDir: tempDir,
      appStoragePath: fakeAppStoragePath,
      execKeychainCmd: mockExec
    });

    vault.saveCurrentAccount();

    const changed = vault.syncProfile({
      email: 'kosuzu@example.com',
      displayName: '徒町小鈴',
      avatarUrl: 'data:image/jpeg;base64,mockdata',
      isPro: true,
      planName: 'Pro'
    });

    expect(changed).toBe(true);

    const accounts = vault.listAccounts().accounts;
    expect(accounts[0].displayName).toBe('徒町小鈴');
    expect(accounts[0].avatarUrl).toBe('data:image/jpeg;base64,mockdata');
    expect(accounts[0].isPro).toBe(true);
    expect(accounts[0].planName).toBe('Pro');
  });
});
