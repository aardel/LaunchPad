
import { spawn } from 'child_process';
import * as net from 'net';
import * as dns from 'dns/promises';
import { NetworkShare } from '../../shared/types';

export class NetworkDiscoveryService {
    private activeScans: Set<any> = new Set();
    private pendingResolutions: Set<Promise<void>> = new Set();
    private discoveredShares: Map<string, NetworkShare> = new Map();

    async scanForShares(durationMs: number = 5000): Promise<NetworkShare[]> {
        this.discoveredShares.clear();
        this.pendingResolutions.clear();

        // Start mDNS scan
        const mdnsPromise = this.scanMdns(durationMs);

        // Start ARP/IP scan
        const arpPromise = this.scanArp(durationMs);

        await Promise.all([mdnsPromise, arpPromise]);

        // Wait for any remaining resolutions to complete
        if (this.pendingResolutions.size > 0) {
            await Promise.all(Array.from(this.pendingResolutions));
        }

        return Array.from(this.discoveredShares.values());
    }

    private async scanMdns(durationMs: number) {
        const services = [
            { type: '_smb._tcp', proto: 'smb' },
            { type: '_afpovertcp._tcp', proto: 'afp' },
            { type: '_nfs._tcp', proto: 'nfs' },
            { type: '_device-info._tcp', proto: 'other' }
        ] as const;

        const promises = services.map(service => this.scanServiceType(service.type, service.proto as any, durationMs));
        await Promise.all(promises);
    }

