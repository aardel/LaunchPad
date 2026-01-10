import { app, BrowserWindow, ipcMain, shell, nativeTheme, globalShortcut } from 'electron';
import path from 'path';
import { QuickSearchWindow } from './windows/QuickSearchWindow';
import { DatabaseService } from './services/database';
import { TailscaleService } from './services/tailscale';
import { LauncherService } from './services/launcher';
import { EncryptionService } from './services/encryption';
import { BrowserService, Browser } from './services/browsers';
import { ImportExportService, ExportData } from './services/importExport';
import { BrowserBookmarksService, BrowserWithBookmarks, BrowserBookmark } from './services/browserBookmarks';
import { FaviconService } from './services/favicon';
import { HealthCheckService, HealthCheckResult } from './services/healthCheck';
import { SyncService } from './services/sync';
import { ExtensionServer } from './services/extensionServer';
import { AIService } from './services/aiService';
import { BackupService } from './services/backupService';
import {
  AnyItem,
  Group,
  CreateItemInput,
  UpdateItemInput,
  CreateGroupInput,
  UpdateGroupInput,
  NetworkProfile,
  AppSettings,
  IPCResponse,
} from '../shared/types';

let mainWindow: BrowserWindow | null = null;
let quickSearchWindow: QuickSearchWindow | null = null;
let db: DatabaseService | null = null;
let tailscale: TailscaleService;
let launcher: LauncherService;
let encryption: EncryptionService;
let browserService: BrowserService;
let importExport: ImportExportService;
let browserBookmarks: BrowserBookmarksService;
let faviconService: FaviconService;
let healthCheckService: HealthCheckService;
let syncService: SyncService;
let extensionServer: ExtensionServer;
let aiService: AIService;
let backupService: BackupService | null = null;

const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

// Isolate development data
if (isDev) {
  const userDataPath = app.getPath('userData');
  app.setPath('userData', `${userDataPath}-dev`);
}

// Helper to ensure db is ready
function getDb(): DatabaseService {
  if (!db) {
    throw new Error('Database not initialized');
  }
  return db;
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 15, y: 15 },
    backgroundColor: '#0f172a',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
    show: false,
  });

  // Load the app
  if (isDev) {
    // Try to find the correct port from environment or common defaults
    const port = process.env.VITE_PORT || '5173';
    mainWindow.loadURL(`http://localhost:${port}`).catch(() => {
      // If 5173 fails, try 5174, then 5175
      mainWindow?.loadURL('http://localhost:5174').catch(() => {
        mainWindow?.loadURL('http://localhost:5175');
      });
    });
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
  });

  // Fallback: show window after 3 seconds even if ready-to-show didn't fire
  setTimeout(() => {
    if (mainWindow && !mainWindow.isVisible()) {
      mainWindow.show();
    }
  }, 3000);

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

async function initializeServices() {
  const userDataPath = app.getPath('userData');

  db = new DatabaseService(path.join(userDataPath, 'launchit.db'));
  await db.initialize();

  tailscale = new TailscaleService();
  browserService = new BrowserService();
  faviconService = new FaviconService();
  healthCheckService = new HealthCheckService();
  encryption = new EncryptionService();
  importExport = new ImportExportService();
  browserBookmarks = new BrowserBookmarksService();
  launcher = new LauncherService(browserService, healthCheckService);
  syncService = new SyncService(encryption);
  // Initialize AI service
  const settings = db.getSettings();
  aiService = new AIService({
    apiKey: settings.groqApiKey,
    enabled: settings.aiEnabled || false,
  });

  extensionServer = new ExtensionServer(db, aiService);
  backupService = new BackupService();

  // Set callback for when bookmarks are added via extension
  extensionServer.setOnBookmarkAdded((item) => {
    // Notify renderer process
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('extension:bookmark-added', item);
    }
  });

  // Start extension server
  extensionServer.start();

  // Pre-cache browser list
  await browserService.getInstalledBrowsers();
}

