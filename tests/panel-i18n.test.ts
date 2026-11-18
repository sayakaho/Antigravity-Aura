import { describe, expect, test } from 'bun:test';
import { applyPanelTranslations, getPanelLanguage, PANEL_TRANSLATIONS, t } from '../src/panel/i18n';

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
});
