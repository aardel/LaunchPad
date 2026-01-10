import { X, AlertTriangle } from 'lucide-react';
import { useState } from 'react';

interface VaultResetModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => Promise<void>;
}

export function VaultResetModal({ isOpen, onClose, onConfirm }: VaultResetModalProps) {
    const [confirmText, setConfirmText] = useState('');
    const [isResetting, setIsResetting] = useState(false);

    if (!isOpen) return null;

    const handleConfirm = async () => {
        setIsResetting(true);
        try {
            await onConfirm();
            setConfirmText('');
            onClose();
        } catch (error) {
            console.error('Reset failed:', error);
        } finally {
            setIsResetting(false);
        }
    };

    const handleClose = () => {
        if (!isResetting) {
            setConfirmText('');
            onClose();
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[300] p-4">
            <div className="bg-dark-900 rounded-2xl shadow-2xl w-full max-w-lg border border-dark-700">
                <div className="flex items-center justify-between p-6 border-b border-dark-800">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-red-500/10 rounded-lg">
                            <AlertTriangle className="w-6 h-6 text-red-500" />
                        </div>
                        <h2 className="text-xl font-semibold text-dark-100">Reset Vault</h2>
                    </div>
                    <button
                        onClick={handleClose}
                        disabled={isResetting}
                        className="p-2 rounded-lg text-dark-400 hover:text-dark-100 hover:bg-dark-800 transition-colors disabled:opacity-50"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="p-6 space-y-4">
                    <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4">
                        <p className="text-sm text-red-400 font-medium mb-2">⚠️ Warning: This action cannot be undone!</p>
                        <p className="text-sm text-dark-300">
                            Resetting your vault will permanently delete all encrypted passwords. You will not be able to recover them.
                        </p>
                    </div>

                    <div className="space-y-2">
                        <div className="bg-dark-800 rounded-lg p-4">
                            <p className="text-sm font-medium text-dark-200 mb-2">❌ Will be deleted:</p>
                            <ul className="text-sm text-dark-400 space-y-1 list-disc list-inside">
                                <li>All saved passwords for bookmarks</li>
                                <li>All SSH connection passwords</li>
                                <li>All standalone password entries</li>
                                <li>Vault encryption settings</li>
                            </ul>
                        </div>

                        <div className="bg-dark-800 rounded-lg p-4">
                            <p className="text-sm font-medium text-dark-200 mb-2">✅ Will be preserved:</p>
                            <ul className="text-sm text-dark-400 space-y-1 list-disc list-inside">
                                <li>Item names and descriptions</li>
                                <li>URLs and host addresses</li>
                                <li>SSH keys and usernames</li>
                                <li>Tags and groups</li>
                                <li>All application settings</li>
                            </ul>
                        </div>
                    </div>

                    <div>
                        <label className="input-label">
                            Type <span className="font-mono font-bold text-red-400">DELETE</span> to confirm
                        </label>
                        <input
                            type="text"
                            value={confirmText}
                            onChange={(e) => setConfirmText(e.target.value)}
                            placeholder="Type DELETE"
                            className="input-base"
                            disabled={isResetting}
                            autoFocus
                        />
                    </div>
                </div>

                <div className="flex gap-3 p-6 border-t border-dark-800">
                    <button
                        onClick={handleClose}
                        disabled={isResetting}
                        className="btn-secondary flex-1"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleConfirm}
                        disabled={confirmText !== 'DELETE' || isResetting}
                        className="btn-danger flex-1 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isResetting ? 'Resetting...' : 'Reset Vault'}
                    </button>
                </div>
            </div>
        </div>
    );
}
