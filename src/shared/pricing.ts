export interface ModelPricingRates {
  inputRate: number;
  outputRate: number;
  cacheRate: number;
}

export interface ModelPricingMetadata {
  source: 'online' | 'cache' | 'fallback';
  lastUpdated: number;
  modelCount: number;
}

export interface ModelPricingRegistryOptions {
  skipBackgroundFetch?: boolean;
}

/**
 * Extracts the active context limit for a model entry from GetAvailableModels.
 * Prefers CASCADE_USE_EXPERIMENT_CHECKPOINTER.max_token_limit (the host's compaction waterline),
 * falling back to maxTokens when the experiment flag is absent.
 */
export function extractCheckpointerContextLimit(modelEntry: unknown): number | null {
  if (!modelEntry || typeof modelEntry !== 'object') return null;
  const entry = modelEntry as Record<string, any>;
  const rawStr = entry?.modelExperiments?.experiments?.CASCADE_USE_EXPERIMENT_CHECKPOINTER?.stringValue;
  if (typeof rawStr === 'string' && rawStr.trim()) {
    try {
      const parsed = JSON.parse(rawStr) as Record<string, unknown>;
      const limit = Number(parsed?.max_token_limit);
      if (Number.isFinite(limit) && limit > 0) {
        return Math.round(limit);
      }
    } catch {
      // Ignore malformed experiment JSON and fall back to maxTokens
    }
  }
  const maxTokens = Number(entry?.maxTokens);
  if (Number.isFinite(maxTokens) && maxTokens > 0) {
    return Math.round(maxTokens);
  }
  return null;
}

export const OFFICIAL_AVAILABLE_MODEL_IDS = [
  'claude-opus-4-6-thinking',
  'claude-sonnet-4-6',
  'gemini-4-argon-disabled',
  'gemini-4-carbon-disabled',
  'gemini-4-hydrogen-disabled',
  'gemini-3.8-flash-high',
  'gemini-3.8-flash-medium',
  'gemini-3.8-flash-low',
  'gpt-oss-120b-medium'
];

export const ZERO_MODEL_PRICING: ModelPricingRates = { inputRate: 0, outputRate: 0, cacheRate: 0 };

export const FALLBACK_MODEL_PRICING: Record<string, ModelPricingRates> = {
  'gemini-4-carbon-disabled': { inputRate: 2.00, outputRate: 10.00, cacheRate: 0.20 },
  'gemini-4-carbon': { inputRate: 2.00, outputRate: 10.00, cacheRate: 0.20 },
  'gemini-4-argon-disabled': { inputRate: 2.00, outputRate: 10.00, cacheRate: 0.20 },
  'gemini-4-argon': { inputRate: 2.00, outputRate: 10.00, cacheRate: 0.20 },
  'gemini-4-hydrogen-disabled': { inputRate: 1.50, outputRate: 7.50, cacheRate: 0.15 },
  'gemini-4-hydrogen': { inputRate: 1.50, outputRate: 7.50, cacheRate: 0.15 },
  'gemini-3.8-flash-high': { inputRate: 0.75, outputRate: 3.75, cacheRate: 0.075 },
  'gemini-3.8-flash-medium': { inputRate: 0.75, outputRate: 3.75, cacheRate: 0.075 },
  'gemini-3.8-flash-low': { inputRate: 0.75, outputRate: 3.75, cacheRate: 0.075 },
  'gemini-3.8-flash': { inputRate: 0.75, outputRate: 3.75, cacheRate: 0.075 },
  'gemini-2.5-pro': { inputRate: 1.25, outputRate: 10.00, cacheRate: 0.125 },
  'gemini-pro': { inputRate: 1.25, outputRate: 10.00, cacheRate: 0.125 },
  'gemini-flash': { inputRate: 0.75, outputRate: 3.75, cacheRate: 0.075 },
  default: ZERO_MODEL_PRICING
};

export class ModelPricingRegistry {
  private static instance: ModelPricingRegistry;
  private pricingCache = new Map<string, ModelPricingRates>();
  private metadata: ModelPricingMetadata = {
    source: 'fallback',
    lastUpdated: 0,
    modelCount: 0
  };
  private inFlightFetch: Promise<boolean> | null = null;
  private inFlightModelsFetch: Promise<void> | null = null;
  private modelsLoaded = false;
  private storagePath?: string;
  private availableModelIds: string[] = OFFICIAL_AVAILABLE_MODEL_IDS;
  private availableModelNames = new Map<string, string>();
  private contextLimitCache = new Map<string, number>();
  private contextLimitIds: Array<{ key: string; limit: number }> = [];
  private displayNameLimits: Array<{ key: string; limit: number }> = [];

