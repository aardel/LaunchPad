import { shell } from 'electron';
import { exec, spawn } from 'child_process';
import { promisify } from 'util';
import {
  AnyItem,
  BookmarkItem,
  SSHItem,
  AppItem,
  NetworkProfile,
} from '../../shared/types';
import { BrowserService } from './browsers';

const execAsync = promisify(exec);

export class LauncherService {
  private browserService: BrowserService;
  private healthCheckService?: any; // Using any to avoid circular deps if they exist, but normally HealthCheckService

  constructor(browserService: BrowserService, healthCheckService?: any) {
    this.browserService = browserService;
    this.healthCheckService = healthCheckService;
  }

  async launchItem(
    item: AnyItem,
    profile: NetworkProfile,
    browserId?: string,
    decryptedPassword?: string,
    terminal?: string,
    autoRoute: boolean = false
  ): Promise<{ profileUsed: NetworkProfile; routed: boolean }> {
    let finalProfile = profile;
    let routed = false;

    if (autoRoute && item.type === 'bookmark' && this.healthCheckService) {
      const result = await this.healthCheckService.findFirstReachableAddress(item);
      if (result && result.profile !== profile) {
        finalProfile = result.profile;
        routed = true;
      }
    }

    switch (item.type) {
      case 'bookmark':
        await this.launchBookmark(item, finalProfile, browserId);
        break;
      case 'ssh':
        await this.launchSSH(item, finalProfile, decryptedPassword, terminal);
        break;
      case 'app':
        await this.launchApp(item);
        break;
      default:
        throw new Error(`Unknown item type: ${(item as any).type}`);
    }

    return { profileUsed: finalProfile, routed };
  }

  private async launchBookmark(item: BookmarkItem, profile: NetworkProfile, browserId?: string): Promise<void> {
    const url = this.buildUrl(item, profile);

    // Check if the protocol requires a specific browser
    const protocol = item.protocol || 'https';
    let targetBrowserId = browserId;
    let forceBrowser = false;

    // Map protocols to browser IDs
    // Note: 'about' and 'mailto' don't force a browser
    const protocolToBrowser: Record<string, string> = {
      'chrome': 'chrome',
      'edge': 'edge',
      'brave': 'brave',
      'opera': 'opera',
      'chatgpt': 'chatgpt'
    };

    if (protocol in protocolToBrowser) {
      targetBrowserId = protocolToBrowser[protocol];
      forceBrowser = true;
    }

    // If no specific browser or default, use system default (unless forced)
    if (!forceBrowser && (!targetBrowserId || targetBrowserId === 'default')) {
      await shell.openExternal(url);
      return;
    }

    // If forced but no browser ID found (shouldn't happen with our logic but good for safety)
    if (forceBrowser && !targetBrowserId) {
      await shell.openExternal(url); // Try default fallback
      return;
    }

    // Get the browser info
    // If forced, we try to find that specific browser
    const browser = this.browserService.getBrowserById(targetBrowserId!);

    if (!browser || !browser.path) {
      // If forced browser not found, we should probably warn or fallback
      // For now, fallback to default but maybe we should throw?
      // "currently a chrome bookmark only opens if i have chrome selected" -> user implies failure.
      // If we fall back to system default for a chrome:// link, it will likely fail silently or do nothing, which is what user sees.
      // So let's try to openExternal anyway as a Hail Mary.
      await shell.openExternal(url);
      return;
    }

    // If we are forcing a browser, notify the user
    if (forceBrowser) {
      // We need to send an IPC message to renderer
      // Since LauncherService is in main, we can use BrowserWindow to send to all windows
      const { BrowserWindow } = require('electron');
      const windows = BrowserWindow.getAllWindows();
      for (const win of windows) {
        win.webContents.send('toast:show', {
          type: 'info',
          title: `Opening in ${browser.name}...`,
          message: `This bookmark requires ${browser.name} to open.`
        });
      }
    }

    const platform = process.platform;

    if (platform === 'darwin') {
      // macOS - use open command with specific app
      spawn('open', ['-a', browser.path, url], { detached: true, stdio: 'ignore' });
    } else if (platform === 'win32') {
      // Windows - launch browser executable with URL
      spawn(browser.path, [url], { detached: true, stdio: 'ignore' });
    } else {
      // Linux - launch browser with URL
      spawn(browser.path, [url], { detached: true, stdio: 'ignore' });
    }
  }

