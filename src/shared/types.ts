// Item Types
export type ItemType = 'bookmark' | 'ssh' | 'app' | 'password';
export type Protocol = 'http' | 'https' | 'ssh' | 'rdp' | 'vnc' | 'ftp' | 'sftp' | 'ftps' | 'smb' | 'afp' | 'nfs' | 'file' | 'postgres' | 'mysql' | 'mongodb' | 'redis' | 'vscode' | 'cursor' | 'jetbrains' | 'git' | 'slack' | 'discord' | 'zoommtg' | 'tg' | 'chrome' | 'edge' | 'brave' | 'opera' | 'chatgpt' | 'about' | 'mailto' | 'custom';
export type NetworkProfile = 'local' | 'tailscale' | 'vpn' | 'custom';

export const NETWORK_PROTOCOLS: Protocol[] = [
  'http', 'https',
  'ftp', 'sftp', 'ftps',
  'smb', 'afp', 'nfs',
  'rdp', 'vnc',
  'postgres', 'mysql', 'mongodb', 'redis',
  'git',
  'ssh'
];

// Core Item Interface
export interface Item {
  id: string;
  type: ItemType;
  name: string;
  description?: string;
  icon?: string;
  color?: string;
  groupId: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
  lastAccessedAt?: string;
  accessCount: number;
  sortOrder: number;
}

// Bookmark specific
export interface BookmarkItem extends Item {
  type: 'bookmark';
  protocol: Protocol;
  port?: number;
  path?: string;
  networkAddresses: {
    local?: string;
    tailscale?: string;
    vpn?: string;
    custom?: string;
  };
  credentials?: EncryptedCredentials;
}

// SSH Connection specific
export interface SSHItem extends Item {
  type: 'ssh';
  username: string;
  port: number;
  networkAddresses: {
    local?: string;
    tailscale?: string;
    vpn?: string;
    custom?: string;
  };
  sshKey?: string;
  credentials?: EncryptedCredentials;
}

// App Shortcut specific
export interface AppItem extends Item {
  type: 'app';
  appPath: string;
  arguments?: string[];
}

// Password Manager specific
export interface PasswordItem extends Item {
  type: 'password';
  service: string; // Service/website name (e.g., "GitHub", "Gmail")
  username?: string;
  url?: string; // Optional URL to open when launching
  credentials?: EncryptedCredentials; // Password and optional notes stored here
}

// Union type for all items
export type AnyItem = BookmarkItem | SSHItem | AppItem | PasswordItem;

// Credentials (encrypted at rest)
export interface EncryptedCredentials {
  username?: string;
  password?: string;
  notes?: string;
  // These are encrypted strings
}

export interface DecryptedCredentials {
  username?: string;
  password?: string;
  notes?: string;
}

// Groups/Folders
export interface Group {
  id: string;
  name: string;
  icon?: string;
  color?: string;
  parentId?: string;
  sortOrder: number;
  isExpanded: boolean;
  defaultProfile: NetworkProfile;
  batchOpenDelay: number; // ms between opens
  createdAt: string;
  updatedAt: string;
}

// Browser
export interface Browser {
  id: string;
  name: string;
  path: string;
  icon: string;
}

// Settings
export interface AppSettings {
  theme: 'dark' | 'light' | 'system';
  defaultProfile: NetworkProfile;
  defaultBrowser: string; // browser id
  masterPasswordHash?: string;
  tailscaleEnabled: boolean;
  tailscalePath?: string;
  defaultTerminal: string;
  syncEnabled: boolean;
  syncUrl?: string;
  syncUsername?: string;
  syncPassword?: string; // encrypted
  lastSync?: string; // ISO timestamp
  autoLockMinutes: number;
  showInMenuBar: boolean;
  launchAtStartup: boolean;
  cardViewMode: 'normal' | 'compact' | 'list'; // Card display mode
  // AI Features
  aiEnabled: boolean;
  smartRoutingEnabled: boolean;
  advancedMode: boolean; // Toggle for advanced features (Tailscale, VPN, etc)
  groqApiKey?: string; // Encrypted
  globalSearchHotkey: string;
  // Keyboard shortcuts
  keyboardShortcuts: {
    newItem: string;
    newGroup: string;
    openSettings: string;
    focusSearch: string;
    lockVault: string;
    commandPalette: string;
    selectGroup1: string;
    selectGroup2: string;
    selectGroup3: string;
    selectGroup4: string;
    selectGroup5: string;
    selectGroup6: string;
    selectGroup7: string;
    selectGroup8: string;
    selectGroup9: string;
    showAllGroups: string;
  };
  // Encryption
  encryptionSalt?: string;
  encryptionVerification?: string;

  // Auto Backup
  backupEnabled: boolean;
  backupFrequency: 'daily' | 'weekly' | 'manual';
  backupRetentionCount: number;
  lastAutoBackup?: string; // ISO timestamp
  backupPath?: string; // Custom backup location
}

// Tailscale Status
export interface TailscaleStatus {
  connected: boolean;
  tailnetName?: string;
  ipAddress?: string;
  hostname?: string;
}

// IPC Types
export interface IPCResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

// Database operations
export interface CreateItemInput {
  type: ItemType;
  name: string;
  description?: string;
  icon?: string;
  color?: string;
  groupId: string;
  tags?: string[];
  // Type-specific fields
  protocol?: Protocol;
  port?: number;
  path?: string;
  networkAddresses?: {
    local?: string;
    tailscale?: string;
    vpn?: string;
    custom?: string;
  };
  username?: string;
  sshKey?: string;
  appPath?: string;
  arguments?: string[];
  // Password item specific
  service?: string;
  url?: string;
  // Credentials (encrypted)
  credentials?: {
    username?: string;
    password?: string;
    notes?: string;
  };
}

export interface UpdateItemInput extends Partial<CreateItemInput> {
  id: string;
}

export interface CreateGroupInput {
  name: string;
  icon?: string;
  color?: string;
  parentId?: string;
  defaultProfile?: NetworkProfile;
  batchOpenDelay?: number;
}

export interface UpdateGroupInput extends Partial<CreateGroupInput> {
  id: string;
  isExpanded?: boolean;
  sortOrder?: number;
}

// Search/Filter
export interface SearchFilters {
  query?: string;
  type?: ItemType;
  groupId?: string;
  tags?: string[];
}

// Dashboard Metrics
export interface ServiceMetrics {
  itemId: string;
  itemName: string;
  currentStatus: 'up' | 'down' | 'degraded';
  responseTime: number; // ms
  uptime: number; // percentage (0-100)
  lastChecked: string; // ISO timestamp
  history: MetricDataPoint[];
}

export interface MetricDataPoint {
  timestamp: string;
  responseTime: number;
  success: boolean;
}
