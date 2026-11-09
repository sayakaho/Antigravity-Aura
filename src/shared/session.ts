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

export function buildSessionAnalyticsEndpoint(fallbackId?: string | null): string {
  const cleanFallback = typeof fallbackId === 'string' ? fallbackId.trim() : '';
  return cleanFallback
    ? `/api/analytics/session?fallbackId=${encodeURIComponent(cleanFallback)}`
    : '/api/analytics/session';
}
