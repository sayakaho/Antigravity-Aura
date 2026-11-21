/**
 * Aura · Host Sidebar Google Account Switcher
 * Replaces the default settings text button with an authentic Google Account badge
 * (Avatar with Pro blue ring, Display Name, Email, and right-aligned Settings Icon)
 * paired with a Material Design 3 Google One style account switching popover.
 */

export interface AccountItemDTO {
  email: string;
  displayName?: string;
  avatarUrl?: string;
  isPro?: boolean;
  planName?: string;
  savedAt: number;
  lastUsedAt: number;
  isCurrent: boolean;
}

export interface AccountsVaultPayload {
  currentEmail: string | null;
  accounts: AccountItemDTO[];
}

export interface ExtractedUserProfile {
  name: string;
  email: string;
  avatarUrl: string;
  isPro: boolean;
  planName: string;
}

const AVATAR_PALETTES = [
  'linear-gradient(135deg, #4F46E5, #7C3AED)',
  'linear-gradient(135deg, #059669, #10B981)',
  'linear-gradient(135deg, #D97706, #F59E0B)',
  'linear-gradient(135deg, #DC2626, #EF4444)',
  'linear-gradient(135deg, #2563EB, #3B82F6)',
  'linear-gradient(135deg, #7C2D12, #C2410C)',
  'linear-gradient(135deg, #4C1D95, #8B5CF6)'
];

