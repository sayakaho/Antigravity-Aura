import { describe, expect, test } from 'bun:test';
import {
  getModelPricingRates,
  getPricingTooltipHtml,
  getPricingTooltipText,
  ModelPricingRegistry
} from '../src/shared/pricing';

describe('ModelPricingRegistry & Dynamic Online Rates', () => {
  test('resolves rates across Gemini, Claude, and GPT models while zeroing unknown models', () => {
    const pro = getModelPricingRates('gemini-2.5-pro');
    expect(pro.inputRate).toBeGreaterThan(0);
    expect(pro.outputRate).toBeGreaterThan(0);
    expect(pro.cacheRate).toBeGreaterThan(0);

    const flash = getModelPricingRates('gemini-3.8-flash-high');
    expect(flash.inputRate).toBeGreaterThan(0);
    expect(flash.outputRate).toBeGreaterThan(0);
    expect(flash.cacheRate).toBeGreaterThan(0);

    const neon = getModelPricingRates('gemini-4-neon-high');
    expect(neon.inputRate).toBeGreaterThan(0);
    expect(neon.outputRate).toBeGreaterThan(0);

    const hydrogen = getModelPricingRates('gemini-4-hydrogen-tiered-xhigh');
    expect(hydrogen.inputRate).toBeGreaterThan(0);
    expect(hydrogen.outputRate).toBeGreaterThan(0);

    const sonnet = getModelPricingRates('claude-3-5-sonnet');
    expect(sonnet.inputRate).toBeGreaterThan(0);
    expect(sonnet.outputRate).toBeGreaterThan(0);

    const opus = getModelPricingRates('claude-opus-4-6-thinking');
    expect(opus.inputRate).toBeGreaterThan(0);
    expect(opus.outputRate).toBeGreaterThan(0);

    const gpt4 = getModelPricingRates('gpt-4o');
    expect(gpt4.inputRate).toBeGreaterThan(0);

    const gptOss = getModelPricingRates('gpt-oss-120b-medium');
    expect(gptOss.inputRate).toBeGreaterThan(0);

    const unknown = getModelPricingRates('unknown-model-xyz');
    expect(unknown.inputRate).toBe(0);
    expect(unknown.outputRate).toBe(0);
    expect(unknown.cacheRate).toBe(0);
  });

  test('resolves placeholder model IDs via fallback displayName or ingested GetAvailableModels map', () => {
    const registry = new ModelPricingRegistry(undefined, { skipBackgroundFetch: true });
    registry.ingestAvailableModelsResponse({
      response: {
        models: {
          model_placeholder_m529: {
            displayName: 'Gemini 4 Hydrogen (High)',
            model: 'gemini-4-hydrogen-high',
            maxTokens: 512000
          }
        }
      }
    });

    const byPlaceholder = registry.getModelPricingRates('model_placeholder_m529');
    expect(byPlaceholder.inputRate).toBeGreaterThan(0);

    const byFallbackName = registry.getModelPricingRates('model_placeholder_unknown', 'Claude Sonnet 4.6 (Thinking)');
    expect(byFallbackName.inputRate).toBeGreaterThan(0);
  });

  test('hydrates browser-side registry from server snapshot without reseller prefix pollution', () => {
    const server = new ModelPricingRegistry(undefined, { skipBackgroundFetch: true });
    server.ingestSnapshot({
      source: 'online',
      lastUpdated: 1795205000000,
      modelCount: 3,
      rates: {
        'gemini-4-neon': { inputRate: 3.1, outputRate: 15.5, cacheRate: 0.155 },
        'claude-opus-4-6': { inputRate: 5.0, outputRate: 25.0, cacheRate: 0.5 },
        'databricks/databricks-gemini-4-neon': { inputRate: 99, outputRate: 99, cacheRate: 9 }
      },
      availableModelIds: ['gemini-4-neon-high', 'claude-opus-4-6-thinking'],
      availableModelNames: {
        'gemini-4-neon-high': 'Gemini 4 Neon (High)'
      }
    });

    const snapshot = server.exportSnapshot(['gemini-4-neon-high', 'claude-opus-4-6-thinking']);
    expect(snapshot.source).toBe('online');
    expect(snapshot.rates['databricks/databricks-gemini-4-neon']).toBeUndefined();
    expect(snapshot.rates['gemini-4-neon-high']?.inputRate).toBe(3.1);
    expect(snapshot.rates['claude-opus-4-6-thinking']?.inputRate).toBe(5.0);

    const client = new ModelPricingRegistry(undefined, { skipBackgroundFetch: true });
    const ingested = client.ingestSnapshot(snapshot);
    expect(ingested).toBe(true);
    expect(client.getMetadata().source).toBe('online');
    expect(client.getModelPricingRates('gemini-4-neon-high').inputRate).toBe(3.1);
    expect(client.getModelPricingRates('claude-opus-4-6-thinking').outputRate).toBe(25.0);
  });

  test('formats tooltip text and HTML dynamically from actual models and falls back gracefully', () => {
    const tipDefault = getPricingTooltipText();
    expect(tipDefault).toContain('Commercial Model Pricing (per 1M tokens');

    const customModels = [
      {
        modelId: 'claude-opus-4-6-thinking',
        modelName: 'Claude Opus 4.6 (Thinking)',
        color: '#D97706',
        rates: { inputRate: 5.0, outputRate: 25.0, cacheRate: 0.5 },
        cost: 12.34
      },
      {
        modelId: 'gemini-4-hydrogen-high',
        modelName: 'Gemini 4 Hydrogen (High)',
        color: '#06B6D4',
        rates: { inputRate: 1.5, outputRate: 7.5, cacheRate: 0.075 },
        cost: 2.5
      }
    ];

    const tipText = getPricingTooltipText(customModels);
    expect(tipText).toContain('Claude Opus 4.6 (Thinking)');
    expect(tipText).toContain('Est. $12.34');
    expect(tipText).toContain('Gemini 4 Hydrogen (High)');

    const tipHtml = getPricingTooltipHtml(customModels);
    expect(tipHtml).toContain('Claude Opus 4.6 (Thinking)');
    expect(tipHtml).toContain('$12.34');
    expect(tipHtml).toContain('Source:');
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
