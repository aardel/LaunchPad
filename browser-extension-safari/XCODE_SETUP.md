# Setting Up Safari Extension in Xcode

Since Safari requires extensions to be built as Safari App Extensions, here's a step-by-step guide:

## Step 1: Create Xcode Project

1. Open Xcode
2. File → New → Project
3. Select "macOS" → "App"
4. Click "Next"
5. Fill in:
   - Product Name: `LaunchItExtension`
   - Team: Your Apple Developer account (or "None" for development)
   - Organization Identifier: `com.yourname` (or similar)
   - Language: Swift
   - Interface: SwiftUI (or AppKit)
6. Click "Next" and save the project

## Step 2: Add Safari Web Extension Target

1. In Xcode, click on your project in the navigator
2. Click the "+" button at the bottom of the targets list
3. Select "Safari Web Extension"
4. Click "Next"
5. Fill in:
   - Extension Name: `LaunchIt Quick Add`
   - Bundle Identifier: `com.yourname.LaunchItExtension.LaunchItQuickAdd`
6. Click "Finish"

Xcode will create a basic extension structure.

## Step 3: Replace Extension Files

1. In the project navigator, find the Safari Web Extension target folder
2. Delete the default files (if any)
3. Copy all files from `browser-extension-safari/`:
   - `manifest.json`
   - `popup.html`
   - `popup.css`
   - `popup.js`
   - `background.js`
   - `content.js`
   - `icons/` folder (all icon files)

4. In Xcode:
   - Right-click the extension target folder
   - Select "Add Files to [Project Name]"
   - Select all the files you copied
   - Make sure "Copy items if needed" is checked
   - Make sure the extension target is selected in "Add to targets"

## Step 4: Configure Build Settings

1. Select your project in the navigator
2. Select the Safari Web Extension target
3. Go to "Signing & Capabilities"
4. Select your development team (or leave as "None" for development)
5. Make sure "Automatically manage signing" is enabled

## Step 5: Build and Run

1. Select the macOS App scheme (not the extension)
2. Build the project (⌘B)
3. Run the app (⌘R)
4. The first time you run it, macOS will ask for permission
5. Safari will automatically open and ask if you want to enable the extension

## Step 6: Enable in Safari

1. Go to Safari → Settings → Extensions
2. Find "LaunchIt Quick Add"
3. Toggle it ON
4. Grant any required permissions

## Troubleshooting

**Extension doesn't appear:**
- Make sure you're running the macOS App, not just building the extension
- Check Safari → Settings → Extensions
- Restart Safari

**Build errors:**
- Make sure all files are added to the extension target
- Check that `manifest.json` is valid
- Verify file paths are correct

**Permission errors:**
- Go to System Settings → Privacy & Security → Extensions
- Make sure Safari extensions are allowed
- Check that your app is allowed to add extensions

## Distribution

To distribute the extension:
1. Archive the app in Xcode (Product → Archive)
2. Export for distribution
3. Users need to run the app once to install the extension
4. Or submit to the Mac App Store (requires Apple Developer account)

