import { useState, useEffect } from 'react';
import {
  X, RefreshCw, Download, Upload, FileUp, Check, Globe,
  Settings, Wifi, Database, Info, Terminal, Palette, Image, Loader2, Shield,
  Lock, Eye, EyeOff, AlertCircle, Keyboard, Command, Cloud, CloudOff, CheckCircle2,
  Sparkles, Key, Archive, Folder, FolderOpen
} from 'lucide-react';
import { useStore } from '../../store/useStore';
import { ImportBrowserModal } from './ImportBrowserModal';
import { KeyboardShortcutRecorder } from '../KeyboardShortcutRecorder';
import { ImportConflictModal, type GroupConflict } from './ImportConflictModal';
import type { NetworkProfile } from '@shared/types';
import type { ExportData } from '../../../main/services/importExport';

type SettingsTab = 'general' | 'security' | 'network' | 'terminal' | 'shortcuts' | 'data' | 'ai' | 'extensions' | 'about';

const TABS: { id: SettingsTab; label: string; icon: typeof Settings }[] = [
  { id: 'general', label: 'General', icon: Palette },
  { id: 'security', label: 'Security', icon: Shield },
  { id: 'network', label: 'Network', icon: Wifi },
  { id: 'terminal', label: 'Terminal', icon: Terminal },
  { id: 'shortcuts', label: 'Shortcuts', icon: Keyboard },
  { id: 'data', label: 'Data', icon: Database },
  { id: 'ai', label: 'AI Features', icon: Sparkles },
  { id: 'extensions', label: 'Extensions', icon: Globe },
  { id: 'about', label: 'About', icon: Info },
];

const isMac = typeof navigator !== 'undefined' && navigator.platform.toUpperCase().indexOf('MAC') >= 0;
const cmdKey = isMac ? '⌘' : 'Ctrl';

const SHORTCUTS = [
  { keys: [`${cmdKey}`, 'N'], description: 'New item' },
  { keys: [`${cmdKey}`, 'G'], description: 'New group' },
  { keys: [`${cmdKey}`, ','], description: 'Open settings' },
  { keys: [`${cmdKey}`, 'K'], description: 'Focus search' },
  { keys: [`${cmdKey}`, 'L'], description: 'Lock vault' },
  { keys: ['1-9'], description: 'Select group' },
  { keys: ['0'], description: 'Show all groups' },
  { keys: ['Esc'], description: 'Close modal / Clear search' },
  { keys: [isMac ? '⌥' : 'Alt', 'Space'], description: 'Global Search (Quick Launcher)' },
];

const UpdateChecker = () => {
  const [status, setStatus] = useState<any>({ status: 'idle' });

  useEffect(() => {
    // Subscribe to update status
    const unsubscribe = window.api.update.onStatusChange((newStatus: any) => {
      console.log('Update Status:', newStatus);
      setStatus(newStatus);
    });
    return () => unsubscribe();
  }, []);

  const checkUpdates = async () => {
    setStatus({ status: 'checking' });
    try {
      await window.api.update.checkForUpdates();
    } catch (err) {
      console.error('Failed to check for updates:', err);
      setStatus({ status: 'error', error: 'Failed to check' });
    }
  };

  const installUpdate = () => {
    window.api.update.quitAndInstall();
  };

  if (status.status === 'checking') {
    return (
      <button disabled className="btn-secondary text-xs px-3 py-1.5 opacity-70">
        <RefreshCw className="w-3 h-3 animate-spin mr-2" />
        Checking...
      </button>
    );
  }

  if (status.status === 'downloading') {
    return (
      <button disabled className="btn-secondary text-xs px-3 py-1.5">
        <Download className="w-3 h-3 mr-2 animate-bounce" />
        Downloading {Math.round(status.progress?.percent || 0)}%
      </button>
    );
  }

  if (status.status === 'downloaded') {
    return (
      <button onClick={installUpdate} className="btn-primary text-xs px-3 py-1.5 bg-accent-success hover:bg-accent-success/90">
        <RefreshCw className="w-3 h-3 mr-2" />
        Restart & Install
      </button>
    );
  }

  if (status.status === 'available') {
    return (
      <button disabled className="btn-secondary text-xs px-3 py-1.5">
        <Download className="w-3 h-3 mr-2" />
        Update Available
      </button>
    );
  }

  if (status.status === 'not-available') {
    return (
      <button onClick={checkUpdates} className="btn-secondary text-xs px-3 py-1.5 text-accent-success hover:text-accent-success/80">
        <CheckCircle2 className="w-3 h-3 mr-2" />
        Up to Date
      </button>
    );
  }

  if (status.status === 'error') {
    return (
      <button onClick={checkUpdates} className="btn-secondary text-xs px-3 py-1.5 text-accent-danger hover:text-accent-danger/80" title={status.error}>
        <AlertCircle className="w-3 h-3 mr-2" />
        Check Failed
      </button>
    );
  }

  return (
    <button onClick={checkUpdates} className="btn-secondary text-xs px-3 py-1.5">
      <RefreshCw className="w-3 h-3 mr-2" />
      Check for Updates
    </button>
  );
};

