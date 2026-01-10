import React, { useState } from 'react';
import { X, AlertTriangle, Merge, Replace, SkipForward } from 'lucide-react';
import type { Group } from '@shared/types';

export interface GroupConflict {
    importedGroup: Group;
    existingGroup: Group;
    existingItemCount: number;
}

interface ImportConflictModalProps {
    isOpen: boolean;
    onClose: () => void;
    conflicts: GroupConflict[];
    onResolve: (resolutions: Map<string, 'merge' | 'replace' | 'skip'>) => void;
}

export const ImportConflictModal: React.FC<ImportConflictModalProps> = ({
    isOpen,
    onClose,
    conflicts,
    onResolve,
}) => {
    const [resolutions, setResolutions] = useState<Map<string, 'merge' | 'replace' | 'skip'>>(
        new Map(conflicts.map(c => [c.importedGroup.id, 'merge']))
    );

    if (!isOpen) return null;

    const handleResolutionChange = (groupId: string, resolution: 'merge' | 'replace' | 'skip') => {
        const newResolutions = new Map(resolutions);
        newResolutions.set(groupId, resolution);
        setResolutions(newResolutions);
    };

    const handleSubmit = () => {
        onResolve(resolutions);
        onClose();
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-dark-900 rounded-2xl shadow-2xl w-full max-w-3xl max-h-[80vh] flex flex-col border border-dark-700">
                {/* Header */}
                <div className="p-6 border-b border-dark-700">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-accent-warning/10 rounded-lg">
                                <AlertTriangle className="w-6 h-6 text-accent-warning" />
                            </div>
                            <div>
                                <h2 className="text-xl font-semibold text-dark-100">Import Conflicts Detected</h2>
                                <p className="text-sm text-dark-400 mt-1">
                                    {conflicts.length} group{conflicts.length > 1 ? 's' : ''} with the same name already exists with items
                                </p>
                            </div>
                        </div>
                        <button
                            onClick={onClose}
                            className="p-2 hover:bg-dark-800 rounded-lg transition-colors"
                        >
                            <X className="w-5 h-5 text-dark-400" />
                        </button>
                    </div>
                </div>

                {/* Conflicts List */}
                <div className="flex-1 overflow-y-auto p-6 space-y-4">
                    {conflicts.map((conflict) => {
                        const resolution = resolutions.get(conflict.importedGroup.id) || 'merge';

                        return (
                            <div
                                key={conflict.importedGroup.id}
                                className="p-4 bg-dark-800/50 rounded-xl border border-dark-700"
                            >
                                <div className="mb-3">
                                    <h3 className="font-medium text-dark-100 mb-1">{conflict.importedGroup.name}</h3>
                                    <p className="text-sm text-dark-400">
                                        Existing group has {conflict.existingItemCount} item{conflict.existingItemCount !== 1 ? 's' : ''}
                                    </p>
                                </div>

                                <div className="grid grid-cols-3 gap-2">
                                    <button
                                        onClick={() => handleResolutionChange(conflict.importedGroup.id, 'merge')}
                                        className={`p-3 rounded-lg border transition-all ${resolution === 'merge'
                                            ? 'bg-accent-primary/20 border-accent-primary text-accent-primary'
                                            : 'bg-dark-800 border-dark-600 text-dark-300 hover:border-dark-500'
                                            }`}
                                    >
                                        <Merge className="w-5 h-5 mx-auto mb-1" />
                                        <div className="text-xs font-medium">Merge</div>
                                        <div className="text-xs opacity-70 mt-0.5">Add items to existing</div>
                                    </button>

                                    <button
                                        onClick={() => handleResolutionChange(conflict.importedGroup.id, 'replace')}
                                        className={`p-3 rounded-lg border transition-all ${resolution === 'replace'
                                            ? 'bg-accent-warning/20 border-accent-warning text-accent-warning'
                                            : 'bg-dark-800 border-dark-600 text-dark-300 hover:border-dark-500'
                                            }`}
                                    >
                                        <Replace className="w-5 h-5 mx-auto mb-1" />
                                        <div className="text-xs font-medium">Replace</div>
                                        <div className="text-xs opacity-70 mt-0.5">Delete existing items</div>
                                    </button>

                                    <button
                                        onClick={() => handleResolutionChange(conflict.importedGroup.id, 'skip')}
                                        className={`p-3 rounded-lg border transition-all ${resolution === 'skip'
                                                ? 'bg-dark-500/20 border-dark-500 text-dark-300'
                                                : 'bg-dark-800 border-dark-600 text-dark-300 hover:border-dark-500'
                                            }`}
                                    >
                                        <SkipForward className="w-5 h-5 mx-auto mb-1" />
                                        <div className="text-xs font-medium">Skip</div>
                                        <div className="text-xs opacity-70 mt-0.5">Don't import this group</div>
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* Footer */}
                <div className="p-6 border-t border-dark-700 flex items-center justify-between">
                    <div className="text-sm text-dark-400">
                        💡 Empty groups with the same name will be automatically overwritten
                    </div>
                    <div className="flex gap-3">
                        <button onClick={onClose} className="btn-secondary">
                            Cancel
                        </button>
                        <button onClick={handleSubmit} className="btn-primary">
                            Apply Resolutions
                        </button>
                    </div>
                </div>
            </div>
        </div >
    );
};
