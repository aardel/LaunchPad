import { Protocol } from '@shared/types';

export const NETWORK_PROTOCOLS: Protocol[] = [
    'http', 'https',
    'ftp', 'sftp', 'ftps',
    'smb', 'afp', 'nfs',
    'rdp', 'vnc',
    'postgres', 'mysql', 'mongodb', 'redis',
    'git',
    'ssh'
];

export const PROTOCOL_CATEGORIES = [
    {
        title: 'Web & Internal',
        protocols: [
            { id: 'https', name: 'HTTPS', desc: 'Secure Hypertext Transfer Protocol', usage: 'https://google.com' },
            { id: 'http', name: 'HTTP', desc: 'Hypertext Transfer Protocol', usage: 'http://localhost:3000' },
            { id: 'file', name: 'FILE', desc: 'Local File System', usage: 'file:///Users/me/Documents' },
            { id: 'about', name: 'ABOUT', desc: 'Browser Internal Pages', usage: 'about:blank' },
            { id: 'custom', name: 'CUSTOM', desc: 'Custom URI Schemes', usage: 'any-scheme://...' }
        ]
    },
    {
        title: 'File Transfer & Sharing',
        protocols: [
            { id: 'ftp', name: 'FTP', desc: 'File Transfer Protocol', usage: 'ftp://user@host' },
            { id: 'sftp', name: 'SFTP', desc: 'SSH File Transfer Protocol', usage: 'sftp://host' },
            { id: 'ftps', name: 'FTPS', desc: 'FTP over SSL', usage: 'ftps://host' },
            { id: 'smb', name: 'SMB', desc: 'Server Message Block', usage: 'smb://server/share' },
            { id: 'afp', name: 'AFP', desc: 'Apple Filing Protocol', usage: 'afp://server/share' },
            { id: 'nfs', name: 'NFS', desc: 'Network File System', usage: 'nfs://server/path' }
        ]
    },
    {
        title: 'Databases',
        protocols: [
            { id: 'postgres', name: 'POSTGRES', desc: 'PostgreSQL', usage: 'postgres://user:pass@host/db' },
            { id: 'mysql', name: 'MYSQL', desc: 'MySQL', usage: 'mysql://user:pass@host/db' },
            { id: 'mongodb', name: 'MONGODB', desc: 'MongoDB', usage: 'mongodb://host:27017' },
            { id: 'redis', name: 'REDIS', desc: 'Redis', usage: 'redis://host:6379' }
        ]
    },
    {
        title: 'Developer Tools',
        protocols: [
            { id: 'vscode', name: 'VSCODE', desc: 'Visual Studio Code', usage: 'vscode://file/...' },
            { id: 'cursor', name: 'CURSOR', desc: 'Cursor AI Editor', usage: 'cursor://file/...' },
            { id: 'jetbrains', name: 'JETBRAINS', desc: 'JetBrains Gateway', usage: 'jetbrains://...' },
            { id: 'git', name: 'GIT', desc: 'Git Protocol', usage: 'git://github.com/...' }
        ]
    },
    {
        title: 'Communication',
        protocols: [
            { id: 'slack', name: 'SLACK', desc: 'Slack', usage: 'slack://channel?id=...' },
            { id: 'discord', name: 'DISCORD', desc: 'Discord', usage: 'discord://...' },
            { id: 'zoommtg', name: 'ZOOMMTG', desc: 'Zoom Meetings', usage: 'zoommtg://zoom.us/...' },
            { id: 'tg', name: 'TG', desc: 'Telegram', usage: 'tg://resolve?domain=...' }
        ]
    },
    {
        title: 'Remote Access',
        protocols: [
            { id: 'ssh', name: 'SSH', desc: 'Secure Shell', usage: 'ssh://user@host' },
            { id: 'rdp', name: 'RDP', desc: 'Remote Desktop Protocol', usage: 'rdp://host' },
            { id: 'vnc', name: 'VNC', desc: 'Virtual Network Computing', usage: 'vnc://host' }
        ]
    },
    {
        title: 'Browser Specific',
        protocols: [
            { id: 'chrome', name: 'CHROME', desc: 'Google Chrome', usage: 'chrome://settings' },
            { id: 'edge', name: 'EDGE', desc: 'Microsoft Edge', usage: 'edge://flags' },
            { id: 'brave', name: 'BRAVE', desc: 'Brave Browser', usage: 'brave://settings' },
            { id: 'opera', name: 'OPERA', desc: 'Opera Browser', usage: 'opera://settings' },
            { id: 'chatgpt', name: 'CHATGPT', desc: 'ChatGPT App', usage: 'chatgpt://...' }
        ]
    }
];

export const FIELD_HELP_CONTENT: Record<string, { title: string; desc: string }> = {
    port: {
        title: 'Port Number',
        desc: 'The specific network port the service is listening on (e.g., 80 for HTTP, 443 for HTTPS, 22 for SSH). Leave empty to use the default port for the selected protocol.'
    },
    path: {
        title: 'Remote Directory / URL Path',
        desc: 'For websites, this is the specific page (e.g., /dashboard). For file servers (FTP/SMB), this is the folder you want to start in.'
    },
    localAddress: {
        title: 'Local Network IP',
        desc: 'The direct IP address or hostname of the device on your local network (e.g., 192.168.1.100). Configuring this allows proper availability checks when you are at home or in the office.'
    },
    tailscaleAddress: {
        title: 'Tailscale IP Address',
        desc: 'The unique 100.x.x.x IP address assigned by Tailscale. If configured, LaunchIt can automatically use this address when it detects you are connected to your Tailscale network.'
    },
    vpnAddress: {
        title: 'VPN Internal IP',
        desc: 'The internal IP address accessible only when connected to your corporate or private VPN. LaunchIt use this to route traffic correctly when the VPN is active.'
    },
    appPath: {
        title: 'Application Path',
        desc: 'The absolute full path to the executable file or script on your system (e.g., /usr/local/bin/python3).'
    },
    arguments: {
        title: 'Command Arguments',
        desc: 'Optional flags or parameters to pass to the application when starting it (e.g., --verbose --config=myconf.json).'
    }
};
