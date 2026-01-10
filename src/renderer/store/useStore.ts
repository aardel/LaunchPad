import { create } from 'zustand';
import Fuse from 'fuse.js';
import type {
  AnyItem,
  PasswordItem,
  Group,
  NetworkProfile,
  TailscaleStatus,
  AppSettings,
  CreateItemInput,
  UpdateItemInput,
  CreateGroupInput,
  UpdateGroupInput,
  IPCResponse,
  Browser,
  ServiceMetrics,
} from '@shared/types';

interface AppState {
  // Data
  items: AnyItem[];
  groups: Group[];
  recentItems: AnyItem[];
  settings: AppSettings | null;
  tailscaleStatus: TailscaleStatus;
  browsers: Browser[];
  favicons: Record<string, string | null>;

  // UI State
  activeProfile: NetworkProfile;
  selectedBrowser: string;
  selectedGroupId: string | null;
  searchQuery: string;
  searchFilters: {
    type: string | null;
    groupId: string | null;
    profile: string | null;
    tags: string[];
  };
  isLoading: boolean;
  isFetchingFavicons: boolean;
  faviconProgress: { current: number; total: number };
  error: string | null;

  // Vault State
  isVaultSetup: boolean;
  isVaultLocked: boolean;

  // Health Check
  healthCheckResults: Record<string, { status: string; statusCode?: number; responseTime?: number; error?: string }>;
  isCheckingHealth: boolean;

  // Sync Status
  isSyncing: boolean;
  lastSyncTime: string | null;
  syncError: string | null;

  // Backup Status
  lastBackupTime: string | null;
  canUndo: boolean;

  // Notification state
  notification: { message: string; type: 'info' | 'success' | 'warning' | 'error' } | null;

  // Dashboard state
  dashboardMetrics: ServiceMetrics[];
  isDashboardMonitoring: boolean;

  // Selection state
  selectedItemIds: Set<string>;
  isSelectionMode: boolean;

  // Modal state
  isAddModalOpen: boolean;
  isEditModalOpen: boolean;
  editingItem: AnyItem | null;
  isGroupModalOpen: boolean;
  editingGroup: Group | null;
  isSettingsOpen: boolean;
  isCommandPaletteOpen: boolean;
  isVaultResetModalOpen: boolean;

  // Actions
  setActiveProfile: (profile: NetworkProfile) => void;
  setSelectedBrowser: (browserId: string) => void;
  setSelectedGroup: (groupId: string | null) => void;
  setSearchQuery: (query: string) => void;
  setSearchFilter: (filter: keyof AppState['searchFilters'], value: any) => void;
  clearSearchFilters: () => void;

  // Data actions
  loadData: () => Promise<void>;
  loadRecentItems: () => Promise<void>;
  refreshTailscaleStatus: () => Promise<void>;

  // Item actions
  createItem: (input: CreateItemInput) => Promise<void>;
  updateItem: (input: UpdateItemInput) => Promise<void>;
  deleteItem: (id: string) => Promise<void>;
  reorderItems: (items: { id: string; sortOrder: number }[]) => Promise<void>;

  // Backup actions
  checkBackup: () => Promise<void>;
  undoLastChange: () => Promise<void>;
  launchItem: (item: AnyItem) => Promise<void>;
  launchGroup: (groupId: string) => Promise<void>;

  // Group actions
  createGroup: (input: CreateGroupInput) => Promise<void>;
  updateGroup: (input: UpdateGroupInput) => Promise<void>;
  deleteGroup: (id: string) => Promise<void>;
  reorderGroups: (groups: { id: string; sortOrder: number }[]) => Promise<void>;
  toggleGroupExpanded: (groupId: string) => Promise<void>;

  // Favicon actions
  fetchFavicons: (forceRefresh?: boolean) => Promise<void>;
  refreshExpiredFavicons: () => Promise<void>;
  getFavicon: (url: string) => string | null;

