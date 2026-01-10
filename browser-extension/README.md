# LaunchIt Browser Extension

Browser extension for quickly adding bookmarks to LaunchIt from your browser.

## Installation

### Chrome/Edge/Brave/Arc

1. Open Chrome/Edge/Brave/Arc
2. Go to `chrome://extensions/` (or `edge://extensions/` for Edge)
3. Enable "Developer mode" (toggle in top right)
4. Click "Load unpacked"
5. Select the `browser-extension` folder

### Firefox

1. Open Firefox
2. Go to `about:debugging`
3. Click "This Firefox"
4. Click "Load Temporary Add-on"
5. Select the `manifest.json` file in the `browser-extension` folder

## Usage

1. Make sure LaunchIt is running
2. Click the LaunchIt extension icon in your browser toolbar
3. Fill in the bookmark details (name, URL, description, group)
4. Click "Add to LaunchIt"
5. The bookmark will be added to your selected group

## Configuration

The extension connects to LaunchIt at `http://localhost:5174` by default. This is configured automatically when LaunchIt starts.

## Safari Support

For Safari, see the `browser-extension-safari/` folder. Safari can also convert this Chrome extension automatically:
1. Enable "Show Develop menu" in Safari → Settings → Advanced
2. Go to Develop → Show Extension Builder
3. Click "Convert a Web Extension"
4. Select this `browser-extension` folder

## Development

To modify the extension:
- Edit `popup.html`, `popup.css`, `popup.js` for the popup UI
- Edit `manifest.json` for extension permissions and configuration
- After changes, reload the extension in your browser

