import { agGlobal } from './types';

export interface ActivityCounts {
  commands: number;
  searches: number;
  pages: number;
  filesRead: number;
  filesEdited: number;
  subagents: number;
  otherTools: number;
  failed: number;
}

export function formatActivitySummary(counts: ActivityCounts, language: 'default' | 'zh-CN' = 'default'): string {
  const isZh = language === 'zh-CN';
  const parts: string[] = [];

  if (counts.commands > 0) {
    parts.push(isZh ? `${counts.commands} 个命令` : `${counts.commands} command${counts.commands > 1 ? 's' : ''}`);
  }
  if (counts.searches > 0) {
    parts.push(isZh ? `${counts.searches} 次搜索` : `${counts.searches} search${counts.searches > 1 ? 'es' : ''}`);
  }
  if (counts.pages > 0) {
    parts.push(isZh ? `${counts.pages} 个网页` : `${counts.pages} page${counts.pages > 1 ? 's' : ''}`);
  }
  if (counts.filesRead > 0) {
    parts.push(isZh ? `读 ${counts.filesRead} 个文件` : `read ${counts.filesRead} file${counts.filesRead > 1 ? 's' : ''}`);
  }
  if (counts.filesEdited > 0) {
    parts.push(isZh ? `改 ${counts.filesEdited} 个文件` : `edited ${counts.filesEdited} file${counts.filesEdited > 1 ? 's' : ''}`);
  }
  if (counts.subagents > 0) {
    parts.push(isZh ? `${counts.subagents} 个子任务` : `${counts.subagents} subagent${counts.subagents > 1 ? 's' : ''}`);
  }
  if (counts.otherTools > 0) {
    parts.push(isZh ? `${counts.otherTools} 个操作` : `${counts.otherTools} tool${counts.otherTools > 1 ? 's' : ''}`);
  }
  if (counts.failed > 0) {
    parts.push(isZh ? `${counts.failed} 次失败` : `${counts.failed} failed`);
  }

  return parts.join(isZh ? '，' : ', ');
}

export function extractActivityCountsFromSegment(segment: unknown): ActivityCounts {
  const counts: ActivityCounts = {
    commands: 0,
    searches: 0,
    pages: 0,
    filesRead: 0,
    filesEdited: 0,
    subagents: 0,
    otherTools: 0,
    failed: 0
  };

  if (!segment || typeof segment !== 'object') return counts;
  const seg = segment as { steps?: Array<Record<string, unknown>> };
  if (!Array.isArray(seg.steps)) return counts;

  for (const s of seg.steps) {
    const isFailed = s.status === 4 || s.status === 'FAILED' || !!s.error || s.isError === true;
    if (isFailed) counts.failed++;

    const metadata = s.metadata as Record<string, unknown> | undefined;
    const metaToolCall = metadata?.toolCall as { name?: string } | undefined;
    const clientTool = s.clientSideToolCall as { name?: string } | undefined;
    const stepObj = s.step as { value?: Record<string, unknown> } | undefined;
    const valObj = stepObj?.value;

    const toolName =
      metaToolCall?.name ||
      clientTool?.name ||
      (typeof valObj?.toolName === 'string' ? valObj.toolName : undefined) ||
      (typeof valObj?.name === 'string' ? valObj.name : undefined) ||
      ((valObj?.toolCall as { name?: string } | undefined)?.name);

    if (!toolName) continue;
    const name = String(toolName).toLowerCase();

    if (name === 'run_command' || name.includes('bash') || name.includes('terminal') || name.includes('command')) {
      counts.commands++;
    } else if (name === 'search_web' || name.includes('search') || name.includes('google_search')) {
      counts.searches++;
    } else if (name === 'fetch_web_page' || name.includes('browse') || name.includes('fetch_url') || name.includes('view_page')) {
      counts.pages++;
    } else if (name === 'read_file' || name.includes('read_resource') || name.includes('cat_file')) {
      counts.filesRead++;
    } else if (name === 'edit_file' || name === 'write_file' || name.includes('edit') || name.includes('write')) {
      counts.filesEdited++;
    } else if (name === 'invoke_subagent' || name.includes('subagent') || name.includes('delegate')) {
      counts.subagents++;
    } else {
      counts.otherTools++;
    }
  }

  return counts;
}

export function findSegmentFromButton(btn: HTMLElement): unknown | null {
  try {
    const fiberKey = Object.keys(btn).find((k) => k.startsWith('__reactFiber$'));
    if (!fiberKey) return null;
    let curr: Record<string, unknown> | undefined = (btn as unknown as Record<string, Record<string, unknown>>)[fiberKey];
    for (let i = 0; i < 20 && curr; i++) {
      const p = curr.memoizedProps as { segment?: unknown } | undefined;
      if (p?.segment) {
        return p.segment;
      }
      curr = curr.return as Record<string, unknown> | undefined;
    }
  } catch {}
  return null;
}

export function updateButtonSummary(btn: HTMLElement, language: 'default' | 'zh-CN'): void {
  const segment = findSegmentFromButton(btn);
  if (!segment) return;

  const counts = extractActivityCountsFromSegment(segment);
  const text = formatActivitySummary(counts, language);
  if (!text) {
    btn.querySelector('.ag-activity-summary-badge')?.remove();
    return;
  }

  const sig = `${counts.commands}-${counts.searches}-${counts.pages}-${counts.filesRead}-${counts.filesEdited}-${counts.subagents}-${counts.failed}-${language}`;
  let badge = btn.querySelector('.ag-activity-summary-badge') as HTMLElement | null;

  if (badge && badge.dataset.agSig === sig) return;

  if (!badge) {
    badge = document.createElement('span');
    badge.className = 'ag-activity-summary-badge';
    badge.style.cssText =
      'display:inline-flex;align-items:center;margin-left:8px;padding:1px 6px;border-radius:4px;font-size:12px;opacity:0.8;background:rgba(128,128,128,0.14);font-weight:400;white-space:nowrap;letter-spacing:0.01em;';
    const textSpan = btn.querySelector('span');
    if (textSpan) {
      textSpan.after(badge);
    } else {
      btn.appendChild(badge);
    }
  }

  badge.dataset.agSig = sig;
  badge.textContent = `· ${text}`;
  if (counts.failed > 0) {
    badge.style.color = 'var(--color-danger, #e06c75)';
  } else {
    badge.style.color = '';
  }
}

export function initActivitySummary(enabled: boolean, language: 'default' | 'zh-CN' = 'default'): void {
  uninstallActivitySummary();
  if (!enabled || typeof document === 'undefined') return;

  const updateAll = () => {
    const btns = document.querySelectorAll('[data-testid="worked-for-collapsible"]');
    btns.forEach((b) => updateButtonSummary(b as HTMLElement, language));
  };

  updateAll();

  if (typeof MutationObserver !== 'undefined' && document.body) {
    const observer = new MutationObserver(() => {
      updateAll();
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });

    agGlobal.__ag_activity_summary_observer = observer;
  }
}

export function uninstallActivitySummary(): void {
  if (agGlobal.__ag_activity_summary_observer) {
    try {
      agGlobal.__ag_activity_summary_observer.disconnect();
    } catch {}
    agGlobal.__ag_activity_summary_observer = null;
  }
  if (typeof document !== 'undefined') {
    document.querySelectorAll('.ag-activity-summary-badge').forEach((el) => el.remove());
  }
}
