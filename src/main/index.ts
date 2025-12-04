import { app, BrowserWindow, ipcMain, shell, nativeTheme } from 'electron';
import path from 'path';
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

const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

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
    mainWindow.loadURL('http://localhost:5173');
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
  
  db = new DatabaseService(path.join(userDataPath, 'launchpad.db'));
  await db.initialize();
  
  tailscale = new TailscaleService();
  browserService = new BrowserService();
  launcher = new LauncherService(browserService);
  encryption = new EncryptionService();
  importExport = new ImportExportService();
  browserBookmarks = new BrowserBookmarksService();
  faviconService = new FaviconService();
  healthCheckService = new HealthCheckService();
  syncService = new SyncService(encryption);
  extensionServer = new ExtensionServer(db);
  
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
      const item = getDb().updateItem(input);
      triggerSync();
      return { success: true, data: item };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  });

  ipcMain.handle('items:delete', async (_, id: string): Promise<IPCResponse<void>> => {
    try {
      getDb().deleteItem(id);
      triggerSync();
      return { success: true };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  });

  ipcMain.handle('items:batchDelete', async (_, ids: string[]): Promise<IPCResponse<void>> => {
    try {
      getDb().batchDeleteItems(ids);
      triggerSync();
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
  ipcMain.handle('launch:item', async (_, item: AnyItem, profile: NetworkProfile, browserId?: string): Promise<IPCResponse<void>> => {
    try {
      let decryptedPassword: string | undefined;
      
      // For SSH items, try to decrypt the password if it exists
      if (item.type === 'ssh') {
        const sshItem = item as any;
        if (sshItem.credentials?.password && encryption.isUnlocked()) {
          try {
            const decrypted = encryption.decrypt(sshItem.credentials.password);
            // Only use password if it's not empty
            if (decrypted && decrypted.trim()) {
              decryptedPassword = decrypted;
            }
          } catch (err) {
            console.log('Could not decrypt SSH password:', err);
            // No password will be used - standard SSH
          }
        }
      }
      
      await launcher.launchItem(item, profile, browserId, decryptedPassword);
      getDb().incrementAccessCount(item.id);
      return { success: true };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  });

  ipcMain.handle('launch:group', async (_, groupId: string, profile: NetworkProfile, browserId?: string): Promise<IPCResponse<void>> => {
    try {
      const database = getDb();
      const items = database.getItemsByGroup(groupId);
      const group = database.getGroup(groupId);
      const delay = group?.batchOpenDelay || 500;
      
      for (let i = 0; i < items.length; i++) {
        await launcher.launchItem(items[i], profile, browserId);
        database.incrementAccessCount(items[i].id);
        if (i < items.length - 1) {
          await new Promise(resolve => setTimeout(resolve, delay));
        }
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
      return { success: true, data: updated };
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
      
      // Set up with new password
      const newSalt = await encryption.setMasterPassword(newPassword);
      const newVerificationData = encryption.createVerificationData(newPassword, newSalt);
      
      // TODO: Re-encrypt all stored credentials with new key
      
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
        if (settings.syncEnabled && encryption.isUnlocked()) {
          // Notify renderer that sync is starting
          mainWindow?.webContents.send('sync:status', { syncing: true });
          
          // Sync in background, don't wait for result
          syncService.upload(
            settings.syncUrl!,
            settings.syncUsername!,
            settings.syncPassword!,
            getDb().getAllGroups(),
            getDb().getAllItems()
          ).then((result) => {
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
          }).catch((error) => {
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
}

// App lifecycle
app.whenReady().then(async () => {
  await initializeServices();
  setupIPC();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  if (db) {
    db.close();
  }
  if (extensionServer) {
    extensionServer.stop();
  }
});