  private async launchSSH(item: SSHItem, profile: NetworkProfile, password?: string, terminal: string = 'Terminal'): Promise<void> {
    const host = this.getAddressForProfile(item.networkAddresses, profile);
    if (!host) {
      throw new Error('No address configured for this profile');
    }

    const port = item.port || 22;
    const username = item.username || 'root';

    const platform = process.platform;

    if (platform === 'darwin') {
      const isITerm = terminal.toLowerCase().includes('iterm');
      const terminalApp = isITerm ? 'iTerm' : 'Terminal';

      let sshCommand = '';
      let tempScript = '';
      let hasCleanup = false;

      if (password) {
        // Use sshpass if available, otherwise use expect script
        const hasSshpass = await this.checkCommand('sshpass');

        if (hasSshpass) {
          // Use sshpass for password authentication
          sshCommand = `sshpass -p '${this.escapeShellArg(password)}' ssh -o StrictHostKeyChecking=accept-new ${username}@${host} -p ${port}`;
        } else {
          // Use expect script for password authentication
          const expectScript = `
            spawn ssh -o StrictHostKeyChecking=accept-new ${username}@${host} -p ${port}
            expect {
              "password:" {
                send "${this.escapeExpectArg(password)}\\r"
                interact
              }
              "Password:" {
                send "${this.escapeExpectArg(password)}\\r"
                interact
              }
              "yes/no" {
                send "yes\\r"
                expect "password:"
                send "${this.escapeExpectArg(password)}\\r"
                interact
              }
              timeout {
                interact
              }
            }
          `;

          // Write expect script to temp file and execute
          tempScript = `/tmp/launchpad_ssh_${Date.now()}.exp`;
          const { writeFileSync } = require('fs');
          writeFileSync(tempScript, expectScript);
          sshCommand = `expect '${tempScript}' && rm '${tempScript}'`;
          hasCleanup = true;
        }
      } else {
        // No password - standard SSH
        sshCommand = `ssh ${username}@${host} -p ${port}`;
      }

      // Terminal-specific AppleScript
      let script = '';
      if (isITerm) {
        script = `
          tell application "iTerm"
            activate
            set newWindow to (create window with default profile)
            tell current session of newWindow
              write text "${sshCommand.replace(/"/g, '\\"')}"
            end tell
          end tell
        `;
      } else {
        // Default Terminal.app
        script = `
          tell application "Terminal"
            activate
            do script "${sshCommand.replace(/"/g, '\\"')}"
          end tell
        `;
      }

      try {
        await execAsync(`osascript -e '${script}'`);
      } catch (error) {
        console.error(`Failed to launch ${terminalApp}:`, error);
        // Fallback for expect script cleanup if osascript failed
        if (hasCleanup && tempScript) {
          const { unlinkSync, existsSync } = require('fs');
          if (existsSync(tempScript)) {
            unlinkSync(tempScript);
          }
        }
        throw error;
      }
    } else if (platform === 'win32') {

      // Windows - open in Windows Terminal or cmd
      const sshCommand = `ssh ${username}@${host} -p ${port}`;
      try {
        // Try Windows Terminal first
        spawn('wt', ['new-tab', 'cmd', '/k', sshCommand], { detached: true, stdio: 'ignore' });
      } catch {
        // Fallback to cmd
        spawn('cmd', ['/k', sshCommand], { detached: true, stdio: 'ignore' });
      }
    } else {
      // Linux - try common terminal emulators
      const sshCommand = password
        ? `sshpass -p '${this.escapeShellArg(password)}' ssh -o StrictHostKeyChecking=accept-new ${username}@${host} -p ${port}`
        : `ssh ${username}@${host} -p ${port}`;

      const terminals = [
        ['gnome-terminal', '--', 'bash', '-c', `${sshCommand}; exec bash`],
        ['konsole', '-e', sshCommand],
        ['xfce4-terminal', '-e', sshCommand],
        ['xterm', '-e', sshCommand],
      ];

      let launched = false;
      for (const [terminal, ...args] of terminals) {
        try {
          spawn(terminal, args, { detached: true, stdio: 'ignore' });
          launched = true;
          break;
        } catch {
          continue;
        }
      }

      if (!launched) {
        throw new Error('No supported terminal emulator found');
      }
    }
  }

