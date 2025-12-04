import { useMemo } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  rectSortingStrategy,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { ExternalLink, ArrowUpDown } from 'lucide-react';
import { useState } from 'react';
import { useStore } from '../../store/useStore';
import { SortableItemCard } from './SortableItemCard';
import { SortableListItem } from './SortableListItem';
import { ListItem } from './ListItem';
import type { Group, AnyItem, BookmarkItem, SSHItem, AppItem, PasswordItem } from '@shared/types';

interface SortableGroupSectionProps {
  group: Group;
  items: AnyItem[];
  onLaunchAll: () => void;
  cardViewMode: 'normal' | 'compact' | 'list';
}

type SortField = 'name' | 'type' | 'group' | 'accessCount';
type SortDirection = 'asc' | 'desc';

export function SortableGroupSection({ group, items, onLaunchAll, cardViewMode }: SortableGroupSectionProps) {
  const { reorderItems, isSelectionMode, openEditModal, deleteItem, createItem, groups, selectedItemIds, toggleItemSelection, activeProfile } = useStore();
  const [sortField, setSortField] = useState<SortField | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const sortedItems = useMemo(() => {
    let sorted = [...items];
    
    // Apply sorting if sortField is set
    if (sortField && cardViewMode === 'list') {
      sorted.sort((a, b) => {
        let comparison = 0;
        
        switch (sortField) {
          case 'name':
            comparison = a.name.localeCompare(b.name);
            break;
          case 'type':
            comparison = a.type.localeCompare(b.type);
            break;
          case 'group':
            const groupA = groups.find(g => g.id === a.groupId)?.name || '';
            const groupB = groups.find(g => g.id === b.groupId)?.name || '';
            comparison = groupA.localeCompare(groupB);
            break;
          case 'accessCount':
            comparison = a.accessCount - b.accessCount;
            break;
        }
        
        return sortDirection === 'asc' ? comparison : -comparison;
      });
    } else {
      // Default: sort by sortOrder
      sorted.sort((a, b) => a.sortOrder - b.sortOrder);
    }
    
    return sorted;
  }, [items, sortField, sortDirection, cardViewMode, groups]);

  const itemIds = useMemo(() => sortedItems.map((item) => item.id), [sortedItems]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const handleCopyAddress = (item: AnyItem) => {
    let text = '';
    if (item.type === 'bookmark') {
      const bookmark = item as BookmarkItem;
      const address = bookmark.networkAddresses?.[activeProfile] || bookmark.networkAddresses?.local;
      const port = bookmark.port ? `:${bookmark.port}` : '';
      const path = bookmark.path || '';
      text = `${bookmark.protocol}://${address}${port}${path}`;
    } else if (item.type === 'ssh') {
      const ssh = item as SSHItem;
      const address = ssh.networkAddresses?.[activeProfile] || ssh.networkAddresses?.local;
      text = `ssh ${ssh.username}@${address} -p ${ssh.port || 22}`;
    }
    if (text) {
      navigator.clipboard.writeText(text);
    }
  };

  const handleDuplicate = async (item: AnyItem) => {
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
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = sortedItems.findIndex((item) => item.id === active.id);
      const newIndex = sortedItems.findIndex((item) => item.id === over.id);

      const newOrder = arrayMove(sortedItems, oldIndex, newIndex);
      
      // Create reorder payload
      const reorderPayload = newOrder.map((item, index) => ({
        id: item.id,
        sortOrder: index,
      }));

      reorderItems(reorderPayload);
    }
  };

  return (
    <section className="animate-fade-in">
      {/* Group Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <span className="text-2xl">{group.icon || '📁'}</span>
          <h2 className="text-lg font-semibold text-dark-200">{group.name}</h2>
          <span className="badge-primary">{items.length}</span>
        </div>

        <button
          onClick={onLaunchAll}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm
                   text-dark-400 hover:text-accent-success hover:bg-dark-800
                   transition-all duration-200"
        >
          <ExternalLink className="w-4 h-4" />
          Open All
        </button>
      </div>

      {/* List View */}
      {cardViewMode === 'list' ? (
        <div className="pl-6">
          {/* List Header with Sort Options */}
          <div className="flex items-center gap-4 px-4 py-2 mb-2 text-xs font-medium text-dark-400 border-b border-dark-700/50">
            <div className="w-10" /> {/* Icon column */}
            <button
              onClick={() => handleSort('name')}
              className="flex items-center gap-1 hover:text-dark-200 transition-colors flex-1 text-left"
            >
              Name
              {sortField === 'name' && (
                <ArrowUpDown className={`w-3 h-3 ${sortDirection === 'desc' ? 'rotate-180' : ''}`} />
              )}
            </button>
            <button
              onClick={() => handleSort('group')}
              className="flex items-center gap-1 hover:text-dark-200 transition-colors min-w-[100px] text-right"
            >
              Group
              {sortField === 'group' && (
                <ArrowUpDown className={`w-3 h-3 ${sortDirection === 'desc' ? 'rotate-180' : ''}`} />
              )}
            </button>
            <button
              onClick={() => handleSort('type')}
              className="flex items-center gap-1 hover:text-dark-200 transition-colors min-w-[70px] text-center"
            >
              Type
              {sortField === 'type' && (
                <ArrowUpDown className={`w-3 h-3 ${sortDirection === 'desc' ? 'rotate-180' : ''}`} />
              )}
            </button>
            <div className="min-w-[60px]" /> {/* Actions column */}
          </div>

          {/* List Items */}
          {isSelectionMode ? (
            <div className="space-y-2">
              {sortedItems.map((item) => {
                const itemGroup = groups.find(g => g.id === item.groupId) || group;
                return (
                  <ListItem
                    key={item.id}
                    item={item}
                    group={itemGroup}
                    isSelected={selectedItemIds.has(item.id)}
                    onSelect={() => toggleItemSelection(item.id)}
                    onEdit={() => openEditModal(item)}
                    onDelete={() => deleteItem(item.id)}
                    onDuplicate={() => handleDuplicate(item)}
                    onCopyAddress={item.type === 'bookmark' || item.type === 'ssh' ? () => handleCopyAddress(item) : undefined}
                  />
                );
              })}
            </div>
          ) : (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext items={itemIds} strategy={verticalListSortingStrategy}>
                <div className="space-y-2">
                  {sortedItems.map((item) => {
                    const itemGroup = groups.find(g => g.id === item.groupId) || group;
                    return (
                      <SortableListItem
                        key={item.id}
                        item={item}
                        group={itemGroup}
                        isSelected={selectedItemIds.has(item.id)}
                        onSelect={() => toggleItemSelection(item.id)}
                        onEdit={() => openEditModal(item)}
                        onDelete={() => deleteItem(item.id)}
                        onDuplicate={() => handleDuplicate(item)}
                        onCopyAddress={item.type === 'bookmark' || item.type === 'ssh' ? () => handleCopyAddress(item) : undefined}
                      />
                    );
                  })}
                </div>
              </SortableContext>
            </DndContext>
          )}
        </div>
      ) : (
        /* Card Views (Normal/Compact) */
        <>
          {isSelectionMode ? (
            // No drag and drop in selection mode
            <div className={`grid gap-4 pl-6 ${
              cardViewMode === 'compact'
                ? 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 3xl:grid-cols-7'
                : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5'
            }`}>
              {sortedItems.map((item) => (
                <SortableItemCard key={item.id} item={item} compact={cardViewMode === 'compact'} />
              ))}
            </div>
          ) : (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext items={itemIds} strategy={rectSortingStrategy}>
                <div className={`grid gap-4 pl-6 ${
                  cardViewMode === 'compact'
                    ? 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 3xl:grid-cols-7'
                    : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5'
                }`}>
                  {sortedItems.map((item) => (
                    <SortableItemCard key={item.id} item={item} compact={cardViewMode === 'compact'} />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          )}
        </>
      )}
    </section>
  );
}

