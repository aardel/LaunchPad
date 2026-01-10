import { useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Search,
  Settings,
  Home,
  Globe,
  Shield,
  Wifi,
  Image,
  Loader2,
  Lock,
  Unlock, // Added Unlock icon
  Activity,
  Cloud,
  CheckCircle2,
  CloudOff,
  CheckSquare,
  Sparkles,
  Command,
  User, // Added User icon
  AlertCircle, // Added AlertCircle icon
  Eye, // Added Eye icon
  EyeOff, // Added EyeOff icon
} from 'lucide-react';
import { useStore } from '../../store/useStore';
import type { NetworkProfile } from '@shared/types';

const profiles: { id: NetworkProfile; label: string; icon: typeof Home; color: string }[] = [
  { id: 'local', label: 'Local', icon: Home, color: 'text-accent-success' },
  { id: 'tailscale', label: 'Tailscale', icon: Globe, color: 'text-accent-tailscale' },
  { id: 'vpn', label: 'VPN', icon: Shield, color: 'text-accent-warning' },
];

export function TitleBar() {
  const {
    activeProfile,
    setActiveProfile,
    selectedBrowser,
    setSelectedBrowser,
    browsers,
    searchQuery,
    setSearchQuery,
    tailscaleStatus,
    openSettings,
    isFetchingFavicons,
    faviconProgress,
    isVaultSetup,
    isVaultLocked,
    lockVault,
    unlockVault,
    checkAllHealth,
    isCheckingHealth,
    healthCheckResults,
    isSyncing,
    lastSyncTime,
    syncError,
    settings,
    isSelectionMode,
    toggleSelectionMode,
    openCommandPalette,
    openVaultResetModal,
  } = useStore();

  // Unlock modal state
  const [isUnlockModalOpen, setIsUnlockModalOpen] = useState(false);
  const [unlockPassword, setUnlockPassword] = useState('');
  const [unlockError, setUnlockError] = useState<string | null>(null);
  const [showUnlockPassword, setShowUnlockPassword] = useState(false);

  // Count health status
  const healthCounts = Object.values(healthCheckResults).reduce(
    (acc, r) => {
      if (r.status === 'healthy') acc.healthy++;
      else if (r.status === 'error') acc.error++;
      else if (r.status === 'warning') acc.warning++;
      return acc;
    },
    { healthy: 0, error: 0, warning: 0 }
  );
  const totalChecked = Object.keys(healthCheckResults).length;

  const [isProfileDropdownOpen, setIsProfileDropdownOpen] = useState(false);
  const [isBrowserDropdownOpen, setIsBrowserDropdownOpen] = useState(false);

  const activeProfileData = profiles.find((p) => p.id === activeProfile) || profiles[0];
  const ActiveIcon = activeProfileData.icon;

  const handleUnlock = async () => {
    setUnlockError(null);

    const result = await window.api.encryption.unlock(unlockPassword);
    if (result.success) {
      await unlockVault();
      setIsUnlockModalOpen(false);
      setUnlockPassword('');
      setShowUnlockPassword(false);
    } else {
      setUnlockError('Incorrect password');
    }
  };

  const handleLockToggle = () => {
    if (isVaultLocked) {
      setIsUnlockModalOpen(true);
    } else {
      lockVault();
    }
  };

  const activeBrowser = browsers.find((b) => b.id === selectedBrowser) || browsers[0];

  return (
    <header className="titlebar-drag-region flex items-center justify-between h-12 px-4 bg-dark-900/80 backdrop-blur-md border-b border-dark-800 relative z-[100]">
      {/* Left: Logo & Title */}
      <div className="flex items-center gap-3">
        {/* macOS traffic lights spacer */}
        <div className="w-16" />
        <h1 className="text-lg font-semibold gradient-text">LaunchIt</h1>
      </div>

      {/* Center: Search */}
      <div className="titlebar-no-drag flex-1 max-w-md mx-8">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-dark-500" />
          <input
            type="text"
            placeholder={settings?.aiEnabled ? "Search with AI (type 4+ chars)..." : "Search bookmarks, apps, connections..."}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className={`w-full pl-10 ${settings?.aiEnabled && searchQuery.length >= 4 ? 'pr-16' : 'pr-4'} py-1.5 text-sm rounded-lg bg-dark-800 border border-dark-700 
                     text-dark-100 placeholder:text-dark-500
                     focus:outline-none focus:border-accent-primary focus:ring-1 focus:ring-accent-primary/30
                     transition-all duration-200`}
          />
          {settings?.aiEnabled && searchQuery.length >= 4 && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1 text-xs text-accent-primary/70">
              <Sparkles className="w-3 h-3" />
              <span>AI</span>
            </div>
          )}
        </div>
      </div>

      {/* Unlock Modal */}
      {isUnlockModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-dark-900 rounded-2xl shadow-2xl w-full max-w-md border border-dark-700">
            <div className="p-6">
              <div className="flex items-start gap-3 mb-4">
                <div className="p-2 bg-accent-warning/10 rounded-lg">
                  <Lock className="w-6 h-6 text-accent-warning" />
                </div>
                <div className="flex-1">
                  <h2 className="text-xl font-semibold text-dark-100">Unlock Vault</h2>
                  <p className="text-sm text-dark-400 mt-1">
                    Enter your master password to unlock encrypted data
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="input-label">Master Password</label>
                  <div className="relative">
                    <input
                      type={showUnlockPassword ? 'text' : 'password'}
                      value={unlockPassword}
                      onChange={(e) => setUnlockPassword(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleUnlock()}
                      className="input-base pr-12"
                      placeholder="Enter your password"
                      autoFocus
                    />
                    <button
                      type="button"
                      onClick={() => setShowUnlockPassword(!showUnlockPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-dark-400 hover:text-dark-200"
                    >
                      {showUnlockPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  {unlockError && (
                    <p className="text-sm text-red-400 mt-2">{unlockError}</p>
                  )}
                  <button
                    onClick={() => {
                      setIsUnlockModalOpen(false);
                      openVaultResetModal();
                    }}
                    className="text-sm text-accent-primary hover:text-accent-primary/80 transition-colors mt-2 text-left"
                  >
                    Forgot Password?
                  </button>
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={() => {
                      setIsUnlockModalOpen(false);
                      setUnlockPassword('');
                      setUnlockError(null);
                      setShowUnlockPassword(false);
                    }}
                    className="btn-secondary flex-1"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleUnlock}
                    disabled={!unlockPassword}
                    className="btn-primary flex-1 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Unlock
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Right: Browser Selector, Profile Selector & Settings */}
      <div className="titlebar-no-drag flex items-center gap-2">
        {/* Favicon Fetching Indicator */}
        {isFetchingFavicons && (
          <div className="flex items-center gap-2 px-2 py-1 rounded-lg bg-dark-800/50 border border-dark-700">
            <Loader2 className="w-3.5 h-3.5 text-accent-primary animate-spin" />
            <span className="text-xs text-dark-400">
              <Image className="w-3 h-3 inline mr-1" />
              {faviconProgress.current}/{faviconProgress.total}
            </span>
          </div>
        )}

        {/* Health Check Button */}
        <button
          onClick={checkAllHealth}
          disabled={isCheckingHealth}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium
                    transition-all duration-200 ${isCheckingHealth
              ? 'bg-dark-800 text-dark-400 cursor-wait'
              : totalChecked > 0
                ? healthCounts.error > 0
                  ? 'bg-accent-danger/20 text-accent-danger hover:bg-accent-danger/30'
                  : healthCounts.warning > 0
                    ? 'bg-accent-warning/20 text-accent-warning hover:bg-accent-warning/30'
                    : 'bg-accent-success/20 text-accent-success hover:bg-accent-success/30'
                : 'bg-dark-800 text-dark-400 hover:bg-dark-700 hover:text-dark-200'
            }`}
          title={
            isCheckingHealth
              ? 'Checking...'
              : totalChecked > 0
                ? `${healthCounts.healthy} healthy, ${healthCounts.warning} warnings, ${healthCounts.error} errors`
                : 'Check bookmark health'
          }
        >
          {isCheckingHealth ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Activity className="w-3.5 h-3.5" />
          )}
          {totalChecked > 0 && !isCheckingHealth && (
            <span>{healthCounts.healthy}/{totalChecked}</span>
          )}
        </button>

        {/* Tailscale Status */}
        <div className="flex items-center gap-2 px-2">
          <Wifi
            className={`w-4 h-4 ${tailscaleStatus.connected ? 'text-accent-tailscale' : 'text-dark-500'
              }`}
          />
          {tailscaleStatus.connected && tailscaleStatus.tailnetName && (
            <span className="text-xs text-dark-400 hidden xl:block">
              {tailscaleStatus.tailnetName}
            </span>
          )}
        </div>

        {/* Sync Status */}
        {settings?.syncEnabled && (
          <div className="flex items-center gap-1.5 px-2" title={
            isSyncing
              ? 'Syncing...'
              : syncError
                ? `Sync error: ${syncError}`
                : lastSyncTime
                  ? `Last synced: ${new Date(lastSyncTime).toLocaleTimeString()}`
                  : 'Sync enabled'
          }>
            {isSyncing ? (
              <Loader2 className="w-4 h-4 text-accent-primary animate-spin" />
            ) : syncError ? (
              <CloudOff className="w-4 h-4 text-accent-danger" />
            ) : lastSyncTime ? (
              <CheckCircle2 className="w-4 h-4 text-accent-success" />
            ) : (
              <Cloud className="w-4 h-4 text-dark-500" />
            )}
          </div>
        )}

        {/* Browser Selector */}
        {browsers.length > 0 && (
          <div className="relative">
            <button
              onClick={() => setIsBrowserDropdownOpen(!isBrowserDropdownOpen)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-dark-800 border border-dark-700
                       hover:bg-dark-700 hover:border-dark-600 transition-all duration-200"
              title="Select Browser"
            >
              <span className="text-base">{activeBrowser?.icon || '🌐'}</span>
              <span className="text-sm font-medium text-dark-200 hidden lg:block">
                {activeBrowser?.name || 'Browser'}
              </span>
              <svg
                className={`w-4 h-4 text-dark-400 transition-transform duration-200 ${isBrowserDropdownOpen ? 'rotate-180' : ''
                  }`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {isBrowserDropdownOpen && createPortal(
              <>
                <div
                  className="fixed inset-0 z-[1000]"
                  onClick={() => setIsBrowserDropdownOpen(false)}
                />
                <div
                  className="fixed mt-1 w-52 py-2 bg-dark-800 border border-dark-700 rounded-lg shadow-xl z-[1001] animate-slide-down"
                  style={{
                    top: '44px',
                    right: '110px'
                  }}
                >
                  <div className="px-3 py-1.5 text-xs font-medium text-dark-500 uppercase tracking-wider">
                    Open bookmarks in
                  </div>
                  {browsers.map((browser) => {
                    const isActive = selectedBrowser === browser.id;

                    return (
                      <button
                        key={browser.id}
                        onClick={() => {
                          setSelectedBrowser(browser.id);
                          setIsBrowserDropdownOpen(false);
                        }}
                        className={`w-full flex items-center gap-3 px-4 py-2 text-left
                                  ${isActive ? 'bg-dark-700 text-dark-100' : 'text-dark-300 hover:bg-dark-700/50'}
                                  transition-colors duration-150`}
                      >
                        <span className="text-lg">{browser.icon}</span>
                        <span className="text-sm flex-1">{browser.name}</span>
                        {isActive && (
                          <svg
                            className="w-4 h-4 text-accent-primary"
                            fill="currentColor"
                            viewBox="0 0 20 20"
                          >
                            <path
                              fillRule="evenodd"
                              d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                              clipRule="evenodd"
                            />
                          </svg>
                        )}
                      </button>
                    );
                  })}
                </div>
              </>,
              document.body
            )}
          </div>
        )}

        {/* Profile Selector */}
        <div className="relative">
          <button
            onClick={() => setIsProfileDropdownOpen(!isProfileDropdownOpen)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-dark-800 border border-dark-700
                     hover:bg-dark-700 hover:border-dark-600 transition-all duration-200"
          >
            <ActiveIcon className={`w-4 h-4 ${activeProfileData.color}`} />
            <span className="text-sm font-medium text-dark-200">{activeProfileData.label}</span>
            <svg
              className={`w-4 h-4 text-dark-400 transition-transform duration-200 ${isProfileDropdownOpen ? 'rotate-180' : ''
                }`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {isProfileDropdownOpen && createPortal(
            <>
              <div
                className="fixed inset-0 z-[1000]"
                onClick={() => setIsProfileDropdownOpen(false)}
              />
              <div
                className="fixed mt-1 w-48 py-2 bg-dark-800 border border-dark-700 rounded-lg shadow-xl z-[1001] animate-slide-down"
                style={{
                  top: '44px',
                  right: '10px'
                }}
              >
                <div className="px-3 py-1.5 text-xs font-medium text-dark-500 uppercase tracking-wider">
                  Network Profile
                </div>
                {profiles.map((profile) => {
                  const Icon = profile.icon;
                  const isActive = activeProfile === profile.id;
                  const isDisabled = profile.id === 'tailscale' && !tailscaleStatus.connected;

                  return (
                    <button
                      key={profile.id}
                      onClick={() => {
                        if (!isDisabled) {
                          setActiveProfile(profile.id);
                          setIsProfileDropdownOpen(false);
                        }
                      }}
                      disabled={isDisabled}
                      className={`w-full flex items-center gap-3 px-4 py-2 text-left
                                ${isActive ? 'bg-dark-700 text-dark-100' : 'text-dark-300 hover:bg-dark-700/50'}
                                ${isDisabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
                                transition-colors duration-150`}
                    >
                      <Icon className={`w-4 h-4 ${profile.color}`} />
                      <span className="text-sm">{profile.label}</span>
                      {isActive && (
                        <svg
                          className="w-4 h-4 ml-auto text-accent-primary"
                          fill="currentColor"
                          viewBox="0 0 20 20"
                        >
                          <path
                            fillRule="evenodd"
                            d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                            clipRule="evenodd"
                          />
                        </svg>
                      )}
                      {profile.id === 'tailscale' && !tailscaleStatus.connected && (
                        <span className="ml-auto text-xs text-dark-500">Offline</span>
                      )}
                    </button>
                  );
                })}
              </div>
            </>,
            document.body
          )}
        </div>

        {/* Selection Mode Toggle */}
        <button
          onClick={toggleSelectionMode}
          className={`p-2 rounded-lg transition-all duration-200 ${isSelectionMode
            ? 'bg-accent-primary/20 text-accent-primary hover:bg-accent-primary/30'
            : 'text-dark-400 hover:text-dark-200 hover:bg-dark-800'
            }`}
          title={isSelectionMode ? 'Exit Selection Mode' : 'Select Items'}
        >
          <CheckSquare className="w-5 h-5" />
        </button>

        {/* Lock/Unlock Vault Button */}
        {isVaultSetup && (
          <button
            onClick={handleLockToggle}
            className="p-2 rounded-lg text-dark-400 hover:text-accent-warning hover:bg-dark-800 
                     transition-all duration-200"
            title={isVaultLocked ? 'Unlock Vault' : 'Lock Vault'}
          >
            {isVaultLocked ? <Lock className="w-5 h-5" /> : <Unlock className="w-5 h-5" />}
          </button>
        )}

        {/* Command Palette */}
        <button
          onClick={openCommandPalette}
          className="p-2 rounded-lg text-dark-400 hover:text-dark-200 hover:bg-dark-800 
                   transition-all duration-200"
          title="Command Palette (Cmd+K)"
        >
          <Command className="w-5 h-5" />
        </button>

        {/* Settings */}
        <button
          onClick={openSettings}
          className="p-2 rounded-lg text-dark-400 hover:text-dark-200 hover:bg-dark-800 
                   transition-all duration-200"
        >
          <Settings className="w-5 h-5" />
        </button>
      </div>
    </header>
  );
}
