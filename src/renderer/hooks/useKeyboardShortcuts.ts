import { useEffect } from 'react';
import { useStore } from '../store/useStore';

export function useKeyboardShortcuts() {
  const {
    openAddModal,
    openSettings,
    openGroupModal,
    setSearchQuery,
    setSelectedGroup,
    groups,
    selectedGroupId,
    searchQuery,
    isAddModalOpen,
    isEditModalOpen,
    isGroupModalOpen,
    isSettingsOpen,
    closeAddModal,
    closeEditModal,
    closeGroupModal,
    closeSettings,
    lockVault,
    isVaultSetup,
    openCommandPalette,
    isCommandPaletteOpen,
  } = useStore();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger shortcuts when typing in inputs
      const target = e.target as HTMLElement;
      const isInput = target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable;

      // Check if any modal is open
      const anyModalOpen = isAddModalOpen || isEditModalOpen || isGroupModalOpen || isSettingsOpen || isCommandPaletteOpen;

      // Escape - close modals
      if (e.key === 'Escape') {
        if (isAddModalOpen) {
          closeAddModal();
          return;
        }
        if (isEditModalOpen) {
          closeEditModal();
          return;
        }
        if (isGroupModalOpen) {
          closeGroupModal();
          return;
        }
        if (isSettingsOpen) {
          closeSettings();
          return;
        }
        // Clear search if not in modal
        if (searchQuery) {
          setSearchQuery('');
          return;
        }
        // Clear group selection
        if (selectedGroupId) {
          setSelectedGroup(null);
          return;
        }
      }

      // Don't process other shortcuts if in input or modal open
      if (isInput && e.key !== 'Escape') return;
      if (anyModalOpen) return;

      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
      const cmdOrCtrl = isMac ? e.metaKey : e.ctrlKey;

      // Cmd/Ctrl + N - New item
      if (cmdOrCtrl && e.key === 'n') {
        e.preventDefault();
        openAddModal();
        return;
      }

      // Cmd/Ctrl + G - New group
      if (cmdOrCtrl && e.key === 'g') {
        e.preventDefault();
        openGroupModal();
        return;
      }

      // Cmd/Ctrl + , - Settings
      if (cmdOrCtrl && e.key === ',') {
        e.preventDefault();
        openSettings();
        return;
      }

      // Cmd/Ctrl + K - Command Palette
      if (cmdOrCtrl && e.key === 'k') {
        e.preventDefault();
        openCommandPalette();
        return;
      }

      // Cmd/Ctrl + F - Focus search
      if (cmdOrCtrl && e.key === 'f') {
        e.preventDefault();
        const searchInput = document.querySelector('input[placeholder*="Search"]') as HTMLInputElement;
        if (searchInput) {
          searchInput.focus();
          searchInput.select();
        }
        return;
      }

      // Cmd/Ctrl + L - Lock vault
      if (cmdOrCtrl && e.key === 'l' && isVaultSetup) {
        e.preventDefault();
        lockVault();
        return;
      }

      // Number keys 1-9 - Select group
      if (e.key >= '1' && e.key <= '9' && !cmdOrCtrl && !e.altKey) {
        const groupIndex = parseInt(e.key, 10) - 1;
        if (groups[groupIndex]) {
          setSelectedGroup(groups[groupIndex].id);
        }
        return;
      }

      // 0 or Backquote - Show all groups
      if ((e.key === '0' || e.key === '`') && !cmdOrCtrl && !e.altKey) {
        setSelectedGroup(null);
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    openAddModal,
    openSettings,
    openGroupModal,
    setSearchQuery,
    setSelectedGroup,
    groups,
    selectedGroupId,
    searchQuery,
    isAddModalOpen,
    isEditModalOpen,
    isGroupModalOpen,
    isSettingsOpen,
    closeAddModal,
    closeEditModal,
    closeGroupModal,
    closeSettings,
    lockVault,
    isVaultSetup,
  ]);
}

