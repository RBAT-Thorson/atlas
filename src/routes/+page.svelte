<script lang="ts">
  import { onMount, onDestroy, tick } from "svelte";
  import { dndzone, TRIGGERS, SOURCES } from "svelte-dnd-action";
  import { flip } from "svelte/animate";
  import { invoke } from "@tauri-apps/api/core";
  import { appDataDir } from "@tauri-apps/api/path";
  import { loadSettings, saveSettings, loadCustomApps, saveCustomApps, loadSelectedUser, saveSelectedUser, loadSettingsFromUser, loadWindowState, saveWindowState, createAirtableApp, updateAirtableApp, deleteAirtableApp, saveIconData, loadIconData, loadAllIconData, hideGlobalApp, hidePublicApp, loadAppOrder, saveAppOrder, getAirtableApiKey } from "$lib/store";
  import { listen } from "@tauri-apps/api/event";
  import { getCurrentWindow } from "@tauri-apps/api/window";
  import { LogicalPosition, LogicalSize, PhysicalPosition, PhysicalSize } from "@tauri-apps/api/dpi";
  
  // Lucide Icons
  import { Edit, Trash2, RotateCw, Settings, User, Plus, X, EyeOff, Search, ChevronUp, ChevronDown, FolderOpen, FolderPlus, Link2Off } from 'lucide-svelte';

  // Setup console logging to file
  const originalConsole = {
    log: console.log,
    error: console.error,
    warn: console.warn,
    info: console.info,
  };

  const AIRTABLE_API_KEY = getAirtableApiKey();
  const AIRTABLE_AUTH_HEADER = `Bearer ${AIRTABLE_API_KEY}`;

  console.log = (...args: any[]) => {
    originalConsole.log(...args);
    const message = args.map(arg => 
      typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
    ).join(' ');
    invoke("write_console_log", { level: "LOG", message }).catch(() => {});
  };

  console.error = (...args: any[]) => {
    originalConsole.error(...args);
    const message = args.map(arg => 
      typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
    ).join(' ');
    invoke("write_console_log", { level: "ERROR", message }).catch(() => {});
  };

  console.warn = (...args: any[]) => {
    originalConsole.warn(...args);
    const message = args.map(arg => 
      typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
    ).join(' ');
    invoke("write_console_log", { level: "WARN", message }).catch(() => {});
  };

  console.info = (...args: any[]) => {
    originalConsole.info(...args);
    const message = args.map(arg => 
      typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
    ).join(' ');
    invoke("write_console_log", { level: "INFO", message }).catch(() => {});
  };

  let apps: any[] = [];
  let loading = false;
  let error: string | null = null;
  let dragActive = false;
  let externalFileDragActive = false;
  let successMessage: string | null = null;
  let iconCache: Map<string, string> = new Map(); // Cache for icon data URLs

  let showSettings = false;
  let version = "v0.1.0";

  // User management
  let showUserDialog = false;
  let users: any[] = [];
  let selectedUserId: string | null = null;
  let selectedUserName: string | null = null;
  let selectedUser: any = null; // Full user record
  let newUserName = "";
  let creatingUser = false;
  let userSearchQuery = "";
  let filteredUsers: any[] = [];

  // Search and filter
  let searchQuery = "";
  let filteredApps: any[] = [];
  
  // App ordering
  let appOrder: string[] = []; // Array of app IDs in order

  // Settings
  let iconSize = 256;
  let iconPadding = 16;
  let gridColumns = 4;
  let textSize = 18;
  let marginMin = 24;
  let appIconRadius = 16;
  let theme = "light";
  let newAppButtonLocation: "inline" | "titlebar" = "inline";

  // UI state
  let appsExpanded = true;
  let expandedAppId: string | null = null; // Track which app is currently expanded (showing children)
  let expandedChildApps: any[] = [];
  let expandedParentApp: any = null;
  let childMenuPosition: { top: number; left: number; side: 'left' | 'right' } | null = null;
  let childMenuRef: HTMLDivElement | null = null;
  let childMenuOutsideHandler: ((event: PointerEvent) => void) | null = null;
  const CHILD_MENU_WIDTH_ESTIMATE = 260;
  const CHILD_MENU_GAP = 16;
  const CHILD_MENU_MARGIN = 12;

  let contextMenuTarget: any = null;
  let contextMenuParent: any = null;
  let contextMenuLinkedParent: any = null;
  let canShowUnlinkOption = false;
  let contextMenuRef: HTMLDivElement | null = null;
  let detachContextMenuOutsideListener: (() => void) | null = null;
  let dragHoverTimer: ReturnType<typeof setTimeout> | null = null;
  let dragHoverCandidateId: string | null = null;
  let dragChildParentId: string | null = null;
  let dropTargetParentId: string | null = null;
  let pendingExternalDropParentId: string | null = null;
  let lastExternalDropKey: string | null = null;
  let lastExternalDropSource: "dom" | "tauri" | null = null;
  let lastExternalDropTimestamp = 0;
  let reorderDragSourceId: string | null = null;
  let reorderHoldCandidateId: string | null = null;
  let reorderChildReadyId: string | null = null;
  let reorderHoldTimer: ReturnType<typeof setTimeout> | null = null;
  let detachReorderPointerListener: (() => void) | null = null;
  let childMenuDragChildId: string | null = null;
  let childMenuDragParentId: string | null = null;
  const CHILD_DRAG_HOLD_DELAY = 1200;
  const EXTERNAL_DROP_DUPLICATE_WINDOW = 1500;
  const REORDER_DEADZONE_PX = 75;
  const CHILD_DETACH_MIME = "application/atlas-child-detach";

  $: combinedChildHoverCandidateId = dragHoverCandidateId ?? reorderHoldCandidateId;
  $: combinedChildReadyParentId = dragChildParentId ?? reorderChildReadyId;
  $: contextMenuLinkedParent = contextMenuTarget
    ? (contextMenuParent ?? findParentApp(contextMenuTarget))
    : null;
  $: canShowUnlinkOption = Boolean(
    contextMenuTarget &&
    contextMenuLinkedParent &&
    canCurrentUserUnlink(contextMenuTarget, contextMenuLinkedParent)
  );

  // runtime state
  let windowWidth = 0;
  let effectiveIconSize = iconSize;
  let effectiveTextSize = textSize;
  let iconZoomFactors: Record<string, number> = {}; // Track zoom needed per app icon
  let contextMenuX = 0;
  let contextMenuY = 0;
  let confirmDeleteTarget: any = null; // Track which app we're confirming deletion for
  let searchInputRef: HTMLInputElement | null = null;
  
  // Window state saving
  let saveTimeout: number | null = null;
  let unlistenResize: (() => void) | null = null;
  let unlistenMove: (() => void) | null = null;
  let browserResizeHandler: (() => void) | null = null;
  let blurHandler: (() => void) | null = null;
  let beforeUnloadHandler: (() => void) | null = null;

  // Edit pane state
  let showEditPane = false;
  let editingApp: any = null; // null = create mode, object = edit mode
  let editAppName = "";
  let editAppTarget = "";
  let editAppType = "web"; // Default type for new apps
  let editAppOwnership: "Private" | "Public" = "Private"; // Default ownership for new apps
  let editAppIconPath = "";
  let editAppIconDataUrl = "";
  let editAppParentId = "";
  let editPaneChildApps: any[] = [];
  let parentSelectionOptions: any[] = [];
  let editPaneDragActive = false; // Track if dragging over edit pane icon zone
  // Browser pane state
  let showBrowserPane = false;
  let filteredBrowserApps: any[] = [];
  let searchInputFocused = false;
  let searchActive = false;

  function removeChildMenuOutsideListener() {
    if (childMenuOutsideHandler) {
      document.removeEventListener("pointerdown", childMenuOutsideHandler, true);
      childMenuOutsideHandler = null;
    }
  }

  function closeChildMenu() {
    removeChildMenuOutsideListener();
    expandedAppId = null;
    expandedChildApps = [];
    childMenuPosition = null;
    childMenuDragChildId = null;
    childMenuDragParentId = null;
  }

  async function positionChildMenu(anchorEl?: HTMLElement | null) {
    if (!expandedAppId) {
      childMenuPosition = null;
      return;
    }

    if (!anchorEl) {
      anchorEl = document.querySelector<HTMLElement>(`[data-app-button="${expandedAppId}"]`);
    }

    if (!anchorEl) {
      closeChildMenu();
      return;
    }

    const rect = anchorEl.getBoundingClientRect();

    const computePosition = (menuWidth: number, menuHeight: number) => {
      let side: 'left' | 'right' = rect.right + CHILD_MENU_GAP + menuWidth <= window.innerWidth ? 'right' : 'left';
      let left = side === 'right' ? rect.right + CHILD_MENU_GAP : rect.left - CHILD_MENU_GAP - menuWidth;

      if (left < CHILD_MENU_MARGIN) {
        left = CHILD_MENU_MARGIN;
        side = 'right';
      }

      if (left + menuWidth > window.innerWidth - CHILD_MENU_MARGIN) {
        left = Math.max(CHILD_MENU_MARGIN, window.innerWidth - CHILD_MENU_MARGIN - menuWidth);
      }

      let top = rect.top + rect.height / 2 - menuHeight / 2;
      top = Math.max(CHILD_MENU_MARGIN, Math.min(top, window.innerHeight - CHILD_MENU_MARGIN - menuHeight));

      return { top, left, side } as { top: number; left: number; side: 'left' | 'right' };
    };

    childMenuPosition = computePosition(childMenuRef?.offsetWidth || CHILD_MENU_WIDTH_ESTIMATE, childMenuRef?.offsetHeight || rect.height);

    await tick();

    if (childMenuRef) {
      childMenuPosition = computePosition(childMenuRef.offsetWidth, childMenuRef.offsetHeight);
    }
  }

  async function openChildMenu(app: any, anchorEl: HTMLElement) {
    if (!app.Children || !Array.isArray(app.Children) || app.Children.length === 0) {
      return;
    }

    expandedAppId = app.id;
    await positionChildMenu(anchorEl);
    setupChildMenuOutsideListener(app.id);
  }

  function resetChildDropState() {
    if (dragHoverTimer) {
      clearTimeout(dragHoverTimer);
      dragHoverTimer = null;
    }
    dragHoverCandidateId = null;
    dragChildParentId = null;
    dropTargetParentId = null;
  }

  function makeDropKey(paths: string[]): string {
    return paths
      .map((path) => path.toLowerCase())
      .sort()
      .join("|");
  }

  function shouldSkipDuplicateDrop(source: "dom" | "tauri", dropKey: string): boolean {
    return (
      !!lastExternalDropKey &&
      lastExternalDropKey === dropKey &&
      lastExternalDropSource !== null &&
      lastExternalDropSource !== source &&
      Date.now() - lastExternalDropTimestamp < EXTERNAL_DROP_DUPLICATE_WINDOW
    );
  }

  function recordDropHandled(source: "dom" | "tauri", dropKey: string) {
    lastExternalDropKey = dropKey;
    lastExternalDropSource = source;
    lastExternalDropTimestamp = Date.now();
  }

  function cancelReorderHold(targetId?: string | null) {
    if (targetId && reorderHoldCandidateId && reorderHoldCandidateId !== targetId) {
      return;
    }
    if (reorderHoldTimer) {
      clearTimeout(reorderHoldTimer);
      reorderHoldTimer = null;
    }
    reorderHoldCandidateId = null;
    reorderChildReadyId = null;
  }

  function userOwnsApp(app: any | null | undefined): boolean {
    if (!selectedUserId || !app) {
      return false;
    }
    const ownerField = Array.isArray(app.owner)
      ? app.owner
      : Array.isArray(app.Owner)
        ? app.Owner
        : [];
    return ownerField.includes(selectedUserId);
  }

  function ensureUserCanLink(childApp: any | null | undefined, parentApp: any | null | undefined, message?: string): boolean {
    if (!selectedUserId || !parentApp) {
      return false;
    }
    const ownsChild = childApp ? userOwnsApp(childApp) : true;
    const ownsParent = userOwnsApp(parentApp);
    if (!ownsChild || !ownsParent) {
      error = message ?? "You must own both apps to create a child relationship.";
      setTimeout(() => {
        error = null;
      }, 5000);
      return false;
    }
    return true;
  }

  function findParentApp(app: any | null | undefined): any | null {
    if (!app || !Array.isArray(app?.Parent) || app.Parent.length === 0) {
      return null;
    }
    return apps.find((candidate) => app.Parent?.includes(candidate.id)) ?? null;
  }

  function canCurrentUserUnlink(childApp: any | null | undefined, parentApp: any | null | undefined): boolean {
    if (!selectedUserId || !childApp || !parentApp) {
      return false;
    }
    return userOwnsApp(childApp) && userOwnsApp(parentApp);
  }

  function beginReorderHold(targetId: string) {
    if (!reorderDragSourceId || reorderDragSourceId === targetId) {
      cancelReorderHold();
      return;
    }
    if (reorderHoldCandidateId !== targetId) {
      reorderChildReadyId = null;
    }
    reorderHoldCandidateId = targetId;
    if (reorderHoldTimer) {
      clearTimeout(reorderHoldTimer);
    }
    reorderHoldTimer = setTimeout(() => {
      reorderChildReadyId = targetId;
    }, CHILD_DRAG_HOLD_DELAY);
  }

  function stopTrackingReorderPointer() {
    if (detachReorderPointerListener) {
      detachReorderPointerListener();
      detachReorderPointerListener = null;
    }
  }

  function startTrackingReorderPointer() {
    if (typeof window === "undefined" || detachReorderPointerListener) {
      return;
    }
    const handler = (event: PointerEvent) => handleReorderPointerMove(event);
    window.addEventListener("pointermove", handler, true);
    detachReorderPointerListener = () => {
      window.removeEventListener("pointermove", handler, true);
      detachReorderPointerListener = null;
    };
  }

  function handleReorderPointerMove(event: PointerEvent) {
    if (!reorderDragSourceId || typeof document === "undefined") {
      return;
    }
    const element = document.elementFromPoint(event.clientX, event.clientY);
    if (!element || !(element instanceof Element)) {
      cancelReorderHold();
      return;
    }
    const appButton = element.closest('[data-app-button]') as HTMLElement | null;
    if (!appButton) {
      cancelReorderHold();
      return;
    }
    const hoveredId = appButton.getAttribute('data-app-button');
    if (!hoveredId || hoveredId === reorderDragSourceId) {
      cancelReorderHold();
      return;
    }
    const rect = appButton.getBoundingClientRect();
    if (!isPointWithinDeadzone(event.clientX, event.clientY, rect)) {
      cancelReorderHold();
      return;
    }
    beginReorderHold(hoveredId);
  }

  function isPointWithinDeadzone(clientX: number, clientY: number, rect: DOMRect) {
    const deadzoneWidth = Math.min(REORDER_DEADZONE_PX, rect.width);
    const deadzoneHeight = Math.min(REORDER_DEADZONE_PX, rect.height);
    const horizontalPadding = Math.max(0, (rect.width - deadzoneWidth) / 2);
    const verticalPadding = Math.max(0, (rect.height - deadzoneHeight) / 2);
    const leftBoundary = rect.left + horizontalPadding;
    const rightBoundary = rect.right - horizontalPadding;
    const topBoundary = rect.top + verticalPadding;
    const bottomBoundary = rect.bottom - verticalPadding;
    return clientX >= leftBoundary && clientX <= rightBoundary && clientY >= topBoundary && clientY <= bottomBoundary;
  }

  function resetReorderChildState() {
    if (reorderHoldTimer) {
      clearTimeout(reorderHoldTimer);
      reorderHoldTimer = null;
    }
    reorderHoldCandidateId = null;
    reorderChildReadyId = null;
  }

  function endReorderDragSession() {
    resetReorderChildState();
    reorderDragSourceId = null;
    stopTrackingReorderPointer();
  }

  function isExternalFileDrag(event?: DragEvent | null) {
    if (event?.dataTransfer?.types) {
      return Array.from(event.dataTransfer.types).includes("Files");
    }
    return externalFileDragActive;
  }

  function startChildMenuDrag(event: DragEvent, childId: string) {
    if (!expandedAppId) {
      return;
    }
    childMenuDragChildId = childId;
    childMenuDragParentId = expandedAppId;
    if (event.dataTransfer) {
      event.dataTransfer.setData(CHILD_DETACH_MIME, childId);
      event.dataTransfer.effectAllowed = "move";
      const target = event.currentTarget as HTMLElement | null;
      if (target) {
        event.dataTransfer.setDragImage(target, target.offsetWidth / 2, target.offsetHeight / 2);
      }
    }
  }

  function endChildMenuDrag() {
    childMenuDragChildId = null;
    childMenuDragParentId = null;
  }

  function beginChildDropCountdown(appId: string) {
    if (dragHoverTimer) {
      clearTimeout(dragHoverTimer);
    }
    dragHoverCandidateId = appId;
    dragHoverTimer = setTimeout(() => {
      dragChildParentId = appId;
      dropTargetParentId = appId;
      pendingExternalDropParentId = appId;
    }, CHILD_DRAG_HOLD_DELAY);
  }

  function cancelChildDropCountdown(appId?: string) {
    if (dragHoverTimer) {
      clearTimeout(dragHoverTimer);
      dragHoverTimer = null;
    }

    if (!appId || dragHoverCandidateId === appId) {
      dragHoverCandidateId = null;
    }
  }

  function handlePotentialChildDropEnter(event: DragEvent, appId: string) {
    if (!isExternalFileDrag(event)) return;
    event.preventDefault();
    event.stopPropagation();
    if (dragChildParentId === appId) {
      return;
    }
    beginChildDropCountdown(appId);
  }

  function handlePotentialChildDropOver(event: DragEvent, appId: string) {
    if (!isExternalFileDrag(event)) return;
    event.preventDefault();
    event.stopPropagation();
    if (dragChildParentId === appId || dragHoverCandidateId === appId) {
      return;
    }
    beginChildDropCountdown(appId);
  }

  function handlePotentialChildDropLeave(event: DragEvent, appId: string) {
    if (!isExternalFileDrag(event)) return;
    const current = event.currentTarget as HTMLElement | null;
    const related = event.relatedTarget as HTMLElement | null;
    if (current && related && current.contains(related)) {
      return;
    }
    if (dragChildParentId === appId) {
      return;
    }
    cancelChildDropCountdown(appId);
  }

  function setupChildMenuOutsideListener(parentId: string) {
    removeChildMenuOutsideListener();
    childMenuOutsideHandler = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (!target) return;
      if (childMenuRef && childMenuRef.contains(target)) {
        return;
      }
      const parentButton = document.querySelector(`[data-app-button="${parentId}"]`);
      if (parentButton && parentButton.contains(target)) {
        return;
      }
      closeChildMenu();
    };
    document.addEventListener("pointerdown", childMenuOutsideHandler, true);
  }

  // Reactive filtering and sorting for apps based on search and visibility
  $: {
    const trimmedQuery = searchQuery.trim();
    const queryActive = trimmedQuery !== "";
    searchActive = queryActive;
    const normalizedQuery = trimmedQuery.toLowerCase();

    let filtered = apps.filter(app => {
      // Filter by search query
      if (queryActive) {
        const matchesName = app.Name?.toLowerCase().includes(normalizedQuery);
        if (!matchesName) return false;
      }

      const isChildApp = app.Parent && Array.isArray(app.Parent) && app.Parent.length > 0;
      // CHILD APP FILTER: hide child apps in the default view, but surface them when searching
      if (isChildApp && !queryActive) {
        return false;
      }

      // UPDATED MAIN APP GRID FILTER logic based on requirements:
      // a. If the App is Global and Not Hidden by the Current User, Show it.
      // b. If the App is Private and Owned by the Current User, Show it.
      // c. If the App is Public and Either owned by the Current User or The current user appears in the PublicUsers field, show it.
      
      if (app.ownership === "Global") {
        // Show Global apps UNLESS user has hidden them
        if (selectedUser && selectedUser.HideGlobal && Array.isArray(selectedUser.HideGlobal)) {
          if (selectedUser.HideGlobal.includes(app.id)) {
            return false; // User has hidden this Global app
          }
        }
        return true;
      } else if (app.ownership === "Public") {
        // Show Public apps if user is an owner OR if they appear in PublicUsers
        if (selectedUser) {
          // Check if user is an owner of this public app
          if (app.owner && Array.isArray(app.owner) && app.owner.includes(selectedUser.id)) {
            return true;
          }
          // Check if user appears in PublicUsers field (renamed from PublicApps)
          if (app.PublicUsers && Array.isArray(app.PublicUsers) && app.PublicUsers.includes(selectedUser.id)) {
            return true;
          }
        }
        return false;
      } else if (app.ownership === "Private") {
        // Only show Private apps owned by the current user
        if (!selectedUser) {
          return false; // No user selected, don't show private apps
        }
        if (!app.owner || !Array.isArray(app.owner)) {
          return false; // No owner set, don't show it
        }
        return app.owner.includes(selectedUser.id); // Show only if user is the owner
      }

      return false; // Default case - hide if no ownership
    });
    
    // Sort by appOrder if available, otherwise maintain current order
    if (appOrder && appOrder.length > 0) {
      filtered.sort((a, b) => {
        const indexA = appOrder.indexOf(a.id);
        const indexB = appOrder.indexOf(b.id);
        
        // Apps in appOrder come first, sorted by their position
        if (indexA !== -1 && indexB !== -1) return indexA - indexB;
        if (indexA !== -1) return -1; // a is in order, b is not
        if (indexB !== -1) return 1; // b is in order, a is not
        
        // Both apps not in order, maintain their relative order
        return 0;
      });
    }
    
    filteredApps = filtered;
  }

  // Track expanded parent/child collections for the floating child menu
  $: expandedParentApp = expandedAppId ? apps.find((app) => app.id === expandedAppId) ?? null : null;

  $: if (!expandedParentApp) {
    expandedChildApps = [];
  } else if (expandedParentApp.Children && Array.isArray(expandedParentApp.Children)) {
    const nextChildren = apps.filter((candidate) => expandedParentApp.Children?.includes(candidate.id));
    expandedChildApps = nextChildren;
    if (expandedChildApps.length === 0) {
      closeChildMenu();
    }
  }

  // Browser pane filtering - show apps available to add
  $: {
    let browserFiltered = apps.filter(app => {
      // Filter by search query
      if (searchQuery.trim() !== "") {
        const query = searchQuery.toLowerCase();
        const matchesName = app.Name?.toLowerCase().includes(query);
        if (!matchesName) return false;
      }

      // CHILD APP FILTER: Don't show apps that have a Parent (they're child apps)
      if (app.Parent && Array.isArray(app.Parent) && app.Parent.length > 0) {
        return false; // This is a child app, don't show in browser
      }

      // BROWSER PANE FILTER logic based on requirements:
      // a. If the App is Private, do not show it.
      // b. if the App is Global and Hidden by the current user, show it.
      // c. If the App is Public and not currently added by the current user, show it.
      
      if (app.ownership === "Private") {
        return false; // Never show Private apps in browser
      } else if (app.ownership === "Global") {
        // Show Global apps that the user has hidden
        if (selectedUser && selectedUser.HideGlobal && Array.isArray(selectedUser.HideGlobal)) {
          if (selectedUser.HideGlobal.includes(app.id)) {
            return true; // Show hidden Global apps so user can unhide them
          }
        }
        return false; // Don't show Global apps that are already visible
      } else if (app.ownership === "Public") {
        // Show Public apps that the user doesn't own and hasn't added yet
        if (selectedUser) {
          // If user is an owner, don't show it (already in main grid)
          if (app.owner && Array.isArray(app.owner) && app.owner.includes(selectedUser.id)) {
            return false;
          }
          // If user has added it (in PublicUsers), don't show it
          if (app.PublicUsers && Array.isArray(app.PublicUsers) && app.PublicUsers.includes(selectedUser.id)) {
            return false;
          }
          // Show all other public apps
          return true;
        }
        return false; // No user selected, don't show anything
      }

      return false;
    });
    
    filteredBrowserApps = browserFiltered;
  }

  // Focus search input when searchInputFocused is set to true
  $: if (searchInputFocused && searchInputRef) {
    searchInputRef.focus();
  }

  $: parentSelectionOptions = (() => {
    const currentChildOwned = editingApp ? userOwnsApp(editingApp) : true;
    const baseOptions = Array.isArray(filteredApps)
      ? filteredApps.filter((app) => app.id !== (editingApp?.id ?? "") && userOwnsApp(app) && currentChildOwned)
      : [];
    if (editAppParentId && !baseOptions.some((app) => app.id === editAppParentId)) {
      const currentParent = apps.find((app) => app.id === editAppParentId);
      if (currentParent && userOwnsApp(currentParent) && currentChildOwned) {
        return [currentParent, ...baseOptions];
      }
    }
    return baseOptions;
  })();

  $: {
    if (
      editingApp &&
      editingApp.Children &&
      Array.isArray(editingApp.Children) &&
      editingApp.Children.length > 0
    ) {
      const childIds: string[] = editingApp.Children;
      editPaneChildApps = apps.filter((candidate) => childIds.includes(candidate.id));
    } else {
      editPaneChildApps = [];
    }
  }

  function loadTheme(themeName: string) {
    // Ensure global.css is loaded first (only once)
    if (!document.getElementById('global-css')) {
      const globalLink = document.createElement('link');
      globalLink.id = 'global-css';
      globalLink.rel = 'stylesheet';
      globalLink.href = '/themes/global.css';
      document.head.appendChild(globalLink);
      console.log(`🎨 Loaded global styles`);
    }

    // Remove existing theme link if any
    const existingLink = document.getElementById('theme-css');
    if (existingLink) {
      existingLink.remove();
    }

    // Create and append new theme link
    const link = document.createElement('link');
    link.id = 'theme-css';
    link.rel = 'stylesheet';
    link.href = `/themes/${themeName}.css`;
    document.head.appendChild(link);
    console.log(`🎨 Loaded theme: ${themeName}`);
  }

  async function refreshApps() {
    loading = true;
    error = null;
    closeChildMenu();
    try {
      const result = await invoke("refresh_apps", { apiKey: AIRTABLE_API_KEY });
      let airtableApps = Array.isArray(result) ? result.filter((r) => r.Enabled) : [];
      
      // DATABASE QUERY FILTER: Get Global, Public, and user's Private apps
      if (selectedUserId) {
        airtableApps = airtableApps.filter((app) => {
          const ownership = app.ownership;
          const owner = app.owner; // lowercase to match the field name from Airtable
          
          // Include Global and Public apps
          if (ownership === "Global" || ownership === "Public") {
            return true;
          }
          
          // Include Private apps only if user is the owner
          if (ownership === "Private") {
            if (Array.isArray(owner) && owner.includes(selectedUserId)) {
              return true;
            }
            return false;
          }
          
          // Don't show apps with no ownership set
          return false;
        });
      } else {
        // If no user is selected, only show Global apps from Airtable
        airtableApps = airtableApps.filter((app) => {
          const ownership = app.ownership;
          return ownership === "Global";
        });
      }
      
      // Load locally stored icon data
      const allIconData = await loadAllIconData();
      console.log("📦 Loaded icon data from local storage:", Object.keys(allIconData).length, "icons");
      
      // Attach icon data to Airtable apps (prioritize IconB64 from Airtable, fallback to local cache)
      for (const app of airtableApps) {
        let iconSource = "";
        if (!app.Icon) {
          app.Icon = [];
        }
        if (!app.Icon[0]) {
          app.Icon[0] = {};
        }
        
        // Priority 1: IconB64 field from Airtable (base64 data URL)
        if (app.IconB64 && app.IconB64.length > 0) {
          app.Icon[0].iconDataUrl = app.IconB64;
          iconSource = "Airtable IconB64 field";
        }
        // Priority 2: Local cache
        else if (app.Target && allIconData[app.Target]) {
          app.Icon[0].iconDataUrl = allIconData[app.Target];
          iconSource = "local cache";
        }
        
        if (iconSource) {
          console.log("🎨 Attaching icon to:", app.Name, "from", iconSource);
        }
      }
      
      // Load custom apps that were added via drag-and-drop (legacy support - will be migrated)
      const customApps = await loadCustomApps();
      console.log("📂 Loaded custom apps from storage:", customApps);
      
      // Load icon data URLs for custom apps
      for (const app of customApps) {
        console.log("🔍 Processing custom app:", app.Name, "Icon:", app.Icon);
        if (app.Icon && app.Icon[0] && app.Icon[0].path && !app.Icon[0].iconDataUrl) {
          try {
            console.log("⏳ Loading icon data URL for:", app.Name);
            const iconDataUrl = await loadIconDataUrl(app.Icon[0].path);
            if (iconDataUrl) {
              app.Icon[0].iconDataUrl = iconDataUrl;
              console.log("✅ Icon data URL set for:", app.Name);
            }
          } catch (e) {
            console.warn("Could not load icon data URL for stored app:", e);
          }
        } else {
          console.log("⏭️ Skipping icon load:", app.Name, "- path:", app.Icon[0]?.path, "- iconDataUrl:", app.Icon[0]?.iconDataUrl);
        }
      }
      
      // APP NESTING: Apply property inheritance from parent to children
      const allApps = [...airtableApps, ...customApps];
      for (const app of allApps) {
        if (app.Parent && Array.isArray(app.Parent) && app.Parent.length > 0) {
          // This app has a parent, find it and inherit properties
          const parentId = app.Parent[0];
          const parentApp = allApps.find(a => a.id === parentId);
          
          if (parentApp) {
            console.log(`👨‍👧 Applying inheritance from ${parentApp.Name} to ${app.Name}`);
            // Inherit Ownership, Owner, HideFrom, and PublicUsers
            app.ownership = parentApp.ownership;
            app.owner = parentApp.owner;
            app.HideFrom = parentApp.HideFrom;
            app.PublicUsers = parentApp.PublicUsers;
            console.log(`   ✅ Inherited: ownership=${app.ownership}, owner=${app.owner}`);
          }
        }
      }
      
      // Debug: Log apps with Children field
      const appsWithChildren = allApps.filter(app => app.Children);
      if (appsWithChildren.length > 0) {
        console.log("📁 Apps with Children field:", appsWithChildren.map(app => ({
          name: app.Name,
          children: app.Children,
          childrenType: typeof app.Children,
          isArray: Array.isArray(app.Children)
        })));
      }
      
      console.log("🎉 Final apps array before render");
      apps = allApps;
    } catch (e) {
      console.error(e);
      error = "Failed to load apps.";
    } finally {
      loading = false;
    }
  }

  async function loadIconDataUrl(iconPath: string): Promise<string> {
    console.log("🔵 loadIconDataUrl called with:", iconPath);
    
    if (iconCache.has(iconPath)) {
      console.log("📦 Icon cache hit:", iconPath);
      const cached = iconCache.get(iconPath) || '';
      console.log("📦 Returning cached icon, length:", cached.length);
      return cached;
    }
    
    try {
      // Call Rust command to load icon as base64 data URL
      console.log("📥 Step 1: Loading icon from disk via Rust...", iconPath);
      const iconDataUrl = await invoke<string>("load_icon_base64", { path: iconPath });
      console.log("✅ Step 1 complete: Icon loaded, size:", iconDataUrl.length, "chars");
      console.log("🔍 Data URL preview (first 100 chars):", iconDataUrl.substring(0, 100));
      
      // For .icns files, extract PNG data
      const ext = iconPath.split('.').pop()?.toLowerCase();
      console.log("🔍 File extension detected:", ext);
      let finalDataUrl = iconDataUrl;
      
      if (ext === 'icns') {
        console.log("🔄 Step 2: File is .icns, starting PNG extraction...");
        
        // Convert base64 data URL to ArrayBuffer
        console.log("   Step 2a: Splitting data URL to get base64 part...");
        const base64Data = iconDataUrl.split(',')[1];
        console.log("   Step 2b: Base64 data length:", base64Data.length);
        
        console.log("   Step 2c: Decoding base64 to binary string...");
        const binaryString = atob(base64Data);
        console.log("   Step 2d: Binary string length:", binaryString.length);
        
        console.log("   Step 2e: Converting to Uint8Array...");
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        console.log("   Step 2f: Uint8Array created, length:", bytes.length);
        
        const arrayBuffer = bytes.buffer;
        console.log("   Step 2g: ArrayBuffer created, byteLength:", arrayBuffer.byteLength);
        
        // Extract PNG from .icns
        console.log("   Step 2h: Calling extractPngFromIcnsBuffer...");
        finalDataUrl = await extractPngFromIcnsBuffer(arrayBuffer);
        console.log("✅ Step 2 complete: PNG extracted, size:", finalDataUrl.length, "chars");
        console.log("🔍 Extracted PNG preview (first 100 chars):", finalDataUrl.substring(0, 100));
      } else {
        console.log("⏭️ Step 2: Skipped (not .icns file)");
      }
      
      // Store the data URL in cache (NOT blob URL)
      // We store data URLs because they persist across page reloads
      console.log("💾 Step 3: Caching data URL...");
      iconCache.set(iconPath, finalDataUrl);
      console.log("✅ Step 3 complete: Data URL cached");
      console.log("🎉 loadIconDataUrl complete, returning data URL");
      return finalDataUrl;
    } catch (e) {
      console.error("❌ Failed to load icon from path:", iconPath);
      console.error("   Error details:", e);
      return '';
    }
  }

  async function extractPngFromIcnsBuffer(arrayBuffer: ArrayBuffer): Promise<string> {
    console.log("🟢 extractPngFromIcnsBuffer called, buffer size:", arrayBuffer.byteLength);
    const view = new DataView(arrayBuffer);
    
    // Check for .icns magic number (0x69636e73 = 'icns')
    console.log("   Checking magic number...");
    const magic = view.getUint32(0);
    console.log("   Magic number:", magic.toString(16), "(expected: 69636e73)");
    if (magic !== 0x69636e73) {
      console.error("❌ Invalid magic number!");
      throw new Error("Not a valid .icns file (invalid magic number)");
    }
    console.log("   ✅ Valid .icns magic number confirmed");
    
    console.log("🔍 Searching for PNG data in .icns container...");
    
    // Iterate through chunks looking for PNG
    let offset = 8;
    const fileSize = arrayBuffer.byteLength;
    console.log("   File size:", fileSize, "bytes, starting at offset 8");
    
    let chunkCount = 0;
    while (offset < fileSize - 8) {
      chunkCount++;
      // Read chunk type (4 bytes)
      const typeBuffer = new Uint8Array(arrayBuffer, offset, 4);
      const typeStr = String.fromCharCode(...typeBuffer);
      
      // Read chunk size (4 bytes, big-endian)
      const chunkSize = view.getUint32(offset + 4, false);
      
      console.log(`  Chunk #${chunkCount}: type="${typeStr}", size=${chunkSize}, offset=${offset}`);
      
      // Look for PNG chunks (ic09, ic08, ic07, ic06 usually contain PNG)
      if (['ic09', 'ic08', 'ic07', 'ic06', 'it32'].includes(typeStr)) {
        console.log(`    🎯 Found target chunk type: ${typeStr}`);
        const chunkDataStart = offset + 8;
        const chunkDataSize = chunkSize - 8;
        console.log(`    Chunk data: start=${chunkDataStart}, size=${chunkDataSize}`);
        const chunkData = new Uint8Array(arrayBuffer, chunkDataStart, chunkDataSize);
        
        // Check if this chunk contains PNG data (PNG magic: 89 50 4E 47)
        console.log(`    Checking for PNG magic in chunk data (first 4 bytes: ${chunkData[0]?.toString(16)} ${chunkData[1]?.toString(16)} ${chunkData[2]?.toString(16)} ${chunkData[3]?.toString(16)})`);
        if (chunkData.length >= 4 && chunkData[0] === 0x89 && chunkData[1] === 0x50 && 
            chunkData[2] === 0x4E && chunkData[3] === 0x47) {
          console.log(`✅ Found PNG in ${typeStr} chunk at offset ${chunkDataStart}, size: ${chunkData.length} bytes`);
          
          // Convert PNG bytes to data URL
          console.log("    Creating blob from PNG data...");
          const blob = new Blob([chunkData], { type: 'image/png' });
          console.log("    Blob created, size:", blob.size, "bytes");
          
          console.log("    Converting blob to data URL via FileReader...");
          return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => {
              const dataUrl = reader.result as string;
              console.log(`✅ FileReader complete: data URL length ${dataUrl.length} chars`);
              console.log(`   Data URL preview: ${dataUrl.substring(0, 60)}...`);
              resolve(dataUrl);
            };
            reader.onerror = (err) => {
              console.error("❌ FileReader error:", err);
              reject(new Error("Failed to read PNG blob"));
            };
            reader.readAsDataURL(blob);
          });
        }
      }
      
      offset += chunkSize;
    }
    
    throw new Error("No PNG data found in .icns file");
  }

  const ICON_MARGIN_THRESHOLDS = [200, 160, 120, 80, 40, 20];
  const MAX_ICON_ZOOM = 22; // safety cap so icons never scale too much
  const FALLBACK_ICON_ZOOM = 8;

  // Detect transparent margins and return crop percentage
  function detectTransparentMargins(img: HTMLImageElement): number {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx || (!img.naturalWidth && !img.width)) return 0;

    const largestSide = Math.max(img.naturalWidth || img.width, img.naturalHeight || img.height);
    const targetSize = Math.min(256, largestSide);
    const scale = targetSize / largestSide;
    canvas.width = Math.max(1, Math.round((img.naturalWidth || img.width) * scale));
    canvas.height = Math.max(1, Math.round((img.naturalHeight || img.height) * scale));

    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

    try {
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;

      const scanWithThreshold = (threshold: number) => {
        let minX = canvas.width;
        let minY = canvas.height;
        let maxX = 0;
        let maxY = 0;
        let found = false;

        for (let y = 0; y < canvas.height; y++) {
          for (let x = 0; x < canvas.width; x++) {
            const alpha = data[(y * canvas.width + x) * 4 + 3];
            if (alpha >= threshold) {
              found = true;
              if (x < minX) minX = x;
              if (y < minY) minY = y;
              if (x > maxX) maxX = x;
              if (y > maxY) maxY = y;
            }
          }
        }

        if (!found || maxX <= minX || maxY <= minY) {
          return null;
        }

        const contentWidth = maxX - minX;
        const contentHeight = maxY - minY;
        const horizontalScale = canvas.width / contentWidth;
        const verticalScale = canvas.height / contentHeight;
        const scaleNeeded = Math.max(horizontalScale, verticalScale);
        const zoomPercent = (scaleNeeded - 1) * 100;
        return zoomPercent > 2 ? Math.min(zoomPercent, MAX_ICON_ZOOM) : 0;
      };

      for (const threshold of ICON_MARGIN_THRESHOLDS) {
        const result = scanWithThreshold(threshold);
        if (result) {
          return result;
        }
      }
    } catch (e) {
      const message = (e as Error)?.message ?? '';
      if (message.toLowerCase().includes('tainted') || message.toLowerCase().includes('cross-origin')) {
        const width = img.naturalWidth || img.width;
        const height = img.naturalHeight || img.height;
        if (Math.max(width, height) >= 128) {
          console.warn('Icon margin detection blocked by CORS, using fallback zoom');
          return FALLBACK_ICON_ZOOM;
        }
      }
      console.warn('Icon margin detection failed, falling back to no zoom', e);
    }

    return 0;
  }

  // Convert data URL to blob URL for rendering (in-memory only)
  function dataUrlToBlobUrl(dataUrl: string): string {
    console.log("🟣 dataUrlToBlobUrl called, input length:", dataUrl.length);
    console.log("   Input preview (first 100 chars):", dataUrl.substring(0, 100));
    
    try {
      console.log("   Step 1: Matching data URL pattern...");
      const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
      if (!match) {
        console.warn("⚠️ Invalid data URL format - no match!");
        console.warn("   Input was:", dataUrl.substring(0, 150));
        console.warn("   Returning original data URL");
        return dataUrl;
      }
      console.log("   ✅ Pattern matched");
      
      const mimeType = match[1];
      const base64Data = match[2];
      
      console.log(`   Step 2: MIME type: ${mimeType}, base64 length: ${base64Data.length}`);
      
      console.log("   Step 3: Decoding base64...");
      const binaryString = atob(base64Data);
      console.log(`   Step 4: Binary string length: ${binaryString.length}`);
      
      console.log("   Step 5: Converting to Uint8Array...");
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      console.log(`   ✅ Uint8Array created: ${bytes.length} bytes`);
      
      console.log("   Step 6: Creating Blob...");
      const blob = new Blob([bytes], { type: mimeType });
      console.log(`   ✅ Blob created: size=${blob.size} bytes, type=${blob.type}`);
      
      console.log("   Step 7: Creating object URL...");
      const blobUrl = URL.createObjectURL(blob);
      console.log("   ✅ Blob URL created:", blobUrl);
      
      console.log("🎉 dataUrlToBlobUrl complete, returning blob URL");
      return blobUrl;
    } catch (blobError) {
      console.error("❌ dataUrlToBlobUrl failed with error:", blobError);
      console.error("   Error stack:", (blobError as Error).stack);
      console.error("   Falling back to original data URL");
      return dataUrl;
    }
  }

  async function openApp(target?: string, appType?: string) {
    if (!target) return;
    try {
      await invoke("open_target", { params: { target, app_type: appType } });
    } catch (e) {
      const errorMsg = e instanceof Error ? e.message : String(e);
      console.error("Launch failed:", errorMsg);
      error = `Failed to launch: ${errorMsg}`;
      // Auto-clear error after 5 seconds
      setTimeout(() => {
        error = null;
      }, 5000);
    }
  }

  async function handleContextMenu(e: MouseEvent, app: any, parentApp?: any | null) {
    e.preventDefault();
    const keepChildMenuOpen = Boolean(parentApp);
    dismissContextMenu();
    if (!keepChildMenuOpen) {
      closeChildMenu();
    }
    contextMenuTarget = app;
    contextMenuParent = parentApp ?? null;
    contextMenuX = e.clientX;
    contextMenuY = e.clientY;
    await tick();
    addContextMenuOutsideListener();
  }

  function dismissContextMenu() {
    removeContextMenuOutsideListener();
    contextMenuTarget = null;
    contextMenuParent = null;
    contextMenuRef = null;
  }

  function addContextMenuOutsideListener() {
    if (typeof window === "undefined" || detachContextMenuOutsideListener) {
      return;
    }

    const handlePointerDown = (event: PointerEvent) => {
      if (contextMenuRef && contextMenuRef.contains(event.target as Node)) {
        return;
      }
      dismissContextMenu();
    };

    const handleWindowChange = () => {
      dismissContextMenu();
    };

    window.addEventListener("pointerdown", handlePointerDown, true);
    window.addEventListener("wheel", handleWindowChange, true);
    window.addEventListener("scroll", handleWindowChange, true);
    window.addEventListener("resize", handleWindowChange, true);

    detachContextMenuOutsideListener = () => {
      window.removeEventListener("pointerdown", handlePointerDown, true);
      window.removeEventListener("wheel", handleWindowChange, true);
      window.removeEventListener("scroll", handleWindowChange, true);
      window.removeEventListener("resize", handleWindowChange, true);
      detachContextMenuOutsideListener = null;
    };
  }

  function removeContextMenuOutsideListener() {
    if (detachContextMenuOutsideListener) {
      detachContextMenuOutsideListener();
    }
  }

  async function deleteApp(app: any) {
    console.log("🗑️ Delete clicked for:", app?.Name);
    // Set confirmation target instead of using confirm()
    confirmDeleteTarget = app;
    dismissContextMenu();
  }

  async function confirmDelete() {
    if (!confirmDeleteTarget) return;
    
    const app = confirmDeleteTarget;
    console.log("✅ Confirmed deleting app:", app.Name);
    
    try {
      // Check if this is a Public app with users using it
      if (app.ownership === "Public" && app.PublicUsers && Array.isArray(app.PublicUsers) && app.PublicUsers.length > 0) {
        console.log("📋 Public app has users, transferring ownership instead of deleting");
        
        // Get the first user from PublicUsers list
        const newOwnerId = app.PublicUsers[0];
        console.log("👤 Transferring ownership to user:", newOwnerId);
        
        // Remove the new owner from PublicUsers list
        const updatedPublicUsers = app.PublicUsers.filter((id: string) => id !== newOwnerId);
        console.log("📝 Updated PublicUsers list:", updatedPublicUsers);
        
        // Update the app in Airtable with new owner and updated PublicUsers
        if (app.id) {
          // First, update using the normal updateAirtableApp function
          await updateAirtableApp(app.id, {
            Owner: [newOwnerId], // Set owner to the first user in PublicUsers
          });
          
          // Then make a direct API call to update PublicUsers field
          try {
            const response = await fetch(
              `https://api.airtable.com/v0/appL7Lq4VPcHgAewL/tblr8L369WEh7mGYh/${app.id}`,
              {
                method: "PATCH",
                headers: {
                  Authorization: AIRTABLE_AUTH_HEADER,
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({
                  fields: {
                    PublicUsers: updatedPublicUsers,
                  },
                }),
              }
            );
            
            if (!response.ok) {
              const errorData = await response.json();
              console.error("⚠️ Warning: Could not update PublicUsers:", errorData);
              // Continue anyway, as ownership was already transferred
            } else {
              console.log("✅ PublicUsers list updated");
            }
          } catch (e) {
            console.error("⚠️ Warning: Error updating PublicUsers:", e);
            // Continue anyway
          }
          
          console.log("✅ Ownership transferred to:", newOwnerId);
        }
        
        successMessage = `Ownership transferred: ${app.Name}`;
      } else {
        // Delete the app normally
        console.log("🗑️ Deleting app (no active users or not public)");
        
        // Delete from Airtable if it has a record ID
        if (app.id) {
          console.log("🗑️ Deleting from Airtable:", app.id);
          await deleteAirtableApp(app.id);
        }
        
        // If it's a custom app, remove from storage
        if (app.isCustom) {
          const customApps = await loadCustomApps();
          const filtered = customApps.filter((a) => a.Target !== app.Target);
          await saveCustomApps(filtered);
        }

        successMessage = `Deleted: ${app.Name}`;
      }
      
      // Remove from apps array
      apps = apps.filter((a) => a.Target !== app.Target);
    } catch (err) {
      console.error("❌ Error deleting app:", err);
      error = `Failed to delete app: ${err}`;
    } finally {
      confirmDeleteTarget = null;
      setTimeout(() => {
        successMessage = null;
        error = null;
      }, 15000);
      
      // Refresh apps to update the UI
      await refreshApps();
    }
  }

  function cancelDelete() {
    console.log("❌ Delete cancelled");
    confirmDeleteTarget = null;
  }

  async function hideApp(app: any) {
    console.log("🙈 Hide clicked for:", app?.Name);
    if (!selectedUserId || !app.id) {
      console.error("❌ Cannot hide app: missing user ID or app ID");
      return;
    }
    
    dismissContextMenu();
    
    try {
      if (app.ownership === "Global") {
        // For Global apps, add app to user's HideGlobal field
        await hideGlobalApp(app.id, selectedUserId);
        successMessage = `Hidden: ${app.Name}`;
        
        // Refresh users list to get updated HideGlobal field
        const usersResult = await invoke("fetch_users", { apiKey: AIRTABLE_API_KEY });
        users = Array.isArray(usersResult) ? usersResult : [];
        const updatedUser = users.find((u) => u.id === selectedUserId);
        if (updatedUser) {
          selectedUser = updatedUser;
        }
      } else if (app.ownership === "Public") {
        // For Public apps, remove from user's PublicUsers list
        await hidePublicApp(app.id, selectedUserId);
        successMessage = `Hidden: ${app.Name}`;
        
        // Refresh users list to get updated PublicUsers field
        const usersResult = await invoke("fetch_users", { apiKey: AIRTABLE_API_KEY });
        users = Array.isArray(usersResult) ? usersResult : [];
        const updatedUser = users.find((u) => u.id === selectedUserId);
        if (updatedUser) {
          selectedUser = updatedUser;
        }
      } else {
        console.warn("⚠️ Cannot hide Private apps");
        return;
      }
      
      // Refresh apps to update the UI
      await refreshApps();
      
      setTimeout(() => {
        successMessage = null;
      }, 15000);
    } catch (err) {
      console.error("❌ Error hiding app:", err);
      error = `Failed to hide app: ${err}`;
      setTimeout(() => {
        error = null;
      }, 5000);
    }
  }

  async function addPublicAppToUser(appId: string) {
    console.log("➕ Adding public app to user:", appId);
    if (!selectedUserId) {
      error = "Please select a user first";
      setTimeout(() => { error = null; }, 3000);
      return;
    }

    try {
      console.log("   Fetching user data for:", selectedUserId);
      // Get current user's PublicUsers array
      const getUserResponse = await fetch(
        `https://api.airtable.com/v0/appL7Lq4VPcHgAewL/tblbpYp0Cza2JMKKR/${selectedUserId}`,
        {
          headers: {
            Authorization: AIRTABLE_AUTH_HEADER,
          },
        }
      );
      
      if (!getUserResponse.ok) {
        const errorText = await getUserResponse.text();
        console.error("❌ Failed to fetch user:", getUserResponse.status, errorText);
        throw new Error(`Failed to fetch user: ${getUserResponse.statusText}`);
      }
      
      const userData = await getUserResponse.json();
      console.log("   Current user data:", userData);
      const currentPublicApps = userData.fields.PublicApps || [];
      console.log("   Current Public Apps list:", currentPublicApps);
      
      // Add app if not already in the list
      if (!currentPublicApps.includes(appId)) {
        currentPublicApps.push(appId);
        console.log("   Updating with new PublicApps list:", currentPublicApps);
        
        const updateResponse = await fetch(
          `https://api.airtable.com/v0/appL7Lq4VPcHgAewL/tblbpYp0Cza2JMKKR/${selectedUserId}`,
          {
            method: "PATCH",
            headers: {
              Authorization: AIRTABLE_AUTH_HEADER,
              "Content-Type": "application/json",
            },
                body: JSON.stringify({
                  fields: {
                    PublicApps: currentPublicApps,
                  },
                }),
          }
        );
        
        if (!updateResponse.ok) {
          const errorData = await updateResponse.json();
          console.error("❌ Failed to add public app:", errorData);
          throw new Error(`Failed to add public app: ${updateResponse.statusText}`);
        }
        
        const updateResult = await updateResponse.json();
        console.log("✅ Update successful:", updateResult);
        
        // Update selectedUser object immediately
        if (selectedUser) {
          selectedUser.PublicApps = currentPublicApps;
          console.log("   Updated selectedUser.PublicApps:", selectedUser.PublicApps);
        }
        
        successMessage = "Added to your apps!";
        
        // Refresh users list to get latest data
        const usersResult = await invoke("fetch_users", { apiKey: AIRTABLE_API_KEY });
        users = Array.isArray(usersResult) ? usersResult : [];
        const updatedUser = users.find((u) => u.id === selectedUserId);
        if (updatedUser) {
          selectedUser = updatedUser;
          console.log("   Refreshed selectedUser from server:", selectedUser);
        }
        
        // Refresh apps to update the UI
        await refreshApps();
        
        setTimeout(() => {
          successMessage = null;
        }, 15000);
      } else {
        console.log("   App already in user's list");
      }
    } catch (err) {
      console.error("❌ Error adding public app:", err);
      error = `Failed to add app: ${err}`;
      setTimeout(() => {
        error = null;
      }, 5000);
    }
  }

  async function unhideGlobalApp(appId: string) {
    console.log("🔍 Unhiding global app:", appId);
    if (!selectedUserId) {
      error = "Please select a user first";
      setTimeout(() => { error = null; }, 3000);
      return;
    }

    try {
      // Use the store's hideGlobalApp function to remove from HideGlobal list
      // But first we need to get the current list and remove the app
      const getUserResponse = await fetch(
        `https://api.airtable.com/v0/appL7Lq4VPcHgAewL/tblbpYp0Cza2JMKKR/${selectedUserId}`,
        {
          headers: {
            Authorization: AIRTABLE_AUTH_HEADER,
          },
        }
      );
      
      if (!getUserResponse.ok) {
        throw new Error(`Failed to fetch user: ${getUserResponse.statusText}`);
      }
      
      const userData = await getUserResponse.json();
      const currentHideList = userData.fields.HideGlobal || [];
      
      // Remove app from hide list
      const updatedHideList = currentHideList.filter((id: string) => id !== appId);
      
      const updateResponse = await fetch(
        `https://api.airtable.com/v0/appL7Lq4VPcHgAewL/tblbpYp0Cza2JMKKR/${selectedUserId}`,
        {
          method: "PATCH",
          headers: {
            Authorization: AIRTABLE_AUTH_HEADER,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            fields: {
              HideGlobal: updatedHideList,
            },
          }),
        }
      );
      
      if (!updateResponse.ok) {
        throw new Error(`Failed to unhide app: ${updateResponse.statusText}`);
      }
      
      // Update selectedUser object
      if (selectedUser) {
        selectedUser.HideGlobal = updatedHideList;
      }
      
      successMessage = "App unhidden!";
      
      // Refresh users list
      const usersResult = await invoke("fetch_users", { apiKey: AIRTABLE_API_KEY });
      users = Array.isArray(usersResult) ? usersResult : [];
      const updatedUser = users.find((u) => u.id === selectedUserId);
      if (updatedUser) {
        selectedUser = updatedUser;
      }
      
      // Refresh apps
      await refreshApps();
      
      setTimeout(() => {
        successMessage = null;
      }, 15000);
    } catch (err) {
      console.error("❌ Error unhiding app:", err);
      error = `Failed to unhide app: ${err}`;
      setTimeout(() => {
        error = null;
      }, 5000);
    }
  }

  function openEditPane(app: any) {
    console.log("✏️ Opening edit pane for:", app.Name);
    editingApp = app;
    editAppName = app.Name;
    editAppTarget = app.Target;
    editAppType = app.type_field || "web";
    editAppOwnership = app.ownership === "Public" ? "Public" : "Private"; // Global apps can't be edited to Private/Public
    editAppIconPath = app.Icon?.[0]?.path || "";
    editAppIconDataUrl = app.Icon?.[0]?.iconDataUrl || "";
    editAppParentId = Array.isArray(app.Parent) && app.Parent.length > 0 ? app.Parent[0] : "";
    showEditPane = true;
    dismissContextMenu();
  }

  function openCreatePane() {
    console.log("➕ Opening create pane");
    editingApp = null; // null indicates create mode
    editAppName = "";
    editAppTarget = "";
    editAppType = "web";
    editAppOwnership = "Private";
    editAppIconPath = "";
    editAppIconDataUrl = "";
    editAppParentId = "";
    showEditPane = true;
  }

  function closeEditPane() {
    console.log("❌ Edit/Create cancelled");
    showEditPane = false;
    editingApp = null;
    editAppName = "";
    editAppTarget = "";
    editAppType = "web";
    editAppOwnership = "Private";
    editAppIconPath = "";
    editAppIconDataUrl = "";
    editAppParentId = "";
  }

  async function saveEditedApp() {
    // Validation
    if (!editAppName.trim()) {
      error = "App name is required";
      setTimeout(() => { error = null; }, 3000);
      return;
    }
    if (!editAppTarget.trim()) {
      error = "Target URL/path is required";
      setTimeout(() => { error = null; }, 3000);
      return;
    }

    try {
      if (editingApp) {
        // EDIT MODE: Update existing app
        console.log("💾 Saving edited app:", editAppName);
        const currentParentId = Array.isArray(editingApp.Parent) && editingApp.Parent.length > 0 ? editingApp.Parent[0] : "";
        const normalizedParentId = editAppParentId || "";
        const parentChanged = currentParentId !== normalizedParentId;
        const parentCandidate = normalizedParentId ? apps.find((app) => app.id === normalizedParentId) : null;
        if (normalizedParentId && !ensureUserCanLink(editingApp, parentCandidate)) {
          return;
        }
        
        const updatePayload: Record<string, any> = {
          Name: editAppName,
          Target: editAppTarget,
          Type: editAppType,
          Ownership: editAppOwnership,
        };

        if (parentChanged) {
          updatePayload.Parent = normalizedParentId ? [normalizedParentId] : [];
        }

        // Update in Airtable if it has an ID
        if (editingApp.id) {
          await updateAirtableApp(editingApp.id, updatePayload);
          
          // If icon changed, update it too
          if (editAppIconDataUrl && editAppIconDataUrl !== editingApp.Icon?.[0]?.iconDataUrl) {
            await updateAirtableApp(editingApp.id, {
              IconB64: editAppIconDataUrl,
            });
            // Save icon to local cache
            await saveIconData(editAppTarget, editAppIconDataUrl);
          }
        }
        
        // Find and update the app in the apps array
        const appIndex = apps.findIndex(a => a.Target === editingApp.Target);
        if (appIndex >= 0) {
          apps[appIndex].Name = editAppName;
          apps[appIndex].Target = editAppTarget;
          apps[appIndex].type_field = editAppType;
          if (parentChanged) {
            apps[appIndex].Parent = normalizedParentId ? [normalizedParentId] : [];
            editingApp.Parent = normalizedParentId ? [normalizedParentId] : [];
          }
          if (editAppIconPath || editAppIconDataUrl) {
            apps[appIndex].Icon = [{
              path: editAppIconPath,
              iconDataUrl: editAppIconDataUrl
            }];
          }
        }

        // If it's a custom app, update storage
        if (editingApp.isCustom) {
          const customApps = await loadCustomApps();
          const customIndex = customApps.findIndex(a => a.Target === editingApp.Target);
          if (customIndex >= 0) {
            customApps[customIndex].Name = editAppName;
            customApps[customIndex].Target = editAppTarget;
            customApps[customIndex].type_field = editAppType;
            if (editAppIconPath || editAppIconDataUrl) {
              customApps[customIndex].Icon = [{
                path: editAppIconPath,
                iconDataUrl: editAppIconDataUrl
              }];
            }
            await saveCustomApps(customApps);
          }
        }

        successMessage = `Updated: ${editAppName}`;
      } else {
        // CREATE MODE: Add new app
        console.log("➕ Creating new app:", editAppName);
        
        if (!selectedUserId) {
          error = "Please select a user first";
          setTimeout(() => { error = null; }, 5000);
          return;
        }

        const newParentApp = editAppParentId ? apps.find((app) => app.id === editAppParentId) : null;
        if (editAppParentId && !ensureUserCanLink(null, newParentApp)) {
          return;
        }

        // Create in Airtable
        const newApp = await createAirtableApp({
          Name: editAppName,
          Target: editAppTarget,
          Type: editAppType,
          Enabled: true,
          Icon: editAppIconDataUrl,
          Ownership: editAppOwnership,
          Owner: [selectedUserId],
          Parent: editAppParentId ? [editAppParentId] : undefined,
        }, selectedUserId);

        // Save icon to local cache
        if (editAppIconDataUrl) {
          await saveIconData(editAppTarget, editAppIconDataUrl);
        }

        // Refresh apps to show the new one
        await refreshApps();

        successMessage = `Created: ${editAppName}`;
      }

      setTimeout(() => {
        successMessage = null;
      }, 15000);

      closeEditPane();
    } catch (err) {
      console.error("❌ Error saving app:", err);
      error = `Failed to save app: ${err}`;
      setTimeout(() => {
        error = null;
      }, 5000);
    }
  }

  async function pickIconFile() {
    try {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.icns,.ico,.png';
      input.onchange = async (e: any) => {
        const file = e.target.files?.[0];
        if (file) {
          console.log("📁 Selected icon file:", file.name);
          
          const ext = file.name.split('.').pop()?.toLowerCase();
          
          try {
            if (ext === 'icns') {
              // For ICNS, extract PNG in browser
              const arrayBuffer = await file.arrayBuffer();
              const pngDataUrl = await extractPngFromIcnsBuffer(arrayBuffer);
              editAppIconDataUrl = pngDataUrl;
              editAppIconPath = file.name;
              console.log("✅ Icon loaded for editing (PNG extracted from .icns)");
            } else {
              // For PNG and ICO, read as data URL directly
              const reader = new FileReader();
              reader.onload = (event: any) => {
                editAppIconDataUrl = event.target.result;
                editAppIconPath = file.name;
                console.log("✅ Icon loaded for editing (.png/.ico)");
              };
              reader.onerror = () => {
                console.error("❌ Failed to read file");
                error = "Failed to read icon file";
                setTimeout(() => {
                  error = null;
                }, 3000);
              };
              reader.readAsDataURL(file);
            }
          } catch (err) {
            console.error("❌ Failed to process icon file:", err);
            error = `Failed to process icon: ${err instanceof Error ? err.message : 'Unknown error'}`;
            setTimeout(() => {
              error = null;
            }, 3000);
          }
        }
      };
      input.click();
    } catch (e) {
      console.error("❌ Failed to open file dialog:", e);
      error = "Failed to open file dialog";
      setTimeout(() => {
        error = null;
      }, 3000);
    }
  }

  function removeEditIcon() {
    console.log("🗑️ Removing icon from edit pane");
    editAppIconPath = "";
    editAppIconDataUrl = "";
  }

  async function handleEditPaneDrop(e: DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    console.log("📥 handleEditPaneDrop called");

    const files = e.dataTransfer?.files;
    if (!files || files.length === 0) {
      console.log("❌ No files in drop");
      editPaneDragActive = false;
      return;
    }

    const file = files[0];
    const filePath = (file as any).path || (file as any).webkitRelativePath || file.name;
    
    if (!filePath) {
      console.log("❌ No file path");
      editPaneDragActive = false;
      return;
    }

    // Check if it's a supported icon format
    const ext = filePath.split('.').pop()?.toLowerCase();
    if (!['icns', 'ico', 'png'].includes(ext || '')) {
      error = "Only PNG, ICO, or ICNS files are supported";
      setTimeout(() => {
        error = null;
      }, 3000);
      console.log("❌ Unsupported file type:", ext);
      editPaneDragActive = false;
      return;
    }

    console.log("🎨 Dropped icon file:", filePath);
    
    try {
      // If we have a real file path (from Tauri), use the backend
      if ((file as any).path) {
        editAppIconPath = filePath;
        const iconDataUrl = await loadIconDataUrl(filePath);
        editAppIconDataUrl = iconDataUrl;
        console.log("✅ Icon loaded from drop (backend), resetting editPaneDragActive");
        editPaneDragActive = false;
      } else {
        // If it's a browser File object, handle it locally
        if (ext === 'icns') {
          const arrayBuffer = await file.arrayBuffer();
          const pngDataUrl = await extractPngFromIcnsBuffer(arrayBuffer);
          editAppIconDataUrl = pngDataUrl;
          editAppIconPath = file.name;
          console.log("✅ Icon loaded from drop (PNG extracted from .icns), resetting editPaneDragActive");
          editPaneDragActive = false;
        } else {
          // For PNG and ICO, read as data URL
          const reader = new FileReader();
          reader.onload = (event: any) => {
            editAppIconDataUrl = event.target.result;
            editAppIconPath = file.name;
            console.log("✅ Icon loaded from drop (.png/.ico), resetting editPaneDragActive");
            editPaneDragActive = false;
          };
          reader.onerror = () => {
            console.error("❌ Failed to read dropped file");
            error = "Failed to read icon file";
            setTimeout(() => {
              error = null;
            }, 3000);
            console.log("❌ FileReader error, resetting editPaneDragActive");
            editPaneDragActive = false;
          };
          reader.readAsDataURL(file);
        }
      }
    } catch (err) {
      console.error("❌ Failed to process dropped icon:", err);
      error = `Failed to process icon: ${err instanceof Error ? err.message : 'Unknown error'}`;
      setTimeout(() => {
        error = null;
      }, 3000);
      console.log("❌ Exception in drop handler, resetting editPaneDragActive");
      editPaneDragActive = false;
    }
  }

  async function persistSettings() {
    // Ensure we store numeric values (range inputs may provide strings)
    const settings = {
      iconSize: Number(iconSize),
      iconPadding: Number(iconPadding),
      gridColumns: Number(gridColumns),
      textSize: Number(textSize),
      marginMin: Number(marginMin),
      appIconRadius: Number(appIconRadius),
      theme: theme,
      newAppButtonLocation: newAppButtonLocation,
    };
    
    await saveSettings(settings);
    
    // Also save to Airtable if user is selected
    if (selectedUserId) {
      try {
        const settingsJson = JSON.stringify(settings);
        await invoke("update_user_settings", { 
          userId: selectedUserId, 
          settingsJson: settingsJson,
          apiKey: AIRTABLE_API_KEY
        });
        console.log("💾 Settings saved to Airtable for user:", selectedUserName);
      } catch (e) {
        console.error("Failed to save settings to Airtable:", e);
      }
    }
  }

  onMount(async () => {
    const path = await appDataDir();
    console.log("📂 App data directory:", path);

    // Load selected user first
    selectedUserId = await loadSelectedUser();
    if (selectedUserId) {
      // Fetch users to get the full user record
      try {
        const result = await invoke("fetch_users", { apiKey: AIRTABLE_API_KEY });
        users = Array.isArray(result) ? result : [];
        const user = users.find((u) => u.id === selectedUserId);
        if (user) {
          selectedUserName = user.Name;
          selectedUser = user;
          console.log("👤 Loaded selected user:", selectedUserName);
          
          // Load settings from user record if available
          if (user.UserSettings) {
            const userSettings = await loadSettingsFromUser(user.UserSettings);
            iconSize = userSettings.iconSize;
            iconPadding = userSettings.iconPadding;
            gridColumns = userSettings.gridColumns;
            textSize = userSettings.textSize;
            marginMin = userSettings.marginMin;
            appIconRadius = userSettings.appIconRadius;
            theme = userSettings.theme;
            newAppButtonLocation = userSettings.newAppButtonLocation;
            console.log("🧩 Settings loaded from user record");
          } else {
            // Fall back to local settings
            const s = await loadSettings();
            iconSize = s.iconSize;
            iconPadding = s.iconPadding;
            gridColumns = s.gridColumns;
            marginMin = s.marginMin ?? marginMin;
            appIconRadius = s.appIconRadius ?? appIconRadius;
            textSize = s.textSize;
            theme = s.theme ?? theme;
            newAppButtonLocation = s.newAppButtonLocation ?? newAppButtonLocation;
            console.log("🧩 Settings loaded from local storage");
          }
          
          // Load app order for this user
          try {
            appOrder = await loadAppOrder(selectedUserId);
            console.log("🎯 App order loaded for user:", appOrder);
          } catch (err) {
            console.warn("⚠️ Failed to load app order:", err);
            appOrder = [];
          }
        }
      } catch (e) {
        console.warn("Could not fetch users:", e);
        // Fall back to local settings
        const s = await loadSettings();
        iconSize = s.iconSize;
        iconPadding = s.iconPadding;
        gridColumns = s.gridColumns;
        marginMin = s.marginMin ?? marginMin;
        appIconRadius = s.appIconRadius ?? appIconRadius;
        textSize = s.textSize;
        theme = s.theme ?? theme;
        newAppButtonLocation = s.newAppButtonLocation ?? newAppButtonLocation;
      }
    } else {
      // No user selected, load local settings
      const s = await loadSettings();
      iconSize = s.iconSize;
      iconPadding = s.iconPadding;
      gridColumns = s.gridColumns;
      marginMin = s.marginMin ?? marginMin;
      appIconRadius = s.appIconRadius ?? appIconRadius;
      textSize = s.textSize;
      theme = s.theme ?? theme;
      newAppButtonLocation = s.newAppButtonLocation ?? newAppButtonLocation;
    }

    // Load theme CSS
    loadTheme(theme);

    // Show user dialog if no user is selected
    if (!selectedUserId) {
      await openUserDialog();
    }

    await refreshApps();

    // initialize sizing
    windowWidth = window.innerWidth;
    updateEffectiveSize();
    window.addEventListener("resize", onResize);

    // Test: Add listeners at multiple levels to catch drag events
    console.log("📌 Attaching drag-and-drop listeners...");
    
    // Try document level - use capture phase to intercept early
    const docDragover = (e: DragEvent) => {
      // Check if edit pane overlay is actually in the DOM
      const editPaneOverlay = document.querySelector('.tray-overlay[aria-label="Close edit pane"]');
      const isEditPaneOpen = editPaneOverlay !== null;
      
      if (isEditPaneOpen) {
        console.log("📥 Document dragover - BLOCKED (edit pane open)");
        return;
      }
      console.log("📥 Document dragover detected");
      e.preventDefault();
      e.stopPropagation();
      dragActive = true;
    };
    
    const docDragleave = (e: DragEvent) => {
      // Check if edit pane overlay is actually in the DOM
      const editPaneOverlay = document.querySelector('.tray-overlay[aria-label="Close edit pane"]');
      const isEditPaneOpen = editPaneOverlay !== null;
      
      if (isEditPaneOpen) return;
      console.log("📥 Document dragleave detected");
      dragActive = false;
    };
    
    const docDrop = (e: DragEvent) => {
      // Check if edit pane overlay is actually in the DOM
      const editPaneOverlay = document.querySelector('.tray-overlay[aria-label="Close edit pane"]');
      const isEditPaneOpen = editPaneOverlay !== null;
      
      if (isEditPaneOpen) {
        console.log("📥 Document drop - SKIPPED (edit pane open, using element handlers)");
        return;
      }
      console.log("📥 Document drop detected", e);
      handleDrop(e);
    };
    
    document.addEventListener("dragover", docDragover as EventListener, true);
    document.addEventListener("dragleave", docDragleave as EventListener, true);
    document.addEventListener("drop", docDrop as EventListener, true);

    // Try window level - use capture phase
    const winDragover = (e: DragEvent) => {
      // Check if edit pane overlay is actually in the DOM
      const editPaneOverlay = document.querySelector('.tray-overlay[aria-label="Close edit pane"]');
      const isEditPaneOpen = editPaneOverlay !== null;
      
      if (isEditPaneOpen) {
        console.log("🪟 Window dragover - SKIPPED (edit pane open)");
        return;
      }
      console.log("🪟 Window dragover detected");
      e.preventDefault();
      e.stopPropagation();
      dragActive = true;
    };
    
    const winDrop = (e: DragEvent) => {
      // Check if edit pane overlay is actually in the DOM
      const editPaneOverlay = document.querySelector('.tray-overlay[aria-label="Close edit pane"]');
      const isEditPaneOpen = editPaneOverlay !== null;
      
      if (isEditPaneOpen) {
        console.log("🪟 Window drop - SKIPPED (edit pane open, using element handlers)");
        return;
      }
      console.log("🪟 Window drop detected");
      handleDrop(e);
    };
    
    window.addEventListener("dragover", winDragover as EventListener, true);
    window.addEventListener("drop", winDrop as EventListener, true);

    // Also try container
    const container = document.querySelector(".container");
    if (container) {
      container.addEventListener("dragover", (e) => {
        console.log("� Container dragover detected");
        handleDragOver(e);
      });
      container.addEventListener("dragleave", (e) => {
        console.log("📦 Container dragleave detected");
        handleDragLeave(e);
      });
      container.addEventListener("drop", (e) => {
        console.log("� Container drop detected");
        handleDrop(e);
      });
      console.log("✅ Container drag-and-drop listeners attached");
    }

    // Setup Tauri drag/drop event listeners (use the platform event names exposed by Tauri)
    // NOTE: We only handle tauri://drag-drop for actual file drops from outside the window
    // App reordering uses browser-native drag-drop API to avoid conflicts
    const tauriDragEvents = [
      "tauri://drag-drop",  // Only listen to drop, not enter/leave
    ];

    for (const eventName of tauriDragEvents) {
      try {
        // attach listener and keep the returned unlisten for potential future cleanup
        await listen<any>(eventName, async (event) => {
          // Helper to check if this is an actual file drop (not just app reordering)
          const isActualFilePayload = (payload: any): boolean => {
            if (!payload) return false;
            // Check for array of strings (file paths)
            if (Array.isArray(payload) && payload.length > 0 && typeof payload[0] === 'string') {
              return true;
            }
            // Check for object with paths array
            if (payload && payload.paths && Array.isArray(payload.paths) && payload.paths.length > 0) {
              return true;
            }
            return false;
          };
          
          // Check for actual files - only process external file drops
          const hasRealFiles = isActualFilePayload(event?.payload);
          
          if (hasRealFiles) {
            // Real file drop from OUTSIDE the app - process it
            const payload = event.payload;
            if (Array.isArray(payload)) {
              handleTauriFileDrop(payload);
            } else if (typeof payload === "string") {
              handleTauriFileDrop([payload]);
            } else if (payload && payload.paths) {
              handleTauriFileDrop(payload.paths as string[]);
            }
          }
          // Ignore all drops without actual files - let browser handle internal drags
        });
        console.log(`✅ Tauri drag-drop ready`);
      } catch (e) {
        console.warn(`⚠️ Could not setup "${eventName}" listener:`, e);
      }
    }

    // Listen for hotkey events from Tauri backend
    await listen("trigger-search-focus", () => {
      console.log("🔍 Received trigger-search-focus event");
      searchInputFocused = true;
    });

    await listen("trigger-search-toggle", () => {
      console.log("🔍 Received trigger-search-toggle event");
      if (searchInputFocused && searchQuery.trim()) {
        // Search is open with text - clear it
        searchQuery = "";
      } else if (searchInputFocused) {
        // Search is open but empty - close it
        searchInputFocused = false;
      } else {
        // Search is closed - open it
        searchInputFocused = true;
      }
    });

    // Restore window position and size BEFORE showing window
    const mainWindow = getCurrentWindow();
    const savedWindowState = await loadWindowState();
    if (savedWindowState) {
      try {
        console.log("🪟 Restoring window state (logical coords):", savedWindowState);
        
        // Restore using logical coordinates directly (no conversion needed)
        const validatedWidth = Math.max(savedWindowState.width, 400);
        const validatedHeight = Math.max(savedWindowState.height, 300);
        
        console.log("📏 Restoring size:", validatedWidth, "x", validatedHeight, "at", savedWindowState.x, ",", savedWindowState.y);
        
        // Set position and size while window is still hidden using logical coordinates
        await mainWindow.setPosition(new LogicalPosition(savedWindowState.x, savedWindowState.y));
        await mainWindow.setSize(new LogicalSize(validatedWidth, validatedHeight));
        console.log("✅ Window state restored");
      } catch (e) {
        console.warn("⚠️ Could not restore window state:", e);
      }
    }
    
    // Now show the window (it should already be visible, but ensure it)
    try {
      await mainWindow.show();
      await mainWindow.setFocus();
    } catch (e) {
      console.log("Window already visible or cannot control visibility");
    }

    // Listen for window resize and move events to save state
    const saveCurrentWindowState = async () => {
      try {
        // Get both physical and logical to compare
        const physicalPos = await mainWindow.outerPosition();
        const physicalSize = await mainWindow.outerSize();
        const scaleFactor = await mainWindow.scaleFactor();
        
        // Convert physical to logical
        const logicalX = Math.round(physicalPos.x / scaleFactor);
        const logicalY = Math.round(physicalPos.y / scaleFactor);
        const logicalWidth = Math.round(physicalSize.width / scaleFactor);
        const logicalHeight = Math.round(physicalSize.height / scaleFactor);
        
        // Save as logical coordinates
        const validatedWidth = Math.max(logicalWidth, 400);
        const validatedHeight = Math.max(logicalHeight, 300);
        
        await saveWindowState({
          x: logicalX,
          y: logicalY,
          width: validatedWidth,
          height: validatedHeight,
        });
      } catch (e) {
        // Silent fail
      }
    };

    // Debounced save function
    const debouncedSaveWindowState = () => {
      if (saveTimeout !== null) {
        clearTimeout(saveTimeout);
      }
      saveTimeout = setTimeout(saveCurrentWindowState, 500) as unknown as number;
    };

    // Listen to window events using both Tauri events AND browser events
    
    // Try Tauri events
    try {
      unlistenResize = await mainWindow.onResized((size) => {
        debouncedSaveWindowState();
      });
      unlistenMove = await mainWindow.onMoved((position) => {
        debouncedSaveWindowState();
      });
    } catch (e) {
      // Silent fail
    }

    // Also use browser window resize event as backup
    browserResizeHandler = () => {
      debouncedSaveWindowState();
    };
    window.addEventListener("resize", browserResizeHandler);

    // Save on window blur (when app loses focus)
    blurHandler = () => {
      saveCurrentWindowState();
    };
    window.addEventListener("blur", blurHandler);

    // Save on beforeunload (when closing)
    beforeUnloadHandler = () => {
      saveCurrentWindowState();
    };
    window.addEventListener("beforeunload", beforeUnloadHandler);
  });

  // Cleanup on unmount
  onDestroy(() => {
    if (unlistenResize) unlistenResize();
    if (unlistenMove) unlistenMove();
    if (browserResizeHandler) {
      window.removeEventListener("resize", browserResizeHandler);
    }
    if (blurHandler) {
      window.removeEventListener("blur", blurHandler);
    }
    if (beforeUnloadHandler) {
      window.removeEventListener("beforeunload", beforeUnloadHandler);
    }
    if (saveTimeout !== null) {
      clearTimeout(saveTimeout);
    }
    endReorderDragSession();
  });

  onDestroy(() => {
    removeContextMenuOutsideListener();
  });

  function onResize() {
    windowWidth = window.innerWidth;
    updateEffectiveSize();
    if (expandedAppId) {
      positionChildMenu();
    }
  }

  function updateEffectiveSize() {
    // compute overall grid width at nominal iconSize:
    // Each column width = iconSize (we use max-content but images are capped to iconSize)
    const overallGridWidth = gridColumns * iconSize + (gridColumns - 1) * iconPadding;
    const requiredWidth = marginMin * 2 + overallGridWidth;
    if (windowWidth < requiredWidth) {
      // shrink proportionally so the grid fits between margins, but don't go below 48
      const availableForGrid = Math.max(0, windowWidth - marginMin * 2);
      const perCol = Math.floor((availableForGrid - (gridColumns - 1) * iconPadding) / gridColumns);
      effectiveIconSize = Math.max(48, perCol);
    } else {
      effectiveIconSize = iconSize;
    }
    // update text size when icon size changes
    updateEffectiveTextSize();
  }

  // Recalculate if key settings change
  $: if (iconSize || gridColumns || iconPadding || marginMin) {
    updateEffectiveSize();
  }

  function updateEffectiveTextSize() {
    // textSize is stored in px. The user requested a minimum of 8pt.
    // Convert 8pt to px: 1pt = 1/72in, 1px = 1/96in => 1pt = 96/72 px = 1.333px
    // 8pt = 8 * 96 / 72 = 10.666... px -> round up to 11px as minimum.
    const minTextPx = 11;

    if (iconSize <= 0) {
      effectiveTextSize = Math.max(minTextPx, textSize);
      return;
    }

    const scale = effectiveIconSize / iconSize;
    const computed = Math.max(minTextPx, Math.floor(textSize * scale));
    effectiveTextSize = computed;
  }

  // Recalculate text size when the maximum textSize changes
  $: if (textSize) {
    updateEffectiveTextSize();
  }

  // compute a slightly lighter background for the tray and set CSS variables on the root
  function clamp(v: number, a: number, b: number) {
    return Math.min(b, Math.max(a, v));
  }

  function hexToRgb(hex: string) {
    const h = hex.replace('#', '');
    const bigint = parseInt(h.length === 3 ? h.split('').map(c => c + c).join('') : h, 16);
    return {
      r: (bigint >> 16) & 255,
      g: (bigint >> 8) & 255,
      b: bigint & 255,
    };
  }

  function rgbToHex(r: number, g: number, b: number) {
    return (
      '#' +
      [r, g, b]
        .map((n) => {
          const s = clamp(Math.round(n), 0, 255).toString(16);
          return s.length === 1 ? '0' + s : s;
        })
        .join('')
    );
  }

  function lightenHex(hex: string, percent: number) {
    try {
      const { r, g, b } = hexToRgb(hex);
      const nr = r + (255 - r) * percent;
      const ng = g + (255 - g) * percent;
      const nb = b + (255 - b) * percent;
      return rgbToHex(nr, ng, nb);
    } catch (e) {
      return hex;
    }
  }

  function luminance(hex: string) {
    const { r, g, b } = hexToRgb(hex);
    // relative luminance (sRGB)
    const srgb = [r, g, b].map((v) => {
      const s = v / 255;
      return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * srgb[0] + 0.7152 * srgb[1] + 0.0722 * srgb[2];
  }

  function updateIconRadius() {
    // set CSS variable for icon radius
    try {
      const root = document.documentElement;
      root.style.setProperty('--icon-radius', `${appIconRadius}px`);
    } catch (e) {
      // noop during SSR or if document is not available
    }
  }

  // react to changes in icon radius
  $: if (appIconRadius) updateIconRadius();

  // App reordering with svelte-dnd-action
  const flipDurationMs = 200;

  function handleDndConsider(e: CustomEvent) {
    const detail = e.detail;
    const trigger = detail?.info?.trigger;
    const source = detail?.info?.source;
    const triggerId = detail?.info?.id;

    if (trigger === TRIGGERS.DRAG_STARTED && source === SOURCES.POINTER && triggerId) {
      reorderDragSourceId = triggerId;
      startTrackingReorderPointer();
    }

    if (trigger === TRIGGERS.DRAGGED_LEFT_ALL || trigger === TRIGGERS.DROPPED_OUTSIDE_OF_ANY) {
      endReorderDragSession();
    }

    if (!reorderHoldCandidateId) {
      filteredApps = detail.items;
    }
  }

  async function handleDndFinalize(e: CustomEvent) {
    const draggedId = reorderDragSourceId;
    const parentId = reorderChildReadyId;
    const shouldConvertToChild = !!(draggedId && parentId && draggedId !== parentId);
    const newItems = e.detail.items;
    const droppedInsideDeadzone = !!reorderHoldCandidateId && !shouldConvertToChild;

    endReorderDragSession();

    if (shouldConvertToChild && draggedId && parentId) {
      await convertExistingAppToChild(draggedId, parentId);
      return;
    }

    if (droppedInsideDeadzone) {
      // Keep the existing order so the drag effectively snaps back in the deadzone
      filteredApps = [...filteredApps];
      return;
    }

    filteredApps = newItems;
    
    // Save the new order to Airtable
    const newOrder = filteredApps.map(app => app.id);
    appOrder = newOrder;
    
    if (selectedUserId) {
      try {
        await saveAppOrder(selectedUserId, newOrder);
        successMessage = "Apps reordered";
        setTimeout(() => {
          successMessage = null;
        }, 15000);
      } catch (err) {
        error = "Failed to save app order";
        setTimeout(() => {
          error = null;
        }, 3000);
      }
    }
  }

  async function handleDragOver(e: Event) {
    const dragEvent = e as DragEvent;
    dragEvent.preventDefault();
    dragEvent.stopPropagation();
    dragActive = true;
    externalFileDragActive = isExternalFileDrag(dragEvent);
    console.log("🖱️ Drag over detected");
  }

  async function handleDragLeave(e: Event) {
    const dragEvent = e as DragEvent;
    dragEvent.preventDefault();
    dragEvent.stopPropagation();
    dragActive = false;
    if (!dragEvent.relatedTarget) {
      externalFileDragActive = false;
      resetChildDropState();
    }
    console.log("🖱️ Drag leave detected");
  }

  async function handleDrop(e: Event) {
    const dragEvent = e as DragEvent;
    dragEvent.preventDefault();
    dragEvent.stopPropagation();

    dragActive = false;
    externalFileDragActive = false;

    const isChildDetachDrag = !!childMenuDragChildId && !!childMenuDragParentId && dragEvent.dataTransfer && Array.from(dragEvent.dataTransfer.types || []).includes(CHILD_DETACH_MIME);
    if (isChildDetachDrag) {
      const dropTarget = dragEvent.target as Node | null;
      const dropInsideChildMenu = dropTarget ? (childMenuRef?.contains(dropTarget) ?? false) : false;
      if (!dropInsideChildMenu && childMenuDragChildId) {
        await detachChildFromParent(childMenuDragChildId);
      }
      pendingExternalDropParentId = null;
      resetChildDropState();
      endChildMenuDrag();
      return;
    }

    const parentIdForDrop = dragChildParentId ?? dropTargetParentId ?? null;
    pendingExternalDropParentId = parentIdForDrop;
    resetChildDropState();

    const files = dragEvent.dataTransfer?.files;
    if (!files || files.length === 0) {
      pendingExternalDropParentId = null;
      return;
    }

    const appPaths: string[] = [];

    // Process each dropped file
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const fileObj = file as any;
      let filePath = fileObj.path || fileObj.webkitRelativePath || file.name;
      
      if (!filePath) {
        continue;
      }

      // Get file extension
      const ext = filePath.split('.').pop()?.toLowerCase();
      
      // Check if it's an icon file and edit pane is open
      if (['png', 'ico', 'icns'].includes(ext || '')) {
        if (showEditPane && editingApp) {
          console.log("🎨 Icon file dropped during edit - updating app icon");
          await handleEditPaneDrop(dragEvent);
          continue;
        } else {
          console.log("⏭️ Icon file dropped but edit pane not open - ignoring");
          continue;
        }
      }

      // Check if it's an app or shortcut
      if (!['app', 'lnk', 'exe'].includes(ext || '')) {
        console.log("⏭️ Ignoring non-app file:", filePath);
        continue;
      }

      appPaths.push(filePath);
    }

    if (appPaths.length > 0) {
      const dropKey = makeDropKey(appPaths);
      if (shouldSkipDuplicateDrop("dom", dropKey)) {
        console.log("⏭️ Skipping DOM drop (already handled by Tauri)");
        pendingExternalDropParentId = null;
        return;
      }
      await processAppDropPaths(appPaths, parentIdForDrop);
      recordDropHandled("dom", dropKey);
    }

    pendingExternalDropParentId = null;
  }

  async function handleTauriFileDrop(paths: string[]) {
    console.log(`📦 Tauri drop with ${paths.length} file(s)...`);
    dragActive = false; // Reset drag state after drop
    editPaneDragActive = false; // Reset edit pane drag state after drop
    externalFileDragActive = false;
    const parentIdForDrop = pendingExternalDropParentId ?? dragChildParentId ?? dropTargetParentId ?? null;
    pendingExternalDropParentId = null;
    resetChildDropState();
    
    if (!Array.isArray(paths) || paths.length === 0) {
      console.warn("⚠️ No paths in drop");
      return;
    }

    // Check if edit pane is actually open in the DOM
    const editPaneOverlay = document.querySelector('.tray-overlay[aria-label="Close edit pane"]');
    const isEditPaneOpen = editPaneOverlay !== null;
    
    console.log(`Edit pane open: ${isEditPaneOpen}`);

    const appPaths: string[] = [];

    for (const filePath of paths) {
      try {
        // Extract file extension
        const ext = filePath.split('.').pop()?.toLowerCase();
        
        console.log(`Processing file: ${filePath}, ext: ${ext}`);
        
        // If it's an icon file and edit pane is open, route to edit pane handler
        if (['png', 'ico', 'icns'].includes(ext || '')) {
          if (isEditPaneOpen && editingApp) {
            console.log("🎨 Icon file dropped (Tauri) during edit - updating app icon");
            try {
              // Load the icon directly from the file path
              const iconDataUrl = await loadIconDataUrl(filePath);
              editAppIconDataUrl = iconDataUrl;
              editAppIconPath = filePath;
              console.log("✅ Icon loaded from Tauri drop");
            } catch (err) {
              console.error("❌ Failed to load icon from Tauri drop:", err);
              error = `Failed to load icon: ${err instanceof Error ? err.message : 'Unknown error'}`;
              setTimeout(() => {
                error = null;
              }, 3000);
            }
            continue;
          } else {
            console.log("⏭️ Icon file dropped (Tauri) but edit pane not open - ignoring");
            continue;
          }
        }
        
        // Filter out non-app files
        if (!['app', 'lnk', 'exe'].includes(ext || '')) {
          console.log("⏭️ Ignoring non-app file (Tauri):", filePath);
          continue;
        }
        appPaths.push(filePath);
      } catch (e) {
        const errorMsg = e instanceof Error ? e.message : String(e);
        console.error("❌", errorMsg);
        error = `Failed to add app: ${errorMsg}`;
        setTimeout(() => {
          error = null;
        }, 5000);
      }
    }

    if (appPaths.length > 0) {
      const dropKey = makeDropKey(appPaths);
      if (shouldSkipDuplicateDrop("tauri", dropKey)) {
        console.log("⏭️ Skipping Tauri drop (already handled by DOM)");
        return;
      }
      await processAppDropPaths(appPaths, parentIdForDrop);
      recordDropHandled("tauri", dropKey);
    }
  }

  async function processAppDropPaths(paths: string[], parentIdForDrop: string | null) {
    if (!paths || paths.length === 0) {
      return;
    }

    if (!selectedUserId) {
      error = "No user selected. Please select a user to add apps.";
      setTimeout(() => {
        error = null;
      }, 3000);
      return;
    }

    const parentApp = parentIdForDrop ? apps.find((app) => app.id === parentIdForDrop) : null;
    let canAttachToParent = false;
    if (parentIdForDrop && parentApp) {
      canAttachToParent = ensureUserCanLink(null, parentApp, `You must own ${parentApp.Name || "that app"} to add children.`);
    }

    for (const filePath of paths) {
      try {
        error = null;
        console.log("🔍 Processing app:", filePath);
        const appInfo = await invoke<any>("get_app_info", { path: filePath });
        console.log("📱 App info received:", appInfo);

        const appExists = apps.some(
          (app) => app.Name === appInfo.name || app.Target === appInfo.target
        );

        if (appExists) {
          successMessage = `${appInfo.name} already exists`;
          console.log("⚠️ App already exists:", appInfo.name);
          setTimeout(() => {
            successMessage = null;
          }, 15000);
          continue;
        }

        let iconDataUrl = "";
        if (appInfo.icon) {
          try {
            iconDataUrl = await loadIconDataUrl(appInfo.icon);
            console.log("✅ Icon loaded, length:", iconDataUrl.length);
          } catch (e) {
            console.warn("Could not load icon data URL:", e);
          }
        }

        try {
          const airtableApp = await createAirtableApp({
            Name: appInfo.name,
            Target: appInfo.target,
            Type: appInfo.app_type || "mac app",
            Enabled: true,
            Icon: iconDataUrl,
            Ownership: "Private",
            Owner: [selectedUserId],
            Parent: canAttachToParent && parentIdForDrop ? [parentIdForDrop] : undefined,
          }, selectedUserId);

          console.log("✅ App created in Airtable:", airtableApp);

          if (iconDataUrl) {
            await saveIconData(appInfo.target, iconDataUrl);
            console.log("✅ Icon data cached locally for:", appInfo.target);
          }

          await refreshApps();

          if (canAttachToParent && parentIdForDrop && parentApp) {
            successMessage = `Added child to ${parentApp.Name}`;
          } else {
            successMessage = `Added: ${appInfo.name}`;
          }
          console.log("✅", appInfo.name);
        } catch (createError) {
          const createErrorMsg = createError instanceof Error ? createError.message : String(createError);
          console.error("❌ Failed to create app in Airtable:", createErrorMsg);
          error = `Failed to sync app to cloud: ${createErrorMsg}`;
          setTimeout(() => {
            error = null;
          }, 5000);
          continue;
        }

        setTimeout(() => {
          successMessage = null;
        }, 15000);
      } catch (e) {
        const errorMsg = e instanceof Error ? e.message : String(e);
        console.error("❌", errorMsg);
        error = `Failed to add app: ${errorMsg}`;
        setTimeout(() => {
          error = null;
        }, 5000);
      }
    }
  }

  async function convertExistingAppToChild(childId: string, parentId: string) {
    if (!childId || !parentId || childId === parentId) {
      return;
    }

    const childApp = apps.find((app) => app.id === childId);
    const parentApp = apps.find((app) => app.id === parentId);

    if (!childApp || !parentApp) {
      return;
    }
    if (!ensureUserCanLink(childApp, parentApp)) {
      return;
    }

    try {
      await updateAirtableApp(childId, {
        Parent: [parentId],
      });

      const childName = childApp.Name || "App";
      const parentName = parentApp?.Name || "parent";
      successMessage = `${childName} moved under ${parentName}`;
      setTimeout(() => {
        successMessage = null;
      }, 15000);

      const sanitizedOrder = appOrder.filter((id) => id !== childId);
      if (sanitizedOrder.length !== appOrder.length) {
        appOrder = sanitizedOrder;
        if (selectedUserId) {
          try {
            await saveAppOrder(selectedUserId, sanitizedOrder);
          } catch (orderErr) {
            console.warn("⚠️ Failed to update app order after reparenting:", orderErr);
          }
        }
      }

      await refreshApps();
    } catch (err) {
      console.error("❌ Failed to convert app to child:", err);
      error = `Failed to move app: ${err instanceof Error ? err.message : err}`;
      setTimeout(() => {
        error = null;
      }, 5000);
    }
  }

  async function detachChildFromParent(childId: string) {
    const childApp = apps.find((app) => app.id === childId);
    if (!childApp) {
      return;
    }

    try {
      await updateAirtableApp(childId, {
        Parent: [],
      });

      const childName = childApp.Name || "App";
      successMessage = `${childName} moved to the main grid`;
      setTimeout(() => {
        successMessage = null;
      }, 15000);

      if (!appOrder.includes(childId)) {
        const nextOrder = [...appOrder, childId];
        appOrder = nextOrder;
        if (selectedUserId) {
          try {
            await saveAppOrder(selectedUserId, nextOrder);
          } catch (orderErr) {
            console.warn("⚠️ Failed to add detached child back to order:", orderErr);
          }
        }
      }

      await refreshApps();
    } catch (err) {
      console.error("❌ Failed to detach child app:", err);
      error = `Failed to detach app: ${err instanceof Error ? err.message : err}`;
      setTimeout(() => {
        error = null;
      }, 5000);
    }
  }

  async function handleUnlinkFromParent(app: any) {
    if (!app?.id) {
      return;
    }

    const parentApp = contextMenuLinkedParent ?? findParentApp(app);
    if (!parentApp) {
      error = "Could not find a parent for this app.";
      setTimeout(() => {
        error = null;
      }, 5000);
      return;
    }

    if (!ensureUserCanLink(app, parentApp, `You must own ${parentApp.Name || "the parent"} and ${app.Name || "the child"} to unlink.`)) {
      return;
    }

    dismissContextMenu();
    await detachChildFromParent(app.id);
  }

  // Debug: log whenever apps change
  $: if (apps && apps.length > 0) {
    const parsecApp = apps.find(a => a.Name === 'Parsec');
    if (parsecApp) {
      console.log("🔎 Parsec app state:", {
        Name: parsecApp.Name,
        Target: parsecApp.Target,
        hasIcon: !!parsecApp.Icon,
        iconLength: parsecApp.Icon?.length,
        icon0Path: parsecApp.Icon?.[0]?.path,
        icon0Url: parsecApp.Icon?.[0]?.url ? '(exists)' : '(none)',
        icon0IconDataUrl: parsecApp.Icon?.[0]?.iconDataUrl ? `(${parsecApp.Icon[0].iconDataUrl.substring(0, 50)}...)` : '(none)'
      });
    }
  }

  // User management functions
  // Filter users based on search query
  $: filteredUsers = users.filter((user) => {
    if (!userSearchQuery) return true;
    const name = user.Name || '';
    return name.toLowerCase().includes(userSearchQuery.toLowerCase());
  });

  async function fetchUsers() {
    try {
      const result = await invoke("fetch_users", { apiKey: AIRTABLE_API_KEY });
      users = Array.isArray(result) ? result : [];
      console.log("👥 Fetched users:", users);
    } catch (e) {
      console.error("Failed to fetch users:", e);
      error = "Failed to load users";
      setTimeout(() => {
        error = null;
      }, 3000);
    }
  }

  async function openUserDialog() {
    showUserDialog = true;
    await fetchUsers();
  }

  function closeUserDialog() {
    showUserDialog = false;
    newUserName = "";
    creatingUser = false;
    userSearchQuery = "";
  }

  async function selectUser(userId: string, userName: string) {
    selectedUserId = userId;
    selectedUserName = userName;
    
    // Find the full user record
    const user = users.find((u) => u.id === userId);
    selectedUser = user;
    
    // Load settings from the user record
    if (user && user.UserSettings) {
      const settings = await loadSettingsFromUser(user.UserSettings);
      // Apply settings
      iconSize = settings.iconSize;
      iconPadding = settings.iconPadding;
      gridColumns = settings.gridColumns;
      textSize = settings.textSize;
      marginMin = settings.marginMin;
      theme = settings.theme ?? theme;
      appIconRadius = settings.appIconRadius;
      newAppButtonLocation = settings.newAppButtonLocation;
      console.log("🧩 Settings applied from user record:", settings);
      // Load the theme
      loadTheme(theme);
    }
    
    // Load app order for this user
    try {
      appOrder = await loadAppOrder(userId);
      console.log("🎯 App order loaded for user:", appOrder);
    } catch (err) {
      console.warn("⚠️ Failed to load app order:", err);
      appOrder = [];
    }
    
    await saveSelectedUser(userId);
    closeUserDialog();
    // Refresh apps with the new user context
    await refreshApps();
  }

  async function handleCreateUser() {
    if (!newUserName.trim()) {
      error = "Please enter a name";
      setTimeout(() => {
        error = null;
      }, 3000);
      return;
    }

    try {
      const newUser = await invoke("create_user", { name: newUserName.trim(), apiKey: AIRTABLE_API_KEY });
      console.log("✅ Created user:", newUser);
      await selectUser((newUser as any).id, (newUser as any).Name);
    } catch (e) {
      console.error("Failed to create user:", e);
      error = "Failed to create user";
      setTimeout(() => {
        error = null;
      }, 3000);
    }
  }

  // Determine what's not rendering correctly and flag it
  onDestroy(() => {
    window.removeEventListener("resize", onResize);
    const container = document.querySelector(".container");
    if (container) {
      container.removeEventListener("dragover", handleDragOver as EventListener);
      container.removeEventListener("dragleave", handleDragLeave as EventListener);
      container.removeEventListener("drop", handleDrop as EventListener);
    }
    document.removeEventListener("dragover", handleDragOver as EventListener);
    document.removeEventListener("dragleave", handleDragLeave as EventListener);
    document.removeEventListener("drop", handleDrop as EventListener);
    removeChildMenuOutsideListener();
  });
</script>

<!-- Full-screen drop zone to catch file drops -->
{#if !showEditPane}
  <div
    class="drop-zone"
    on:dragover={(e) => {
      e.preventDefault();
      e.stopPropagation();
      console.log("🎯 Drop zone dragover");
      dragActive = true;
    }}
    on:dragleave={(e) => {
      e.preventDefault();
      e.stopPropagation();
      console.log("🎯 Drop zone dragleave");
      dragActive = false;
    }}
    on:drop={(e) => {
      console.log("🎯 Drop zone drop event fired!");
      handleDrop(e);
    }}
    role="button"
    tabindex="0"
  ></div>
{/if}

<div class="app-container" role="main" on:dblclick={() => { if (searchQuery.trim()) { searchQuery = ""; } }}>
  <div class="title-section">
    {#if searchInputFocused}
      <div class="search-bar-fullwidth">
        <Search size={18} />
        <input
          type="text"
          placeholder="Search apps..."
          bind:value={searchQuery}
          on:blur={() => {
            if (!searchQuery.trim()) {
              searchInputFocused = false;
            }
          }}
          on:keydown={(e) => {
            if (e.key === 'Escape') {
              searchQuery = "";
              searchInputFocused = false;
            } else if (e.key === 'Enter') {
              // If exactly one app matches the search, launch it
              if (filteredApps.length === 1) {
                e.preventDefault();
                openApp(filteredApps[0].Target, filteredApps[0].type_field);
              }
            }
          }}
          bind:this={searchInputRef}
          class="search-input"
        />
        {#if searchQuery}
          <button class="clear-search" on:click={() => searchQuery = ""} aria-label="Clear search">
            <X size={20} />
          </button>
        {/if}
      </div>
    {:else}
      <button class="title-button" on:click={() => searchInputFocused = true} aria-label="Click to search apps">Atlas Launcher</button>
      <button class="search-icon-btn" on:click={() => searchInputFocused = true} aria-label="Search apps">
        <Search size={28} />
      </button>
    {/if}
  </div>

  {#if error}
    <p class="error">{error}</p>
  {/if}

  <div class="apps-section">
      <div class="section-header">
        <h2>Apps</h2>
        <div class="section-header-actions">
          {#if newAppButtonLocation === "titlebar"}
            <button class="btn-pill-open" on:click={openCreatePane} aria-label="Add new app">
              New App +
            </button>
          {/if}
          <button class="collapse-btn" on:click={() => appsExpanded = !appsExpanded} aria-label={appsExpanded ? "Collapse" : "Expand"}>
            {#if appsExpanded}
              <ChevronDown size={20} />
            {:else}
              <ChevronUp size={20} />
            {/if}
          </button>
        </div>
      </div>
      
      {#if appsExpanded}
      <main class="container" class:drag-active={dragActive}
        on:dragover={(e) => {
          if (showEditPane) return;
          e.preventDefault();
          e.stopPropagation();
          console.log("🎯 Main container dragover");
          dragActive = true;
        }}
        on:dragleave={(e) => {
          if (showEditPane) return;
          e.preventDefault();
          e.stopPropagation();
          console.log("🎯 Main container dragleave");
          dragActive = false;
        }}
        on:drop={(e) => {
          if (showEditPane) return;
          e.preventDefault();
          e.stopPropagation();
          console.log("🎯 Main container drop");
          handleDrop(e);
        }}
      >
        {#if loading}
          <p>Loading apps...</p>
        {:else}
        <!-- APP GRID -->
        <div
          class="grid"
          use:dndzone={{
            items: filteredApps,
            flipDurationMs,
            type: "apps",
            dropTargetStyle: {},
            transformDraggedElement: (el) => {
              if (!el) return;
              el.style.border = 'none';
              el.style.outline = 'none';
              el.style.setProperty('--icon-size', `${effectiveIconSize}px`);

              const iconContainer = el.querySelector<HTMLElement>('.icon-container');
              if (iconContainer) {
                iconContainer.style.width = `${effectiveIconSize}px`;
                iconContainer.style.height = `${effectiveIconSize}px`;
                iconContainer.style.overflow = 'hidden';
                iconContainer.style.borderRadius = `${appIconRadius}px`;
              }

              const img = el.querySelector<HTMLImageElement>('img');
              if (img) {
                img.style.width = `${effectiveIconSize}px`;
                img.style.height = `${effectiveIconSize}px`;
              }
            }
          }}
          on:consider={handleDndConsider}
          on:finalize={handleDndFinalize}
          style="
            /* Auto-fit columns based on icon size */
            grid-template-columns: repeat(auto-fit, {effectiveIconSize}px);
            gap: {iconPadding}px;
            --icon-size: {effectiveIconSize}px;
            --icon-radius: {appIconRadius}px;
          "
        >
      {#each filteredApps as app, index (app.id)}
        <!-- Single wrapper for animation - decides child vs parent rendering based on expanded state -->
        <div 
          class="app-with-insert-indicator"
          animate:flip={{duration: flipDurationMs}}
        >
          <!-- NORMAL APP RENDERING -->
            <button
              type="button"
              class="icon-wrapper"
              class:no-icon={!app.Icon || !app.Icon[0]}
              class:is-public-not-added={app.ownership === "Public" && selectedUser && !(app.owner?.includes(selectedUser.id) || selectedUser.PublicApps?.includes(app.id))}
              class:single-search-result={filteredApps.length === 1 && searchQuery.trim() !== ""}
              class:has-children={app.Children && Array.isArray(app.Children) && app.Children.length > 0}
              class:child-menu-open={expandedAppId === app.id}
              class:child-drop-pending={combinedChildHoverCandidateId === app.id}
              class:child-drop-ready={combinedChildReadyParentId === app.id}
              data-app-button={app.id}
              on:click={async (event: MouseEvent) => {
                // Debug logging
                console.log("🖱️ Clicked app:", app.Name);
                console.log("   Children field:", app.Children);
                console.log("   Is array?", Array.isArray(app.Children));
                console.log("   Length:", app.Children?.length);
                
                // If app has children, expand it instead of launching
                if (app.Children && Array.isArray(app.Children) && app.Children.length > 0) {
                  if (expandedAppId === app.id) {
                    console.log("   🚀 Launching parent (menu already open)");
                    closeChildMenu();
                    openApp(app.Target, app.type_field);
                  } else {
                    console.log("   ✅ Opening child menu");
                    await openChildMenu(app, event.currentTarget as HTMLElement);
                  }
                } else {
                  console.log("   🚀 Launching app");
                  closeChildMenu();
                  openApp(app.Target, app.type_field);
                }
              }}
              on:contextmenu={(e) => handleContextMenu(e, app)}
              aria-label="{app.Children && Array.isArray(app.Children) && app.Children.length > 0 ? 'Show child apps for' : 'Launch'} {app.Name}"
              aria-haspopup={app.Children && Array.isArray(app.Children) && app.Children.length > 0 ? 'menu' : undefined}
              aria-expanded={app.Children && Array.isArray(app.Children) && app.Children.length > 0 ? expandedAppId === app.id : undefined}
              on:dragenter={(event) => handlePotentialChildDropEnter(event, app.id)}
              on:dragover={(event) => handlePotentialChildDropOver(event, app.id)}
              on:dragleave={(event) => handlePotentialChildDropLeave(event, app.id)}
              on:drop={(event) => {
                event.preventDefault();
                event.stopPropagation();
                if (dragChildParentId === app.id) {
                  dropTargetParentId = app.id;
                  pendingExternalDropParentId = app.id;
                }
                handleDrop(event);
              }}
            >
            <div class="icon-container">
              {#if app.Icon && app.Icon[0] && (app.Icon[0].url || app.Icon[0].iconDataUrl)}
                {#if app.Icon[0].url}
                  <img
                    src={app.Icon[0].url}
                    alt=""
                    crossorigin="anonymous"
                    style="--icon-zoom: {iconZoomFactors[app.id] || 0};"
                    on:load={(e) => {
                      const zoom = detectTransparentMargins(e.currentTarget as HTMLImageElement);
                      iconZoomFactors = { ...iconZoomFactors, [app.id]: zoom };
                    }}
                    on:error={() => console.error(`❌ Failed to load image for ${app.Name} from URL: ${app.Icon[0].url}`)}
                  />
                {:else if app.Icon[0].iconDataUrl}
                  <img
                    src={(() => {
                      console.log(`🖼️ Rendering image for ${app.Name}`);
                      console.log(`   iconDataUrl length: ${app.Icon[0].iconDataUrl.length}`);
                      console.log(`   iconDataUrl preview: ${app.Icon[0].iconDataUrl.substring(0, 100)}`);
                      const blobUrl = dataUrlToBlobUrl(app.Icon[0].iconDataUrl);
                      console.log(`   Converted to blob URL: ${blobUrl}`);
                      return blobUrl;
                    })()}
                    alt=""
                    crossorigin="anonymous"
                    style="--icon-zoom: {iconZoomFactors[app.id] || 0};"
                    on:load={(e) => {
                      console.log(`✅ Image loaded successfully for ${app.Name}`);
                      const zoom = detectTransparentMargins(e.currentTarget as HTMLImageElement);
                      iconZoomFactors = { ...iconZoomFactors, [app.id]: zoom };
                    }}
                    on:error={(e) => {
                      console.error(`❌ Failed to load image for ${app.Name}`);
                      console.error(`   Original iconDataUrl type: ${app.Icon[0].iconDataUrl.startsWith('blob:') ? 'blob' : app.Icon[0].iconDataUrl.startsWith('data:') ? 'data' : 'unknown'}`);
                      console.error(`   Original iconDataUrl preview: ${app.Icon[0].iconDataUrl.substring(0, 100)}`);
                      console.error(`   Error event:`, e);
                    }}
                  />
                {/if}
              {:else}
                <div class="placeholder-icon" style="width:{effectiveIconSize}px; height:{effectiveIconSize}px;">
                  📦
                </div>
              {/if}
              
              {#if !searchActive && app.Children && Array.isArray(app.Children) && app.Children.length > 0}
                <div
                  class="child-folder-badge"
                  style="--child-badge-size:{Math.max(18, effectiveIconSize * 0.22)}px;"
                  aria-hidden="true"
                >
                  <FolderOpen size={Math.max(18, effectiveIconSize * 0.22)} />
                </div>
              {/if}
              
              <!-- Green overlay for public apps not yet added -->
              {#if app.ownership === "Public" && selectedUser && !(app.owner?.includes(selectedUser.id) || selectedUser.PublicApps?.includes(app.id))}
                <div class="public-app-overlay">
                  <div
                    class="add-public-app-btn"
                    role="button"
                    tabindex="0"
                    aria-label="Add to my public apps"
                    on:click|stopPropagation={async (e) => {
                      e.preventDefault();
                      await addPublicAppToUser(app.id);
                    }}
                    on:keydown|stopPropagation={async (e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        await addPublicAppToUser(app.id);
                      }
                    }}
                  >
                    <Plus size={20} />
                  </div>
                </div>
              {/if}
              {#if combinedChildReadyParentId === app.id}
                <div class="nest-overlay" aria-hidden="true">
                  <FolderPlus size={Math.max(24, effectiveIconSize * 0.4)} />
                </div>
              {/if}
            </div>
            
            <p style="font-size:{effectiveTextSize}px;">{app.Name}</p>
          </button>
        </div>
      {/each}
      
      <!-- Add New App Button (Inline) - only show in normal mode -->
      {#if newAppButtonLocation === "inline"}
        <button
          type="button"
          class="icon-wrapper add-new-button"
          on:click={openCreatePane}
          aria-label="Add new app"
          style="--add-button-size: max(28px, calc(var(--icon-size) * 0.4));"
        >
          <div class="add-new-icon">
            <Plus size={Math.max(14, effectiveIconSize * 0.2)} />
          </div>
          <p style="font-size:{effectiveTextSize}px; visibility: hidden;">Add New</p>
        </button>
      {/if}
        </div>
        {/if}
      </main>
      {/if}
      {#if expandedAppId && expandedChildApps.length > 0 && childMenuPosition}
        <div
          class="child-menu"
          bind:this={childMenuRef}
          style="top: {childMenuPosition.top}px; left: {childMenuPosition.left}px;"
          data-side={childMenuPosition.side}
          role="menu"
          tabindex="0"
          aria-label="Child apps for {expandedParentApp?.Name}"
          on:keydown={(e) => {
            if (e.key === 'Escape') closeChildMenu();
          }}
        >
          <div class="child-menu-header">
            <span>{expandedParentApp?.Name}</span>
            <button type="button" class="child-menu-close" on:click={closeChildMenu} aria-label="Close child menu">
              <X size={16} />
            </button>
          </div>
          <div class="child-menu-list">
            {#each expandedChildApps as child (child.id)}
              <button
                type="button"
                class="child-menu-item"
                on:click={() => {
                  openApp(child.Target, child.type_field);
                  closeChildMenu();
                }}
                on:contextmenu={(e) => handleContextMenu(e, child, expandedParentApp)}
                draggable={true}
                on:dragstart={(event) => startChildMenuDrag(event as DragEvent, child.id)}
                on:dragend={endChildMenuDrag}
                role="menuitem"
              >
                <span class="child-menu-item-icon">
                  {#if child.Icon && child.Icon[0] && (child.Icon[0].url || child.Icon[0].iconDataUrl)}
                    {#if child.Icon[0].url}
                      <img
                        src={child.Icon[0].url}
                        alt=""
                        crossorigin="anonymous"
                        style="--icon-zoom: {iconZoomFactors[child.id] || 0};"
                        on:load={(e) => {
                          const zoom = detectTransparentMargins(e.currentTarget as HTMLImageElement);
                          iconZoomFactors = { ...iconZoomFactors, [child.id]: zoom };
                        }}
                      />
                    {:else if child.Icon[0].iconDataUrl}
                      <img
                        src={dataUrlToBlobUrl(child.Icon[0].iconDataUrl)}
                        alt=""
                        crossorigin="anonymous"
                        style="--icon-zoom: {iconZoomFactors[child.id] || 0};"
                        on:load={(e) => {
                          const zoom = detectTransparentMargins(e.currentTarget as HTMLImageElement);
                          iconZoomFactors = { ...iconZoomFactors, [child.id]: zoom };
                        }}
                      />
                    {/if}
                  {:else}
                    <span class="child-menu-placeholder">📦</span>
                  {/if}
                </span>
                <span class="child-menu-item-label">{child.Name}</span>
              </button>
            {/each}
          </div>
        </div>
      {/if}
    </div>

  <!-- Context Menu -->
  {#if contextMenuTarget}
    <div
      class="context-menu"
      bind:this={contextMenuRef}
      style="left: {contextMenuX}px; top: {contextMenuY}px;"
      on:keydown={(e) => {
        if (e.key === 'Escape') dismissContextMenu();
      }}
      role="menu"
      tabindex="0"
    >
      {#if canShowUnlinkOption}
        <button
          class="context-menu-item unlink"
          on:click={(e) => {
            e.stopPropagation();
            handleUnlinkFromParent(contextMenuTarget);
          }}
          role="menuitem"
        >
          <Link2Off size={14} />
          <span>Unlink from Parent</span>
        </button>
      {/if}
      {#if contextMenuTarget.ownership === "Global" || (contextMenuTarget.ownership === "Public" && selectedUser && !contextMenuTarget.owner?.includes(selectedUser.id))}
        <!-- For Global apps or Public apps the user doesn't own, only show Hide option -->
        <button
          class="context-menu-item hide"
          on:click={(e) => {
            console.log("🙈 Hide button clicked");
            e.stopPropagation();
            hideApp(contextMenuTarget);
          }}
          role="menuitem"
        >
          <EyeOff size={14} />
          <span>Hide</span>
        </button>
      {:else}
        <!-- For Private apps and Public apps owned by the user, show Edit and Delete options -->
        <button
          class="context-menu-item edit"
          on:click={(e) => {
            console.log("✏️ Edit button clicked");
            e.stopPropagation();
            openEditPane(contextMenuTarget);
          }}
          role="menuitem"
        >
          <Edit size={14} />
          <span>Edit</span>
        </button>
        <button
          class="context-menu-item delete"
          on:click={(e) => {
            console.log("🗑️ Delete button clicked, event:", e);
            e.stopPropagation();
            console.log("📍 About to call deleteApp with:", contextMenuTarget);
            deleteApp(contextMenuTarget);
          }}
          role="menuitem"
        >
          <Trash2 size={14} />
          <span>Delete</span>
        </button>
      {/if}
      <div class="context-menu-meta" aria-hidden="true">
        Ownership: {contextMenuTarget?.ownership ?? 'Unknown'}
      </div>
    </div>
  {/if}

  <!-- Delete Confirmation Modal -->
  {#if confirmDeleteTarget}
    <div class="confirm-overlay" on:click={cancelDelete} on:keydown={(e) => { if (e.key === 'Escape') cancelDelete(); }} role="button" tabindex="0" aria-label="Cancel delete"></div>
    <div class="confirm-modal">
      <div class="confirm-content">
        <p class="confirm-message">Delete <strong>{confirmDeleteTarget.Name}</strong>?</p>
        <div class="confirm-buttons">
          <button class="btn-cancel" on:click={cancelDelete}>Cancel</button>
          <button class="btn-delete" on:click={confirmDelete}>Delete</button>
        </div>
      </div>
    </div>
  {/if}

  <!-- Footer -->
  <footer>
    <div class="footer-left">
      <span class="version">{version}</span>
      {#if successMessage}
        <span class="footer-separator">•</span>
        <span class="success-message">{successMessage}</span>
      {/if}
    </div>

    <div class="footer-controls">
      {#if selectedUserName}
        <button class="user-chip" on:click={openUserDialog} title="Switch user">
          <User size={16} />
          <span>{selectedUserName}</span>
        </button>
      {/if}
      <button class="refresh-btn" on:click={refreshApps} title="Refresh apps">
        <RotateCw size={20} />
      </button>
      <button class="settings-btn" on:click={() => (showSettings = !showSettings)} title="Settings">
        <Settings size={20} />
      </button>
    </div>
  </footer>

  <!-- Right-side vertical settings tray -->
  {#if showSettings}
    <div
      class="tray-overlay"
      on:click={() => (showSettings = false)}
      on:keydown={(e) => {
        if (e.key === 'Escape') showSettings = false;
      }}
      role="button"
      tabindex="0"
      aria-label="Close settings"
    ></div>
    <div class="settings-tray">
      <div class="settings-header">
        <h2>Settings</h2>
        <button class="close-btn" aria-label="Close settings" on:click={() => (showSettings = false)}>
          <X size={18} />
        </button>
      </div>
      <div class="settings-content">
        <div class="setting-item">
          <label for="theme">Theme</label>
          <select
            id="theme"
            bind:value={theme}
            on:change={() => {
              loadTheme(theme);
              persistSettings();
            }}
          >
            <option value="light">Light</option>
            <option value="dark">Dark</option>
            <option value="norge">Norge</option>
          </select>
        </div>

        <div class="setting-item">
          <label for="newAppButtonLocation">New App Button Location</label>
          <select
            id="newAppButtonLocation"
            bind:value={newAppButtonLocation}
            on:change={persistSettings}
          >
            <option value="inline">Inline with Apps</option>
            <option value="titlebar">Title Bar</option>
          </select>
        </div>

        <div class="setting-item">
          <label for="iconSize">Icon Size (max)</label>
          <div class="setting-row">
            <input
              id="iconSize"
              type="range"
              min="48"
              max="128"
              bind:value={iconSize}
              on:change={persistSettings}
            />
            <span class="value-display">{iconSize}px</span>
          </div>
        </div>

        <div class="setting-item">
          <label for="iconPadding">Icon Padding</label>
          <div class="setting-row">
            <input
              id="iconPadding"
              type="range"
              min="0"
              max="64"
              bind:value={iconPadding}
              on:change={persistSettings}
            />
            <span class="value-display">{iconPadding}px</span>
          </div>
        </div>

        <div class="setting-item">
          <label for="gridColumns">Columns</label>
          <div class="setting-row">
            <input
              id="gridColumns"
              type="range"
              min="1"
              max="8"
              bind:value={gridColumns}
              on:change={persistSettings}
            />
            <span class="value-display">{gridColumns}</span>
          </div>
        </div>

        <div class="setting-item">
          <label for="textSize">Text Size</label>
          <div class="setting-row">
            <input
              id="textSize"
              type="range"
              min="10"
              max="48"
              bind:value={textSize}
              on:change={persistSettings}
            />
            <span class="value-display">{textSize}px</span>
          </div>
        </div>

        <div class="setting-item">
          <label for="marginMin">Margin (min)</label>
          <div class="setting-row">
            <input
              id="marginMin"
              type="range"
              min="0"
              max="128"
              bind:value={marginMin}
              on:change={persistSettings}
            />
            <span class="value-display">{marginMin}px</span>
          </div>
        </div>

        <div class="setting-item">
          <label for="appIconRadius">App Icon Radius</label>
          <div class="setting-row">
            <input
              id="appIconRadius"
              type="range"
              min="0"
              max="64"
              bind:value={appIconRadius}
              on:change={persistSettings}
            />
            <span class="value-display">{appIconRadius}px</span>
          </div>
        </div>
      </div>
    </div>
  {/if}

  <!-- Edit Pane -->
  {#if showEditPane}
    <div
      class="tray-overlay"
      on:click={closeEditPane}
      on:keydown={(e) => {
        if (e.key === 'Escape') closeEditPane();
      }}
      on:dragover={(e) => {
        // Check if this is an icon file - if so, let it through to the icon zone
        const files = e.dataTransfer?.files;
        if (files && files.length > 0) {
          let hasIconFile = false;
          for (let i = 0; i < files.length; i++) {
            const filePath = (files[i] as any).path || (files[i] as any).webkitRelativePath || files[i].name;
            const ext = filePath?.split('.').pop()?.toLowerCase();
            if (['png', 'ico', 'icns'].includes(ext || '')) {
              hasIconFile = true;
              break;
            }
          }
          if (hasIconFile) {
            console.log("🎨 Overlay dragover - allowing icon file through");
            return; // Let it bubble to icon zone
          }
        }
        e.preventDefault();
        e.stopPropagation();
        console.log("🛡️ Overlay dragover - consumed");
      }}
      on:dragleave={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
      on:drop={(e) => {
        // Check if this is an icon file - if so, let it through to the icon zone
        const files = e.dataTransfer?.files;
        if (files && files.length > 0) {
          let hasIconFile = false;
          for (let i = 0; i < files.length; i++) {
            const filePath = (files[i] as any).path || (files[i] as any).webkitRelativePath || files[i].name;
            const ext = filePath?.split('.').pop()?.toLowerCase();
            if (['png', 'ico', 'icns'].includes(ext || '')) {
              hasIconFile = true;
              break;
            }
          }
          if (hasIconFile) {
            console.log("🎨 Overlay drop - allowing icon file through");
            return; // Let it bubble to icon zone
          }
        }
        e.preventDefault();
        e.stopPropagation();
        console.log("🛡️ Overlay drop - consumed");
      }}
      role="button"
      tabindex="0"
      aria-label="Close edit pane"
    ></div>
    <div class="settings-tray edit-pane"
      role="region"
      aria-label="Edit app pane"
    >
      {#if editPaneDragActive && showEditPane}
        <div class="edit-pane-drag-overlay">
          <p class="drag-message">📥 Drop Image File Here to Update Icon</p>
        </div>
      {/if}
      <div class="edit-pane-header">
        <h2>{editingApp ? 'Edit App' : 'Add New App'}</h2>
        <button class="close-btn" aria-label="Close edit pane" on:click={closeEditPane}>
          <X size={18} />
        </button>
      </div>
      <div class="settings-content edit-content">
        <!-- Name Field -->
        <div class="setting-item name-field">
          <input
            id="editName"
            class="edit-name-input"
            type="text"
            bind:value={editAppName}
            placeholder="App name"
          />
        </div>

        <!-- Icon Section -->
        <div class="edit-icon-section"
          on:dragover={(e) => {
            e.preventDefault();
            e.stopPropagation();
            console.log("🎨 Icon section dragover");
          }}
          on:dragleave={(e) => {
            e.preventDefault();
            e.stopPropagation();
            console.log("🎨 Icon section dragleave");
          }}
          on:drop={handleEditPaneDrop}
          on:drop={() => {
            editPaneDragActive = false;
          }}
          role="region"
          aria-label="Icon drop zone"
        >
          <div class="icon-preview">
            {#if editAppIconDataUrl}
              <img src={dataUrlToBlobUrl(editAppIconDataUrl)} alt="App icon preview" />
            {:else}
              <div class="placeholder-icon">📦</div>
            {/if}
          </div>
          <div class="icon-controls-wrapper">
            <div class="icon-controls">
              {#if editAppIconDataUrl}
                <button class="remove-icon-btn" on:click={removeEditIcon}>
                  <Trash2 size={12} /> Remove
                </button>
              {/if}
              <button class="upload-icon-btn" on:click={pickIconFile}>
                <Plus size={12} /> Upload
              </button>
            </div>
            <p class="drag-hint">or drag icon here</p>
          </div>
        </div>

        <!-- Target Field -->
        <div class="setting-item">
          <label for="editTarget">{editAppType === 'web' ? 'URL' : 'Target Path'}</label>
          <input
            id="editTarget"
            type="text"
            bind:value={editAppTarget}
            placeholder={editAppType === 'web' ? 'https://example.com' : 'Enter target path'}
          />
        </div>

        <!-- Type & Visibility Fields -->
        <div class="setting-row field-pair">
          <div class="setting-item compact">
            <label for="editType">App Type</label>
            <select
              id="editType"
              bind:value={editAppType}
              disabled={editingApp && editingApp.Parent && Array.isArray(editingApp.Parent) && editingApp.Parent.length > 0}
            >
              <option value="web">Web</option>
              <option value="mac app">Mac App</option>
              <option value="win app">Windows App</option>
              <option value="chrome">Chrome Extension</option>
            </select>
          </div>

          <div class="setting-item compact">
            <label for="editOwnership">Visibility</label>
            <select
              id="editOwnership"
              bind:value={editAppOwnership}
              disabled={editingApp && editingApp.Parent && Array.isArray(editingApp.Parent) && editingApp.Parent.length > 0}
            >
              <option value="Private">Private (Only Me)</option>
              <option value="Public">Public (Opt-in for Others)</option>
            </select>
          </div>
        </div>
        
        <!-- Child App Notice -->
        {#if editingApp && editingApp.Parent && Array.isArray(editingApp.Parent) && editingApp.Parent.length > 0}
          <div class="child-app-notice">
            <p>ℹ️ This is a child app. Type and Visibility are inherited from the parent and cannot be changed.</p>
          </div>
        {/if}

        <!-- Parent App Selector (always shown for visibility) -->
        {#if editingApp}
          <div class="setting-item parent-selector">
            <label for="editParent">Parent App</label>
            {#if parentSelectionOptions.length > 0}
              <select
                id="editParent"
                bind:value={editAppParentId}
              >
                <option value="">-- None --</option>
                {#each parentSelectionOptions as parentOption (parentOption.id)}
                  <option value={parentOption.id}>
                    {parentOption.Name || parentOption.Target || parentOption.id}
                  </option>
                {/each}
              </select>
              <p class="selector-helper">Only apps currently visible in the main grid are available here.</p>
            {:else}
              <p class="selector-helper">No parent apps are currently visible in the main section.</p>
            {/if}
          </div>
        {/if}

        <!-- Child Apps List (always shown for visibility) -->
        {#if editingApp}
          <div class="setting-item child-list">
            <p class="child-list-label">Child Apps</p>
            {#if editPaneChildApps.length > 0}
              <ul>
                {#each editPaneChildApps as child (child.id)}
                  <li>{child.Name || child.Target || child.id}</li>
                {/each}
              </ul>
            {:else}
              <p class="selector-helper">No child apps yet.</p>
            {/if}
          </div>
        {/if}

        <!-- Buttons -->
        <div class="edit-buttons">
          <button class="btn-cancel" on:click={closeEditPane}>Cancel</button>
          <button class="btn-confirm" on:click={saveEditedApp}>{editingApp ? 'Save' : 'Create'}</button>
        </div>
      </div>
    </div>
  {/if}

  <!-- User Selection Dialog -->
  {#if showUserDialog}
    <div class="user-dialog-overlay" on:click|self={closeUserDialog} on:keydown={(e) => { if (e.key === 'Escape') closeUserDialog(); }} role="button" tabindex="0" aria-label="Close user dialog"></div>
    <div class="user-dialog">
      <div class="user-dialog-header">
        <h2>Select Your Profile</h2>
        <button class="close-btn" aria-label="Close user dialog" on:click={closeUserDialog}>
          <X size={18} />
        </button>
      </div>
      <div class="user-dialog-content">
        {#if !creatingUser}
          <p class="user-dialog-description">Choose your profile to see your apps</p>
          
          <div class="user-select-wrapper">
            <select 
              class="user-select" 
              on:change={(e) => {
                const value = e.currentTarget.value;
                if (value === '__create_new__') {
                  creatingUser = true;
                } else if (value) {
                  const user = users.find(u => u.id === value);
                  if (user) {
                    selectUser(user.id, user.Name);
                  }
                }
              }}
            >
              <option value="">-- Select a profile --</option>
              {#each users as user}
                <option value={user.id}>{user.Name || 'Unnamed User'}</option>
              {/each}
              <option value="__create_new__">+ Create New Profile</option>
            </select>
          </div>
        {:else}
          <p class="user-dialog-description">Enter your name to create a new profile</p>
          
          <div class="create-user-form">
            <input
              type="text"
              bind:value={newUserName}
              placeholder="Enter your name"
              class="user-name-input"
              on:keydown={(e) => {
                if (e.key === 'Enter') handleCreateUser();
              }}
            />
          </div>

          <div class="user-dialog-actions">
            <button class="btn-cancel" on:click={() => { creatingUser = false; newUserName = ""; }}>
              Cancel
            </button>
            <button class="btn-confirm" on:click={handleCreateUser}>
              Create Profile
            </button>
          </div>
        {/if}
      </div>
    </div>
  {/if}

  <!-- Browser Pane -->
  {#if showBrowserPane}
    <div
      class="tray-overlay"
      on:click={() => showBrowserPane = false}
      on:keydown={(e) => {
        if (e.key === 'Escape') showBrowserPane = false;
      }}
      role="button"
      tabindex="0"
      aria-label="Close browser pane"
    ></div>
    <div class="settings-tray browser-pane"
      role="region"
      aria-label="App browser pane"
    >
      <div class="browser-pane-header">
        <h2>Browse Apps</h2>
        <button class="close-btn" aria-label="Close browser pane" on:click={() => showBrowserPane = false}>
          <X size={18} />
        </button>
      </div>
    </div>
  {/if}

  <!-- Available Apps Section - shows when search has a value -->
  {#if searchQuery.trim()}
    <div class="available-apps-section">
      <div class="section-header">
        <h2>Available Apps</h2>
      </div>
      
      <main class="container">
        {#if filteredBrowserApps.length === 0}
          <p class="no-apps-message">No apps available to add</p>
        {:else}
          <div
            class="grid browser-grid"
            style="
              grid-template-columns: repeat(auto-fit, {effectiveIconSize}px);
              gap: {iconPadding}px;
              --icon-size: {effectiveIconSize}px;
              --icon-radius: {appIconRadius}px;
            "
          >
            {#each filteredBrowserApps as app (app.id)}
              <div class="app-with-insert-indicator">
                <button
                  type="button"
                  class="icon-wrapper browser-app-button"
                  class:no-icon={!app.Icon || !app.Icon[0]}
                  aria-label="View {app.Name}"
                >
                  <div class="icon-container">
                    {#if app.Icon && app.Icon[0] && (app.Icon[0].url || app.Icon[0].iconDataUrl)}
                      {#if app.Icon[0].url}
                        <img
                          src={app.Icon[0].url}
                          alt=""
                          crossorigin="anonymous"
                          style="--icon-zoom: {iconZoomFactors[app.id] || 0};"
                          on:load={(e) => {
                            const zoom = detectTransparentMargins(e.currentTarget as HTMLImageElement);
                            iconZoomFactors = { ...iconZoomFactors, [app.id]: zoom };
                          }}
                          on:error={() => console.error(`❌ Failed to load image for ${app.Name}`)}
                        />
                      {:else if app.Icon[0].iconDataUrl}
                        <img
                          src={dataUrlToBlobUrl(app.Icon[0].iconDataUrl)}
                          alt=""
                          crossorigin="anonymous"
                          style="--icon-zoom: {iconZoomFactors[app.id] || 0};"
                          on:load={(e) => {
                            const zoom = detectTransparentMargins(e.currentTarget as HTMLImageElement);
                            iconZoomFactors = { ...iconZoomFactors, [app.id]: zoom };
                          }}
                          on:error={() => console.error(`❌ Failed to load image for ${app.Name}`)}
                        />
                      {/if}
                    {:else}
                      <div class="placeholder-icon" style="width:{effectiveIconSize}px; height:{effectiveIconSize}px;">
                        📦
                      </div>
                    {/if}
                    
                    {#if !searchActive && app.Children && Array.isArray(app.Children) && app.Children.length > 0}
                      <div
                        class="child-folder-badge"
                        style="--child-badge-size:{Math.max(18, effectiveIconSize * 0.22)}px;"
                        aria-hidden="true"
                      >
                        <FolderOpen size={Math.max(18, effectiveIconSize * 0.22)} />
                      </div>
                    {/if}

                    <!-- Green + overlay for browser apps -->
                    <div class="browser-overlay">
                      <div
                        class="add-browser-app-btn"
                        role="button"
                        tabindex="0"
                        aria-label="Add {app.Name}"
                        on:click|stopPropagation={() => {
                          if (app.ownership === "Global") {
                            unhideGlobalApp(app.id);
                          } else {
                            addPublicAppToUser(app.id);
                          }
                        }}
                        on:keydown|stopPropagation={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            if (app.ownership === "Global") {
                              unhideGlobalApp(app.id);
                            } else {
                              addPublicAppToUser(app.id);
                            }
                          }
                        }}
                      >
                        <Plus size={24} />
                      </div>
                    </div>
                  </div>
                  
                  <p style="font-size:{effectiveTextSize}px;">{app.Name}</p>
                </button>
              </div>
            {/each}
          </div>
        {/if}
      </main>
    </div>
  {/if}
</div>

<style>
:root {
  font-family: Inter, Avenir, Helvetica, Arial, sans-serif;
  color: var(--text-primary);
  background-color: var(--window-bg);
  --pane-margin: 24px;
  --pane-width: 500px;
}

:global(html),
:global(body) {
  margin: 0;
  padding: 0;
  background-color: var(--window-bg);
  color: var(--text-primary);
}

.drop-zone {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 1000;
  pointer-events: none;
  opacity: 0;
}

.app-container {
  display: flex;
  flex-direction: column;
  height: calc(100vh - 60px);
  overflow-y: auto;
  margin: 0 auto;
  padding: 4vh 2rem;
  text-align: center;
  max-width: 900px;
}

.container {
  position: relative;
  display: flex;
  flex-direction: column;
  flex: 1;
}

.apps-section {
  width: 100%;
}

.available-apps-section {
  width: 100%;
  margin-top: 2rem;
  padding-top: 2rem;
  border-top: 1px solid var(--border-light);
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  height: 48px;
  padding: 0 1rem;
  background: var(--card-bg);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  margin-bottom: 1rem;
}

.section-header h2 {
  margin: 0;
  font-size: 1.1rem;
  font-weight: 600;
  color: var(--text-primary);
}

.section-header-actions {
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 0.5rem;
}

/* ==================== BUTTON SYSTEM ==================== */
/* Standardized button classes using theme CSS variables
   
   Usage:
   - btn-confirm: Green confirmation button
   - btn-cancel: Gray cancel button  
   - btn-delete: Red delete button
   - btn-standard: Primary accent color button
   - btn-alternate: Secondary accent color button
   - btn-pill: Primary accent pill (full radius)
   - btn-pill-alt: Secondary accent pill
   - btn-pill-open: Transparent pill with border
   - btn-text: Text-only button with accent color
*/

/* 1. Confirm Button (Green) */
:global(.btn-confirm) {
  padding: 0.5rem 1rem;
  background: var(--button-confirm-bg);
  color: var(--button-text-light);
  border: none;
  border-radius: var(--button-radius);
  font-size: 0.9rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
}

:global(.btn-confirm:hover) {
  background: var(--button-confirm-hover);
  transform: translateY(-1px);
}

/* 2. Cancel Button (Gray) */
:global(.btn-cancel) {
  padding: 0.5rem 1rem;
  background: var(--button-cancel-bg);
  color: var(--button-text-light);
  border: none;
  border-radius: var(--button-radius);
  font-size: 0.9rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
}

:global(.btn-cancel:hover) {
  background: var(--button-cancel-hover);
  transform: translateY(-1px);
}

/* 3. Delete Button (Red) */
:global(.btn-delete) {
  padding: 0.5rem 1rem;
  background: var(--button-delete-bg);
  color: var(--button-text-light);
  border: none;
  border-radius: var(--button-radius);
  font-size: 0.9rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
}

:global(.btn-delete:hover) {
  background: var(--button-delete-hover);
  transform: translateY(-1px);
}

/* 4. Standard Button (Accent-1) */
:global(.btn-standard) {
  padding: 0.5rem 1rem;
  background: var(--accent-color);
  color: var(--button-text-light);
  border: none;
  border-radius: var(--button-radius);
  font-size: 0.9rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
}

:global(.btn-standard:hover) {
  background: var(--accent-hover);
  transform: translateY(-1px);
}

/* 5. Alternate Button (Accent-2) */
:global(.btn-alternate) {
  padding: 0.5rem 1rem;
  background: var(--accent-color-2);
  color: var(--button-text-light);
  border: none;
  border-radius: var(--button-radius);
  font-size: 0.9rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
}

:global(.btn-alternate:hover) {
  background: var(--accent-color-2-hover);
  transform: translateY(-1px);
}

/* 6. Pill Button (Accent-1, max radius) */
:global(.btn-pill) {
  padding: 0.4rem 0.8rem;
  background: var(--accent-color);
  color: var(--button-text-light);
  border: none;
  border-radius: 999px;
  font-size: 0.85rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
}

:global(.btn-pill:hover) {
  background: var(--accent-hover);
  transform: scale(1.02);
}

/* 7. Alternate Pill Button (Accent-2, max radius) */
:global(.btn-pill-alt) {
  padding: 0.4rem 0.8rem;
  background: var(--accent-color-2);
  color: var(--button-text-light);
  border: none;
  border-radius: 999px;
  font-size: 0.85rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
}

:global(.btn-pill-alt:hover) {
  background: var(--accent-color-2-hover);
  transform: scale(1.02);
}

/* 8. Open Pill Button (Transparent, hover accent) */
:global(.btn-pill-open) {
  padding: 0.4rem 0.8rem;
  background: transparent;
  color: var(--text-secondary);
  border: 1px solid var(--text-secondary);
  border-radius: 999px;
  font-size: 0.85rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  height: 24px;
  display: flex;
  align-items: center;
}

:global(.btn-pill-open:hover) {
  background: var(--accent-color-light);
  border-color: var(--accent-color);
  color: var(--accent-color);
}

/* 9. Text Button (No bg, accent text) */
:global(.btn-text) {
  padding: 0.4rem 0.6rem;
  background: transparent;
  color: var(--accent-color);
  border: none;
  border-radius: var(--button-radius);
  font-size: 0.9rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
}

:global(.btn-text:hover) {
  background: var(--accent-color-light);
  color: var(--accent-color-2);
}



.collapse-btn {
  background: transparent;
  border: none;
  color: var(--text-secondary);
  font-size: 0.9rem;
  cursor: pointer;
  padding: 0.25rem 0.5rem;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: color 0.2s ease;
}

.collapse-btn:hover {
  color: var(--text-primary);
}

.container.drag-active {
  background-color: var(--accent-color-light);
  border: 2px dashed var(--accent-color);
  border-radius: 8px;
  transition: all 0.2s ease;
}

.title-section {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 1.5rem;
  margin-bottom: 1rem;
  height: 60px;
}

.title-button {
  margin: 0;
  font-size: 2.2rem;
  font-weight: 700;
  background: none;
  border: none;
  color: var(--text-primary);
  cursor: pointer;
  padding: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  transition: opacity 0.2s ease;
}

.title-button:hover {
  opacity: 0.8;
}

.search-icon-btn {
  background: none;
  border: none;
  color: var(--text-secondary);
  cursor: pointer;
  padding: 0.5rem;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
  transition: all 0.2s ease;
  flex-shrink: 0;
  height: 100%;
}

.search-icon-btn:hover {
  background: var(--hover-bg);
  color: var(--text-primary);
}

.search-bar-fullwidth {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  background: var(--input-bg);
  border: 1px solid var(--border-light);
  border-radius: 8px;
  padding: 0.5rem 0.75rem;
  width: 100%;
  max-width: 900px;
  transition: border-color 0.2s ease;
}

.search-bar-fullwidth:focus-within {
  border-color: var(--accent-color);
}

.search-input {
  flex: 1;
  border: none;
  background: transparent;
  color: var(--text-primary);
  font-size: 1.1rem;
  outline: none;
}

.search-input::placeholder {
  color: var(--text-secondary);
}

.clear-search {
  background: none;
  border: none;
  color: var(--text-secondary);
  cursor: pointer;
  padding: 0;
  display: flex;
  align-items: center;
  transition: color 0.2s ease;
}

.clear-search:hover {
  color: var(--text-primary);
}

.grid {
  display: grid;
  justify-content: center;
  justify-items: center;
  margin: 32px;
  flex: 1;
  align-content: start;
  min-height: 0;
}

.icon-wrapper {
  display: flex;
  flex-direction: column;
  align-items: center;
  transition: transform 0.15s ease;
  width: auto;
  max-width: var(--icon-size);
  background: none;
  border: none;
  padding: 0;
  cursor: pointer;
  color: inherit;
  position: relative;
}
.icon-wrapper:hover {
  transform: scale(1.05);
}

.icon-wrapper.single-search-result .icon-container {
  border: 3px solid #4A90E2;
  box-shadow: 0 0 0 8px rgba(74, 144, 226, 0.15);
}

.app-with-insert-indicator {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.public-app-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(34, 197, 94, 0.15);
  border-radius: var(--icon-radius, 16px);
  opacity: 0;
  transition: opacity 0.2s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: none;
  margin-bottom: calc(1.5rem + var(--icon-size) * 0.1);
}

.icon-wrapper:hover .public-app-overlay {
  opacity: 1;
  pointer-events: auto;
}

.add-public-app-btn {
  background: rgba(34, 197, 94, 0.9);
  border: 2px solid rgb(34, 197, 94);
  border-radius: 50%;
  width: 48px;
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  cursor: pointer;
  transition: all 0.2s ease;
  box-shadow: 0 4px 12px rgba(34, 197, 94, 0.3);
}

.add-public-app-btn:hover {
  background: rgb(34, 197, 94);
  transform: scale(1.1);
  box-shadow: 0 6px 16px rgba(34, 197, 94, 0.4);
}
.icon-wrapper img {
  object-fit: contain;
  background-color: var(--card-bg);
  box-shadow: var(--shadow-medium);
  width: var(--icon-size);
  height: var(--icon-size);
  border-radius: var(--icon-radius, 16px);
  display: block;
  transform-origin: center;
  transform: scale(calc(1 + (var(--icon-zoom, 0) / 100)));
}
.icon-wrapper p {
  margin-top: 0.5rem;
  font-weight: 500;
  word-break: break-word;
}

.icon-container {
  position: relative;
  display: block;
  width: var(--icon-size);
  height: var(--icon-size);
  overflow: hidden;
  border-radius: var(--icon-radius, 16px);
}

.child-folder-badge {
  position: absolute;
  bottom: 8px;
  right: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  width: var(--child-badge-size, 24px);
  height: var(--child-badge-size, 24px);
  color: #727272;
  pointer-events: none;
  z-index: 2;
}

:global([data-theme='dark']) .child-folder-badge {
  color: #8a8a8a;
}

.placeholder-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: var(--border-light);
  border-radius: var(--icon-radius, 16px);
  font-size: 48px;
  box-shadow: var(--shadow-small);
}

.icon-wrapper.no-icon:hover {
  transform: scale(1.05);
}

.icon-wrapper.add-new-button {
  opacity: 0.6;
  justify-content: center;
  align-items: center;
  min-height: var(--icon-size);
}

.icon-wrapper.add-new-button:hover {
  opacity: 1;
}

.add-new-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--border-light);
  border: 2px solid var(--border-color);
  border-radius: 50%;
  width: var(--add-button-size, 48px);
  height: var(--add-button-size, 48px);
  transition: all 0.2s ease;
  color: var(--text-secondary);
}

.icon-wrapper.add-new-button:hover .add-new-icon {
  background: var(--hover-bg);
  border-color: var(--text-secondary);
  transform: scale(1.1);
}

.icon-wrapper.has-children {
  position: relative;
}

.icon-wrapper.child-drop-pending .icon-container {
  outline: 2px dashed var(--accent-color);
  outline-offset: 4px;
}

.icon-wrapper.child-drop-ready .icon-container {
  outline: 3px solid var(--status-success-dark);
  outline-offset: 4px;
  box-shadow: 0 0 0 10px var(--status-success-light);
}

.nest-overlay {
  position: absolute;
  inset: 0;
  border-radius: inherit;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  background: rgba(255, 255, 255, 0.82);
  color: var(--status-success-dark);
  z-index: 3;
  pointer-events: none;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

:global([data-theme='dark']) .nest-overlay {
  background: rgba(17, 24, 39, 0.7);
}

/* ==================== CHILD MENU ==================== */
.icon-wrapper.child-menu-open .icon-container {
  outline: 3px solid var(--accent-color);
  box-shadow: 0 0 0 6px rgba(44, 149, 195, 0.15);
}

.child-menu {
  position: fixed;
  z-index: 29;
  width: min(280px, calc(100vw - 32px));
  max-height: min(520px, calc(100vh - 32px));
  padding: 1rem;
  border-radius: 16px;
  border: 1px solid var(--border-color);
  background: var(--window-bg-light);
  box-shadow: var(--shadow-large);
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}


.child-menu-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-weight: 600;
  color: var(--text-primary);
}

.child-menu-close {
  background: none;
  border: none;
  color: var(--text-secondary);
  cursor: pointer;
  padding: 0.25rem;
  border-radius: 6px;
  transition: color 0.2s ease, background 0.2s ease;
}

.child-menu-close:hover {
  color: var(--text-primary);
  background: var(--border-hover);
}

.child-menu-list {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  overflow-y: auto;
  padding-right: 0.25rem;
}

.child-menu-item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  width: 100%;
  border-radius: 12px;
  border: 1px solid transparent;
  background: none;
  color: var(--text-primary);
  padding: 0.4rem 0.6rem;
  cursor: pointer;
  transition: background 0.15s ease, transform 0.15s ease, border-color 0.15s ease;
}

.child-menu-item:hover {
  background: var(--hover-bg);
  border-color: var(--border-hover);
  transform: translateX(3px);
}

.child-menu-item-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  min-width: 32px;
  min-height: 32px;
  border-radius: 10px;
  overflow: hidden;
  background: var(--border-light);
  box-shadow: var(--shadow-small);
}

.child-menu-item-icon img {
  width: 100%;
  height: 100%;
  object-fit: contain;
  transform: scale(calc(1 + (var(--icon-zoom, 0) / 100)));
}

.child-menu-placeholder {
  font-size: 1.1rem;
}

.child-menu-item-label {
  flex: 1;
  text-align: left;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 0.95rem;
}

footer {
  position: fixed;
  bottom: 0.75rem;
  left: 0;
  right: 0;
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0 1.5rem;
  font-size: 0.9rem;
  color: var(--text-secondary);
}

.footer-left {
  display: flex;
  align-items: center;
}

.footer-separator {
  margin: 0 18px;
  color: var(--text-secondary);
}

.success-message {
  color: var(--success-color);
  font-size: 0.85rem;
  animation: fadeIn 0.3s ease-in;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(5px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.footer-controls {
  display: flex;
  gap: 0.5rem;
  align-items: center;
}

.user-chip {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.4rem 0.8rem;
  background: var(--border-light);
  border: 1px solid var(--border-color);
  border-radius: 20px;
  font-size: 0.85rem;
  cursor: pointer;
  transition: all 0.2s ease;
}

.user-chip:hover {
  background: var(--hover-bg);
  transform: scale(1.02);
}

.user-chip span {
  font-weight: 500;
  color: var(--text-primary);
}

.refresh-btn,
.settings-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  background: none;
  border: none;
  padding: 0.25rem;
  cursor: pointer;
  color: var(--text-primary);
  transition: opacity 0.2s ease;
}

.refresh-btn:hover,
.settings-btn:hover {
  opacity: 0.7;
}

.tray-overlay {
  position: fixed;
  inset: 0;
  z-index: 20;
}

.settings-tray {
  position: fixed;
  right: 0;
  top: 0;
  bottom: 0;
  width: var(--pane-width);
  background: var(--window-bg-light);
  z-index: 21;
  display: flex;
  flex-direction: column;
  box-shadow: var(--shadow-large);
}

.settings-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  height: 64px;
  padding: 0 var(--pane-margin);
  border-bottom: 1px solid var(--border-light);
  flex-shrink: 0;
}

.settings-header h2 {
  margin: 0;
  font-size: 1.3rem;
  color: var(--text-primary);
  flex: 1;
}

.settings-content {
  flex: 1;
  overflow-y: auto;
  padding: var(--pane-margin);
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.setting-item {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.setting-item input[type="text"],
.setting-item select {
  box-sizing: border-box;
}

.setting-item label {
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--text-primary);
}

.setting-item input[type="range"] {
  flex: 1;
}

.setting-item input[type="text"] {
  width: 100%;
  padding: 0.5rem 0.75rem;
  border: 1px solid var(--border-light);
  border-radius: 6px;
  background: var(--input-bg);
  color: var(--text-primary);
  font-size: 0.85rem;
}

.setting-item input[type="text"]:focus {
  outline: none;
  border-color: var(--accent-color);
}

.setting-item input[type="text"]:read-only {
  background: var(--border-light);
  cursor: not-allowed;
  opacity: 0.6;
}

.setting-item select {
  width: 100%;
  padding: 0.5rem 2.5rem 0.5rem 0.75rem;
  border: 1px solid var(--border-light);
  border-radius: 6px;
  background: var(--input-bg);
  color: var(--text-primary);
  font-size: 0.85rem;
  cursor: pointer;
  appearance: none;
  -webkit-appearance: none;
  -moz-appearance: none;
  background-image: url("data:image/svg+xml,%3Csvg width='12' height='8' viewBox='0 0 12 8' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1.5L6 6.5L11 1.5' stroke='%23666' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 0.75rem center;
}

.setting-item select:focus {
  outline: none;
  border-color: var(--accent-color);
}

.setting-row {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.setting-item .value-display {
  font-size: 0.75rem;
  color: var(--text-secondary);
  opacity: 0.9;
  min-width: 45px;
  text-align: right;
  font-weight: 600;
}

.close-btn {
  position: absolute;
  right: 1rem;
  top: 0.5rem;
  display: flex;
  align-items: center;
  justify-content: center;
  background: none;
  border: none;
  color: var(--text-primary);
  padding: 0.25rem;
  cursor: pointer;
  z-index: 22;
  transition: opacity 0.2s ease;
}

.close-btn:hover {
  opacity: 0.7;
}

.version {
  user-select: none;
}

.error {
  color: var(--status-error);
  font-weight: 600;
}

.context-menu {
  position: fixed;
  background: var(--card-bg);
  border: 1px solid var(--border-color);
  border-radius: 6px;
  box-shadow: var(--shadow-medium);
  z-index: 1000;
  min-width: 150px;
  padding: 4px 0;
}

.context-menu-item {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 8px 16px;
  text-align: left;
  background: none;
  border: none;
  cursor: pointer;
  font-size: 14px;
  color: var(--text-primary);
  transition: background-color 0.15s ease;
}

.context-menu-item:hover {
  background-color: var(--hover-bg);
}

.context-menu-item.edit:hover {
  background-color: var(--hover-bg);
}

.context-menu-item.delete:hover {
  background-color: var(--status-error-light);
}

.context-menu-item.hide:hover {
  background-color: var(--hover-bg);
}

.context-menu-meta {
  border-top: 1px solid var(--border-light);
  margin-top: 4px;
  padding: 6px 16px 8px;
  font-size: 12px;
  color: var(--text-secondary);
}

.context-menu-item.unlink {
  color: var(--status-success-dark);
}

.context-menu-item.unlink:hover {
  background-color: var(--status-success-light);
}

.confirm-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  z-index: 1001;
}

.confirm-modal {
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  background: var(--card-bg);
  border-radius: 12px;
  box-shadow: var(--shadow-large);
  z-index: 1002;
  min-width: 300px;
  padding: 24px;
  animation: slideIn 0.3s ease-out;
}

.confirm-content {
  text-align: center;
}

.confirm-message {
  margin: 0 0 20px 0;
  font-size: 16px;
  color: var(--text-primary);
}

.confirm-message strong {
  font-weight: 700;
}

.confirm-buttons {
  display: flex;
  gap: 12px;
  justify-content: center;
}


/* User Dialog Styles */
.user-dialog-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  z-index: 1001;
}

.user-dialog {
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  background: var(--card-bg);
  border-radius: 16px;
  box-shadow: var(--shadow-large);
  z-index: 1002;
  min-width: 400px;
  max-width: 500px;
  max-height: 80vh;
  display: flex;
  flex-direction: column;
  animation: slideIn 0.3s ease-out;
}

.user-dialog-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1.5rem;
  border-bottom: 1px solid var(--border-light);
}

.user-dialog-header h2 {
  margin: 0;
  font-size: 1.4rem;
  color: var(--text-primary);
}

.user-dialog-content {
  padding: 1.5rem;
  flex: 1;
  overflow-y: auto;
}

.user-dialog-description {
  margin: 0 0 1rem 0;
  font-size: 0.95rem;
  color: var(--text-secondary);
}

.user-select-wrapper {
  margin-bottom: 1.5rem;
}

.user-select {
  width: 100%;
  padding: 0.5rem 2.5rem 0.5rem 0.75rem;
  border: 1px solid var(--border-light);
  border-radius: 6px;
  background: var(--input-bg);
  color: var(--text-primary);
  font-size: 0.95rem;
  cursor: pointer;
  appearance: none;
  -webkit-appearance: none;
  -moz-appearance: none;
  background-image: url("data:image/svg+xml,%3Csvg width='12' height='8' viewBox='0 0 12 8' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1.5L6 6.5L11 1.5' stroke='%23666' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 0.75rem center;
  transition: border-color 0.2s ease;
}

.user-select:focus {
  outline: none;
  border-color: var(--accent-color);
}

.create-user-form {
  margin-bottom: 1.5rem;
}

.user-name-input {
  width: 100%;
  padding: 0.75rem;
  border: 2px solid var(--border-light);
  border-radius: 8px;
  font-size: 1rem;
  transition: border-color 0.2s ease;
}

.user-name-input:focus {
  outline: none;
  border-color: var(--accent-color);
}

.user-dialog-actions {
  display: flex;
  gap: 0.75rem;
  justify-content: flex-end;
}


/* Edit Pane Styles */
.edit-pane {
  z-index: 22;
}

.edit-pane-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  height: 64px;
  padding: 0 var(--pane-margin);
  border-bottom: 1px solid var(--border-light);
  flex-shrink: 0;
}

.edit-pane h2 {
  margin: 0;
  font-size: 1.3rem;
  color: var(--text-primary);
  flex: 1;
  text-align: left;
}

.edit-content {
  padding-top: 1.25rem !important;
}

:global(.name-field) {
  margin: 0 0 0.75rem;
}

:global(.edit-name-input) {
  width: 100%;
  padding: 0.85rem 1rem;
  border: 2px solid var(--border-light);
  border-radius: 12px;
  font-size: 1.2rem;
  font-weight: 600;
  background: var(--card-bg);
  color: var(--text-primary);
  box-shadow: var(--shadow-small);
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
}

:global(.edit-name-input:focus) {
  outline: none;
  border-color: var(--accent-color);
  box-shadow: 0 0 0 2px var(--accent-color-light);
}

:global(.field-pair) {
  display: flex;
  gap: 1rem;
  flex-wrap: wrap;
  align-items: flex-start;
}

:global(.field-pair .setting-item) {
  flex: 1;
}

:global(.setting-item.compact) {
  gap: 0.4rem;
}

:global(#dnd-action-dragged-el) {
  pointer-events: none !important;
}

:global(.setting-item.compact label) {
  font-size: 0.8rem;
  color: var(--text-secondary);
}

.edit-pane-drag-overlay {
  position: fixed;
  top: 0;
  right: 0;
  width: var(--pane-width);
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
  pointer-events: auto;
}

.drag-message {
  color: white;
  font-size: 18px;
  font-weight: 600;
  text-align: center;
  margin: 0;
  padding: 1rem;
}

.edit-icon-section {
  display: flex;
  align-items: flex-start;
  gap: 1.5rem;
  margin-block: 0rem;
  padding: 0;
  position: relative;
  flex-wrap: nowrap;
}

.icon-preview {
  width: 140px;
  height: 140px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: var(--card-bg);
  border-radius: 8px;
  box-shadow: var(--shadow-small);
}

.icon-preview img {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
  border-radius: 6px;
}

.icon-controls-wrapper {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  flex: 1 1 auto;
  min-width: 0;
}

@media (max-width: 520px) {
  .edit-icon-section {
    flex-wrap: wrap;
  }

  .icon-controls-wrapper {
    width: 100%;
  }
}

.icon-controls {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
}

.remove-icon-btn,
.upload-icon-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 14px;
  border: none;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
  white-space: nowrap;
  width: 100%;
}

.remove-icon-btn {
  background-color: var(--status-error-light);
  color: var(--status-error);
}

.remove-icon-btn:hover {
  background-color: var(--status-error-light);
  opacity: 0.8;
}

.upload-icon-btn {
  background-color: var(--status-success-light);
  color: var(--status-success-dark);
}

.upload-icon-btn:hover {
  background-color: var(--status-success-light);
  opacity: 0.8;
}

.drag-hint {
  margin: 0;
  font-size: 0.8rem;
  color: var(--text-secondary);
  opacity: 0.7;
  text-align: left;
}

.edit-buttons {
  display: flex;
  gap: 12px;
  justify-content: flex-end;
  margin-top: 2rem;
  padding-top: 1.5rem;
  border-top: 1px solid var(--border-light);
}

.child-app-notice {
  padding: 1rem;
  background: var(--border-light);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  margin-top: 1rem;
}

.child-app-notice p {
  margin: 0;
  font-size: 0.9rem;
  color: var(--text-secondary);
  line-height: 1.5;
}

.parent-selector select {
  width: 100%;
  padding: 0.65rem;
  border: 1px solid var(--border-light);
  border-radius: 8px;
  background: var(--input-bg, var(--card-bg));
  color: var(--text-primary);
}

.parent-selector select:focus {
  outline: none;
  border-color: var(--accent-color);
}

.selector-helper {
  margin: 0.35rem 0 0;
  font-size: 0.8rem;
  color: var(--text-secondary);
}

.child-list-label {
  margin: 0 0 0.35rem;
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--text-secondary);
}

.child-list ul {
  margin: 0;
  padding-left: 1.25rem;
  max-height: 140px;
  overflow-y: auto;
  color: var(--text-primary);
}

.child-list li {
  font-size: 0.9rem;
  line-height: 1.4;
}

/* Browser Pane Styles */
.browser-pane {
  z-index: 22;
}

.browser-pane-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  height: 64px;
  padding: 0 var(--pane-margin);
  border-bottom: 1px solid var(--border-light);
  flex-shrink: 0;
}

.browser-pane-header h2 {
  margin: 0;
  font-size: 1.3rem;
  color: var(--text-primary);
  flex: 1;
  text-align: left;
}

.browser-grid {
  justify-content: center;
  justify-items: center;
  margin: 0;
  align-content: start;
  min-height: 0;
}

.browser-app-button {
  cursor: default;
  position: relative;
}

.browser-app-button:hover {
  transform: scale(1.05);
}

.browser-app-button .icon-container {
  position: relative;
}

.browser-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(34, 197, 94, 0.15);
  border-radius: var(--icon-radius, 16px);
  opacity: 0;
  transition: opacity 0.2s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: none;
}

.browser-app-button:hover .browser-overlay {
  opacity: 1;
  pointer-events: auto;
}

.add-browser-app-btn {
  background: rgba(34, 197, 94, 0.9);
  border: 2px solid rgb(34, 197, 94);
  border-radius: 50%;
  width: 48px;
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  cursor: pointer;
  transition: all 0.2s ease;
  box-shadow: 0 4px 12px rgba(34, 197, 94, 0.3);
  flex-shrink: 0;
}

.add-browser-app-btn:hover {
  background: rgb(34, 197, 94);
  transform: scale(1.1);
  box-shadow: 0 6px 16px rgba(34, 197, 94, 0.4);
}

.no-apps-message {
  grid-column: 1 / -1;
  text-align: center;
  color: var(--text-secondary);
  padding: 2rem 1rem;
  margin: 0;
  font-size: 0.95rem;
}


/* Dark mode is now handled by theme files */
</style>
