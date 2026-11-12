import type { ConversationSummary } from '../types';

export function resolveAnalyticsSessionId(
  data: Record<string, unknown> | undefined,
  activeCascadeId: string
): string {
  const explicitId =
    typeof data?.id === 'string' && data.id.trim()
      ? data.id.trim()
      : typeof data?.conversationId === 'string' && data.conversationId.trim()
        ? data.conversationId.trim()
        : '';
  if (explicitId) return explicitId;

  const liveId = activeCascadeId.trim();
  if (liveId) return liveId;

  return typeof data?.fallbackId === 'string' && data.fallbackId.trim()
    ? data.fallbackId.trim()
    : '';
}

export function buildSessionAnalyticsEndpoint(
  fallbackId?: string | null,
  force = false
): string {
  const cleanFallback = typeof fallbackId === 'string' ? fallbackId.trim() : '';
  const params = new URLSearchParams();
  if (cleanFallback) params.set('fallbackId', cleanFallback);
  if (force) params.set('force', '1');
  const query = params.toString();
  return query ? `/api/analytics/session?${query}` : '/api/analytics/session';
}

export function isSubagentSummary(
  summary: Pick<ConversationSummary, 'parentConversationId' | 'nestingDepth'>
): boolean {
  const parentId = (summary.parentConversationId || '').trim();
  return Boolean(parentId) || (summary.nestingDepth ?? 0) > 0;
}

export function resolveSubagentAgentName(agentName: string | null | undefined): string {
  const trimmed = (agentName || '').trim();
  return trimmed || 'subagent';
}

export interface SessionTreeIndex {
  summaryById: Map<string, ConversationSummary>;
  resolveRootConversationId: (convId: string) => string | null;
  collectDescendantIds: (rootId: string) => string[];
}

export function buildSessionTreeIndex(summaries: ConversationSummary[]): SessionTreeIndex {
  const summaryById = new Map<string, ConversationSummary>();
  const childrenByParent = new Map<string, string[]>();

  for (const s of summaries) {
    if (!s.conversationId) continue;
    summaryById.set(s.conversationId, s);
    const parentId = (s.parentConversationId || '').trim();
    if (parentId && parentId !== s.conversationId) {
      let list = childrenByParent.get(parentId);
      if (!list) {
        list = [];
        childrenByParent.set(parentId, list);
      }
      list.push(s.conversationId);
    }
  }

  const resolveRootConversationId = (convId: string): string | null => {
    const visited = new Set<string>();
    let currId = convId;

    while (currId) {
      if (visited.has(currId)) return null;
      visited.add(currId);

      const node = summaryById.get(currId);
      if (!node) return null;
      if (!isSubagentSummary(node)) return node.conversationId;

      const nextParent = (node.parentConversationId || '').trim();
      if (!nextParent) return null;
      currId = nextParent;
    }

    return null;
  };

  const collectDescendantIds = (rootId: string): string[] => {
    const descendants: string[] = [];
    const visited = new Set<string>([rootId]);
    const queue: string[] = [...(childrenByParent.get(rootId) || [])];

    while (queue.length > 0) {
      const id = queue.shift()!;
      if (visited.has(id)) continue;
      visited.add(id);
      descendants.push(id);
      const children = childrenByParent.get(id);
      if (children) {
        for (const childId of children) {
          if (!visited.has(childId)) queue.push(childId);
        }
      }
    }

    return descendants;
  };

  return {
    summaryById,
    resolveRootConversationId,
    collectDescendantIds
  };
}
