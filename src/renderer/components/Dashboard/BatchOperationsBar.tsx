import { useState } from 'react';
import {
  X,
  Trash2,
  CheckSquare,
  Square,
  FolderPlus,
  Plus,
  Replace,
} from 'lucide-react';
import { useStore } from '../../store/useStore';
import { BulkEditModal } from '../Modals/BulkEditModal';

export function BatchOperationsBar() {
  const {
    isSelectionMode,
    selectedItemIds,
    clearSelection,
    toggleSelectionMode,
    selectAllItems,
    batchDeleteItems,
    batchChangeGroup,
    groups,
    items,
    selectedGroupId,
    openGroupModal,
  } = useStore();

  const [showGroupSelector, setShowGroupSelector] = useState(false);
  const [showBulkEdit, setShowBulkEdit] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isMoving, setIsMoving] = useState(false);

  const selectedCount = selectedItemIds.size;

  if (!isSelectionMode) return null;

  const handleDelete = async () => {
    if (!confirm(`Delete ${selectedCount} item(s)? This cannot be undone.`)) {
      return;
    }

    setIsDeleting(true);
    try {
      await batchDeleteItems(Array.from(selectedItemIds));
    } catch (error) {
      console.error('Batch delete failed:', error);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleMoveToGroup = async (groupId: string) => {
    setIsMoving(true);
    try {
      await batchChangeGroup(Array.from(selectedItemIds), groupId);
      setShowGroupSelector(false);
    } catch (error) {
      console.error('Batch move failed:', error);
    } finally {
      setIsMoving(false);
    }
  };

  const handleCreateNewGroup = () => {
    setShowGroupSelector(false);
    // Open group modal, and after creation, move items to the new group
    openGroupModal();
    // We'll need to handle the group creation callback separately
    // For now, just open the modal and let user create the group
  };

  // Get items to select (current group or all)
  const itemsToSelect = selectedGroupId
    ? items.filter(item => item.groupId === selectedGroupId)
    : items;
  const allSelected = itemsToSelect.length > 0 && itemsToSelect.every(item => selectedItemIds.has(item.id));

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 animate-slide-up">
      <div className="bg-dark-900 border border-dark-700 rounded-xl shadow-2xl px-4 py-3 flex items-center gap-4">
        {/* Selection Info */}
        <div className="flex items-center gap-2">
          <button
            onClick={allSelected ? clearSelection : selectAllItems}
            className="p-1.5 rounded-lg hover:bg-dark-800 transition-colors"
            title={allSelected ? 'Deselect All' : 'Select All'}
          >
            {allSelected ? (
              <CheckSquare className="w-5 h-5 text-accent-primary" />
            ) : (
              <Square className="w-5 h-5 text-dark-400" />
            )}
          </button>
          <span className="text-sm font-medium text-dark-200">
            {selectedCount} selected
          </span>
        </div>

        <div className="h-6 w-px bg-dark-700" />

        {/* Actions */}
        <div className="flex items-center gap-2">
          {/* Move to Group */}
          <div className="relative">
            <button
              onClick={() => setShowGroupSelector(!showGroupSelector)}
              disabled={isMoving || selectedCount === 0}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm
                       bg-dark-800 hover:bg-dark-700 text-dark-200
                       disabled:opacity-50 disabled:cursor-not-allowed
                       transition-all duration-200"
            >
              <FolderPlus className="w-4 h-4" />
              Move to Group
            </button>

            {showGroupSelector && (
              <>
                <div
                  className="fixed inset-0 z-10"
                  onClick={() => setShowGroupSelector(false)}
                />
                <div className="absolute bottom-full left-0 mb-2 w-56 py-2 bg-dark-800 border border-dark-700 
                              rounded-lg shadow-xl z-20 animate-slide-down max-h-64 overflow-y-auto">
                  {/* Create New Group Option */}
                  <button
                    onClick={handleCreateNewGroup}
                    className="w-full flex items-center gap-3 px-4 py-2 text-left text-sm
                             text-accent-primary hover:bg-dark-700 hover:text-accent-primary transition-colors
                             border-b border-dark-700 mb-1"
                  >
                    <Plus className="w-4 h-4" />
                    <span className="flex-1 font-medium">Create New Group</span>
                  </button>

                  <div className="h-px bg-dark-700 my-1" />

                  {/* Existing Groups */}
                  {groups.length === 0 ? (
                    <div className="px-4 py-2 text-sm text-dark-500 text-center">
                      No groups yet
                    </div>
                  ) : (
                    groups.map((group) => (
                      <button
                        key={group.id}
                        onClick={() => handleMoveToGroup(group.id)}
                        className="w-full flex items-center gap-3 px-4 py-2 text-left text-sm
                                 text-dark-300 hover:bg-dark-700 hover:text-dark-100 transition-colors"
                      >
                        <span className="text-lg">{group.icon || '📁'}</span>
                        <span className="flex-1">{group.name}</span>
                      </button>
                    ))
                  )}
                </div>
              </>
            )}
          </div>

          {/* Bulk Edit Addresses */}
          <button
            onClick={() => setShowBulkEdit(true)}
            disabled={selectedCount === 0}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm
                     bg-dark-800 hover:bg-dark-700 text-dark-200
                     disabled:opacity-50 disabled:cursor-not-allowed
                     transition-all duration-200"
          >
            <Replace className="w-4 h-4" />
            Bulk Edit
          </button>

          {/* Delete */}
          <button
            onClick={handleDelete}
            disabled={isDeleting || selectedCount === 0}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm
                     bg-accent-danger/20 hover:bg-accent-danger/30 text-accent-danger
                     disabled:opacity-50 disabled:cursor-not-allowed
                     transition-all duration-200"
          >
            <Trash2 className="w-4 h-4" />
            {isDeleting ? 'Deleting...' : 'Delete'}
          </button>
        </div>

        <div className="h-6 w-px bg-dark-700" />

        {/* Close */}
        <button
          onClick={() => {
            toggleSelectionMode();
            clearSelection();
          }}
          className="p-1.5 rounded-lg hover:bg-dark-800 text-dark-400 hover:text-dark-200 transition-colors"
          title="Exit Selection Mode"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <BulkEditModal
        isOpen={showBulkEdit}
        onClose={() => setShowBulkEdit(false)}
        selectedIds={Array.from(selectedItemIds)}
      />
    </div>
  );
}
