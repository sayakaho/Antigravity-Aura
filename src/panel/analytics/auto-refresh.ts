export type AnalyticsRefreshMode = 'initial' | 'manual' | 'auto';

export interface AnalyticsRefreshRequest {
  mode: AnalyticsRefreshMode;
  force: boolean;
  preserveScroll: boolean;
}

export interface AnalyticsStatusSnapshot {
  analyticsRevision?: number;
  activeCascadeId?: string;
  renderedSessionId?: string | null;
}

export interface AnalyticsAutoRefreshOptions {
  initialTabActive: boolean;
  initialHidden?: boolean;
  interactionGraceMs?: number;
  onRefresh: (req: AnalyticsRefreshRequest) => void | Promise<void>;
}

export class AnalyticsAutoRefreshController {
  private isTabActive: boolean;
  private isHidden: boolean;
  private isInteracting = false;
  private lastRevision: number | null = null;
  private lastCascadeId = '';
  private hasLoaded = false;
  private dirty = false;
  private pendingSessionSwitch = false;
  private deferredRefresh = false;
  private graceTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly interactionGraceMs: number;
  private readonly onRefresh: (req: AnalyticsRefreshRequest) => void | Promise<void>;

  constructor(options: AnalyticsAutoRefreshOptions) {
    this.isTabActive = options.initialTabActive;
    this.isHidden = options.initialHidden ?? false;
    this.interactionGraceMs = options.interactionGraceMs ?? 250;
    this.onRefresh = options.onRefresh;
  }

  public triggerInitialLoad(): void {
    if (!this.isTabActive || this.isHidden) {
      this.dirty = true;
      return;
    }
    this.clearPendingFlags();
    this.hasLoaded = true;
    void this.onRefresh({ mode: 'initial', force: false, preserveScroll: false });
  }

  public triggerManualRefresh(): void {
    const wasLoaded = this.hasLoaded;
    this.clearGraceTimer();
    this.clearPendingFlags();
    this.hasLoaded = true;
    void this.onRefresh({ mode: 'manual', force: true, preserveScroll: wasLoaded });
  }

  public onStatusSnapshot(snapshot: AnalyticsStatusSnapshot): void {
    let revisionChanged = false;
    if (
      typeof snapshot.analyticsRevision === 'number' &&
      Number.isFinite(snapshot.analyticsRevision)
    ) {
      if (this.lastRevision === null) {
        this.lastRevision = snapshot.analyticsRevision;
      } else if (snapshot.analyticsRevision !== this.lastRevision) {
        this.lastRevision = snapshot.analyticsRevision;
        revisionChanged = true;
      }
    }

    let sessionChanged = false;
    const nextCascadeId =
      typeof snapshot.activeCascadeId === 'string' ? snapshot.activeCascadeId.trim() : '';
    if (nextCascadeId) {
      const renderedId = snapshot.renderedSessionId ?? null;
      sessionChanged =
        (this.lastCascadeId !== '' && nextCascadeId !== this.lastCascadeId) ||
        (renderedId !== null && renderedId !== nextCascadeId);
      this.lastCascadeId = nextCascadeId;
    }

    if (revisionChanged || sessionChanged) {
      this.requestAutoRefresh(sessionChanged);
    }
  }

  public onWorkspaceChange(): void {
    this.requestAutoRefresh(false);
  }

  public onTabChange(active: boolean): void {
    this.isTabActive = active;
    if (!active) {
      this.clearGraceTimer();
      return;
    }
    if (this.isHidden) return;
    if (!this.hasLoaded) {
      this.triggerInitialLoad();
      return;
    }
    if (this.dirty || (this.deferredRefresh && !this.isInteracting)) {
      this.flushPendingAutoRefresh();
    }
  }

  public onVisibilityChange(hidden: boolean): void {
    this.isHidden = hidden;
    if (hidden) {
      this.clearGraceTimer();
      return;
    }
    if (!this.isTabActive) return;
    if (!this.hasLoaded) {
      this.triggerInitialLoad();
      return;
    }
    if (this.dirty || (this.deferredRefresh && !this.isInteracting)) {
      this.flushPendingAutoRefresh();
    }
  }

  public onInteractionChange(interacting: boolean): void {
    if (this.isInteracting === interacting) return;
    this.isInteracting = interacting;
    if (interacting) {
      this.clearGraceTimer();
      return;
    }
    if (!this.isTabActive || this.isHidden) return;
    if (!this.deferredRefresh && !this.dirty) return;

    this.clearGraceTimer();
    this.graceTimer = setTimeout(() => {
      this.graceTimer = null;
      if (!this.isInteracting && this.isTabActive && !this.isHidden && (this.deferredRefresh || this.dirty)) {
        this.flushPendingAutoRefresh();
      }
    }, this.interactionGraceMs);
  }

  public dispose(): void {
    this.clearGraceTimer();
  }

  private requestAutoRefresh(isSessionSwitch: boolean): void {
    if (isSessionSwitch) {
      this.pendingSessionSwitch = true;
    }
    if (!this.isTabActive || this.isHidden) {
      this.dirty = true;
      return;
    }
    if (this.isInteracting) {
      this.deferredRefresh = true;
      return;
    }
    this.flushPendingAutoRefresh();
  }

  private flushPendingAutoRefresh(): void {
    if (!this.isTabActive || this.isHidden) return;
    this.clearGraceTimer();
    const isSessionSwitch = this.pendingSessionSwitch;
    this.clearPendingFlags();
    this.hasLoaded = true;
    void this.onRefresh({
      mode: 'auto',
      force: false,
      preserveScroll: !isSessionSwitch
    });
  }

  private clearPendingFlags(): void {
    this.dirty = false;
    this.deferredRefresh = false;
    this.pendingSessionSwitch = false;
  }

  private clearGraceTimer(): void {
    if (this.graceTimer) {
      clearTimeout(this.graceTimer);
      this.graceTimer = null;
    }
  }
}
