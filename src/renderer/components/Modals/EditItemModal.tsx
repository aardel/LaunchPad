import { useState, useEffect } from 'react';
import { X, FolderOpen, Eye, EyeOff, Key } from 'lucide-react';
import { useStore } from '../../store/useStore';
import type { Protocol, UpdateItemInput, BookmarkItem, SSHItem, AppItem, PasswordItem } from '@shared/types';

const protocols: Protocol[] = ['https', 'http', 'ftp', 'rdp', 'vnc', 'custom'];

export function EditItemModal() {
  const {
    groups,
    isEditModalOpen,
    editingItem,
    closeEditModal,
    updateItem,
    isVaultLocked,
  } = useStore();

  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form state
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [groupId, setGroupId] = useState('');
  const [icon, setIcon] = useState('');
  const [color, setColor] = useState('#6366f1');

  // Bookmark specific
  const [protocol, setProtocol] = useState<Protocol>('https');
  const [port, setPort] = useState('');
  const [path, setPath] = useState('');
  const [localAddress, setLocalAddress] = useState('');
  const [tailscaleAddress, setTailscaleAddress] = useState('');
  const [vpnAddress, setVpnAddress] = useState('');

  // SSH specific
  const [username, setUsername] = useState('root');
  const [sshPort, setSshPort] = useState('22');

  // Credentials
  const [credUsername, setCredUsername] = useState('');
  const [credPassword, setCredPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [hasExistingPassword, setHasExistingPassword] = useState(false);
  const [clearExistingPassword, setClearExistingPassword] = useState(false);

  // App specific
  const [appPath, setAppPath] = useState('');

  // Password specific
  const [service, setService] = useState('');
  const [passwordUrl, setPasswordUrl] = useState('');
  const [passwordNotes, setPasswordNotes] = useState('');

  // Populate form when editing item changes
  useEffect(() => {
    if (editingItem) {
      setName(editingItem.name);
      setDescription(editingItem.description || '');
      setGroupId(editingItem.groupId);
      setIcon(editingItem.icon || '');
      setColor(editingItem.color || '#6366f1');

      if (editingItem.type === 'bookmark') {
        const bookmark = editingItem as BookmarkItem;
        setProtocol(bookmark.protocol || 'https');
        setPort(bookmark.port?.toString() || '');

        // Fix: If path looks like a domain (contains dot, no slash) or matches local address, clear it
        let bookmarkPath = bookmark.path || '';
        const localAddr = bookmark.networkAddresses?.local || '';
        if (bookmarkPath === localAddr || (bookmarkPath.includes('.') && !bookmarkPath.startsWith('/'))) {
          bookmarkPath = ''; // Clear incorrect path
        }
        setPath(bookmarkPath);

        setLocalAddress(localAddr);
        setTailscaleAddress(bookmark.networkAddresses?.tailscale || '');
        setVpnAddress(bookmark.networkAddresses?.vpn || '');
        setCredUsername(bookmark.credentials?.username || '');
        setClearExistingPassword(false);

        // Decrypt and load the existing password if present
        if (bookmark.credentials?.password) {
          setHasExistingPassword(true);
          window.api.encryption.decrypt(bookmark.credentials.password).then((res: any) => {
            if (res.success && res.data) {
              setCredPassword(res.data);
            } else {
              setCredPassword('');
            }
          }).catch(() => {
            setCredPassword('');
          });
        } else {
          setHasExistingPassword(false);
          setCredPassword('');
        }
      } else if (editingItem.type === 'ssh') {
        const ssh = editingItem as SSHItem;
        setUsername(ssh.username || 'root');
        setSshPort(ssh.port?.toString() || '22');
        setLocalAddress(ssh.networkAddresses?.local || '');
        setTailscaleAddress(ssh.networkAddresses?.tailscale || '');
        setVpnAddress(ssh.networkAddresses?.vpn || '');
        setClearExistingPassword(false);

        // Decrypt and load the existing password if present
        if (ssh.credentials?.password) {
          setHasExistingPassword(true);
          // Try to decrypt the password
          window.api.encryption.decrypt(ssh.credentials.password).then((res: any) => {
            if (res.success && res.data) {
              setCredPassword(res.data);
            } else {
              setCredPassword('');
            }
          }).catch(() => {
            setCredPassword('');
          });
        } else {
          setHasExistingPassword(false);
          setCredPassword('');
        }
      } else if (editingItem.type === 'app') {
        const app = editingItem as AppItem;
        setAppPath(app.appPath || '');
      } else if (editingItem.type === 'password') {
        const password = editingItem as PasswordItem;
        setService(password.service || password.name);
        setPasswordUrl(password.url || '');
        setClearExistingPassword(false);

        // Decrypt and load credentials if present
        if (password.credentials) {
          setCredUsername(password.credentials.username || '');
          setPasswordNotes(password.credentials.notes || '');

          if (password.credentials.password) {
            setHasExistingPassword(true);
            window.api.encryption.decrypt(password.credentials.password).then((res: any) => {
              if (res.success && res.data) {
                setCredPassword(res.data);
              } else {
                setCredPassword('');
              }
            }).catch(() => {
              setCredPassword('');
            });
          } else {
            setHasExistingPassword(false);
            setCredPassword('');
          }
        } else {
          setHasExistingPassword(false);
          setCredUsername('');
          setCredPassword('');
          setPasswordNotes('');
        }
      }
      setShowPassword(false);
    }
  }, [editingItem]);

  // Re-decrypt passwords when vault unlocks
  useEffect(() => {
    if (!editingItem || isVaultLocked || !hasExistingPassword) return;

    // Vault just unlocked, re-decrypt the password
    if (editingItem.type === 'bookmark') {
      const bookmark = editingItem as BookmarkItem;
      if (bookmark.credentials?.password) {
        window.api.encryption.decrypt(bookmark.credentials.password).then((res: any) => {
          if (res.success && res.data) {
            setCredPassword(res.data);
          }
        });
      }
    } else if (editingItem.type === 'ssh') {
      const ssh = editingItem as SSHItem;
      if (ssh.credentials?.password) {
        window.api.encryption.decrypt(ssh.credentials.password).then((res: any) => {
          if (res.success && res.data) {
            setCredPassword(res.data);
          }
        });
      }
    } else if (editingItem.type === 'password') {
      const password = editingItem as PasswordItem;
      if (password.credentials?.password) {
        window.api.encryption.decrypt(password.credentials.password).then((res: any) => {
          if (res.success && res.data) {
            setCredPassword(res.data);
          }
        });
      }
    }
  }, [isVaultLocked, editingItem, hasExistingPassword]);

  const handleSelectApp = async () => {
    const result = await window.api.system.selectApp();
    if (result.success && result.data) {
      setAppPath(result.data);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem || !name.trim()) return;

    setIsSubmitting(true);

    try {
      const input: UpdateItemInput = {
        id: editingItem.id,
        name: name.trim(),
        description: description.trim() || undefined,
        groupId,
        icon: icon || undefined,
        color,
      };

      if (editingItem.type === 'bookmark') {
        input.protocol = protocol;
        input.port = port ? parseInt(port, 10) : undefined;
        input.path = path || undefined;
        input.networkAddresses = {
          local: localAddress || undefined,
          tailscale: tailscaleAddress || undefined,
          vpn: vpnAddress || undefined,
        };
        // Handle credentials: clear, update, or keep existing
        if (clearExistingPassword) {
          // User wants to remove credentials - pass null to clear in database
          input.credentials = null as any;
        } else if (credUsername || credPassword) {
          // User has entered username or password
          let encryptedPassword: string | undefined;
          if (credPassword) {
            try {
              const res = await window.api.encryption.encrypt(credPassword);
              if (res.success && res.data) {
                encryptedPassword = res.data;
              } else {
                encryptedPassword = credPassword;
              }
            } catch {
              encryptedPassword = credPassword;
            }
          }
          input.credentials = {
            username: credUsername || undefined,
            password: encryptedPassword,
          };
        }
        // If none of the above, don't include credentials (keeps existing)
      } else if (editingItem.type === 'ssh') {
        input.username = username;
        input.port = parseInt(sshPort, 10) || 22;
        input.networkAddresses = {
          local: localAddress || undefined,
          tailscale: tailscaleAddress || undefined,
          vpn: vpnAddress || undefined,
        };
        // Handle password: new password, clear password, or keep existing
        if (clearExistingPassword) {
          // User wants to remove the password - pass null to clear in database
          input.credentials = null as any;
        } else if (credPassword) {
          // User entered a new password
          let encryptedPassword = credPassword;
          try {
            const res = await window.api.encryption.encrypt(credPassword);
            if (res.success && res.data) {
              encryptedPassword = res.data;
            }
          } catch {
            // If encryption fails, store as-is
          }
          input.credentials = {
            password: encryptedPassword,
          };
        }
        // If neither, don't include credentials in update (keeps existing)
      } else if (editingItem.type === 'app') {
        input.appPath = appPath;
      } else if (editingItem.type === 'password') {
        input.service = service.trim() || name.trim();
        input.url = passwordUrl.trim() || undefined;

        // Handle credentials: clear, update, or keep existing
        if (clearExistingPassword) {
          input.credentials = null as any;
        } else if (credUsername || credPassword || passwordNotes) {
          let encryptedPassword: string | undefined;
          if (credPassword) {
            try {
              const res = await window.api.encryption.encrypt(credPassword);
              if (res.success && res.data) {
                encryptedPassword = res.data;
              } else {
                encryptedPassword = credPassword;
              }
            } catch {
              encryptedPassword = credPassword;
            }
          }
          input.credentials = {
            username: credUsername || undefined,
            password: encryptedPassword,
            notes: passwordNotes.trim() || undefined,
          };
        }
        // If none of the above, don't include credentials (keeps existing)
      }

      await updateItem(input);
      closeEditModal();
    } catch (error) {
      console.error('Failed to update item:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isEditModalOpen || !editingItem) return null;

  const typeLabels = {
    bookmark: 'Bookmark',
    ssh: 'SSH Connection',
    app: 'Application',
    password: 'Password',
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-dark-950/80 backdrop-blur-sm"
        onClick={closeEditModal}
      />

      {/* Modal */}
      <div className="relative w-full max-w-lg bg-dark-900 border border-dark-700 rounded-2xl shadow-2xl animate-scale-in overflow-hidden max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-dark-800">
          <h2 className="text-xl font-semibold text-dark-100">
            Edit {typeLabels[editingItem.type]}
          </h2>
          <button
            onClick={closeEditModal}
            className="p-2 rounded-lg text-dark-400 hover:text-dark-200 hover:bg-dark-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto">
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Common fields */}
            <div>
              <label className="input-label">Name *</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="My Service"
                className="input-base"
                required
                autoFocus
              />
            </div>

            <div>
              <label className="input-label">Group *</label>
              <div className="relative">
                <FolderOpen className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-dark-500" />
                <select
                  value={groupId}
                  onChange={(e) => setGroupId(e.target.value)}
                  className="input-base pl-10 appearance-none cursor-pointer"
                  required
                >
                  {groups.map((group) => (
                    <option key={group.id} value={group.id}>
                      {group.icon} {group.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Type-specific fields */}
            {editingItem.type === 'bookmark' && (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="input-label">Protocol</label>
                    <select
                      value={protocol}
                      onChange={(e) => setProtocol(e.target.value as Protocol)}
                      className="input-base"
                    >
                      {protocols.map((p) => (
                        <option key={p} value={p}>{p.toUpperCase()}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="input-label">Port</label>
                    <input
                      type="number"
                      value={port}
                      onChange={(e) => setPort(e.target.value)}
                      placeholder="8080"
                      className="input-base"
                    />
                  </div>
                </div>

                <div>
                  <label className="input-label">URL Path (Optional)</label>
                  <input
                    type="text"
                    value={path}
                    onChange={(e) => {
                      const newPath = e.target.value;
                      // Warn if user enters something that looks like a domain
                      if (newPath && newPath.includes('.') && !newPath.startsWith('/') && !newPath.startsWith('http')) {
                        // Don't prevent, but the validation will catch it
                      }
                      setPath(newPath);
                    }}
                    placeholder="/admin or /dashboard/page"
                    className="input-base"
                  />
                  <p className="text-xs text-dark-500 mt-1">
                    The path after the domain (e.g., /admin, /dashboard). Leave empty for root.
                    <br />
                    <span className="text-accent-warning">⚠️ Don't enter the domain here - use the "Default Address" field below.</span>
                  </p>
                </div>

                <div className="p-4 bg-dark-800/50 rounded-lg space-y-3">
                  <div>
                    <h4 className="text-sm font-medium text-dark-300 mb-1">Network Addresses</h4>
                    <p className="text-xs text-dark-500 mb-3">
                      Enter the hostname, domain, or IP address for each network profile
                    </p>
                  </div>
                  <div>
                    <label className="input-label text-xs">Default Address *</label>
                    <input
                      type="text"
                      value={localAddress}
                      onChange={(e) => setLocalAddress(e.target.value)}
                      placeholder="example.com or 192.168.1.100"
                      className="input-base text-sm"
                      required
                    />
                    <p className="text-xs text-dark-500 mt-1">
                      Used when no specific network profile is selected
                    </p>
                  </div>
                  <div>
                    <label className="input-label text-xs">Tailscale Address (Optional)</label>
                    <input
                      type="text"
                      value={tailscaleAddress}
                      onChange={(e) => setTailscaleAddress(e.target.value)}
                      placeholder="myserver.tailnet.ts.net"
                      className="input-base text-sm"
                    />
                  </div>
                  <div>
                    <label className="input-label text-xs">VPN Address (Optional)</label>
                    <input
                      type="text"
                      value={vpnAddress}
                      onChange={(e) => setVpnAddress(e.target.value)}
                      placeholder="10.0.0.100 or vpn.example.com"
                      className="input-base text-sm"
                    />
                  </div>
                </div>

                {/* Credentials */}
                <div className={`p-4 bg-dark-800/50 rounded-lg space-y-3 border ${clearExistingPassword ? 'border-accent-danger/20' : 'border-accent-warning/20'}`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Key className="w-4 h-4 text-accent-warning" />
                      <h4 className="text-sm font-medium text-dark-300">Credentials (Optional)</h4>
                    </div>
                    {hasExistingPassword && !clearExistingPassword && (
                      <button
                        type="button"
                        onClick={() => {
                          setClearExistingPassword(true);
                          setCredPassword('');
                        }}
                        className="text-xs text-accent-danger hover:underline"
                      >
                        Remove Password
                      </button>
                    )}
                  </div>

                  {clearExistingPassword ? (
                    <div className="flex items-center justify-between p-3 bg-accent-danger/10 rounded-lg">
                      <span className="text-sm text-accent-danger">Password will be removed</span>
                      <button
                        type="button"
                        onClick={() => setClearExistingPassword(false)}
                        className="text-xs text-dark-400 hover:text-dark-200"
                      >
                        Undo
                      </button>
                    </div>
                  ) : (
                    <>
                      <div>
                        <label className="input-label text-xs">Username</label>
                        <input
                          type="text"
                          value={credUsername}
                          onChange={(e) => setCredUsername(e.target.value)}
                          placeholder="admin"
                          className="input-base text-sm"
                        />
                      </div>
                      <div>
                        <label className="input-label text-xs">Password</label>
                        {isVaultLocked ? (
                          <div className="p-3 bg-accent-warning/10 border border-accent-warning/30 rounded-lg text-sm text-accent-warning flex items-center gap-2">
                            <Key className="w-4 h-4" />
                            <span>🔒 Unlock vault to view password</span>
                          </div>
                        ) : (
                          <>
                            <div className="relative">
                              <input
                                type={showPassword ? 'text' : 'password'}
                                value={credPassword}
                                onChange={(e) => setCredPassword(e.target.value)}
                                placeholder="Enter password"
                                className="input-base text-sm pr-12"
                              />
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  setShowPassword(prev => !prev);
                                }}
                                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-dark-400 hover:text-dark-200 z-10"
                              >
                                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                              </button>
                            </div>
                            <p className="text-xs text-dark-500 mt-1">Encrypted with your master password</p>
                          </>
                        )}
                      </div>
                    </>
                  )}
                </div>
              </>
            )}

            {editingItem.type === 'ssh' && (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="input-label">Username</label>
                    <input
                      type="text"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder="root"
                      className="input-base"
                    />
                  </div>
                  <div>
                    <label className="input-label">Port</label>
                    <input
                      type="number"
                      value={sshPort}
                      onChange={(e) => setSshPort(e.target.value)}
                      placeholder="22"
                      className="input-base"
                    />
                  </div>
                </div>

                <div className="p-4 bg-dark-800/50 rounded-lg space-y-3">
                  <h4 className="text-sm font-medium text-dark-300">Host Addresses</h4>
                  <div>
                    <label className="input-label text-xs">Local (LAN)</label>
                    <input
                      type="text"
                      value={localAddress}
                      onChange={(e) => setLocalAddress(e.target.value)}
                      placeholder="192.168.1.100"
                      className="input-base text-sm"
                    />
                  </div>
                  <div>
                    <label className="input-label text-xs">Tailscale</label>
                    <input
                      type="text"
                      value={tailscaleAddress}
                      onChange={(e) => setTailscaleAddress(e.target.value)}
                      placeholder="myserver.tailnet.ts.net"
                      className="input-base text-sm"
                    />
                  </div>
                  <div>
                    <label className="input-label text-xs">VPN</label>
                    <input
                      type="text"
                      value={vpnAddress}
                      onChange={(e) => setVpnAddress(e.target.value)}
                      placeholder="10.0.0.100"
                      className="input-base text-sm"
                    />
                  </div>
                </div>

                {/* SSH Password */}
                <div className={`p-4 bg-dark-800/50 rounded-lg space-y-3 border ${clearExistingPassword ? 'border-accent-danger/20' : 'border-accent-warning/20'}`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Key className="w-4 h-4 text-accent-warning" />
                      <h4 className="text-sm font-medium text-dark-300">SSH Password (Optional)</h4>
                    </div>
                    {hasExistingPassword && !clearExistingPassword && (
                      <button
                        type="button"
                        onClick={() => {
                          setClearExistingPassword(true);
                          setCredPassword('');
                        }}
                        className="text-xs text-accent-danger hover:underline"
                      >
                        Remove Password
                      </button>
                    )}
                  </div>

                  {clearExistingPassword ? (
                    <div className="flex items-center justify-between p-3 bg-accent-danger/10 rounded-lg">
                      <span className="text-sm text-accent-danger">Password will be removed</span>
                      <button
                        type="button"
                        onClick={() => setClearExistingPassword(false)}
                        className="text-xs text-dark-400 hover:text-dark-200"
                      >
                        Undo
                      </button>
                    </div>
                  ) : (
                    <div>
                      <label className="input-label text-xs">
                        Password {hasExistingPassword && !credPassword && <span className="text-dark-500">(unchanged)</span>}
                      </label>
                      {isVaultLocked ? (
                        <div className="p-3 bg-accent-warning/10 border border-accent-warning/30 rounded-lg text-sm text-accent-warning flex items-center gap-2">
                          <Key className="w-4 h-4" />
                          <span>🔒 Unlock vault to view password</span>
                        </div>
                      ) : (
                        <>
                          <div className="relative">
                            <input
                              type={showPassword ? 'text' : 'password'}
                              value={credPassword}
                              onChange={(e) => setCredPassword(e.target.value)}
                              placeholder={hasExistingPassword ? '••••••••' : 'Leave empty to use SSH key'}
                              className="input-base text-sm pr-12"
                            />
                            <button
                              type="button"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                setShowPassword(prev => !prev);
                              }}
                              className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-dark-400 hover:text-dark-200 z-10"
                            >
                              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </button>
                          </div>
                          <p className="text-xs text-dark-500 mt-1">
                            {hasExistingPassword ? 'Leave empty to keep existing password' : 'Encrypted with your master password'}
                          </p>
                        </>
                      )}
                    </div>
                  )}
                </div>
              </>
            )}

            {editingItem.type === 'app' && (
              <div>
                <label className="input-label">Application Path *</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={appPath}
                    onChange={(e) => setAppPath(e.target.value)}
                    placeholder="/Applications/MyApp.app"
                    className="input-base flex-1"
                    required
                  />
                  <button
                    type="button"
                    onClick={handleSelectApp}
                    className="btn-secondary whitespace-nowrap"
                  >
                    Browse
                  </button>
                </div>
              </div>
            )}

            {editingItem.type === 'password' && (
              <>
                <div>
                  <label className="input-label">Service Name *</label>
                  <input
                    type="text"
                    value={service}
                    onChange={(e) => setService(e.target.value)}
                    placeholder="GitHub, Gmail, etc."
                    className="input-base"
                    required
                  />
                </div>

                <div>
                  <label className="input-label">Username</label>
                  <input
                    type="text"
                    value={credUsername}
                    onChange={(e) => setCredUsername(e.target.value)}
                    placeholder="your@email.com"
                    className="input-base"
                  />
                </div>

                <div className={`p-4 bg-dark-800/50 rounded-lg space-y-3 border ${clearExistingPassword ? 'border-accent-danger/20' : 'border-accent-warning/20'}`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Key className="w-4 h-4 text-accent-warning" />
                      <h4 className="text-sm font-medium text-dark-300">Password</h4>
                    </div>
                    {hasExistingPassword && !clearExistingPassword && (
                      <button
                        type="button"
                        onClick={() => {
                          setClearExistingPassword(true);
                          setCredPassword('');
                        }}
                        className="text-xs text-accent-danger hover:underline"
                      >
                        Remove Password
                      </button>
                    )}
                  </div>

                  {clearExistingPassword ? (
                    <div className="flex items-center justify-between p-3 bg-accent-danger/10 rounded-lg">
                      <span className="text-sm text-accent-danger">Password will be removed</span>
                      <button
                        type="button"
                        onClick={() => setClearExistingPassword(false)}
                        className="text-xs text-dark-400 hover:text-dark-200"
                      >
                        Undo
                      </button>
                    </div>
                  ) : (
                    <div>
                      <label className="input-label text-xs">
                        Password {hasExistingPassword && !credPassword && <span className="text-dark-500">(unchanged)</span>}
                      </label>
                      {isVaultLocked ? (
                        <div className="p-3 bg-accent-warning/10 border border-accent-warning/30 rounded-lg text-sm text-accent-warning flex items-center gap-2">
                          <Key className="w-4 h-4" />
                          <span>🔒 Unlock vault to view password</span>
                        </div>
                      ) : (
                        <>
                          <div className="relative">
                            <input
                              type={showPassword ? 'text' : 'password'}
                              value={credPassword}
                              onChange={(e) => setCredPassword(e.target.value)}
                              placeholder={hasExistingPassword ? '••••••••' : 'Enter password'}
                              className="input-base text-sm pr-12"
                            />
                            <button
                              type="button"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                setShowPassword(prev => !prev);
                              }}
                              className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-dark-dark-400 hover:text-dark-200 z-10"
                            >
                              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </button>
                          </div>
                          <p className="text-xs text-dark-500 mt-1">
                            {hasExistingPassword ? 'Leave empty to keep existing password' : 'Encrypted with your master password'}
                          </p>
                        </>
                      )}
                    </div>
                  )}
                </div>

                <div>
                  <label className="input-label">URL (Optional)</label>
                  <input
                    type="url"
                    value={passwordUrl}
                    onChange={(e) => setPasswordUrl(e.target.value)}
                    placeholder="https://example.com/login"
                    className="input-base"
                  />
                  <p className="text-xs text-dark-500 mt-1">
                    Website URL - will open when clicking the password item
                  </p>
                </div>

                <div>
                  <label className="input-label">Notes</label>
                  <textarea
                    value={passwordNotes}
                    onChange={(e) => setPasswordNotes(e.target.value)}
                    placeholder="Additional notes or information..."
                    rows={3}
                    className="input-base resize-none"
                  />
                </div>
              </>
            )}

            {/* Description */}
            <div>
              <label className="input-label">Description</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Optional notes..."
                rows={2}
                className="input-base resize-none"
              />
            </div>

            {/* Icon & Color */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="input-label">Icon (emoji)</label>
                <input
                  type="text"
                  value={icon}
                  onChange={(e) => setIcon(e.target.value)}
                  placeholder="🚀"
                  className="input-base"
                />
              </div>
              <div>
                <label className="input-label">Color</label>
                <div className="flex gap-2">
                  <input
                    type="color"
                    value={color}
                    onChange={(e) => setColor(e.target.value)}
                    className="w-10 h-10 rounded-lg cursor-pointer bg-transparent"
                  />
                  <input
                    type="text"
                    value={color}
                    onChange={(e) => setColor(e.target.value)}
                    className="input-base flex-1"
                  />
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-3 pt-4 border-t border-dark-800">
              <button
                type="button"
                onClick={closeEditModal}
                className="btn-secondary"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting || !name.trim()}
                className="btn-primary"
              >
                {isSubmitting ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