  // Vault actions
  checkVaultStatus: () => Promise<void>;
  setupVault: () => Promise<void>;
  unlockVault: () => Promise<void>;
  lockVault: () => Promise<void>;

  // Health Check actions
  checkAllHealth: () => Promise<void>;
  checkItemHealth: (itemId: string) => Promise<void>;
  clearHealthResults: () => void;

  // Sync actions
  setSyncStatus: (status: { syncing: boolean; success?: boolean; error?: string; lastSync?: string }) => void;

  // Selection actions
  toggleSelectionMode: () => void;
  toggleItemSelection: (itemId: string) => void;
  selectAllItems: () => void;
  clearSelection: () => void;
  batchDeleteItems: (itemIds: string[]) => Promise<void>;
  batchChangeGroup: (itemIds: string[], groupId: string) => Promise<void>;
  batchReplaceAddress: (itemIds: string[], searchText: string, replacementText: string, profile: string) => Promise<void>;

  // Modal actions
  openAddModal: () => void;
  closeAddModal: () => void;
  openEditModal: (item: AnyItem) => void;
  closeEditModal: () => void;
  openGroupModal: (group?: Group) => void;
  closeGroupModal: () => void;
  openSettings: () => void;
  closeSettings: () => void;
  openCommandPalette: () => void;
  closeCommandPalette: () => void;
  openVaultResetModal: () => void;
  closeVaultResetModal: () => void;
  resetVault: () => Promise<void>;
  showNotification: (message: string, type?: 'info' | 'success' | 'warning' | 'error') => void;
  clearNotification: () => void;

  // Dashboard actions
  startDashboardMonitoring: (interval?: number) => Promise<void>;
  stopDashboardMonitoring: () => Promise<void>;
  refreshDashboardMetrics: () => Promise<void>;
}

