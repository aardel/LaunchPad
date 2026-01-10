import type { AnyItem, Group } from '@shared/types';
import type { ExportData } from '../main/services/importExport';

export interface GroupConflict {
    importedGroup: Group;
    existingGroup: Group;
    existingItemCount: number;
}

export interface ImportAnalysis {
    conflicts: GroupConflict[];
    safeGroups: Group[]; // Groups that can be imported without conflict
    safeItems: AnyItem[]; // Items in safe groups
}

/**
 * Analyzes import data for conflicts
 * A conflict occurs when an imported group has the same name as an existing group with items
 * Empty groups with matching names are NOT considered conflicts
 */
export function analyzeImport(
    importedData: ExportData,
    existingGroups: Group[],
    existingItems: AnyItem[]
): ImportAnalysis {
    const conflicts: GroupConflict[] = [];
    const safeGroups: Group[] = [];
    const safeItems: AnyItem[] = [];

    // Create a map of group IDs to item counts
    const groupItemCounts = new Map<string, number>();
    existingItems.forEach(item => {
        const count = groupItemCounts.get(item.groupId) || 0;
        groupItemCounts.set(item.groupId, count + 1);
    });

    // Check each imported group for conflicts
    importedData.groups.forEach(importedGroup => {
        const existingGroup = existingGroups.find(
            g => g.name.toLowerCase() === importedGroup.name.toLowerCase()
        );

        if (existingGroup) {
            const itemCount = groupItemCounts.get(existingGroup.id) || 0;

            if (itemCount > 0) {
                // Conflict: existing group has items
                conflicts.push({
                    importedGroup,
                    existingGroup,
                    existingItemCount: itemCount,
                });
            } else {
                // Safe: existing group is empty, can be overwritten
                safeGroups.push(importedGroup);
                const groupItems = importedData.items.filter(i => i.groupId === importedGroup.id);
                safeItems.push(...groupItems);
            }
        } else {
            // Safe: no existing group with this name
            safeGroups.push(importedGroup);
            const groupItems = importedData.items.filter(i => i.groupId === importedGroup.id);
            safeItems.push(...groupItems);
        }
    });

    return { conflicts, safeGroups, safeItems };
}

/**
 * Creates a unique key for deduplication
 */
function getItemKey(item: AnyItem): string {
    if (item.type === 'bookmark') {
        const bookmark = item as any;
        const url = `${bookmark.protocol}://${bookmark.networkAddresses?.local || ''}${bookmark.port ? `:${bookmark.port}` : ''}${bookmark.path || ''}`;
        return `${item.name.toLowerCase()}|${url.toLowerCase()}`;
    } else if (item.type === 'app') {
        const app = item as any;
        return `${item.name.toLowerCase()}|${app.command?.toLowerCase() || ''}`;
    } else if (item.type === 'ssh') {
        const ssh = item as any;
        return `${item.name.toLowerCase()}|${ssh.host?.toLowerCase() || ''}|${ssh.port || ''}`;
    }
    return item.name.toLowerCase();
}

/**
 * Merges items into a group, deduplicating based on name+URL/command
 */
export function deduplicateItems(
    existingItems: AnyItem[],
    newItems: AnyItem[]
): AnyItem[] {
    const existingKeys = new Set(existingItems.map(getItemKey));
    const uniqueNewItems = newItems.filter(item => !existingKeys.has(getItemKey(item)));
    return uniqueNewItems;
}
