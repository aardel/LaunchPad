import { useState, useEffect } from 'react';
import { X, Globe, RefreshCw, FolderPlus, Server, Wifi, Activity, Database, AlertCircle, Network } from 'lucide-react';
import { NetworkShare } from '@shared/types';
import { useStore } from '../../store/useStore';
import { AddItemModal } from './AddItemModal';

interface NetworkExplorerModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export function NetworkExplorerModal({ isOpen, onClose }: NetworkExplorerModalProps) {
    const [isScanning, setIsScanning] = useState(false);
    const [shares, setShares] = useState<NetworkShare[]>([]);
    const [selectedShare, setSelectedShare] = useState<NetworkShare | null>(null);
    const [isAddItemOpen, setIsAddItemOpen] = useState(false);
    const [selectedService, setSelectedService] = useState<{ port: number, protocol: string } | null>(null);

    // Custom Scan State
    const [scanTarget, setScanTarget] = useState<NetworkShare | null>(null);
    const [customPorts, setCustomPorts] = useState('');
    const [scanResult, setScanResult] = useState<{ found: number[], target: string } | null>(null);

    // Service Selection State (for adding)
    const [shareToSelectService, setShareToSelectService] = useState<NetworkShare | null>(null);

    const [error, setError] = useState<string | null>(null);

    const [scanningHosts, setScanningHosts] = useState<Set<string>>(new Set());

    const { groups } = useStore();

    useEffect(() => {
        if (isOpen) {
            startScan();
        } else {
            stopScan();
        }
        return () => {
            stopScan();
        };
    }, [isOpen]);

    const startScan = async () => {
        setIsScanning(true);
        setError(null);
        setShares([]); // Clear previous results
        try {
            // Start a scan for 5 seconds
            const res = await window.api.network.scan(5000);
            if (res.success && res.data) {
                setShares(res.data);
            } else {
                setError(res.error || 'Failed to scan network');
            }
        } catch (err) {
            setError('An error occurred during scanning');
        } finally {
            setIsScanning(false);
        }
    };

    const stopScan = async () => {
        await window.api.network.stopScan();
        setIsScanning(false);
    };

    const handleScanClick = (e: React.MouseEvent, share: NetworkShare) => {
        e.stopPropagation();
        setScanTarget(share);
        setCustomPorts(''); // Reset
    };

    const performCustomScan = async () => {
        if (!scanTarget) return;
        const target = scanTarget.address || scanTarget.host;

        let portsToScan: number[] | 'deep' = 'deep';

        if (customPorts.trim()) {
            // Validate format: only allow numbers, commas, spaces, dashes
            if (!/^[0-9,\-\s]+$/.test(customPorts)) {
                setError('Invalid port format. Use numbers, commas (,) and dashes (-) only.');
                return;
            }

            // Parse ports: "80, 443, 8000-8010"
            const parsed: number[] = [];
            const parts = customPorts.split(',');
            for (const part of parts) {
                const trimmed = part.trim();
                if (!trimmed) continue;

                if (trimmed.includes('-')) {
                    const [start, end] = trimmed.split('-').map(Number);
                    if (!isNaN(start) && !isNaN(end) && start > 0 && end <= 65535 && start <= end) {
                        for (let i = start; i <= end; i++) parsed.push(i);
                    }
                } else {
                    const p = Number(trimmed);
                    if (!isNaN(p) && p > 0 && p <= 65535) parsed.push(p);
                }
            }
            if (parsed.length > 0) {
                portsToScan = parsed;
            } else {
                setError('No valid ports specified.');
                return;
            }
        }

        setScanTarget(null); // Close modal
        setError(null);

        if (scanningHosts.has(target)) return;

        setScanningHosts(prev => {
            const next = new Set(prev);
            next.add(target);
            return next;
        });

        try {
            const res = await window.api.network.scanPorts(target, portsToScan);

            if (res.success && Array.isArray(res.data)) {
                // Show result feedback regardless of count (0 is a valid result)
                setScanResult({ found: res.data, target });

                // Update share with open ports - MERGE with existing
                if (res.data.length > 0) {
                    setShares(prev => prev.map(s => {
                        if (s.address === target || s.host === target) {
                            const existing = new Set(s.openPorts || []);
                            res.data.forEach((p: number) => existing.add(p));
                            return { ...s, openPorts: Array.from(existing).sort((a, b) => a - b) };
                        }
                        return s;
                    }));
                }
            } else {
                setError('Port scan returned invalid response');
            }
        } catch (err) {
            console.error('Failed to scan ports:', err);
            setError('Failed to execute port scan');
        } finally {
            setScanningHosts(prev => {
                const next = new Set(prev);
                next.delete(target);
                return next;
            });
        }
    };

