import { contextBridge, ipcRenderer } from 'electron';
import type {
  AnyItem,
  Group,
  CreateItemInput,
  UpdateItemInput,
  CreateGroupInput,
  UpdateGroupInput,
  NetworkProfile,
  AppSettings,
  IPCResponse,
  TailscaleStatus,
  Browser,
} from '../shared/types';

// Expose protected methods that allow the renderer process to use
// ipcRenderer without exposing the entire object
const api = {
  // Items
  items: {
    getAll: (): Promise<IPCResponse<AnyItem[]>> =>
      ipcRenderer.invoke('items:getAll'),
    getByGroup: (groupId: string): Promise<IPCResponse<AnyItem[]>> =>
      ipcRenderer.invoke('items:getByGroup', groupId),
    getRecent: (limit?: number): Promise<IPCResponse<AnyItem[]>> =>
      ipcRenderer.invoke('items:getRecent', limit),
    create: (input: CreateItemInput): Promise<IPCResponse<AnyItem>> =>
      ipcRenderer.invoke('items:create', input),
    update: (input: UpdateItemInput): Promise<IPCResponse<AnyItem>> =>
      ipcRenderer.invoke('items:update', input),
    delete: (id: string): Promise<IPCResponse<void>> =>
      ipcRenderer.invoke('items:delete', id),
    batchDelete: (ids: string[]): Promise<IPCResponse<void>> =>
      ipcRenderer.invoke('items:batchDelete', ids),
    reorder: (items: { id: string; sortOrder: number }[]): Promise<IPCResponse<void>> =>
      ipcRenderer.invoke('items:reorder', items),
    bulkReplaceAddress: (ids: string[], searchText: string, replacementText: string, profile?: string): Promise<IPCResponse<void>> =>
      ipcRenderer.invoke('items:bulkReplaceAddress', ids, searchText, replacementText, profile),
  },

  // Groups
  groups: {
    getAll: (): Promise<IPCResponse<Group[]>> =>
      ipcRenderer.invoke('groups:getAll'),
    create: (input: CreateGroupInput): Promise<IPCResponse<Group>> =>
      ipcRenderer.invoke('groups:create', input),
    update: (input: UpdateGroupInput): Promise<IPCResponse<Group>> =>
      ipcRenderer.invoke('groups:update', input),
    delete: (id: string): Promise<IPCResponse<void>> =>
      ipcRenderer.invoke('groups:delete', id),
    reorder: (groups: { id: string; sortOrder: number }[]): Promise<IPCResponse<void>> =>
      ipcRenderer.invoke('groups:reorder', groups),
  },

  // Browsers
  browsers: {
    getInstalled: (): Promise<IPCResponse<Browser[]>> =>
      ipcRenderer.invoke('browsers:getInstalled'),
  },

  // Launcher
  launch: {
    item: (item: AnyItem, profile: NetworkProfile, browserId?: string): Promise<IPCResponse<{ profileUsed: NetworkProfile; routed: boolean }>> =>
      ipcRenderer.invoke('launch:item', item, profile, browserId),
    group: (groupId: string, profile: NetworkProfile, browserId?: string): Promise<IPCResponse<void>> =>
      ipcRenderer.invoke('launch:group', groupId, profile, browserId),
    url: (url: string): Promise<IPCResponse<void>> =>
      ipcRenderer.invoke('launch:url', url),
  },

  // Tailscale
  tailscale: {
    getStatus: (): Promise<IPCResponse<TailscaleStatus>> =>
      ipcRenderer.invoke('tailscale:status'),
  },

  // Settings
  settings: {
    get: (): Promise<IPCResponse<AppSettings>> =>
      ipcRenderer.invoke('settings:get'),
    update: (settings: Partial<AppSettings>): Promise<IPCResponse<AppSettings>> =>
      ipcRenderer.invoke('settings:update', settings),
  },

  // System
  system: {
    getTheme: (): Promise<IPCResponse<'dark' | 'light'>> =>
      ipcRenderer.invoke('system:getTheme'),
    selectApp: (): Promise<IPCResponse<string | null>> =>
      ipcRenderer.invoke('system:selectApp'),
  },

  // Search
  search: {
    items: (query: string): Promise<IPCResponse<AnyItem[]>> =>
      ipcRenderer.invoke('search:items', query),
  },

  // Import/Export
  data: {
    export: (): Promise<IPCResponse<{ path: string }>> =>
      ipcRenderer.invoke('data:export'),
    import: (): Promise<IPCResponse<{ groupsCount: number; itemsCount: number }>> =>
      ipcRenderer.invoke('data:import'),
    analyzeImport: (): Promise<IPCResponse<{ groups: any[]; items: any[]; conflicts: any[] }>> =>
      ipcRenderer.invoke('data:analyzeImport'),
    importWithResolutions: (importData: any, safeGroups: any[], safeItems: any[], resolutions: Record<string, 'merge' | 'replace' | 'skip'>): Promise<IPCResponse<{ groupsCount: number; itemsCount: number }>> =>
      ipcRenderer.invoke('data:importWithResolutions', importData, safeGroups, safeItems, resolutions),
    importSyncFile: (): Promise<IPCResponse<{ groupsCount: number; itemsCount: number }>> =>
      ipcRenderer.invoke('data:importSyncFile'),
    importBrowserBookmarks: (filePath: string, targetGroupId: string): Promise<IPCResponse<{ count: number }>> =>
      ipcRenderer.invoke('data:importBrowserBookmarks', filePath, targetGroupId),
  },

  // Browser Bookmarks Direct Import
  browserBookmarks: {
    getAvailable: (): Promise<IPCResponse<{ id: string; name: string; icon: string; hasBookmarks: boolean; bookmarkCount?: number }[]>> =>
      ipcRenderer.invoke('browserBookmarks:getAvailable'),
    import: (browserId: string, groupId: string): Promise<IPCResponse<{ count: number }>> =>
      ipcRenderer.invoke('browserBookmarks:import', browserId, groupId),
    preview: (browserId: string): Promise<IPCResponse<{ name: string; url: string; folder?: string }[]>> =>
      ipcRenderer.invoke('browserBookmarks:preview', browserId),
  },

  // Favicon
  favicon: {
    get: (url: string, forceRefresh?: boolean): Promise<IPCResponse<string | null>> =>
      ipcRenderer.invoke('favicon:get', url, forceRefresh),
    getBatch: (urls: string[], forceRefresh?: boolean): Promise<IPCResponse<Record<string, string | null>>> =>
      ipcRenderer.invoke('favicon:getBatch', urls, forceRefresh),
    hasFavicon: (url: string): Promise<IPCResponse<boolean>> =>
      ipcRenderer.invoke('favicon:hasFavicon', url),
    getExpired: (urls: string[]): Promise<IPCResponse<string[]>> =>
      ipcRenderer.invoke('favicon:getExpired', urls),
  },

  // Encryption
  encryption: {
    isSetup: (): Promise<IPCResponse<boolean>> =>
      ipcRenderer.invoke('encryption:isSetup'),
    isUnlocked: (): Promise<IPCResponse<boolean>> =>
      ipcRenderer.invoke('encryption:isUnlocked'),
    setup: (password: string): Promise<IPCResponse<boolean>> =>
      ipcRenderer.invoke('encryption:setup', password),
    unlock: (password: string): Promise<IPCResponse<boolean>> =>
      ipcRenderer.invoke('encryption:unlock', password),
    lock: (): Promise<IPCResponse<boolean>> =>
      ipcRenderer.invoke('encryption:lock'),
    changePassword: (oldPassword: string, newPassword: string): Promise<IPCResponse<boolean>> =>
      ipcRenderer.invoke('encryption:changePassword', oldPassword, newPassword),
    encrypt: (plaintext: string): Promise<IPCResponse<string>> =>
      ipcRenderer.invoke('encryption:encrypt', plaintext),
    decrypt: (ciphertext: string): Promise<IPCResponse<string>> =>
      ipcRenderer.invoke('encryption:decrypt', ciphertext),
    resetVault: (): Promise<IPCResponse<void>> =>
      ipcRenderer.invoke('encryption:resetVault'),
  },

  // Health Check
  healthCheck: {
    checkItem: (itemId: string, profile: string): Promise<IPCResponse<any>> =>
      ipcRenderer.invoke('healthCheck:checkItem', itemId, profile),
    checkAll: (profile: string): Promise<IPCResponse<any[]>> =>
      ipcRenderer.invoke('healthCheck:checkAll', profile),
    getResults: (): Promise<IPCResponse<any[]>> =>
      ipcRenderer.invoke('healthCheck:getResults'),
    clearResults: (): Promise<IPCResponse<void>> =>
      ipcRenderer.invoke('healthCheck:clearResults'),
  },

  // Sync
  sync: {
    testConnection: (url: string, username: string, password: string): Promise<IPCResponse<boolean>> =>
      ipcRenderer.invoke('sync:testConnection', url, username, password),
    upload: (): Promise<IPCResponse<void>> =>
      ipcRenderer.invoke('sync:upload'),
    download: (): Promise<IPCResponse<{ groups: Group[]; items: AnyItem[] } | null>> =>
      ipcRenderer.invoke('sync:download'),
  },

  // AI Features
  ai: {
    testConnection: (): Promise<IPCResponse<{ success: boolean; error?: string }>> =>
      ipcRenderer.invoke('ai:testConnection'),
    categorizeItem: (name: string, url?: string, description?: string): Promise<IPCResponse<string | null>> =>
      ipcRenderer.invoke('ai:categorizeItem', name, url, description),
    generateDescription: (name: string, url?: string): Promise<IPCResponse<string | null>> =>
      ipcRenderer.invoke('ai:generateDescription', name, url),
    suggestTags: (name: string, url?: string, description?: string): Promise<IPCResponse<string[] | null>> =>
      ipcRenderer.invoke('ai:suggestTags', name, url, description),
    findSimilarItems: (name: string, url: string | undefined, existingItems: Array<{ name: string; url?: string; id: string }>): Promise<IPCResponse<Array<{ id: string; name: string; url?: string; similarity: string }> | null>> =>
      ipcRenderer.invoke('ai:findSimilarItems', name, url, existingItems),
    semanticSearch: (query: string, items: Array<{ name: string; description?: string; url?: string; id: string }>): Promise<IPCResponse<Array<{ id: string; name: string; description?: string; url?: string; relevance: string }> | null>> =>
      ipcRenderer.invoke('ai:semanticSearch', query, items),
  },

  // Quick Search Window
  quickSearch: {
    hide: (): Promise<void> => ipcRenderer.invoke('quickSearch:hide'),
  },

  // Backup & Undo
  backup: {
    getLatest: (): Promise<IPCResponse<{ timestamp: string } | null>> =>
      ipcRenderer.invoke('backup:getLatest'),
    undo: (): Promise<IPCResponse<{ groupsCount: number; itemsCount: number }>> =>
      ipcRenderer.invoke('backup:undo'),
  },

  //  Dashboard
  dashboard: {
    getMetrics: (): Promise<IPCResponse<import('../shared/types').ServiceMetrics[]>> =>
      ipcRenderer.invoke('dashboard:getMetrics'),
    startMonitoring: (interval?: number): Promise<IPCResponse<void>> =>
      ipcRenderer.invoke('dashboard:startMonitoring', interval),
    stopMonitoring: (): Promise<IPCResponse<void>> =>
      ipcRenderer.invoke('dashboard:stopMonitoring'),
  },
};

contextBridge.exposeInMainWorld('api', api);

// Expose ipcRenderer for event listening (read-only)
const listeners = new Map<Function, (event: any, ...args: any[]) => void>();

contextBridge.exposeInMainWorld('electron', {
  ipcRenderer: {
    on: (channel: string, func: (event: any, ...args: any[]) => void) => {
      const subscription = (event: any, ...args: any[]) => {
        func(event, ...args);
      };
      ipcRenderer.on(channel, subscription);
      listeners.set(func, subscription);
    },
    removeListener: (channel: string, func: (event: any, ...args: any[]) => void) => {
      const subscription = listeners.get(func);
      if (subscription) {
        ipcRenderer.removeListener(channel, subscription);
        listeners.delete(func);
      }
    },
  },
});

// Type declaration for the renderer
export type API = typeof api;

