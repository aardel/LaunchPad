import React, { useState, useEffect } from 'react';

interface KeyboardShortcutRecorderProps {
    value: string;
    onChange: (shortcut: string) => void;
    label: string;
}

// Common system shortcuts that should show warnings
const SYSTEM_SHORTCUTS = [
    'Meta+Q', // Quit
    'Meta+W', // Close window
    'Meta+T', // New tab (browser)
    'Meta+Tab', // Switch apps
    'Meta+Space', // Spotlight
    'Meta+C', // Copy
    'Meta+V', // Paste
    'Meta+X', // Cut
    'Meta+Z', // Undo
    'Meta+Shift+Z', // Redo
    'Meta+A', // Select all
    'Meta+S', // Save
    'Meta+P', // Print
    'Meta+O', // Open
    'Meta+H', // Hide window
    'Meta+M', // Minimize
];

export const KeyboardShortcutRecorder: React.FC<KeyboardShortcutRecorderProps> = ({
    value,
    onChange,
    label,
}) => {
    const [isRecording, setIsRecording] = useState(false);
    const [pressedKeys, setPressedKeys] = useState<Set<string>>(new Set());
    const [hasConflict, setHasConflict] = useState(false);

    useEffect(() => {
        // Check for system conflicts when value changes
        setHasConflict(SYSTEM_SHORTCUTS.includes(value));
    }, [value]);

    useEffect(() => {
        if (!isRecording) return;

        const handleKeyDown = (e: KeyboardEvent) => {
            e.preventDefault();
            e.stopPropagation();

            const keys = new Set(pressedKeys);

            // Add modifiers
            if (e.metaKey || e.ctrlKey) keys.add(navigator.platform.includes('Mac') ? 'Meta' : 'Ctrl');
            if (e.shiftKey) keys.add('Shift');
            if (e.altKey) keys.add('Alt');

            // Add the actual key (not modifier)
            if (!['Meta', 'Control', 'Shift', 'Alt'].includes(e.key)) {
                keys.add(e.key.toUpperCase());
            }

            setPressedKeys(keys);
        };

        const handleKeyUp = (e: KeyboardEvent) => {
            e.preventDefault();
            e.stopPropagation();

            // When keys are released, construct the shortcut string
            if (pressedKeys.size > 0) {
                const modifiers: string[] = [];
                const regularKeys: string[] = [];

                pressedKeys.forEach(key => {
                    if (['Meta', 'Ctrl', 'Shift', 'Alt'].includes(key)) {
                        modifiers.push(key);
                    } else {
                        regularKeys.push(key);
                    }
                });

                // Sort modifiers in standard order
                const order = ['Ctrl', 'Alt', 'Shift', 'Meta'];
                modifiers.sort((a, b) => order.indexOf(a) - order.indexOf(b));

                const shortcut = [...modifiers, ...regularKeys].join('+');
                onChange(shortcut);
                setIsRecording(false);
                setPressedKeys(new Set());
            }
        };

        window.addEventListener('keydown', handleKeyDown, true);
        window.addEventListener('keyup', handleKeyUp, true);

        return () => {
            window.removeEventListener('keydown', handleKeyDown, true);
            window.removeEventListener('keyup', handleKeyUp, true);
        };
    }, [isRecording, pressedKeys, onChange]);

    const formatShortcut = (shortcut: string) => {
        if (!shortcut) return 'Not set';

        // Replace Meta with ⌘ on Mac, Ctrl on others
        const isMac = navigator.platform.includes('Mac');
        return shortcut
            .replace('Meta', isMac ? '⌘' : 'Ctrl')
            .replace('Ctrl', isMac ? '⌃' : 'Ctrl')
            .replace('Alt', isMac ? '⌥' : 'Alt')
            .replace('Shift', isMac ? '⇧' : 'Shift')
            .replace(/\+/g, ' + ');
    };

    const displayValue = isRecording
        ? pressedKeys.size > 0
            ? Array.from(pressedKeys).join('+')
            : 'Press keys...'
        : formatShortcut(value);

    return (
        <div className="flex items-center justify-between p-3 bg-dark-800/50 rounded-xl border border-dark-700/50">
            <div className="flex-1">
                <p className="text-sm font-medium text-dark-100">{label}</p>
                {hasConflict && (
                    <p className="text-xs text-accent-warning mt-1">
                        ⚠️ May conflict with system shortcut
                    </p>
                )}
            </div>
            <div className="flex items-center gap-2">
                <kbd className={`px-3 py-1.5 rounded-lg border text-sm font-mono min-w-[120px] text-center ${isRecording
                        ? 'bg-accent-primary/20 border-accent-primary text-accent-primary animate-pulse'
                        : hasConflict
                            ? 'bg-accent-warning/10 border-accent-warning/30 text-dark-200'
                            : 'bg-dark-800 border-dark-700 text-dark-200'
                    }`}>
                    {displayValue}
                </kbd>
                <button
                    onClick={() => {
                        setIsRecording(!isRecording);
                        if (isRecording) {
                            setPressedKeys(new Set());
                        }
                    }}
                    className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${isRecording
                            ? 'bg-accent-danger text-white hover:bg-accent-danger/80'
                            : 'bg-dark-700 text-dark-200 hover:bg-dark-600'
                        }`}
                >
                    {isRecording ? 'Cancel' : 'Record'}
                </button>
            </div>
        </div>
    );
};