function setupIPC() {
  // Helper function to trigger sync after data changes (with debounce)
  let syncTimeout: NodeJS.Timeout | null = null;
  const triggerSync = () => {
    // Clear existing timeout
    if (syncTimeout) {
      clearTimeout(syncTimeout);
    }

    // Debounce: wait 2 seconds after last change before syncing
    syncTimeout = setTimeout(() => {
      try {
        const settings = getDb().getSettings();
        if (settings.syncEnabled && encryption?.isUnlocked()) {
          // Notify renderer that sync is starting
          mainWindow?.webContents.send('sync:status', { syncing: true });

          // Sync in background, don't wait for result
          syncService.upload(
            settings.syncUrl!,
            settings.syncUsername!,
            settings.syncPassword!,
            getDb().getAllGroups(),
            getDb().getAllItems()
          ).then((result: any) => {
            if (result.success) {
              getDb().updateSettings({ lastSync: new Date().toISOString() });
              // Notify renderer that sync completed
              mainWindow?.webContents.send('sync:status', {
                syncing: false,
                success: true,
                lastSync: new Date().toISOString()
              });
            } else {
              // Notify renderer that sync failed
              mainWindow?.webContents.send('sync:status', {
                syncing: false,
                success: false,
                error: result.error
              });
            }
          }).catch((error: any) => {
            // Notify renderer that sync failed
            mainWindow?.webContents.send('sync:status', {
              syncing: false,
              success: false,
              error: error.message
            });
          });
        }
      } catch {
        // Silently fail
      }
    }, 2000); // 2 second debounce
  };

  // ===== Items =====
  ipcMain.handle('items:getAll', async (): Promise<IPCResponse<AnyItem[]>> => {
    try {
      const items = getDb().getAllItems();
      return { success: true, data: items };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  });

  ipcMain.handle('items:getByGroup', async (_, groupId: string): Promise<IPCResponse<AnyItem[]>> => {
    try {
      const items = getDb().getItemsByGroup(groupId);
      return { success: true, data: items };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  });

  ipcMain.handle('items:getRecent', async (_, limit: number = 30): Promise<IPCResponse<AnyItem[]>> => {
    try {
      const items = getDb().getRecentItems(limit);
      return { success: true, data: items };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  });

  ipcMain.handle('items:create', async (_, input: CreateItemInput): Promise<IPCResponse<AnyItem>> => {
    try {
      const item = getDb().createItem(input);
      triggerSync();
      return { success: true, data: item };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  });

  ipcMain.handle('items:update', async (_, input: UpdateItemInput): Promise<IPCResponse<AnyItem>> => {
    try {
      // Create backup before update
      if (backupService) {
        const groups = getDb().getAllGroups();
        const items = getDb().getAllItems();
        await backupService.createBackup(groups, items);
      }

      const item = getDb().updateItem(input);
      triggerSync();

      // Notify renderer that backup was created
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('backup:created', { timestamp: new Date().toISOString() });
      }

      return { success: true, data: item };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  });

  ipcMain.handle('items:delete', async (_, id: string): Promise<IPCResponse<void>> => {
    try {
      // Create backup before delete
      if (backupService) {
        const groups = getDb().getAllGroups();
        const items = getDb().getAllItems();
        await backupService.createBackup(groups, items);
      }

      getDb().deleteItem(id);
      triggerSync();

      // Notify renderer that backup was created
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('backup:created', { timestamp: new Date().toISOString() });
      }

      return { success: true };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  });

  ipcMain.handle('items:batchDelete', async (_, ids: string[]): Promise<IPCResponse<void>> => {
    try {
      // Create backup before batch delete
      if (backupService) {
        const groups = getDb().getAllGroups();
        const items = getDb().getAllItems();
        await backupService.createBackup(groups, items);
      }

      getDb().batchDeleteItems(ids);
      triggerSync();

      // Notify renderer that backup was created
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('backup:created', { timestamp: new Date().toISOString() });
      }

      return { success: true };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  });

  ipcMain.handle('items:reorder', async (_, items: { id: string; sortOrder: number }[]): Promise<IPCResponse<void>> => {
    try {
      getDb().reorderItems(items);
      triggerSync();
      return { success: true };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  });

  ipcMain.handle('items:bulkReplaceAddress', async (_, ids: string[], searchText: string, replacementText: string, profile: string): Promise<IPCResponse<void>> => {
    try {
      // Create backup before bulk update
      if (backupService) {
        const groups = getDb().getAllGroups();
        const items = getDb().getAllItems();
        await backupService.createBackup(groups, items);
      }

      getDb().bulkReplaceAddress(ids, searchText, replacementText, profile);
      triggerSync();

      // Notify renderer
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('backup:created', { timestamp: new Date().toISOString() });
      }

      return { success: true };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  });

  // ===== Groups =====
  ipcMain.handle('groups:getAll', async (): Promise<IPCResponse<Group[]>> => {
    try {
      const groups = getDb().getAllGroups();
      return { success: true, data: groups };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  });

  ipcMain.handle('groups:create', async (_, input: CreateGroupInput): Promise<IPCResponse<Group>> => {
    try {
      const group = getDb().createGroup(input);
      triggerSync();
      return { success: true, data: group };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  });

  ipcMain.handle('groups:update', async (_, input: UpdateGroupInput): Promise<IPCResponse<Group>> => {
    try {
      const group = getDb().updateGroup(input);
      triggerSync();
      return { success: true, data: group };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  });

  ipcMain.handle('groups:delete', async (_, id: string): Promise<IPCResponse<void>> => {
    try {
      getDb().deleteGroup(id);
      triggerSync();
      return { success: true };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  });

  ipcMain.handle('groups:reorder', async (_, groups: { id: string; sortOrder: number }[]): Promise<IPCResponse<void>> => {
    try {
      getDb().reorderGroups(groups);
      triggerSync();
      return { success: true };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  });

  // ===== Browsers =====
  ipcMain.handle('browsers:getInstalled', async (): Promise<IPCResponse<Browser[]>> => {
    try {
      const browsers = await browserService.getInstalledBrowsers();
      return { success: true, data: browsers };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  });

  // ===== Launcher =====
  ipcMain.handle('launch:item', async (_, item: AnyItem, profile: NetworkProfile, browserId?: string): Promise<IPCResponse<{ profileUsed: NetworkProfile; routed: boolean }>> => {
    try {
      const settings = getDb().getSettings();
      let decryptedPassword;
      if (item.type === 'ssh' && (item as any).credentials?.password) {
        decryptedPassword = encryption?.decrypt((item as any).credentials.password);
      }

      const result = await launcher?.launchItem(item, profile, browserId, decryptedPassword, settings.defaultTerminal, settings.smartRoutingEnabled);

      // Update last accessed
      getDb().updateLastAccessed(item.id);

      return { success: true, data: result };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  });

  ipcMain.handle('launch:group', async (_, groupId: string, profile: NetworkProfile, browserId?: string): Promise<IPCResponse<void>> => {
    try {
      const items = getDb().getItemsByGroup(groupId);
      const settings = getDb().getSettings();

      for (const item of items) {
        let decryptedPassword;
        if (item.type === 'ssh' && (item as any).credentials?.password) {
          decryptedPassword = encryption?.decrypt((item as any).credentials.password);
        }
        await launcher?.launchItem(item, profile, browserId, decryptedPassword, settings.defaultTerminal, settings.smartRoutingEnabled);
        getDb().updateLastAccessed(item.id);
      }

      return { success: true };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  });

  ipcMain.handle('launch:url', async (_, url: string): Promise<IPCResponse<void>> => {
    try {
      await shell.openExternal(url);
      return { success: true };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  });

  // ===== Tailscale =====
  ipcMain.handle('tailscale:status', async (): Promise<IPCResponse<{ connected: boolean; tailnetName?: string }>> => {
    try {
      const status = await tailscale.getStatus();
      return { success: true, data: status };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  });

  // ===== Settings =====
  ipcMain.handle('settings:get', async (): Promise<IPCResponse<AppSettings>> => {
    try {
      const settings = getDb().getSettings();
      return { success: true, data: settings };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  });

  ipcMain.handle('settings:update', async (_, settings: Partial<AppSettings>): Promise<IPCResponse<AppSettings>> => {
    try {
      const updated = getDb().updateSettings(settings);

      // Update AI service if API key changed
      if (settings.groqApiKey !== undefined) {
        aiService.setApiKey(settings.groqApiKey);
      }

      // Update AI service enabled state
      if (settings.aiEnabled !== undefined) {
        aiService.setEnabled(settings.aiEnabled);
      }

      return { success: true, data: updated };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  });

  // ===== AI Features =====
  ipcMain.handle('ai:testConnection', async (): Promise<IPCResponse<{ success: boolean; error?: string }>> => {
    try {
      const result = await aiService.testConnection();
      return { success: true, data: result };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  });

  ipcMain.handle('ai:categorizeItem', async (_, name: string, url?: string, description?: string): Promise<IPCResponse<string | null>> => {
    try {
      const category = await aiService.categorizeItem(name, url, description);
      return { success: true, data: category };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  });

  ipcMain.handle('ai:generateDescription', async (_, name: string, url?: string): Promise<IPCResponse<string | null>> => {
    try {
      const description = await aiService.generateDescription(name, url);
      return { success: true, data: description };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  });

  ipcMain.handle('ai:suggestTags', async (_, name: string, url?: string, description?: string): Promise<IPCResponse<string[] | null>> => {
    try {
      const tags = await aiService.suggestTags(name, url, description);
      return { success: true, data: tags };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  });

  ipcMain.handle('ai:findSimilarItems', async (_, name: string, url: string | undefined, existingItems: Array<{ name: string; url?: string; id: string }>): Promise<IPCResponse<Array<{ id: string; name: string; url?: string; similarity: string }> | null>> => {
    try {
      const similar = await aiService.findSimilarItems(name, url, existingItems);
      return { success: true, data: similar };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  });

  ipcMain.handle('ai:semanticSearch', async (_, query: string, items: Array<{ name: string; description?: string; url?: string; id: string }>): Promise<IPCResponse<Array<{ id: string; name: string; description?: string; url?: string; relevance: string }> | null>> => {
    try {
      const results = await aiService.semanticSearch(query, items);
      return { success: true, data: results };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  });

  // ===== Backup & Undo =====
  ipcMain.handle('backup:getLatest', async (): Promise<IPCResponse<{ timestamp: string } | null>> => {
    try {
      if (!backupService) {
        return { success: true, data: null };
      }
      const backup = backupService.getLatestBackup();
      if (backup) {
        return { success: true, data: { timestamp: backup.timestamp } };
      }
      return { success: true, data: null };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  });

  ipcMain.handle('backup:undo', async (): Promise<IPCResponse<{ groupsCount: number; itemsCount: number }>> => {
    try {
      if (!backupService) {
        return { success: false, error: 'Backup service not initialized' };
      }
      const backup = backupService.getLatestBackup();
      if (!backup) {
        return { success: false, error: 'No backup available to restore' };
      }

      const database = getDb();

      // Clear existing data
      const allItems = database.getAllItems();
      const allGroups = database.getAllGroups();

      // Delete all items
      for (const item of allItems) {
        database.deleteItem(item.id);
      }

      // Delete all groups
      for (const group of allGroups) {
        database.deleteGroup(group.id);
      }

      // Restore from backup
      for (const group of backup.groups) {
        database.createGroup({
          name: group.name,
          icon: group.icon,
          color: group.color,
          defaultProfile: group.defaultProfile,
          batchOpenDelay: group.batchOpenDelay,
        });
      }

      // Restore items (need to get groups first to map IDs)
      const restoredGroups = database.getAllGroups();
      for (const item of backup.items) {
        // Find matching group by name (since IDs might have changed)
        const matchingGroup = restoredGroups.find(g => g.name === backup.groups.find(bg => bg.id === item.groupId)?.name);
        if (matchingGroup) {
          try {
            if (item.type === 'bookmark') {
              const bookmark = item as any;
              database.createItem({
                type: 'bookmark',
                name: bookmark.name,
                description: bookmark.description,
                groupId: matchingGroup.id,
                protocol: bookmark.protocol,
                port: bookmark.port,
                path: bookmark.path,
                networkAddresses: bookmark.networkAddresses,
                icon: bookmark.icon,
                color: bookmark.color,
                tags: bookmark.tags || [],
              });
            } else if (item.type === 'ssh') {
              const ssh = item as any;
              database.createItem({
                type: 'ssh',
                name: ssh.name,
                description: ssh.description,
                groupId: matchingGroup.id,
                username: ssh.username,
                port: ssh.port,
                networkAddresses: ssh.networkAddresses,
                icon: ssh.icon,
                color: ssh.color,
                tags: ssh.tags || [],
              });
            } else if (item.type === 'app') {
              const app = item as any;
              database.createItem({
                type: 'app',
                name: app.name,
                description: app.description,
                groupId: matchingGroup.id,
                appPath: app.appPath,
                arguments: app.arguments,
                icon: app.icon,
                color: app.color,
                tags: app.tags || [],
              });
            } else if (item.type === 'password') {
              const password = item as any;
              database.createItem({
                type: 'password',
                name: password.name,
                description: password.description,
                groupId: matchingGroup.id,
                service: password.service,
                username: password.username,
                url: password.url,
                icon: password.icon,
                color: password.color,
                tags: password.tags || [],
              });
            }
          } catch (error) {
            console.error(`Failed to restore item ${item.name}:`, error);
          }
        }
      }

      triggerSync();

      // Notify renderer
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('backup:restored', {
          timestamp: backup.timestamp,
          groupsCount: backup.groups.length,
          itemsCount: backup.items.length,
        });
      }

      return {
        success: true,
        data: {
          groupsCount: backup.groups.length,
          itemsCount: backup.items.length
        }
      };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  });

  // ===== System =====

  ipcMain.handle('system:getTheme', async (): Promise<IPCResponse<'dark' | 'light'>> => {
    try {
      const theme = nativeTheme.shouldUseDarkColors ? 'dark' : 'light';
      return { success: true, data: theme };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  });

  ipcMain.handle('system:selectApp', async (): Promise<IPCResponse<string | null>> => {
    const { dialog } = await import('electron');
    const result = await dialog.showOpenDialog(mainWindow!, {
      properties: ['openFile'],
      filters: [
        { name: 'Applications', extensions: ['app', 'exe', ''] },
      ],
    });

    if (result.canceled || result.filePaths.length === 0) {
      return { success: true, data: null };
    }

    return { success: true, data: result.filePaths[0] };
  });

  ipcMain.handle('system:openExtensionFolder', async (_, browser: 'chrome' | 'safari'): Promise<IPCResponse<void>> => {
    try {
      const extensionPath = browser === 'chrome'
        ? path.join(__dirname, '../../LaunchIt-Extension-Chromium')
        : path.join(__dirname, '../../LaunchIt-Extension-Safari');

      // In prod, resources structure might be different, but for now dev/root is fine.
      // If packed, we might need to point to where we unpacked resources or just tell user to download.
      // Assuming 'dev' usage for now as per user context.

      // Check if dev or prod to find correct path if needed, 
      // but 'npm run build:main' puts index.js in dist/main, so ../.. goes to root.
      // If packed, these source folders might not exist unless we copy them. 
      // User is running 'npm run dev', so this path should work.

      const error = await shell.openPath(extensionPath);
      if (error) {
        return { success: false, error };
      }
      return { success: true };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  });

  // ===== Search =====
  ipcMain.handle('search:items', async (_, query: string): Promise<IPCResponse<AnyItem[]>> => {
    try {
      const items = getDb().searchItems(query);
      return { success: true, data: items };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  });

  // ===== Import/Export =====
  ipcMain.handle('data:export', async (): Promise<IPCResponse<{ path: string }>> => {
    try {
      const database = getDb();
      const groups = database.getAllGroups();
      const items = database.getAllItems();
      const result = await importExport.exportData(groups, items);

      if (result.success && result.path) {
        return { success: true, data: { path: result.path } };
      }
      return { success: false, error: result.error };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  });

  ipcMain.handle('data:import', async (): Promise<IPCResponse<{ groupsCount: number; itemsCount: number }>> => {
    try {
      const result = await importExport.importData();

      if (!result.success || !result.data) {
        return { success: false, error: result.error };
      }

      const database = getDb();

      // Import groups first (to get IDs)
      const groupIdMap = new Map<string, string>();
      for (const group of result.data.groups) {
        const newGroup = database.createGroup({
          name: group.name,
          icon: group.icon,
          color: group.color,
          defaultProfile: group.defaultProfile,
          batchOpenDelay: group.batchOpenDelay,
        });
        groupIdMap.set(group.id, newGroup.id);
      }

      // Import items with mapped group IDs
      let itemsImported = 0;
      for (const item of result.data.items) {
        const newGroupId = groupIdMap.get(item.groupId);
        if (!newGroupId) continue;

        database.createItem({
          type: item.type,
          name: item.name,
          description: item.description,
          icon: item.icon,
          color: item.color,
          groupId: newGroupId,
          tags: item.tags,
          protocol: (item as any).protocol,
          port: (item as any).port,
          path: (item as any).path,
          networkAddresses: (item as any).networkAddresses,
          username: (item as any).username,
          appPath: (item as any).appPath,
          arguments: (item as any).arguments,
          credentials: (item as any).credentials,
          service: (item as any).service,
          url: (item as any).url,
          sshKey: (item as any).sshKey,
        });
        itemsImported++;
      }

      return {
        success: true,
        data: {
          groupsCount: result.data.groups.length,
          itemsCount: itemsImported,
        }
      };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  });

  // Analyze import for conflicts
  ipcMain.handle('data:analyzeImport', async (): Promise<IPCResponse<{
    conflicts: Array<{
      importedGroup: Group;
      existingGroup: Group;
      existingItemCount: number;
    }>;
    safeGroups: Group[];
    safeItems: AnyItem[];
    importData: ExportData;
  }>> => {
    try {
      const result = await importExport.importData();
      if (!result.success || !result.data) {
        return { success: false, error: result.error };
      }

      const database = getDb();
      const existingGroups = database.getAllGroups();
      const existingItems = database.getAllItems();

      // Analyze for conflicts
      const conflicts: Array<{
        importedGroup: Group;
        existingGroup: Group;
        existingItemCount: number;
      }> = [];
      const safeGroups: Group[] = [];
      const safeItems: AnyItem[] = [];

      // Create a map of group IDs to item counts
      const groupItemCounts = new Map<string, number>();
      existingItems.forEach(item => {
        const count = groupItemCounts.get(item.groupId) || 0;
        groupItemCounts.set(item.groupId, count + 1);
      });

      // Check each imported group for conflicts
      result.data.groups.forEach(importedGroup => {
        const existingGroup = existingGroups.find(
          g => g.name.toLowerCase() === importedGroup.name.toLowerCase()
        );

        if (existingGroup) {
          const itemCount = groupItemCounts.get(existingGroup.id) || 0;

          if (itemCount > 0) {
            // Conflict: existing group has items
            conflicts.push({
              importedGroup,
              existingGroup,
              existingItemCount: itemCount,
            });
          } else {
            // Safe: existing group is empty, can be overwritten
            safeGroups.push(importedGroup);
            const groupItems = result.data?.items.filter(i => i.groupId === importedGroup.id) || [];
            safeItems.push(...groupItems);
          }
        } else {
          // Safe: no existing group with this name
          safeGroups.push(importedGroup);
          const groupItems = result.data?.items.filter(i => i.groupId === importedGroup.id) || [];
          safeItems.push(...groupItems);
        }
      });

      return {
        success: true,
        data: {
          conflicts,
          safeGroups,
          safeItems,
          importData: result.data,
        },
      };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  });

  // Import with conflict resolutions
  ipcMain.handle('data:importWithResolutions', async (
    _,
    importData: ExportData,
    safeGroups: Group[],
    safeItems: AnyItem[],
    resolutions: Record<string, 'merge' | 'replace' | 'skip'>
  ): Promise<IPCResponse<{ groupsCount: number; itemsCount: number }>> => {
    try {
      const database = getDb();
      const existingGroups = database.getAllGroups();
      const existingItems = database.getAllItems();

      const groupIdMap = new Map<string, string>();
      let groupsImported = 0;
      let itemsImported = 0;

      // Helper to get unique key for deduplication
      const getItemKey = (item: AnyItem): string => {
        if (item.type === 'bookmark') {
          const bookmark = item as any;
          const url = `${bookmark.protocol}://${bookmark.networkAddresses?.local || ''}${bookmark.port ? `:${bookmark.port}` : ''}${bookmark.path || ''}`;
          return `${item.name.toLowerCase()}|${url.toLowerCase()}`;
        } else if (item.type === 'app') {
          const app = item as any;
          return `${item.name.toLowerCase()}|${app.command?.toLowerCase() || ''}`;
        } else if (item.type === 'ssh') {
          const ssh = item as any;
          return `${item.name.toLowerCase()}|${ssh.host?.toLowerCase() || ''}|${ssh.port || ''}`;
        }
        return item.name.toLowerCase();
      };

      // Import safe groups first
      for (const group of safeGroups) {
        // Check if empty group exists, delete it
        const existingGroup = existingGroups.find(
          g => g.name.toLowerCase() === group.name.toLowerCase()
        );
        if (existingGroup) {
          database.deleteGroup(existingGroup.id);
        }

        const newGroup = database.createGroup({
          name: group.name,
          icon: group.icon,
          color: group.color,
          defaultProfile: group.defaultProfile,
          batchOpenDelay: group.batchOpenDelay,
        });
        groupIdMap.set(group.id, newGroup.id);
        groupsImported++;
      }

      // Import safe items
      for (const item of safeItems) {
        const newGroupId = groupIdMap.get(item.groupId);
        if (!newGroupId) continue;

        database.createItem({
          type: item.type,
          name: item.name,
          description: item.description,
          icon: item.icon,
          color: item.color,
          groupId: newGroupId,
          tags: item.tags,
          protocol: (item as any).protocol,
          port: (item as any).port,
          path: (item as any).path,
          networkAddresses: (item as any).networkAddresses,
          username: (item as any).username,
          appPath: (item as any).appPath,
          arguments: (item as any).arguments,
          credentials: (item as any).credentials,
          service: (item as any).service,
          url: (item as any).url,
          sshKey: (item as any).sshKey,
        });
        itemsImported++;
      }

      // Handle conflict resolutions
      for (const [importedGroupId, resolution] of Object.entries(resolutions)) {
        if (resolution === 'skip') continue;

        const importedGroup = importData.groups.find(g => g.id === importedGroupId);
        if (!importedGroup) continue;

        const existingGroup = existingGroups.find(
          g => g.name.toLowerCase() === importedGroup.name.toLowerCase()
        );
        if (!existingGroup) continue;

        if (resolution === 'replace') {
          // Delete all items in existing group
          const itemsToDelete = existingItems.filter(i => i.groupId === existingGroup.id);
          itemsToDelete.forEach(item => database.deleteItem(item.id));

          // Import all items from imported group
          const itemsToImport = importData.items.filter(i => i.groupId === importedGroupId);
          for (const item of itemsToImport) {
            database.createItem({
              type: item.type,
              name: item.name,
              description: item.description,
              icon: item.icon,
              color: item.color,
              groupId: existingGroup.id,
              tags: item.tags,
              protocol: (item as any).protocol,
              port: (item as any).port,
              path: (item as any).path,
              networkAddresses: (item as any).networkAddresses,
              username: (item as any).username,
              appPath: (item as any).appPath,
              arguments: (item as any).arguments,
            });
            itemsImported++;
          }
          groupsImported++;
        } else if (resolution === 'merge') {
          // Deduplicate and merge
          const existingGroupItems = existingItems.filter(i => i.groupId === existingGroup.id);
          const importedItems = importData.items.filter(i => i.groupId === importedGroupId);

          const existingKeys = new Set(existingGroupItems.map(getItemKey));
          const uniqueNewItems = importedItems.filter(item => !existingKeys.has(getItemKey(item)));

          for (const item of uniqueNewItems) {
            database.createItem({
              type: item.type,
              name: item.name,
              description: item.description,
              icon: item.icon,
              color: item.color,
              groupId: existingGroup.id,
              tags: item.tags,
              protocol: (item as any).protocol,
              port: (item as any).port,
              path: (item as any).path,
              networkAddresses: (item as any).networkAddresses,
              username: (item as any).username,
              appPath: (item as any).appPath,
              arguments: (item as any).arguments,
              credentials: (item as any).credentials,
              service: (item as any).service,
              url: (item as any).url,
              sshKey: (item as any).sshKey,
            });
            itemsImported++;
          }
          groupsImported++;
        }
      }

      return {
        success: true,
        data: {
          groupsCount: groupsImported,
          itemsCount: itemsImported,
        },
      };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  });

  ipcMain.handle('data:importSyncFile', async (): Promise<IPCResponse<{ groupsCount: number; itemsCount: number }>> => {
    try {
      const result = await importExport.importSyncFile();

      if (!result.success || !result.data) {
        return { success: false, error: result.error };
      }

      const database = getDb();

      // Import groups first (to get IDs)
      const groupIdMap = new Map<string, string>();
      for (const group of result.data.groups) {
        const newGroup = database.createGroup({
          name: group.name,
          icon: group.icon,
          color: group.color,
          defaultProfile: group.defaultProfile,
          batchOpenDelay: group.batchOpenDelay,
        });
        groupIdMap.set(group.id, newGroup.id);
      }

      // Import items with mapped group IDs
      let itemsImported = 0;
      for (const item of result.data.items) {
        const newGroupId = groupIdMap.get(item.groupId);
        if (!newGroupId) continue;

        database.createItem({
          type: item.type,
          name: item.name,
          description: item.description,
          icon: item.icon,
          color: item.color,
          groupId: newGroupId,
          tags: item.tags,
          protocol: (item as any).protocol,
          port: (item as any).port,
          path: (item as any).path,
          networkAddresses: (item as any).networkAddresses,
          username: (item as any).username,
          appPath: (item as any).appPath,
          arguments: (item as any).arguments,
          credentials: (item as any).credentials,
          service: (item as any).service,
          url: (item as any).url,
          sshKey: (item as any).sshKey,
        });
        itemsImported++;
      }

      triggerSync();
      return {
        success: true,
        data: {
          groupsCount: result.data.groups.length,
          itemsCount: itemsImported,
        }
      };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  });

  ipcMain.handle('data:importBrowserBookmarks', async (_, groupId: string): Promise<IPCResponse<{ count: number }>> => {
    try {
      const result = await importExport.importBrowserBookmarks();

      if (!result.success || !result.items) {
        return { success: false, error: result.error };
      }

      const database = getDb();
      let imported = 0;

      for (const item of result.items) {
        database.createItem({
          type: 'bookmark',
          name: item.name || 'Imported Bookmark',
          groupId,
          protocol: (item as any).protocol || 'https',
          port: (item as any).port,
          path: (item as any).path,
          networkAddresses: (item as any).networkAddresses,
        });
        imported++;
      }

      return { success: true, data: { count: imported } };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  });

  // ===== Browser Bookmarks Direct Import =====
  ipcMain.handle('browserBookmarks:getAvailable', async (): Promise<IPCResponse<BrowserWithBookmarks[]>> => {
    try {
      const browsers = await browserBookmarks.getBrowsersWithBookmarks();
      return { success: true, data: browsers };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  });

  ipcMain.handle('browserBookmarks:import', async (_, browserId: string, groupId: string): Promise<IPCResponse<{ count: number }>> => {
    try {
      const bookmarks = await browserBookmarks.getBookmarksFromBrowser(browserId);
      const database = getDb();
      let imported = 0;

      for (const bookmark of bookmarks) {
        try {
          const urlObj = new URL(bookmark.url);

          // Skip non-http URLs
          if (!urlObj.protocol.startsWith('http')) continue;

          database.createItem({
            type: 'bookmark',
            name: bookmark.name || 'Imported Bookmark',
            description: bookmark.folder ? `Imported from: ${bookmark.folder}` : undefined,
            groupId,
            protocol: urlObj.protocol.replace(':', '') as any,
            port: urlObj.port ? parseInt(urlObj.port, 10) : undefined,
            path: urlObj.pathname !== '/' ? urlObj.pathname + urlObj.search : undefined,
            networkAddresses: {
              local: urlObj.hostname,
            },
          });
          imported++;
        } catch {
          // Invalid URL, skip
        }
      }

      return { success: true, data: { count: imported } };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  });

  ipcMain.handle('browserBookmarks:preview', async (_, browserId: string): Promise<IPCResponse<BrowserBookmark[]>> => {
    try {
      const bookmarks = await browserBookmarks.getBookmarksFromBrowser(browserId);
      // Return all bookmarks
      return { success: true, data: bookmarks };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  });

  // ===== Encryption =====
  ipcMain.handle('encryption:isSetup', async (): Promise<IPCResponse<boolean>> => {
    try {
      const database = getDb();
      const settings = database.getSettings();
      return { success: true, data: !!settings.encryptionSalt };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  });

  ipcMain.handle('encryption:isUnlocked', async (): Promise<IPCResponse<boolean>> => {
    try {
      return { success: true, data: encryption.isUnlocked() };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  });

  ipcMain.handle('encryption:setup', async (_, password: string): Promise<IPCResponse<boolean>> => {
    try {
      const database = getDb();
      const salt = await encryption.setMasterPassword(password);
      const verificationData = encryption.createVerificationData(password, salt);

      database.updateSettings({
        encryptionSalt: salt,
        encryptionVerification: verificationData,
      });

      return { success: true, data: true };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  });

  ipcMain.handle('encryption:unlock', async (_, password: string): Promise<IPCResponse<boolean>> => {
    try {
      const database = getDb();
      const settings = database.getSettings();

      if (!settings.encryptionSalt || !settings.encryptionVerification) {
        return { success: false, error: 'Encryption not set up' };
      }

      const isValid = await encryption.verifyPassword(
        password,
        settings.encryptionSalt,
        settings.encryptionVerification
      );

      if (isValid) {
        await encryption.setMasterPassword(password, settings.encryptionSalt);
        return { success: true, data: true };
      }

      return { success: false, error: 'Invalid password' };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  });

  ipcMain.handle('encryption:lock', async (): Promise<IPCResponse<boolean>> => {
    try {
      encryption.lock();
      return { success: true, data: true };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  });

  ipcMain.handle('encryption:changePassword', async (_, oldPassword: string, newPassword: string): Promise<IPCResponse<boolean>> => {
    try {
      const database = getDb();
      const settings = database.getSettings();

      if (!settings.encryptionSalt || !settings.encryptionVerification) {
        return { success: false, error: 'Encryption not set up' };
      }

      // Verify old password
      const isValid = await encryption.verifyPassword(
        oldPassword,
        settings.encryptionSalt,
        settings.encryptionVerification
      );

      if (!isValid) {
        return { success: false, error: 'Invalid current password' };
      }

      // 1. Decrypt all existing credentials with old key
      const items = database.getAllItems();
      const itemsToUpdate: {
        id: string;
        decryptedCredentials: { username?: string; password?: string; notes?: string }
      }[] = [];

      for (const item of items) {
        if ((item.type === 'bookmark' || item.type === 'ssh' || item.type === 'password') && item.credentials) {
          try {
            const decrypted: { username?: string; password?: string; notes?: string } = {};

            if (item.credentials.username) {
              decrypted.username = encryption.decrypt(item.credentials.username);
            }
            if (item.credentials.password) {
              decrypted.password = encryption.decrypt(item.credentials.password);
            }
            if (item.credentials.notes) {
              decrypted.notes = encryption.decrypt(item.credentials.notes);
            }

            itemsToUpdate.push({ id: item.id, decryptedCredentials: decrypted });
          } catch (e) {
            console.error(`Failed to decrypt item ${item.id} during password change:`, e);
          }
        }
      }

      // 2. Set up with new password (switches internal key)
      const newSalt = await encryption.setMasterPassword(newPassword);
      const newVerificationData = encryption.createVerificationData(newPassword, newSalt);

      // 3. Re-encrypt all held credentials with new key
      for (const update of itemsToUpdate) {
        const encryptedCreds: { username?: string; password?: string; notes?: string } = {};

        if (update.decryptedCredentials.username) {
          encryptedCreds.username = encryption.encrypt(update.decryptedCredentials.username);
        }
        if (update.decryptedCredentials.password) {
          encryptedCreds.password = encryption.encrypt(update.decryptedCredentials.password);
        }
        if (update.decryptedCredentials.notes) {
          encryptedCreds.notes = encryption.encrypt(update.decryptedCredentials.notes);
        }

        database.updateItem({ id: update.id, credentials: encryptedCreds });
      }

      // 4. Save new settings
      database.updateSettings({
        encryptionSalt: newSalt,
        encryptionVerification: newVerificationData,
      });

      return { success: true, data: true };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  });

  ipcMain.handle('encryption:encrypt', async (_, plaintext: string): Promise<IPCResponse<string>> => {
    try {
      if (!encryption.isUnlocked()) {
        return { success: false, error: 'Vault is locked' };
      }
      const encrypted = encryption.encrypt(plaintext);
      return { success: true, data: encrypted };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  });

  ipcMain.handle('encryption:decrypt', async (_, ciphertext: string): Promise<IPCResponse<string>> => {
    try {
      if (!encryption.isUnlocked()) {
        return { success: false, error: 'Vault is locked' };
      }
      const decrypted = encryption.decrypt(ciphertext);
      return { success: true, data: decrypted };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  });

  ipcMain.handle('encryption:resetVault', async (): Promise<IPCResponse<void>> => {
    try {
      const database = getDb();

      // 1. Clear all credentials from items
      const items = database.getAllItems();
      for (const item of items) {
        if (item.type === 'bookmark' || item.type === 'ssh' || item.type === 'password') {
          database.updateItem({ id: item.id, credentials: undefined });
        }
      }

      // 2. Delete vault settings (salt, verification data)
      database.deleteSetting('encryptionSalt');
      database.deleteSetting('encryptionVerification');

      // 3. Reset encryption service
      encryption.lock();

      return { success: true };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  });

  // ===== Favicon =====
  ipcMain.handle('favicon:get', async (_, url: string, forceRefresh: boolean = false): Promise<IPCResponse<string | null>> => {
    try {
      const favicon = await faviconService.getFavicon(url, forceRefresh);
      return { success: true, data: favicon };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  });

  ipcMain.handle('favicon:getBatch', async (_, urls: string[], forceRefresh: boolean = false): Promise<IPCResponse<Record<string, string | null>>> => {
    try {
      const results = await faviconService.getFavicons(urls, forceRefresh);
      const data: Record<string, string | null> = {};
      results.forEach((value, key) => {
        data[key] = value;
      });
      return { success: true, data };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  });

  ipcMain.handle('favicon:hasFavicon', async (_, url: string): Promise<IPCResponse<boolean>> => {
    try {
      const hasFavicon = faviconService.hasFavicon(url);
      return { success: true, data: hasFavicon };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  });

  ipcMain.handle('favicon:getExpired', async (_, urls: string[]): Promise<IPCResponse<string[]>> => {
    try {
      const expired = faviconService.getExpiredFavicons(urls);
      return { success: true, data: expired };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  });

  // ===== Health Check =====
  ipcMain.handle('healthCheck:checkItem', async (_, itemId: string, profile: NetworkProfile): Promise<IPCResponse<HealthCheckResult>> => {
    try {
      const item = getDb().getItem(itemId);
      if (!item || item.type !== 'bookmark') {
        return { success: false, error: 'Item not found or not a bookmark' };
      }
      const result = await healthCheckService.checkBookmark(item as any, profile);
      return { success: true, data: result };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  });

  ipcMain.handle('healthCheck:checkAll', async (_, profile: NetworkProfile): Promise<IPCResponse<HealthCheckResult[]>> => {
    try {
      const items = getDb().getAllItems().filter(item => item.type === 'bookmark');
      const results = await healthCheckService.checkMultipleBookmarks(items as any[], profile);
      return { success: true, data: results };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  });

  ipcMain.handle('healthCheck:getResults', async (): Promise<IPCResponse<HealthCheckResult[]>> => {
    try {
      const results = healthCheckService.getAllResults();
      return { success: true, data: results };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  });

  ipcMain.handle('healthCheck:clearResults', async (): Promise<IPCResponse<void>> => {
    try {
      healthCheckService.clearResults();
      return { success: true };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  });

  // ===== Sync =====
  ipcMain.handle('sync:testConnection', async (_, url: string, username: string, password: string): Promise<IPCResponse<boolean>> => {
    try {
      const result = await syncService.testConnection(url, username, password);
      return { success: result.success, error: result.error };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  });

  ipcMain.handle('sync:upload', async (): Promise<IPCResponse<void>> => {
    try {
      const database = getDb();
      const settings = database.getSettings();

      if (!settings.syncEnabled || !settings.syncUrl || !settings.syncUsername || !settings.syncPassword) {
        return { success: false, error: 'Sync not configured' };
      }

      if (!encryption.isUnlocked()) {
        return { success: false, error: 'Vault must be unlocked to sync' };
      }

      // Notify renderer that sync is starting
      mainWindow?.webContents.send('sync:status', { syncing: true });

      const groups = database.getAllGroups();
      const items = database.getAllItems();

      const result = await syncService.upload(
        settings.syncUrl,
        settings.syncUsername,
        settings.syncPassword,
        groups,
        items
      );

      if (result.success) {
        // Update last sync time
        const lastSync = new Date().toISOString();
        database.updateSettings({ lastSync });
        // Notify renderer that sync completed
        mainWindow?.webContents.send('sync:status', {
          syncing: false,
          success: true,
          lastSync
        });
      } else {
        // Notify renderer that sync failed
        mainWindow?.webContents.send('sync:status', {
          syncing: false,
          success: false,
          error: result.error
        });
      }

      return { success: result.success, error: result.error };
    } catch (error: any) {
      // Notify renderer that sync failed
      mainWindow?.webContents.send('sync:status', {
        syncing: false,
        success: false,
        error: error.message || 'Sync failed'
      });
      return { success: false, error: String(error) };
    }
  });

  ipcMain.handle('sync:download', async (): Promise<IPCResponse<{ groups: Group[]; items: AnyItem[] } | null>> => {
    try {
      const database = getDb();
      const settings = database.getSettings();

      if (!settings.syncEnabled || !settings.syncUrl || !settings.syncUsername || !settings.syncPassword) {
        return { success: false, error: 'Sync not configured' };
      }

      if (!encryption.isUnlocked()) {
        return { success: false, error: 'Vault must be unlocked to sync' };
      }

      const result = await syncService.download(
        settings.syncUrl,
        settings.syncUsername,
        settings.syncPassword
      );

      if (!result.success || !result.data) {
        return { success: false, error: result.error || 'Download failed' };
      }

      return { success: true, data: { groups: result.data.groups, items: result.data.items } };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  });

  // ===== Dashboard Monitoring =====
  let dashboardPollingInterval: NodeJS.Timeout | null = null;

  ipcMain.handle('dashboard:getMetrics', async (): Promise<IPCResponse<import('../shared/types').ServiceMetrics[]>> => {
    try {
      const items = getDb().getAllItems();
      const bookmarks = items.filter(item => item.type === 'bookmark');
      const settings = getDb().getSettings();

      const metrics: import('../shared/types').ServiceMetrics[] = bookmarks.map(item => {
        const history = healthCheckService?.getMetricsHistory(item.id) || [];
        const uptime = healthCheckService?.calculateUptime(item.id) || 100;
        const lastCheck = history[history.length - 1];

        return {
          itemId: item.id,
          itemName: item.name,
          currentStatus: lastCheck?.success ? 'up' : 'down',
          responseTime: lastCheck?.responseTime || 0,
          uptime: uptime,
          lastChecked: lastCheck?.timestamp || new Date().toISOString(),
          history: history.slice(-20) // Last 20 data points for charts
        };
      });

      return { success: true, data: metrics };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  });

  ipcMain.handle('dashboard:startMonitoring', async (_, interval: number = 30000): Promise<IPCResponse<void>> => {
    try {
      // Clear any existing interval
      if (dashboardPollingInterval) {
        clearInterval(dashboardPollingInterval);
      }

      // Start background polling
      dashboardPollingInterval = setInterval(async () => {
        try {
          const items = getDb().getAllItems();
          const bookmarks = items.filter(item => item.type === 'bookmark') as any[];
          const settings = getDb().getSettings();

          // Check all bookmarks
          for (const bookmark of bookmarks) {
            await healthCheckService?.checkBookmark(bookmark, settings.defaultProfile);
          }

          // Notify renderer of updates
          if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('dashboard:metricsUpdated');
          }
        } catch (error) {
          console.error('Dashboard polling error:', error);
        }
      }, interval);

      return { success: true };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  });

  ipcMain.handle('dashboard:stopMonitoring', async (): Promise<IPCResponse<void>> => {
    try {
      if (dashboardPollingInterval) {
        clearInterval(dashboardPollingInterval);
        dashboardPollingInterval = null;
      }
      return { success: true };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  });

  ipcMain.handle('quickSearch:hide', async () => {
    quickSearchWindow?.hide();
  });
}

// App lifecycle
app.whenReady().then(async () => {
  await initializeServices();
  setupIPC();
  createWindow();

  // Initialize QuickSearch Window
  quickSearchWindow = new QuickSearchWindow(isDev);

  // Register global hotkeys
  registerGlobalHotkeys();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

function registerGlobalHotkeys() {
  const settings = getDb().getSettings();
  const hotkey = settings.globalSearchHotkey || (process.platform === 'darwin' ? 'Option+Space' : 'Alt+Space');

  console.log(`[Hotkey] Attempting to register: ${hotkey}`);

  try {
    const success = globalShortcut.register(hotkey, () => {
      console.log('[Hotkey] Triggered');
      quickSearchWindow?.toggle();
    });

    if (success) {
      console.log(`[Hotkey] Successfully registered: ${hotkey}`);
    } else {
      console.warn(`[Hotkey] Failed to register: ${hotkey}. Hotkey might be already in use.`);
    }
  } catch (error) {
    console.error('[Hotkey] Error during registration:', error);
  }
}

function unregisterGlobalHotkeys() {
  globalShortcut.unregisterAll();
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  unregisterGlobalHotkeys();
  if (db) {
    db.close();
  }
  if (extensionServer) {
    extensionServer.stop();
  }
});
