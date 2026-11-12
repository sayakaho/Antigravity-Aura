import type { AuraConfig, BootPayload, LiveMetricsPayload, SelectorsConfig } from '../types';

export interface OrigTextRecord {
  origRaw: string;
  lastVal: string;
  ver: string;
}

export interface ElectronNativeBridge {
  zoomIn?: () => void;
  zoomOut?: () => void;
  zoomReset?: () => void;
}

export interface AuraPatchContext {
  version: string;
  preset: string;
  config: BootPayload['config'];
  modules: BootPayload['modules'];
  features: BootPayload['modules'];
  themeVars: Record<string, string>;
  dict: Record<string, string>;
  readonly metrics: LiveMetricsPayload | null;
  syncPreset: () => void;
  ensureMetricsPill: (forceLayout?: boolean) => HTMLElement | null;
}

export interface AuraGlobals {
  __AG_BOOT_PAYLOAD__?: BootPayload;
  __AG_PATCH_CTX__?: AuraPatchContext;
  __ag_patch_version?: string;
  __ag_experiments_sig?: string;
  __ag_applied_theme_vars?: string[];
  __ag_last_boot_preset?: string;
  __ag_orig_text_map?: WeakMap<Text, OrigTextRecord>;
  __ag_i18n_observer?: MutationObserver | null;
  __ag_i18n_dict?: Record<string, string>;
  __ag_settings_click_fn?: ((e: Event) => void) | null;
  __ag_settings_guard_installed?: boolean;
  __ag_zoom_keydown_fn?: ((e: KeyboardEvent) => void) | null;
  __ag_zoom_guard_installed?: boolean;
  __ag_sync_preset_fn?: (() => void) | null;
  __ag_sync_color_scheme_fn?: (() => void) | null;
  __ag_theme_media_listener_installed?: boolean;
  __ag_theme_observer_installed?: boolean;
  __ag_sidecar_mount_observer_installed?: boolean;
  __ag_preset_hook_installed?: boolean;
  __ag_ensure_metrics_pill_fn?: ((forceLayout?: boolean) => HTMLElement | null) | null;
  __ag_check_route_fn?: (() => void) | null;
  __ag_metrics_route_watcher?: ReturnType<typeof setInterval> | null;
  __ag_history_hook_installed?: boolean;
  __ag_watched_cascade_id?: string;
  __ag_last_metrics?: LiveMetricsPayload | null;
  __ag_render_metrics?: ((payload: LiveMetricsPayload | null) => void) | null;
  __ag_metrics_config?: {
    enabled: boolean;
    selectors: SelectorsConfig;
    language?: AuraConfig['language'];
  };
  __ag_metrics_ro?: ResizeObserver | null;
  __ag_pill_resize_observer?: ResizeObserver | null;
  __agRequestMetrics?: (cascadeId: string) => void;
  __ag_on_session_change?: (cascadeId: string) => void;
  electronNative?: ElectronNativeBridge;
}

export const agGlobal = window as unknown as Window & AuraGlobals;
