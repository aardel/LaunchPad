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
    item: (item: AnyItem, profile: NetworkProfile, browserId?: string): Promise<IPCResponse<void>> => 
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
    importSyncFile: (): Promise<IPCResponse<{ groupsCount: number; itemsCount: number }>> =>
      ipcRenderer.invoke('data:importSyncFile'),
    importBrowserBookmarks: (groupId: string): Promise<IPCResponse<{ count: number }>> =>
      ipcRenderer.invoke('data:importBrowserBookmarks', groupId),
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

