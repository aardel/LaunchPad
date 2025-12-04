import { useEffect } from 'react';
import { useStore } from './store/useStore';
import { Sidebar } from './components/Sidebar/Sidebar';
import { Dashboard } from './components/Dashboard/Dashboard';
import { TitleBar } from './components/TitleBar/TitleBar';
import { AddItemModal } from './components/Modals/AddItemModal';
import { EditItemModal } from './components/Modals/EditItemModal';
import { GroupModal } from './components/Modals/GroupModal';
import { SettingsModal } from './components/Modals/SettingsModal';
import { UnlockModal } from './components/Modals/UnlockModal';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';

function App() {
  const { loadData, isLoading, error, refreshTailscaleStatus, fetchFavicons, refreshExpiredFavicons, items, setSyncStatus, settings, isVaultSetup, isVaultLocked, loadData: reloadData } = useStore();

  useEffect(() => {
    loadData();
    
    // Refresh Tailscale status periodically
    const interval = setInterval(refreshTailscaleStatus, 30000);
    return () => clearInterval(interval);
  }, [loadData, refreshTailscaleStatus]);

  // Listen for sync status updates from main process
  useEffect(() => {
    const handleSyncStatus = (_event: any, status: { syncing: boolean; success?: boolean; error?: string; lastSync?: string }) => {
      console.log('Sync status received:', status); // Debug log
      if (status) {
        setSyncStatus({
          syncing: status.syncing ?? false,
          success: status.success,
          error: status.error,
          lastSync: status.lastSync,
        });
      }
    };

    // Access ipcRenderer via window.electron (exposed by preload)
    // @ts-ignore - window.electron is available in Electron context
    if (window.electron?.ipcRenderer) {
      console.log('Setting up sync status listener'); // Debug log
      window.electron.ipcRenderer.on('sync:status', handleSyncStatus);
      return () => {
        console.log('Removing sync status listener'); // Debug log
        window.electron.ipcRenderer.removeListener('sync:status', handleSyncStatus);
      };
    } else {
      console.warn('window.electron.ipcRenderer not available');
    }
  }, [setSyncStatus]);

  // Listen for bookmarks added via browser extension
  useEffect(() => {
    const handleExtensionBookmark = (_event: any, item: any) => {
      console.log('Bookmark added via extension:', item);
      // Reload data to include the new bookmark
      reloadData();
      // Show a simple notification (you can enhance this with a toast component later)
      // For now, just reload the data
    };

    // @ts-ignore - window.electron is available in Electron context
    if (window.electron?.ipcRenderer) {
      window.electron.ipcRenderer.on('extension:bookmark-added', handleExtensionBookmark);
      return () => {
        window.electron.ipcRenderer.removeListener('extension:bookmark-added', handleExtensionBookmark);
      };
    }
  }, [reloadData]);

  // Fetch missing favicons when items first load (deferred to not block UI)
  useEffect(() => {
    if (items.length > 0) {
      // Defer favicon fetching slightly to let UI render first
      const timeout = setTimeout(() => {
        fetchFavicons(false); // Only fetch missing icons
      }, 500); // 500ms delay to prioritize UI rendering
      return () => clearTimeout(timeout);
    }
  }, [items.length, fetchFavicons]); // Only run when items count changes, not on every render

  // Periodically refresh expired favicons in background (every hour)
  useEffect(() => {
    if (items.length > 0) {
      const interval = setInterval(() => {
        refreshExpiredFavicons();
      }, 60 * 60 * 1000); // 1 hour
      
      // Also refresh once after initial load (after 5 minutes)
      const initialTimeout = setTimeout(() => {
        refreshExpiredFavicons();
      }, 5 * 60 * 1000); // 5 minutes
      
      return () => {
        clearInterval(interval);
        clearTimeout(initialTimeout);
      };
    }
  }, [items.length, refreshExpiredFavicons]);

  // Auto-sync on app load if sync is enabled but hasn't synced yet
  useEffect(() => {
    if (settings?.syncEnabled && !settings.lastSync && isVaultSetup && !isVaultLocked) {
      // Sync is enabled but never synced - trigger initial sync
      console.log('Auto-syncing on first load...');
      window.api.sync.upload().catch((error) => {
        console.error('Auto-sync failed:', error);
      });
    }
  }, [settings?.syncEnabled, settings?.lastSync, isVaultSetup, isVaultLocked]);

  // Initialize keyboard shortcuts
  useKeyboardShortcuts();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-dark-950">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-accent-primary border-t-transparent rounded-full animate-spin" />
          <span className="text-dark-400 text-sm">Loading Launchpad...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-screen bg-dark-950">
        <div className="flex flex-col items-center gap-4 p-8 bg-dark-900 rounded-xl border border-dark-700">
          <span className="text-accent-danger text-lg">Error loading data</span>
          <span className="text-dark-400 text-sm">{error}</span>
          <button onClick={() => loadData()} className="btn-primary mt-4">
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-dark-950 overflow-hidden">
      {/* Title bar with drag region */}
      <TitleBar />

      {/* Main content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <Sidebar />

        {/* Dashboard */}
        <Dashboard />
      </div>

      {/* Modals */}
      <AddItemModal />
      <EditItemModal />
      <GroupModal />
      <SettingsModal />
      <UnlockModal />
    </div>
  );
}

export default App;

