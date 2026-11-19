import { DEFAULT_EXPERIMENTAL_FLAGS } from '../shared/config-schema';
import type { AdvancedConfig } from '../types';
import type { AuraGlobals } from './types';

const ENV_OVERRIDE_KEY = 'jetski.developer.featureEnvironmentOverride';
const FLAG_OVERRIDES_KEY = 'jetski.developer.customFlagOverrides';

function parsePlainObject(raw: string | null): Record<string, unknown> {
  if (!raw) return {};
  try {
    const parsed: unknown = JSON.parse(raw);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch {}
  return {};
}

function dispatchLocalStorageEvent(
  key: string,
  oldValue: string | null,
  newValue: string | null
): void {
  if (typeof window === 'undefined' || typeof window.dispatchEvent !== 'function') return;
  try {
    if (typeof StorageEvent === 'function') {
      window.dispatchEvent(
        new StorageEvent('storage', {
          key,
          oldValue,
          newValue,
          url: window.location?.href,
          storageArea: window.localStorage
        })
      );
      return;
    }
  } catch {
    // 非浏览器单测环境中若 mock localStorage 无法通过 WebIDL Storage 校验，降级构造携带 storage 元信息的事件
  }
  try {
    const evt = new Event('storage');
    Object.defineProperties(evt, {
      key: { value: key },
      oldValue: { value: oldValue },
      newValue: { value: newValue },
      storageArea: { value: window.localStorage }
    });
    window.dispatchEvent(evt);
  } catch {}
}

function writeNativeStorage(key: string, value: string | null): void {
  if (typeof window === 'undefined') return;
  const win = window as unknown as AuraGlobals;
  if (win.nativeStorage && typeof win.nativeStorage.updateItems === 'function') {
    try {
      void win.nativeStorage.updateItems({ [key]: value });
    } catch (err) {
      console.warn('[Aura] Failed to update nativeStorage:', err);
    }
  } else if (!win.__ag_native_storage_hooked) {
    win.__ag_native_storage_hooked = true;
    let currentNative = win.nativeStorage;
    Object.defineProperty(window, 'nativeStorage', {
      configurable: true,
      enumerable: true,
      get() {
        return currentNative;
      },
      set(val: unknown) {
        currentNative = val as typeof win.nativeStorage;
        if (currentNative && typeof currentNative.updateItems === 'function') {
          try {
            const flags = window.localStorage.getItem(FLAG_OVERRIDES_KEY);
            const env = window.localStorage.getItem(ENV_OVERRIDE_KEY);
            const items: Record<string, string | null> = {};
            if (flags) items[FLAG_OVERRIDES_KEY] = flags;
            if (env) items[ENV_OVERRIDE_KEY] = env;
            if (Object.keys(items).length > 0) {
              void currentNative.updateItems(items);
            }
          } catch {}
        }
      }
    });
  }
}

function installStorageTamperGuard(): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  const win = window as unknown as AuraGlobals;
  if (win.__ag_storage_tamper_guard_installed) return;
  win.__ag_storage_tamper_guard_installed = true;

  const storageProto = (typeof Storage !== 'undefined' && Storage.prototype) || null;
  const originalSetItem = storageProto
    ? storageProto.setItem.bind(window.localStorage)
    : window.localStorage.setItem.bind(window.localStorage);

  const originalRemoveItem = storageProto
    ? storageProto.removeItem.bind(window.localStorage)
    : window.localStorage.removeItem.bind(window.localStorage);

  const safeMergeAndWrite = (key: string, rawVal: string): boolean => {
    if (key === FLAG_OVERRIDES_KEY && win.__ag_active_advanced_flags) {
      try {
        const parsed = parsePlainObject(rawVal);
        const merged = { ...parsed, ...win.__ag_active_advanced_flags };
        delete merged['labs-concierge-agent'];
        delete merged['context-window-selector'];
        originalSetItem(key, JSON.stringify(merged));
        return true;
      } catch {}
    } else if (key === ENV_OVERRIDE_KEY && win.__ag_active_env_override) {
      try {
        const parsed = parsePlainObject(rawVal);
        const merged = { ...parsed, ...win.__ag_active_env_override };
        originalSetItem(key, JSON.stringify(merged));
        return true;
      } catch {}
    }
    return false;
  };

  window.localStorage.setItem = function (key: string, value: string): void {
    if (!safeMergeAndWrite(key, String(value))) {
      originalSetItem(key, String(value));
    }
  };

  window.localStorage.removeItem = function (key: string): void {
    if (key === FLAG_OVERRIDES_KEY && win.__ag_active_advanced_flags) {
      originalSetItem(key, JSON.stringify(win.__ag_active_advanced_flags));
      return;
    }
    if (key === ENV_OVERRIDE_KEY && win.__ag_active_env_override) {
      originalSetItem(key, JSON.stringify(win.__ag_active_env_override));
      return;
    }
    originalRemoveItem(key);
  };
}