export const useStore = create<AppState>((set, get) => ({
  // Initial state
  items: [],
  groups: [],
  recentItems: [],
  settings: null,
  tailscaleStatus: { connected: false },
  browsers: [],
  favicons: {},
  activeProfile: 'local',
  selectedBrowser: 'default',
  selectedGroupId: null,
  searchQuery: '',
  searchFilters: {
    type: null,
    groupId: null,
    profile: null,
    tags: [],
  },
  isLoading: false,
  isFetchingFavicons: false,
  faviconProgress: { current: 0, total: 0 },
  error: null,

  // Vault State
  isVaultSetup: false,
  isVaultLocked: true,

  // Health Check
  healthCheckResults: {},
  isCheckingHealth: false,

  // Sync Status
  isSyncing: false,
  lastSyncTime: null,
  syncError: null,

  // Backup Status
  lastBackupTime: null,
  canUndo: false,

  // Notification state
  notification: null,

  // Dashboard state
  dashboardMetrics: [],
  isDashboardMonitoring: false,

  // Selection state
  selectedItemIds: new Set<string>(),
  isSelectionMode: false,

  // Modal state
  isAddModalOpen: false,
  isEditModalOpen: false,
  editingItem: null,
  isGroupModalOpen: false,
  editingGroup: null,
  isSettingsOpen: false,
  isCommandPaletteOpen: false,
  isVaultResetModalOpen: false,

  // Setters
  setActiveProfile: (profile) => set({ activeProfile: profile }),
  setSelectedBrowser: (browserId) => set({ selectedBrowser: browserId }),
  setSelectedGroup: (groupId) => set({ selectedGroupId: groupId }),
  setSearchQuery: (query) => set({ searchQuery: query }),
  setSearchFilter: (filter, value) => set((state) => ({
    searchFilters: { ...state.searchFilters, [filter]: value }
  })),
  clearSearchFilters: () => set({
    searchFilters: { type: null, groupId: null, profile: null, tags: [] }
  }),

  // Load all data
  loadData: async () => {
    set({ isLoading: true, error: null });
    try {
      const [itemsRes, groupsRes, settingsRes, tailscaleRes, browsersRes] = await Promise.all([
        window.api.items.getAll(),
        window.api.groups.getAll(),
        window.api.settings.get(),
        window.api.tailscale.getStatus(),
        window.api.browsers.getInstalled(),
      ]);

      if (!itemsRes.success || !groupsRes.success || !settingsRes.success) {
        throw new Error('Failed to load data');
      }

      set({
        items: itemsRes.data || [],
        groups: groupsRes.data || [],
        settings: settingsRes.data || null,
        tailscaleStatus: tailscaleRes.data || { connected: false },
        browsers: browsersRes.data || [],
        activeProfile: settingsRes.data?.defaultProfile || 'local',
        selectedBrowser: settingsRes.data?.defaultBrowser || 'default',
        isLoading: false,
      });

      // Load recent items after main data is loaded
      await get().loadRecentItems();
    } catch (error) {
      set({ error: String(error), isLoading: false });
    }
  },

  loadRecentItems: async () => {
    try {
      const res = await window.api.items.getRecent(30);
      if (res.success && res.data) {
        set({ recentItems: res.data });
      }
    } catch (error) {
      console.error('Failed to load recent items:', error);
    }
  },

  refreshTailscaleStatus: async () => {
    if (!window.api?.tailscale) {
      console.warn('Tailscale API not available (running outside Electron?)');
      return;
    }
    try {
      const res = await window.api.tailscale.getStatus();
      if (res.success) {
        set({ tailscaleStatus: res.data || { connected: false } });
      }
    } catch (error) {
      console.error('Failed to refresh Tailscale status:', error);
    }
  },

  // Item actions
  createItem: async (input) => {
    try {
      const res = await window.api.items.create(input);
      if (res.success && res.data) {
        set((state) => ({ items: [...state.items, res.data!] }));
      }
    } catch (error) {
      set({ error: String(error) });
    }
  },

  updateItem: async (input) => {
    try {
      const res = await window.api.items.update(input);
      if (res.success && res.data) {
        set((state) => ({
          items: state.items.map((item) =>
            item.id === input.id ? res.data! : item
          ),
        }));
        // Check for backup after update
        await get().checkBackup();
      }
    } catch (error) {
      set({ error: String(error) });
    }
  },

  deleteItem: async (id) => {
    try {
      const res = await window.api.items.delete(id);
      if (res.success) {
        set((state) => ({
          items: state.items.filter((item) => item.id !== id),
        }));
      }
    } catch (error) {
      set({ error: String(error) });
    }
  },

  reorderItems: async (reorderData) => {
    try {
      // Optimistically update the UI
      set((state) => ({
        items: state.items.map((item) => {
          const newOrder = reorderData.find((r) => r.id === item.id);
          return newOrder ? { ...item, sortOrder: newOrder.sortOrder } : item;
        }),
      }));

      // Persist to database
      await window.api.items.reorder(reorderData);
    } catch (error) {
      set({ error: String(error) });
      // Reload items on error
      const res = await window.api.items.getAll();
      if (res.success) {
        set({ items: res.data || [] });
      }
    }
  },

  launchItem: async (item) => {
    // Handle password items specially - copy password to clipboard
    if (item.type === 'password') {
      const passwordItem = item as PasswordItem;
      try {
        // Decrypt password if credentials exist
        if (passwordItem.credentials?.password) {
          const decryptRes = await window.api.encryption.decrypt(passwordItem.credentials.password);
          if (decryptRes.success && decryptRes.data) {
            // Copy password to clipboard
            await navigator.clipboard.writeText(decryptRes.data);
            get().showNotification('Password copied to clipboard', 'success');

            // Optionally open URL if provided
            if (passwordItem.url) {
              await window.api.launch.url(passwordItem.url);
            }

            // Update access count
            await window.api.items.getAll().then((res: IPCResponse<AnyItem[]>) => {
              if (res.success) {
                set({ items: res.data || [] });
                // Refresh recent items after launching
                get().loadRecentItems();
              }
            });
            return;
          }
        }

        // If no password, just open URL if provided
        if (passwordItem.url) {
          await window.api.launch.url(passwordItem.url);
        }
      } catch (error) {
        set({ error: String(error) });
      }
      return;
    }

    // Handle other item types normally
    const { activeProfile, selectedBrowser } = get();
    try {
      const res = await window.api.launch.item(item, activeProfile, selectedBrowser);

      if (res.success && res.data?.routed) {
        get().showNotification(`Smart Routed to ${res.data.profileUsed}`, 'info');
      }

      // Refresh to update access count
      const dataRes = await window.api.items.getAll();
      if (dataRes.success) {
        set({ items: dataRes.data || [] });
        // Refresh recent items after launching
        await get().loadRecentItems();
      }
    } catch (error) {
      set({ error: String(error) });
    }
  },

  launchGroup: async (groupId) => {
    const { activeProfile, selectedBrowser } = get();
    try {
      await window.api.launch.group(groupId, activeProfile, selectedBrowser);
      // Refresh to update access counts
      const res = await window.api.items.getAll();
      if (res.success) {
        set({ items: res.data || [] });
      }
    } catch (error) {
      set({ error: String(error) });
    }
  },

  // Group actions
  createGroup: async (input) => {
    try {
      const res = await window.api.groups.create(input);
      if (res.success && res.data) {
        set((state) => ({ groups: [...state.groups, res.data!] }));
      }
    } catch (error) {
      set({ error: String(error) });
    }
  },

  updateGroup: async (input) => {
    try {
      const res = await window.api.groups.update(input);
      if (res.success && res.data) {
        set((state) => ({
          groups: state.groups.map((group) =>
            group.id === input.id ? res.data! : group
          ),
        }));
      }
    } catch (error) {
      set({ error: String(error) });
    }
  },

  deleteGroup: async (id) => {
    try {
      const res = await window.api.groups.delete(id);
      if (res.success) {
        set((state) => ({
          groups: state.groups.filter((group) => group.id !== id),
          items: state.items.filter((item) => item.groupId !== id),
          selectedGroupId: state.selectedGroupId === id ? null : state.selectedGroupId,
        }));
      }
    } catch (error) {
      set({ error: String(error) });
    }
  },

  reorderGroups: async (reorderData) => {
    try {
      // Optimistically update the UI
      set((state) => ({
        groups: state.groups.map((group) => {
          const newOrder = reorderData.find((r) => r.id === group.id);
          return newOrder ? { ...group, sortOrder: newOrder.sortOrder } : group;
        }),
      }));

      // Persist to database
      await window.api.groups.reorder(reorderData);
    } catch (error) {
      set({ error: String(error) });
      // Reload groups on error
      const res = await window.api.groups.getAll();
      if (res.success) {
        set({ groups: res.data || [] });
      }
    }
  },

  toggleGroupExpanded: async (groupId) => {
    const group = get().groups.find((g) => g.id === groupId);
    if (group) {
      await get().updateGroup({ id: groupId, isExpanded: !group.isExpanded });
    }
  },

  // Favicon actions
  fetchFavicons: async (forceRefresh: boolean = false) => {
    const { items, favicons } = get();

    // Build all bookmark URLs
    const allBookmarkUrls: string[] = [];
    items.forEach((item) => {
      if (item.type === 'bookmark') {
        const bookmark = item as any;
        const host = bookmark.networkAddresses?.local || bookmark.networkAddresses?.tailscale;
        if (host) {
          const protocol = bookmark.protocol || 'https';
          const port = bookmark.port ? `:${bookmark.port}` : '';
          const url = `${protocol}://${host}${port}`;
          allBookmarkUrls.push(url);
        }
      }
    });

    if (allBookmarkUrls.length === 0) return;

    // If force refresh, fetch all
    let urlsToFetch: string[] = [];
    if (forceRefresh) {
      urlsToFetch = allBookmarkUrls;
    } else {
      // Optimize: Get expired favicons first (batch operation)
      const expiredRes = await window.api.favicon.getExpired(allBookmarkUrls);
      const expiredUrls = expiredRes.success && expiredRes.data ? expiredRes.data : [];

      // Find missing URLs (not in memory cache and not in expired list)
      const missingUrls: string[] = [];
      for (const url of allBookmarkUrls) {
        if (favicons[url] === undefined && !expiredUrls.includes(url)) {
          // Not in memory cache and not expired, check if it exists on disk
          const hasFaviconRes = await window.api.favicon.hasFavicon(url);
          if (!hasFaviconRes.success || !hasFaviconRes.data) {
            missingUrls.push(url);
          }
        }
      }

      urlsToFetch = [...new Set([...missingUrls, ...expiredUrls])]; // Remove duplicates
    }

    if (urlsToFetch.length === 0) return;

    set({
      isFetchingFavicons: true,
      faviconProgress: { current: 0, total: urlsToFetch.length }
    });

    try {
      // Fetch one at a time to show progress
      for (let i = 0; i < urlsToFetch.length; i++) {
        const url = urlsToFetch[i];
        set({ faviconProgress: { current: i + 1, total: urlsToFetch.length } });

        try {
          const res = await window.api.favicon.get(url, forceRefresh);
          if (res.success) {
            set((state) => ({
              favicons: { ...state.favicons, [url]: res.data },
            }));
          }
        } catch (err) {
          // Mark as null so we don't retry
          set((state) => ({
            favicons: { ...state.favicons, [url]: null },
          }));
        }
      }
    } catch (error) {
      console.error('Failed to fetch favicons:', error);
    } finally {
      set({ isFetchingFavicons: false });
    }
  },

  refreshExpiredFavicons: async () => {
    const { items } = get();

    // Build all bookmark URLs
    const allBookmarkUrls: string[] = [];
    items.forEach((item) => {
      if (item.type === 'bookmark') {
        const bookmark = item as any;
        const host = bookmark.networkAddresses?.local || bookmark.networkAddresses?.tailscale;
        if (host) {
          const protocol = bookmark.protocol || 'https';
          const port = bookmark.port ? `:${bookmark.port}` : '';
          const url = `${protocol}://${host}${port}`;
          allBookmarkUrls.push(url);
        }
      }
    });

    if (allBookmarkUrls.length === 0) return;

    // Get expired favicons (background refresh, no UI indicator)
    const expiredRes = await window.api.favicon.getExpired(allBookmarkUrls);
    if (!expiredRes.success || !expiredRes.data || expiredRes.data.length === 0) {
      return;
    }

    // Refresh expired favicons in background
    for (const url of expiredRes.data) {
      try {
        const res = await window.api.favicon.get(url, true);
        if (res.success) {
          set((state) => ({
            favicons: { ...state.favicons, [url]: res.data },
          }));
        }
      } catch (err) {
        // Silently fail for background refresh
      }
    }
  },

  getFavicon: (url) => {
    return get().favicons[url] || null;
  },

  // Vault actions
  checkVaultStatus: async () => {
    if (!window.api?.encryption) {
      console.warn('Encryption API not available (running outside Electron?)');
      return;
    }
    try {
      const [setupRes, unlockedRes] = await Promise.all([
        window.api.encryption.isSetup(),
        window.api.encryption.isUnlocked(),
      ]);

      set({
        isVaultSetup: setupRes.success && setupRes.data === true,
        isVaultLocked: !(unlockedRes.success && unlockedRes.data === true),
      });
    } catch (error) {
      console.error('Failed to check vault status:', error);
    }
  },

  setupVault: async () => {
    set({ isVaultSetup: true, isVaultLocked: false });
  },

  unlockVault: async () => {
    set({ isVaultLocked: false });
  },

  lockVault: async () => {
    try {
      await window.api.encryption.lock();
      set({ isVaultLocked: true });
    } catch (error) {
      console.error('Failed to lock vault:', error);
    }
  },

  // Health Check actions
  checkAllHealth: async () => {
    const { activeProfile } = get();
    set({ isCheckingHealth: true });

    try {
      const res = await window.api.healthCheck.checkAll(activeProfile);
      if (res.success && res.data) {
        const results: Record<string, any> = {};
        for (const result of res.data) {
          results[result.itemId] = {
            status: result.status,
            statusCode: result.statusCode,
            responseTime: result.responseTime,
            error: result.error,
          };
        }
        set({ healthCheckResults: results });
      }
    } catch (error) {
      console.error('Health check failed:', error);
    } finally {
      set({ isCheckingHealth: false });
    }
  },

  checkItemHealth: async (itemId: string) => {
    const { activeProfile } = get();

    try {
      const res = await window.api.healthCheck.checkItem(itemId, activeProfile);
      if (res.success && res.data) {
        set((state) => ({
          healthCheckResults: {
            ...state.healthCheckResults,
            [itemId]: {
              status: res.data.status,
              statusCode: res.data.statusCode,
              responseTime: res.data.responseTime,
              error: res.data.error,
            },
          },
        }));
      }
    } catch (error) {
      console.error('Health check failed:', error);
    }
  },

  clearHealthResults: () => {
    set({ healthCheckResults: {} });
  },

  // Sync actions
  setSyncStatus: (status) => {
    set({
      isSyncing: status?.syncing ?? false,
      lastSyncTime: status?.lastSync || null,
      syncError: status?.error || null,
    });
  },

  // Selection actions
  toggleSelectionMode: () => {
    set((state) => {
      const newMode = !state.isSelectionMode;
      return {
        isSelectionMode: newMode,
        selectedItemIds: newMode ? state.selectedItemIds : new Set<string>(),
      };
    });
  },

  toggleItemSelection: (itemId: string) => {
    set((state) => {
      const newSet = new Set(state.selectedItemIds);
      if (newSet.has(itemId)) {
        newSet.delete(itemId);
      } else {
        newSet.add(itemId);
      }
      return { selectedItemIds: newSet };
    });
  },

  selectAllItems: () => {
    const { items, selectedGroupId } = get();
    let itemsToSelect = items;

    // If a group is selected, only select items in that group
    if (selectedGroupId) {
      itemsToSelect = items.filter(item => item.groupId === selectedGroupId);
    }

    set({ selectedItemIds: new Set(itemsToSelect.map(item => item.id)) });
  },

  clearSelection: () => {
    set({ selectedItemIds: new Set<string>(), isSelectionMode: false });
  },

  batchDeleteItems: async (itemIds: string[]) => {
    if (itemIds.length === 0) return;

    try {
      // Use batch delete for better performance
      const res = await window.api.items.batchDelete(itemIds);
      if (res.success) {
        // Update state by removing deleted items
        set((state) => {
          const newItems = state.items.filter(item => !itemIds.includes(item.id));
          return { items: newItems };
        });
        get().clearSelection();
        // Check for backup after batch delete
        await get().checkBackup();
        // Reload data to ensure UI is in sync
        await get().loadData();
      } else {
        console.error('Batch delete failed:', res.error);
      }
    } catch (error) {
      console.error('Error in batch delete:', error);
    }
  },

  batchChangeGroup: async (itemIds: string[], groupId: string) => {
    for (const id of itemIds) {
      const item = get().items.find(i => i.id === id);
      if (item) {
        await get().updateItem({ id, groupId });
      }
    }
    get().clearSelection();
    // Check for backup after batch change
    await get().checkBackup();
    // Reload data to ensure UI is in sync
    await get().loadData();
  },

  batchReplaceAddress: async (itemIds: string[], searchText: string, replacementText: string, profile: string) => {
    if (itemIds.length === 0) return;
    try {
      const res = await window.api.items.bulkReplaceAddress(itemIds, searchText, replacementText, profile);
      if (res.success) {
        get().clearSelection();
        await get().loadData();
        await get().checkBackup();
      } else {
        set({ error: res.error || 'Failed to bulk update addresses' });
      }
    } catch (error) {
      set({ error: String(error) });
    }
  },

  // Backup actions
  checkBackup: async () => {
    try {
      const res = await window.api.backup.getLatest();
      if (res.success && res.data) {
        set({
          lastBackupTime: res.data.timestamp,
          canUndo: true,
        });
      } else {
        set({ canUndo: false });
      }
    } catch (error) {
      console.error('Failed to check backup:', error);
    }
  },

  undoLastChange: async () => {
    try {
      const res = await window.api.backup.undo();
      if (res.success) {
        // Reload all data after undo
        await get().loadData();
        set({
          lastBackupTime: null,
          canUndo: false,
        });
      } else {
        set({ error: res.error || 'Failed to undo' });
      }
    } catch (error) {
      set({ error: String(error) });
    }
  },

  // Modal actions
  openAddModal: () => set({ isAddModalOpen: true }),
  closeAddModal: () => set({ isAddModalOpen: false }),
  openEditModal: (item) => set({ isEditModalOpen: true, editingItem: item }),
  closeEditModal: () => set({ isEditModalOpen: false, editingItem: null }),
  openGroupModal: (group) => set({ isGroupModalOpen: true, editingGroup: group }),
  closeGroupModal: () => set({ isGroupModalOpen: false, editingGroup: null }),
  openSettings: () => set({ isSettingsOpen: true }),
  closeSettings: () => set({ isSettingsOpen: false }),
  openCommandPalette: () => set({ isCommandPaletteOpen: true }),
  closeCommandPalette: () => set({ isCommandPaletteOpen: false }),
  openVaultResetModal: () => set({ isVaultResetModalOpen: true }),
  closeVaultResetModal: () => set({ isVaultResetModalOpen: false }),
  resetVault: async () => {
    const result = await window.api.encryption.resetVault();
    if (result.success) {
      // Reload app state to detect vault is no longer setup
      const settingsRes = await window.api.settings.get();
      if (settingsRes.success && settingsRes.data) {
        set({ settings: settingsRes.data, isVaultSetup: false, isVaultLocked: true });
      }
      set({ isVaultResetModalOpen: false });
      get().showNotification('Vault reset successfully. Please set up your vault again.', 'success');
    } else {
      get().showNotification(`Failed to reset vault: ${result.error}`, 'error');
    }
  },
  showNotification: (message, type = 'info') => {
    set({ notification: { message, type } });
    // Auto-clear after 3 seconds
    setTimeout(() => {
      const { notification } = get();
      if (notification?.message === message) {
        set({ notification: null });
      }
    }, 3000);
  },
  clearNotification: () => set({ notification: null }),

  // Dashboard actions
  startDashboardMonitoring: async (interval = 30000) => {
    try {
      await window.api.dashboard.startMonitoring(interval);
      set({ isDashboardMonitoring: true });
      // Initial fetch
      await get().refreshDashboardMetrics();
    } catch (error) {
      console.error('Failed to start dashboard monitoring:', error);
    }
  },

  stopDashboardMonitoring: async () => {
    try {
      await window.api.dashboard.stopMonitoring();
      set({ isDashboardMonitoring: false });
    } catch (error) {
      console.error('Failed to stop dashboard monitoring:', error);
    }
  },

  refreshDashboardMetrics: async () => {
    try {
      const res = await window.api.dashboard.getMetrics();
      if (res.success && res.data) {
        set({ dashboardMetrics: res.data });
      }
    } catch (error) {
      console.error('Failed to refresh dashboard metrics:', error);
    }
  },
}));
