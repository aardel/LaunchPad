import { createServer, IncomingMessage, ServerResponse } from 'http';
import { URL } from 'url';
import { DatabaseService } from './database';
import type { CreateItemInput, AnyItem } from '../../shared/types';

export class ExtensionServer {
  private server: ReturnType<typeof createServer> | null = null;
  private port: number = 5174;
  private db: DatabaseService | null = null;
  private onBookmarkAdded: ((item: AnyItem) => void) | null = null;

  constructor(db: DatabaseService) {
    this.db = db;
  }

  setOnBookmarkAdded(callback: (item: AnyItem) => void): void {
    this.onBookmarkAdded = callback;
  }

  start(): void {
    if (this.server) {
      console.log('Extension server already running');
      return;
    }

    this.server = createServer((req: IncomingMessage, res: ServerResponse) => {
      this.handleRequest(req, res);
    });

    this.server.listen(this.port, '127.0.0.1', () => {
      console.log(`Extension server listening on http://localhost:${this.port}`);
    });

    this.server.on('error', (error: NodeJS.ErrnoException) => {
      if (error.code === 'EADDRINUSE') {
        console.warn(`Port ${this.port} is already in use. Extension server not started.`);
      } else {
        console.error('Extension server error:', error);
      }
    });
  }

  stop(): void {
    if (this.server) {
      this.server.close();
      this.server = null;
      console.log('Extension server stopped');
    }
  }

  private async handleRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      res.writeHead(200);
      res.end();
      return;
    }

    const url = new URL(req.url || '/', `http://${req.headers.host}`);
    const pathname = url.pathname;

    try {
      if (pathname === '/api/groups' && req.method === 'GET') {
        await this.handleGetGroups(res);
      } else if (pathname === '/api/bookmarks' && req.method === 'POST') {
        await this.handleAddBookmark(req, res);
      } else {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Not found' }));
      }
    } catch (error) {
      console.error('Extension server request error:', error);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: String(error) }));
    }
  }

  private async handleGetGroups(res: ServerResponse): Promise<void> {
    if (!this.db) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Database not available' }));
      return;
    }

    const groups = this.db.getAllGroups();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(groups));
  }

  private async handleAddBookmark(req: IncomingMessage, res: ServerResponse): Promise<void> {
    if (!this.db) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: 'Database not available' }));
      return;
    }

    let body = '';
    req.on('data', (chunk) => {
      body += chunk.toString();
    });

    req.on('end', () => {
      try {
        const data = JSON.parse(body);
        const { name, url, description, groupId } = data;

        if (!name || !url || !groupId) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: 'Missing required fields' }));
          return;
        }

        // Parse URL to extract protocol, hostname, port, path
        let urlObj: URL;
        try {
          urlObj = new URL(url);
        } catch {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: 'Invalid URL' }));
          return;
        }

        const protocol = urlObj.protocol.replace(':', '') as 'http' | 'https';
        const hostname = urlObj.hostname;
        const port = urlObj.port ? parseInt(urlObj.port, 10) : undefined;
        const path = urlObj.pathname !== '/' ? urlObj.pathname + urlObj.search : undefined;

        const input: CreateItemInput = {
          type: 'bookmark',
          name,
          description,
          groupId,
          protocol,
          port,
          path,
          networkAddresses: {
            local: hostname,
          },
        };

        const item = this.db!.createItem(input);

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, data: item }));

        // Notify via callback
        if (this.onBookmarkAdded) {
          this.onBookmarkAdded(item);
        }
      } catch (error) {
        console.error('Error processing bookmark:', error);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: String(error) }));
      }
    });
  }
}


