/**
 * Aura Dashboard · Locale Registry & Loader
 */

import { jaJP } from './ja-JP';
import { koKR } from './ko-KR';
import { zhCN } from './zh-CN';
import type { LocaleCode, LocalePackage, SupportedLocale } from './types';

export * from './types';
export * from './base';

export const LOCALES: Record<SupportedLocale, LocalePackage> = {
  'zh-CN': zhCN,
  'ja-JP': jaJP,
  'ko-KR': koKR
};

/**
 * 根据语言代码获取对应语言包；
 * 若为 'default' 或未知语言则返回 null，此时插件保持宿主原生英文。
 */
export function getLocalePackage(code?: LocaleCode | null): LocalePackage | null {
  if (!code || code === 'default') return null;
  return LOCALES[code as SupportedLocale] ?? null;
}
