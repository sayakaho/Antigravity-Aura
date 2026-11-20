import { describe, expect, test } from 'bun:test';
import {
  FALLBACK_MODEL_PRICING,
  getModelPricingRates,
  getPricingTooltipText,
  ModelPricingRegistry
} from '../src/shared/pricing';

describe('ModelPricingRegistry & Dynamic Online Rates', () => {
  test('returns rates for Gemini models and zero rates for all non-Gemini models', () => {
    const pro = getModelPricingRates('gemini-2.5-pro');
    expect(pro.inputRate).toBeGreaterThan(0);
    expect(pro.outputRate).toBeGreaterThan(0);
    expect(pro.cacheRate).toBeGreaterThan(0);

    const flash = getModelPricingRates('gemini-3.8-flash');
    expect(flash.inputRate).toBeGreaterThan(0);
    expect(flash.outputRate).toBeGreaterThan(0);
    expect(flash.cacheRate).toBeGreaterThan(0);

    const carbon = getModelPricingRates('gemini-4-carbon');
    expect(carbon.inputRate).toBeGreaterThan(0);
    expect(carbon.outputRate).toBeGreaterThan(0);
    expect(carbon.cacheRate).toBeGreaterThan(0);

    // 非 Gemini 模型一并忽略，费率全部为 0
    const sonnet = getModelPricingRates('claude-3-5-sonnet');
    expect(sonnet.inputRate).toBe(0);
    expect(sonnet.outputRate).toBe(0);
    expect(sonnet.cacheRate).toBe(0);

    const opus = getModelPricingRates('claude-opus-4-6-thinking');
    expect(opus.inputRate).toBe(0);

    const gpt4 = getModelPricingRates('gpt-4o');
    expect(gpt4.inputRate).toBe(0);

    const gptOss = getModelPricingRates('gpt-oss-120b-medium');
    expect(gptOss.inputRate).toBe(0);

    const fallback = getModelPricingRates('unknown-model-xyz');
    expect(fallback.inputRate).toBe(0);
  });

  test('formats tooltip text strictly showing official Gemini series models', () => {
    const tip = getPricingTooltipText();
    expect(tip).toContain('Commercial Model Pricing (per 1M tokens):');
    expect(tip).toContain('Gemini 4 Carbon');
    expect(tip).toContain('Gemini 4 Argon');
    expect(tip).toContain('Gemini 4 Hydrogen');
    expect(tip).toContain('Gemini 3.8 Flash');

    // 严禁包含非 Gemini 模型、推理层级后缀与冗余 Catalog 行
    expect(tip).not.toContain('Claude');
    expect(tip).not.toContain('GPT-OSS');
    expect(tip).not.toContain('Catalog: Live Online');
    expect(tip).not.toContain('High / Med / Low');
  });

  test('ModelPricingRegistry instance can refresh online and tracks metadata', async () => {
    const registry = new ModelPricingRegistry();
    const metaBefore = registry.getMetadata();
    expect(metaBefore.modelCount).toBeGreaterThan(0);

    // Online fetch attempt (network resilience check)
    const success = await registry.fetchOnlinePricing(true);
    const metaAfter = registry.getMetadata();
    if (success) {
      expect(metaAfter.source).toBe('online');
      expect(metaAfter.modelCount).toBeGreaterThan(100);
    } else {
      expect(['fallback', 'cache']).toContain(metaAfter.source);
    }
  }, 15000);
});