    private async scanArp(durationMs: number) {
        try {
            const { exec } = require('child_process');
            const util = require('util');
            const execAsync = util.promisify(exec);

            const { stdout } = await execAsync('arp -a');
            const lines = stdout.split('\n');
            const ipRegex = /\((\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})\)/;

            const scanPromises: Promise<void>[] = [];

            for (const line of lines) {
                const match = line.match(ipRegex);
                if (match) {
                    const ip = match[1];
                    // Skip multicast/broadcast
                    if (ip.startsWith('224.') || ip.startsWith('239.') || ip.endsWith('.255')) continue;

                    const p = (async () => {
                        // Fast port check to identify service
                        const ports = await this.scanPorts(ip, 'basic');
                        if (ports.length > 0) {
                            // Identify type based on ports
                            let type: 'smb' | 'afp' | 'nfs' | 'other' = 'other';
                            if (ports.includes(445) || ports.includes(139)) type = 'smb';
                            else if (ports.includes(548)) type = 'afp';
                            else if (ports.includes(2049)) type = 'nfs';

                            // Try to resolve hostname
                            let hostname = ip;
                            try {
                                const reversed = await dns.reverse(ip);
                                if (reversed && reversed.length > 0) {
                                    hostname = reversed[0];
                                }
                            } catch (e) {
                                // failed to reverse valid, keep IP
                            }

                            // Add to discovered if not exists (prefer mDNS info if available as it has proper names)
                            const id = `${type}:${hostname}`;
                            // If mDNS found it, it likely populated deeper info, so check collision
                            // We use a simpler key for deduplication check
                            let exists = false;
                            for (const share of this.discoveredShares.values()) {
                                if (share.address === ip || share.host === hostname) {
                                    // Merge missing info
                                    if (!share.openPorts) share.openPorts = ports;
                                    exists = true;
                                    break;
                                }
                            }

                            // name: hostname.split('.')[0] -> This breaks for IPs
                            const isIp = /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(hostname);
                            const name = isIp ? hostname : hostname.split('.')[0];

                            if (!exists) {
                                this.discoveredShares.set(id, {
                                    name: name,
                                    type: type,
                                    host: hostname,
                                    address: ip,
                                    openPorts: ports
                                });
                            }
                        }
                    })();
                    scanPromises.push(p);
                }
            }

            // Limit concurrency for ARP scan processing
            await Promise.all(scanPromises);
        } catch (error) {
            console.error('ARP scanning failed:', error);
        }
    }

    async scanPorts(host: string, type: 'basic' | 'deep' | number[] = 'basic'): Promise<number[]> {
        const basicPorts = [
            21,   // FTP
            22,   // SSH
            80,   // HTTP
            443,  // HTTPS
            445,  // SMB
            548,  // AFP
            3389, // RDP
            5900, // VNC
            8080  // Web Alt
        ];

        const deepPorts = [
            ...basicPorts,
            3000, 3001, 5000, 8000, 8008, 8081, 8443, // Web Dev
            23,   // Telnet
            25,   // SMTP
            53,   // DNS
            110,  // POP3
            143,  // IMAP
            139,  // SMB (NetBIOS)
            3306, // MySQL
            5432, // PostgreSQL
            6379, // Redis
            27017 // MongoDB
        ];

        let portsToScan: number[] = [];
        if (Array.isArray(type)) {
            portsToScan = type;
        } else {
            portsToScan = type === 'basic' ? basicPorts : deepPorts;
        }
        const results: number[] = [];

        // Scan in batches to avoid too many concurrent connections
        const batchSize = 10;
        for (let i = 0; i < portsToScan.length; i += batchSize) {
            const batch = portsToScan.slice(i, i + batchSize);
            const promises = batch.map(port => this.checkPort(host, port));
            const batchResults = await Promise.all(promises);
            results.push(...batchResults.filter((p): p is number => p !== null));
        }

        return results.sort((a, b) => a - b);
    }

    private checkPort(host: string, port: number): Promise<number | null> {
        return new Promise((resolve) => {
            const socket = new net.Socket();
            socket.setTimeout(400); // Short timeout for local network

            socket.on('connect', () => {
                socket.destroy();
                resolve(port);
            });

            socket.on('timeout', () => {
                socket.destroy();
                resolve(null);
            });

            socket.on('error', (err) => {
                socket.destroy();
                resolve(null);
            });

            socket.connect(port, host);
        });
    }

    private async resolveHost(host: string): Promise<string | undefined> {
        try {
            console.log(`Resolving host: ${host}`);
            const res = await dns.lookup(host);
            console.log(`Resolved ${host} -> ${res.address}`);
            return res.address;
        } catch (e) {
            console.error(`Failed to resolve ${host}:`, e);
            return undefined;
        }
    }

    private resolveService(name: string, type: string, domain: string): Promise<{ host: string, port: number } | null> {
        return new Promise((resolve) => {
            const process = spawn('dns-sd', ['-L', name, type, domain]);
            let resolved = false;

            // Use readline to handle stream chunking correctly
            const rl = require('readline').createInterface({
                input: process.stdout,
                terminal: false
            });

            // Timeout after 3 seconds (increased from 2)
            const timeout = setTimeout(() => {
                if (!resolved) {
                    process.kill();
                    resolve(null);
                }
            }, 3000);

            rl.on('line', (line: string) => {
                // Check for macOS "can be reached at" format
                // Example: "Instance Name. ... can be reached at target.local.:1234 (interface 1)"
                const match = line.match(/can be reached at\s+([^:]+):(\d+)/);
                if (match) {
                    const target = match[1];
                    const port = parseInt(match[2]);

                    if (target && !isNaN(port)) {
                        resolved = true;
                        clearTimeout(timeout);
                        process.kill();
                        resolve({
                            host: target.endsWith('.') ? target.slice(0, -1) : target,
                            port
                        });
                        return;
                    }
                }

                // Fallback to columnar format parsing (legacy/linux or other dns-sd versions)
                // Output format: ... <Priority> <Weight> <Port> <Target>
                if (line.includes(name)) {
                    const parts = line.trim().split(/\s+/);
                    if (parts.length >= 4) {
                        const target = parts[parts.length - 1];
                        const port = parseInt(parts[parts.length - 2]);

                        if (target && !isNaN(port) && target.includes('.')) {
                            resolved = true;
                            clearTimeout(timeout);
                            process.kill();
                            resolve({
                                host: target.endsWith('.') ? target.slice(0, -1) : target,
                                port
                            });
                            return;
                        }
                    }
                }
            });

            process.on('error', () => {
                clearTimeout(timeout);
                resolve(null);
            });
        });
    }

    private scanServiceType(serviceType: string, protocol: 'smb' | 'afp' | 'nfs', durationMs: number): Promise<void> {
        return new Promise((resolve) => {
            const process = spawn('dns-sd', ['-B', serviceType, 'local']);
            this.activeScans.add(process);

            // Use readline for better stream handling
            const rl = require('readline').createInterface({
                input: process.stdout,
                terminal: false
            });

            rl.on('line', (line: string) => {
                if (line.includes('Add') && line.includes(serviceType)) {
                    const parts = line.split(serviceType + '.');
                    if (parts.length > 1) {
                        const name = parts[1].trim();
                        if (name) {
                            // Track this resolution
                            const resolutionPromise = (async () => {
                                try {
                                    // Resolve the true hostname and port
                                    const resolution = await this.resolveService(name, serviceType, 'local');

                                    if (resolution) {
                                        const id = `${protocol}:${name}`;
                                        const ip = await this.resolveHost(resolution.host);

                                        this.discoveredShares.set(id, {
                                            name: name,
                                            type: protocol,
                                            host: resolution.host,
                                            address: ip,
                                            openPorts: [resolution.port]
                                        });
                                    } else {
                                        // Fallback
                                        const id = `${protocol}:${name}`;
                                        this.discoveredShares.set(id, {
                                            name: name,
                                            type: protocol,
                                            host: `${name}.local`
                                        });
                                    }
                                } catch (err) {
                                    console.error('Error resolving service:', err);
                                }
                            })();

                            this.pendingResolutions.add(resolutionPromise);
                            resolutionPromise.finally(() => {
                                this.pendingResolutions.delete(resolutionPromise);
                            });
                        }
                    }
                }
            });

            setTimeout(() => {
                process.kill();
                this.activeScans.delete(process);
                resolve();
            }, durationMs);

            process.on('error', (err) => {
                console.error(`dns-sd error for ${serviceType}:`, err);
                resolve();
            });
        });
    }

    stopScanning() {
        for (const process of this.activeScans) {
            process.kill();
        }
        this.activeScans.clear();
        this.pendingResolutions.clear();
    }
}
