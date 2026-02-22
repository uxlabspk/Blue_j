# Blue J - Electron Desktop App

## Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Run the App

```bash
npm start
```

### 3. Run in Development Mode (with DevTools)

```bash
npm run dev
```

## Building Installers

### Build for Current Platform

```bash
npm run build
```

### Build for Specific Platforms

```bash
# Windows
npm run build:win

# macOS
npm run build:mac

# Linux
npm run build:linux
```

The built applications will be in the `dist/` folder.

## Features Added in Electron Version

- ✅ Native desktop application
- ✅ Cross-platform (Windows, macOS, Linux)
- ✅ Application menu with shortcuts (Ctrl+N for new chat, Ctrl+, for settings)
- ✅ Single instance lock (prevents multiple app instances)
- ✅ Native file dialogs
- ✅ Persistent storage with electron-store
- ✅ Window state management
- ✅ External links open in default browser

## Keyboard Shortcuts

- `Ctrl+N` / `Cmd+N` - New Chat
- `Ctrl+,` / `Cmd+,` - Settings
- `Ctrl+Q` / `Cmd+Q` - Quit
- `F11` - Toggle Fullscreen
- `Ctrl+R` / `Cmd+R` - Reload
- `Ctrl+Shift+I` / `Cmd+Option+I` - Toggle DevTools

## Requirements

- Node.js 16+ and npm
- Ollama running locally (http://127.0.0.1:11434)

## Adding Custom Icons

To add custom application icons:

1. Create icons in the `images/` folder:
   - `icon.png` - 512x512 PNG for Linux
   - `icon.ico` - Windows icon
   - `icon.icns` - macOS icon

2. The build configuration in `package.json` will automatically use them

## Distribution

After building, you'll get:

- **Windows**: `.exe` installer and portable version
- **macOS**: `.dmg` disk image and `.zip`
- **Linux**: `.AppImage`, `.deb`, and `.rpm` packages

Share these files with users for easy installation!
