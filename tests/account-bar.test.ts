import { afterEach, describe, expect, test } from 'bun:test';
import { probeAndSyncProfile, resolveActiveDisplayAccount } from '../src/injection/account-bar';

const originalWindow = (globalThis as any).window;
const originalDocument = (globalThis as any).document;

function makeMockFiberElement(profile: {
  email: string;
  name: string;
  avatarUrl: string;
  planName: string;
}) {
  return {
    __reactFiber$test: {
      memoizedState: {
        memoizedState: {
          email: profile.email,
          name: profile.name,
          profilePictureUrl: profile.avatarUrl,
          userTier: { id: 'g1-pro-tier' },
          planStatus: { planInfo: { planName: profile.planName } }
        },
        next: null
      },
      return: null
    }
  };
}

describe('AccountBar SSOT Display Resolution', () => {
  afterEach(() => {
    (globalThis as any).window = originalWindow;
    (globalThis as any).document = originalDocument;
  });

  test('ignores mismatched React Fiber userStatus and locks display to vault.currentEmail', () => {
    const actions: string[] = [];
    (globalThis as any).window = {
      __ag_latest_vault: {
        currentEmail: 'floricidiva@gmail.com',
        accounts: [
          {
            email: 'floricidiva@gmail.com',
            displayName: '安養寺ひめ',
            isPro: true,
            planName: 'Pro',
            savedAt: 1,
            lastUsedAt: 2,
            isCurrent: true
          },
          {
            email: 'reisawaaoi@gmail.com',
            displayName: 'oren hoshimiya',
            isPro: true,
            planName: 'Pro',
            savedAt: 1,
            lastUsedAt: 1,
            isCurrent: false
          }
        ]
      },
      __ag_account_action: (payload: string) => actions.push(payload)
    };

    const fiberNode = makeMockFiberElement({
      email: 'reisawaaoi@gmail.com',
      name: 'oren hoshimiya',
      avatarUrl: 'https://example.com/rei.png',
      planName: 'Pro'
    });
    (globalThis as any).document = {
      querySelector: (sel: string) => (sel === '[data-testid="settings-button"]' ? fiberNode : null),
      getElementById: () => null
    };

    probeAndSyncProfile();
    expect(actions).toEqual([]);

    const active = resolveActiveDisplayAccount();
    expect(active.email).toBe('floricidiva@gmail.com');
    expect(active.displayName).toBe('安養寺ひめ');
  });

  test('clears stale cachedLiveProfile when vault switches away from previous live account', () => {
    const actions: string[] = [];
    const win: any = {
      __ag_latest_vault: {
        currentEmail: 'reisawaaoi@gmail.com',
        accounts: [
          {
            email: 'reisawaaoi@gmail.com',
            displayName: 'oren hoshimiya',
            savedAt: 1,
            lastUsedAt: 2,
            isCurrent: true
          },
          {
            email: 'floricidiva@gmail.com',
            displayName: '安養寺ひめ',
            savedAt: 1,
            lastUsedAt: 1,
            isCurrent: false
          }
        ]
      },
      __ag_account_action: (payload: string) => actions.push(payload)
    };
    (globalThis as any).window = win;

    const fiberNode = makeMockFiberElement({
      email: 'reisawaaoi@gmail.com',
      name: 'oren hoshimiya',
      avatarUrl: 'https://example.com/rei.png',
      planName: 'Pro'
    });
    (globalThis as any).document = {
      querySelector: (sel: string) => (sel === '[data-testid="settings-button"]' ? fiberNode : null),
      getElementById: () => null
    };

    // Cached while vault was reisawaaoi
    probeAndSyncProfile();
    expect(actions.length).toBe(1);
    expect(resolveActiveDisplayAccount().email).toBe('reisawaaoi@gmail.com');

    // Now Keychain/vault moves to floricidiva while Fiber still lingers on reisawaaoi
    win.__ag_latest_vault.currentEmail = 'floricidiva@gmail.com';
    win.__ag_latest_vault.accounts[0].isCurrent = false;
    win.__ag_latest_vault.accounts[1].isCurrent = true;

    probeAndSyncProfile();
    expect(actions.length).toBe(1);

    const active = resolveActiveDisplayAccount();
    expect(active.email).toBe('floricidiva@gmail.com');
    expect(active.displayName).toBe('安養寺ひめ');
  });
});
