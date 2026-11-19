import { describe, expect, test } from 'bun:test';
import {
  applyPanelTranslations,
  getPanelLanguage,
  PANEL_BASE_KEYS,
  type PanelTranslationKey,
  PANEL_TRANSLATIONS,
  PANEL_TRANSLATIONS_JA,
  PANEL_TRANSLATIONS_KO,
  PANEL_TRANSLATIONS_ZH,
  t
} from '../src/panel/i18n';

describe('Panel i18n Engine', () => {
  test('t() translates dynamic keys in zh-CN and preserves English in default', () => {
    applyPanelTranslations('default');
    expect(getPanelLanguage()).toBe('default');
    expect(t('Configuration applied in real-time')).toBe('Configuration applied in real-time');
    expect(t('Save failed')).toBe('Save failed');
    expect(t('Live')).toBe('Live');

    applyPanelTranslations('zh-CN');
    expect(getPanelLanguage()).toBe('zh-CN');
    expect(t('Configuration applied in real-time')).toBe('配置已实时生效');
    expect(t('Save failed')).toBe('保存配置失败');
    expect(t('Live')).toBe('实时');

    applyPanelTranslations('ja-JP');
    expect(getPanelLanguage()).toBe('ja-JP');
    expect(t('Configuration applied in real-time')).toBe('設定がリアルタイムに適用されました');
    expect(t('Save failed')).toBe('設定の保存に失敗しました');
    expect(t('Live')).toBe('ライブ');

    applyPanelTranslations('ko-KR');
    expect(getPanelLanguage()).toBe('ko-KR');
    expect(t('Configuration applied in real-time')).toBe('설정이 실시간으로 적용되었습니다');
    expect(t('Save failed')).toBe('저장 실패');
    expect(t('Live')).toBe('실시간');
  });

  test('contains essential dictionary keys for preferences and analytics', () => {
    expect(PANEL_TRANSLATIONS['Aura Dashboard']).toBe('Aura 控制台');
    expect(PANEL_TRANSLATIONS['Analytics']).toBe('数据分析');
    expect(PANEL_TRANSLATIONS['Preferences']).toBe('偏好设置');
    expect(PANEL_TRANSLATIONS['Appearance & Themes']).toBe('外观与主题');
    expect(PANEL_TRANSLATIONS['Language & Localization']).toBe('语言与本地化');
    expect(PANEL_TRANSLATIONS['Session Turns:']).toBe('会话轮次：');
    expect(PANEL_TRANSLATIONS['Cache Hit Rate']).toBe('缓存命中率');
    expect(PANEL_TRANSLATIONS['CDP Engine Status']).toBe('CDP 引擎状态');
  });

  test('switches language state cleanly back to default', () => {
    applyPanelTranslations('zh-CN');
    expect(getPanelLanguage()).toBe('zh-CN');

    applyPanelTranslations('default');
    expect(getPanelLanguage()).toBe('default');
    expect(t('Analytics')).toBe('Analytics');
  });

  test('Panel dictionaries strictly implement PANEL_BASE_KEYS 1:1 without missing keys or empty values', () => {
    const baseKeys = Object.keys(PANEL_BASE_KEYS) as PanelTranslationKey[];
    expect(baseKeys.length).toBeGreaterThan(200);

    const zhKeys = Object.keys(PANEL_TRANSLATIONS_ZH);
    const jaKeys = Object.keys(PANEL_TRANSLATIONS_JA);
    const koKeys = Object.keys(PANEL_TRANSLATIONS_KO);

    expect(zhKeys.length).toBe(baseKeys.length);
    expect(jaKeys.length).toBe(baseKeys.length);
    expect(koKeys.length).toBe(baseKeys.length);

    for (const key of baseKeys) {
      expect((PANEL_TRANSLATIONS_ZH as Record<string, string>)[key]).toBeDefined();
      expect((PANEL_TRANSLATIONS_ZH as Record<string, string>)[key].trim()).not.toBe('');

      expect((PANEL_TRANSLATIONS_JA as Record<string, string>)[key]).toBeDefined();
      expect((PANEL_TRANSLATIONS_JA as Record<string, string>)[key].trim()).not.toBe('');

      expect((PANEL_TRANSLATIONS_KO as Record<string, string>)[key]).toBeDefined();
      expect((PANEL_TRANSLATIONS_KO as Record<string, string>)[key].trim()).not.toBe('');
    }

    // 防御校验：韩文字典中严禁出现汉字混杂（如“发生”）
    const hanCharRegex = /[\u4e00-\u9fa5]/;
    for (const [key, val] of Object.entries(PANEL_TRANSLATIONS_KO)) {
      if (key === 'Japanese (日本語)') continue; // 语言自解释标签包含日语汉字
      if (hanCharRegex.test(val)) {
        throw new Error(`Forbidden Chinese character found in Korean panel translation for key "${key}": "${val}"`);
      }
    }
  });

  test('t() translations remain accurate and idempotent across rapid switching cycles', () => {
    const cycles = ['zh-CN', 'ja-JP', 'ko-KR', 'default', 'ja-JP', 'zh-CN', 'default', 'ko-KR'] as const;
    const testKey = 'Aura Dashboard';
    const fontKey = 'Custom Monospace Font Family';

    for (const lang of cycles) {
      applyPanelTranslations(lang);
      expect(getPanelLanguage()).toBe(lang);
      if (lang === 'zh-CN') {
        expect(t(testKey)).toBe('Aura 控制台');
        expect(t(fontKey)).toBe('自定义等宽字体');
      } else if (lang === 'ja-JP') {
        expect(t(testKey)).toBe('Aura ダッシュボード');
        expect(t(fontKey)).toBe('カスタム等幅フォント');
      } else if (lang === 'ko-KR') {
        expect(t(testKey)).toBe('Aura 대시보드');
        expect(t(fontKey)).toBe('사용자 지정 고정폭 글꼴');
      } else {
        expect(t(testKey)).toBe('Aura Dashboard');
        expect(t(fontKey)).toBe('Custom Monospace Font Family');
      }
    }
  });
});