function writeStorageAndNotify(
  key: string,
  prevValue: string | null,
  nextValue: string | null,
  forceNotify: boolean
): void {
  const valueChanged = nextValue !== prevValue;
  if (valueChanged) {
    if (nextValue === null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, nextValue);
    dispatchLocalStorageEvent(key, prevValue, nextValue);
  } else if (forceNotify) {
    dispatchLocalStorageEvent(key, prevValue, nextValue);
  }

  if (valueChanged || forceNotify) {
    writeNativeStorage(key, nextValue);
  }
}

function wrapConfigProxy(target: Record<string, unknown>, winGlobals: AuraGlobals): Record<string, unknown> {
  if (typeof Proxy === 'undefined') return target;
  if ((target as Record<string, unknown>).__is_ag_proxy) return target;

  if (winGlobals.__ag_labs_dev_mode !== undefined) {
    target.devMode = winGlobals.__ag_labs_dev_mode === true;
  }
  if (winGlobals.__ag_release_channel) {
    target.releaseChannel = winGlobals.__ag_release_channel;
  }
  if (typeof winGlobals.__ag_is_byoa === 'boolean') {
    target.isByoa = winGlobals.__ag_is_byoa;
  }

  return new Proxy(target, {
    get(obj, prop, receiver) {
      if (prop === '__is_ag_proxy') return true;
      if (prop === 'devMode' && winGlobals.__ag_labs_dev_mode !== undefined) {
        return winGlobals.__ag_labs_dev_mode === true;
      }
      if (prop === 'releaseChannel' && winGlobals.__ag_release_channel) {
        return winGlobals.__ag_release_channel;
      }
      if (prop === 'isByoa' && typeof winGlobals.__ag_is_byoa === 'boolean') {
        return winGlobals.__ag_is_byoa;
      }
      return Reflect.get(obj, prop, receiver);
    },
    set(obj, prop, val) {
      if (prop === 'devMode' && winGlobals.__ag_labs_dev_mode !== undefined) {
        obj.devMode = winGlobals.__ag_labs_dev_mode === true;
        return true;
      }
      if (prop === 'releaseChannel' && winGlobals.__ag_release_channel) {
        obj.releaseChannel = winGlobals.__ag_release_channel;
        return true;
      }
      if (prop === 'isByoa' && typeof winGlobals.__ag_is_byoa === 'boolean') {
        obj.isByoa = winGlobals.__ag_is_byoa;
        return true;
      }
      obj[prop as string] = val;
      return true;
    },
    has(obj, prop) {
      if (prop === 'devMode' || prop === 'releaseChannel' || prop === 'isByoa') return true;
      return Reflect.has(obj, prop);
    },
    ownKeys(obj) {
      const keys = new Set(Reflect.ownKeys(obj));
      keys.add('devMode');
      keys.add('releaseChannel');
      keys.add('isByoa');
      return Array.from(keys);
    },
    getOwnPropertyDescriptor(obj, prop) {
      const desc = Reflect.getOwnPropertyDescriptor(obj, prop);
      if (prop === 'devMode' || prop === 'releaseChannel' || prop === 'isByoa') {
        return {
          configurable: true,
          enumerable: true,
          writable: true,
          value:
            prop === 'devMode'
              ? winGlobals.__ag_labs_dev_mode === true
              : prop === 'releaseChannel'
              ? winGlobals.__ag_release_channel
              : winGlobals.__ag_is_byoa
        };
      }
      return desc;
    }
  });
}

