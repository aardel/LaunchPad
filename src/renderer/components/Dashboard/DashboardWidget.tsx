import React, { useState, useEffect } from 'react';
import { useStore } from '../../store/useStore';
import { Activity, X, Minimize2, Maximize2 } from 'lucide-react';
import type { ServiceMetrics } from '@shared/types';

export const DashboardWidget: React.FC = () => {
    const [isExpanded, setIsExpanded] = useState(false);
    const [isVisible, setIsVisible] = useState(false);
    const { dashboardMetrics, isDashboardMonitoring, startDashboardMonitoring, stopDashboardMonitoring } = useStore();

    useEffect(() => {
        // Auto-start monitoring when widget is visible
        if (isVisible && !isDashboardMonitoring) {
            startDashboardMonitoring();
        }
        return () => {
            if (isDashboardMonitoring) {
                stopDashboardMonitoring();
            }
        };
    }, [isVisible]);

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'up': return 'bg-accent-success';
            case 'down': return 'bg-accent-danger';
            case 'degraded': return 'bg-accent-warning';
            default: return 'bg-dark-500';
        }
    };

    const formatResponseTime = (ms: number) => {
        if (ms < 1000) return `${ms}ms`;
        return `${(ms / 1000).toFixed(2)}s`;
    };

    if (!isVisible) {
        // Collapsed fab button
        return (
            <button
                onClick={() => setIsVisible(true)}
                className="fixed bottom-6 right-6 z-[90] p-4 rounded-full bg-gradient-to-r from-accent-primary to-purple-600 shadow-2xl hover:shadow-purple-500/50 transition-all hover:scale-110"
                title="Open Dashboard"
            >
                <Activity className="w-6 h-6 text-white" />
            </button>
        );
    }

    return (
        <div
            className={`fixed bottom-6 right-6 z-[90] bg-dark-900/95 backdrop-blur-xl border border-dark-700 rounded-2xl shadow-2xl transition-all duration-300 flex flex-col overflow-hidden ${isExpanded ? 'w-[480px] max-h-[600px]' : 'w-80 max-h-96'
                }`}
        >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-dark-700">
                <div className="flex items-center gap-2">
                    <Activity className="w-5 h-5 text-accent-primary" />
                    <h3 className="font-semibold text-dark-100">Service Monitor</h3>
                    {isDashboardMonitoring && (
                        <div className="w-2 h-2 rounded-full bg-accent-success animate-pulse" />
                    )}
                </div>
                <div className="flex items-center gap-1">
                    <button
                        onClick={() => setIsExpanded(!isExpanded)}
                        className="p-2 rounded-lg text-dark-400 hover:text-dark-100 hover:bg-dark-800 transition-colors"
                    >
                        {isExpanded ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                    </button>
                    <button
                        onClick={() => setIsVisible(false)}
                        className="p-2 rounded-lg text-dark-400 hover:text-dark-100 hover:bg-dark-800 transition-colors"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>
            </div>

            {/* Content */}
            <div className="p-4 space-y-3 overflow-y-auto flex-1 min-h-0 custom-scrollbar">
                {dashboardMetrics.length === 0 ? (
                    <div className="text-center py-8 text-dark-500">
                        <Activity className="w-12 h-12 mx-auto mb-3 opacity-50" />
                        <p className="text-sm">No services to monitor</p>
                        <p className="text-xs mt-1">Add bookmarks to see their status</p>
                    </div>
                ) : (
                    dashboardMetrics.map((metric: ServiceMetrics) => (
                        <div
                            key={metric.itemId}
                            className="p-3 bg-dark-800/50 rounded-xl border border-dark-700/50 hover:border-dark-600 transition-colors"
                        >
                            <div className="flex items-start justify-between mb-2">
                                <div className="flex-1">
                                    <div className="flex items-center gap-2">
                                        <div className={`w-2 h-2 rounded-full ${getStatusColor(metric.currentStatus)}`} />
                                        <h4 className="font-medium text-dark-100 text-sm truncate">{metric.itemName}</h4>
                                    </div>
                                    <div className="flex items-center gap-3 mt-1 text-xs text-dark-400">
                                        <span>{formatResponseTime(metric.responseTime)}</span>
                                        <span>•</span>
                                        <span>{metric.uptime.toFixed(1)}% uptime</span>
                                    </div>
                                </div>
                            </div>

                            {isExpanded && metric.history.length > 0 && (
                                <div className="mt-2 h-12">
                                    <MiniSparkline data={metric.history.map(d => d.responseTime)} />
                                </div>
                            )}
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};

// Simple sparkline component
const MiniSparkline: React.FC<{ data: number[] }> = ({ data }) => {
    if (data.length === 0) return null;

    const max = Math.max(...data);
    const min = Math.min(...data);
    const range = max - min || 1;

    const points = data.map((value, index) => {
        const x = (index / (data.length - 1)) * 100;
        const y = 100 - ((value - min) / range) * 100;
        return `${x},${y}`;
    }).join(' ');

    return (
        <svg viewBox="0 0 100 100" className="w-full h-full" preserveAspectRatio="none">
            <polyline
                points={points}
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                className="text-accent-primary"
            />
        </svg>
    );
};
