import { escapeHtml } from './format';

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

export interface ModelPricingSnapshot {
  source: 'online' | 'cache' | 'fallback';
  lastUpdated: number;
  modelCount: number;
  rates: Record<string, ModelPricingRates>;
  availableModelIds: string[];
  availableModelNames: Record<string, string>;
}

export interface PricingTooltipModelEntry {
  modelId: string;
  modelName: string;
  color?: string;
  rates: ModelPricingRates;
  cost?: number;
  tokens?: number;
}

export interface ModelPricingRegistryOptions {
  skipBackgroundFetch?: boolean;
}

const PRICING_CACHE_VERSION = 2;

const DIRECT_PROVIDER_PREFIX_RE =
  /^(?:openrouter\/(?:google|anthropic|openai)\/|vertex_ai\/|google\/|models\/|gemini\/|anthropic\.|anthropic\/|openai\/)/i;

const VARIANT_SUFFIX_RE =
  /-(?:thinking|disabled|xhigh|high|medium|low|tiered|sonar|orchestrator|preview|latest|customtools)$/i;

const RESELLER_OR_REGIONAL_PREFIX_RE =
  /^(?:databricks|perplexity|github_copilot|azure_ai|bedrock|bedrock_mantle|together_ai|deepinfra|replicate|fireworks_ai|gmi|ovhcloud|sambanova|cerebras|cloudflare|baseten|groq|crusoe|inferenceapis|nebius|oci|scaleway|novita|tensormesh|zerogpu|aiand|sail|wandb|watsonx|openinfer|opencode_go|kyma|dashscope|global|us|eu|au|jp|apac|us-gov)[/.]/i;

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
  'gemini-4-neon': { inputRate: 3.00, outputRate: 15.00, cacheRate: 0.15 },
  'gemini-4-carbon': { inputRate: 2.00, outputRate: 10.00, cacheRate: 0.10 },
  'gemini-4-argon': { inputRate: 2.00, outputRate: 10.00, cacheRate: 0.10 },
  'gemini-4-hydrogen': { inputRate: 1.50, outputRate: 7.50, cacheRate: 0.075 },
  'gemini-3.8-flash': { inputRate: 0.75, outputRate: 3.75, cacheRate: 0.075 },
  'gemini-2.5-pro': { inputRate: 1.25, outputRate: 10.00, cacheRate: 0.125 },
  'gemini-2.5-flash': { inputRate: 0.30, outputRate: 2.50, cacheRate: 0.03 },
  'gemini-pro': { inputRate: 1.25, outputRate: 10.00, cacheRate: 0.125 },
  'gemini-flash': { inputRate: 0.75, outputRate: 3.75, cacheRate: 0.075 },
  'claude-opus-4-6': { inputRate: 5.00, outputRate: 25.00, cacheRate: 0.50 },
  'claude-sonnet-4-6': { inputRate: 3.00, outputRate: 15.00, cacheRate: 0.30 },
  'claude-haiku-4-5': { inputRate: 1.00, outputRate: 5.00, cacheRate: 0.10 },
  'claude-3-5-sonnet': { inputRate: 3.00, outputRate: 15.00, cacheRate: 0.30 },
  'gpt-oss-120b': { inputRate: 0.09, outputRate: 0.36, cacheRate: 0.009 },
  'gpt-4o': { inputRate: 2.50, outputRate: 10.00, cacheRate: 1.25 },
  'gpt-4o-mini': { inputRate: 0.15, outputRate: 0.60, cacheRate: 0.075 },
  default: ZERO_MODEL_PRICING
};

function isNodeRuntime(): boolean {
  return typeof process !== 'undefined' && Boolean(process.versions?.node);
}

function normalizeDisplaySlug(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/\((?:thinking|disabled|xhigh|high|medium|low|orchestrator)\)/g, ' ')
    .trim()
    .replace(/[^a-z0-9.]+/g, '-')
    .replace(/^-|-$/g, '');
}

function pushCandidate(out: string[], seen: Set<string>, key: string): void {
  const k = key.trim().toLowerCase();
  if (!k || seen.has(k)) return;
  seen.add(k);
  out.push(k);
}

