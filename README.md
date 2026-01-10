# LaunchIt 🚀

A powerful, modern launcher for bookmarks, SSH connections, apps, and passwords with network profile support (Tailscale, VPN, Local). Features AI-powered categorization, semantic search, automatic backups, browser extensions, and more. Built with Electron, React, and TypeScript.

![LaunchIt Screenshot](assets/screenshot.png)

## ✨ Features

### 📚 Multi-Type Items
- **Bookmarks** - Web URLs, local services, IP addresses with ports
- **SSH Connections** - Opens directly in your terminal with saved credentials
- **App Shortcuts** - Launch local applications with custom arguments
- **Password Manager** - Securely store and copy passwords with encrypted credentials

### 🌐 Network Profiles
Switch between different network contexts seamlessly:
- **Local (LAN)** - Use local IP addresses (192.168.x.x)
- **Tailscale** - Use Tailscale MagicDNS addresses (server.tailnet.ts.net)
- **VPN** - Use VPN addresses (10.x.x.x)
- **Custom** - Define your own network profiles

### 🔒 Security & Encryption
- **Encrypted Credentials** - All passwords and sensitive data encrypted at rest
- **Vault System** - Master password protection for encrypted data
- **Vault Reset** - Securely reset your vault if you forget your password (clears encrypted data, keeps bookmarks)
- **Secure Storage** - Credentials never stored in plain text

### 🎯 Smart Features
- **Recent Items** - Quick access to recently used items with relative time display
- **Batch Open** - Open all items in a group with one click
- **Auto Tailscale Detection** - Automatically detects Tailscale connection status
- **Port Preservation** - Maintains port numbers across network profiles
- **Health Check** - Monitor bookmark availability and response times
- **Favicon Support** - Automatic favicon fetching and caching
- **Automatic Backup** - Auto-backup before major changes (delete, update, batch operations)
- **Undo Functionality** - One-click undo to restore previous state

### 🌐 Browser Integration
- **Browser Extensions** - Quick-add bookmarks from Chrome, Firefox, Edge, Brave, Arc, and Safari
- **Browser Bookmark Import** - Import bookmarks from Chrome, Firefox, Safari, and more
- **Local Extension Server** - Built-in HTTP server for browser extension communication
- **Browser-Specific Launching** - Force `chrome://`, `edge://`, `brave://`, `opera://` URLs to open in their respective browsers
- **Native Browser Support** - Added support for Opera and ChatGPT desktop app URLs

### 🖥️ Desktop Integration
- **Menu Bar Tray** - "LaunchIt" tray icon (🔖) for quick access to groups and bookmarks without opening the main window
- **Global Shortcuts** - Launch items and toggle visibility with keyboard shortcuts

### 🔄 Sync & Backup
- **WebDAV/Nextcloud Sync** - Sync your data across devices
- **Import/Export** - Backup and restore your data
- **Encrypted Sync** - End-to-end encrypted synchronization
- **Automatic Backups** - Hourly auto-backups with custom retention policy
- **Custom Backup Location** - specificy where backups are stored
- **One-Click Undo** - Restore from most recent backup with undo button

### 🎨 Modern Dashboard UI
- **Card View** - Beautiful card-based layout
- **List View** - Compact list view for power users
- **Dark/Light Themes** - System-aware theme switching
- **Drag-and-Drop** - Reorder items and groups with drag-and-drop
- **Search** - Fast, real-time search across all items
- **Group Organization** - Organize with custom icons, colors, and folders
- **Collapsible Groups** - Expand/collapse groups in sidebar
- **Selection Mode** - Multi-select items for batch operations

### 🤖 AI-Powered Features (Groq Integration)
- **Smart Categorization** - AI suggests the best group for new items
- **Auto-Description Generation** - AI creates helpful descriptions for bookmarks
- **Smart Tagging** - AI suggests relevant tags based on content
- **Duplicate Detection** - Automatically finds similar items before creating
- **Semantic Search** - Search by meaning, not just keywords (3+ characters)
- **Free Tier** - 14,400 requests/day via Groq's free API

### 🔍 Advanced Features
- **Tags System** - Tag items for flexible organization with AI suggestions
- **Access Tracking** - Track when and how often items are accessed
- **Custom Icons** - Use emojis or custom icons for groups and items
- **Batch Operations** - Delete, move, or edit multiple items at once
- **Keyboard Shortcuts** - Full keyboard navigation support

## 🚀 Installation

### Prerequisites
- Node.js 18+ 
- npm or yarn
- Tailscale (optional, for network switching)

### Setup

```bash
# Clone the repository
git clone https://github.com/aardel/LaunchIt.git
cd LaunchIt

# Install dependencies
npm install

# Start development mode
npm run dev
```

### Building

```bash
# Build for production
npm run build

# Package for your platform
npm run package:mac    # macOS
npm run package:win    # Windows  
npm run package:linux  # Linux
```

## 📖 Usage

### Adding Items

1. Click **"+ Add Item"** button or press `⌘/Ctrl + N`
2. Select item type (Bookmark, SSH, App, or Password)
3. Fill in the details:
   - **Name** - Display name for the item
   - **Group** - Which folder to organize it in
   - **Network Addresses** - Different addresses for each network profile
   - **Credentials** - Username/password (encrypted)

### Network Profiles

Each bookmark/SSH item can have multiple addresses:

| Profile | Use Case | Example |
|---------|----------|---------|
| Local | Home/Office LAN | `192.168.1.100` |
| Tailscale | Remote via Tailscale | `server.tailnet.ts.net` |
| VPN | Corporate VPN | `10.0.0.100` |
| Custom | Custom network | Your custom address |

Switch profiles using the dropdown in the title bar. All items will use the corresponding address.

### Browser Extension