    const handleAddShare = (share: NetworkShare) => {
        // If multiple ports found, ask user which one to use
        if (share.openPorts && share.openPorts.length > 1) {
            setShareToSelectService(share);
            return;
        }

        // Default logic if 0 or 1 port
        let port = 0;
        let protocol: string = share.type;

        if (share.openPorts && share.openPorts.length === 1) {
            port = share.openPorts[0];
            // Infer protocol from port if 'other'
            if (port === 22) protocol = 'ssh';
            else if (port === 80 || port === 443) protocol = 'http';
            else if (port === 445) protocol = 'smb';
            else if (port === 5900) protocol = 'vnc';
        }

        setSelectedService(port ? { port, protocol } : null);
        setSelectedShare(share);
        setIsAddItemOpen(true);
    };

    const handleServiceSelect = (port: number, protocol: string) => {
        if (!shareToSelectService) return;
        setSelectedService({ port, protocol });
        setSelectedShare(shareToSelectService);
        setShareToSelectService(null);
        setIsAddItemOpen(true);
    };

    const handleOpenPort = async (share: NetworkShare, port: number) => {
        const target = share.address || share.host;
        const { launchItem } = useStore.getState();

        if (port === 22) {
            // Create temporary SSH item
            const sshItem: any = {
                id: `temp-${Date.now()}`,
                type: 'ssh',
                name: share.name,
                username: '', // Let terminal prompt or use default
                port: 22,
                networkAddresses: { local: target },
                groupId: 'temp',
                tags: [],
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                accessCount: 0,
                sortOrder: 0
            };
            await launchItem(sshItem);
        } else {
            // Create temporary bookmark item with correct protocol
            let protocol = 'http';
            if (port === 21) protocol = 'ftp';
            else if (port === 443) protocol = 'https';
            else if (port === 445) protocol = 'smb';
            else if (port === 548) protocol = 'afp';
            else if (port === 3389) protocol = 'rdp';
            else if (port === 5900) protocol = 'vnc';
            else if (port === 8080) protocol = 'http';

            const bookmarkItem: any = {
                id: `temp-${Date.now()}`,
                type: 'bookmark',
                name: share.name,
                protocol: protocol,
                port: port,
                networkAddresses: { local: target },
                groupId: 'temp',
                tags: [],
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                accessCount: 0,
                sortOrder: 0
            };
            await launchItem(bookmarkItem);
        }
    };