function getAvatarBackground(email: string): string {
  let hash = 0;
  for (let i = 0; i < email.length; i++) {
    hash = (hash << 5) - hash + email.charCodeAt(i);
    hash |= 0;
  }
  const idx = Math.abs(hash) % AVATAR_PALETTES.length;
  return AVATAR_PALETTES[idx];
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function deriveDisplayName(email: string): string {
  const prefix = email.split('@')[0] || email;
  return prefix
    .replace(/[._-]+/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function getLatestVault(): AccountsVaultPayload {
  const win = window as any;
  if (!win.__ag_latest_vault) {
    win.__ag_latest_vault = {
      currentEmail: null,
      accounts: []
    };
  }
  return win.__ag_latest_vault;
}

function setLatestVault(data: AccountsVaultPayload): void {
  const win = window as any;
  win.__ag_latest_vault = data;
}

let cachedLiveProfile: ExtractedUserProfile | null = null;
let isPopoverOpen = false;
let isSwitching = false;

function sendAccountAction(
  action: 'switch' | 'delete' | 'list' | 'sync_profile',
  payload?: any
): void {
  const win = window as any;
  if (typeof win.__ag_account_action === 'function') {
    if (typeof payload === 'string') {
      win.__ag_account_action(JSON.stringify({ action, email: payload }));
    } else if (payload && typeof payload === 'object') {
      win.__ag_account_action(JSON.stringify({ action, ...payload }));
    } else {
      win.__ag_account_action(JSON.stringify({ action }));
    }
  }
}

/**
 * Traverses React Fiber trees to extract authentic UserStatus from host runtime
 */
export function extractUserStatus(): ExtractedUserProfile | null {
  try {
    const candidate =
      document.querySelector('[data-testid="conversation-navigator"]') ||
      document.querySelector('[data-testid="settings-button"]') ||
      document.body;
    if (!candidate) return null;

    const key = Object.keys(candidate).find((k) => k.startsWith('__reactFiber'));
    if (!key) return null;

    let fiber = (candidate as any)[key];
    let depth = 0;
    while (fiber && depth < 25) {
      let s = fiber.memoizedState;
      while (s) {
        if (s.memoizedState && typeof s.memoizedState === 'object') {
          const ms = s.memoizedState;
          if (ms.email && typeof ms.email === 'string' && ms.email.includes('@')) {
            const isPro = Boolean(
              (ms.userTier?.id && !String(ms.userTier.id).toLowerCase().includes('free')) ||
              (ms.planStatus?.planInfo?.planName && String(ms.planStatus.planInfo.planName).toLowerCase() !== 'free')
            );
            return {
              name: ms.name ? String(ms.name).trim() : '',
              email: String(ms.email).trim(),
              avatarUrl: ms.profilePictureUrl ? String(ms.profilePictureUrl) : '',
              isPro,
              planName: ms.planStatus?.planInfo?.planName ? String(ms.planStatus.planInfo.planName) : (isPro ? 'Pro' : 'Free')
            };
          }
        }
        s = s.next;
      }
      fiber = fiber.return;
      depth++;
    }
  } catch {}
  return null;
}

export function probeAndSyncProfile(): void {
  const profile = extractUserStatus();
  if (!profile || !profile.email) return;

  const vault = getLatestVault();
  if (vault.currentEmail && profile.email.toLowerCase() !== vault.currentEmail.toLowerCase()) {
    // Host React Fiber is still holding a stale/mismatched official login while Keychain is on another account.
    if (cachedLiveProfile !== null) {
      cachedLiveProfile = null;
      renderSidebarAccountBar();
      if (isPopoverOpen) renderPopoverContent();
    }
    return;
  }

  const prev = cachedLiveProfile;
  if (
    !prev ||
    prev.email !== profile.email ||
    prev.name !== profile.name ||
    prev.avatarUrl !== profile.avatarUrl ||
    prev.isPro !== profile.isPro ||
    prev.planName !== profile.planName
  ) {
    cachedLiveProfile = profile;
    sendAccountAction('sync_profile', {
      profile: {
        email: profile.email,
        displayName: profile.name,
        avatarUrl: profile.avatarUrl,
        isPro: profile.isPro,
        planName: profile.planName
      }
    });
    renderSidebarAccountBar();
  }
}

function renderAvatarHtml(
  avatarUrl: string | undefined,
  email: string,
  isPro: boolean,
  sizeVariant: 'sidebar' | 'active' | 'item'
): string {
  const initial = email ? email.charAt(0).toUpperCase() : '?';
  const bg = getAvatarBackground(email);
  const ringClass = isPro ? 'ag-has-blue-ring' : 'ag-no-blue-ring';
  const wrapClass = `ag-avatar-wrap ag-avatar-${sizeVariant} ${ringClass}`;

  if (avatarUrl) {
    const safeUrl = escapeHtml(avatarUrl);
    return `
      <div class="${wrapClass}">
        <img class="ag-avatar-img" src="${safeUrl}" alt="" onerror="this.style.display='none';if(this.nextElementSibling)this.nextElementSibling.style.display='flex';" />
        <div class="ag-avatar-fallback" style="display:none;background:${bg};">${escapeHtml(initial)}</div>
      </div>
    `;
  }

  return `
    <div class="${wrapClass}">
      <div class="ag-avatar-fallback" style="background:${bg};">${escapeHtml(initial)}</div>
    </div>
  `;
}

export function resolveActiveDisplayAccount(): {
  email: string;
  displayName: string;
  avatarUrl: string;
  isPro: boolean;
  planName: string;
} {
  const vault = getLatestVault();
  const currentEmail = vault.currentEmail || '';
  const candidateLive = cachedLiveProfile || extractUserStatus();
  const live =
    candidateLive &&
    candidateLive.email &&
    (!currentEmail || candidateLive.email.toLowerCase() === currentEmail.toLowerCase())
      ? candidateLive
      : null;

  if (live && live.email) {
    const acc = vault.accounts.find(
      (a) => a.email.toLowerCase() === live.email.toLowerCase()
    );
    const displayName = live.name || acc?.displayName || deriveDisplayName(live.email);
    const avatarUrl = live.avatarUrl || acc?.avatarUrl || '';
    const isPro = live.isPro !== undefined ? live.isPro : Boolean(acc?.isPro);
    const planName = live.planName || acc?.planName || (isPro ? 'Pro' : 'Free');
    return {
      email: live.email,
      displayName,
      avatarUrl,
      isPro,
      planName
    };
  }

  const currentAcc =
    vault.accounts.find((a) => a.isCurrent) ||
    vault.accounts.find((a) => a.email.toLowerCase() === currentEmail.toLowerCase());

  const displayName = currentAcc?.displayName || (currentEmail ? deriveDisplayName(currentEmail) : 'Account');
  const avatarUrl = currentAcc?.avatarUrl || '';
  const isPro = Boolean(currentAcc?.isPro);
  const planName = currentAcc?.planName || (isPro ? 'Pro' : 'Free');

  return {
    email: currentEmail,
    displayName,
    avatarUrl,
    isPro,
    planName
  };
}

function renderSidebarAccountBar(): void {
  const btn = document.getElementById('ag-sidebar-account-btn') as HTMLButtonElement | null;
  if (!btn) return;

  const active = resolveActiveDisplayAccount();

  btn.setAttribute('aria-label', `Google Account: ${active.displayName} (${active.email || 'Not logged in'})`);
  btn.title = `Google Account: ${active.displayName} (${active.email || 'Not logged in'})`;

  const avatarContainer = btn.querySelector('.ag-sidebar-avatar-slot');
  if (avatarContainer) {
    avatarContainer.innerHTML = renderAvatarHtml(active.avatarUrl, active.email, active.isPro, 'sidebar');
  }

  const nameEl = btn.querySelector('.ag-sidebar-account-name');
  if (nameEl) {
    nameEl.textContent = active.displayName;
  }

  const emailEl = btn.querySelector('.ag-sidebar-account-email');
  if (emailEl) {
    emailEl.textContent = active.email || 'Not logged in';
  }
}

function renderPopoverContent(): void {
  const popover = document.getElementById('ag-gaccount-popover');
  if (!popover) return;

  const active = resolveActiveDisplayAccount();

  // 1. Render active account card
  const activeAvatarSlot = document.getElementById('ag-gaccount-active-avatar-slot');
  const activeNameEl = document.getElementById('ag-gaccount-active-name');
  const activeEmailEl = document.getElementById('ag-gaccount-active-email');
  const activeBadgeEl = document.getElementById('ag-gaccount-active-plan-badge');

  if (activeAvatarSlot) {
    activeAvatarSlot.innerHTML = renderAvatarHtml(active.avatarUrl, active.email, active.isPro, 'active');
  }
  if (activeNameEl) activeNameEl.textContent = active.displayName;
  if (activeEmailEl) activeEmailEl.textContent = active.email || 'No active account detected';
  if (activeBadgeEl) {
    if (active.isPro) {
      activeBadgeEl.textContent = active.planName;
      activeBadgeEl.style.display = 'inline-block';
    } else {
      activeBadgeEl.style.display = 'none';
    }
  }

  // 2. Render other saved accounts list
  const listEl = document.getElementById('ag-gaccount-list');
  const groupEl = document.getElementById('ag-gaccount-group');
  if (!listEl) return;

  const vault = getLatestVault();
  const otherAccounts = vault.accounts.filter(
    (a) => !active.email || a.email.toLowerCase() !== active.email.toLowerCase()
  );

  if (groupEl) {
    if (otherAccounts.length > 0) {
      groupEl.classList.add('has-other-accounts');
    } else {
      groupEl.classList.remove('has-other-accounts');
    }
  }

  if (otherAccounts.length === 0) {
    if (vault.accounts.length === 0) {
      listEl.innerHTML = `
        <div class="ag-gaccount-empty">
          <span>Loading accounts...</span><br/>
          <span class="ag-gaccount-empty-sub">Connecting to local credential vault...</span>
        </div>
      `;
    } else {
      listEl.innerHTML = `
        <div class="ag-gaccount-empty">
          <span>No other accounts saved.</span><br/>
          <span class="ag-gaccount-empty-sub">Accounts logged in via CLI or App will appear here automatically.</span>
        </div>
      `;
    }
    return;
  }

  listEl.innerHTML = otherAccounts
    .map((acc) => {
      const name = acc.displayName || deriveDisplayName(acc.email);
      const safeEmail = escapeHtml(acc.email);
      const safeName = escapeHtml(name);
      const isAccountPro = Boolean(acc.isPro);
      const avatarHtml = renderAvatarHtml(acc.avatarUrl, acc.email, isAccountPro, 'item');

      return `
        <div class="ag-gaccount-item" data-email="${safeEmail}">
          <div class="ag-gaccount-item-left">
            ${avatarHtml}
            <div class="ag-gaccount-item-info">
              <div class="ag-gaccount-item-name" title="${safeName}">${safeName}</div>
              <div class="ag-gaccount-item-email" title="${safeEmail}">${safeEmail}</div>
            </div>
          </div>
          <div class="ag-gaccount-item-right">
            <button class="ag-gaccount-item-del-btn" data-del-email="${safeEmail}" title="Remove account">×</button>
          </div>
        </div>
      `;
    })
    .join('');

  // Bind click for switching
  listEl.querySelectorAll('.ag-gaccount-item').forEach((item) => {
    item.addEventListener('click', (e) => {
      const target = e.target as HTMLElement | null;
      if (target?.closest('.ag-gaccount-item-del-btn')) return;
      const email = item.getAttribute('data-email');
      if (email && !isSwitching) {
        triggerSwitchAccount(email);
      }
    });
  });

  // Bind click for deleting
  listEl.querySelectorAll('.ag-gaccount-item-del-btn').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const email = btn.getAttribute('data-del-email');
      if (email) {
        sendAccountAction('delete', email);
      }
    });
  });
}