**Chrome/Edge/Brave/Arc:**
1. Go to `chrome://extensions/`
2. Enable "Developer mode"
3. Click "Load unpacked"
3. Click "Load unpacked"
4. Select the `LaunchIt-Extension-Chromium` folder

**Firefox:**
1. Go to `about:debugging`
2. Click "Load Temporary Add-on"
3. Select `LaunchIt-Extension-Chromium/manifest.json`

**Safari:**
See `LaunchIt-Extension-Safari/README.md` for installation instructions.

Once installed, click the extension icon while browsing to quickly add bookmarks to LaunchIt.

### Importing Bookmarks

1. Go to Settings → Import
2. Select "Import from Browser"
3. Choose your browser (Chrome, Firefox, Safari, etc.)
4. Select a group to import into
5. Preview and import bookmarks

### Recent Items

Access your recently used items in the sidebar. The Recent Items section shows:
- Last 30 accessed items (displays top 10)
- Relative time (e.g., "2 hours ago")
- Quick launch with one click
- Collapsible to save space

### AI Features

LaunchIt includes AI-powered features using Groq's free API (14,400 requests/day):

1. **Enable AI:**
   - Go to Settings → AI Features
   - Enter your Groq API key (get one free at https://console.groq.com)
   - Toggle "Enable AI Features" ON
   - Test connection

2. **Smart Categorization:**
   - When creating items, click "AI Suggest" next to Group field
   - AI automatically selects the best group

3. **Auto-Description:**
   - For bookmarks, click "AI Generate" next to Description
   - AI creates helpful descriptions automatically

4. **Smart Tagging:**
   - Click "AI Suggest" next to Tags field
   - AI suggests 3-5 relevant tags

5. **Semantic Search:**
   - Type 3+ characters in search bar
   - AI finds items by meaning, not just keywords
   - Shows "AI search" indicator when active

6. **Duplicate Detection:**
   - Automatically detects similar items as you type
   - Shows warning with similar items found

See `AI.md` for detailed instructions.

### Automatic Backup & Undo

LaunchIt automatically creates backups before major changes:
- **Automatic Backups:** Created before delete, update, or batch operations
- **Undo Button:** Appears in title bar when backup is available
- **One-Click Restore:** Click undo to restore previous state
- **Smart Cleanup:** Keeps last 10 backups automatically

**How to use:**
1. Make changes (delete, update items)
2. Undo button appears in title bar
3. Click "Undo" to restore previous state
4. Confirmation dialog prevents accidental restores

### Batch Operations

1. Click the selection icon in the title bar
2. Select multiple items
3. Use batch operations bar to:
   - Delete selected items
   - Move to different group
   - Edit in bulk

### SSH Connections

SSH connections open directly in your default terminal:
- **macOS**: Terminal.app (configurable to iTerm2, Warp, etc.)
- **Windows**: Windows Terminal or cmd
- **Linux**: gnome-terminal, konsole, or xterm

Credentials are encrypted and securely stored.

### Password Manager

1. Create a password item
2. Enter service name, username, and password
3. Password is encrypted and stored securely
4. Click the item to copy password to clipboard
5. Optionally open associated URL

## 🛠️ Tech Stack

- **Electron** - Desktop application framework
- **React 18** - UI framework
- **TypeScript** - Type safety
- **Tailwind CSS** - Styling
- **SQLite** - Local database (sql.js)
- **Zustand** - State management
- **Lucide React** - Icons
- **@dnd-kit** - Drag and drop

## 📁 Project Structure

```
src/
├── main/                 # Electron main process
│   ├── index.ts          # Main entry point
│   ├── preload.ts        # Preload script for IPC
│   └── services/
│       ├── database.ts   # SQLite database service
│       ├── tailscale.ts  # Tailscale detection
│       ├── launcher.ts   # URL/SSH/App launcher
│       ├── encryption.ts # Credential encryption
│       ├── sync.ts       # WebDAV/Nextcloud sync
│       ├── favicon.ts    # Favicon fetching
│       ├── healthCheck.ts # Health monitoring
│       ├── browserBookmarks.ts # Browser import
│       ├── extensionServer.ts  # Browser extension server
│       └── browsers.ts   # Browser detection
│
├── renderer/             # React frontend
│   ├── components/
│   │   ├── Dashboard/    # Main dashboard view
│   │   ├── Sidebar/      # Groups sidebar
│   │   ├── TitleBar/     # App title bar
│   │   └── Modals/       # Add/Edit/Settings modals
│   ├── store/            # Zustand state store
│   ├── styles/           # CSS and Tailwind
│   ├── utils/            # Utility functions
│   └── App.tsx           # Root component
│
└── shared/               # Shared types
    └── types.ts          # TypeScript interfaces

browser-extension/        # Chrome/Firefox extension
browser-extension-safari/ # Safari extension
```

## ⌨️ Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `⌘/Ctrl + N` | Add new item |
| `⌘/Ctrl + F` | Focus search |
| `⌘/Ctrl + ,` | Open settings |
| `⌘/Ctrl + S` | Sync data |
| `Esc` | Close modals, exit selection mode |

## 🗺️ Roadmap

- [x] Browser extension for quick-add
- [x] Recent items view
- [x] Recent Quick Search (Global Launcher)
- [x] Browser bookmark import
- [x] Health checker
- [x] Drag-and-drop reordering
- [x] WebDAV/Nextcloud sync
- [x] Password manager
- [x] Favicon support
- [x] Bulk edit (Find & Replace)
- [x] Command palette (Cmd+K)
- [ ] Favorites/starred items
- [ ] Full tags UI
- [ ] Item templates
- [ ] Custom icon library
- [ ] Usage statistics

## 📝 License

MIT License - feel free to use and modify as you like!

---

Built with ❤️ for the homelab community
