import { dialog } from 'electron';
import { readFileSync, writeFileSync } from 'fs';
import type { AnyItem, Group } from '../../shared/types';

export interface ExportData {
  version: string;
  exportedAt: string;
  groups: Group[];
  items: AnyItem[];
  encryption?: {
    salt: string;
    verification: string;
  };
}

// Sync format (used by WebDAV sync)
export interface SyncData {
  version: number;
  lastSync: string;
  groups: Group[];
  items: AnyItem[];
  encryption?: {
    salt: string;
    verification: string;
  };
}

export class ImportExportService {
  async exportData(groups: Group[], items: AnyItem[], encryption?: { salt: string; verification: string }): Promise<{ success: boolean; path?: string; error?: string }> {
    try {
      const result = await dialog.showSaveDialog({
        title: 'Export LaunchIt Data',
        defaultPath: `launchit-backup-${new Date().toISOString().split('T')[0]}.json`,
        filters: [
          { name: 'JSON Files', extensions: ['json'] },
          { name: 'All Files', extensions: ['*'] },
        ],
      });

      if (result.canceled || !result.filePath) {
        return { success: false, error: 'Export cancelled' };
      }

      const exportData: ExportData = {
        version: '1.0.0',
        exportedAt: new Date().toISOString(),
        groups,
        items,
        encryption,
      };

      writeFileSync(result.filePath, JSON.stringify(exportData, null, 2), 'utf-8');

      return { success: true, path: result.filePath };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  }

  async importData(): Promise<{ success: boolean; data?: ExportData; error?: string }> {
    try {
      const result = await dialog.showOpenDialog({
        title: 'Import LaunchIt Data',
        filters: [
          { name: 'JSON Files', extensions: ['json'] },
          { name: 'All Files', extensions: ['*'] },
        ],
        properties: ['openFile'],
      });

      if (result.canceled || result.filePaths.length === 0) {
        return { success: false, error: 'Import cancelled' };
      }

      const fileContent = readFileSync(result.filePaths[0], 'utf-8');
      const parsed = JSON.parse(fileContent);

      // Check if it's sync format (version is number) or export format (version is string)
      let data: ExportData;

      if (typeof parsed.version === 'number' && parsed.lastSync) {
        // Sync format - convert to export format
        data = {
          version: String(parsed.version),
          exportedAt: parsed.lastSync,
          groups: parsed.groups || [],
          items: parsed.items || [],
          encryption: parsed.encryption,
        };
      } else if (typeof parsed.version === 'string' && parsed.exportedAt) {
        // Export format - use as is
        data = parsed as ExportData;
      } else {
        return { success: false, error: 'Invalid file format' };
      }

      // Validate the data structure
      if (!data.version || !data.groups || !data.items) {
        return { success: false, error: 'Invalid file format' };
      }

      return { success: true, data };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  }

  // Import sync format file (same as importData but with different dialog title)
  async importSyncFile(): Promise<{ success: boolean; data?: ExportData; error?: string }> {
    try {
      const result = await dialog.showOpenDialog({
        title: 'Import Sync File',
        filters: [
          { name: 'JSON Files', extensions: ['json'] },
          { name: 'All Files', extensions: ['*'] },
        ],
        properties: ['openFile'],
      });

      if (result.canceled || result.filePaths.length === 0) {
        return { success: false, error: 'Import cancelled' };
      }

      const fileContent = readFileSync(result.filePaths[0], 'utf-8');
      const parsed = JSON.parse(fileContent);

      // Handle both sync format and export format
      let data: ExportData;

      if (typeof parsed.version === 'number' && parsed.lastSync) {
        // Sync format - convert to export format
        data = {
          version: String(parsed.version),
          exportedAt: parsed.lastSync,
          groups: parsed.groups || [],
          items: parsed.items || [],
          encryption: parsed.encryption,
        };
      } else if (typeof parsed.version === 'string' && parsed.exportedAt) {
        // Export format - use as is
        data = parsed as ExportData;
      } else {
        return { success: false, error: 'Invalid file format' };
      }

      // Validate the data structure
      if (!data.version || !data.groups || !data.items) {
        return { success: false, error: 'Invalid file format' };
      }

      return { success: true, data };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  }

  // Import from Chrome/Firefox bookmarks HTML
  async importBrowserBookmarks(): Promise<{ success: boolean; items?: Partial<AnyItem>[]; error?: string }> {
    try {
      const result = await dialog.showOpenDialog({
        title: 'Import Browser Bookmarks',
        filters: [
          { name: 'HTML Files', extensions: ['html', 'htm'] },
          { name: 'All Files', extensions: ['*'] },
        ],
        properties: ['openFile'],
      });

      if (result.canceled || result.filePaths.length === 0) {
        return { success: false, error: 'Import cancelled' };
      }

      const fileContent = readFileSync(result.filePaths[0], 'utf-8');
      const bookmarks = this.parseBrowserBookmarks(fileContent);

      return { success: true, items: bookmarks };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  }

  private parseBrowserBookmarks(html: string): Partial<AnyItem>[] {
    const bookmarks: Partial<AnyItem>[] = [];

    // Simple regex to extract bookmarks from Netscape bookmark format
    // Format: <A HREF="url" ... >name</A>
    const regex = /<A\s+HREF="([^"]+)"[^>]*>([^<]+)<\/A>/gi;
    let match;

    while ((match = regex.exec(html)) !== null) {
      const url = match[1];
      const name = match[2].trim();

      // Skip javascript: and place: URLs
      if (url.startsWith('javascript:') || url.startsWith('place:')) {
        continue;
      }

      try {
        const urlObj = new URL(url);
        bookmarks.push({
          type: 'bookmark',
          name,
          protocol: urlObj.protocol.replace(':', '') as any,
          port: urlObj.port ? parseInt(urlObj.port, 10) : undefined,
          path: urlObj.pathname + urlObj.search,
          networkAddresses: {
            local: urlObj.hostname,
          },
        });
      } catch {
        // Invalid URL, skip
      }
    }

    return bookmarks;
  }
}

