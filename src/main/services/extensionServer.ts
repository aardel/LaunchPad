import { createServer, IncomingMessage, ServerResponse } from 'http';
import { URL } from 'url';
import { DatabaseService } from './database';
import type { CreateItemInput, AnyItem } from '../../shared/types';
import { AIService } from './aiService';

export class ExtensionServer {
  private server: ReturnType<typeof createServer> | null = null;
  private port: number = 5174;
  private db: DatabaseService | null = null;
  private aiService: AIService | null = null;
  private onBookmarkAdded: ((item: AnyItem) => void) | null = null;

  constructor(db: DatabaseService, aiService: AIService) {
    this.db = db;
    this.aiService = aiService;
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
    const searchParams = url.searchParams;

    try {
      if (pathname === '/api/groups' && req.method === 'GET') {
        await this.handleGetGroups(res);
      } else if (pathname === '/api/groups' && req.method === 'POST') {
        await this.handleCreateGroup(req, res);
      } else if (pathname === '/api/bookmarks' && req.method === 'POST') {
        await this.handleAddBookmark(req, res);
      } else if (pathname === '/api/ai/suggest-group' && req.method === 'POST') {
        await this.handleSuggestGroup(req, res);
      } else if (pathname === '/api/ai/generate-description' && req.method === 'POST') {
        await this.handleGenerateDescription(req, res);
      } else if (pathname === '/api/ai/suggest-tags' && req.method === 'POST') {
        await this.handleSuggestTags(req, res);
      } else if (pathname === '/api/bookmarks/check' && req.method === 'POST') {
        await this.handleCheckUrl(req, res);
      } else if (pathname === '/api/search' && req.method === 'GET') {
        await this.handleSearch(req, res, searchParams);
      } else if (pathname === '/api/stats' && req.method === 'GET') {
        await this.handleGetStats(res);
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

  private async handleCreateGroup(req: IncomingMessage, res: ServerResponse): Promise<void> {
    if (!this.db) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: 'Database not available' }));
      return;
    }

    this.processBody(req, res, async (data) => {
      const { name, icon } = data;

      if (!name) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: 'Group name is required' }));
        return;
      }

      try {
        const group = this.db!.createGroup({ name, icon: icon || '📁' });
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, data: group }));
      } catch (error) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: String(error) }));
      }
    });
  }

  private async handleAddBookmark(req: IncomingMessage, res: ServerResponse): Promise<void> {
    if (!this.db) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: 'Database not available' }));
      return;
    }

    this.processBody(req, res, async (data) => {
      const { name, url, description, groupId, tags } = data;

      if (!name || !url || !groupId) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: 'Missing required fields' }));
        return;
      }

      // Parse tags
      let tagList: string[] = [];
      if (Array.isArray(tags)) {
        tagList = tags;
      } else if (typeof tags === 'string') {
        tagList = tags.split(',').map(t => t.trim()).filter(t => t.length > 0);
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
        tags: tagList,
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
    });
  }

  private async handleSuggestGroup(req: IncomingMessage, res: ServerResponse): Promise<void> {
    if (!this.aiService || !this.aiService.isEnabled()) {
      res.writeHead(503, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: 'AI service not enabled' }));
      return;
    }

    this.processBody(req, res, async (data) => {
      const { title, url, html } = data;
      const result = await this.aiService!.categorizeItem(title || '', url, html);

      // If we got a category name, try to find the group ID
      let groupId = '';
      if (result && this.db) {
        const groups = this.db.getAllGroups();
        // Try strict match first, then case-insensitive
        const group = groups.find(g => g.name === result) ||
          groups.find(g => g.name.toLowerCase() === result.toLowerCase());

        if (group) {
          groupId = group.id;
        }
      }

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, data: { groupName: result, groupId } }));
    });
  }

  private async handleGenerateDescription(req: IncomingMessage, res: ServerResponse): Promise<void> {
    if (!this.aiService || !this.aiService.isEnabled()) {
      res.writeHead(503, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: 'AI service not enabled' }));
      return;
    }

    this.processBody(req, res, async (data) => {
      const { title, url } = data;
      const result = await this.aiService!.generateDescription(title || '', url);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, data: result }));
    });
  }

  private async handleSuggestTags(req: IncomingMessage, res: ServerResponse): Promise<void> {
    if (!this.aiService || !this.aiService.isEnabled()) {
      res.writeHead(503, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: 'AI service not enabled' }));
      return;
    }

    this.processBody(req, res, async (data) => {
      const { title, url, description } = data;
      const result = await this.aiService!.suggestTags(title || '', url, description);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, data: result }));
    });
  }

  private async handleCheckUrl(req: IncomingMessage, res: ServerResponse): Promise<void> {
    this.processBody(req, res, async (data) => {
      const { url } = data;
      if (!url || !this.db) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: 'Missing URL' }));
        return;
      }

      const items = this.db.getAllItems();
      const existing = items.find(item => {
        const itemUrl = this.getItemUrl(item);
        if (itemUrl) return itemUrl.toLowerCase() === url.toLowerCase();
        return false;
      });

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, exists: !!existing, item: existing }));
    });
  }

  private async handleSearch(req: IncomingMessage, res: ServerResponse, params: URLSearchParams): Promise<void> {
    if (!this.db) {
      res.writeHead(503, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: 'Database not initialized' }));
      return;
    }

    const query = params.get('q');
    if (!query) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, data: [] }));
      return;
    }

    const results = this.db.searchItems(query).slice(0, 20);

    const safeResults = results.map(item => ({
      id: item.id,
      name: item.name,
      url: this.getItemUrl(item),
      icon: item.icon
    }));

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true, data: safeResults }));
  }

  private getItemUrl(item: AnyItem): string | undefined {
    if (item.type === 'bookmark') {
      const host = item.networkAddresses.local || item.networkAddresses.tailscale || item.networkAddresses.vpn || item.networkAddresses.custom;
      if (!host) return undefined;
      const port = item.port ? `:${item.port}` : '';
      const path = item.path || '';
      return `${item.protocol}://${host}${port}${path}`;
    }
    if (item.type === 'password') {
      return item.url;
    }
    return undefined;
  }

  private async handleGetStats(res: ServerResponse): Promise<void> {
    if (!this.db) {
      res.writeHead(503, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: 'Database not initialized' }));
      return;
    }

    const items = this.db.getAllItems();
    const groups = this.db.getAllGroups();

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      success: true,
      data: {
        itemsCount: items.length,
        groupsCount: groups.length,
        version: '1.1.0',
        aiEnabled: this.aiService ? this.aiService.isEnabled() : false
      }
    }));
  }

  private processBody(req: IncomingMessage, res: ServerResponse, callback: (data: any) => Promise<void>): void {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk.toString();
    });

    req.on('end', async () => {
      try {
        const data = JSON.parse(body);
        await callback(data);
      } catch (error) {
        console.error('Extension server request processing error:', error);
        if (!res.writableEnded) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: String(error) }));
        }
      }
    });
  }
}