export function SettingsModal() {
  const { isSettingsOpen, closeSettings, settings, tailscaleStatus, refreshTailscaleStatus, groups, loadData, fetchFavicons, isFetchingFavicons, faviconProgress, isVaultSetup, lockVault } = useStore();

  // Helper to update settings and refresh store
  const updateSettings = async (updates: Partial<typeof settings>) => {
    // Ensure keyboardShortcuts are fully defined if being updated
    if (updates.keyboardShortcuts) {
      const currentShortcuts = (settings?.keyboardShortcuts || {}) as any;
      updates.keyboardShortcuts = {
        newItem: updates.keyboardShortcuts?.newItem ?? currentShortcuts.newItem ?? 'Meta+N',
        newGroup: updates.keyboardShortcuts?.newGroup ?? currentShortcuts.newGroup ?? 'Meta+G',
        openSettings: updates.keyboardShortcuts?.openSettings ?? currentShortcuts.openSettings ?? 'Meta+,',
        focusSearch: updates.keyboardShortcuts?.focusSearch ?? currentShortcuts.focusSearch ?? 'Meta+F',
        lockVault: updates.keyboardShortcuts?.lockVault ?? currentShortcuts.lockVault ?? 'Meta+L',
        commandPalette: updates.keyboardShortcuts?.commandPalette ?? currentShortcuts.commandPalette ?? 'Meta+K',
        selectGroup1: updates.keyboardShortcuts?.selectGroup1 ?? currentShortcuts.selectGroup1 ?? '1',
        selectGroup2: updates.keyboardShortcuts?.selectGroup2 ?? currentShortcuts.selectGroup2 ?? '2',
        selectGroup3: updates.keyboardShortcuts?.selectGroup3 ?? currentShortcuts.selectGroup3 ?? '3',
        selectGroup4: updates.keyboardShortcuts?.selectGroup4 ?? currentShortcuts.selectGroup4 ?? '4',
        selectGroup5: updates.keyboardShortcuts?.selectGroup5 ?? currentShortcuts.selectGroup5 ?? '5',
        selectGroup6: updates.keyboardShortcuts?.selectGroup6 ?? currentShortcuts.selectGroup6 ?? '6',
        selectGroup7: updates.keyboardShortcuts?.selectGroup7 ?? currentShortcuts.selectGroup7 ?? '7',
        selectGroup8: updates.keyboardShortcuts?.selectGroup8 ?? currentShortcuts.selectGroup8 ?? '8',
        selectGroup9: updates.keyboardShortcuts?.selectGroup9 ?? currentShortcuts.selectGroup9 ?? '9',
        showAllGroups: updates.keyboardShortcuts?.showAllGroups ?? currentShortcuts.showAllGroups ?? '0',
      };
    }
    const res = await window.api.settings.update(updates);
    if (res.success && res.data) {
      useStore.setState({ settings: res.data });
    }
  };

  const [activeTab, setActiveTab] = useState<SettingsTab>('general');
  const [defaultProfile, setDefaultProfile] = useState<NetworkProfile>('local');
  const [defaultTerminal, setDefaultTerminal] = useState('Terminal');
  const [isRefreshingTailscale, setIsRefreshingTailscale] = useState(false);
  const [exportStatus, setExportStatus] = useState<string | null>(null);
  const [importStatus, setImportStatus] = useState<string | null>(null);
  const [selectedImportGroup, setSelectedImportGroup] = useState<string>('');
  const [isBrowserImportOpen, setIsBrowserImportOpen] = useState(false);
  const [isConflictModalOpen, setIsConflictModalOpen] = useState(false);
  const [importConflicts, setImportConflicts] = useState<GroupConflict[]>([]);
  const [isDeleteAllModalOpen, setIsDeleteAllModalOpen] = useState(false);
  const [deleteAllPassword, setDeleteAllPassword] = useState('');
  const [deleteAllError, setDeleteAllError] = useState<string | null>(null);
  const [pendingImportData, setPendingImportData] = useState<{
    importData: ExportData;
    safeGroups: any[];
    safeItems: any[];
  } | null>(null);

  // Sync state
  const [syncEnabled, setSyncEnabled] = useState(false);
  const [syncUrl, setSyncUrl] = useState('');
  const [syncUsername, setSyncUsername] = useState('');
  const [syncPassword, setSyncPassword] = useState('');
  const [showSyncPassword, setShowSyncPassword] = useState(false);
  const [hasSavedPassword, setHasSavedPassword] = useState(false);
  const [displayPassword, setDisplayPassword] = useState(''); // For showing saved password when toggled
  const [isTestingConnection, setIsTestingConnection] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState<string | null>(null);

  // Security state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [showPasswords, setShowPasswords] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null);
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  // AI state
  const [aiEnabled, setAiEnabled] = useState(false);
  const [groqApiKey, setGroqApiKey] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);
  const [isTestingAiConnection, setIsTestingAiConnection] = useState(false);
  const [aiConnectionStatus, setAiConnectionStatus] = useState<string | null>(null);

  // Backup state
  const [backupEnabled, setBackupEnabled] = useState(true);
  const [backupFrequency, setBackupFrequency] = useState<'daily' | 'weekly' | 'manual'>('daily');
  const [backupRetention, setBackupRetention] = useState(30);
  const [backupPath, setBackupPath] = useState('');

  // Hotkey state
  const [globalSearchHotkey, setGlobalSearchHotkey] = useState('Option+Space');

  useEffect(() => {
    if (settings) {
      setDefaultProfile(settings.defaultProfile);
      setDefaultTerminal(settings.defaultTerminal || 'Terminal');
      setSyncEnabled(settings.syncEnabled || false);
      setSyncUrl(settings.syncUrl || '');
      setSyncUsername(settings.syncUsername || '');
      setHasSavedPassword(!!settings.syncPassword);
      setDisplayPassword(''); // Reset display password
      setShowSyncPassword(false); // Reset show/hide state
      // Don't load password value, but show indicator if one exists
      setAiEnabled(settings.aiEnabled || false);
      setGroqApiKey(settings.groqApiKey || '');
      setShowApiKey(false);
      setGroqApiKey(settings.groqApiKey || '');
      setShowApiKey(false);
      setGlobalSearchHotkey(settings.globalSearchHotkey || (isMac ? 'Option+Space' : 'Alt+Space'));
      setBackupEnabled(settings.backupEnabled !== false); // Default to true if undefined
      setBackupFrequency(settings.backupFrequency || 'daily');
      setBackupRetention(settings.backupRetentionCount || 30);
      setBackupPath(settings.backupPath || '');
    }
    if (groups.length > 0 && !selectedImportGroup) {
      setSelectedImportGroup(groups[0].id);
    }
  }, [settings, groups, selectedImportGroup]);

  useEffect(() => {
    if (isSettingsOpen) {
      setActiveTab('general');
      // Reset password fields
      setCurrentPassword('');
      setNewPassword('');
      setConfirmNewPassword('');
      setPasswordError(null);
      setPasswordSuccess(null);
    }
  }, [isSettingsOpen]);

  const handleChangePassword = async () => {
    setPasswordError(null);
    setPasswordSuccess(null);

    if (!currentPassword) {
      setPasswordError('Please enter your current password');
      return;
    }
    if (!newPassword) {
      setPasswordError('Please enter a new password');
      return;
    }
    if (newPassword.length < 8) {
      setPasswordError('New password must be at least 8 characters');
      return;
    }
    if (newPassword !== confirmNewPassword) {
      setPasswordError('New passwords do not match');
      return;
    }

    setIsChangingPassword(true);

    try {
      const res = await window.api.encryption.changePassword(currentPassword, newPassword);
      if (res.success) {
        setPasswordSuccess('Password changed successfully');
        setCurrentPassword('');
        setNewPassword('');
        setConfirmNewPassword('');
        setTimeout(() => setPasswordSuccess(null), 3000);
      } else {
        setPasswordError(res.error || 'Failed to change password');
      }
    } catch (err) {
      setPasswordError('Failed to change password');
    } finally {
      setIsChangingPassword(false);
    }
  };

  const handleRefreshTailscale = async () => {
    setIsRefreshingTailscale(true);
    await refreshTailscaleStatus();
    setTimeout(() => setIsRefreshingTailscale(false), 500);
  };

  const handleExport = async () => {
    setExportStatus('Exporting...');
    try {
      const result = await window.api.data.export();
      if (result.success) {
        setExportStatus(`Exported successfully!`);
        setTimeout(() => setExportStatus(null), 3000);
      } else {
        setExportStatus(result.error || 'Export failed');
      }
    } catch (error) {
      setExportStatus('Export failed');
    }
  };

  const handleImport = async () => {
    setImportStatus('Analyzing import...');
    try {
      const result = await window.api.data.analyzeImport();
      if (result.success && result.data) {
        if (result.data.conflicts.length > 0) {
          // Show conflict modal
          setImportConflicts(result.data.conflicts);
          setPendingImportData({
            importData: result.data.importData,
            safeGroups: result.data.safeGroups,
            safeItems: result.data.safeItems,
          });
          setIsConflictModalOpen(true);
          setImportStatus(null);
        } else {
          // No conflicts, import directly
          const importResult = await window.api.data.importWithResolutions(
            result.data.importData,
            result.data.safeGroups,
            result.data.safeItems,
            {}
          );
          if (importResult.success && importResult.data) {
            setImportStatus(`Imported ${importResult.data.groupsCount} groups and ${importResult.data.itemsCount} items`);
            await loadData();
            setTimeout(() => setImportStatus(null), 3000);
          } else {
            setImportStatus(importResult.error || 'Import failed');
          }
        }
      } else {
        setImportStatus(result.error || 'Import failed');
      }
    } catch (error) {
      setImportStatus('Import failed');
    }
  };

  const handleConflictResolution = async (resolutions: Map<string, 'merge' | 'replace' | 'skip'>) => {
    if (!pendingImportData) return;

    setImportStatus('Importing with resolutions...');
    try {
      const resolutionsObj = Object.fromEntries(resolutions);
      const result = await window.api.data.importWithResolutions(
        pendingImportData.importData,
        pendingImportData.safeGroups,
        pendingImportData.safeItems,
        resolutionsObj
      );
      if (result.success && result.data) {
        setImportStatus(`Imported ${result.data.groupsCount} groups and ${result.data.itemsCount} items`);
        await loadData();
        setTimeout(() => setImportStatus(null), 3000);
      } else {
        setImportStatus(result.error || 'Import failed');
      }
    } catch (error) {
      setImportStatus('Import failed');
    } finally {
      setPendingImportData(null);
      setImportConflicts([]);
    }
  };

  const handleDeleteAll = async () => {
    if (!isVaultSetup) {
      setDeleteAllError('Vault must be set up to delete all data');
      return;
    }

    setDeleteAllError(null);

    // Verify password
    const unlockResult = await window.api.encryption.unlock(deleteAllPassword);
    if (!unlockResult.success) {
      setDeleteAllError('Incorrect password');
      return;
    }

    // Delete all groups and items
    try {
      const allGroups = await window.api.groups.getAll();
      const allItems = await window.api.items.getAll();

      if (allItems.success && allItems.data) {
        for (const item of allItems.data) {
          await window.api.items.delete(item.id);
        }
      }

      if (allGroups.success && allGroups.data) {
        for (const group of allGroups.data) {
          await window.api.groups.delete(group.id);
        }
      }

      await loadData();
      setIsDeleteAllModalOpen(false);
      setDeleteAllPassword('');
    } catch (error) {
      setDeleteAllError('Failed to delete all data');
    }
  };

  const handleImportBrowserBookmarks = async () => {
    if (!selectedImportGroup) {
      setImportStatus('Please select a group first');
      return;
    }

    setImportStatus('Importing bookmarks...');
    try {
      const result = await window.api.data.importBrowserBookmarks(selectedImportGroup);
      if (result.success && result.data) {
        setImportStatus(`Imported ${result.data.count} bookmarks`);
        await loadData();
        setTimeout(() => setImportStatus(null), 3000);
      } else {
        setImportStatus(result.error || 'Import failed');
      }
    } catch (error) {
      setImportStatus('Import failed');
    }
  };

  const handleChangeBackupLocation = async () => {
    try {
      const result = await window.api.dialog.openDirectory();
      if (!result.canceled && result.filePaths.length > 0) {
        const newPath = result.filePaths[0];
        setBackupPath(newPath);
        updateSettings({ backupPath: newPath });
      }
    } catch (error) {
      console.error('Failed to change backup location:', error);
    }
  };

  const handleOpenBackupFolder = async () => {
    try {
      if (backupPath) {
        await window.api.shell.openPath(backupPath);
      }
    } catch (error) {
      console.error('Failed to open backup folder:', error);
    }
  };

  if (!isSettingsOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-dark-950/80 backdrop-blur-sm"
        onClick={closeSettings}
      />

      {/* Modal */}
      <div className="relative w-full max-w-2xl bg-dark-900 border border-dark-700 rounded-2xl shadow-2xl animate-scale-in overflow-hidden flex flex-col" style={{ height: '600px' }}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-dark-800">
          <h2 className="text-xl font-semibold text-dark-100">Settings</h2>
          <button
            onClick={closeSettings}
            className="p-2 rounded-lg text-dark-400 hover:text-dark-200 hover:bg-dark-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs + Content */}
        <div className="flex flex-1 overflow-hidden">
          {/* Tab Sidebar */}
          <div className="w-44 bg-dark-850 border-r border-dark-800 py-2 flex-shrink-0">
            {TABS.filter(tab => {
              if (tab.id === 'network' && !settings?.advancedMode) return false;
              if (tab.id === 'terminal' && !settings?.advancedMode) return false;
              return true;
            }).map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors
                           ${activeTab === tab.id
                      ? 'bg-accent-primary/10 text-accent-primary border-r-2 border-accent-primary'
                      : 'text-dark-400 hover:text-dark-200 hover:bg-dark-800'}`}
                >
                  <Icon className="w-4 h-4" />
                  {tab.label}
                </button>
              );
            })}
          </div>

          {/* Tab Content */}
          <div className="flex-1 overflow-y-auto p-6">
            {/* General Tab */}
            {activeTab === 'general' && (
              <div className="space-y-6">
                {/* Favicons */}
                <div>
                  <h3 className="text-lg font-medium text-dark-100 mb-4">Website Icons</h3>
                  <div className="p-4 bg-dark-800/50 rounded-xl">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <Image className="w-5 h-5 text-dark-400" />
                        <div>
                          <p className="text-sm font-medium text-dark-200">Favicon Cache</p>
                          <p className="text-xs text-dark-500">Automatically fetches website icons</p>
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => fetchFavicons(true)}
                      disabled={isFetchingFavicons}
                      className="btn-secondary w-full"
                    >
                      {isFetchingFavicons ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Fetching {faviconProgress.current}/{faviconProgress.total}...
                        </>
                      ) : (
                        <>
                          <RefreshCw className="w-4 h-4" />
                          Refresh All Favicons
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* Advanced Mode */}
                <div>
                  <h3 className="text-lg font-medium text-dark-100 mb-4">Experience</h3>
                  <div className="p-4 bg-dark-800/50 rounded-xl">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Settings className="w-5 h-5 text-dark-400" />
                        <div>
                          <p className="text-sm font-medium text-dark-200">Advanced Mode</p>
                          <p className="text-xs text-dark-500">Show advanced features like Tailscale, VPN, and complex network configurations</p>
                        </div>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={settings?.advancedMode || false}
                          onChange={(e) => updateSettings({ advancedMode: e.target.checked })}
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-dark-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-accent-primary"></div>
                      </label>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Security Tab */}
            {activeTab === 'security' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-medium text-dark-100 mb-4">Vault Status</h3>
                  <div className="p-4 bg-dark-800/50 rounded-xl">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isVaultSetup ? 'bg-accent-success/20' : 'bg-dark-700'
                        }`}>
                        <Shield className={`w-5 h-5 ${isVaultSetup ? 'text-accent-success' : 'text-dark-400'}`} />
                      </div>
                      <div>
                        <p className="font-medium text-dark-100">
                          {isVaultSetup ? 'Encryption Enabled' : 'Not Set Up'}
                        </p>
                        <p className="text-xs text-dark-400">
                          {isVaultSetup
                            ? 'Your credentials are encrypted with your master password'
                            : 'Set up a master password to encrypt credentials'}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {isVaultSetup && (
                  <>
                    <div>
                      <h3 className="text-lg font-medium text-dark-100 mb-4">Quick Lock</h3>
                      <button
                        onClick={() => {
                          lockVault();
                          closeSettings();
                        }}
                        className="btn-secondary w-full"
                      >
                        <Lock className="w-4 h-4" />
                        Lock Vault Now
                      </button>
                      <p className="text-xs text-dark-500 mt-2">
                        You'll need to enter your master password to unlock
                      </p>
                    </div>

                    <div>
                      <h3 className="text-lg font-medium text-dark-100 mb-4">Change Password</h3>
                      <div className="space-y-3">
                        <div>
                          <label className="input-label text-xs">Current Password</label>
                          <div className="relative">
                            <input
                              type={showPasswords ? 'text' : 'password'}
                              value={currentPassword}
                              onChange={(e) => setCurrentPassword(e.target.value)}
                              className="input-base pr-10"
                              placeholder="Enter current password"
                            />
                            <button
                              type="button"
                              onClick={() => setShowPasswords(!showPasswords)}
                              className="absolute right-3 top-1/2 -translate-y-1/2 text-dark-400 hover:text-dark-200"
                            >
                              {showPasswords ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </button>
                          </div>
                        </div>
                        <div>
                          <label className="input-label text-xs">New Password</label>
                          <input
                            type={showPasswords ? 'text' : 'password'}
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                            className="input-base"
                            placeholder="Enter new password"
                          />
                        </div>
                        <div>
                          <label className="input-label text-xs">Confirm New Password</label>
                          <input
                            type={showPasswords ? 'text' : 'password'}
                            value={confirmNewPassword}
                            onChange={(e) => setConfirmNewPassword(e.target.value)}
                            className="input-base"
                            placeholder="Confirm new password"
                          />
                        </div>

                        {passwordError && (
                          <div className="flex items-center gap-2 p-3 bg-accent-danger/10 text-accent-danger rounded-lg text-sm">
                            <AlertCircle className="w-4 h-4 flex-shrink-0" />
                            {passwordError}
                          </div>
                        )}

                        {passwordSuccess && (
                          <div className="flex items-center gap-2 p-3 bg-accent-success/10 text-accent-success rounded-lg text-sm">
                            <Check className="w-4 h-4 flex-shrink-0" />
                            {passwordSuccess}
                          </div>
                        )}

                        <button
                          onClick={handleChangePassword}
                          disabled={isChangingPassword}
                          className="btn-primary w-full"
                        >
                          {isChangingPassword ? (
                            <>
                              <Loader2 className="w-4 h-4 animate-spin" />
                              Changing...
                            </>
                          ) : (
                            'Change Password'
                          )}
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Network Tab */}
            {activeTab === 'network' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-medium text-dark-100 mb-4">Tailscale Status</h3>
                  <div className="p-4 bg-dark-800/50 rounded-xl">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-3 h-3 rounded-full ${tailscaleStatus.connected ? 'bg-accent-success animate-pulse' : 'bg-dark-500'
                            }`}
                        />
                        <div>
                          <p className="text-sm font-medium text-dark-200">
                            {tailscaleStatus.connected ? 'Connected' : 'Disconnected'}
                          </p>
                          {tailscaleStatus.connected && tailscaleStatus.tailnetName && (
                            <p className="text-xs text-dark-400">{tailscaleStatus.tailnetName}</p>
                          )}
                        </div>
                      </div>
                      <button
                        onClick={handleRefreshTailscale}
                        className="p-2 rounded-lg text-dark-400 hover:text-dark-200 hover:bg-dark-700 transition-colors"
                        disabled={isRefreshingTailscale}
                      >
                        <RefreshCw
                          className={`w-4 h-4 ${isRefreshingTailscale ? 'animate-spin' : ''}`}
                        />
                      </button>
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="text-lg font-medium text-dark-100 mb-4">Default Profile</h3>
                  <select
                    value={defaultProfile}
                    onChange={(e) => setDefaultProfile(e.target.value as NetworkProfile)}
                    className="input-base"
                  >
                    <option value="local">Local (LAN)</option>
                    <option value="tailscale">Tailscale</option>
                    <option value="vpn">VPN</option>
                  </select>
                  <p className="text-xs text-dark-500 mt-2">
                    The network profile used when the app starts
                  </p>
                </div>
              </div>
            )}

            {/* Terminal Tab */}
            {activeTab === 'terminal' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-medium text-dark-100 mb-4">SSH Terminal</h3>
                  <label className="input-label">Default Terminal App</label>
                  <select
                    value={defaultTerminal}
                    onChange={(e) => {
                      const newTerminal = e.target.value;
                      setDefaultTerminal(newTerminal);
                      updateSettings({ defaultTerminal: newTerminal });
                    }}
                    className="input-base"
                  >
                    <option value="Terminal">Terminal.app</option>
                    <option value="iTerm">iTerm2</option>
                    <option value="Warp">Warp</option>
                    <option value="Alacritty">Alacritty</option>
                    <option value="Kitty">Kitty</option>
                  </select>
                  <p className="text-xs text-dark-500 mt-2">
                    Terminal application used for SSH connections
                  </p>
                </div>
              </div>
            )}

            {/* Shortcuts Tab */}
            {activeTab === 'shortcuts' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-medium text-dark-100 mb-4">Keyboard Shortcuts</h3>
                  <p className="text-sm text-dark-400 mb-6">
                    Click "Record" and press the keys you want. Warnings show for system conflicts.
                  </p>

                  <div className="space-y-2">
                    <KeyboardShortcutRecorder
                      label="New item"
                      value={settings?.keyboardShortcuts?.newItem || 'Meta+N'}
                      onChange={(value) => updateSettings({
                        keyboardShortcuts: { ...(settings?.keyboardShortcuts || {}), newItem: value }
                      })}
                    />
                    <KeyboardShortcutRecorder
                      label="New group"
                      value={settings?.keyboardShortcuts?.newGroup || 'Meta+G'}
                      onChange={(value) => updateSettings({
                        keyboardShortcuts: { ...(settings?.keyboardShortcuts || {}), newGroup: value }
                      })}
                    />
                    <KeyboardShortcutRecorder
                      label="Command Palette"
                      value={settings?.keyboardShortcuts?.commandPalette || 'Meta+K'}
                      onChange={(value) => updateSettings({
                        keyboardShortcuts: { ...(settings?.keyboardShortcuts || {}), commandPalette: value }
                      })}
                    />
                    <KeyboardShortcutRecorder
                      label="Focus search"
                      value={settings?.keyboardShortcuts?.focusSearch || 'Meta+F'}
                      onChange={(value) => updateSettings({
                        keyboardShortcuts: { ...(settings?.keyboardShortcuts || {}), focusSearch: value }
                      })}
                    />
                    <KeyboardShortcutRecorder
                      label="Open settings"
                      value={settings?.keyboardShortcuts?.openSettings || 'Meta+,'}
                      onChange={(value) => updateSettings({
                        keyboardShortcuts: { ...(settings?.keyboardShortcuts || {}), openSettings: value }
                      })}
                    />
                    <KeyboardShortcutRecorder
                      label="Lock vault"
                      value={settings?.keyboardShortcuts?.lockVault || 'Meta+L'}
                      onChange={(value) => updateSettings({
                        keyboardShortcuts: { ...(settings?.keyboardShortcuts || {}), lockVault: value }
                      })}
                    />
                    <KeyboardShortcutRecorder
                      label="Select group 1"
                      value={settings?.keyboardShortcuts?.selectGroup1 || '1'}
                      onChange={(value) => updateSettings({
                        keyboardShortcuts: { ...(settings?.keyboardShortcuts || {}), selectGroup1: value }
                      })}
                    />
                    <KeyboardShortcutRecorder
                      label="Show all groups"
                      value={settings?.keyboardShortcuts?.showAllGroups || '0'}
                      onChange={(value) => updateSettings({
                        keyboardShortcuts: { ...(settings?.keyboardShortcuts || {}), showAllGroups: value }
                      })}
                    />
                  </div>
                </div>

                <div>
                  <h3 className="text-lg font-medium text-dark-100 mb-4">Global Launcher</h3>
                  <p className="text-sm text-dark-400 mb-4">
                    System-wide shortcut to open Quick Search from anywhere, even when the app is not focused.
                  </p>
                  <KeyboardShortcutRecorder
                    label="Global Quick Search"
                    value={settings?.globalSearchHotkey || (navigator.platform.includes('Mac') ? 'Option+Space' : 'Alt+Space')}
                    onChange={(value) => updateSettings({ globalSearchHotkey: value })}
                  />
                </div>

                <div className="p-4 bg-accent-primary/10 rounded-lg border border-accent-primary/30">
                  <p className="text-xs text-dark-300 flex items-center gap-2">
                    💡 <span>Press Escape while recording to cancel. System shortcuts show warnings.</span>
                  </p>
                </div>
              </div>
            )}

            {/* Extensions Tab */}
            {activeTab === 'extensions' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-medium text-dark-100 mb-4">Browser Extensions</h3>
                  <p className="text-sm text-dark-400 mb-6">
                    LaunchIt integrates with your browser to let you quickly save items and use AI features.
                  </p>

                  <div className="space-y-4">
                    {/* Chrome / Chromium */}
                    <div className="p-4 bg-dark-800/50 rounded-xl border border-dark-700">
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex items-center gap-3">
                          <Globe className="w-5 h-5 text-blue-400" />
                          <div>
                            <p className="font-medium text-dark-100">Chrome / Edge / Brave</p>
                            <p className="text-xs text-dark-400">Chromium-based browsers</p>
                          </div>
                        </div>
                        <button
                          onClick={() => window.api.system.openExtensionFolder('chrome')}
                          className="btn-secondary text-xs"
                        >
                          Open Extension Folder
                        </button>
                      </div>
                      <div className="space-y-2 text-sm text-dark-300">
                        <ol className="list-decimal list-inside space-y-1">
                          <li>Open <code className="bg-dark-900 px-1 rounded">chrome://extensions</code> in your browser</li>
                          <li>Enable <strong>Developer mode</strong> (top right toggle)</li>
                          <li>Click "Load unpacked" and select the folder, or drag the folder here</li>
                        </ol>
                      </div>
                    </div>

                    {/* Safari */}
                    <div className="p-4 bg-dark-800/50 rounded-xl border border-dark-700">
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex items-center gap-3">
                          <Command className="w-5 h-5 text-blue-400" />
                          <div>
                            <p className="font-medium text-dark-100">Safari</p>
                            <p className="text-xs text-dark-400">macOS specific</p>
                          </div>
                        </div>
                        <button
                          onClick={() => window.api.system.openExtensionFolder('safari')}
                          className="btn-secondary text-xs"
                        >
                          Open Extension Folder
                        </button>
                      </div>
                      <div className="space-y-2 text-sm text-dark-300">
                        <ol className="list-decimal list-inside space-y-1">
                          <li>Open Safari Settings → Advanced</li>
                          <li>Check "Show Develop menu in menu bar"</li>
                          <li>In Develop menu, enable "Allow Unsigned Extensions"</li>
                          <li>Use "safari-web-extension-converter" (Requires Xcode) or drag folder if signed</li>
                        </ol>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Data Tab */}
            {activeTab === 'data' && (
              <div className="space-y-6">
                {/* Backup & Recovery */}
                <div>
                  <h3 className="text-lg font-medium text-dark-100 mb-4">Backup & Recovery</h3>
                  <div className="p-4 bg-dark-800/50 rounded-xl space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Archive className="w-5 h-5 text-dark-400" />
                        <div>
                          <p className="text-sm font-medium text-dark-200">Auto Backup</p>
                          <p className="text-xs text-dark-500">Automatically back up your data locally</p>
                        </div>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={backupEnabled}
                          onChange={(e) => {
                            setBackupEnabled(e.target.checked);
                            updateSettings({ backupEnabled: e.target.checked });
                          }}
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-dark-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-accent-primary"></div>
                      </label>
                    </div>

                    {backupEnabled && (
                      <>
                        <div className="grid grid-cols-2 gap-4 pt-2 border-t border-dark-700/50">
                          <div>
                            <label className="input-label text-xs">Frequency</label>
                            <select
                              value={backupFrequency}
                              onChange={(e) => {
                                const val = e.target.value as 'daily' | 'weekly' | 'manual';
                                setBackupFrequency(val);
                                updateSettings({ backupFrequency: val });
                              }}
                              className="input-base text-sm"
                            >
                              <option value="daily">Daily</option>
                              <option value="weekly">Weekly</option>
                              <option value="manual">Manual Only</option>
                            </select>
                          </div>
                          <div>
                            <label className="input-label text-xs">Retention (Backups to keep)</label>
                            <input
                              type="number"
                              min="1"
                              max="100"
                              value={backupRetention}
                              onChange={(e) => {
                                const val = parseInt(e.target.value) || 30;
                                setBackupRetention(val);
                                updateSettings({ backupRetentionCount: val });
                              }}
                              className="input-base text-sm"
                            />
                          </div>
                        </div>

                        {/* Backup Location */}
                        <div className="pt-2 border-t border-dark-700/50">
                          <label className="input-label text-xs">Backup Location</label>
                          <div className="flex gap-2">
                            <div className="flex-1 input-base text-sm text-dark-400 truncate flex items-center">
                              {backupPath || 'Default (Application Data)'}
                            </div>
                            <button
                              onClick={handleChangeBackupLocation}
                              className="btn-secondary whitespace-nowrap"
                              title="Change backup folder"
                            >
                              <Folder className="w-4 h-4 mr-2" />
                              Change
                            </button>
                            {backupPath && (
                              <button
                                onClick={handleOpenBackupFolder}
                                className="btn-secondary whitespace-nowrap"
                                title="Open backup folder"
                              >
                                <FolderOpen className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                          <p className="text-xs text-dark-500 mt-1">
                            Where your backups are stored. Ensure you have write permissions.
                          </p>
                        </div>
                      </>
                    )}

                    {settings?.lastAutoBackup && (
                      <p className="text-xs text-dark-500 pt-1">
                        Last auto-backup: {new Date(settings.lastAutoBackup).toLocaleString()}
                      </p>
                    )}
                  </div>
                </div>

                {/* Status Messages */}
                {(exportStatus || importStatus || syncStatus) && (
                  <div className={`p-3 rounded-lg text-sm flex items-center gap-2 ${(exportStatus?.includes('failed') || importStatus?.includes('failed') || syncStatus?.includes('failed') || syncStatus?.includes('Error'))
                    ? 'bg-accent-danger/10 text-accent-danger'
                    : 'bg-accent-success/10 text-accent-success'
                    }`}>
                    <Check className="w-4 h-4" />
                    {exportStatus || importStatus || syncStatus}
                  </div>
                )}

                {/* Sync */}
                <div>
                  <h3 className="text-lg font-medium text-dark-100 mb-4">Sync (WebDAV/Nextcloud)</h3>

                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <label className="text-sm font-medium text-dark-200">Enable Sync</label>
                        <p className="text-xs text-dark-500">Sync your bookmarks across devices</p>
                      </div>
                      <button
                        onClick={() => {
                          const newValue = !syncEnabled;
                          setSyncEnabled(newValue);
                          window.api.settings.update({ syncEnabled: newValue });
                        }}
                        className={`relative w-12 h-6 rounded-full transition-colors ${syncEnabled ? 'bg-accent-primary' : 'bg-dark-700'
                          }`}
                      >
                        <div
                          className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${syncEnabled ? 'translate-x-6' : 'translate-x-0'
                            }`}
                        />
                      </button>
                    </div>

                    {syncEnabled && (
                      <>
                        <div>
                          <label className="input-label text-xs">WebDAV URL</label>
                          <input
                            type="text"
                            value={syncUrl}
                            onChange={(e) => setSyncUrl(e.target.value)}
                            placeholder="https://nextcloud.example.com/remote.php/dav/files/username"
                            className="input-base text-sm"
                          />
                          <p className="text-xs text-dark-500 mt-1">
                            Your Nextcloud or WebDAV server URL
                          </p>
                        </div>

                        <div>
                          <label className="input-label text-xs">Username</label>
                          <input
                            type="text"
                            value={syncUsername}
                            onChange={(e) => setSyncUsername(e.target.value)}
                            placeholder="your-username"
                            className="input-base text-sm"
                          />
                        </div>

                        <div>
                          <label className="input-label text-xs">Password</label>
                          <div className="relative">
                            <input
                              type={showSyncPassword ? 'text' : 'password'}
                              value={showSyncPassword && hasSavedPassword && !syncPassword ? displayPassword : syncPassword}
                              onChange={(e) => {
                                setSyncPassword(e.target.value);
                                setHasSavedPassword(false); // Clear indicator when user types
                                setDisplayPassword(''); // Clear display password
                              }}
                              placeholder={hasSavedPassword && !syncPassword && !showSyncPassword ? '•••••••• (saved)' : 'Enter password'}
                              className="input-base text-sm pr-10"
                            />
                            <button
                              type="button"
                              onClick={async () => {
                                if (hasSavedPassword && !syncPassword && !showSyncPassword) {
                                  // User wants to see saved password - decrypt it
                                  if (settings?.syncPassword) {
                                    try {
                                      const decryptRes = await window.api.encryption.decrypt(settings.syncPassword);
                                      if (decryptRes.success && decryptRes.data) {
                                        setDisplayPassword(decryptRes.data);
                                      }
                                    } catch (error) {
                                      console.error('Failed to decrypt password:', error);
                                    }
                                  }
                                }
                                setShowSyncPassword(!showSyncPassword);
                              }}
                              className="absolute right-3 top-1/2 -translate-y-1/2 text-dark-400 hover:text-dark-200"
                            >
                              {showSyncPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </button>
                          </div>
                          <p className="text-xs text-dark-500 mt-1">
                            {hasSavedPassword && !syncPassword
                              ? 'Password is saved. Leave empty to keep existing password, or enter a new one to change it.'
                              : 'Password is encrypted with your master password'}
                          </p>
                        </div>

                        <div className="flex gap-2">
                          <button
                            onClick={async () => {
                              if (!syncUrl || !syncUsername || (!syncPassword && !hasSavedPassword)) {
                                setSyncStatus('Please fill in all fields');
                                return;
                              }

                              setIsTestingConnection(true);
                              setSyncStatus(null);

                              try {
                                // Use existing password if new one not provided
                                let passwordToTest = syncPassword;
                                let passwordToSave = settings?.syncPassword; // Keep existing if not changed

                                if (syncPassword) {
                                  // Encrypt new password before testing
                                  const encryptRes = await window.api.encryption.encrypt(syncPassword);
                                  if (!encryptRes.success) {
                                    setSyncStatus('Error: Failed to encrypt password. Please unlock vault.');
                                    return;
                                  }
                                  passwordToSave = encryptRes.data;
                                } else if (!hasSavedPassword) {
                                  setSyncStatus('Please enter a password');
                                  return;
                                }

                                // For testing, we need the plain password - decrypt if using saved
                                if (!passwordToTest && hasSavedPassword && settings?.syncPassword) {
                                  const decryptRes = await window.api.encryption.decrypt(settings.syncPassword);
                                  if (decryptRes.success) {
                                    passwordToTest = decryptRes.data;
                                  } else {
                                    setSyncStatus('Error: Could not decrypt saved password. Please enter password again.');
                                    return;
                                  }
                                }

                                const testRes = await window.api.sync.testConnection(syncUrl, syncUsername, passwordToTest);
                                if (testRes.success) {
                                  // Save settings (only update password if it was changed)
                                  const updateData: any = {
                                    syncEnabled: true,
                                    syncUrl,
                                    syncUsername,
                                  };
                                  if (syncPassword) {
                                    updateData.syncPassword = passwordToSave;
                                  }
                                  await window.api.settings.update(updateData);
                                  setHasSavedPassword(true);
                                  setSyncPassword(''); // Clear field after saving
                                  setSyncStatus('Connection successful! Settings saved.');
                                } else {
                                  setSyncStatus(`Error: ${testRes.error || 'Connection failed'}`);
                                }
                              } catch (error) {
                                setSyncStatus(`Error: ${String(error)}`);
                              } finally {
                                setIsTestingConnection(false);
                              }
                            }}
                            disabled={isTestingConnection || !syncUrl || !syncUsername || (!syncPassword && !hasSavedPassword)}
                            className="btn-secondary flex-1 flex items-center justify-center gap-2"
                          >
                            {isTestingConnection ? (
                              <>
                                <Loader2 className="w-4 h-4 animate-spin" />
                                Testing...
                              </>
                            ) : (
                              <>
                                <CheckCircle2 className="w-4 h-4" />
                                Test & Save
                              </>
                            )}
                          </button>

                          <button
                            onClick={async () => {
                              setIsSyncing(true);
                              setSyncStatus(null);

                              try {
                                const res = await window.api.sync.upload();
                                if (res.success) {
                                  setSyncStatus('Sync successful!');
                                  // Reload settings to get updated lastSync time
                                  const settingsRes = await window.api.settings.get();
                                  if (settingsRes.success && settingsRes.data) {
                                    // Trigger a re-render by updating local state
                                    setSyncEnabled(settingsRes.data.syncEnabled || false);
                                    setSyncUrl(settingsRes.data.syncUrl || '');
                                    setSyncUsername(settingsRes.data.syncUsername || '');
                                    setHasSavedPassword(!!settingsRes.data.syncPassword);
                                  }
                                } else {
                                  setSyncStatus(`Error: ${res.error || 'Sync failed'}`);
                                }
                              } catch (error) {
                                setSyncStatus(`Error: ${String(error)}`);
                              } finally {
                                setIsSyncing(false);
                              }
                            }}
                            disabled={isSyncing || !syncEnabled || !settings?.syncUrl || !settings?.syncUsername}
                            className="btn-primary flex-1 flex items-center justify-center gap-2"
                          >
                            {isSyncing ? (
                              <>
                                <Loader2 className="w-4 h-4 animate-spin" />
                                Syncing...
                              </>
                            ) : (
                              <>
                                <Cloud className="w-4 h-4" />
                                Sync Now
                              </>
                            )}
                          </button>
                        </div>

                        {settings?.lastSync && (
                          <p className="text-xs text-dark-500">
                            Last synced: {new Date(settings.lastSync).toLocaleString()}
                          </p>
                        )}

                        <div className="relative my-4">
                          <div className="absolute inset-0 flex items-center">
                            <div className="w-full border-t border-dark-700" />
                          </div>
                          <div className="relative flex justify-center text-xs">
                            <span className="px-2 bg-dark-800 text-dark-500">or import manually</span>
                          </div>
                        </div>

                        <button
                          onClick={async () => {
                            setImportStatus('Importing sync file...');
                            try {
                              const result = await window.api.data.importSyncFile();
                              if (result.success && result.data) {
                                setImportStatus(`Imported ${result.data.groupsCount} groups and ${result.data.itemsCount} items from sync file`);
                                await loadData();
                                setTimeout(() => setImportStatus(null), 3000);
                              } else {
                                setImportStatus(result.error || 'Import failed');
                              }
                            } catch (error) {
                              setImportStatus('Import failed');
                            }
                          }}
                          className="btn-secondary w-full"
                        >
                          <FileUp className="w-4 h-4" />
                          Import Sync File
                        </button>
                        <p className="text-xs text-dark-500 mt-1">
                          Import a manually downloaded sync file (launchpad-data.json)
                        </p>
                      </>
                    )}
                  </div>
                </div>

                <div className="relative my-4">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-dark-700" />
                  </div>
                </div>

                {/* Backup & Restore */}
                <div>
                  <h3 className="text-lg font-medium text-dark-100 mb-4">Backup & Restore</h3>
                  <div className="grid grid-cols-2 gap-3">
                    <button onClick={handleExport} className="btn-secondary">
                      <Download className="w-4 h-4" />
                      Export Data
                    </button>
                    <button onClick={handleImport} className="btn-secondary">
                      <Upload className="w-4 h-4" />
                      Import Data
                    </button>
                  </div>
                  <p className="text-xs text-dark-500 mt-2">
                    Export or import all groups and bookmarks as JSON
                  </p>
                </div>

                {/* Browser Import */}
                <div>
                  <h3 className="text-lg font-medium text-dark-100 mb-4">Import Browser Bookmarks</h3>
                  <button
                    onClick={() => setIsBrowserImportOpen(true)}
                    className="btn-primary w-full mb-3"
                  >
                    <Globe className="w-4 h-4" />
                    Import from Browser
                  </button>
                  <p className="text-xs text-dark-500">
                    Import directly from Chrome, Firefox, Safari, Brave, Arc, and more
                  </p>

                  <button onClick={handleImport} className="btn-secondary">
                    📥 Import Backup
                  </button>
                  {importStatus && (
                    <p className="text-sm text-dark-300 mt-2">{importStatus}</p>
                  )}
                </div>

                <div className="p-4 bg-dark-800/50 rounded-xl">
                  <label className="input-label">Browser Import Groups</label>
                  <p className="text-sm text-dark-400 mb-3">
                    Select a group to import browser bookmarks into.
                  </p>
                  <select
                    value={selectedImportGroup}
                    onChange={(e) => setSelectedImportGroup(e.target.value)}
                    className="input-base mb-3"
                  >
                    <option value="">Select a group...</option>
                    {groups.map((group) => (
                      <option key={group.id} value={group.id}>
                        {group.icon} {group.name}
                      </option>
                    ))}
                  </select>

                  <button
                    onClick={handleImportBrowserBookmarks}
                    disabled={!selectedImportGroup}
                    className="btn-secondary disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    📚 Import from Browser
                  </button>
                </div>

                {/* Delete All Data */}
                <div className="p-4 bg-red-900/20 border border-red-500/30 rounded-xl">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <h4 className="font-medium text-red-400 mb-2">Danger Zone</h4>
                      <p className="text-sm text-dark-300 mb-3">
                        Permanently delete all groups, items, and data. This action cannot be undone.
                      </p>
                      <button
                        onClick={() => setIsDeleteAllModalOpen(true)}
                        className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors font-medium"
                      >
                        🗑️ Delete All Data
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* AI Features Tab */}
            {activeTab === 'ai' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-medium text-dark-100 mb-2">AI Features with Groq</h3>
                  <p className="text-sm text-dark-400 mb-4">
                    Enable AI-powered features like smart categorization, auto-tagging, and semantic search.
                    Groq offers 14,400 free requests per day.
                  </p>
                </div>

                {/* Enable AI */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <label className="text-sm font-medium text-dark-200">Enable AI Features</label>
                      <p className="text-xs text-dark-500">Turn on AI-powered suggestions and search</p>
                    </div>
                    <button
                      onClick={async () => {
                        const newValue = !aiEnabled;
                        setAiEnabled(newValue);
                        await updateSettings({ aiEnabled: newValue });
                      }}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${aiEnabled ? 'bg-accent-primary' : 'bg-dark-700'
                        }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${aiEnabled ? 'translate-x-6' : 'translate-x-1'
                          }`}
                      />
                    </button>
                  </div>
                </div>

                {/* API Key */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-dark-200">Groq API Key</label>
                  <div className="relative">
                    <input
                      type={showApiKey ? 'text' : 'password'}
                      value={groqApiKey}
                      onChange={(e) => setGroqApiKey(e.target.value)}
                      onBlur={async () => {
                        if (groqApiKey !== settings?.groqApiKey) {
                          await updateSettings({ groqApiKey });
                        }
                      }}
                      placeholder="gsk_..."
                      className="input-base pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowApiKey(!showApiKey)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-dark-400 hover:text-dark-200"
                    >
                      {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  <p className="text-xs text-dark-500">
                    Get your free API key from{' '}
                    <a
                      href="https://console.groq.com"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-accent-primary hover:underline"
                    >
                      console.groq.com
                    </a>
                  </p>
                </div>

                {/* Test Connection */}
                <div className="space-y-2">
                  <button
                    onClick={async () => {
                      setIsTestingAiConnection(true);
                      setAiConnectionStatus(null);

                      // Save API key first
                      if (groqApiKey) {
                        await updateSettings({ groqApiKey, aiEnabled: true });
                      }

                      const res = await window.api.ai.testConnection();
                      if (res.success && res.data?.success) {
                        setAiConnectionStatus('success');
                      } else {
                        setAiConnectionStatus('error');
                      }
                      setIsTestingAiConnection(false);
                    }}
                    disabled={!groqApiKey || isTestingAiConnection}
                    className="btn-secondary w-full"
                  >
                    {isTestingAiConnection ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Testing...
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-4 h-4" />
                        Test Connection
                      </>
                    )}
                  </button>

                  {aiConnectionStatus === 'success' && (
                    <p className="text-xs text-green-500 flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" />
                      Connection successful! AI features are ready.
                    </p>
                  )}
                  {aiConnectionStatus === 'error' && (
                    <p className="text-xs text-red-500 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" />
                      Connection failed. Please check your API key.
                    </p>
                  )}
                </div>

                {/* Features List */}
                <div className="pt-4 border-t border-dark-800">
                  <h4 className="text-sm font-medium text-dark-200 mb-3">Available Features</h4>
                  <div className="space-y-2 text-sm text-dark-400">
                    <div className="flex items-start gap-2">
                      <Check className="w-4 h-4 text-accent-primary mt-0.5 flex-shrink-0" />
                      <span>Smart categorization - AI suggests groups for new items</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <Check className="w-4 h-4 text-accent-primary mt-0.5 flex-shrink-0" />
                      <span>Auto-description generation - Create descriptions automatically</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <Check className="w-4 h-4 text-accent-primary mt-0.5 flex-shrink-0" />
                      <span>Smart tagging - AI suggests relevant tags</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <Check className="w-4 h-4 text-accent-primary mt-0.5 flex-shrink-0" />
                      <span>Duplicate detection - Find similar items before creating</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <Check className="w-4 h-4 text-accent-primary mt-0.5 flex-shrink-0" />
                      <span>Semantic search - Search by meaning, not just keywords</span>
                    </div>
                  </div>
                </div>

                {/* Info */}
                <div className="bg-dark-800/50 rounded-lg p-3 text-xs text-dark-400">
                  <p className="mb-1">
                    <strong className="text-dark-300">Free Tier:</strong> 14,400 requests/day
                  </p>
                  <p>
                    Your API key is stored securely and encrypted. All AI processing happens via Groq's API.
                  </p>
                </div>
              </div>
            )}

            {/* About Tab */}
            {activeTab === 'about' && (
              <div className="space-y-6">
                <div className="text-center py-8">
                  <div className="w-20 h-20 mx-auto mb-4 bg-gradient-to-br from-accent-primary to-accent-secondary rounded-2xl flex items-center justify-center text-4xl">
                    🚀
                  </div>
                  <h3 className="text-2xl font-bold gradient-text mb-2">LaunchIt</h3>
                  <p className="text-dark-400 mb-1">Version 1.1.0</p>
                  <p className="text-sm text-dark-500 mb-4">
                    A powerful bookmark and app launcher
                  </p>
                  <UpdateChecker />
                </div>

                <div className="space-y-3 text-sm">
                  <div className="flex justify-between py-2 border-b border-dark-800">
                    <span className="text-dark-400">Electron</span>
                    <span className="text-dark-200">28.0.0</span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-dark-800">
                    <span className="text-dark-400">React</span>
                    <span className="text-dark-200">18.2.0</span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-dark-800">
                    <span className="text-dark-400">Platform</span>
                    <span className="text-dark-200">macOS</span>
                  </div>
                </div>

                <div className="pt-4 text-center">
                  <p className="text-xs text-dark-500">
                    Built with ❤️ for productivity
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-dark-800 flex justify-end">
          <button onClick={closeSettings} className="btn-primary">
            Done
          </button>
        </div>
      </div>

      {/* Delete All Confirmation Modal */}
      {isDeleteAllModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-dark-900 rounded-2xl shadow-2xl w-full max-w-md border border-red-500/">
            <div className="p-6">
              <div className="flex items-start gap-3 mb-4">
                <div className="p-2 bg-red-500/10 rounded-lg">
                  <AlertCircle className="w-6 h-6 text-red-400" />
                </div>
                <div className="flex-1">
                  <h2 className="text-xl font-semibold text-red-400">Delete All Data?</h2>
                  <p className="text-sm text-dark-300 mt-1">
                    This will permanently delete all groups and items. This action cannot be undone.
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="input-label">Enter your vault password to confirm</label>
                  <input
                    type="password"
                    value={deleteAllPassword}
                    onChange={(e) => setDeleteAllPassword(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleDeleteAll()}
                    className="input-base"
                    placeholder="Vault password"
                    autoFocus
                  />
                  {deleteAllError && (
                    <p className="text-sm text-red-400 mt-2">{deleteAllError}</p>
                  )}
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={() => {
                      setIsDeleteAllModalOpen(false);
                      setDeleteAllPassword('');
                      setDeleteAllError(null);
                    }}
                    className="btn-secondary flex-1"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleDeleteAll}
                    disabled={!deleteAllPassword}
                    className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Delete All
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Import Conflict Modal */}
      <ImportConflictModal
        isOpen={isConflictModalOpen}
        onClose={() => setIsConflictModalOpen(false)}
        conflicts={importConflicts}
        onResolve={handleConflictResolution}
      />

      {/* Browser Import Modal */}
      <ImportBrowserModal
        isOpen={isBrowserImportOpen}
        onClose={() => setIsBrowserImportOpen(false)}
      />
    </div >
  );
}
