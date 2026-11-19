/**
 * Aura Dashboard · Universal Localization Contract Types
 */

import type { HostTranslations } from './base';

export type SupportedLocale = 'zh-CN' | 'ja-JP' | 'ko-KR';
export type LocaleCode = 'default' | SupportedLocale | string;

export interface DynamicPatternRule {
  id: string;
  pattern: RegExp;
  replace: string | ((substring: string, ...args: string[]) => string);
}

export interface ActivitySummaryMessages {
  commands: (count: number) => string;
  searches: (count: number) => string;
  pages: (count: number) => string;
  filesRead: (count: number) => string;
  filesEdited: (count: number) => string;
  subagents: (count: number) => string;
  otherTools: (count: number) => string;
  failed: (count: number) => string;
  separator: string;
}

export interface ComponentMessages {
  metricsPillAriaLabel: string;
  activitySummary: ActivitySummaryMessages;
}

export interface LocalePackage {
  readonly code: SupportedLocale;
  readonly label: string;
  readonly translations: HostTranslations;
  readonly patterns: readonly DynamicPatternRule[];
  readonly attributePatterns?: readonly DynamicPatternRule[];
  readonly messages: ComponentMessages;
}
