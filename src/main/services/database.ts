import initSqlJs from 'sql.js';
import type { Database as SqlJsDatabase } from 'sql.js';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { dirname } from 'path';
import { randomUUID } from 'crypto';
import {
  AnyItem,
  BookmarkItem,
  SSHItem,
  AppItem,
  PasswordItem,
  Group,
  CreateItemInput,
  UpdateItemInput,
  CreateGroupInput,
  UpdateGroupInput,
  AppSettings,
  ItemType,
} from '../../shared/types';

export class DatabaseService {
  private db: SqlJsDatabase | null = null;
  private dbPath: string;
  private saveTimeout: NodeJS.Timeout | null = null;

  constructor(dbPath: string) {
    this.dbPath = dbPath;
  }

  async initialize(): Promise<void> {
    const SQL = await initSqlJs();

    // Ensure directory exists
    const dir = dirname(this.dbPath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }

    // Load existing database or create new
    if (existsSync(this.dbPath)) {
      const buffer = readFileSync(this.dbPath);
      this.db = new SQL.Database(buffer);
    } else {
      this.db = new SQL.Database();
    }

    this.createTables();
    this.seedDefaultData();
    this.save();
  }

  private save(): void {
    // Debounce saves
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout);
    }
    this.saveTimeout = setTimeout(() => {
      if (this.db) {
        const data = this.db.export();
        const buffer = Buffer.from(data);
        writeFileSync(this.dbPath, buffer);
      }
    }, 100);
  }

  private createTables(): void {
    // Groups table
    this.db!.run(`
      CREATE TABLE IF NOT EXISTS groups (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        icon TEXT,
        color TEXT,
        parent_id TEXT,
        sort_order INTEGER DEFAULT 0,
        is_expanded INTEGER DEFAULT 1,
        default_profile TEXT DEFAULT 'local',
        batch_open_delay INTEGER DEFAULT 500,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (parent_id) REFERENCES groups(id) ON DELETE SET NULL
      )
    `);

    // Items table
    this.db!.run(`
      CREATE TABLE IF NOT EXISTS items (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        name TEXT NOT NULL,
        description TEXT,
        icon TEXT,
        color TEXT,
        group_id TEXT NOT NULL,
        tags TEXT DEFAULT '[]',
        sort_order INTEGER DEFAULT 0,
        access_count INTEGER DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        last_accessed_at TEXT,
        
        protocol TEXT,
        port INTEGER,
        path TEXT,
        network_addresses TEXT DEFAULT '{}',
        username TEXT,
        ssh_key TEXT,
        app_path TEXT,
        app_arguments TEXT,
        service TEXT,
        url TEXT,
        credentials TEXT,
        
        FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE
      )
    `);

    // Settings table
    this.db!.run(`
      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      )
    `);

    // Migrate: Add credentials column if it doesn't exist
    this.migrateAddCredentialsColumn();

    // Migrate: Add service and url columns for password items
    this.migrateAddPasswordColumns();

    // Create indexes
    this.db!.run(`CREATE INDEX IF NOT EXISTS idx_items_group_id ON items(group_id)`);
    this.db!.run(`CREATE INDEX IF NOT EXISTS idx_items_type ON items(type)`);
    this.db!.run(`CREATE INDEX IF NOT EXISTS idx_items_name ON items(name)`);
    this.db!.run(`CREATE INDEX IF NOT EXISTS idx_groups_parent_id ON groups(parent_id)`);
  }

  private seedDefaultData(): void {
    // Check if we have any groups
    const result = this.db!.exec('SELECT COUNT(*) as count FROM groups');
    const groupCount = result.length > 0 ? result[0].values[0][0] as number : 0;

    if (groupCount === 0) {
      const now = new Date().toISOString();
      const defaultGroups = [
        { id: randomUUID(), name: 'Servers', icon: '🖥️', color: '#6366f1', sort_order: 0 },
        { id: randomUUID(), name: 'SSH Connections', icon: '🔒', color: '#10b981', sort_order: 1 },
        { id: randomUUID(), name: 'Applications', icon: '🚀', color: '#f59e0b', sort_order: 2 },
        { id: randomUUID(), name: 'Media', icon: '🎬', color: '#ec4899', sort_order: 3 },
      ];

      for (const group of defaultGroups) {
        this.db!.run(
          `INSERT INTO groups (id, name, icon, color, sort_order, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [group.id, group.name, group.icon, group.color, group.sort_order, now, now]
        );
      }
    }

    // Initialize default settings if not present
    const settingsResult = this.db!.exec('SELECT COUNT(*) as count FROM settings');
    const settingsCount = settingsResult.length > 0 ? settingsResult[0].values[0][0] as number : 0;

    if (settingsCount === 0) {
      const defaultSettings: AppSettings = {
        theme: 'dark',
        defaultProfile: 'local',
        defaultBrowser: 'default',
        tailscaleEnabled: true,
        defaultTerminal: process.platform === 'darwin' ? 'Terminal' : 'cmd',
        syncEnabled: false,
        autoLockMinutes: 0,
        showInMenuBar: false,
        launchAtStartup: false,
        cardViewMode: 'normal',
        aiEnabled: false,
        advancedMode: false,
        smartRoutingEnabled: true, // Let's default it to true since it's a "killer" feature
        groqApiKey: undefined,
        globalSearchHotkey: process.platform === 'darwin' ? 'Option+Space' : 'Alt+Space',
        keyboardShortcuts: {
          newItem: 'Meta+N',
          newGroup: 'Meta+G',
          openSettings: 'Meta+,',
          focusSearch: 'Meta+F',
          lockVault: 'Meta+L',
          commandPalette: 'Meta+K',
          selectGroup1: '1',
          selectGroup2: '2',
          selectGroup3: '3',
          selectGroup4: '4',
          selectGroup5: '5',
          selectGroup6: '6',
          selectGroup7: '7',
          selectGroup8: '8',
          selectGroup9: '9',
          showAllGroups: '0',
        },
        backupEnabled: true,
        backupFrequency: 'daily',
        backupRetentionCount: 30,
      };

      for (const [key, value] of Object.entries(defaultSettings)) {
        this.db!.run('INSERT INTO settings (key, value) VALUES (?, ?)', [key, JSON.stringify(value)]);
      }
    }

    this.save();
  }

  // ===== Items =====
  getAllItems(): AnyItem[] {
    const result = this.db!.exec('SELECT * FROM items ORDER BY sort_order');
    if (result.length === 0) return [];
    return this.rowsToItems(result[0]);
  }

  getItemsByGroup(groupId: string): AnyItem[] {
    const stmt = this.db!.prepare('SELECT * FROM items WHERE group_id = ? ORDER BY sort_order');
    stmt.bind([groupId]);
    const items: AnyItem[] = [];
    while (stmt.step()) {
      items.push(this.rowToItem(stmt.getAsObject()));
    }
    stmt.free();
    return items;
  }

  getItem(id: string): AnyItem | null {
    const stmt = this.db!.prepare('SELECT * FROM items WHERE id = ?');
    stmt.bind([id]);
    if (stmt.step()) {
      const item = this.rowToItem(stmt.getAsObject());
      stmt.free();
      return item;
    }
    stmt.free();
    return null;
  }

  createItem(input: CreateItemInput): AnyItem {
    const id = randomUUID();
    const now = new Date().toISOString();

    // Get next sort order for the group
    const orderResult = this.db!.exec(`SELECT MAX(sort_order) as max FROM items WHERE group_id = '${input.groupId}'`);
    const maxOrder = orderResult.length > 0 && orderResult[0].values[0][0] !== null
      ? orderResult[0].values[0][0] as number
      : -1;
    const sortOrder = maxOrder + 1;

    this.db!.run(`
      INSERT INTO items (
        id, type, name, description, icon, color, group_id, tags, sort_order,
        protocol, port, path, network_addresses, username, ssh_key, app_path, app_arguments,
        service, url, credentials, created_at, updated_at, access_count
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      id,
      input.type,
      input.name,
      input.description || null,
      input.icon || null,
      input.color || null,
      input.groupId,
      JSON.stringify(input.tags || []),
      sortOrder,
      input.protocol || null,
      input.port || null,
      input.path || null,
      JSON.stringify(input.networkAddresses || {}),
      input.username || null,
      input.sshKey || null,
      input.appPath || null,
      input.arguments ? JSON.stringify(input.arguments) : null,
      input.service || null,
      input.url || null,
      input.credentials ? JSON.stringify(input.credentials) : null,
      now,
      now,
      0
    ]);

    this.save();
    return this.getItem(id)!;
  }

  updateItem(input: UpdateItemInput): AnyItem {
    const now = new Date().toISOString();
    const existing = this.getItem(input.id);
    if (!existing) throw new Error('Item not found');

    const updates: string[] = ['updated_at = ?'];
    const values: any[] = [now];

    const fieldMap: Record<string, string> = {
      name: 'name',
      description: 'description',
      icon: 'icon',
      color: 'color',
      groupId: 'group_id',
      protocol: 'protocol',
      port: 'port',
      path: 'path',
      username: 'username',
      sshKey: 'ssh_key',
      appPath: 'app_path',
      service: 'service',
      url: 'url',
    };

    for (const [key, column] of Object.entries(fieldMap)) {
      if (key in input && (input as any)[key] !== undefined) {
        updates.push(`${column} = ?`);
        values.push((input as any)[key]);
      }
    }

    if (input.tags) {
      updates.push('tags = ?');
      values.push(JSON.stringify(input.tags));
    }

    if (input.networkAddresses) {
      updates.push('network_addresses = ?');
      values.push(JSON.stringify(input.networkAddresses));
    }

    if (input.arguments) {
      updates.push('app_arguments = ?');
      values.push(JSON.stringify(input.arguments));
    }

    if (input.credentials !== undefined) {
      updates.push('credentials = ?');
      values.push(input.credentials ? JSON.stringify(input.credentials) : null);
    }

    values.push(input.id);

    this.db!.run(`UPDATE items SET ${updates.join(', ')} WHERE id = ?`, values);
    this.save();
    return this.getItem(input.id)!;
  }

  deleteItem(id: string): void {
    this.db!.run('DELETE FROM items WHERE id = ?', [id]);
    this.save();
  }

  batchDeleteItems(ids: string[]): void {
    if (ids.length === 0) return;

    // Delete all items in a loop (more efficient than individual saves)
    for (const id of ids) {
      this.db!.run('DELETE FROM items WHERE id = ?', [id]);
    }

    // Only save once after all deletions (this is the key optimization)
    this.save();
  }

  bulkReplaceAddress(ids: string[], searchText: string, replacementText: string, profile: string = 'all', useRegex: boolean = false): void {
    if (ids.length === 0) return;

    for (const id of ids) {
      const item = this.getItem(id);
      if (!item || !('networkAddresses' in item)) continue;

      const networkAddresses = { ...item.networkAddresses };
      let updated = false;

      const profiles = profile === 'all'
        ? ['local', 'tailscale', 'vpn', 'custom'] as const
        : [profile] as const;

      for (const p of profiles) {
        if (networkAddresses[p as keyof typeof networkAddresses]) {
          const originalValue = networkAddresses[p as keyof typeof networkAddresses]!;
          let newValue = originalValue;

          if (useRegex) {
            try {
              const regex = new RegExp(searchText, 'g');
              newValue = originalValue.replace(regex, replacementText);
            } catch (e) {
              console.error('Invalid regex:', searchText);
              // Fallback to simple replacement or just skip? 
              // Better to skip if regex is invalid to avoid unexpected behavior.
              continue;
            }
          } else {
            if (originalValue.includes(searchText)) {
              newValue = originalValue.split(searchText).join(replacementText);
            }
          }

          if (newValue !== originalValue) {
            networkAddresses[p as keyof typeof networkAddresses] = newValue;
            updated = true;
          }
        }
      }

      if (updated) {
        this.updateItem({
          id,
          networkAddresses
        });
      }
    }
    this.save();
  }

  reorderItems(items: { id: string; sortOrder: number }[]): void {
    for (const item of items) {
      this.db!.run('UPDATE items SET sort_order = ? WHERE id = ?', [item.sortOrder, item.id]);
    }
    this.save();
  }

  reorderGroups(groups: { id: string; sortOrder: number }[]): void {
    for (const group of groups) {
      this.db!.run('UPDATE groups SET sort_order = ? WHERE id = ?', [group.sortOrder, group.id]);
    }
    this.save();
  }

  incrementAccessCount(id: string): void {
    const now = new Date().toISOString();
    this.db!.run(
      'UPDATE items SET access_count = access_count + 1, last_accessed_at = ? WHERE id = ?',
      [now, id]
    );
    this.save();
  }

  getRecentItems(limit: number = 30): AnyItem[] {
    const stmt = this.db!.prepare(
      'SELECT * FROM items WHERE last_accessed_at IS NOT NULL ORDER BY last_accessed_at DESC LIMIT ?'
    );
    stmt.bind([limit]);
    const items: AnyItem[] = [];
    while (stmt.step()) {
      items.push(this.rowToItem(stmt.getAsObject()));
    }
    stmt.free();
    return items;
  }

  searchItems(query: string): AnyItem[] {
    const pattern = `%${query}%`;
    const stmt = this.db!.prepare(`
      SELECT * FROM items 
      WHERE name LIKE ? OR description LIKE ? OR tags LIKE ?
      ORDER BY access_count DESC, name
    `);
    stmt.bind([pattern, pattern, pattern]);
    const items: AnyItem[] = [];
    while (stmt.step()) {
      items.push(this.rowToItem(stmt.getAsObject()));
    }
    stmt.free();
    return items;
  }

  // ===== Groups =====
  getAllGroups(): Group[] {
    const result = this.db!.exec('SELECT * FROM groups ORDER BY sort_order');
    if (result.length === 0) return [];
    return result[0].values.map((row: any[]) => {
      const obj: Record<string, any> = {};
      result[0].columns.forEach((col: string, j: number) => {
        obj[col] = row[j];
      });
      return this.rowToGroup(obj);
    });
  }

  getGroup(id: string): Group | null {
    const stmt = this.db!.prepare('SELECT * FROM groups WHERE id = ?');
    stmt.bind([id]);
    if (stmt.step()) {
      const group = this.rowToGroup(stmt.getAsObject());
      stmt.free();
      return group;
    }
    stmt.free();
    return null;
  }

  createGroup(input: CreateGroupInput): Group {
    const id = randomUUID();
    const now = new Date().toISOString();

    const orderResult = this.db!.exec('SELECT MAX(sort_order) as max FROM groups');
    const maxOrder = orderResult.length > 0 && orderResult[0].values[0][0] !== null
      ? orderResult[0].values[0][0] as number
      : -1;
    const sortOrder = maxOrder + 1;

    this.db!.run(`
      INSERT INTO groups (id, name, icon, color, parent_id, default_profile, batch_open_delay, sort_order, is_expanded, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      id,
      input.name,
      input.icon || null,
      input.color || null,
      input.parentId || null,
      input.defaultProfile || 'local',
      input.batchOpenDelay || 500,
      sortOrder,
      1,
      now,
      now
    ]);

    this.save();
    return this.getGroup(id)!;
  }

  updateGroup(input: UpdateGroupInput): Group {
    const now = new Date().toISOString();
    const existing = this.getGroup(input.id);
    if (!existing) throw new Error('Group not found');

    const updates: string[] = ['updated_at = ?'];
    const values: any[] = [now];

    const fieldMap: Record<string, string> = {
      name: 'name',
      icon: 'icon',
      color: 'color',
      parentId: 'parent_id',
      defaultProfile: 'default_profile',
      batchOpenDelay: 'batch_open_delay',
      sortOrder: 'sort_order',
    };

    for (const [key, column] of Object.entries(fieldMap)) {
      if (key in input && (input as any)[key] !== undefined) {
        updates.push(`${column} = ?`);
        values.push((input as any)[key]);
      }
    }

    if ('isExpanded' in input) {
      updates.push('is_expanded = ?');
      values.push(input.isExpanded ? 1 : 0);
    }

    values.push(input.id);

    this.db!.run(`UPDATE groups SET ${updates.join(', ')} WHERE id = ?`, values);
    this.save();
    return this.getGroup(input.id)!;
  }

  deleteGroup(id: string): void {
    // Delete items in the group first
    this.db!.run('DELETE FROM items WHERE group_id = ?', [id]);
    this.db!.run('DELETE FROM groups WHERE id = ?', [id]);
    this.save();
  }

  // ===== Settings =====
  getSettings(): AppSettings {
    const result = this.db!.exec('SELECT key, value FROM settings');
    const settings: Record<string, any> = {};
    if (result.length > 0) {
      for (const row of result[0].values) {
        settings[row[0] as string] = JSON.parse(row[1] as string);
      }
    }

    // Ensure keyboardShortcuts exist with defaults
    if (!settings.keyboardShortcuts) {
      settings.keyboardShortcuts = {
        newItem: 'Meta+N',
        newGroup: 'Meta+G',
        openSettings: 'Meta+,',
        focusSearch: 'Meta+F',
        lockVault: 'Meta+L',
        commandPalette: 'Meta+K',
        selectGroup1: '1',
        selectGroup2: '2',
        selectGroup3: '3',
        selectGroup4: '4',
        selectGroup5: '5',
        selectGroup6: '6',
        selectGroup7: '7',
        selectGroup8: '8',
        selectGroup9: '9',
        showAllGroups: '0',
      };
      // Save the defaults
      this.db!.run('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)',
        ['keyboardShortcuts', JSON.stringify(settings.keyboardShortcuts)]);
      this.save();
    }

    return settings as AppSettings;
  }

  updateSettings(updates: Partial<AppSettings>): AppSettings {
    for (const [key, value] of Object.entries(updates)) {
      this.db!.run('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', [key, JSON.stringify(value)]);
    }
    this.save();
    return this.getSettings();
  }

  deleteSetting(key: string): void {
    this.db!.run('DELETE FROM settings WHERE key = ?', [key]);
    this.save();
  }

  // ===== Helpers =====
  private rowsToItems(result: { columns: string[]; values: any[][] }): AnyItem[] {
    return result.values.map((row: any[]) => {
      const obj: Record<string, any> = {};
      result.columns.forEach((col: string, i: number) => {
        obj[col] = row[i];
      });
      return this.rowToItem(obj);
    });
  }

  // Optimized JSON parse helper with error handling
  private safeJsonParse<T>(json: string | null | undefined, defaultValue: T): T {
    if (!json) return defaultValue;
    try {
      return JSON.parse(json) as T;
    } catch {
      return defaultValue;
    }
  }

  private rowToItem(row: Record<string, any>): AnyItem {
    const base = {
      id: row.id,
      name: row.name,
      description: row.description,
      icon: row.icon,
      color: row.color,
      groupId: row.group_id,
      tags: this.safeJsonParse(row.tags, []),
      sortOrder: row.sort_order,
      accessCount: row.access_count,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      lastAccessedAt: row.last_accessed_at,
    };

    switch (row.type as ItemType) {
      case 'bookmark':
        return {
          ...base,
          type: 'bookmark',
          protocol: row.protocol,
          port: row.port,
          path: row.path,
          networkAddresses: this.safeJsonParse(row.network_addresses, {}),
          credentials: row.credentials ? this.safeJsonParse(row.credentials, undefined) : undefined,
        } as BookmarkItem;

      case 'ssh':
        return {
          ...base,
          type: 'ssh',
          username: row.username,
          port: row.port || 22,
          networkAddresses: this.safeJsonParse(row.network_addresses, {}),
          sshKey: row.ssh_key,
          credentials: row.credentials ? this.safeJsonParse(row.credentials, undefined) : undefined,
        } as SSHItem;

      case 'app':
        return {
          ...base,
          type: 'app',
          appPath: row.app_path,
          arguments: row.app_arguments ? this.safeJsonParse(row.app_arguments, undefined) : undefined,
        } as AppItem;

      case 'password':
        return {
          ...base,
          type: 'password',
          service: row.service || row.name, // Fallback to name if service not set
          username: row.username,
          url: row.url,
          credentials: row.credentials ? this.safeJsonParse(row.credentials, undefined) : undefined,
        } as PasswordItem;

      default:
        throw new Error(`Unknown item type: ${row.type}`);
    }
  }

  private migrateAddCredentialsColumn(): void {
    try {
      // Check if credentials column exists
      const result = this.db!.exec("PRAGMA table_info(items)");
      if (result.length > 0) {
        const columns = result[0].values.map(row => row[1]);
        if (!columns.includes('credentials')) {
          console.log('Migration: Adding credentials column to items table');
          this.db!.run('ALTER TABLE items ADD COLUMN credentials TEXT');
          this.save();
        }
      }
    } catch (error) {
      console.error('Migration error:', error);
    }
  }

  private migrateAddPasswordColumns(): void {
    try {
      // Check if service and url columns exist
      const result = this.db!.exec("PRAGMA table_info(items)");
      if (result.length > 0) {
        const columns = result[0].values.map(row => row[1]);
        if (!columns.includes('service')) {
          console.log('Migration: Adding service column to items table');
          this.db!.run('ALTER TABLE items ADD COLUMN service TEXT');
        }
        if (!columns.includes('url')) {
          console.log('Migration: Adding url column to items table');
          this.db!.run('ALTER TABLE items ADD COLUMN url TEXT');
        }
        this.save();
      }
    } catch (error) {
      console.error('Migration error:', error);
    }
  }

  updateLastAccessed(id: string): void {
    const timestamp = new Date().toISOString();
    this.db!.run(
      'UPDATE items SET last_accessed_at = ?, access_count = access_count + 1 WHERE id = ?',
      [timestamp, id]
    );
    this.save();
  }

  private rowToGroup(row: Record<string, any>): Group {
    return {
      id: row.id,
      name: row.name,
      icon: row.icon,
      color: row.color,
      parentId: row.parent_id,
      sortOrder: row.sort_order,
      isExpanded: Boolean(row.is_expanded),
      defaultProfile: row.default_profile,
      batchOpenDelay: row.batch_open_delay,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  close(): void {
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout);
    }
    if (this.db) {
      // Final save
      const data = this.db.export();
      const buffer = Buffer.from(data);
      writeFileSync(this.dbPath, buffer);
      this.db.close();
    }
  }
}
