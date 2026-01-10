import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Search, Replace, Info, Loader2, GripHorizontal, LayoutGrid, CheckSquare } from 'lucide-react';
import { useStore } from '../../store/useStore';

interface BulkEditModalProps {
    isOpen: boolean;
    onClose: () => void;
    selectedIds: string[];
}

type TargetType = 'selected' | 'groups';

export function BulkEditModal({ isOpen, onClose, selectedIds }: BulkEditModalProps) {
    const { batchReplaceAddress, groups, items } = useStore();
    const [targetType, setTargetType] = useState<TargetType>(selectedIds.length > 0 ? 'selected' : 'groups');
    const [selectedGroupIds, setSelectedGroupIds] = useState<string[]>([]);
    const [searchText, setSearchText] = useState('');
    const [replacementText, setReplacementText] = useState('');
    const [profile, setProfile] = useState('all');
    const [useRegex, setUseRegex] = useState(false);
    const [isUpdating, setIsUpdating] = useState(false);

    // Dragging state
    const [position, setPosition] = useState({ x: 0, y: 0 });
    const [isDragging, setIsDragging] = useState(false);
    const dragStartPos = useRef({ x: 0, y: 0 });
    const modalRef = useRef<HTMLDivElement>(null);

    // Reset state when modal opens
    useEffect(() => {
        if (isOpen) {
            setPosition({ x: 0, y: 0 });
            setSearchText('');
            setReplacementText('');
            setUseRegex(false);
            setIsUpdating(false);
            setTargetType(selectedIds.length > 0 ? 'selected' : 'groups');
            setSelectedGroupIds([]);
        }
    }, [isOpen, selectedIds]);

    const handleMouseDown = (e: React.MouseEvent) => {
        if ((e.target as HTMLElement).closest('button') ||
            (e.target as HTMLElement).closest('input') ||
            (e.target as HTMLElement).closest('select') ||
            (e.target as HTMLElement).closest('.scrollable')) {
            return;
        }
        setIsDragging(true);
        dragStartPos.current = {
            x: e.clientX - position.x,
            y: e.clientY - position.y
        };
    };

    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            if (!isDragging) return;
            setPosition({
                x: e.clientX - dragStartPos.current.x,
                y: e.clientY - dragStartPos.current.y
            });
        };

        const handleMouseUp = () => {
            setIsDragging(false);
        };

        if (isDragging) {
            window.addEventListener('mousemove', handleMouseMove);
            window.addEventListener('mouseup', handleMouseUp);
        }

        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isDragging]);

    if (!isOpen) return null;

    const toggleGroup = (groupId: string) => {
        setSelectedGroupIds(prev =>
            prev.includes(groupId)
                ? prev.filter(id => id !== groupId)
                : [...prev, groupId]
        );
    };

    const handleUpdate = async () => {
        if (!searchText) return;

        let finalItemIds: string[] = [];

        if (targetType === 'selected') {
            finalItemIds = selectedIds;
        } else {
            // Get all item IDs from selected groups
            finalItemIds = items
                .filter(item => selectedGroupIds.includes(item.groupId))
                .map(item => item.id);
        }

        if (finalItemIds.length === 0) return;

        setIsUpdating(true);
        try {
            await batchReplaceAddress(finalItemIds, searchText, replacementText, profile, useRegex);
            onClose();
        } catch (error) {
            console.error('Bulk update failed:', error);
        } finally {
            setIsUpdating(false);
        }
    };

    const targetItemCount = targetType === 'selected'
        ? selectedIds.length
        : items.filter(item => selectedGroupIds.includes(item.groupId)).length;

    return createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 pointer-events-none">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-dark-950/40 backdrop-blur-[2px] pointer-events-auto"
                onClick={onClose}
            />

            <div
                ref={modalRef}
                style={{
                    transform: `translate(${position.x}px, ${position.y}px)`,
                    cursor: isDragging ? 'grabbing' : 'auto'
                }}
                className="relative bg-dark-900 border border-dark-700 rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-scale-in pointer-events-auto flex flex-col max-h-[90vh]"
            >
                {/* Header / Drag Handle */}
                <div
                    onMouseDown={handleMouseDown}
                    className="px-6 py-4 border-b border-dark-800 flex items-center justify-between bg-dark-850/50 cursor-grab active:cursor-grabbing select-none shrink-0"
                >
                    <div className="flex items-center gap-2">
                        <GripHorizontal className="w-4 h-4 text-dark-500" />
                        <h2 className="text-lg font-bold text-dark-100 flex items-center gap-2">
                            <Replace className="w-5 h-5 text-accent-primary" />
                            Find & Replace Addresses
                        </h2>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 rounded-lg hover:bg-dark-700 text-dark-400 hover:text-dark-100 transition-colors pointer-events-auto"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 space-y-6 overflow-y-auto scrollable">
                    {/* Step 1: Target Selection */}
                    <div className="space-y-3">
                        <label className="block text-sm font-semibold text-dark-200">
                            1. Select Target scope
                        </label>
                        <div className="grid grid-cols-2 gap-3">
                            <button
                                onClick={() => setTargetType('selected')}
                                disabled={selectedIds.length === 0}
                                className={`flex items-center justify-center gap-2 p-3 rounded-xl border transition-all ${targetType === 'selected'
                                    ? 'bg-accent-primary/10 border-accent-primary text-accent-primary'
                                    : 'bg-dark-800 border-dark-700 text-dark-400 hover:bg-dark-750 disabled:opacity-50 disabled:cursor-not-allowed'
                                    }`}
                            >
                                <CheckSquare className="w-4 h-4" />
                                <div className="flex flex-col items-start">
                                    <span className="text-sm font-medium">Selected Items</span>
                                    <span className="text-[10px] opacity-70">Currently {selectedIds.length} active</span>
                                </div>
                            </button>
                            <button
                                onClick={() => setTargetType('groups')}
                                className={`flex items-center justify-center gap-2 p-3 rounded-xl border transition-all ${targetType === 'groups'
                                    ? 'bg-accent-primary/10 border-accent-primary text-accent-primary'
                                    : 'bg-dark-800 border-dark-700 text-dark-400 hover:bg-dark-750'
                                    }`}
                            >
                                <LayoutGrid className="w-4 h-4" />
                                <div className="flex flex-col items-start">
                                    <span className="text-sm font-medium">By Groups</span>
                                    <span className="text-[10px] opacity-70">Entire groups scope</span>
                                </div>
                            </button>
                        </div>
                    </div>

                    {targetType === 'groups' && (
                        <div className="space-y-2 animate-in fade-in slide-in-from-top-2 duration-200">
                            <label className="block text-sm font-medium text-dark-300">
                                Choose Groups:
                            </label>
                            <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto p-2 bg-dark-800 rounded-xl border border-dark-700 scrollable">
                                {groups.map(group => (
                                    <button
                                        key={group.id}
                                        onClick={() => toggleGroup(group.id)}
                                        className={`flex items-center gap-2 p-2 rounded-lg text-xs transition-all ${selectedGroupIds.includes(group.id)
                                            ? 'bg-accent-primary text-white shadow-lg'
                                            : 'bg-dark-700 text-dark-300 hover:bg-dark-600'
                                            }`}
                                    >
                                        <span className="shrink-0">{group.icon}</span>
                                        <span className="truncate">{group.name}</span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    <div className="bg-accent-primary/5 border border-accent-primary/20 rounded-xl p-4 flex gap-3 text-sm text-dark-300 shrink-0">
                        <Info className="w-5 h-5 text-accent-primary shrink-0" />
                        <p>
                            Operation will be applied to <strong>{targetItemCount}</strong> items.
                            Only addresses matching your search will be modified.
                        </p>
                    </div>

                    <div className="space-y-4 pt-2 border-t border-dark-800">
                        <label className="block text-sm font-semibold text-dark-200">
                            2. Find & Replace
                        </label>

                        {/* Profile Selection */}
                        <div>
                            <label className="block text-xs font-medium text-dark-400 mb-1.5 uppercase tracking-wider">
                                Target Network Profile
                            </label>
                            <select
                                value={profile}
                                onChange={(e) => setProfile(e.target.value)}
                                className="w-full bg-dark-800 border border-dark-700 rounded-lg px-3 py-2 text-dark-100 focus:outline-none focus:ring-2 focus:ring-accent-primary/20 focus:border-accent-primary transition-all"
                            >
                                <option value="all">All Address Profiles</option>
                                <option value="local">Local IP / Hostname</option>
                                <option value="tailscale">Tailscale Address</option>
                                <option value="vpn">VPN Address</option>
                                <option value="custom">Custom Address</option>
                            </select>
                        </div>

                        {/* Search Text */}
                        <div>
                            <div className="flex items-center justify-between mb-1.5">
                                <label className="block text-xs font-medium text-dark-400 uppercase tracking-wider">
                                    Text to find (within target)
                                </label>
                                <button
                                    onClick={() => setUseRegex(!useRegex)}
                                    className={`flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-medium transition-colors border ${useRegex
                                        ? 'bg-accent-primary/10 border-accent-primary/30 text-accent-primary'
                                        : 'bg-dark-800 border-dark-700 text-dark-400 hover:text-dark-300'
                                        }`}
                                >
                                    <span className={useRegex ? 'opacity-100' : 'opacity-0'}>✓</span>
                                    Regex
                                </button>
                            </div>
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-dark-500" />
                                <input
                                    type="text"
                                    value={searchText}
                                    onChange={(e) => setSearchText(e.target.value)}
                                    placeholder={useRegex ? "^192\\.168\\.\\d+\\." : "e.g. 192.168.0"}
                                    className={`w-full bg-dark-800 border rounded-lg pl-10 pr-4 py-2 text-dark-100 focus:outline-none focus:ring-2 focus:ring-accent-primary/20 transition-all ${useRegex ? 'border-accent-primary/30 font-mono text-sm' : 'border-dark-700'
                                        }`}
                                />
                            </div>
                        </div>

                        {/* Replacement Text */}
                        <div>
                            <label className="block text-xs font-medium text-dark-400 mb-1.5 uppercase tracking-wider">
                                Replace with
                            </label>
                            <div className="relative">
                                <Replace className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-dark-500" />
                                <input
                                    type="text"
                                    value={replacementText}
                                    onChange={(e) => setReplacementText(e.target.value)}
                                    placeholder="e.g. 192.168.1"
                                    className="w-full bg-dark-800 border border-dark-700 rounded-lg pl-10 pr-4 py-2 text-dark-100 focus:outline-none focus:ring-2 focus:ring-accent-primary/20 focus:border-accent-primary transition-all"
                                />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="px-6 py-4 bg-dark-850/50 border-t border-dark-800 flex justify-end gap-3 shrink-0">
                    <button
                        onClick={onClose}
                        className="btn-secondary"
                        disabled={isUpdating}
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleUpdate}
                        disabled={!searchText || isUpdating || targetItemCount === 0}
                        className="btn-primary min-w-[140px]"
                    >
                        {isUpdating ? (
                            <>
                                <Loader2 className="w-4 h-4 animate-spin" />
                                Updating...
                            </>
                        ) : (
                            'Execute Replace'
                        )}
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
}
