import React from 'react';
import { Search, X, Filter, Tag, Folder, Network } from 'lucide-react';
import { useStore } from '../../store/useStore';
import type { ItemType, NetworkProfile } from '@shared/types';

export const EnhancedSearchBar: React.FC = () => {
    const { searchQuery, setSearchQuery, searchFilters, setSearchFilter, clearSearchFilters, groups } = useStore();
    const [isFiltersOpen, setIsFiltersOpen] = React.useState(false);

    const hasActiveFilters = searchFilters.type || searchFilters.groupId || searchFilters.profile || searchFilters.tags.length > 0;

    const itemTypes: { value: ItemType; label: string }[] = [
        { value: 'bookmark', label: '🔖 Bookmark' },
        { value: 'ssh', label: '🔒 SSH' },
        { value: 'app', label: '🚀 App' },
        { value: 'password', label: '🔑 Password' },
    ];

    const profiles: { value: NetworkProfile; label: string }[] = [
        { value: 'local', label: 'Local' },
        { value: 'tailscale', label: 'Tailscale' },
        { value: 'vpn', label: 'VPN' },
        { value: 'custom', label: 'Custom' },
    ];

    return (
        <div className="space-y-3">
            {/* Main Search Input */}
            <div className="flex gap-2">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-dark-400" />
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search items (fuzzy search enabled)..."
                        className="w-full pl-10 pr-10 py-2.5 bg-dark-800 border border-dark-700 rounded-lg text-dark-100 placeholder-dark-500 focus:outline-none focus:border-accent-primary transition-colors"
                    />
                    {searchQuery && (
                        <button
                            onClick={() => setSearchQuery('')}
                            className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-dark-400 hover:text-dark-100 rounded transition-colors"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    )}
                </div>

                <button
                    onClick={() => setIsFiltersOpen(!isFiltersOpen)}
                    className={`px-3 py-2.5 rounded-lg border transition-all duration-200 flex items-center gap-2
                        ${isFiltersOpen || hasActiveFilters
                            ? 'bg-dark-800 border-accent-primary text-accent-primary'
                            : 'bg-dark-800 border-dark-700 text-dark-400 hover:text-dark-200'}`}
                    title="Toggle Filters"
                >
                    <Filter className="w-4 h-4" />
                    {(isFiltersOpen || hasActiveFilters) && <span className="text-xs font-medium">Filters</span>}
                </button>
            </div>

            {/* Filter Chips - Collapsible */}
            {isFiltersOpen && (
                <div className="flex items-center gap-2 flex-wrap animate-slide-down">
                    {/* Type Filter */}
                    <div className="relative">
                        <select
                            value={searchFilters.type || ''}
                            onChange={(e) => setSearchFilter('type', e.target.value || null)}
                            className="pl-8 pr-8 py-1.5 bg-dark-800 border border-dark-700 rounded-lg text-xs text-dark-200 focus:outline-none focus:border-accent-primary appearance-none cursor-pointer"
                        >
                            <option value="">All Types</option>
                            {itemTypes.map((type) => (
                                <option key={type.value} value={type.value}>
                                    {type.label}
                                </option>
                            ))}
                        </select>
                        <Tag className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-dark-400 pointer-events-none" />
                    </div>

                    {/* Group Filter */}
                    <div className="relative">
                        <select
                            value={searchFilters.groupId || ''}
                            onChange={(e) => setSearchFilter('groupId', e.target.value || null)}
                            className="pl-8 pr-8 py-1.5 bg-dark-800 border border-dark-700 rounded-lg text-xs text-dark-200 focus:outline-none focus:border-accent-primary appearance-none cursor-pointer"
                        >
                            <option value="">All Groups</option>
                            {groups.map((group) => (
                                <option key={group.id} value={group.id}>
                                    {group.icon} {group.name}
                                </option>
                            ))}
                        </select>
                        <Folder className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-dark-400 pointer-events-none" />
                    </div>

                    {/* Profile Filter */}
                    <div className="relative">
                        <select
                            value={searchFilters.profile || ''}
                            onChange={(e) => setSearchFilter('profile', e.target.value || null)}
                            className="pl-8 pr-8 py-1.5 bg-dark-800 border border-dark-700 rounded-lg text-xs text-dark-200 focus:outline-none focus:border-accent-primary appearance-none cursor-pointer"
                        >
                            <option value="">All Profiles</option>
                            {profiles.map((profile) => (
                                <option key={profile.value} value={profile.value}>
                                    {profile.label}
                                </option>
                            ))}
                        </select>
                        <Network className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-dark-400 pointer-events-none" />
                    </div>

                    {/* Clear Filters */}
                    {hasActiveFilters && (
                        <button
                            onClick={clearSearchFilters}
                            className="px-3 py-1.5 text-xs bg-dark-800 border border-dark-700 rounded-lg text-dark-400 hover:text-dark-100 hover:border-accent-danger transition-colors"
                        >
                            Clear Filters
                        </button>
                    )}
                </div>
            )}
        </div>
    );
};