export function patchAppConfig(advanced: Partial<AdvancedConfig>): void {
  if (typeof window === 'undefined') return;
  try {
    const winGlobals = window as unknown as AuraGlobals;
    winGlobals.__ag_labs_dev_mode = advanced.labsDeveloperMode !== false;
    winGlobals.__ag_release_channel = advanced.releaseChannel;
    winGlobals.__ag_is_byoa = advanced.isByoa;

    let rawConfig = (window as unknown as { __APP_CONFIG__?: Record<string, unknown> }).__APP_CONFIG__;
    if (!rawConfig || typeof rawConfig !== 'object') {
      rawConfig = {
        devMode: advanced.labsDeveloperMode !== false,
        releaseChannel: advanced.releaseChannel || 'stable',
        isByoa: advanced.isByoa ?? true
      };
    } else {
      rawConfig.devMode = advanced.labsDeveloperMode !== false;
      if (advanced.releaseChannel) {
        rawConfig.releaseChannel = advanced.releaseChannel;
      }
      if (typeof advanced.isByoa === 'boolean') {
        rawConfig.isByoa = advanced.isByoa;
      }
    }
    let currentConfig: Record<string, unknown> | undefined = wrapConfigProxy(rawConfig, winGlobals);

    if (!winGlobals.__ag_app_config_hooked) {
      winGlobals.__ag_app_config_hooked = true;
      Object.defineProperty(window, '__APP_CONFIG__', {
        configurable: true,
        enumerable: true,
        get() {
          return currentConfig;
        },
        set(val: unknown) {
          if (val && typeof val === 'object') {
            const cfg = val as Record<string, unknown>;
            cfg.devMode = winGlobals.__ag_labs_dev_mode === true;
            if (winGlobals.__ag_release_channel) {
              cfg.releaseChannel = winGlobals.__ag_release_channel;
            }
            if (typeof winGlobals.__ag_is_byoa === 'boolean') {
              cfg.isByoa = winGlobals.__ag_is_byoa;
            }
            currentConfig = wrapConfigProxy(cfg, winGlobals);
          } else {
            currentConfig = val as Record<string, unknown> | undefined;
          }
        }
      });
    }
  } catch (err) {
    console.warn('[Aura] Failed to patch __APP_CONFIG__:', err);
  }
}

export function patchAppConfigDevMode(enabled: boolean): void {
  patchAppConfig({
    labsDeveloperMode: enabled
  });
}

export function patchUrlArchitectureParams(advanced: Partial<AdvancedConfig>): void {
  const TargetUrlSearchParams =
    (typeof window !== 'undefined' && window.URLSearchParams) ||
    (typeof URLSearchParams !== 'undefined' ? URLSearchParams : null);
  if (!TargetUrlSearchParams) return;
  try {
    const winGlobals = (typeof window !== 'undefined' ? window : globalThis) as unknown as AuraGlobals;
    winGlobals.__ag_adv_arch_params = {
      cde: advanced.cde ? 'true' : null,
      isEnterpriseDisabled: advanced.isEnterpriseDisabled ? 'true' : null,
      hostVariant:
        advanced.hostVariant && advanced.hostVariant !== 'default' ? advanced.hostVariant : null,
      enableMicrophone: advanced.enableMicrophone ? 'true' : null
    };

    if (!winGlobals.__ag_url_search_params_hooked) {
      winGlobals.__ag_url_search_params_hooked = true;
      const originalGet = TargetUrlSearchParams.prototype.get;
      TargetUrlSearchParams.prototype.get = function (name: string): string | null {
        const win = (typeof window !== 'undefined' ? window : globalThis) as unknown as AuraGlobals;
        const overrides = win.__ag_adv_arch_params;
        if (overrides && Object.prototype.hasOwnProperty.call(overrides, name)) {
          const val = overrides[name];
          if (val !== null && val !== undefined) return val;
        }
        return originalGet.call(this, name);
      };

      const originalHas = TargetUrlSearchParams.prototype.has;
      if (typeof originalHas === 'function') {
        TargetUrlSearchParams.prototype.has = function (name: string): boolean {
          const win = (typeof window !== 'undefined' ? window : globalThis) as unknown as AuraGlobals;
          const overrides = win.__ag_adv_arch_params;
          if (overrides && Object.prototype.hasOwnProperty.call(overrides, name)) {
            const val = overrides[name];
            if (val !== null && val !== undefined) return true;
          }
          return originalHas.call(this, name);
        };
      }

      const originalGetAll = TargetUrlSearchParams.prototype.getAll;
      if (typeof originalGetAll === 'function') {
        TargetUrlSearchParams.prototype.getAll = function (name: string): string[] {
          const win = (typeof window !== 'undefined' ? window : globalThis) as unknown as AuraGlobals;
          const overrides = win.__ag_adv_arch_params;
          if (overrides && Object.prototype.hasOwnProperty.call(overrides, name)) {
            const val = overrides[name];
            if (val !== null && val !== undefined) return [val];
          }
          return originalGetAll.call(this, name);
        };
      }
    }
  } catch (err) {
    console.warn('[Aura] Failed to patch URLSearchParams architecture params:', err);
  }
}

