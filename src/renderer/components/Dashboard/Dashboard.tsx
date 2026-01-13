import { useMemo, useState, useEffect } from 'react';
import Fuse from 'fuse.js';
import { Plus, Play, LayoutGrid, Grid3x3, List, Sparkles, Loader2, Network } from 'lucide-react';
import { useStore } from '../../store/useStore';
import { SortableGroupSection } from './SortableGroupSection';
import { BatchOperationsBar } from './BatchOperationsBar';
import { EnhancedSearchBar } from './EnhancedSearchBar';
import type { AnyItem, BookmarkItem, SSHItem, AppItem, PasswordItem } from '@shared/types';

// Import NetworkExplorerModal
import { NetworkExplorerModal } from '../Modals/NetworkExplorerModal';

export function Dashboard() {
  const {
    items,
    groups,
    selectedGroupId,
    searchQuery,
    searchFilters,
    openAddModal,
    launchGroup,
    settings,
  } = useStore();

  const cardViewMode = settings?.cardViewMode || 'normal';
  const [isNetworkExplorerOpen, setIsNetworkExplorerOpen] = useState(false);

  // ... rest of state ...

  // Semantic search state
  const [semanticResults, setSemanticResults] = useState<Set<string>>(new Set());
  const [isSemanticSearching, setIsSemanticSearching] = useState(false);
  const [useSemanticSearch, setUseSemanticSearch] = useState(false);

  const toggleViewMode = async () => {
    // Cycle through: normal -> compact -> list -> normal
    const modes: ('normal' | 'compact' | 'list')[] = ['normal', 'compact', 'list'];
    const currentIndex = modes.indexOf(cardViewMode as any);
    const newMode = modes[(currentIndex + 1) % modes.length];
    await window.api.settings.update({ cardViewMode: newMode });
    const res = await window.api.settings.get();
    if (res.success && res.data) {
      useStore.setState({ settings: res.data });
    }
  };

  const getViewModeIcon = () => {
    switch (cardViewMode) {
      case 'compact':
        return <Grid3x3 className="w-4 h-4" />;
      case 'list':
        return <List className="w-4 h-4" />;
      default:
        return <LayoutGrid className="w-4 h-4" />;
    }
  };

  const getViewModeTitle = () => {
    switch (cardViewMode) {
      case 'compact':
        return 'Switch to list view';
      case 'list':
        return 'Switch to normal view';
      default:
        return 'Switch to compact view';
    }
  };

  // Helper function to extract all searchable text from an item
  const getSearchableText = (item: AnyItem): string => {
    const parts: string[] = [
      item.name,
      item.description || '',
      ...item.tags,
    ];

    // Add type-specific fields
    if (item.type === 'bookmark') {
      const bookmark = item as BookmarkItem;
      parts.push(bookmark.protocol || '');
      parts.push(bookmark.path || '');
      // Add all network addresses
      if (bookmark.networkAddresses) {
        parts.push(
          bookmark.networkAddresses.local || '',
          bookmark.networkAddresses.tailscale || '',
          bookmark.networkAddresses.vpn || '',
          bookmark.networkAddresses.custom || ''
        );
        // Also add full URLs for each address
        const addresses = [
          bookmark.networkAddresses.local,
          bookmark.networkAddresses.tailscale,
          bookmark.networkAddresses.vpn,
          bookmark.networkAddresses.custom
        ].filter(Boolean);

        addresses.forEach(address => {
          const port = bookmark.port ? `:${bookmark.port}` : '';
          const path = bookmark.path || '';
          parts.push(`${bookmark.protocol}://${address}${port}${path}`);
          parts.push(`${address}${port}${path}`);
          parts.push(address);
        });
      }
    } else if (item.type === 'ssh') {
      const ssh = item as SSHItem;
      parts.push(ssh.username || '');
      // Add all network addresses
      if (ssh.networkAddresses) {
        parts.push(
          ssh.networkAddresses.local || '',
          ssh.networkAddresses.tailscale || '',
          ssh.networkAddresses.vpn || '',
          ssh.networkAddresses.custom || ''
        );
      }
    } else if (item.type === 'password') {
      const password = item as PasswordItem;
      parts.push(password.service || '');
      parts.push(password.url || '');
      parts.push(password.username || '');
    } else if (item.type === 'app') {
      const app = item as AppItem;
      parts.push(app.appPath || '');
      // Also add just the filename
      if (app.appPath) {
        const filename = app.appPath.split('/').pop() || app.appPath.split('\\').pop() || '';
        parts.push(filename);
      }
    }

    return parts.filter(Boolean).join(' ').toLowerCase();
  };

  // Semantic search effect (debounced)
  useEffect(() => {
    // Only use semantic search for longer queries (4+ chars) to avoid false positives
    // Short queries are better handled by exact text matching
    if (!searchQuery || !settings?.aiEnabled || searchQuery.length < 4) {
      setSemanticResults(new Set());
      setUseSemanticSearch(false);
      setIsSemanticSearching(false);
      return;
    }

    // Debounce semantic search
    const timeoutId = setTimeout(async () => {
      setIsSemanticSearching(true);
      try {
        const itemsForSearch = items.map(item => ({
          id: item.id,
          name: item.name,
          description: item.description,
          url: item.type === 'bookmark'
            ? `${(item as any).protocol}://${(item as any).networkAddresses?.local || ''}${(item as any).port ? `:${(item as any).port}` : ''}${(item as any).path || ''}`
            : undefined,
        }));

        const res = await window.api.ai.semanticSearch(searchQuery, itemsForSearch);
        if (res.success && res.data) {
          const resultIds = new Set(res.data.map(r => r.id));
          setSemanticResults(resultIds);
          setUseSemanticSearch(true);
        } else {
          setUseSemanticSearch(false);
        }
      } catch (error) {
        console.error('Semantic search failed:', error);
        setUseSemanticSearch(false);
      } finally {
        setIsSemanticSearching(false);
      }
    }, 500); // 500ms debounce

    return () => clearTimeout(timeoutId);
  }, [searchQuery, items, settings?.aiEnabled]);

  // Filter and group items
  const { displayGroups, filteredItems } = useMemo(() => {
    let filtered = items;

    // Apply search filters first
    if (searchFilters.type) {
      filtered = filtered.filter(item => item.type === searchFilters.type);
    }
    if (searchFilters.groupId) {
      filtered = filtered.filter(item => item.groupId === searchFilters.groupId);
    }
    if (searchFilters.tags.length > 0) {
      filtered = filtered.filter(item =>
        searchFilters.tags.some(tag => item.tags.includes(tag))
      );
    }

    // Filter by search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase();

      // Always do text search for exact matches - search all fields including URLs
      const textMatches = filtered.filter((item) => {
        const searchableText = getSearchableText(item);
        return searchableText.includes(query);
      });

      // If semantic search is available, filter semantic results to only include
      // items that have at least a partial text match (to reduce false positives)
      if (useSemanticSearch && semanticResults.size > 0) {
        const textMatchIds = new Set(textMatches.map(item => item.id));

        const semanticMatches = filtered.filter(item => {
          // Skip items that are already in text matches
          if (textMatchIds.has(item.id)) return false;

          if (!semanticResults.has(item.id)) return false;
          // Only include semantic matches that also have some text relevance
          const searchableText = getSearchableText(item);
          // Check if any word in the query appears in the item (partial match)
          const queryWords = query.split(/\s+/).filter(w => w.length > 2);
          if (queryWords.length === 0) return true; // Single word, allow it
          // At least one word should match
          return queryWords.some(word => searchableText.includes(word));
        });

        // Combine: text matches first, then semantic matches
        // This ensures exact matches appear before semantic matches
        filtered = [...textMatches, ...semanticMatches];
      } else {
        // Use only text search if semantic search not available
        filtered = textMatches;
      }
    }

    // Filter by selected group
    if (selectedGroupId) {
      filtered = filtered.filter((item) => item.groupId === selectedGroupId);
    }

    // Group items by their group
    const groupedItems: Record<string, typeof items> = {};
    for (const item of filtered) {
      if (!groupedItems[item.groupId]) {
        groupedItems[item.groupId] = [];
      }
      groupedItems[item.groupId].push(item);
    }

    // Get groups that have items
    const displayGroups = groups.filter((group) => groupedItems[group.id]?.length > 0);

    return { displayGroups, filteredItems: groupedItems };
  }, [items, groups, selectedGroupId, searchQuery, searchFilters, semanticResults, useSemanticSearch]);

  const selectedGroup = selectedGroupId
    ? groups.find((g) => g.id === selectedGroupId)
    : null;

  return (
    <main className="flex-1 overflow-y-auto">
      {/* Background gradient */}
      <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
        <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-accent-primary/5 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-accent-secondary/5 rounded-full blur-3xl" />
      </div>

      <div className="max-w-[1600px] mx-auto">
        {/* Header - Sticky */}
        <div className="sticky top-0 z-10 bg-dark-900/95 backdrop-blur-sm border-b border-dark-800 px-14 pt-6 pb-4 mb-4 -mx-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-dark-100">
                {selectedGroup ? selectedGroup.name : 'All Items'}
              </h1>
              <p className="text-dark-400 mt-1 flex items-center gap-2">
                {searchQuery ? (
                  <>
                    <span>Search results for "{searchQuery}"</span>
                    {settings?.aiEnabled && searchQuery.length >= 4 && (
                      <span className="flex items-center gap-1 text-xs text-accent-primary">
                        {isSemanticSearching ? (
                          <>
                            <Loader2 className="w-3 h-3 animate-spin" />
                            AI searching...
                          </>
                        ) : useSemanticSearch ? (
                          <>
                            <Sparkles className="w-3 h-3" />
                            AI search
                          </>
                        ) : null}
                      </span>
                    )}
                  </>
                ) : selectedGroup ? (
                  `${filteredItems[selectedGroup.id]?.length || 0} items`
                ) : (
                  `${items.length} items across ${groups.length} groups`
                )}
              </p>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={toggleViewMode}
                className="btn-secondary"
                title={getViewModeTitle()}
              >
                {getViewModeIcon()}
              </button>
              {selectedGroupId && (
                <button
                  onClick={() => launchGroup(selectedGroupId)}
                  className="btn-secondary"
                >
                  <Play className="w-4 h-4" />
                  Open All
                </button>
              )}
              <button onClick={openAddModal} className="btn-primary">
                <Plus className="w-4 h-4" />
                Add Item
              </button>
              <button
                onClick={() => setIsNetworkExplorerOpen(true)}
                className="btn-secondary"
                title="Network Explorer"
              >
                <Network className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Enhanced Search Bar */}
          <div className="mt-4">
            <EnhancedSearchBar />
          </div>
        </div>

        {/* Content */}
        <div className="px-6 pb-6">
          {displayGroups.length === 0 ? (
            <EmptyState
              hasGroups={groups.length > 0}
              onAddItem={openAddModal}
            />
          ) : (
            <div className="space-y-10">
              {displayGroups.map((group) => (
                <SortableGroupSection
                  key={group.id}
                  group={group}
                  items={filteredItems[group.id] || []}
                  onLaunchAll={() => launchGroup(group.id)}
                  cardViewMode={cardViewMode}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Batch Operations Bar */}
      <BatchOperationsBar />

      <NetworkExplorerModal
        isOpen={isNetworkExplorerOpen}
        onClose={() => setIsNetworkExplorerOpen(false)}
      />
    </main>
  );
}

function EmptyState({
  hasGroups,
  onAddItem,
}: {
  hasGroups: boolean;
  onAddItem: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-20">
      <div className="w-24 h-24 mb-6 rounded-full bg-dark-800/50 flex items-center justify-center">
        <span className="text-4xl">🚀</span>
      </div>
      <h2 className="text-xl font-semibold text-dark-200 mb-2">
        {hasGroups ? 'No items yet' : 'Welcome to LaunchIt'}
      </h2>
      <p className="text-dark-400 text-center max-w-md mb-6">
        {hasGroups
          ? 'Add bookmarks, SSH connections, and app shortcuts to get started.'
          : 'Your personal dashboard for bookmarks, servers, and applications. Create a group to get started.'}
      </p>
      <button onClick={onAddItem} className="btn-primary">
        <Plus className="w-4 h-4" />
        Add Your First Item
      </button>
    </div>
  );
}

