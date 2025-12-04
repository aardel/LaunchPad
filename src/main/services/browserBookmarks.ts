import { existsSync, readFileSync, readdirSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';
import { execSync } from 'child_process';

export interface BrowserBookmark {
  name: string;
  url: string;
  folder?: string;
}

export interface BrowserWithBookmarks {
  id: string;
  name: string;
  icon: string;
  hasBookmarks: boolean;
  bookmarkCount?: number;
}

// Browser bookmark file locations on macOS
const BROWSER_BOOKMARK_PATHS: Record<string, { path: string; type: 'json' | 'sqlite' | 'plist' }> = {
  chrome: {
    path: '~/Library/Application Support/Google/Chrome/Default/Bookmarks',
    type: 'json',
  },
  'chrome-alt': {
    path: '~/Library/Application Support/Chrome/Default/Bookmarks',
    type: 'json',
  },
  brave: {
    path: '~/Library/Application Support/BraveSoftware/Brave-Browser/Default/Bookmarks',
    type: 'json',
  },
  edge: {
    path: '~/Library/Application Support/Microsoft Edge/Default/Bookmarks',
    type: 'json',
  },
  arc: {
    path: '~/Library/Application Support/Arc/User Data/Default/Bookmarks',
    type: 'json',
  },
  vivaldi: {
    path: '~/Library/Application Support/Vivaldi/Default/Bookmarks',
    type: 'json',
  },
  opera: {
    path: '~/Library/Application Support/com.operasoftware.Opera/Bookmarks',
    type: 'json',
  },
  chromium: {
    path: '~/Library/Application Support/Chromium/Default/Bookmarks',
    type: 'json',
  },
  firefox: {
    path: '~/Library/Application Support/Firefox/Profiles',
    type: 'sqlite',
  },
  safari: {
    path: '~/Library/Safari/Bookmarks.plist',
    type: 'plist',
  },
};

const BROWSER_INFO: Record<string, { name: string; icon: string }> = {
  chrome: { name: 'Google Chrome', icon: '🔵' },
  'chrome-alt': { name: 'Chrome', icon: '🔵' },
  brave: { name: 'Brave', icon: '🦁' },
  edge: { name: 'Microsoft Edge', icon: '🌊' },
  arc: { name: 'Arc', icon: '🌈' },
  vivaldi: { name: 'Vivaldi', icon: '🎨' },
  opera: { name: 'Opera', icon: '🔴' },
  chromium: { name: 'Chromium', icon: '⚪' },
  firefox: { name: 'Firefox', icon: '🦊' },
  safari: { name: 'Safari', icon: '🧭' },
};

export class BrowserBookmarksService {
  private expandPath(path: string): string {
    return path.replace('~', homedir());
  }

  async getBrowsersWithBookmarks(): Promise<BrowserWithBookmarks[]> {
    const browsers: BrowserWithBookmarks[] = [];

    for (const [id, config] of Object.entries(BROWSER_BOOKMARK_PATHS)) {
      const info = BROWSER_INFO[id];
      if (!info) continue;

      const fullPath = this.expandPath(config.path);
      let hasBookmarks = false;
      let bookmarkCount = 0;
      let fileExists = false;

      try {
        if (config.type === 'sqlite') {
          // Firefox - check if profiles directory exists with places.sqlite
          if (existsSync(fullPath)) {
            fileExists = true;
            const profiles = readdirSync(fullPath);
            for (const profile of profiles) {
              const placesPath = join(fullPath, profile, 'places.sqlite');
              if (existsSync(placesPath)) {
                hasBookmarks = true;
                // Try to count bookmarks for Firefox
                try {
                  const tempPath = `/tmp/firefox_places_check_${Date.now()}.sqlite`;
                  execSync(`cp "${placesPath}" "${tempPath}"`);
                  const result = execSync(
                    `sqlite3 "${tempPath}" "SELECT COUNT(*) FROM moz_bookmarks b JOIN moz_places p ON b.fk = p.id WHERE b.type = 1 AND p.url NOT LIKE 'place:%'"`,
                    { encoding: 'utf-8' }
                  );
                  bookmarkCount = parseInt(result.trim()) || 0;
                  execSync(`rm "${tempPath}"`);
                } catch {
                  // Couldn't count, but file exists
                }
                break;
              }
            }
          }
        } else if (config.type === 'plist') {
          // Safari
          fileExists = existsSync(fullPath);
          if (fileExists) {
            // Try to count bookmarks using defaults read
            try {
              const output = execSync(
                `defaults read "${fullPath}"`,
                { encoding: 'utf-8', maxBuffer: 10 * 1024 * 1024 }
              );
              // Count HTTP/HTTPS URLs in the output
              const urlMatches = output.match(/URLString\s*=\s*"(https?:\/\/[^"]+)"/g);
              if (urlMatches) {
                bookmarkCount = urlMatches.length;
                hasBookmarks = bookmarkCount > 0;
              } else {
                // File exists but no URLs found (might be empty or only file:// URLs)
                hasBookmarks = false;
              }
            } catch (error) {
              // File exists but couldn't read it - still show it
              console.error(`Error reading Safari bookmarks for counting:`, error);
              hasBookmarks = true; // Show browser even if we can't count
            }
          }
        } else {
          // JSON (Chromium-based)
          // First check the default path
          fileExists = existsSync(fullPath);
          if (fileExists) {
            try {
              const content = readFileSync(fullPath, 'utf-8');
              const data = JSON.parse(content);
              const bookmarks = this.extractChromiumBookmarks(data);
              hasBookmarks = bookmarks.length > 0;
              bookmarkCount = bookmarks.length;
            } catch (error) {
              // File exists but couldn't parse it
              console.error(`Error reading bookmarks for ${id}:`, error);
              hasBookmarks = false;
            }
          } else {
            // Check for alternative profiles (Profile 1, Profile 2, etc.)
            const baseDir = fullPath.substring(0, fullPath.lastIndexOf('/'));
            if (existsSync(baseDir)) {
              try {
                const profiles = readdirSync(baseDir);
                for (const profile of profiles) {
                  // Check if it's a profile directory (Profile 1, Profile 2, etc. or custom names)
                  const profileBookmarksPath = join(baseDir, profile, 'Bookmarks');
                  if (existsSync(profileBookmarksPath)) {
                    fileExists = true;
                    try {
                      const content = readFileSync(profileBookmarksPath, 'utf-8');
                      const data = JSON.parse(content);
                      const bookmarks = this.extractChromiumBookmarks(data);
                      if (bookmarks.length > 0) {
                        hasBookmarks = true;
                        bookmarkCount += bookmarks.length;
                      }
                    } catch {
                      // Couldn't read this profile, try next
                    }
                  }
                }
              } catch {
                // Couldn't read directory
              }
            }
          }
        }
      } catch (error) {
        // Log error but still show browser if file exists
        console.error(`Error checking bookmarks for ${id}:`, error);
      }

      // Show browser if bookmark file exists (even if empty)
      // This allows users to see all available browsers
      if (fileExists) {
        browsers.push({
          id,
          name: info.name,
          icon: info.icon,
          hasBookmarks,
          bookmarkCount: bookmarkCount > 0 ? bookmarkCount : undefined,
        });
      }
    }

    return browsers;
  }

  async getBookmarksFromBrowser(browserId: string): Promise<BrowserBookmark[]> {
    const config = BROWSER_BOOKMARK_PATHS[browserId];
    if (!config) {
      throw new Error(`Unknown browser: ${browserId}`);
    }

    const fullPath = this.expandPath(config.path);

    switch (config.type) {
      case 'json':
        return this.readChromiumBookmarks(fullPath);
      case 'sqlite':
        return this.readFirefoxBookmarks(fullPath);
      case 'plist':
        return this.readSafariBookmarks(fullPath);
      default:
        return [];
    }
  }

  private readChromiumBookmarks(path: string): BrowserBookmark[] {
    try {
      const content = readFileSync(path, 'utf-8');
      const data = JSON.parse(content);
      return this.extractChromiumBookmarks(data);
    } catch (error) {
      console.error('Error reading Chromium bookmarks:', error);
      return [];
    }
  }

  private extractChromiumBookmarks(data: any, folder: string = ''): BrowserBookmark[] {
    const bookmarks: BrowserBookmark[] = [];

    const processNode = (node: any, currentFolder: string) => {
      if (!node) return;

      if (node.type === 'url' && node.url) {
        bookmarks.push({
          name: node.name || 'Untitled',
          url: node.url,
          folder: currentFolder || undefined,
        });
      } else if (node.type === 'folder' && node.children) {
        const newFolder = currentFolder ? `${currentFolder}/${node.name}` : node.name;
        for (const child of node.children) {
          processNode(child, newFolder);
        }
      }
    };

    // Process bookmark bar and other folders
    if (data.roots) {
      if (data.roots.bookmark_bar) {
        processNode(data.roots.bookmark_bar, 'Bookmark Bar');
      }
      if (data.roots.other) {
        processNode(data.roots.other, 'Other Bookmarks');
      }
      if (data.roots.synced) {
        processNode(data.roots.synced, 'Mobile Bookmarks');
      }
    }

    return bookmarks;
  }

  private readFirefoxBookmarks(profilesPath: string): BrowserBookmark[] {
    const bookmarks: BrowserBookmark[] = [];

    try {
      const profiles = readdirSync(profilesPath);
      
      for (const profile of profiles) {
        const placesPath = join(profilesPath, profile, 'places.sqlite');
        if (!existsSync(placesPath)) continue;

        // Copy database to temp location (Firefox locks the file)
        const tempPath = `/tmp/firefox_places_${Date.now()}.sqlite`;
        execSync(`cp "${placesPath}" "${tempPath}"`);

        try {
          // Use sqlite3 command line to extract bookmarks
          const result = execSync(
            `sqlite3 "${tempPath}" "SELECT b.title, p.url FROM moz_bookmarks b JOIN moz_places p ON b.fk = p.id WHERE b.type = 1 AND p.url NOT LIKE 'place:%'"`,
            { encoding: 'utf-8' }
          );

          const lines = result.trim().split('\n');
          for (const line of lines) {
            const [title, url] = line.split('|');
            if (url && url.startsWith('http')) {
              bookmarks.push({
                name: title || 'Untitled',
                url,
              });
            }
          }
        } finally {
          // Clean up temp file
          try {
            execSync(`rm "${tempPath}"`);
          } catch {}
        }

        // Only read from first profile with bookmarks
        if (bookmarks.length > 0) break;
      }
    } catch (error) {
      console.error('Error reading Firefox bookmarks:', error);
    }

    return bookmarks;
  }

  private readSafariBookmarks(plistPath: string): BrowserBookmark[] {
    const bookmarks: BrowserBookmark[] = [];

    try {
      // Safari plist contains binary data that prevents JSON conversion
      // Use defaults read which can handle binary plists
      let output: string;
      try {
        output = execSync(
          `defaults read "${plistPath}"`,
          { encoding: 'utf-8', maxBuffer: 10 * 1024 * 1024 } // 10MB buffer for large bookmark files
        );
      } catch (error) {
        console.error('Error reading Safari bookmarks with defaults:', error);
        return [];
      }

      // Parse the defaults output (property list format)
      // Extract bookmarks by finding URLString entries and their corresponding titles
      // The structure has title inside URIDictionary, then URLString on a separate line
      
      // Split output into lines for easier processing
      const lines = output.split('\n');
      
      // Find all URLString entries with their positions
      const urlEntries: Array<{ url: string; lineIndex: number }> = [];
      lines.forEach((line, index) => {
        const urlMatch = line.match(/URLString\s*=\s*"([^"]+)"/);
        if (urlMatch && urlMatch[1]) {
          const url = urlMatch[1];
          // Only include HTTP/HTTPS URLs
          if (url.startsWith('http://') || url.startsWith('https://')) {
            urlEntries.push({ url, lineIndex: index });
          }
        }
      });
      
      // For each URL, find the corresponding title
      // Title is usually in URIDictionary a few lines before URLString
      urlEntries.forEach(({ url, lineIndex }) => {
        let title = 'Untitled';
        
        // Look backwards from URLString to find the title
        // Title is typically 2-10 lines before URLString
        for (let i = lineIndex - 1; i >= Math.max(0, lineIndex - 15); i--) {
          const line = lines[i];
          // Match title = "..." pattern (can be inside URIDictionary or standalone)
          const titleMatch = line.match(/title\s*=\s*"([^"]+)"/);
          if (titleMatch && titleMatch[1]) {
            title = titleMatch[1];
            break;
          }
        }
        
        bookmarks.push({ name: title, url });
      });
    } catch (error) {
      console.error('Error reading Safari bookmarks:', error);
    }

    return bookmarks;
  }

  // Simple parser for defaults read output (property list format)
  // This is a basic implementation - a proper plist parser would be better
  private parseDefaultsOutput(output: string): any {
    // This is a simplified parser - for production, consider using a proper plist library
    // For now, we'll use a regex-based approach to extract the structure
    try {
      // Try to find the Children array
      const childrenMatch = output.match(/Children\s*=\s*\(([\s\S]*)\);/);
      if (!childrenMatch) return null;

      // This is complex to parse properly, so we'll use the fallback method in readSafariBookmarks
      return null; // Signal to use fallback
    } catch {
      return null;
    }
  }

  private extractSafariBookmarks(node: any, bookmarks: BrowserBookmark[], folder: string = ''): void {
    if (!node) return;

    // Handle root level - Safari plist has a Children array at root
    if (Array.isArray(node)) {
      for (const child of node) {
        this.extractSafariBookmarks(child, bookmarks, folder);
      }
      return;
    }

    // Handle object with Children array (folder or root)
    if (node.Children && Array.isArray(node.Children)) {
      const newFolder = node.Title ? (folder ? `${folder}/${node.Title}` : node.Title) : folder;
      for (const child of node.Children) {
        this.extractSafariBookmarks(child, bookmarks, newFolder);
      }
    }

    // Handle bookmark leaf
    if (node.WebBookmarkType === 'WebBookmarkTypeLeaf' && node.URLString) {
      // Skip file:// URLs and javascript: URLs as they're not web bookmarks
      if (node.URLString.startsWith('http://') || node.URLString.startsWith('https://')) {
        bookmarks.push({
          name: node.URIDictionary?.title || node.Title || 'Untitled',
          url: node.URLString,
          folder: folder || undefined,
        });
      }
    }
  }
}