export function syncDeveloperSettings(advanced: Partial<AdvancedConfig>): void {
  try {
    const labsEnabled = advanced.labsDeveloperMode !== false;
    patchAppConfig(advanced);
    patchUrlArchitectureParams(advanced);

    if (typeof window === 'undefined' || !window.localStorage) return;

    const prevEnvStr = window.localStorage.getItem(ENV_OVERRIDE_KEY);
    const envOverride = parsePlainObject(prevEnvStr);
    if (labsEnabled) {
      envOverride.enabled = true;
      envOverride.userCohort = 'google';
    } else {
      delete envOverride.userCohort;
      if (envOverride.os === undefined && envOverride.host === undefined) {
        delete envOverride.enabled;
      }
    }
    const nextEnvStr = Object.keys(envOverride).length > 0 ? JSON.stringify(envOverride) : null;

    const prevFlagsStr = window.localStorage.getItem(FLAG_OVERRIDES_KEY);
    const flags = parsePlainObject(prevFlagsStr);
    const configuredFlags = advanced.experimentalFlags || DEFAULT_EXPERIMENTAL_FLAGS;
    if (labsEnabled) {
      for (const [k, v] of Object.entries(configuredFlags)) {
        if (k === 'labs-concierge-agent' || k === 'context-window-selector') continue;
        if (v) flags[k] = true;
        else delete flags[k];
      }
      flags['enable-developer-mode'] = true;
    } else {
      for (const k of Object.keys(DEFAULT_EXPERIMENTAL_FLAGS)) {
        delete flags[k];
      }
      for (const k of Object.keys(configuredFlags)) {
        delete flags[k];
      }
    }

    // 该 Flag 在非内部网络下会导致宿主崩溃；context-window-selector 依赖服务端下发实验配置，不伪造本地覆写
    delete flags['labs-concierge-agent'];
    delete flags['context-window-selector'];

    const nextFlagsStr = Object.keys(flags).length > 0 ? JSON.stringify(flags) : null;

    const winGlobals = window as unknown as AuraGlobals;
    winGlobals.__ag_active_advanced_flags = labsEnabled ? (flags as Record<string, boolean>) : undefined;
    winGlobals.__ag_active_env_override = labsEnabled ? envOverride : null;
    installStorageTamperGuard();

    const nextSig = `${labsEnabled ? '1' : '0'}|${nextEnvStr ?? ''}|${nextFlagsStr ?? ''}`;
    const forceInitialSync = winGlobals.__ag_experiments_sig !== nextSig;

    writeStorageAndNotify(ENV_OVERRIDE_KEY, prevEnvStr, nextEnvStr, forceInitialSync);
    writeStorageAndNotify(FLAG_OVERRIDES_KEY, prevFlagsStr, nextFlagsStr, forceInitialSync);

    winGlobals.__ag_experiments_sig = nextSig;
  } catch (err) {
    console.warn('[Aura] Failed to sync developer settings:', err);
  }
}

export function setupExperiments(advanced: Partial<AdvancedConfig>): void {
  syncDeveloperSettings(advanced);
}
