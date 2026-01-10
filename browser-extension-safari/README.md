# LaunchIt Safari Extension

Safari Web Extension for quickly adding bookmarks to LaunchIt from Safari.

## Installation

Safari Web Extensions require a different installation process than Chrome/Firefox extensions. Modern Safari typically requires extensions to be built as Safari App Extensions using Xcode.

### Option 1: Using Developer Settings (Try First)

1. Open Safari
2. Go to Safari → Settings → Advanced
3. Check "Show Develop menu in menu bar"
4. Go to Develop → Developer Settings...
5. Look for extension-related options and enable them
6. Go to Safari → Settings → Extensions
7. Try to add/load the extension from there

**Note:** This method may not be available in all Safari versions. Safari may require proper code signing.

### Option 2: Build as Safari App Extension (Recommended)

Modern Safari requires extensions to be built as Safari App Extensions using Xcode:

1. **Create Xcode Project:**
   - Open Xcode
   - Create a new macOS App project
   - Add a "Safari Web Extension" target when creating the project
   - OR add it later: File → New → Target → Safari Web Extension

2. **Add Extension Files:**
   - Copy all files from `browser-extension-safari/` to the extension target's folder
   - In Xcode, add the files to the extension target
   - Make sure `manifest.json`, `popup.html`, `popup.js`, `popup.css`, `background.js`, `content.js` are included
   - Add the `icons/` folder as well

3. **Build and Run:**
   - Build the project (⌘B)
   - Run the app (⌘R)
   - The first time you run it, Safari will prompt you to enable the extension

4. **Enable Extension:**
   - Go to Safari → Settings → Extensions
   - Find "Launchpad Quick Add"
   - Toggle it ON
   - Grant any required permissions

## Usage

1. Make sure LaunchIt is running (listening on `http://localhost:5174`)
2. Click the LaunchIt extension icon in Safari's toolbar
3. Fill in bookmark details (name, URL, description, group)
4. Click "Add to LaunchIt"
5. The bookmark will be added to your selected group

## Differences from Chrome Extension

- Safari Web Extensions use the same manifest format as Chrome (Manifest V3)
- The code is identical, but Safari may have slightly different behavior
- Safari requires proper code signing for distribution
- Development extensions need to be enabled in Safari settings

## Troubleshooting

**Extension not showing:**
- Make sure "Show Develop menu" is enabled in Safari → Settings → Advanced
- Check Safari → Settings → Extensions to see if it's listed
- Try restarting Safari

**Connection errors:**
- Make sure LaunchIt is running
- Check that the extension server is listening on port 5174
- Verify `http://localhost:5174/api/groups` is accessible

**Permission errors:**
- Safari may prompt for permissions when first using the extension
- Check Safari → Settings → Extensions → LaunchIt Quick Add → Permissions

## Development

To modify the extension:
- Edit `popup.html`, `popup.css`, `popup.js` for the popup UI
- Edit `manifest.json` for extension permissions and configuration
- After changes, reload the extension in Safari → Settings → Extensions

## Notes

- Safari Web Extensions are supported in Safari 14+ (macOS Big Sur+)
- The extension works the same way as the Chrome version
- All code is shared between Chrome and Safari versions
