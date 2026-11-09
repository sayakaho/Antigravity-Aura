export interface CanonicalToolInfo {
  name: string;
  category: string;
  color: string;
}

export function canonicalizeTool(raw: string): CanonicalToolInfo {
  switch (raw) {
    case 'run_command':
      return { name: 'Command & Terminal', category: 'Execution', color: '#F59E0B' };
    case 'view_file':
    case 'read_file':
    case 'list_dir':
    case 'read_url_content':
      return { name: 'File & Code Reading', category: 'Inspection', color: '#00A67E' };
    case 'replace_file_content':
    case 'edit_file':
    case 'write_to_file':
    case 'write_file':
      return { name: 'Code Editing & File Write', category: 'Modification', color: '#3B82F6' };
    case 'grep_search':
    case 'find_by_name':
      return { name: 'Codebase Search', category: 'Discovery', color: '#8B5CF6' };
    case 'search_web':
      return { name: 'Web Search & Docs', category: 'Search', color: '#06B6D4' };
    case 'invoke_subagent':
    case 'manage_subagents':
    case 'send_message':
    case 'define_subagent':
      return { name: 'Multi-Agent Coordination', category: 'Agentic', color: '#EC4899' };
    case 'schedule':
    case 'manage_task':
      return { name: 'Task Scheduling', category: 'Workflow', color: '#10B981' };
    case 'ask_question':
      return { name: 'User Interaction', category: 'Communication', color: '#6366F1' };
    default:
      return { name: raw, category: 'Extension', color: '#948F85' };
  }
}

export function canonicalModelName(id: string, name?: string): string {
  if (name && name.trim() && name.trim().toLowerCase() !== 'unknown') return name.trim();
  const trimmed = (id || '').trim();
  if (!trimmed || trimmed.toLowerCase() === 'unknown') return 'Unknown Model';
  return trimmed
    .split(/[-_]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

export function resolveCanonicalModelId(rawId: string, modelName?: string): string {
  const trimmed = (rawId || '').trim();
  if (trimmed && trimmed.toLowerCase() !== 'unknown') {
    return trimmed;
  }
  const resolvedName = (modelName || '').trim();
  if (resolvedName && resolvedName.toLowerCase() !== 'unknown' && resolvedName !== 'Unknown Model') {
    const slug = resolvedName
      .toLowerCase()
      .replace(/[^a-z0-9.]+/g, '-')
      .replace(/^-|-$/g, '');
    if (slug) return slug;
  }
  return 'unknown';
}

const MODEL_PALETTE = [
  '#00A67E',
  '#8B5CF6',
  '#3B82F6',
  '#D97706',
  '#EC4899',
  '#06B6D4',
  '#10B981',
  '#6366F1',
  '#F43F5E',
  '#F59E0B',
  '#A855F7'
];

function hashModelKey(input: string): number {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function getModelColor(modelKey: string, index = 0, usedColors?: Set<string>): string {
  const trimmed = (modelKey || '').trim();
  const start = (trimmed ? hashModelKey(trimmed) : Math.max(0, index)) % MODEL_PALETTE.length;
  if (usedColors) {
    for (let i = 0; i < MODEL_PALETTE.length; i++) {
      const candidate = MODEL_PALETTE[(start + i) % MODEL_PALETTE.length];
      if (!usedColors.has(candidate)) {
        usedColors.add(candidate);
        return candidate;
      }
    }
  }
  const color = MODEL_PALETTE[start];
  usedColors?.add(color);
  return color;
}

export interface ModelPricingRates {
  inputRate: number;
  outputRate: number;
  cacheRate: number;
}

export function getModelPricingRates(nameOrId: string): ModelPricingRates {
  const s = (nameOrId || '').toLowerCase();
  if (s.includes('argon') || s.includes('gemini-4') || s.includes('pro') || s.includes('sonnet') || s.includes('opus')) {
    return { inputRate: 2.00, outputRate: 10.00, cacheRate: 0.10 };
  }
  if (s.includes('flash') || s.includes('3.8') || s.includes('3.7') || s.includes('gemini-2') || s.includes('haiku') || s.includes('mini')) {
    return { inputRate: 0.75, outputRate: 3.75, cacheRate: 0.075 };
  }
  return { inputRate: 1.00, outputRate: 4.00, cacheRate: 0.10 };
}
