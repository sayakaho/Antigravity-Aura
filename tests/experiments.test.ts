import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { DEFAULT_EXPERIMENTAL_FLAGS } from '../src/shared/config-schema';

interface RecordedStorageEvent {
  key: string | null;
  oldValue: string | null;
  newValue: string | null;
  storageArea: unknown;
}

class MemoryStorage {
  private readonly store = new Map<string, string>();
  public get length(): number {
    return this.store.size;
  }
  public clear(): void {
    this.store.clear();
  }
  public key(index: number): string | null {
    return Array.from(this.store.keys())[index] ?? null;
  }
  public getItem(key: string): string | null {
    return this.store.get(key) ?? null;
  }
  public setItem(key: string, value: string): void {
    this.store.set(key, String(value));
  }
  public removeItem(key: string): void {
    this.store.delete(key);
  }
}

describe('setupExperiments & StorageEvent synchronization', () => {
  const originalWindow = (globalThis as Record<string, unknown>).window;
  let mockStorage: MemoryStorage;
  let dispatchedEvents: RecordedStorageEvent[];

  beforeEach(() => {
    mockStorage = new MemoryStorage();
    dispatchedEvents = [];
    const mockWindow = {
      localStorage: mockStorage,
      location: { href: 'https://127.0.0.1:50373/' },
      dispatchEvent(evt: RecordedStorageEvent): boolean {
        dispatchedEvents.push({
          key: evt.key,
          oldValue: evt.oldValue,
          newValue: evt.newValue,
          storageArea: evt.storageArea
        });
        return true;
      }
    };
    (globalThis as Record<string, unknown>).window = mockWindow;
  });

  afterEach(() => {
    if (originalWindow === undefined) {
      delete (globalThis as Record<string, unknown>).window;
    } else {
      (globalThis as Record<string, unknown>).window = originalWindow;
    }
  });

  test('writes overrides and dispatches StorageEvent on cold start, then suppresses duplicate dispatches', async () => {
    const { setupExperiments } = await import('../src/injection/experiments');

    setupExperiments({
      labsDeveloperMode: true,
      experimentalFlags: {
        ...DEFAULT_EXPERIMENTAL_FLAGS,
        'labs-concierge-agent': true,
        'context-window-selector': true
      }
    });

    const envRaw = mockStorage.getItem('jetski.developer.featureEnvironmentOverride');
    const flagsRaw = mockStorage.getItem('jetski.developer.customFlagOverrides');
    expect(envRaw).not.toBeNull();
    expect(flagsRaw).not.toBeNull();

    const envObj = JSON.parse(envRaw!);
    const flagsObj = JSON.parse(flagsRaw!);
    expect(envObj).toEqual({ enabled: true, userCohort: 'google' });
    expect(flagsObj['enable-developer-mode']).toBe(true);
    expect(flagsObj['enable-context-usage-indicator']).toBe(true);
    expect(flagsObj['labs-autonomous-mode']).toBe(true);
    expect(flagsObj['labs-inline-actions']).toBe(true);
    expect(flagsObj['configure-artifact-width']).toBe(true);
    expect(flagsObj['enable-bottom-terminal-panel']).toBe(true);
    expect(flagsObj['enable-file-explorer-tab']).toBe(true);
    expect(flagsObj['enable-pane-selection-actions']).toBe(true);
    expect(flagsObj['enable-conversation-groups']).toBe(true);
    expect(flagsObj['enable-conversation-forking']).toBe(true);
    expect(flagsObj['enable-browser-subagent-webview']).toBe(true);
    expect(flagsObj['enable-battle-mode']).toBe(true);
    expect(flagsObj['labs-concierge-agent']).toBeUndefined();
    expect(flagsObj['context-window-selector']).toBeUndefined();

    expect(dispatchedEvents.length).toBe(2);
    expect(dispatchedEvents[0]?.key).toBe('jetski.developer.featureEnvironmentOverride');
    expect(dispatchedEvents[0]?.storageArea).toBe(mockStorage);
    expect(dispatchedEvents[0]?.newValue).toBe(envRaw);
    expect(dispatchedEvents[1]?.key).toBe('jetski.developer.customFlagOverrides');
    expect(dispatchedEvents[1]?.storageArea).toBe(mockStorage);
    expect(dispatchedEvents[1]?.newValue).toBe(flagsRaw);

    // Repeating the same config in the same window must not emit redundant StorageEvents
    dispatchedEvents = [];
    setupExperiments({
      labsDeveloperMode: true,
      experimentalFlags: { ...DEFAULT_EXPERIMENTAL_FLAGS }
    });
    expect(dispatchedEvents.length).toBe(0);
  });

  test('dispatches initial StorageEvent even when localStorage already holds matching overrides', async () => {
    const { setupExperiments } = await import('../src/injection/experiments');

    const preEnv = JSON.stringify({ enabled: true, userCohort: 'google' });
    const preFlags = JSON.stringify({ ...DEFAULT_EXPERIMENTAL_FLAGS });
    mockStorage.setItem('jetski.developer.featureEnvironmentOverride', preEnv);
    mockStorage.setItem('jetski.developer.customFlagOverrides', preFlags);

    setupExperiments({
      labsDeveloperMode: true,
      experimentalFlags: { ...DEFAULT_EXPERIMENTAL_FLAGS }
    });

    expect(dispatchedEvents.length).toBe(2);
    expect(dispatchedEvents.map((e) => e.key)).toEqual([
      'jetski.developer.featureEnvironmentOverride',
      'jetski.developer.customFlagOverrides'
    ]);
  });

  test('cleans managed overrides while preserving manual overrides and notifies React when turned off', async () => {
    const { setupExperiments } = await import('../src/injection/experiments');

    mockStorage.setItem(
      'jetski.developer.featureEnvironmentOverride',
      JSON.stringify({ enabled: true, os: 'linux', userCohort: 'google' })
    );
    mockStorage.setItem(
      'jetski.developer.customFlagOverrides',
      JSON.stringify({ ...DEFAULT_EXPERIMENTAL_FLAGS, 'custom-user-flag': true })
    );

    setupExperiments({
      labsDeveloperMode: false,
      experimentalFlags: { ...DEFAULT_EXPERIMENTAL_FLAGS }
    });

    expect(JSON.parse(mockStorage.getItem('jetski.developer.featureEnvironmentOverride')!)).toEqual({
      enabled: true,
      os: 'linux'
    });
    expect(JSON.parse(mockStorage.getItem('jetski.developer.customFlagOverrides')!)).toEqual({
      'custom-user-flag': true
    });
    expect(dispatchedEvents.length).toBe(2);

    // Turning off without manual overrides cleans storage cleanly with newValue: null
    dispatchedEvents = [];
    mockStorage.setItem(
      'jetski.developer.featureEnvironmentOverride',
      JSON.stringify({ enabled: true, userCohort: 'google' })
    );
    mockStorage.setItem(
      'jetski.developer.customFlagOverrides',
      JSON.stringify({ ...DEFAULT_EXPERIMENTAL_FLAGS })
    );

    setupExperiments({
      labsDeveloperMode: false,
      experimentalFlags: { ...DEFAULT_EXPERIMENTAL_FLAGS }
    });

    expect(mockStorage.getItem('jetski.developer.featureEnvironmentOverride')).toBeNull();
    expect(mockStorage.getItem('jetski.developer.customFlagOverrides')).toBeNull();
    expect(dispatchedEvents.length).toBe(2);
    expect(dispatchedEvents.every((e) => e.newValue === null && e.storageArea === mockStorage)).toBe(true);
  });
});