  constructor(storageDir?: string, options?: ModelPricingRegistryOptions) {
    if (storageDir) {
      this.storagePath = `${storageDir}/model_pricing_cache.json`;
    } else if (typeof process !== 'undefined' && process.env?.HOME) {
      this.storagePath = `${process.env.HOME}/.gemini/antigravity/model_pricing_cache.json`;
    }
    this.initFallback();
    this.loadFromCache();
    if (!options?.skipBackgroundFetch) {
      // Warm up in background asynchronously without blocking
      void this.fetchAvailableModels();
      void this.fetchOnlinePricing();
    }
  }

  public async ensureAvailableModelsLoaded(): Promise<void> {
    if (this.modelsLoaded) return;
    await this.fetchAvailableModels();
  }

  public ingestAvailableModelsResponse(data: unknown): boolean {
    if (!data || typeof data !== 'object') return false;
    const response = (data as any).response;
    if (!response || typeof response !== 'object') return false;

    const sorts = response.agentModelSorts || [];
    const modelIds = sorts[0]?.groups?.[0]?.modelIds;
    if (Array.isArray(modelIds) && modelIds.length > 0) {
      this.availableModelIds = modelIds;
    }

    const models = response.models;
    if (!models || typeof models !== 'object') return false;

    let ingested = 0;
    const nextIds: Array<{ key: string; limit: number }> = [];
    const nextDisplayNames: Array<{ key: string; limit: number }> = [];

    for (const [id, m] of Object.entries(models as Record<string, any>)) {
      if (!m || typeof m !== 'object') continue;
      if (typeof m.displayName === 'string' && m.displayName.trim()) {
        this.availableModelNames.set(id, m.displayName);
      }
      const limit = extractCheckpointerContextLimit(m);
      if (limit !== null) {
        ingested++;
        const idKey = id.trim().toLowerCase();
        if (idKey) {
          this.contextLimitCache.set(idKey, limit);
          nextIds.push({ key: idKey, limit });
        }
        if (typeof m.displayName === 'string' && m.displayName.trim()) {
          const dispKey = m.displayName.trim().toLowerCase();
          this.contextLimitCache.set(dispKey, limit);
          nextDisplayNames.push({ key: dispKey, limit });
        }
        if (typeof m.model === 'string' && m.model.trim()) {
          this.contextLimitCache.set(m.model.trim().toLowerCase(), limit);
        }
      }
    }

    if (ingested > 0) {
      this.contextLimitIds = nextIds;
      this.displayNameLimits = nextDisplayNames.sort((a, b) => b.key.length - a.key.length);
      this.modelsLoaded = true;
    }
    return ingested > 0;
  }

  public getModelContextLimit(identifiers: Array<string | undefined>): number | null {
    for (const raw of identifiers) {
      const key = (raw || '').trim().toLowerCase();
      if (!key || key === 'unknown' || key === 'unknown model') continue;

      const exact = this.contextLimitCache.get(key);
      if (exact !== undefined) return exact;

      for (const entry of this.displayNameLimits) {
        if (key === entry.key || key.startsWith(`${entry.key} `)) {
          return entry.limit;
        }
      }

      for (const entry of this.contextLimitIds) {
        if (entry.key.startsWith(`${key}-`)) {
          return entry.limit;
        }
      }
    }
    return null;
  }

  public async fetchAvailableModels(): Promise<void> {
    if (this.inFlightModelsFetch) {
      return this.inFlightModelsFetch;
    }

    const lsAddress =
      typeof process !== 'undefined'
        ? process.env.ANTIGRAVITY_LS_ADDRESS || 'localhost:5387'
        : 'localhost:5387';
    const csrfToken =
      typeof process !== 'undefined' ? process.env.ANTIGRAVITY_CSRF_TOKEN || '' : '';

    this.inFlightModelsFetch = (async () => {
      try {
        const url = `http://${lsAddress}/exa.language_server_pb.LanguageServerService/GetAvailableModels`;
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 2000);
        const res = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-codeium-csrf-token': csrfToken
          },
          body: '{}',
          signal: controller.signal
        });
        clearTimeout(timer);