    const getPortDisplay = (port: number) => {
        let label = port.toString();
        let classes = 'bg-dark-700/50 text-dark-400 border-dark-700 hover:bg-dark-600 hover:text-dark-200';

        if (port === 21) { label = 'FTP (21)'; classes = 'bg-gray-500/10 text-gray-400 border-gray-500/20 hover:bg-gray-500/30 hover:text-gray-200 hover:border-gray-500/40'; }
        else if (port === 22) { label = 'SSH (22)'; classes = 'bg-orange-500/10 text-orange-400 border-orange-500/20 hover:bg-orange-500/30 hover:text-orange-200 hover:border-orange-500/40'; }
        else if (port === 80) { label = 'HTTP (80)'; classes = 'bg-blue-500/10 text-blue-400 border-blue-500/20 hover:bg-blue-500/30 hover:text-blue-200 hover:border-blue-500/40'; }
        else if (port === 443) { label = 'HTTPS (443)'; classes = 'bg-blue-500/10 text-blue-400 border-blue-500/20 hover:bg-blue-500/30 hover:text-blue-200 hover:border-blue-500/40'; }
        else if (port === 445) { label = 'SMB (445)'; classes = 'bg-blue-500/10 text-blue-400 border-blue-500/20 hover:bg-blue-500/30 hover:text-blue-200 hover:border-blue-500/40'; }
        else if (port === 548) { label = 'AFP (548)'; classes = 'bg-purple-500/10 text-purple-400 border-purple-500/20 hover:bg-purple-500/30 hover:text-purple-200 hover:border-purple-500/40'; }
        else if (port === 3389) { label = 'RDP (3389)'; classes = 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20 hover:bg-indigo-500/30 hover:text-indigo-200 hover:border-indigo-500/40'; }
        else if (port === 5900) { label = 'VNC (5900)'; classes = 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20 hover:bg-indigo-500/30 hover:text-indigo-200 hover:border-indigo-500/40'; }
        else if (port === 8080) { label = 'HTTP (8080)'; classes = 'bg-blue-500/10 text-blue-400 border-blue-500/20 hover:bg-blue-500/30 hover:text-blue-200 hover:border-blue-500/40'; }

        return { label, classes };
    };

    const getProtocolIcon = (type: string) => {
        switch (type) {
            case 'smb': return <FolderPlus className="w-5 h-5 text-blue-400" />;
            case 'afp': return <Server className="w-5 h-5 text-purple-400" />;
            case 'nfs': return <Database className="w-5 h-5 text-orange-400" />;
            default: return <Globe className="w-5 h-5 text-gray-400" />;
        }
    };

    const ProtocolBadge = ({ type }: { type: string }) => {
        const colors = {
            smb: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
            afp: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
            nfs: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
        };
        const style = colors[type as keyof typeof colors] || 'bg-gray-500/10 text-gray-400 border-gray-500/20';

        return (
            <span className={`px-2 py-0.5 rounded text-[10px] font-medium border ${style} uppercase`}>
                {type}
            </span>
        );
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
            <div className="w-[800px] h-[600px] bg-dark-900 rounded-2xl border border-dark-700 shadow-2xl flex flex-col overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-dark-800 bg-dark-850/50">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-accent-primary/10 rounded-lg">
                            <Network className="w-5 h-5 text-accent-primary" />
                        </div>
                        <div>
                            <h2 className="text-lg font-semibold text-dark-100">Network Explorer</h2>
                            <p className="text-xs text-dark-400">Discover and map local network shares</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="text-dark-400 hover:text-dark-100 transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 flex flex-col p-6 overflow-hidden">
                    {/* Controls */}
                    <div className="flex items-center justify-between mb-4">
                        <div className="text-sm text-dark-300">
                            {isScanning ? (
                                <span className="flex items-center gap-2 text-accent-primary">
                                    <RefreshCw className="w-3 h-3 animate-spin" />
                                    Scanning local network...
                                </span>
                            ) : (
                                <span>Found {shares.length} devices</span>
                            )}
                        </div>
                        <button
                            onClick={startScan}
                            disabled={isScanning}
                            className="btn-secondary text-sm"
                        >
                            <RefreshCw className={`w-4 h-4 mr-2 ${isScanning ? 'animate-spin' : ''}`} />
                            {shares.length > 0 ? 'Rescan' : 'Scan'}
                        </button>
                    </div>

                    {/* Device List */}
                    <div className="flex-1 overflow-y-auto bg-dark-950/50 rounded-xl border border-dark-800/50 p-2">
                        {error ? (
                            <div className="flex flex-col items-center justify-center h-full text-center">
                                <Network className="w-12 h-12 text-accent-danger/50 mb-3" />
                                <p className="text-dark-200 font-medium">Scan failed</p>
                                <p className="text-sm text-dark-400 mt-1">{error}</p>
                            </div>
                        ) : shares.length === 0 && !isScanning ? (
                            <div className="flex flex-col items-center justify-center h-full text-center">
                                <Server className="w-12 h-12 text-dark-700 mb-3" />
                                <p className="text-dark-200 font-medium">No devices found</p>
                                <p className="text-sm text-dark-400 mt-1">Make sure you are connected to a network with discoverable devices.</p>
                            </div>
                        ) : (
                            <div className="space-y-1">
                                {shares.map((share) => (
                                    <div
                                        key={share.address || share.host}
                                        onClick={() => handleAddShare(share)}
                                        className="w-full flex items-center gap-3 p-3 bg-dark-800/20 hover:bg-dark-800 border-b border-dark-800 last:border-0 hover:rounded-xl transition-all text-left group cursor-pointer"
                                        role="button"
                                        tabIndex={0}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter' || e.key === ' ') {
                                                handleAddShare(share);
                                            }
                                        }}
                                    >
                                        <div className="p-2 bg-dark-900 rounded-lg group-hover:scale-105 transition-transform shrink-0">
                                            {getProtocolIcon(share.type)}
                                        </div>

                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 mb-0.5">
                                                <h4 className="font-medium text-dark-100 truncate">{share.name}</h4>
                                                <ProtocolBadge type={share.type} />
                                            </div>
                                            <p className="text-xs text-dark-400 truncate">
                                                {share.address && share.address !== share.host ? <span className="text-dark-300 font-mono mr-2">{share.address}</span> : null}
                                                <span className="opacity-70">{share.host}</span>
                                            </p>

                                            {/* Open Ports */}
                                            {share.openPorts && share.openPorts.length > 0 ? (
                                                <div className="flex items-center gap-1 mt-1.5 flex-wrap">
                                                    {share.openPorts.map(port => {
                                                        const { label, classes } = getPortDisplay(port);
                                                        return (
                                                            <button
                                                                key={port}
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    handleOpenPort(share, port);
                                                                }}
                                                                className={`text-[9px] px-1.5 py-0.5 rounded border transition-all cursor-pointer hover:scale-105 ${classes}`}
                                                                title={`Click to open ${label}`}
                                                            >
                                                                {label}
                                                            </button>
                                                        );
                                                    })}
                                                </div>
                                            ) : (
                                                share.openPorts && (
                                                    <p className="text-[10px] text-dark-500 mt-1.5 italic">No open ports found</p>
                                                )
                                            )}
                                        </div>

                                        <div className="flex items-center gap-2">
                                            <button
                                                onClick={(e) => handleScanClick(e, share)}
                                                className="p-1.5 rounded-lg text-dark-400 hover:text-accent-primary hover:bg-dark-700 transition-colors"
                                                title="Custom Port Scan"
                                                disabled={scanningHosts.has(share.address || share.host)}
                                            >
                                                {scanningHosts.has(share.address || share.host) ? (
                                                    <RefreshCw className="w-4 h-4 animate-spin text-accent-primary" />
                                                ) : (
                                                    <Activity className="w-4 h-4" />
                                                )}
                                            </button>
                                            <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                                                <span className="text-xs font-medium text-accent-primary bg-accent-primary/10 px-2 py-1 rounded">
                                                    Add
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {isAddItemOpen && selectedShare && (
                <AddItemModal
                    isOpen={isAddItemOpen}
                    onClose={() => setIsAddItemOpen(false)}
                    initialData={{
                        type: selectedService?.protocol === 'ssh' || selectedService?.protocol === 'vnc' ? 'app' : 'bookmark',
                        name: selectedShare.name,
                        protocol: (selectedService?.protocol || selectedShare.type) as any,
                        path: '',
                        port: selectedService?.port || undefined,
                        networkAddresses: {
                            local: selectedShare.address || selectedShare.host // Use valid address
                        },
                        groupId: groups[0]?.id // Default to first group
                    }}
                />
            )}
            {/* Custom Scan Modal */}
            {scanTarget && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={() => setScanTarget(null)}>
                    <div className="bg-dark-900 p-4 rounded-xl border border-dark-700 w-80 shadow-xl" onClick={e => e.stopPropagation()}>
                        <h3 className="text-dark-100 font-medium mb-2">Scan Ports</h3>
                        <p className="text-xs text-dark-400 mb-3">
                            Enter ports or ranges (e.g. 80, 443, 8000-8080).
                            Leave empty for deep scan.
                        </p>
                        <input
                            type="text"
                            className="w-full bg-dark-950 border border-dark-700 rounded-lg px-3 py-2 text-dark-100 text-sm mb-4 focus:ring-1 focus:ring-accent-primary outline-none"
                            placeholder="e.g. 80, 8080-8090"
                            value={customPorts}
                            onChange={e => setCustomPorts(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && performCustomScan()}
                            autoFocus
                        />
                        <div className="flex justify-end gap-2">
                            <button onClick={() => setScanTarget(null)} className="px-3 py-1.5 text-xs text-dark-300 hover:text-dark-100">Cancel</button>
                            <button onClick={performCustomScan} className="px-3 py-1.5 text-xs bg-accent-primary text-white rounded-lg hover:bg-accent-primary/90">
                                Start Scan
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Service Selection Modal */}
            {shareToSelectService && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={() => setShareToSelectService(null)}>
                    <div className="bg-dark-900 p-4 rounded-xl border border-dark-700 w-80 shadow-xl" onClick={e => e.stopPropagation()}>
                        <h3 className="text-dark-100 font-medium mb-3">Select Service</h3>
                        <p className="text-xs text-dark-400 mb-3">
                            Multiple services found on {shareToSelectService.name}. Choose one to add:
                        </p>
                        <div className="space-y-1">
                            {shareToSelectService.openPorts?.map(port => {
                                let label = 'Unknown';
                                let proto = 'bookmark';
                                if (port === 21) { label = 'FTP'; proto = 'ftp'; }
                                else if (port === 22) { label = 'SSH'; proto = 'ssh'; }
                                else if (port === 80) { label = 'HTTP (Web)'; proto = 'http'; }
                                else if (port === 443) { label = 'HTTPS (Web)'; proto = 'https'; }
                                else if (port === 445) { label = 'SMB'; proto = 'smb'; }
                                else if (port === 548) { label = 'AFP'; proto = 'afp'; }
                                else if (port === 3389) { label = 'RDP'; proto = 'rdp'; }
                                else if (port === 5900) { label = 'VNC'; proto = 'vnc'; }
                                else if (port === 8080) { label = 'HTTP (Web)'; proto = 'http'; }
                                else { label = `${port}`; proto = 'other'; }

                                return (
                                    <button
                                        key={port}
                                        onClick={() => handleServiceSelect(port, proto)}
                                        className="w-full flex items-center justify-between p-2 rounded-lg hover:bg-dark-800 text-left text-sm text-dark-200 transition-colors"
                                    >
                                        <span>{label}</span>
                                        <span className="text-xs text-dark-500 font-mono">{port}</span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                </div>
            )}

            {/* Scan Result Modal */}
            {scanResult && (
                <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={() => setScanResult(null)}>
                    <div className="bg-dark-900 p-6 rounded-xl border border-dark-700 w-96 shadow-xl animate-in fade-in zoom-in duration-200" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center gap-3 mb-4">
                            {scanResult.found.length > 0 ? (
                                <div className="p-2 bg-accent-success/10 rounded-lg">
                                    <Activity className="w-6 h-6 text-accent-success" />
                                </div>
                            ) : (
                                <div className="p-2 bg-dark-800 rounded-lg">
                                    <AlertCircle className="w-6 h-6 text-dark-400" />
                                </div>
                            )}
                            <div>
                                <h3 className="text-lg font-semibold text-dark-100">
                                    {scanResult.found.length > 0 ? 'Scan Complete' : 'No Ports Found'}
                                </h3>
                                <p className="text-xs text-dark-400">{scanResult.target}</p>
                            </div>
                        </div>

                        <div className="mb-6">
                            {scanResult.found.length > 0 ? (
                                <div>
                                    <p className="text-sm text-dark-300 mb-2">Found {scanResult.found.length} open ports:</p>
                                    <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto">
                                        {scanResult.found.map(port => {
                                            const { label, classes } = getPortDisplay(port);
                                            return (
                                                <button
                                                    key={port}
                                                    onClick={() => handleOpenPort({ host: scanResult.target, name: scanResult.target, type: 'other' } as any, port)}
                                                    className={`px-2 py-1 rounded-md border text-xs font-mono font-medium transition-all hover:scale-105 ${classes}`}
                                                >
                                                    {label}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            ) : (
                                <p className="text-sm text-dark-300">
                                    No open ports were found in the specified range. The host might be blocking connections or the services are down.
                                </p>
                            )}
                        </div>

                        <button
                            onClick={() => setScanResult(null)}
                            className="w-full py-2 bg-dark-800 hover:bg-dark-700 text-dark-200 rounded-lg transition-colors font-medium text-sm"
                        >
                            Close
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}