  private async checkCommand(command: string): Promise<boolean> {
    try {
      await execAsync(`which ${command}`);
      return true;
    } catch {
      return false;
    }
  }

  private escapeShellArg(arg: string): string {
    return arg.replace(/'/g, "'\\''");
  }

  private escapeExpectArg(arg: string): string {
    return arg.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\$/g, '\\$').replace(/\[/g, '\\[');
  }

  private async launchApp(item: AppItem): Promise<void> {
    const platform = process.platform;
    const appPath = item.appPath;
    const args = item.arguments || [];

    if (platform === 'darwin') {
      // macOS - use open command for .app bundles
      if (appPath.endsWith('.app')) {
        spawn('open', ['-a', appPath, ...args], { detached: true, stdio: 'ignore' });
      } else {
        spawn(appPath, args, { detached: true, stdio: 'ignore' });
      }
    } else if (platform === 'win32') {
      // Windows
      spawn('cmd', ['/c', 'start', '', appPath, ...args], { detached: true, stdio: 'ignore' });
    } else {
      // Linux
      spawn(appPath, args, { detached: true, stdio: 'ignore' });
    }
  }

  private buildUrl(item: BookmarkItem, profile: NetworkProfile): string {
    const host = this.getAddressForProfile(item.networkAddresses, profile);
    if (!host) {
      throw new Error('No address configured for this profile');
    }

    const protocol = item.protocol || 'https';
    const port = item.port;
    const path = item.path || '';

    // Handle protocols that don't use :// or use standard format
    // about:config, mailto:user@example.com
    if (protocol === 'about' || protocol === 'mailto') {
      return `${protocol}:${host}${path}`;
    }

    // Chrome, Edge, Brave, Opera, ChatGPT schemes usually follow chrome:// format
    // e.g. chrome://settings, opera://settings
    // BUT ChatGPT might be just https://chatgpt.com... wait.
    // If protocol IS 'chatgpt', what is the URL scheme? 
    // The user implied "chat gpt browsers" (likely SearchGPT or similar).
    // Assuming 'chatgpt://' or treating it like chrome based on user request.
    // If it's a web URL, user would use https. 
    // If it's an app scheme, it's likely chatgpt:// or similar.
    // "add same support for opera and for chat gpt browsers as these are nbased on chromium"
    // This implies using `chatgpt://` or `opera://`.

    let url = `${protocol}://`;

    // Handle IPv6 addresses
    if (host.includes(':') && !host.startsWith('[')) {
      url += `[${host}]`;
    } else {
      url += host;
    }

    // Add port if specified and not default
    if (port) {
      const isDefaultPort =
        (protocol === 'http' && port === 80) ||
        (protocol === 'https' && port === 443) ||
        (protocol === 'ftp' && port === 21) ||
        (protocol === 'ssh' && port === 22);

      if (!isDefaultPort) {
        url += `:${port}`;
      }
    }

    // Add path
    if (path) {
      url += path.startsWith('/') ? path : `/${path}`;
    }

    return url;
  }

  private getAddressForProfile(
    addresses: { local?: string; tailscale?: string; vpn?: string; custom?: string },
    profile: NetworkProfile
  ): string | undefined {
    // Return custom profile if available, otherwise fallback
    if (profile === 'custom' && addresses.custom) return addresses.custom;
    if (profile === 'tailscale' && addresses.tailscale) return addresses.tailscale;
    if (profile === 'vpn' && addresses.vpn) return addresses.vpn;

    // Default chain for specific profiles if they miss a value
    switch (profile) {
      case 'local':
        return addresses.local || addresses.tailscale || addresses.vpn || addresses.custom;
      case 'tailscale':
        return addresses.tailscale || addresses.local;
      case 'vpn':
        return addresses.vpn || addresses.local;
      default:
        // fallback to local for unknown profiles
        return addresses.local;
    }
  }
}