        if (res.ok) {
          const data = await res.json();
          if (this.ingestAvailableModelsResponse(data)) {
            this.saveToCache();
          }
        }
      } catch {
        // Degrades gracefully when Language Server is unavailable
      } finally {
        this.inFlightModelsFetch = null;
      }
    })();

    return this.inFlightModelsFetch;
  }

  public static getInstance(storageDir?: string): ModelPricingRegistry {
    if (!ModelPricingRegistry.instance) {
      ModelPricingRegistry.instance = new ModelPricingRegistry(storageDir);
    }
    return ModelPricingRegistry.instance;
  }

  private initFallback(): void {
    for (const [k, v] of Object.entries(FALLBACK_MODEL_PRICING)) {
      this.pricingCache.set(k, v);
    }
    this.metadata.modelCount = this.pricingCache.size;
  }

  private loadFromCache(): void {
    if (!this.storagePath) return;
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const fs = require('node:fs');
      if (fs.existsSync(this.storagePath)) {
        const raw = fs.readFileSync(this.storagePath, 'utf8');
        const parsed = JSON.parse(raw);
        if (parsed?.rates && typeof parsed.rates === 'object') {
          for (const [k, v] of Object.entries(parsed.rates)) {
            if (v && typeof v === 'object') {
              const r = v as Partial<ModelPricingRates>;
              if (typeof r.inputRate === 'number' && typeof r.outputRate === 'number') {
                this.pricingCache.set(k.toLowerCase(), {
                  inputRate: r.inputRate,
                  outputRate: r.outputRate,
                  cacheRate: typeof r.cacheRate === 'number' ? r.cacheRate : r.inputRate * 0.1
                });
              }
            }
          }
          this.metadata.source = 'cache';
          this.metadata.lastUpdated = parsed.lastUpdated || Date.now();
          this.metadata.modelCount = this.pricingCache.size;
        }
        if (parsed?.contextLimits && typeof parsed.contextLimits === 'object') {
          for (const [k, v] of Object.entries(parsed.contextLimits)) {
            const limit = Number(v);
            if (Number.isFinite(limit) && limit > 0) {
              this.contextLimitCache.set(k.toLowerCase(), Math.round(limit));
            }
          }
          if (Array.isArray(parsed.displayNameLimits)) {
            this.displayNameLimits = parsed.displayNameLimits
              .filter(
                (x: any): x is { key: string; limit: number } =>
                  x && typeof x.key === 'string' && typeof x.limit === 'number' && x.limit > 0
              )
              .sort((a: { key: string }, b: { key: string }) => b.key.length - a.key.length);
          }
          if (Array.isArray(parsed.contextLimitIds)) {
            this.contextLimitIds = parsed.contextLimitIds.filter(
              (x: any): x is { key: string; limit: number } =>
                x && typeof x.key === 'string' && typeof x.limit === 'number' && x.limit > 0
            );
          }
        }
      }
    } catch {
      // Ignore cache load errors, fallback will remain active
    }
  }

  private saveToCache(): void {
    if (!this.storagePath) return;
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const fs = require('node:fs');
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const path = require('node:path');
      const dir = path.dirname(this.storagePath);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

      const serializable: Record<string, ModelPricingRates> = {};
      for (const [k, v] of this.pricingCache.entries()) {
        serializable[k] = v;
      }
      const serializableLimits: Record<string, number> = {};
      for (const [k, v] of this.contextLimitCache.entries()) {
        serializableLimits[k] = v;
      }
      fs.writeFileSync(
        this.storagePath,
        JSON.stringify(
          {
            source: this.metadata.source,
            lastUpdated: this.metadata.lastUpdated,
            rates: serializable,
            contextLimits: serializableLimits,
            contextLimitIds: this.contextLimitIds,
            displayNameLimits: this.displayNameLimits
          },
          null,
          2
        ),
        'utf8'
      );
    } catch {
      // Ignore cache save errors
    }
  }

  public async fetchOnlinePricing(force = false): Promise<boolean> {
    const now = Date.now();
    // Cache for 24 hours
    if (!force && this.metadata.source === 'online' && now - this.metadata.lastUpdated < 86400 * 1000) {
      return true;
    }
    if (this.inFlightFetch) {
      return this.inFlightFetch;
    }

    this.inFlightFetch = this.performOnlineFetch()
      .then((success) => {
        if (success) {
          this.metadata.source = 'online';
          this.metadata.lastUpdated = Date.now();
          this.metadata.modelCount = this.pricingCache.size;
          this.saveToCache();
        }
        return success;
      })
      .catch(() => false)
      .finally(() => {
        this.inFlightFetch = null;
      });

    return this.inFlightFetch;
  }

  private async performOnlineFetch(): Promise<boolean> {
    // Primary: LiteLLM model pricing JSON
    try {
      const url =
        'https://raw.githubusercontent.com/BerriAI/litellm/main/model_prices_and_context_window.json';
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 3500);
      const res = await fetch(url, { signal: controller.signal });
      clearTimeout(timer);

      if (res.ok) {
        const data = (await res.json()) as Record<string, any>;
        let parsedCount = 0;
        for (const [rawKey, entry] of Object.entries(data)) {
          if (!entry || typeof entry !== 'object') continue;
          const inCost = (Number(entry.input_cost_per_token) || 0) * 1e6;
          const outCost = (Number(entry.output_cost_per_token) || 0) * 1e6;
          const cacheCost = Number.isFinite(entry.cache_read_input_token_cost)
            ? Number(entry.cache_read_input_token_cost) * 1e6
            : inCost * 0.1;

          if (inCost > 0 || outCost > 0) {
            const cleanKey = rawKey
              .replace(/^(gemini\/|anthropic\.|anthropic\/|openai\/)/i, '')
              .toLowerCase();
            this.pricingCache.set(cleanKey, {
              inputRate: Math.round(inCost * 1000) / 1000,
              outputRate: Math.round(outCost * 1000) / 1000,
              cacheRate: Math.round(cacheCost * 1000) / 1000
            });
            parsedCount++;
          }
        }
        if (parsedCount > 50) return true;
      }
    } catch {
      // Fall through to secondary
    }

    // Secondary: OpenRouter public models endpoint
    try {
      const url = 'https://openrouter.ai/api/v1/models';
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 3500);
      const res = await fetch(url, { signal: controller.signal });
      clearTimeout(timer);

      if (res.ok) {
        const data = (await res.json()) as { data?: Array<{ id: string; pricing?: any }> };
        let parsedCount = 0;
        for (const m of data.data || []) {
          const inCost = (Number(m.pricing?.prompt) || 0) * 1e6;
          const outCost = (Number(m.pricing?.completion) || 0) * 1e6;
          const cacheCost = (Number(m.pricing?.input_cache_read) || 0) * 1e6;
          if (inCost > 0 || outCost > 0) {
            const cleanKey = m.id.replace(/^(google\/|anthropic\/|openai\/)/i, '').toLowerCase();
            this.pricingCache.set(cleanKey, {
              inputRate: Math.round(inCost * 1000) / 1000,
              outputRate: Math.round(outCost * 1000) / 1000,
              cacheRate:
                cacheCost > 0
                  ? Math.round(cacheCost * 1000) / 1000
                  : Math.round(inCost * 0.1 * 1000) / 1000
            });
            parsedCount++;
          }
        }
        if (parsedCount > 20) return true;
      }
    } catch {
      // Both online fetches failed; fallback remains active
    }

    return false;
  }

  public getModelPricingRates(nameOrId: string): ModelPricingRates {
    const s = (nameOrId || '').toLowerCase().trim();
    if (!s) return ZERO_MODEL_PRICING;

    // 仅计算 Gemini 系列模型，其余非 Gemini 模型一并忽略（费率记为 0，花费为 0）
    if (!s.includes('gemini')) {
      return ZERO_MODEL_PRICING;
    }

    // 1. Direct cache lookup
    const direct = this.pricingCache.get(s);
    if (direct) return direct;

    // 2. Normalized prefix lookup
    const stripped = s.replace(/^(google\/|models\/)/, '');
    const strippedDirect = this.pricingCache.get(stripped);
    if (strippedDirect) return strippedDirect;

    // 3. Gemini family matching
    if (s.includes('carbon')) {
      return (
        this.pricingCache.get('gemini-4-carbon') ||
        this.pricingCache.get('gemini-4-carbon-disabled') ||
        FALLBACK_MODEL_PRICING['gemini-4-carbon']
      );
    }
    if (s.includes('argon')) {
      return (
        this.pricingCache.get('gemini-4-argon') ||
        this.pricingCache.get('gemini-4-argon-disabled') ||
        FALLBACK_MODEL_PRICING['gemini-4-argon']
      );
    }
    if (s.includes('hydrogen')) {
      return (
        this.pricingCache.get('gemini-4-hydrogen') ||
        this.pricingCache.get('gemini-4-hydrogen-disabled') ||
        FALLBACK_MODEL_PRICING['gemini-4-hydrogen']
      );
    }
    if (s.includes('flash') || s.includes('3.8') || s.includes('3.7')) {
      return (
        this.pricingCache.get('gemini-3.8-flash') ||
        this.pricingCache.get('gemini-flash') ||
        FALLBACK_MODEL_PRICING['gemini-3.8-flash']
      );
    }
    if (s.includes('pro') || s.includes('2.5')) {
      return (
        this.pricingCache.get('gemini-2.5-pro') ||
        this.pricingCache.get('gemini-pro') ||
        FALLBACK_MODEL_PRICING['gemini-2.5-pro']
      );
    }

    return (
      this.pricingCache.get('gemini-3.8-flash') ||
      FALLBACK_MODEL_PRICING['gemini-3.8-flash']
    );
  }

  public getPricingTooltipHtml(): string {
    const models = [
      {
        id: 'gemini-4-carbon',
        name: 'Gemini 4 Carbon',
        color: '#3B82F6',
        rates: this.getModelPricingRates('gemini-4-carbon')
      },
      {
        id: 'gemini-4-argon',
        name: 'Gemini 4 Argon',
        color: '#60A5FA',
        rates: this.getModelPricingRates('gemini-4-argon')
      },
      {
        id: 'gemini-4-hydrogen',
        name: 'Gemini 4 Hydrogen',
        color: '#06B6D4',
        rates: this.getModelPricingRates('gemini-4-hydrogen')
      },
      {
        id: 'gemini-3.8-flash',
        name: 'Gemini 3.8 Flash',
        color: '#10B981',
        rates: this.getModelPricingRates('gemini-3.8-flash')
      }
    ];

    const rows = models
      .map(
        (m) => `
        <tr>
          <td class="td-model"><span class="tooltip-dot" style="background: ${m.color}"></span>${m.name}</td>
          <td class="td-num">$${m.rates.inputRate.toFixed(2)}</td>
          <td class="td-num">$${m.rates.outputRate.toFixed(2)}</td>
          <td class="td-num">$${m.rates.cacheRate.toFixed(3)}</td>
        </tr>`
      )
      .join('');

    return `
      <div class="popover-tooltip">
        <div class="tooltip-header">
          <span class="tooltip-title">Commercial Model Pricing</span>
          <span class="tooltip-badge">per 1M tok</span>
        </div>
        <table class="pricing-tooltip-table">
          <thead>
            <tr>
              <th class="th-model">Model</th>
              <th>Input</th>
              <th>Output</th>
              <th>Cache</th>
            </tr>
          </thead>
          <tbody>
            ${rows}
          </tbody>
        </table>
      </div>
    `;
  }

  public getPricingTooltipText(): string {
    const models = [
      { name: 'Gemini 4 Carbon', rates: this.getModelPricingRates('gemini-4-carbon') },
      { name: 'Gemini 4 Argon', rates: this.getModelPricingRates('gemini-4-argon') },
      { name: 'Gemini 4 Hydrogen', rates: this.getModelPricingRates('gemini-4-hydrogen') },
      { name: 'Gemini 3.8 Flash', rates: this.getModelPricingRates('gemini-3.8-flash') }
    ];

    return [
      'Commercial Model Pricing (per 1M tokens):',
      ...models.map(
        (m) =>
          `• ${m.name}: $${m.rates.inputRate.toFixed(2)} in · $${m.rates.outputRate.toFixed(2)} out · $${m.rates.cacheRate.toFixed(3)} cache`
      )
    ].join('\n');
  }

  public getMetadata(): ModelPricingMetadata {
    return { ...this.metadata };
  }
}

export function getModelPricingRates(nameOrId: string): ModelPricingRates {
  return ModelPricingRegistry.getInstance().getModelPricingRates(nameOrId);
}

export function getPricingTooltipText(): string {
  return ModelPricingRegistry.getInstance().getPricingTooltipText();
}

export function getPricingTooltipHtml(): string {
  return ModelPricingRegistry.getInstance().getPricingTooltipHtml();
}
