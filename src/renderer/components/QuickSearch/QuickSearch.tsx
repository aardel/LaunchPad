import React, { useState, useEffect, useRef } from 'react';
import { useStore } from '../../store/useStore';
import { Search, Globe, Terminal, Laptop, Key, Command } from 'lucide-react';

export function QuickSearch() {
    const { items, recentItems, launchItem, loadData, loadRecentItems } = useStore();
    const [query, setQuery] = useState('');
    const [selectedIndex, setSelectedIndex] = useState(0);
    const inputRef = useRef<HTMLInputElement>(null);
    const scrollRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        loadData();
        loadRecentItems();
        // Use a small timeout to ensure the window is fully ready and focused
        const timer = setTimeout(() => {
            inputRef.current?.focus();
        }, 50);
        return () => clearTimeout(timer);
    }, [loadData, loadRecentItems]);

    // Determine which items to show: search results or recent items
    const isSearching = query.trim().length > 0;

    const displayItems = isSearching
        ? items.filter(item => {
            const q = query.toLowerCase();
            return (
                item.name.toLowerCase().includes(q) ||
                item.description?.toLowerCase().includes(q) ||
                item.tags.some(tag => tag.toLowerCase().includes(q))
            );
        }).slice(0, 8)
        : recentItems.slice(0, 8);

    useEffect(() => {
        setSelectedIndex(0);
    }, [query, displayItems.length]);

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setSelectedIndex(prev => (prev + 1) % Math.max(1, displayItems.length));
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setSelectedIndex(prev => (prev - 1 + displayItems.length) % Math.max(1, displayItems.length));
        } else if (e.key === 'Enter') {
            if (displayItems[selectedIndex]) {
                handleLaunch(displayItems[selectedIndex]);
            }
        } else if (e.key === 'Escape') {
            window.api.quickSearch.hide();
        }
    };

    const handleLaunch = async (item: any) => {
        await launchItem(item);
        // Refresh recent items after launching
        setTimeout(() => loadRecentItems(), 500);
    };

    const getItemIcon = (type: string) => {
        switch (type) {
            case 'bookmark': return <Globe className="w-4 h-4" />;
            case 'ssh': return <Terminal className="w-4 h-4" />;
            case 'app': return <Laptop className="w-4 h-4" />;
            case 'password': return <Key className="w-4 h-4" />;
            default: return <Globe className="w-4 h-4" />;
        }
    };

    return (
        <div className="flex flex-col h-full bg-dark-950/90 backdrop-blur-xl border border-dark-700/50 rounded-xl overflow-hidden shadow-2xl">
            <div className="flex items-center px-4 py-3 border-b border-dark-700/50">
                <Search className="w-5 h-5 text-dark-400 mr-3" />
                <input
                    ref={inputRef}
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Search LaunchIt..."
                    className="flex-1 bg-transparent border-none outline-none text-lg text-dark-100 placeholder:text-dark-500"
                />
                <div className="flex items-center gap-1.5 px-1.5 py-0.5 rounded border border-dark-700 bg-dark-800/50 text-dark-500 text-[10px] font-medium uppercase tracking-wider">
                    <Command className="w-2.5 h-2.5" />
                    <span>Quick Launcher</span>
                </div>
            </div>

            <div ref={scrollRef} className="flex-1 overflow-y-auto p-2 space-y-1">
                {!isSearching && displayItems.length > 0 && (
                    <div className="px-3 py-1.5 text-[10px] font-bold text-dark-500 uppercase tracking-widest">
                        Recently Used
                    </div>
                )}

                {displayItems.length > 0 ? (
                    displayItems.map((item, index) => (
                        <div
                            key={item.id}
                            onClick={() => handleLaunch(item)}
                            onMouseEnter={() => setSelectedIndex(index)}
                            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer transition-all duration-200 ${index === selectedIndex
                                ? 'bg-accent-primary/20 border border-accent-primary/30 text-dark-100 shadow-glow-sm scale-[1.01]'
                                : 'text-dark-300 hover:bg-dark-800'
                                }`}
                        >
                            <div className={`p-1.5 rounded-md ${index === selectedIndex ? 'bg-accent-primary text-white' : 'bg-dark-800 text-dark-400'
                                }`}>
                                {getItemIcon(item.type)}
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="font-medium truncate">{item.name}</div>
                                {item.description && (
                                    <div className={`text-xs truncate ${index === selectedIndex ? 'text-dark-200' : 'text-dark-500'}`}>
                                        {item.description}
                                    </div>
                                )}
                            </div>
                            <div className="text-[10px] font-medium uppercase tracking-wider text-dark-500 px-1.5 py-0.5 rounded bg-dark-900 border border-dark-700">
                                {item.type}
                            </div>
                        </div>
                    ))
                ) : (
                    <div className="flex flex-col items-center justify-center py-12 text-dark-500">
                        <Search className="w-8 h-8 mb-3 opacity-20" />
                        <p className="text-sm">No items found matching "{query}"</p>
                    </div>
                )}
            </div>

            <div className="px-4 py-2 bg-dark-900/50 border-t border-dark-800 flex items-center justify-between text-[10px] font-medium text-dark-500 uppercase tracking-widest">
                <div className="flex gap-4">
                    <span className="flex items-center gap-1.5">
                        <span className="px-1 py-0.5 rounded bg-dark-800 border border-dark-700">↑↓</span> Navigate
                    </span>
                    <span className="flex items-center gap-1.5">
                        <span className="px-1 py-0.5 rounded bg-dark-800 border border-dark-700">Enter</span> Launch
                    </span>
                </div>
                <div className="flex gap-4">
                    <span className="flex items-center gap-1.5">
                        <span className="px-1 py-0.5 rounded bg-dark-800 border border-dark-700">ESC</span> Close
                    </span>
                </div>
            </div>
        </div>
    );
}
