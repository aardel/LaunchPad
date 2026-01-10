import { useState } from 'react';
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
} from 'lucide-react';
import { useStore } from '../../store/useStore';
import type { AnyItem, BookmarkItem, SSHItem, AppItem, PasswordItem, Group } from '@shared/types';

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

interface ListItemProps {
  item: AnyItem;
  group: Group;
  isSelected: boolean;
  onSelect: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onCopyAddress?: () => void;
}

export function ListItem({
  item,
  group,
  isSelected,
  onSelect,
  onEdit,
  onDelete,
  onDuplicate,
  onCopyAddress,
}: ListItemProps) {
  const { launchItem, activeProfile, favicons, isSelectionMode, healthCheckResults } = useStore();
  const [menuState, setMenuState] = useState<{ x: number; y: number } | null>(null);
  const [faviconError, setFaviconError] = useState(false);

  const TypeIcon = typeIcons[item.type];
  const healthResult = healthCheckResults[item.id];

  const getFaviconUrl = (): string | null => {
    if (item.type !== 'bookmark') return null;
    const bookmark = item as BookmarkItem;
    const host = bookmark.networkAddresses?.[activeProfile] || bookmark.networkAddresses?.local;
    if (!host) return null;
    const protocol = bookmark.protocol || 'https';
    const port = bookmark.port ? `:${bookmark.port}` : '';
    const url = `${protocol}://${host}${port}`;
    return favicons[url] || null;
  };

  const faviconUrl = getFaviconUrl();

  const getSubtitle = () => {
    switch (item.type) {
      case 'bookmark': {
        const bookmark = item as BookmarkItem;
        const address = bookmark.networkAddresses?.[activeProfile] || bookmark.networkAddresses?.local;
        const port = bookmark.port ? `:${bookmark.port}` : '';
        return address ? `${address}${port}` : 'No address configured';
      }
      case 'ssh': {
        const ssh = item as SSHItem;
        const address = ssh.networkAddresses?.[activeProfile] || ssh.networkAddresses?.local;
        return `${ssh.username}@${address || 'no-host'}`;
      }
      case 'app': {
        const app = item as AppItem;
        const name = app.appPath.split('/').pop() || app.appPath;
        return name;
      }
      case 'password': {
        const password = item as PasswordItem;
        if (password.username) return password.username;
        if (password.url) return password.url;
        return password.service;
      }
      default:
        return '';
    }
  };

  const getHealthIcon = () => {
    if (!healthResult || item.type !== 'bookmark') return null;

    switch (healthResult.status) {
      case 'healthy':
        return <span title={`Healthy (${healthResult.responseTime}ms)`}><CheckCircle className="w-4 h-4 text-accent-success" /></span>;
      case 'warning':
        return <span title={`Warning: HTTP ${healthResult.statusCode}`}><AlertTriangle className="w-4 h-4 text-accent-warning" /></span>;
      case 'error':
        return <span title={healthResult.error || 'Error'}><AlertCircle className="w-4 h-4 text-accent-danger" /></span>;
      default:
        return null;
    }
  };

  const openMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const menuWidth = 176; // matches w-44
    const menuHeight = 250; // approximate max height
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
                     hover:bg-dark-700 hover:text-dark-100 transition-colors text-left"
          >
            <ExternalLink className="w-4 h-4 text-accent-success" />
            Open
          </button>
          {onCopyAddress && (
            <button
              onClick={() => {
                onCopyAddress();
                setMenuState(null);
              }}
              className="w-full flex items-center gap-3 px-4 py-2 text-sm text-dark-300 
                       hover:bg-dark-700 hover:text-dark-100 transition-colors text-left"
            >
              <Copy className="w-4 h-4" />
              Copy Address
            </button>
          )}
          <button
            onClick={() => {
              onDuplicate();
              setMenuState(null);
            }}
            className="w-full flex items-center gap-3 px-4 py-2 text-sm text-dark-300 
                     hover:bg-dark-700 hover:text-dark-100 transition-colors text-left"
          >
            <Duplicate className="w-4 h-4" />
            Duplicate
          </button>
          <button
            onClick={() => {
              onEdit();
              setMenuState(null);
            }}
            className="w-full flex items-center gap-3 px-4 py-2 text-sm text-dark-300 
                     hover:bg-dark-700 hover:text-dark-100 transition-colors text-left"
          >
            <Edit2 className="w-4 h-4" />
            Edit
          </button>
          <div className="h-px bg-dark-700 my-1" />
          <button
            onClick={() => {
              if (confirm(`Delete "${item.name}"?`)) {
                onDelete();
              }
              setMenuState(null);
            }}
            className="w-full flex items-center gap-3 px-4 py-2 text-sm text-accent-danger 
                     hover:bg-accent-danger/10 transition-colors text-left"
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
        className={`flex items-center gap-4 px-4 py-3 rounded-lg border transition-all cursor-pointer group ${isSelected
          ? 'bg-accent-primary/10 border-accent-primary/50'
          : 'bg-dark-800/50 border-dark-700/50 hover:bg-dark-800 hover:border-dark-600'
          }`}
        onClick={() => {
          if (isSelectionMode) {
            onSelect();
          } else {
            launchItem(item);
          }
        }}
      >
        {/* Selection Checkbox */}
        {isSelectionMode && (
          <div className="flex items-center">
            <input
              type="checkbox"
              checked={isSelected}
              readOnly
              className="w-4 h-4 rounded border-2 border-dark-600 bg-dark-800 
                       checked:bg-accent-primary checked:border-accent-primary
                       focus:ring-2 focus:ring-accent-primary/50 cursor-pointer pointer-events-none"
            />
          </div>
        )}

        {/* Icon */}
        <div
          className="w-10 h-10 rounded-lg flex items-center justify-center text-lg flex-shrink-0"
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
              className="w-6 h-6 object-contain"
              onError={() => setFaviconError(true)}
            />
          ) : (
            <TypeIcon className={`w-5 h-5 ${typeColors[item.type]}`} />
          )}
        </div>

        {/* Title & Subtitle */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-medium text-dark-100 truncate">{item.name}</h3>
            {getHealthIcon()}
            {((item.type === 'bookmark' || item.type === 'ssh') &&
              (item as BookmarkItem | SSHItem).credentials) && (
                <span title="Has credentials"><Key className="w-3.5 h-3.5 text-accent-warning" /></span>
              )}
          </div>
          <p className="text-sm text-dark-400 truncate font-mono">{getSubtitle()}</p>
        </div>

        {/* Group Name */}
        <div className="text-sm text-dark-500 min-w-[100px] text-right">
          {group.icon} {group.name}
        </div>

        {/* Type Badge */}
        <span
          className={`text-xs font-medium capitalize ${typeColors[item.type]} 
                     bg-current/10 px-2 py-1 rounded min-w-[70px] text-center`}
        >
          {item.type}
        </span>

        {/* Actions */}
        <div className="flex items-center gap-2">
          {item.accessCount > 0 && (
            <span className="text-xs text-dark-500 min-w-[60px] text-right">
              {item.accessCount} {item.accessCount === 1 ? 'visit' : 'visits'}
            </span>
          )}
          <button
            onClick={openMenu}
            className="p-1.5 rounded-lg text-dark-400 hover:text-dark-200 hover:bg-dark-700 transition-colors opacity-0 group-hover:opacity-100"
            title="More options"
          >
            <MoreVertical className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Menu */}
      {renderMenu()}
    </>
  );
}

