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

function writeStorageAndNotify(
  key: string,
  prevValue: string | null,
  nextValue: string | null,
  forceNotify: boolean
): void {
  if (nextValue !== prevValue) {
    if (nextValue === null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, nextValue);
    dispatchLocalStorageEvent(key, prevValue, nextValue);
  } else if (forceNotify) {
    // 宿主采用动态随机端口，冷启动时 React 可能早于 CDP 首次注入完成挂载；
    // 原生 localStorage 监听只在收到同窗口显式 StorageEvent 时更新 FeatureContext 状态。
    dispatchLocalStorageEvent(key, prevValue, nextValue);
  }
}

export function syncDeveloperSettings(advanced: AdvancedConfig): void {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return;

    const labsEnabled = advanced.labsDeveloperMode !== false;

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
    const nextSig = `${labsEnabled ? '1' : '0'}|${nextEnvStr ?? ''}|${nextFlagsStr ?? ''}`;
    const forceInitialSync = winGlobals.__ag_experiments_sig !== nextSig;

    writeStorageAndNotify(ENV_OVERRIDE_KEY, prevEnvStr, nextEnvStr, forceInitialSync);
    writeStorageAndNotify(FLAG_OVERRIDES_KEY, prevFlagsStr, nextFlagsStr, forceInitialSync);

    winGlobals.__ag_experiments_sig = nextSig;
  } catch (err) {
    console.warn('[Aura] Failed to sync developer settings:', err);
  }
}

export function setupExperiments(advanced: AdvancedConfig): void {
  syncDeveloperSettings(advanced);
}
