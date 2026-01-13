/**
 * AI Service using Groq API
 * Groq provides fast inference with generous free tier (14,400 requests/day)
 * API: https://console.groq.com/docs
 */

export interface AIConfig {
  apiKey?: string | null;
  enabled: boolean;
}

export class AIService {
  private apiKey: string | null = null;
  private baseUrl = 'https://api.groq.com/openai/v1';
  private enabled = false;

  constructor(config?: AIConfig) {
    if (config?.apiKey) {
      this.apiKey = config.apiKey;
      this.enabled = config.enabled;
    }
  }

  setApiKey(apiKey: string | null | undefined): void {
    this.apiKey = apiKey || null;
    if (apiKey) {
      this.enabled = true;
    }
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  isEnabled(): boolean {
    return this.enabled && !!this.apiKey;
  }

  /**
   * Generate embeddings for semantic search
   * Note: Groq doesn't have embeddings API, so we'll use text generation for similarity
   */
  async getEmbedding(text: string): Promise<number[] | null> {
    // Groq doesn't have embeddings, so we'll use a workaround
    // For now, return null and use text-based similarity
    return null;
  }

  /**
   * Generate text using Groq's fast inference
   */
  async generateText(prompt: string, maxTokens: number = 150): Promise<string | null> {
    if (!this.isEnabled()) return null;

    try {
      console.log(`[AIService] Generating text with model llama-3.1-8b-instant. Tokens: ${maxTokens}`);
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'llama-3.1-8b-instant', // Fast, free model
          messages: [
            {
              role: 'user',
              content: prompt,
            },
          ],
          max_tokens: maxTokens,
          temperature: 0.7,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[AIService] Groq API Error (${response.status}):`, errorText);
        return null;
      }

      const data = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
      const content = data.choices?.[0]?.message?.content?.trim() || null;
      console.log('[AIService] Generation success:', content ? 'Content received' : 'No content');
      return content;
    } catch (error) {
      console.error('[AIService] Network/Runtime Error:', error);
      return null;
    }
  }

  /**
   * Categorize an item into a group
   */
  async categorizeItem(name: string, url?: string, description?: string): Promise<string | null> {
    if (!this.isEnabled()) return null;

    const context = [name, url, description].filter(Boolean).join(' - ');
    const prompt = `Analyze this bookmark and suggest a single, concise category name (1-2 words). Examples: Development, Design, DevOps, Productivity, Social, News, Tools.

Bookmark: ${context}

Category:`;

    const result = await this.generateText(prompt, 20);
    return result ? result.replace(/['"]/g, '').trim() : null;
  }

  /**
   * Generate a description for an item
   */
  async generateDescription(name: string, url?: string): Promise<string | null> {
    if (!this.isEnabled()) return null;

    const prompt = `Generate a brief, helpful description (1 sentence, max 100 characters) for this bookmark:

Name: ${name}
URL: ${url || 'N/A'}

Description:`;

    return await this.generateText(prompt, 50);
  }

  /**
   * Suggest tags for an item
   */
  async suggestTags(name: string, url?: string, description?: string): Promise<string[] | null> {
    if (!this.isEnabled()) return null;

    const context = [name, url, description].filter(Boolean).join(' - ');
    const prompt = `Suggest 3-5 relevant tags (single words, lowercase, comma-separated) for this bookmark:

${context}

Tags:`;

    const result = await this.generateText(prompt, 30);
    if (!result) return null;

    return result
      .split(',')
      .map(tag => tag.trim().toLowerCase())
      .filter(tag => tag.length > 0)
      .slice(0, 5);
  }

  /**
   * Find duplicate or similar items using text similarity
   */
  async findSimilarItems(
    itemName: string,
    itemUrl?: string,
    existingItems: Array<{ name: string; url?: string; id: string }> = []
  ): Promise<Array<{ id: string; name: string; url?: string; similarity: string }> | null> {
    if (!this.isEnabled() || existingItems.length === 0) return null;

    // Use Groq to find similar items
    const itemsList = existingItems
      .slice(0, 20) // Limit for performance
      .map((item, idx) => `${idx + 1}. ${item.name}${item.url ? ` (${item.url})` : ''}`)
      .join('\n');

    const prompt = `Find items similar to this bookmark. Return only the numbers (comma-separated) of similar items, or "none" if no similar items found.

New bookmark: ${itemName}${itemUrl ? ` (${itemUrl})` : ''}

Existing items:
${itemsList}

Similar item numbers (or "none"):`;

    const result = await this.generateText(prompt, 20);
    if (!result || result.toLowerCase().includes('none')) return null;

    // Parse result and return similar items
    const numbers = result
      .split(',')
      .map(n => parseInt(n.trim()))
      .filter(n => !isNaN(n) && n > 0 && n <= existingItems.length);

    return numbers.map(num => {
      const item = existingItems[num - 1];
      return {
        id: item.id,
        name: item.name,
        url: item.url,
        similarity: 'high', // Groq found it similar
      };
    });
  }

  /**
   * Semantic search - find items by meaning, not just keywords
   */
  async semanticSearch(
    query: string,
    items: Array<{ name: string; description?: string; url?: string; id: string }>
  ): Promise<Array<{ id: string; name: string; description?: string; url?: string; relevance: string }> | null> {
    if (!this.isEnabled() || items.length === 0) return null;

    // Limit to 30 items for performance
    const itemsToSearch = items.slice(0, 30);
    const itemsList = itemsToSearch
      .map((item, idx) => `${idx + 1}. ${item.name}${item.description ? ` - ${item.description}` : ''}${item.url ? ` (${item.url})` : ''}`)
      .join('\n');

    const prompt = `Find items that are DIRECTLY related to this search query. Be strict - only include items that are clearly relevant. Return only the numbers (comma-separated) of relevant items, ordered by relevance.

Search query: "${query}"

Items:
${itemsList}

Instructions:
- Only include items that are directly related to the search query
- Prefer exact matches in name, description, or URL
- Exclude items that are only loosely related
- Return at most 10 most relevant items

Relevant item numbers (comma-separated, most relevant first):`;

    const result = await this.generateText(prompt, 30);
    if (!result) return null;

    // Parse result
    const numbers = result
      .split(',')
      .map(n => parseInt(n.trim()))
      .filter(n => !isNaN(n) && n > 0 && n <= itemsToSearch.length);

    return numbers.map(num => {
      const item = itemsToSearch[num - 1];
      return {
        id: item.id,
        name: item.name,
        description: item.description,
        url: item.url,
        relevance: 'high',
      };
    });
  }

  /**
   * Test API connection
   */
  async testConnection(): Promise<{ success: boolean; error?: string }> {
    if (!this.isEnabled()) {
      return { success: false, error: 'AI service not enabled' };
    }

    try {
      const result = await this.generateText('Say "OK" if you can read this.', 10);
      if (result) {
        return { success: true };
      }
      return { success: false, error: 'No response from API' };
    } catch (error: any) {
      return { success: false, error: error.message || 'Connection failed' };
    }
  }
}