function triggerSwitchAccount(email: string): void {
  isSwitching = true;
  cachedLiveProfile = null;
  const popover = document.getElementById('ag-gaccount-popover');
  if (popover) {
    let overlay = popover.querySelector('.ag-gaccount-loading-overlay') as HTMLElement | null;
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.className = 'ag-gaccount-loading-overlay';
      popover.appendChild(overlay);
    }
    overlay.innerHTML = `
      <div class="ag-gaccount-spinner"></div>
      <div class="ag-gaccount-loading-text">Switching to ${escapeHtml(email)}...</div>
      <div class="ag-gaccount-loading-sub">Restarting Language Server & reloading window...</div>
    `;
    overlay.style.display = 'flex';
  }

  sendAccountAction('switch', email);
}

function openPopover(): void {
  const popover = document.getElementById('ag-gaccount-popover');
  const triggerBtn = document.getElementById('ag-sidebar-account-btn');
  if (!popover || !triggerBtn) return;

  isPopoverOpen = true;
  triggerBtn.setAttribute('aria-expanded', 'true');
  sendAccountAction('list');
  renderPopoverContent();
  popover.style.display = 'flex';
}

function closePopover(): void {
  const popover = document.getElementById('ag-gaccount-popover');
  const triggerBtn = document.getElementById('ag-sidebar-account-btn');
  if (!popover || !triggerBtn) return;

  isPopoverOpen = false;
  triggerBtn.setAttribute('aria-expanded', 'false');
  popover.style.display = 'none';
}

