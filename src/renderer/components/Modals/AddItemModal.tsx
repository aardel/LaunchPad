import { useState, useEffect } from 'react';
import { X, Globe, Terminal, AppWindow, FolderOpen, Eye, EyeOff, Key } from 'lucide-react';
import { useStore } from '../../store/useStore';
import type { ItemType, Protocol, CreateItemInput } from '@shared/types';

const itemTypes: { id: ItemType; label: string; icon: typeof Globe; description: string }[] = [
  { id: 'bookmark', label: 'Bookmark', icon: Globe, description: 'Web URL, local service, or API endpoint' },
  { id: 'ssh', label: 'SSH Connection', icon: Terminal, description: 'SSH connection to a server' },
  { id: 'app', label: 'Application', icon: AppWindow, description: 'Local application shortcut' },
  { id: 'password', label: 'Password', icon: Key, description: 'Password entry for a service or website' },
];

const protocols: Protocol[] = ['https', 'http', 'ftp', 'rdp', 'vnc', 'custom'];

export function AddItemModal() {
  const { isAddModalOpen, closeAddModal, createItem, groups, selectedGroupId } = useStore();

  const [step, setStep] = useState<'type' | 'form'>('type');
  const [selectedType, setSelectedType] = useState<ItemType>('bookmark');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form state
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [groupId, setGroupId] = useState(selectedGroupId || groups[0]?.id || '');
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

  // Credentials (for both bookmark and SSH)
  const [credUsername, setCredUsername] = useState('');
  const [credPassword, setCredPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // App specific
  const [appPath, setAppPath] = useState('');

  // Password specific
  const [service, setService] = useState('');
  const [passwordUrl, setPasswordUrl] = useState('');
  const [passwordNotes, setPasswordNotes] = useState('');

  // Reset form when modal opens
  useEffect(() => {
    if (isAddModalOpen) {
      setStep('type');
      setSelectedType('bookmark');
      setName('');
      setDescription('');
      setGroupId(selectedGroupId || groups[0]?.id || '');
      setIcon('');
      setColor('#6366f1');
      setProtocol('https');
      setPort('');
      setPath('');
      setLocalAddress('');
      setTailscaleAddress('');
      setVpnAddress('');
      setUsername('root');
      setSshPort('22');
      setCredUsername('');
      setCredPassword('');
      setShowPassword(false);
      setAppPath('');
      setService('');
      setPasswordUrl('');
      setPasswordNotes('');
    }
  }, [isAddModalOpen, selectedGroupId, groups]);

  const handleSelectType = (type: ItemType) => {
    setSelectedType(type);
    setStep('form');
  };

  const handleSelectApp = async () => {
    const result = await window.api.system.selectApp();
    if (result.success && result.data) {
      setAppPath(result.data);
      // Auto-fill name from app path
      if (!name) {
        const appName = result.data.split('/').pop()?.replace('.app', '') || '';
        setName(appName);
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !groupId) return;

    setIsSubmitting(true);

    try {
      const input: CreateItemInput = {
        type: selectedType,
        name: name.trim(),
        description: description.trim() || undefined,
        groupId,
        icon: icon || undefined,
        color,
      };

      if (selectedType === 'bookmark') {
        input.protocol = protocol;
        input.port = port ? parseInt(port, 10) : undefined;
        input.path = path || undefined;
        input.networkAddresses = {
          local: localAddress || undefined,
          tailscale: tailscaleAddress || undefined,
          vpn: vpnAddress || undefined,
        };
        // Add credentials if provided
        if (credUsername || credPassword) {
          // Encrypt password if vault is unlocked
          let encryptedPassword = credPassword;
          if (credPassword) {
            try {
              const res = await window.api.encryption.encrypt(credPassword);
              if (res.success && res.data) {
                encryptedPassword = res.data;
              }
            } catch {
              // If encryption fails, store as-is (vault might not be set up)
            }
          }
          input.credentials = {
            username: credUsername || undefined,
            password: encryptedPassword || undefined,
          };
        }
      } else if (selectedType === 'ssh') {
        input.username = username;
        input.port = parseInt(sshPort, 10) || 22;
        input.networkAddresses = {
          local: localAddress || undefined,
          tailscale: tailscaleAddress || undefined,
          vpn: vpnAddress || undefined,
        };
        // Add credentials if password provided
        if (credPassword) {
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
      } else if (selectedType === 'app') {
        input.appPath = appPath;
      } else if (selectedType === 'password') {
        // For password items, use service name as the display name if provided
        const serviceName = service.trim() || name.trim();
        input.name = serviceName; // Set name to service name
        input.service = serviceName;
        input.url = passwordUrl.trim() || undefined;
        // Encrypt password if provided
        if (credPassword) {
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
            username: credUsername || undefined,
            password: encryptedPassword,
            notes: passwordNotes.trim() || undefined,
          };
        } else if (credUsername || passwordNotes) {
          // Store username and notes even without password
          input.credentials = {
            username: credUsername || undefined,
            notes: passwordNotes.trim() || undefined,
          };
        }
      }

      await createItem(input);
      closeAddModal();
    } catch (error) {
      console.error('Failed to create item:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isAddModalOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-dark-950/80 backdrop-blur-sm"
        onClick={closeAddModal}
      />

      {/* Modal */}
      <div className="relative w-full max-w-lg bg-dark-900 border border-dark-700 rounded-2xl shadow-2xl animate-scale-in overflow-hidden max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-dark-800">
          <h2 className="text-xl font-semibold text-dark-100">
            {step === 'type' ? 'Add New Item' : `New ${itemTypes.find(t => t.id === selectedType)?.label}`}
          </h2>
          <button
            onClick={closeAddModal}
            className="p-2 rounded-lg text-dark-400 hover:text-dark-200 hover:bg-dark-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto flex-1">
          {step === 'type' ? (
            <div className="space-y-3">
              <p className="text-dark-400 text-sm mb-4">What would you like to add?</p>
              {itemTypes.map((type) => {
                const Icon = type.icon;
                return (
                  <button
                    key={type.id}
                    onClick={() => handleSelectType(type.id)}
                    className="w-full flex items-center gap-4 p-4 rounded-xl border border-dark-700 
                             bg-dark-800/50 hover:bg-dark-800 hover:border-dark-600
                             transition-all duration-200 text-left group"
                  >
                    <div className="w-12 h-12 rounded-lg bg-accent-primary/10 flex items-center justify-center
                                  group-hover:bg-accent-primary/20 transition-colors">
                      <Icon className="w-6 h-6 text-accent-primary" />
                    </div>
                    <div>
                      <h3 className="font-medium text-dark-100">{type.label}</h3>
                      <p className="text-sm text-dark-400">{type.description}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Back button */}
              <button
                type="button"
                onClick={() => setStep('type')}
                className="text-sm text-dark-400 hover:text-dark-200 mb-2"
              >
                ← Change type
              </button>

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
              {selectedType === 'bookmark' && (
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
                      onChange={(e) => setPath(e.target.value)}
                      placeholder="/admin or /dashboard/page"
                      className="input-base"
                    />
                    <p className="text-xs text-dark-500 mt-1">
                      The path after the domain (e.g., /admin, /dashboard). Leave empty for root.
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
                  <div className="p-4 bg-dark-800/50 rounded-lg space-y-3 border border-accent-warning/20">
                    <div className="flex items-center gap-2">
                      <Key className="w-4 h-4 text-accent-warning" />
                      <h4 className="text-sm font-medium text-dark-300">Credentials (Optional)</h4>
                    </div>
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
                      <div className="relative">
                        <input
                          type={showPassword ? 'text' : 'password'}
                          value={credPassword}
                          onChange={(e) => setCredPassword(e.target.value)}
                          placeholder="••••••••"
                          className="input-base text-sm pr-10"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-dark-400 hover:text-dark-200"
                        >
                          {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                      <p className="text-xs text-dark-500 mt-1">Encrypted with your master password</p>
                    </div>
                  </div>
                </>
              )}

              {selectedType === 'ssh' && (
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
                  <div className="p-4 bg-dark-800/50 rounded-lg space-y-3 border border-accent-warning/20">
                    <div className="flex items-center gap-2">
                      <Key className="w-4 h-4 text-accent-warning" />
                      <h4 className="text-sm font-medium text-dark-300">SSH Password (Optional)</h4>
                    </div>
                    <div>
                      <label className="input-label text-xs">Password</label>
                      <div className="relative">
                        <input
                          type={showPassword ? 'text' : 'password'}
                          value={credPassword}
                          onChange={(e) => setCredPassword(e.target.value)}
                          placeholder="Leave empty to use SSH key"
                          className="input-base text-sm pr-10"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-dark-400 hover:text-dark-200"
                        >
                          {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                      <p className="text-xs text-dark-500 mt-1">Encrypted with your master password</p>
                    </div>
                  </div>
                </>
              )}

              {selectedType === 'app' && (
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

              {selectedType === 'password' && (
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
                    <p className="text-xs text-dark-500 mt-1">
                      The name of the service or website
                    </p>
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

                  <div>
                    <label className="input-label">Password</label>
                    <div className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={credPassword}
                        onChange={(e) => setCredPassword(e.target.value)}
                        placeholder="••••••••"
                        className="input-base pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-dark-400 hover:text-dark-200"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    <p className="text-xs text-dark-500 mt-1">Encrypted with your master password</p>
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
                  onClick={closeAddModal}
                  className="btn-secondary"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || !name.trim()}
                  className="btn-primary"
                >
                  {isSubmitting ? 'Creating...' : 'Create Item'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

