import React, { useState, useEffect, useRef } from 'react';
import { useStore } from '../store/useStore';
import {
    Search,
    Plus,
    Settings,
    FolderPlus,
    Play,
    Lock,
    X,
} from 'lucide-react';
import type { Group } from '@shared/types';

interface Command {
    id: string;
    label: string;
    icon: React.ReactNode;
    shortcut?: string;
    action: () => void;
    category: string;
}

export const CommandPalette: React.FC<{ isOpen: boolean; onClose: () => void }> = ({
    isOpen,
    onClose,
}) => {
    const [query, setQuery] = useState('');
    const [selectedIndex, setSelectedIndex] = useState(0);
    const inputRef = useRef<HTMLInputElement>(null);

    const {
        openAddModal,
        openSettings,
        openGroupModal,
        launchGroup,
        groups,
        lockVault,
        isVaultSetup,
    } = useStore();

    const commands: Command[] = [
        // Items
        {
            id: 'add-item',
            label: 'Add New Item',
            icon: <Plus className="w-4 h-4" />,
            shortcut: 'Cmd+N',
            action: () => { openAddModal(); onClose(); },
            category: 'Items',
        },
        // Groups
        {
            id: 'add-group',
            label: 'Create New Group',
            icon: <FolderPlus className="w-4 h-4" />,
            shortcut: 'Cmd+G',
            action: () => { openGroupModal(); onClose(); },
            category: 'Groups',
        },
        ...groups.map((group: Group, index: number) => ({
            id: `launch-group-${group.id}`,
            label: `Launch All in ${group.name}`,
            icon: <Play className="w-4 h-4" />,
            shortcut: index < 9 ? `${index + 1}` : undefined,
            action: () => { launchGroup(group.id); onClose(); },
            category: 'Groups',
        })),
        // Settings
        {
            id: 'settings',
            label: 'Open Settings',
            icon: <Settings className="w-4 h-4" />,
            shortcut: 'Cmd+,',
            action: () => { openSettings(); onClose(); },
            category: 'Settings',
        },
        // Security
        ...(isVaultSetup
            ? [
                {
                    id: 'lock-vault',
                    label: 'Lock Vault',
                    icon: <Lock className="w-4 h-4" />,
                    shortcut: 'Cmd+L',
                    action: () => { lockVault(); onClose(); },
                    category: 'Security',
                },
            ]
            : []),
    ];

    const filteredCommands = query
        ? commands.filter(
            (cmd) =>
                cmd.label.toLowerCase().includes(query.toLowerCase()) ||
                cmd.category.toLowerCase().includes(query.toLowerCase())
        )
        : commands;

    // Group commands by category
    const groupedCommands = filteredCommands.reduce((acc, cmd) => {
        if (!acc[cmd.category]) {
            acc[cmd.category] = [];
        }
        acc[cmd.category].push(cmd);
        return acc;
    }, {} as Record<string, Command[]>);

    useEffect(() => {
        if (isOpen && inputRef.current) {
            inputRef.current.focus();
        }
    }, [isOpen]);

    useEffect(() => {
        setSelectedIndex(0);
    }, [query]);

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setSelectedIndex((i) => Math.min(i + 1, filteredCommands.length - 1));
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setSelectedIndex((i) => Math.max(i - 1, 0));
        } else if (e.key === 'Enter') {
            e.preventDefault();
            filteredCommands[selectedIndex]?.action();
        } else if (e.key === 'Escape') {
            e.preventDefault();
            onClose();
        }
    };

    if (!isOpen) return null;

    return (
        <div
            className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm flex items-start justify-center pt-[20vh]"
            onClick={onClose}
        >
            <div
                className="w-full max-w-2xl bg-dark-900 border border-dark-700 rounded-2xl shadow-2xl overflow-hidden"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Search Input */}
                <div className="flex items-center gap-3 p-4 border-b border-dark-700">
                    <Search className="w-5 h-5 text-dark-400" />
                    <input
                        ref={inputRef}
                        type="text"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="Type a command or search..."
                        className="flex-1 bg-transparent text-dark-100 placeholder-dark-500 focus:outline-none text-lg"
                    />
                    <button
                        onClick={onClose}
                        className="p-1 text-dark-400 hover:text-dark-100 rounded transition-colors"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>

                {/* Commands List */}
                <div className="max-h-[60vh] overflow-y-auto custom-scrollbar">
                    {Object.keys(groupedCommands).length === 0 ? (
                        <div className="p-8 text-center text-dark-500">
                            No commands found for "{query}"
                        </div>
                    ) : (
                        Object.entries(groupedCommands).map(([category, cmds]) => (
                            <div key={category} className="py-2">
                                <div className="px-4 py-2 text-xs font-semibold text-dark-500 uppercase tracking-wider">
                                    {category}
                                </div>
                                {cmds.map((cmd, index) => {
                                    const globalIndex = filteredCommands.indexOf(cmd);
                                    return (
                                        <button
                                            key={cmd.id}
                                            onClick={cmd.action}
                                            className={`w-full flex items-center justify-between px-4 py-3 hover:bg-dark-800 transition-colors ${globalIndex === selectedIndex ? 'bg-dark-800' : ''
                                                }`}
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className="text-dark-400">{cmd.icon}</div>
                                                <span className="text-dark-100">{cmd.label}</span>
                                            </div>
                                            {cmd.shortcut && (
                                                <kbd className="px-2 py-1 text-xs bg-dark-800 border border-dark-700 rounded text-dark-400">
                                                    {cmd.shortcut}
                                                </kbd>
                                            )}
                                        </button>
                                    );
                                })}
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
};
