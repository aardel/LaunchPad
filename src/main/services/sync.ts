import { net } from 'electron';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { app } from 'electron';
import type { AnyItem, Group, AppSettings } from '../../shared/types';
import { EncryptionService } from './encryption';

interface SyncData {
  version: number;
  lastSync: string;
  groups: Group[];
  items: AnyItem[];
  encryption?: {
    salt: string;
    verification: string;
  };
}

export class SyncService {
  private encryption: EncryptionService;
  private syncFile = 'launchit-data.json';

  constructor(encryption: EncryptionService) {
    this.encryption = encryption;
  }

  /**
   * Test WebDAV connection
   */
  async testConnection(
    url: string,
    username: string,
    password: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const testUrl = this.normalizeUrl(url);
      const auth = Buffer.from(`${username}:${password}`).toString('base64');

      return new Promise((resolve) => {
        const request = net.request({
          method: 'PROPFIND',
          url: testUrl,
          headers: {
            'Authorization': `Basic ${auth}`,
            'Depth': '0',
          },
        });

        const timeout = setTimeout(() => {
          request.abort();
          resolve({ success: false, error: 'Connection timeout' });
        }, 10000);

        request.on('response', (response) => {
          clearTimeout(timeout);
          if (response.statusCode >= 200 && response.statusCode < 300) {
            resolve({ success: true });
          } else if (response.statusCode === 401) {
            resolve({ success: false, error: 'Invalid credentials' });
          } else {
            resolve({ success: false, error: `HTTP ${response.statusCode}` });
          }
        });

        request.on('error', (error) => {
          clearTimeout(timeout);
          resolve({ success: false, error: error.message });
        });

        request.end();
      });
    } catch (error: any) {
      return { success: false, error: error.message || 'Connection failed' };
    }
  }

  /**
   * Upload data to WebDAV
   */
  async upload(
    url: string,
    username: string,
    encryptedPassword: string,
    groups: Group[],
    items: AnyItem[],
    encryption?: { salt: string; verification: string }
  ): Promise<{ success: boolean; error?: string }> {
    try {
      // Decrypt password
      let password: string;
      try {
        password = this.encryption.decrypt(encryptedPassword);
      } catch {
        return { success: false, error: 'Failed to decrypt password. Please unlock vault.' };
      }

      const syncUrl = this.normalizeUrl(url, this.syncFile);
      const auth = Buffer.from(`${username}:${password}`).toString('base64');

      const syncData: SyncData = {
        version: 1,
        lastSync: new Date().toISOString(),
        groups,
        items,
        encryption,
      };

      const jsonData = JSON.stringify(syncData, null, 2);
      const buffer = Buffer.from(jsonData, 'utf-8');

      return new Promise((resolve) => {
        try {
          // Validate URL
          let parsedUrl: URL;
          try {
            parsedUrl = new URL(syncUrl);
          } catch {
            resolve({ success: false, error: 'Invalid URL format' });
            return;
          }

          // Ensure URL is properly formatted
          const finalUrl = parsedUrl.toString();

          const request = net.request({
            method: 'PUT',
            url: finalUrl,
            headers: {
              'Authorization': `Basic ${auth}`,
              'Content-Type': 'application/json; charset=utf-8',
            },
          });

          const timeout = setTimeout(() => {
            request.abort();
            resolve({ success: false, error: 'Upload timeout' });
          }, 30000);

          let responseReceived = false;

          request.on('response', (response) => {
            responseReceived = true;
            clearTimeout(timeout);
            if (response.statusCode >= 200 && response.statusCode < 300) {
              resolve({ success: true });
            } else {
              const chunks: Buffer[] = [];
              response.on('data', (chunk) => chunks.push(chunk));
              response.on('end', () => {
                let errorMsg = `HTTP ${response.statusCode}`;
                if (chunks.length > 0) {
                  try {
                    const errorBody = Buffer.concat(chunks).toString('utf-8');
                    const preview = errorBody.substring(0, 200).replace(/\n/g, ' ');
                    errorMsg += `: ${preview}`;
                  } catch { }
                }
                resolve({ success: false, error: errorMsg });
              });
            }
          });

          request.on('error', (error: Error) => {
            if (!responseReceived) {
              clearTimeout(timeout);
              resolve({ success: false, error: error.message || 'Network error' });
            }
          });

          // Write data - use string instead of buffer to avoid encoding issues
          const dataString = buffer.toString('utf-8');
          request.write(dataString, 'utf-8');
          request.end();
        } catch (error: any) {
          resolve({ success: false, error: error.message || 'Failed to create request' });
        }
      });
    } catch (error: any) {
      return { success: false, error: error.message || 'Upload failed' };
    }
  }

  /**
   * Download data from WebDAV
   */
  async download(
    url: string,
    username: string,
    encryptedPassword: string
  ): Promise<{ success: boolean; data?: SyncData; error?: string }> {
    try {
      // Decrypt password
      let password: string;
      try {
        password = this.encryption.decrypt(encryptedPassword);
      } catch {
        return { success: false, error: 'Failed to decrypt password. Please unlock vault.' };
      }

      const syncUrl = this.normalizeUrl(url, this.syncFile);
      const auth = Buffer.from(`${username}:${password}`).toString('base64');

      return new Promise((resolve) => {
        const request = net.request({
          method: 'GET',
          url: syncUrl,
          headers: {
            'Authorization': `Basic ${auth}`,
          },
        });

        const chunks: Buffer[] = [];
        const timeout = setTimeout(() => {
          request.abort();
          resolve({ success: false, error: 'Download timeout' });
        }, 30000);

        request.on('response', (response) => {
          clearTimeout(timeout);

          if (response.statusCode === 404) {
            resolve({ success: false, error: 'No sync data found on server' });
            return;
          }

          if (response.statusCode !== 200) {
            resolve({ success: false, error: `HTTP ${response.statusCode}` });
            return;
          }

          response.on('data', (chunk) => {
            chunks.push(chunk);
          });

          response.on('end', () => {
            try {
              const buffer = Buffer.concat(chunks);
              const json = buffer.toString('utf-8');
              const data = JSON.parse(json) as SyncData;
              resolve({ success: true, data });
            } catch (error: any) {
              resolve({ success: false, error: 'Invalid data format' });
            }
          });

          response.on('error', (error: Error) => {
            resolve({ success: false, error: error.message });
          });
        });

        request.on('error', (error) => {
          clearTimeout(timeout);
          resolve({ success: false, error: error.message });
        });

        request.end();
      });
    } catch (error: any) {
      return { success: false, error: error.message || 'Download failed' };
    }
  }

  /**
   * Normalize WebDAV URL
   */
  private normalizeUrl(baseUrl: string, file?: string): string {
    let url = baseUrl.trim();

    // Remove trailing slash
    if (url.endsWith('/')) {
      url = url.slice(0, -1);
    }

    // Add file if provided
    if (file) {
      // Encode the filename but preserve slashes in the base URL
      const encodedFile = encodeURIComponent(file);
      url = `${url}/${encodedFile}`;
    }

    return url;
  }
}