function buildPricingCandidateKeys(raw: string): string[] {
  const s = (raw || '').toLowerCase().trim();
  if (!s || s === 'unknown' || s === 'unknown model') return [];

  const out: string[] = [];
  const seen = new Set<string>();

  const seeds = [s, s.replace(DIRECT_PROVIDER_PREFIX_RE, '')];
  const slug = normalizeDisplaySlug(s);
  if (slug) {
    seeds.push(slug);
    if (slug.includes('.')) {
      seeds.push(slug.replace(/\./g, '-'));
    }
  }

  for (const seed of seeds) {
    pushCandidate(out, seen, seed);
    let cur = seed;
    for (let i = 0; i < 4; i++) {
      const next = cur.replace(VARIANT_SUFFIX_RE, '');
      if (!next || next === cur) break;
      pushCandidate(out, seen, next);
      if (next.includes('.')) {
        pushCandidate(out, seen, next.replace(/\./g, '-'));
      }
      cur = next;
    }
  }

  return out;
}

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
    } else if (isNodeRuntime() && process.env?.HOME) {
      this.storagePath = `${process.env.HOME}/.gemini/antigravity/model_pricing_cache.json`;
    }
    this.initFallback();
    this.loadFromCache();
    if (!options?.skipBackgroundFetch && isNodeRuntime()) {
      // Warm up in background asynchronously without blocking in Node server runtime
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
    this.metadata.modelCount = Object.keys(FALLBACK_MODEL_PRICING).filter((k) => k !== 'default').length;
  }

  private loadFromCache(): void {
    if (!this.storagePath) return;
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const fs = require('node:fs');
      if (fs.existsSync(this.storagePath)) {
        const raw = fs.readFileSync(this.storagePath, 'utf8');
        const parsed = JSON.parse(raw);
        if (parsed?.cacheVersion === PRICING_CACHE_VERSION && parsed?.rates && typeof parsed.rates === 'object') {
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
          if (this.pricingCache.size > 0) {
            this.metadata.source = 'cache';
            this.metadata.lastUpdated = parsed.lastUpdated || Date.now();
            this.metadata.modelCount = this.pricingCache.size;
          }
        }
        if (Array.isArray(parsed?.availableModelIds) && parsed.availableModelIds.length > 0) {
          this.availableModelIds = parsed.availableModelIds.filter((id: unknown): id is string => typeof id === 'string');
        }
        if (parsed?.availableModelNames && typeof parsed.availableModelNames === 'object') {
          for (const [k, v] of Object.entries(parsed.availableModelNames)) {
            if (typeof v === 'string' && v.trim()) {
              this.availableModelNames.set(k, v);
            }
          }
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
      const serializableNames: Record<string, string> = {};
      for (const [k, v] of this.availableModelNames.entries()) {
        serializableNames[k] = v;
      }
      fs.writeFileSync(
        this.storagePath,
        JSON.stringify(
          {
            cacheVersion: PRICING_CACHE_VERSION,
            source: this.metadata.source,
            lastUpdated: this.metadata.lastUpdated,
            rates: serializable,
            availableModelIds: this.availableModelIds,
            availableModelNames: serializableNames,
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
    const nextRates = new Map<string, ModelPricingRates>();
    const barePriority = new Map<string, number>();

    const recordRate = (rawKey: string, rates: ModelPricingRates): void => {
      const fullKey = rawKey.toLowerCase().trim();
      if (!fullKey) return;
      nextRates.set(fullKey, rates);

      // Only canonical bare keys and direct provider prefixes populate bare lookup keys
      // so reseller/regional entries (databricks/, bedrock/, us., etc.) never override primary rates.
      if (!RESELLER_OR_REGIONAL_PREFIX_RE.test(fullKey) && !fullKey.includes(':')) {
        const cleanKey = fullKey.replace(DIRECT_PROVIDER_PREFIX_RE, '');
        const prio = cleanKey === fullKey ? 2 : 1;
        if (cleanKey && (!barePriority.has(cleanKey) || barePriority.get(cleanKey)! < prio)) {
          barePriority.set(cleanKey, prio);
          nextRates.set(cleanKey, rates);
        }
      }
    };

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
            recordRate(rawKey, {
              inputRate: Math.round(inCost * 1000) / 1000,
              outputRate: Math.round(outCost * 1000) / 1000,
              cacheRate: Math.round(cacheCost * 1000) / 1000
            });
            parsedCount++;
          }
        }
        if (parsedCount > 50) {
          this.pricingCache = nextRates;
          return true;
        }
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
            recordRate(m.id, {
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
        if (parsedCount > 20) {
          this.pricingCache = nextRates;
          return true;
        }
      }
    } catch {
      // Both online fetches failed; fallback remains active
    }

    return false;
  }

  private lookupCacheOrFallback(key: string): ModelPricingRates | undefined {
    return this.pricingCache.get(key) || FALLBACK_MODEL_PRICING[key];
  }

  private resolveSingleIdentifier(raw: string): ModelPricingRates | null {
    const candidates = buildPricingCandidateKeys(raw);
    if (candidates.length === 0) return null;

    for (const c of candidates) {
      const online = this.pricingCache.get(c);
      if (online) return online;
    }
    for (const c of candidates) {
      const fb = FALLBACK_MODEL_PRICING[c];
      if (fb && (fb.inputRate > 0 || fb.outputRate > 0)) return fb;
    }

    const s = candidates[0];
    if (s.includes('gemini')) {
      if (s.includes('neon')) return this.lookupCacheOrFallback('gemini-4-neon') || null;
      if (s.includes('carbon')) return this.lookupCacheOrFallback('gemini-4-carbon') || null;
      if (s.includes('argon')) return this.lookupCacheOrFallback('gemini-4-argon') || null;
      if (s.includes('hydrogen')) return this.lookupCacheOrFallback('gemini-4-hydrogen') || null;
      if (s.includes('3.8') || s.includes('3.7') || s.includes('3.6')) {
        return this.lookupCacheOrFallback('gemini-3.8-flash') || null;
      }
      if (s.includes('2.5') && s.includes('flash')) {
        return this.lookupCacheOrFallback('gemini-2.5-flash') || null;
      }
      if (s.includes('flash')) {
        return (
          this.lookupCacheOrFallback('gemini-3-flash-preview') ||
          this.lookupCacheOrFallback('gemini-3.8-flash') ||
          this.lookupCacheOrFallback('gemini-2.5-flash') ||
          null
        );
      }
      if (s.includes('3.1') && s.includes('pro')) {
        return this.lookupCacheOrFallback('gemini-3.1-pro-preview') || this.lookupCacheOrFallback('gemini-2.5-pro') || null;
      }
      if (s.includes('pro') || s.includes('2.5')) {
        return this.lookupCacheOrFallback('gemini-2.5-pro') || this.lookupCacheOrFallback('gemini-pro') || null;
      }
      return this.lookupCacheOrFallback('gemini-3.8-flash') || null;
    }

    if (s.includes('claude')) {
      if (s.includes('opus')) {
        if (s.includes('4-5') || s.includes('4.5')) {
          return this.lookupCacheOrFallback('claude-opus-4-5') || this.lookupCacheOrFallback('claude-opus-4-6') || null;
        }
        if (s.includes('4-7') || s.includes('4.7')) {
          return this.lookupCacheOrFallback('claude-opus-4-7') || this.lookupCacheOrFallback('claude-opus-4-6') || null;
        }
        return this.lookupCacheOrFallback('claude-opus-4-6') || null;
      }
      if (s.includes('sonnet')) {
        if (s.includes('4-5') || s.includes('4.5')) {
          return this.lookupCacheOrFallback('claude-sonnet-4-5') || this.lookupCacheOrFallback('claude-sonnet-4-6') || null;
        }
        if (s.includes('3-5') || s.includes('3.5')) {
          return this.lookupCacheOrFallback('claude-3-5-sonnet') || this.lookupCacheOrFallback('claude-sonnet-4-6') || null;
        }
        return this.lookupCacheOrFallback('claude-sonnet-4-6') || null;
      }
      if (s.includes('haiku')) {
        return this.lookupCacheOrFallback('claude-haiku-4-5') || this.lookupCacheOrFallback('claude-3-5-haiku') || null;
      }
    }

    if (s.includes('gpt-oss') && s.includes('120b')) {
      return this.lookupCacheOrFallback('gpt-oss-120b') || null;
    }
    if (s.includes('gpt-4o-mini')) {
      return this.lookupCacheOrFallback('gpt-4o-mini') || null;
    }
    if (s.includes('gpt-4o')) {
      return this.lookupCacheOrFallback('gpt-4o') || null;
    }

    return null;
  }

  public getModelPricingRates(nameOrId: string, fallbackName?: string): ModelPricingRates {
    const primary = (nameOrId || '').trim();
    if (primary) {
      const direct = this.resolveSingleIdentifier(primary);
      if (direct) return direct;

      const mappedName = this.availableModelNames.get(primary);
      if (mappedName) {
        const mappedRates = this.resolveSingleIdentifier(mappedName);
        if (mappedRates) return mappedRates;
      }
    }

    const secondary = (fallbackName || '').trim();
    if (secondary && secondary !== primary) {
      const secondaryRates = this.resolveSingleIdentifier(secondary);
      if (secondaryRates) return secondaryRates;
    }

    return ZERO_MODEL_PRICING;
  }

  public exportSnapshot(extraModelKeys: string[] = []): ModelPricingSnapshot {
    const rates: Record<string, ModelPricingRates> = {};
    for (const [k, v] of this.pricingCache.entries()) {
      if (!k.includes('/') && !k.includes(':') && !RESELLER_OR_REGIONAL_PREFIX_RE.test(k)) {
        rates[k] = v;
      }
    }
    for (const id of [...this.availableModelIds, ...extraModelKeys]) {
      const k = (id || '').trim().toLowerCase();
      if (!k || k === 'unknown') continue;
      const resolved = this.getModelPricingRates(id);
      if (resolved.inputRate > 0 || resolved.outputRate > 0) {
        rates[k] = resolved;
      }
    }
    const availableModelNames: Record<string, string> = {};
    for (const [k, v] of this.availableModelNames.entries()) {
      availableModelNames[k] = v;
    }
    return {
      source: this.metadata.source,
      lastUpdated: this.metadata.lastUpdated,
      modelCount: this.metadata.modelCount,
      rates,
      availableModelIds: [...this.availableModelIds],
      availableModelNames
    };
  }

  public ingestSnapshot(snapshot: Partial<ModelPricingSnapshot> | null | undefined): boolean {
    if (!snapshot || typeof snapshot !== 'object') return false;
    let applied = false;
    if (snapshot.rates && typeof snapshot.rates === 'object') {
      const next = new Map<string, ModelPricingRates>();
      for (const [k, v] of Object.entries(snapshot.rates)) {
        if (
          v &&
          typeof v === 'object' &&
          typeof v.inputRate === 'number' &&
          typeof v.outputRate === 'number'
        ) {
          next.set(k.toLowerCase(), {
            inputRate: v.inputRate,
            outputRate: v.outputRate,
            cacheRate: typeof v.cacheRate === 'number' ? v.cacheRate : v.inputRate * 0.1
          });
        }
      }
      if (next.size > 0) {
        this.pricingCache = next;
        applied = true;
      }
    }
    if (Array.isArray(snapshot.availableModelIds) && snapshot.availableModelIds.length > 0) {
      this.availableModelIds = snapshot.availableModelIds.filter((id) => typeof id === 'string');
    }
    if (snapshot.availableModelNames && typeof snapshot.availableModelNames === 'object') {
      for (const [k, v] of Object.entries(snapshot.availableModelNames)) {
        if (typeof v === 'string' && v.trim()) {
          this.availableModelNames.set(k, v);
        }
      }
    }
    if (snapshot.source === 'online' || snapshot.source === 'cache' || snapshot.source === 'fallback') {
      this.metadata.source = snapshot.source;
    }
    if (typeof snapshot.lastUpdated === 'number') {
      this.metadata.lastUpdated = snapshot.lastUpdated;
    }
    this.metadata.modelCount =
      typeof snapshot.modelCount === 'number' && snapshot.modelCount > 0
        ? snapshot.modelCount
        : this.pricingCache.size || Object.keys(FALLBACK_MODEL_PRICING).length - 1;
    return applied;
  }

  private getDefaultTooltipModels(): PricingTooltipModelEntry[] {
    const defaults: Array<{ id: string; name: string; color: string }> = [
      { id: 'gemini-4-neon', name: 'Gemini 4 Neon', color: '#8B5CF6' },
      { id: 'gemini-4-hydrogen', name: 'Gemini 4 Hydrogen', color: '#06B6D4' },
      { id: 'gemini-3.8-flash', name: 'Gemini 3.8 Flash', color: '#10B981' },
      { id: 'claude-opus-4-6-thinking', name: 'Claude Opus 4.6', color: '#D97706' },
      { id: 'claude-sonnet-4-6', name: 'Claude Sonnet 4.6', color: '#3B82F6' }
    ];
    return defaults.map((m) => ({
      modelId: m.id,
      modelName: m.name,
      color: m.color,
      rates: this.getModelPricingRates(m.id, m.name)
    }));
  }

  private formatSourceBadge(): string {
    if (this.metadata.source === 'online') return 'Live Online';
    if (this.metadata.source === 'cache') return 'Cached';
    return 'Fallback';
  }

  public getPricingTooltipHtml(models?: PricingTooltipModelEntry[]): string {
    const entries = models && models.length > 0 ? models : this.getDefaultTooltipModels();
    const showCostCol = entries.some((m) => typeof m.cost === 'number');
    const sourceLabel = this.formatSourceBadge();

    const rows = entries
      .map((m) => {
        const dotColor = escapeHtml(m.color || '#3B82F6');
        const safeName = escapeHtml(m.modelName);
        const costCell = showCostCol
          ? `<td class="td-num td-cost">$${(m.cost || 0).toFixed(2)}</td>`
          : '';
        return `
        <tr>
          <td class="td-model"><span class="tooltip-dot" style="background: ${dotColor}"></span>${safeName}</td>
          <td class="td-num">$${m.rates.inputRate.toFixed(2)}</td>
          <td class="td-num">$${m.rates.outputRate.toFixed(2)}</td>
          <td class="td-num">$${m.rates.cacheRate.toFixed(3)}</td>
          ${costCell}
        </tr>`;
      })
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
              ${showCostCol ? '<th class="th-cost">Est.</th>' : ''}
            </tr>
          </thead>
          <tbody>
            ${rows}
          </tbody>
        </table>
        <div class="tooltip-footer-row">
          <span class="tooltip-source-dot"></span>
          <span>Source: ${sourceLabel}</span>
        </div>
      </div>
    `;
  }

  public getPricingTooltipText(models?: PricingTooltipModelEntry[]): string {
    const entries = models && models.length > 0 ? models : this.getDefaultTooltipModels();

    return [
      `Commercial Model Pricing (per 1M tokens · ${this.formatSourceBadge()}):`,
      ...entries.map((m) => {
        const costPart = typeof m.cost === 'number' ? ` · Est. $${m.cost.toFixed(2)}` : '';
        return `• ${m.modelName}: $${m.rates.inputRate.toFixed(2)} in · $${m.rates.outputRate.toFixed(2)} out · $${m.rates.cacheRate.toFixed(3)} cache${costPart}`;
      })
    ].join('\n');
  }

  public getMetadata(): ModelPricingMetadata {
    return { ...this.metadata };
  }
}

export function getModelPricingRates(nameOrId: string, fallbackName?: string): ModelPricingRates {
  return ModelPricingRegistry.getInstance().getModelPricingRates(nameOrId, fallbackName);
}

export function getPricingTooltipText(models?: PricingTooltipModelEntry[]): string {
  return ModelPricingRegistry.getInstance().getPricingTooltipText(models);
}

export function getPricingTooltipHtml(models?: PricingTooltipModelEntry[]): string {
  return ModelPricingRegistry.getInstance().getPricingTooltipHtml(models);
}