function togglePopover(): void {
  if (isPopoverOpen) {
    closePopover();
  } else {
    openPopover();
  }
}

function ensurePopoverDom(): void {
  const existing = document.getElementById('ag-gaccount-popover');
  // Re-create if outdated DOM structure (e.g. still has old separate cards or missing group)
  if (existing && (!existing.querySelector('#ag-gaccount-group') || existing.querySelector('#ag-gaccount-add-btn') || existing.querySelector('.ag-gaccount-active-right'))) {
    existing.remove();
  } else if (existing) {
    return;
  }

  const popover = document.createElement('div');
  popover.id = 'ag-gaccount-popover';
  popover.className = 'ag-gaccount-popover';
  popover.style.display = 'none';

  popover.innerHTML = `
    <div class="ag-gaccount-popover-header">
      <div class="ag-gaccount-popover-brand">
        <svg class="ag-gaccount-google-g" width="18" height="18" viewBox="0 0 24 24">
          <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.17Z"/>
          <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24Z"/>
          <path fill="#FBBC05" d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.14-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.99 0 12s.45 3.82 1.25 5.42l4.03-3.15Z"/>
          <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98Z"/>
        </svg>
        <span class="ag-gaccount-brand-text">Account</span>
      </div>
      <button class="ag-gaccount-close-btn" id="ag-gaccount-close-btn" aria-label="Close">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
          <line x1="18" y1="6" x2="6" y2="18"></line>
          <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
      </button>
    </div>

    <div class="ag-gaccount-group" id="ag-gaccount-group">
      <div class="ag-gaccount-active-card" id="ag-gaccount-active-card">
        <div class="ag-gaccount-active-left">
          <div id="ag-gaccount-active-avatar-slot"></div>
          <div class="ag-gaccount-active-meta">
            <div class="ag-gaccount-active-name" id="ag-gaccount-active-name">Google Account</div>
            <div class="ag-gaccount-active-email" id="ag-gaccount-active-email">Detecting account...</div>
            <div class="ag-gaccount-plan-badge" id="ag-gaccount-active-plan-badge" style="display:none;">Pro</div>
          </div>
        </div>
      </div>

      <div class="ag-gaccount-list" id="ag-gaccount-list"></div>
    </div>

    <div class="ag-gaccount-footer-tip" id="ag-gaccount-footer-tip">
      New accounts logged in via CLI or App are automatically saved.
    </div>
  `;

  document.body.appendChild(popover);

  document.getElementById('ag-gaccount-close-btn')?.addEventListener('click', (e) => {
    e.stopPropagation();
    closePopover();
  });



  // Close on outside click
  document.addEventListener('click', (e) => {
    if (!isPopoverOpen) return;
    const target = e.target as HTMLElement | null;
    if (
      !target?.closest('#ag-gaccount-popover') &&
      !target?.closest('#ag-sidebar-account-btn')
    ) {
      closePopover();
    }
  });

  // Close on Escape
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && isPopoverOpen) {
      closePopover();
    }
  });
}

