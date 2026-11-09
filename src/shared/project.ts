export interface ResolvedProjectInfo {
  projectKey: string;
  name: string;
  fullPath: string;
  displayPath: string;
  badgeText: string;
  isWorkspace: boolean;
}

const NO_WORKSPACE_KEY = '__no_workspace__';
const WINDOWS_DRIVE_URI_RE = /^\/([A-Za-z]:)(?:\/|$)/;
const WINDOWS_ABS_RE = /^[A-Za-z]:[\\/]/;

export function parseWorkspaceUris(raw: string | null | undefined): string[] {
  if (!raw || typeof raw !== 'string') return [];
  const trimmed = raw.trim();
  if (!trimmed) return [];

  try {
    const parsed: unknown = JSON.parse(trimmed);
    if (Array.isArray(parsed)) {
      return parsed.filter((item): item is string => typeof item === 'string' && item.trim().length > 0);
    }
    if (typeof parsed === 'string' && parsed.trim()) {
      return [parsed.trim()];
    }
  } catch {
    if (trimmed.startsWith('file://') || trimmed.startsWith('/') || WINDOWS_ABS_RE.test(trimmed)) {
      return [trimmed];
    }
  }

  return [];
}

function stripTrailingSeparators(fsPath: string): string {
  if (!fsPath) return '';
  if (fsPath === '/' || /^[A-Za-z]:[\\/]?$/.test(fsPath)) {
    return fsPath.length === 2 ? `${fsPath}\\` : fsPath;
  }
  return fsPath.replace(/[\\/]+$/, '');
}

export function uriToLocalPath(rawUri: string): string {
  const trimmed = (rawUri || '').trim();
  if (!trimmed) return '';

  if (!trimmed.startsWith('file://')) {
    return stripTrailingSeparators(trimmed);
  }

  let body = trimmed.slice('file://'.length);
  // Handle file://localhost/... vs UNC file://host/share/...
  if (body.startsWith('localhost/')) {
    body = body.slice('localhost'.length);
  } else if (!body.startsWith('/') && body.includes('/')) {
    const slashIdx = body.indexOf('/');
    const host = body.slice(0, slashIdx);
    const rest = body.slice(slashIdx);
    try {
      body = `\\\\${host}${decodeURIComponent(rest).replace(/\//g, '\\')}`;
      return stripTrailingSeparators(body);
    } catch {
      return stripTrailingSeparators(`\\\\${host}${rest.replace(/\//g, '\\')}`);
    }
  }

  let decoded = body;
  try {
    decoded = decodeURIComponent(body);
  } catch {
    decoded = body;
  }

  if (WINDOWS_DRIVE_URI_RE.test(decoded)) {
    decoded = decoded.slice(1).replace(/\//g, '\\');
  }

  return stripTrailingSeparators(decoded);
}

export function extractDirBasename(fsPath: string): string {
  const parts = fsPath.split(/[\\/]/).filter(Boolean);
  return parts.pop() || fsPath;
}

export function formatDisplayPath(fullPath: string, homeDir = ''): string {
  if (!fullPath) return '';
  const cleanHome = stripTrailingSeparators(homeDir.trim());
  if (!cleanHome) return fullPath;

  if (fullPath === cleanHome) {
    return '~';
  }
  if (fullPath.startsWith(`${cleanHome}/`) || fullPath.startsWith(`${cleanHome}\\`)) {
    return `~${fullPath.slice(cleanHome.length)}`;
  }
  return fullPath;
}

export function resolveSummaryProjectInfo(
  summary: { projectId?: string | null; workspaceUris?: string | null },
  homeDir = ''
): ResolvedProjectInfo {
  const uris = parseWorkspaceUris(summary.workspaceUris);
  for (const uri of uris) {
    const localPath = uriToLocalPath(uri);
    if (!localPath) continue;
    const name = extractDirBasename(localPath);
    const displayPath = formatDisplayPath(localPath, homeDir);
    return {
      projectKey: localPath,
      name,
      fullPath: localPath,
      displayPath,
      badgeText: displayPath,
      isWorkspace: true
    };
  }

  const rawProjectId = (summary.projectId || '').trim();
  if (!rawProjectId || rawProjectId === 'outside-of-project' || rawProjectId === 'Default Project') {
    return {
      projectKey: NO_WORKSPACE_KEY,
      name: 'Conversations',
      fullPath: '',
      displayPath: '',
      badgeText: 'outside-of-project',
      isWorkspace: false
    };
  }

  return {
    projectKey: `project:${rawProjectId}`,
    name: rawProjectId,
    fullPath: '',
    displayPath: '',
    badgeText: 'no local path',
    isWorkspace: false
  };
}
