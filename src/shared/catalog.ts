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
  if (!id || id === 'unknown') return 'Unknown Model';
  const cleanId = id.trim().toLowerCase();
  if (cleanId === 'gemini-3.8-flash') return 'Gemini 3.8 Flash';
  if (cleanId === 'gemini-3.8-flash-n') return 'Gemini 3.8 Flash (High)';
  if (cleanId === 'gemini-3.8-flash-exp-a') return 'Gemini 3.8 Flash (Exp)';
  if (cleanId === 'gemini-3.8-flash-tiered') return 'Gemini 3.8 Flash (Tiered)';
  if (cleanId === 'gemini-3.7-flash') return 'Gemini 3.7 Flash';
  if (cleanId === 'gemini-3.7-flash-n') return 'Gemini 3.7 Flash (High)';
  if (cleanId === 'gemini-3.1-pro-low' || cleanId === 'gemini-3.1-pro') return 'Gemini 3.1 Pro';
  if (cleanId.includes('claude-opus-4-6-thinking')) return 'Claude Opus 4.6 Thinking';
  if (cleanId.includes('claude-opus')) return 'Claude Opus';
  if (cleanId.includes('claude-sonnet')) return 'Claude Sonnet';
  if (cleanId === 'gemini-4-argon-m' || cleanId.includes('gemini-4-argon')) return 'Gemini 4 Argon (Medium)';
  if (cleanId.startsWith('gemini-')) {
    return cleanId
      .split('-')
      .map(part => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ');
  }
  return id;
}

export function getDefaultModelId(modelName: string): string {
  switch (modelName) {
    case 'Gemini 3.8 Flash': return 'gemini-3.8-flash';
    case 'Gemini 3.8 Flash (High)': return 'gemini-3.8-flash-n';
    case 'Gemini 3.8 Flash (Exp)': return 'gemini-3.8-flash-exp-a';
    case 'Gemini 3.8 Flash (Tiered)': return 'gemini-3.8-flash-tiered';
    case 'Gemini 3.7 Flash': return 'gemini-3.7-flash';
    case 'Gemini 3.7 Flash (High)': return 'gemini-3.7-flash-n';
    case 'Gemini 4 Argon (Medium)': return 'gemini-4-argon-m';
    case 'Gemini 3.1 Pro': return 'gemini-3.1-pro-low';
    case 'Claude Opus 4.6 Thinking': return 'claude-opus-4-6-thinking';
    default: return modelName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  }
}

export const MODEL_COLORS: Record<string, string> = {
  'Gemini 3.8 Flash': '#00A67E',
  'Gemini 3.8 Flash (High)': '#8B5CF6',
  'Gemini 3.8 Flash (Exp)': '#3B82F6',
  'Gemini 3.7 Flash': '#EC4899',
  'Claude Opus 4.6 Thinking': '#D97706',
  'Gemini 4 Argon (Medium)': '#06B6D4',
  'Gemini 3.1 Pro': '#10B981',
  'Gemini 3.8 Flash (Tiered)': '#6366F1',
  'Gemini 3 Flash B': '#F59E0B',
  'Gemini 3.7 Flash (High)': '#A855F7'
};

const FALLBACK_COLORS = [
  '#00A67E',
  '#8B5CF6',
  '#3B82F6',
  '#D97706',
  '#EC4899',
  '#06B6D4',
  '#10B981',
  '#6366F1',
  '#F43F5E'
];

export function getModelColor(modelName: string, index = 0): string {
  if (MODEL_COLORS[modelName]) return MODEL_COLORS[modelName];
  return FALLBACK_COLORS[index % FALLBACK_COLORS.length];
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
