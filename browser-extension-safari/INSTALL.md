# Quick Install Guide for Safari

## Method 1: Using Developer Settings (Recommended)

1. **Enable Developer Menu:**
   - Open Safari
   - Go to Safari → Settings → Advanced
   - Check "Show Develop menu in menu bar"

2. **Enable Extension Development:**
   - Go to Develop → Developer Settings...
   - Look for "Allow Unsigned Extensions" or "Enable Extension Development"
   - Enable it if available

3. **Check Feature Flags:**
   - Go to Develop → Feature Flags...
   - Look for any Safari Web Extension related flags
   - Enable them if needed

4. **Install Extension:**
   - Go to Safari → Settings → Extensions
   - Look for an option to "Add Extension" or "Load Extension"
   - If available, select the `browser-extension-safari` folder
   - OR try dragging the folder into Safari's Extensions preferences

5. **Enable Extension:**
   - In Safari → Settings → Extensions
   - Find "Launchpad Quick Add" (if it appears)
   - Toggle it ON

## Method 2: Using Xcode (For Proper Distribution)

Safari Web Extensions need to be packaged as a Safari App Extension:

1. **Create Xcode Project:**
   - Open Xcode
   - Create a new macOS App project
   - Add a "Safari Web Extension" target

2. **Add Extension Files:**
   - Copy all files from `browser-extension-safari/` to the extension target
   - Build the project

3. **Install:**
   - Run the app once
   - Go to Safari → Settings → Extensions
   - Enable the extension

## Method 3: Manual Installation

1. **Enable Developer Features:**
   - Safari → Settings → Advanced → Check "Show Develop menu"
   - Develop → Developer Settings... → Enable extension development

2. **Load Extension:**
   - Try Safari → Settings → Extensions
   - Look for "Add Extension" or similar option
   - Select the `browser-extension-safari` folder

## Troubleshooting

**Extension options not available:**
- Safari Web Extensions require Safari 14+ (macOS Big Sur or later)
- Some features may require Xcode and proper code signing
- Check if your Safari version supports Web Extensions

**Extension doesn't appear:**
- Restart Safari completely
- Check Safari → Settings → Extensions
- Verify the extension files are in the correct location
- Try using Xcode to build a proper Safari App Extension

**Connection errors:**
- Verify Launchpad is running
- Check that port 5174 is not blocked
- Try clicking the status indicator to retry connection

**Note:** Modern Safari may require extensions to be distributed through the App Store or built as proper Safari App Extensions using Xcode. The manual loading method may not be available in all Safari versions.