/**
 * Mounts the custom Account Card and minimizes the Settings button to a gear icon
 */
export function mountSidebarAccountButton(): void {
  const settingsBtn = document.querySelector('[data-testid="settings-button"]') as HTMLButtonElement | null;
  if (!settingsBtn) return;

  const parent = settingsBtn.parentElement;
  if (!parent) return;

  ensurePopoverDom();

  // 1. Transform parent container to flex row
  parent.style.display = 'flex';
  parent.style.flexDirection = 'row';
  parent.style.alignItems = 'center';
  parent.style.justifyContent = 'space-between';
  parent.style.gap = '4px';

  // 2. Transform settings button: hide text label, make it a compact gear icon
  const settingsLabel = settingsBtn.querySelector('span.truncate') as HTMLElement | null;
  if (settingsLabel) {
    settingsLabel.style.display = 'none';
  }
  settingsBtn.style.flex = '0 0 32px';
  settingsBtn.style.width = '32px';
  settingsBtn.style.height = '32px';
  settingsBtn.style.minWidth = '32px';
  settingsBtn.style.padding = '0';
  settingsBtn.style.justifyContent = 'center';
  settingsBtn.style.alignItems = 'center';
  settingsBtn.style.borderRadius = '8px';
  settingsBtn.title = 'Settings';

  // 3. Inject Account Card Button if not yet present
  let accountBtn = document.getElementById('ag-sidebar-account-btn') as HTMLButtonElement | null;
  if (!accountBtn) {
    accountBtn = document.createElement('button');
    accountBtn.id = 'ag-sidebar-account-btn';
    accountBtn.className = 'ag-sidebar-account-btn';
    accountBtn.setAttribute('type', 'button');
    accountBtn.setAttribute('aria-haspopup', 'true');
    accountBtn.setAttribute('aria-expanded', 'false');

    accountBtn.innerHTML = `
      <div class="ag-sidebar-avatar-slot"></div>
      <div class="ag-sidebar-account-meta">
        <div class="ag-sidebar-account-name">Loading...</div>
        <div class="ag-sidebar-account-email">...</div>
      </div>
    `;

    accountBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      togglePopover();
    });

    // Insert account card before the settings gear button
    parent.insertBefore(accountBtn, settingsBtn);
  }

  // Probe live profile from Fiber
  probeAndSyncProfile();
  renderSidebarAccountBar();
  sendAccountAction('list');
}

/**
 * Global receiver called by Sidecar via CDP Runtime.evaluate
 */
export function initHostAccountBridge(): void {
  const win = window as any;
  win.__ag_render_accounts = (data: AccountsVaultPayload) => {
    if (data && Array.isArray(data.accounts)) {
      if (
        cachedLiveProfile &&
        data.currentEmail &&
        cachedLiveProfile.email.toLowerCase() !== data.currentEmail.toLowerCase()
      ) {
        cachedLiveProfile = null;
      }
      setLatestVault(data);
      probeAndSyncProfile();
      renderSidebarAccountBar();
      renderPopoverContent();
    }
  };

  mountSidebarAccountButton();

  // Periodic subtle probe to catch profile changes / dynamic login transitions
  setInterval(() => {
    probeAndSyncProfile();
  }, 3000);

  // Watch for sidebar DOM changes (e.g. navigation / React re-renders)
  const observer = new MutationObserver(() => {
    if (!document.getElementById('ag-sidebar-account-btn') && document.querySelector('[data-testid="settings-button"]')) {
      mountSidebarAccountButton();
    }
  });

  observer.observe(document.body, { childList: true, subtree: true });
}
