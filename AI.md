# AI Features Usage Guide

LaunchIt includes AI-powered features using Groq's free API. Here's how to use them:

## 🚀 Quick Setup

1. **Get Groq API Key** (Free - 14,400 requests/day)
   - Visit https://console.groq.com
   - Sign up (no credit card required)
   - Create API key in API Keys section

2. **Enable in LaunchIt**
   - Open Settings (⌘,)
   - Go to "AI Features" tab
   - Paste your API key
   - Toggle "Enable AI Features" ON
   - Click "Test Connection" to verify

## ✨ All AI Features Implemented

### 1. **Smart Categorization** ✅
**What it does:** Suggests which group a new item should belong to based on its name, URL, and description.

**How to use:**
1. Click "+ Add Item" or press ⌘N
2. Enter the item name (and URL if it's a bookmark)
3. Look for the "AI Suggest" button next to the "Group" label
4. Click "AI Suggest"
5. AI analyzes the item and automatically selects the best matching group

**Example:**
- Item: "GitHub" → AI suggests "Development" group
- Item: "Figma" → AI suggests "Design" group
- Item: "YouTube" → AI suggests "Social" or "Entertainment" group

---

### 2. **Auto-Description Generation** ✅
**What it does:** Automatically generates a helpful description for bookmarks.

**How to use:**
1. Create a new bookmark item
2. Enter the name and URL
3. Look for the "AI Generate" button next to the "Description" label
4. Click "AI Generate"
5. AI creates a brief, relevant description (max 100 characters)

**Example:**
- URL: `https://github.com` → Description: "Code hosting platform for version control and collaboration"
- URL: `https://figma.com` → Description: "Collaborative interface design tool for teams"

**Note:** Only works for bookmark items (not SSH, Apps, or Passwords)

---

### 3. **Duplicate Detection** ✅
**What it does:** Automatically detects if you're creating a duplicate or similar item.

**How to use:**
1. Start creating a new item
2. As you type the name or URL, AI checks for similar existing items
3. If duplicates are found, a yellow warning box appears showing similar items
4. Review the suggestions and decide whether to continue or cancel

**Example:**
- You type "GitHub" → AI shows: "Similar items found: • GitHub (https://github.com)"
- You can then decide if you want to create a duplicate or use the existing one

**Note:** Works automatically as you type - no button needed!

---

### 4. **Smart Tagging** ✅
**What it does:** Suggests relevant tags for items.

**How to use:**
1. Create or edit an item
2. Look for the "Tags" field (below Description)
3. Click "AI Suggest" button next to the Tags label
4. AI suggests 3-5 relevant tags automatically
5. Tags appear as badges - click × to remove any
6. You can also type tags manually (comma-separated)

**Example:**
- Item: "GitHub" → AI suggests: "development", "git", "version-control", "coding"
- Item: "Figma" → AI suggests: "design", "ui", "ux", "prototyping"

**Features:**
- AI suggests tags based on name, URL, and description
- Tags displayed as removable badges
- Manual entry also supported (comma-separated)
- Tags help with organization and search

---

### 5. **Semantic Search** ✅
**What it does:** Search by meaning, not just keywords.

**How to use:**
1. Type 3+ characters in the search bar
2. AI automatically analyzes your query
3. Finds relevant items by meaning, not just exact keyword matches
4. Shows "AI searching..." indicator while processing
5. Results display with "AI search" badge

**Examples:**
- Search "database" → finds "MySQL", "PostgreSQL", "MongoDB", "Redis"
- Search "design tools" → finds "Figma", "Sketch", "Adobe XD", "InVision"
- Search "code hosting" → finds "GitHub", "GitLab", "Bitbucket"

**Features:**
- Automatically activates for queries 3+ characters
- 500ms debounce for performance
- Falls back to text search if AI unavailable
- Visual indicators show when AI is searching

---

## 📍 Where to Find AI Features

### In Add Item Modal:
- **Group Field:** "AI Suggest" button (top right of Group selector)
- **Description Field:** "AI Generate" button (top right of Description field)
- **Tags Field:** "AI Suggest" button (top right of Tags field)
- **Automatic:** Duplicate detection appears as you type

### In Search Bar:
- **Semantic Search:** Automatically activates when typing 3+ characters
- **AI Indicator:** Shows "AI" badge when semantic search is active

### In Settings:
- **AI Features Tab:** Configure API key and enable/disable features
- **Test Connection:** Verify your API key works

---

## 🎯 Best Practices

1. **Enter name first:** AI works better when you provide the item name
2. **For bookmarks:** Enter the URL for better categorization and description
3. **Review suggestions:** AI suggestions are helpful but always review them
4. **Edit if needed:** You can always edit AI-generated descriptions

---

## ⚙️ Technical Details

**AI Model:** Llama 3.1 8B Instant (via Groq)
**Speed:** Very fast (Groq uses LPU - Language Processing Unit)
**Privacy:** 
- API key stored encrypted in settings
- All processing happens via Groq's API
- No data stored by Groq (stateless)

**Free Tier Limits:**
- 14,400 requests per day
- More than enough for personal use
- No credit card required

---

## 🐛 Troubleshooting

**"AI Suggest" button not showing:**
- Make sure AI is enabled in Settings → AI Features
- Verify API key is entered and connection tested

**AI suggestions not working:**
- Check internet connection
- Verify API key is correct
- Check Groq status page if issues persist

**Slow responses:**
- Groq is usually very fast
- May be slower during high traffic
- Try again in a few seconds

---

## 🔮 Future Enhancements

Potential future features:
- Auto-organization suggestions
- Usage pattern analysis
- Natural language commands
- Smart item templates
- Context-aware suggestions

---

## 💡 Tips

1. **Use AI for bulk imports:** When importing many bookmarks, use AI to auto-categorize them
2. **Combine with manual editing:** AI is a starting point - always review and refine
3. **Test connection first:** Always test your API key before relying on AI features
4. **Monitor usage:** Groq's free tier is generous, but check your usage if needed

---

**Need help?** Check the main `README.md` or open an issue on GitHub.

