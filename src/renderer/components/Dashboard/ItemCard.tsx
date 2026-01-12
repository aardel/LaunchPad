import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  Globe,
  Terminal,
  AppWindow,
  MoreVertical,
  Edit2,
  Trash2,
  ExternalLink,
  Copy,
  Key,
  Copy as Duplicate,
  CheckCircle,
  AlertCircle,
  AlertTriangle,
  Circle,
  Activity,
  Check,
} from 'lucide-react';
import { useStore } from '../../store/useStore';
import type { AnyItem, BookmarkItem, SSHItem, AppItem, PasswordItem } from '@shared/types';

const typeIcons = {
  bookmark: Globe,
  ssh: Terminal,
  app: AppWindow,
  password: Key,
};

const typeColors = {
  bookmark: 'text-accent-info',
  ssh: 'text-accent-success',
  app: 'text-accent-warning',
  password: 'text-accent-primary',
};

export function ItemCard({ item, compact = false }: { item: AnyItem; compact?: boolean }) {
  const {
    launchItem,
    openEditModal,
    deleteItem,
    activeProfile,
    favicons,
    createItem,
    healthCheckResults,
    checkItemHealth,
    isSelectionMode,
    selectedItemIds,
    toggleItemSelection,
  } = useStore();

  const isSelected = selectedItemIds.has(item.id);

  const healthResult = healthCheckResults[item.id];

  const getHealthIcon = () => {
    if (!healthResult || item.type !== 'bookmark') return null;

    switch (healthResult.status) {
      case 'healthy':
        return <span title={`Healthy (${healthResult.responseTime}ms)`}><CheckCircle className="w-3.5 h-3.5 text-accent-success" /></span>;
      case 'warning':
        return <span title={`Warning: HTTP ${healthResult.statusCode}`}><AlertTriangle className="w-3.5 h-3.5 text-accent-warning" /></span>;
      case 'error':
        return <span title={healthResult.error || 'Error'}><AlertCircle className="w-3.5 h-3.5 text-accent-danger" /></span>;
      default:
        return <span title="Not checked"><Circle className="w-3.5 h-3.5 text-dark-500" /></span>;
    }
  };
  const [menuState, setMenuState] = useState<{ x: number; y: number } | null>(null);
  const [mousePos, setMousePos] = useState({ x: 50, y: 50 });
  const [faviconError, setFaviconError] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  const TypeIcon = typeIcons[item.type];

  // Get favicon URL for this item
  const getFaviconUrl = (): string | null => {
    if (item.type !== 'bookmark') return null;
    const bookmark = item as BookmarkItem;
    const host = bookmark.networkAddresses?.local || bookmark.networkAddresses?.tailscale;
    if (!host) return null;
    const protocol = bookmark.protocol || 'https';
    const port = bookmark.port ? `:${bookmark.port}` : '';
    const url = `${protocol}://${host}${port}`;
    return favicons[url] || null;
  };

  const faviconUrl = getFaviconUrl();

  // Reset favicon error when item changes
  useEffect(() => {
    setFaviconError(false);
  }, [item.id]);

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    setMousePos({ x, y });
  };

  const getSubtitle = () => {
    switch (item.type) {
      case 'bookmark': {
        const bookmark = item as BookmarkItem;
        const address = bookmark.networkAddresses[activeProfile] || bookmark.networkAddresses.local;
        const port = bookmark.port ? `:${bookmark.port}` : '';
        return address ? `${address}${port}` : 'No address configured';
      }
      case 'ssh': {
        const ssh = item as SSHItem;
        const address = ssh.networkAddresses[activeProfile] || ssh.networkAddresses.local;
        return `${ssh.username}@${address || 'no-host'}`;
      }
      case 'app': {
        const app = item as AppItem;
        const name = app.appPath.split('/').pop() || app.appPath;
        return name;
      }
      case 'password': {
        const password = item as PasswordItem;
        if (password.username) {
          return password.username;
        }
        if (password.url) {
          return password.url;
        }
        return password.service;
      }
      default:
        return '';
    }
  };

  const handleCopyAddress = () => {
    let text = '';
    if (item.type === 'bookmark') {
      const bookmark = item as BookmarkItem;
      const address = bookmark.networkAddresses[activeProfile] || bookmark.networkAddresses.local;
      const port = bookmark.port ? `:${bookmark.port}` : '';
      const path = bookmark.path || '';
      text = `${bookmark.protocol}://${address}${port}${path}`;
    } else if (item.type === 'ssh') {
      const ssh = item as SSHItem;
      const address = ssh.networkAddresses[activeProfile] || ssh.networkAddresses.local;
      text = `ssh ${ssh.username}@${address} -p ${ssh.port || 22}`;
    }
    navigator.clipboard.writeText(text);
    setMenuState(null);
  };

  const handleDuplicate = async () => {
    // Create a copy of the item with a new name
    const newItem: any = {
      type: item.type,
      name: `${item.name} (Copy)`,
      description: item.description,
      icon: item.icon,
      color: item.color,
      groupId: item.groupId,
      tags: [...(item.tags || [])],
    };

    if (item.type === 'bookmark') {
      const bookmark = item as BookmarkItem;
      newItem.protocol = bookmark.protocol;
      newItem.port = bookmark.port;
      newItem.path = bookmark.path;
      newItem.networkAddresses = { ...bookmark.networkAddresses };
      newItem.credentials = bookmark.credentials ? { ...bookmark.credentials } : undefined;
    } else if (item.type === 'ssh') {
      const ssh = item as SSHItem;
      newItem.username = ssh.username;
      newItem.port = ssh.port;
      newItem.networkAddresses = { ...ssh.networkAddresses };
      newItem.sshKey = ssh.sshKey;
      newItem.credentials = ssh.credentials ? { ...ssh.credentials } : undefined;
    } else if (item.type === 'app') {
      const app = item as AppItem;
      newItem.appPath = app.appPath;
      newItem.arguments = app.arguments ? [...app.arguments] : undefined;
    } else if (item.type === 'password') {
      const password = item as PasswordItem;
      newItem.service = password.service;
      newItem.username = password.username;
      newItem.url = password.url;
      newItem.credentials = password.credentials ? { ...password.credentials } : undefined;
    }

    await createItem(newItem);
    setMenuState(null);
  };

  const openMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const menuWidth = 176; // matches w-44
    const menuHeight = 300; // approximate max height
    const margin = 16;

    let x = e.clientX;
    let y = e.clientY;

    // Check horizontal boundaries
    if (x + menuWidth + margin > window.innerWidth) {
      x = window.innerWidth - menuWidth - margin;
    }

    // Check vertical boundaries
    if (y + menuHeight + margin > window.innerHeight) {
      y = window.innerHeight - menuHeight - margin;
    }

    setMenuState({ x, y });
  };

  // Render menu using Portal to escape overflow:hidden
  const renderMenu = () => {
    if (!menuState) return null;

    return createPortal(
      <>
        <div
          className="fixed inset-0 z-[100]"
          onClick={() => setMenuState(null)}
        />
        <div
          className="fixed z-[101] w-44 py-1 bg-dark-800 border border-dark-700 rounded-lg shadow-xl animate-scale-in"
          style={{ left: menuState.x, top: menuState.y }}
        >
          <button
            onClick={() => {
              launchItem(item);
              setMenuState(null);
            }}
            className="w-full flex items-center gap-3 px-4 py-2 text-sm text-dark-300 
                     hover:bg-dark-700 hover:text-dark-100 transition-colors"
          >
            <ExternalLink className="w-4 h-4" />
            Open
          </button>
          {(item.type === 'bookmark' || item.type === 'ssh') && (
            <button
              onClick={() => handleCopyAddress()}
              className="w-full flex items-center gap-3 px-4 py-2 text-sm text-dark-300 
                       hover:bg-dark-700 hover:text-dark-100 transition-colors"
            >
              <Copy className="w-4 h-4" />
              Copy Address
            </button>
          )}
          <button
            onClick={() => {
              openEditModal(item);
              setMenuState(null);
            }}
            className="w-full flex items-center gap-3 px-4 py-2 text-sm text-dark-300 
                     hover:bg-dark-700 hover:text-dark-100 transition-colors"
          >
            <Edit2 className="w-4 h-4" />
            Edit
          </button>
          <button
            onClick={handleDuplicate}
            className="w-full flex items-center gap-3 px-4 py-2 text-sm text-dark-300 
                     hover:bg-dark-700 hover:text-dark-100 transition-colors"
          >
            <Duplicate className="w-4 h-4" />
            Duplicate
          </button>
          {item.type === 'bookmark' && (
            <button
              onClick={() => {
                checkItemHealth(item.id);
                setMenuState(null);
              }}
              className="w-full flex items-center gap-3 px-4 py-2 text-sm text-dark-300 
                       hover:bg-dark-700 hover:text-dark-100 transition-colors"
            >
              <Activity className="w-4 h-4" />
              Check Health
            </button>
          )}
          <div className="h-px bg-dark-700 my-1" />
          <button
            onClick={() => {
              if (confirm(`Delete "${item.name}"?`)) {
                deleteItem(item.id);
              }
              setMenuState(null);
            }}
            className="w-full flex items-center gap-3 px-4 py-2 text-sm text-accent-danger 
                     hover:bg-accent-danger/10 transition-colors"
          >
            <Trash2 className="w-4 h-4" />
            Delete
          </button>
        </div>
      </>,
      document.body
    );
  };

  return (
    <>
      <div
        ref={cardRef}
        onMouseMove={handleMouseMove}
        onClick={() => {
          if (isSelectionMode) {
            toggleItemSelection(item.id);
          } else {
            launchItem(item);
          }
        }}
        className={`card-base ${compact ? 'p-3' : 'p-4'} cursor-pointer group relative ${isSelectionMode && isSelected ? 'ring-2 ring-accent-primary' : ''
          }`}
        style={
          {
            '--mouse-x': `${mousePos.x}%`,
            '--mouse-y': `${mousePos.y}%`,
          } as React.CSSProperties
        }
      >
        {/* Glow effect */}
        <div className="card-glow pointer-events-none" />

        {/* Menu Button - Positioned absolute */}
        <div
          className={`absolute z-50 ${compact ? 'top-2 right-2' : 'top-3 right-3'}`}
          onClick={openMenu}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <div className={`${compact ? 'p-1' : 'p-1.5'} rounded-lg text-dark-400 hover:text-dark-200 hover:bg-dark-700 transition-colors cursor-pointer`}>
            <MoreVertical className={compact ? 'w-3.5 h-3.5' : 'w-4 h-4'} />
          </div>
        </div>

        {/* Selection Checkbox */}
        {isSelectionMode && (
          <div className={`absolute z-20 ${compact ? 'top-2 left-2' : 'top-3 left-3'}`}>
            <button
              onClick={(e) => {
                e.stopPropagation();
                toggleItemSelection(item.id);
              }}
              className={`${compact ? 'w-5 h-5' : 'w-6 h-6'} rounded border-2 flex items-center justify-center transition-all ${isSelected
                ? 'bg-accent-primary border-accent-primary text-white'
                : 'bg-dark-800 border-dark-600 hover:border-dark-500'
                }`}
            >
              {isSelected && <Check className={compact ? 'w-3 h-3' : 'w-4 h-4'} />}
            </button>
          </div>
        )}

        {/* Content Area */}
        <div className="relative z-10">
          {/* Header */}
          <div className={`flex items-start justify-between ${compact ? 'mb-2' : 'mb-3'}`}>
            {/* Icon */}
            <div
              className={`${compact ? 'w-8 h-8 text-lg' : 'w-12 h-12 text-2xl'} rounded-xl flex items-center justify-center overflow-hidden`}
              style={{
                backgroundColor: item.color ? `${item.color}20` : 'rgba(99, 102, 241, 0.1)',
              }}
            >
              {item.icon ? (
                item.icon
              ) : faviconUrl && !faviconError ? (
                <img
                  src={faviconUrl}
                  alt=""
                  className={compact ? 'w-5 h-5' : 'w-7 h-7'}
                  onError={() => setFaviconError(true)}
                />
              ) : (
                <TypeIcon className={`${compact ? 'w-4 h-4' : 'w-6 h-6'} ${typeColors[item.type]}`} />
              )}
            </div>
            {/* Spacer for menu button */}
            <div className={compact ? 'w-6 h-6' : 'w-8 h-8'} />
          </div>

          {/* Title */}
          <h3 className={`${compact ? 'text-sm' : 'font-semibold'} text-dark-100 ${compact ? 'mb-0.5' : 'mb-1'} truncate`}>{item.name}</h3>

          {/* Subtitle */}
          {!compact && (
            <p className="text-sm text-dark-400 truncate font-mono">{getSubtitle()}</p>
          )}

          {/* Footer */}
          <div className={`flex items-center justify-between ${compact ? 'mt-2 pt-2' : 'mt-3 pt-3'} border-t border-dark-700/50`}>
            {/* Type badge */}
            {/* Protocol/Type badge */}
            <span
              className={`${compact ? 'text-[10px] px-1.5 py-0.5' : 'text-xs px-2 py-0.5'} font-medium uppercase text-accent-success bg-accent-success/10 rounded`}
            >
              {item.type === 'bookmark'
                ? (item as BookmarkItem).protocol || 'WEBLINK'
                : item.type === 'ssh'
                  ? 'SSH'
                  : item.type === 'app'
                    ? 'APP'
                    : 'SECURE'}
            </span>

            {/* Health status indicator */}
            {getHealthIcon()}

            {/* Has credentials indicator */}
            {((item.type === 'bookmark' || item.type === 'ssh') &&
              (item as BookmarkItem | SSHItem).credentials) && (
                <span title="Has credentials"><Key className={`${compact ? 'w-3 h-3' : 'w-3.5 h-3.5'} text-accent-warning`} /></span>
              )}

            {/* Access count - hide in compact mode */}
            {!compact && item.accessCount > 0 && (
              <span className="text-xs text-dark-500">
                {item.accessCount} {item.accessCount === 1 ? 'visit' : 'visits'}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Menu rendered via Portal - outside the overflow:hidden card */}
      {renderMenu()}
    </>
  );
}
