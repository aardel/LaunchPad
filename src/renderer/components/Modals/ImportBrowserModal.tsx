import { useState, useEffect, useMemo } from 'react';
import { X, Download, Loader2, Check, AlertCircle, Plus, FolderPlus, CheckSquare, Square, MinusSquare } from 'lucide-react';
import { useStore } from '../../store/useStore';

interface BrowserWithBookmarks {
  id: string;
  name: string;
  icon: string;
  hasBookmarks: boolean;
  bookmarkCount?: number;
}

interface BrowserBookmark {
  name: string;
  url: string;
  folder?: string;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export function ImportBrowserModal({ isOpen, onClose }: Props) {
  const { groups, loadData, createGroup } = useStore();
  const [browsers, setBrowsers] = useState<BrowserWithBookmarks[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedBrowser, setSelectedBrowser] = useState<string | null>(null);
  const [selectedGroup, setSelectedGroup] = useState<string>('');
  const [isCreatingGroup, setIsCreatingGroup] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupIcon, setNewGroupIcon] = useState('📁');
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);
  const [bookmarks, setBookmarks] = useState<BrowserBookmark[]>([]);
  const [selectedBookmarks, setSelectedBookmarks] = useState<Set<number>>(new Set());
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [searchFilter, setSearchFilter] = useState('');
  const [folderFilter, setFolderFilter] = useState<string>('all');

  // Get unique folders from bookmarks
  const folders = useMemo(() => {
    const folderSet = new Set<string>();
    bookmarks.forEach(b => {
      if (b.folder) folderSet.add(b.folder.split('/')[0]); // Top-level folder only
    });
    return Array.from(folderSet).sort();
  }, [bookmarks]);

  // Filter bookmarks based on search and folder
  const filteredBookmarks = useMemo(() => {
    return bookmarks.filter((b) => {
      const matchesSearch = !searchFilter ||
        b.name.toLowerCase().includes(searchFilter.toLowerCase()) ||
        b.url.toLowerCase().includes(searchFilter.toLowerCase());
      const matchesFolder = folderFilter === 'all' ||
        (b.folder && b.folder.startsWith(folderFilter));
      return matchesSearch && matchesFolder;
    });
  }, [bookmarks, searchFilter, folderFilter]);

  // Get indices of filtered bookmarks in original array
  const filteredIndices = useMemo(() => {
    return bookmarks.map((b, idx) => ({ bookmark: b, idx }))
      .filter(({ bookmark }) => {
        const matchesSearch = !searchFilter ||
          bookmark.name.toLowerCase().includes(searchFilter.toLowerCase()) ||
          bookmark.url.toLowerCase().includes(searchFilter.toLowerCase());
        const matchesFolder = folderFilter === 'all' ||
          (bookmark.folder && bookmark.folder.startsWith(folderFilter));
        return matchesSearch && matchesFolder;
      })
      .map(({ idx }) => idx);
  }, [bookmarks, searchFilter, folderFilter]);

  useEffect(() => {
    if (isOpen) {
      loadBrowsers();
      setSelectedBrowser(null);
      setBookmarks([]);
      setSelectedBookmarks(new Set());
      setResult(null);
      setIsCreatingGroup(false);
      setNewGroupName('');
      setSearchFilter('');
      setFolderFilter('all');
      if (groups.length > 0) {
        setSelectedGroup(groups[0].id);
      }
    }
  }, [isOpen, groups]);

  useEffect(() => {
    if (selectedBrowser) {
      loadBookmarks(selectedBrowser);
    } else {
      setBookmarks([]);
      setSelectedBookmarks(new Set());
    }
  }, [selectedBrowser]);

  const loadBrowsers = async () => {
    setLoading(true);
    try {
      const res = await window.api.browserBookmarks.getAvailable();
      if (res.success && res.data) {
        setBrowsers(res.data);
      }
    } catch (error) {
      console.error('Failed to load browsers:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadBookmarks = async (browserId: string) => {
    setLoadingPreview(true);
    setSelectedBookmarks(new Set());
    try {
      const res = await window.api.browserBookmarks.preview(browserId);
      if (res.success && res.data) {
        setBookmarks(res.data);
        // Select all by default
        setSelectedBookmarks(new Set(res.data.map((_: unknown, idx: number) => idx)));
      }
    } catch (error) {
      console.error('Failed to load bookmarks:', error);
    } finally {
      setLoadingPreview(false);
    }
  };

  const toggleBookmark = (idx: number) => {
    const newSelected = new Set(selectedBookmarks);
    if (newSelected.has(idx)) {
      newSelected.delete(idx);
    } else {
      newSelected.add(idx);
    }
    setSelectedBookmarks(newSelected);
  };

  const toggleAllFiltered = () => {
    const newSelected = new Set(selectedBookmarks);
    const allSelected = filteredIndices.every(idx => selectedBookmarks.has(idx));

    if (allSelected) {
      // Deselect all filtered
      filteredIndices.forEach(idx => newSelected.delete(idx));
    } else {
      // Select all filtered
      filteredIndices.forEach(idx => newSelected.add(idx));
    }
    setSelectedBookmarks(newSelected);
  };

  const selectAll = () => {
    setSelectedBookmarks(new Set(bookmarks.map((_, idx) => idx)));
  };

  const selectNone = () => {
    setSelectedBookmarks(new Set());
  };

  const handleCreateGroup = async () => {
    if (!newGroupName.trim()) return;

    await createGroup({
      name: newGroupName.trim(),
      icon: newGroupIcon,
    });

    // Get the newly created group
    await loadData();
  };

  useEffect(() => {
    // After creating a group, select it
    if (newGroupName && groups.length > 0) {
      const newGroup = groups.find(g => g.name === newGroupName.trim());
      if (newGroup) {
        setSelectedGroup(newGroup.id);
        setIsCreatingGroup(false);
        setNewGroupName('');
      }
    }
  }, [groups, newGroupName]);

  const handleImport = async () => {
    if (!selectedBrowser || (!selectedGroup && !isCreatingGroup)) return;
    if (selectedBookmarks.size === 0) {
      setResult({ success: false, message: 'Please select at least one bookmark to import' });
      return;
    }

    // If creating new group, do that first
    let targetGroupId = selectedGroup;
    if (isCreatingGroup && newGroupName.trim()) {
      await createGroup({
        name: newGroupName.trim(),
        icon: newGroupIcon,
      });
      await loadData();
      const newGroup = groups.find(g => g.name === newGroupName.trim());
      if (newGroup) {
        targetGroupId = newGroup.id;
      }
    }

    if (!targetGroupId) {
      setResult({ success: false, message: 'Please select or create a group' });
      return;
    }

    setImporting(true);
    setResult(null);

    try {
      // Get selected bookmarks
      const selectedItems = bookmarks.filter((_, idx) => selectedBookmarks.has(idx));

      // Import each selected bookmark
      let imported = 0;
      for (const bookmark of selectedItems) {
        try {
          const urlObj = new URL(bookmark.url);
          if (!urlObj.protocol.startsWith('http')) continue;

          await window.api.items.create({
            type: 'bookmark',
            name: bookmark.name || 'Imported Bookmark',
            description: bookmark.folder ? `Imported from: ${bookmark.folder}` : undefined,
            groupId: targetGroupId,
            protocol: urlObj.protocol.replace(':', '') as any,
            port: urlObj.port ? parseInt(urlObj.port, 10) : undefined,
            path: urlObj.pathname !== '/' ? urlObj.pathname + urlObj.search : undefined,
            networkAddresses: {
              local: urlObj.hostname,
            },
          });
          imported++;
        } catch {
          // Invalid URL, skip
        }
      }

      setResult({
        success: true,
        message: `Successfully imported ${imported} of ${selectedItems.length} bookmarks!`,
      });
      await loadData();
    } catch (error) {
      setResult({
        success: false,
        message: String(error),
      });
    } finally {
      setImporting(false);
    }
  };

  const handleClose = () => {
    setSelectedBrowser(null);
    setResult(null);
    setBookmarks([]);
    setSelectedBookmarks(new Set());
    onClose();
  };

  if (!isOpen) return null;

  const allFilteredSelected = filteredIndices.length > 0 &&
    filteredIndices.every(idx => selectedBookmarks.has(idx));
  const someFilteredSelected = filteredIndices.some(idx => selectedBookmarks.has(idx));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-dark-950/80 backdrop-blur-sm"
        onClick={handleClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-3xl bg-dark-900 border border-dark-700 rounded-2xl shadow-2xl animate-scale-in overflow-hidden max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-dark-800">
          <div>
            <h2 className="text-xl font-semibold text-dark-100">Import from Browser</h2>
            <p className="text-sm text-dark-400 mt-1">
              Select bookmarks to import from your installed browsers
            </p>
          </div>
          <button
            onClick={handleClose}
            className="p-2 rounded-lg text-dark-400 hover:text-dark-200 hover:bg-dark-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 text-accent-primary animate-spin" />
            </div>
          ) : browsers.length === 0 ? (
            <div className="text-center py-12">
              <AlertCircle className="w-12 h-12 text-dark-500 mx-auto mb-4" />
              <p className="text-dark-300">No browsers with bookmarks found</p>
              <p className="text-sm text-dark-500 mt-2">
                Make sure you have bookmarks saved in Chrome, Firefox, Safari, or other supported browsers.
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Browser Selection */}
              <div>
                <label className="input-label">1. Select Browser</label>
                <div className="grid grid-cols-3 gap-2">
                  {browsers.map((browser) => (
                    <button
                      key={browser.id}
                      onClick={() => setSelectedBrowser(browser.id)}
                      className={`flex items-center gap-2 p-3 rounded-xl border transition-all text-left
                               ${selectedBrowser === browser.id
                          ? 'border-accent-primary bg-accent-primary/10'
                          : 'border-dark-700 bg-dark-800/50 hover:border-dark-600'}`}
                    >
                      <span className="text-xl">{browser.icon}</span>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-dark-100 text-sm truncate">{browser.name}</p>
                        {browser.bookmarkCount && (
                          <p className="text-xs text-dark-400">
                            {browser.bookmarkCount} bookmarks
                          </p>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Bookmarks Selection */}
              {selectedBrowser && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="input-label mb-0">
                      2. Select Bookmarks ({selectedBookmarks.size} selected)
                      {loadingPreview && <Loader2 className="w-3 h-3 inline animate-spin ml-2" />}
                    </label>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={selectAll}
                        className="text-xs text-accent-primary hover:underline"
                      >
                        Select All
                      </button>
                      <span className="text-dark-600">|</span>
                      <button
                        onClick={selectNone}
                        className="text-xs text-accent-primary hover:underline"
                      >
                        Select None
                      </button>
                    </div>
                  </div>

                  {/* Filters */}
                  <div className="flex gap-2 mb-2">
                    <input
                      type="text"
                      placeholder="Search bookmarks..."
                      value={searchFilter}
                      onChange={(e) => setSearchFilter(e.target.value)}
                      className="input-base text-sm flex-1"
                    />
                    {folders.length > 0 && (
                      <select
                        value={folderFilter}
                        onChange={(e) => setFolderFilter(e.target.value)}
                        className="input-base text-sm w-40"
                      >
                        <option value="all">All Folders</option>
                        {folders.map(folder => (
                          <option key={folder} value={folder}>{folder}</option>
                        ))}
                      </select>
                    )}
                  </div>

                  {/* Select All Filtered Toggle */}
                  {filteredBookmarks.length > 0 && (
                    <button
                      onClick={toggleAllFiltered}
                      className="flex items-center gap-2 px-3 py-1.5 mb-2 text-sm text-dark-300 hover:text-dark-100 hover:bg-dark-800 rounded-lg transition-colors"
                    >
                      {allFilteredSelected ? (
                        <CheckSquare className="w-4 h-4 text-accent-primary" />
                      ) : someFilteredSelected ? (
                        <MinusSquare className="w-4 h-4 text-accent-primary" />
                      ) : (
                        <Square className="w-4 h-4" />
                      )}
                      {allFilteredSelected ? 'Deselect' : 'Select'} all {filteredBookmarks.length} filtered
                    </button>
                  )}

                  {/* Bookmarks List */}
                  <div className="max-h-64 overflow-y-auto bg-dark-800/50 rounded-lg border border-dark-700">
                    {filteredBookmarks.length === 0 && !loadingPreview ? (
                      <p className="text-dark-500 text-sm p-4 text-center">
                        {bookmarks.length === 0 ? 'No bookmarks found' : 'No bookmarks match your filter'}
                      </p>
                    ) : (
                      <div className="divide-y divide-dark-700">
                        {filteredBookmarks.map((bookmark, filteredIdx) => {
                          const originalIdx = filteredIndices[filteredIdx];
                          const isSelected = selectedBookmarks.has(originalIdx);
                          return (
                            <div
                              key={originalIdx}
                              onClick={() => toggleBookmark(originalIdx)}
                              className={`px-3 py-2 flex items-center gap-3 cursor-pointer hover:bg-dark-700/50 transition-colors
                                        ${isSelected ? 'bg-accent-primary/5' : ''}`}
                            >
                              {isSelected ? (
                                <CheckSquare className="w-4 h-4 text-accent-primary flex-shrink-0" />
                              ) : (
                                <Square className="w-4 h-4 text-dark-500 flex-shrink-0" />
                              )}
                              <div className="min-w-0 flex-1">
                                <p className="text-sm text-dark-200 truncate">{bookmark.name}</p>
                                <p className="text-xs text-dark-500 truncate">{bookmark.url}</p>
                              </div>
                              {bookmark.folder && (
                                <span className="text-xs text-dark-500 bg-dark-700 px-2 py-0.5 rounded flex-shrink-0">
                                  {bookmark.folder.split('/')[0]}
                                </span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Group Selection */}
              {selectedBrowser && bookmarks.length > 0 && (
                <div>
                  <label className="input-label">3. Import into Group</label>

                  {!isCreatingGroup ? (
                    <div className="space-y-2">
                      <select
                        value={selectedGroup}
                        onChange={(e) => setSelectedGroup(e.target.value)}
                        className="input-base"
                      >
                        {groups.map((group) => (
                          <option key={group.id} value={group.id}>
                            {group.icon} {group.name}
                          </option>
                        ))}
                      </select>
                      <button
                        onClick={() => setIsCreatingGroup(true)}
                        className="flex items-center gap-2 text-sm text-accent-primary hover:underline"
                      >
                        <FolderPlus className="w-4 h-4" />
                        Create new group
                      </button>
                    </div>
                  ) : (
                    <div className="p-4 bg-dark-800/50 rounded-lg border border-dark-700 space-y-3">
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={newGroupIcon}
                          onChange={(e) => setNewGroupIcon(e.target.value)}
                          className="input-base w-16 text-center text-xl"
                          placeholder="📁"
                        />
                        <input
                          type="text"
                          value={newGroupName}
                          onChange={(e) => setNewGroupName(e.target.value)}
                          className="input-base flex-1"
                          placeholder="Group name..."
                          autoFocus
                        />
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => {
                            setIsCreatingGroup(false);
                            setNewGroupName('');
                          }}
                          className="btn-secondary flex-1"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={handleCreateGroup}
                          disabled={!newGroupName.trim()}
                          className="btn-primary flex-1"
                        >
                          <Plus className="w-4 h-4" />
                          Create Group
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Result Message */}
              {result && (
                <div
                  className={`p-4 rounded-lg flex items-center gap-3 ${result.success
                    ? 'bg-accent-success/10 text-accent-success'
                    : 'bg-accent-danger/10 text-accent-danger'
                    }`}
                >
                  {result.success ? (
                    <Check className="w-5 h-5 flex-shrink-0" />
                  ) : (
                    <AlertCircle className="w-5 h-5 flex-shrink-0" />
                  )}
                  <p className="text-sm">{result.message}</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-dark-800 flex items-center justify-between">
          <div className="text-sm text-dark-400">
            {selectedBookmarks.size > 0 && (
              <span>{selectedBookmarks.size} bookmark{selectedBookmarks.size !== 1 ? 's' : ''} selected</span>
            )}
          </div>
          <div className="flex gap-3">
            <button onClick={handleClose} className="btn-secondary">
              {result?.success ? 'Done' : 'Cancel'}
            </button>
            {!result?.success && (
              <button
                onClick={handleImport}
                disabled={!selectedBrowser || selectedBookmarks.size === 0 || importing || (isCreatingGroup && !newGroupName.trim())}
                className="btn-primary"
              >
                {importing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Importing...
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4" />
                    Import {selectedBookmarks.size} Bookmark{selectedBookmarks.size !== 1 ? 's' : ''}
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
