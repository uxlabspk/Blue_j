const {
  app,
  BrowserWindow,
  Menu,
  shell,
  ipcMain,
  dialog,
  safeStorage,
} = require("electron");
const path = require("path");
const Store = require("electron-store");
const { spawn } = require("child_process");
const fs = require("fs");

const store = new Store();
const PROJECT_ROOT = path.resolve(__dirname, "../../");

let mainWindow;

function resolveWorkspacePath(relativePath = ".") {
  const resolved = path.resolve(PROJECT_ROOT, relativePath);
  const rootWithSep = PROJECT_ROOT.endsWith(path.sep)
    ? PROJECT_ROOT
    : `${PROJECT_ROOT}${path.sep}`;

  if (resolved !== PROJECT_ROOT && !resolved.startsWith(rootWithSep)) {
    throw new Error("Path is outside the workspace root");
  }

  return resolved;
}

function resolveTargetPath(inputPath = ".") {
  if (typeof inputPath !== "string" || !inputPath.trim()) {
    throw new Error("A non-empty path string is required");
  }

  const trimmed = inputPath.trim();
  if (path.isAbsolute(trimmed)) {
    return path.normalize(trimmed);
  }

  return path.resolve(PROJECT_ROOT, trimmed);
}

function normalizeReadRange(startLine, endLine, maxLines = 400) {
  const start = Math.max(1, Number.isFinite(startLine) ? startLine : 1);
  const safeEnd = Number.isFinite(endLine) ? endLine : start + maxLines - 1;
  const end = Math.max(start, Math.min(safeEnd, start + maxLines - 1));
  return { start, end };
}

// Create the browser window
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 800,
    minHeight: 600,
    webPreferences: {
      preload: path.join(__dirname, "../preload/index.js"),
      contextIsolation: true,
      nodeIntegration: false,
      enableRemoteModule: false,
    },
    backgroundColor: "#0f0f0f",
    icon: path.join(__dirname, "../../images/icon.png"),
    show: false, // Don't show until ready
    frame: true,
    titleBarStyle: "default",
  });

  // Load the index.html file
  mainWindow.loadFile(path.join(__dirname, "../../public/index.html"));

  // Show window when ready to prevent visual flash
  mainWindow.once("ready-to-show", () => {
    mainWindow.show();
  });

  // Open external links in default browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });

  // Create application menu
  createMenu();

  // Handle window close
  mainWindow.on("closed", () => {
    mainWindow = null;
  });

  // Open DevTools in development mode (optional)
  if (process.argv.includes("--dev")) {
    mainWindow.webContents.openDevTools();
  }
}

// Create application menu
function createMenu() {
  const template = [
    {
      label: "File",
      submenu: [
        {
          label: "New Chat",
          accelerator: "CmdOrCtrl+N",
          click: () => {
            mainWindow.webContents.send("new-chat");
          },
        },
        { type: "separator" },
        {
          label: "Settings",
          accelerator: "CmdOrCtrl+,",
          click: () => {
            mainWindow.webContents.send("open-settings");
          },
        },
        { type: "separator" },
        {
          label: "Exit",
          accelerator: "CmdOrCtrl+Q",
          click: () => {
            app.quit();
          },
        },
      ],
    },
    {
      label: "Edit",
      submenu: [
        { role: "undo" },
        { role: "redo" },
        { type: "separator" },
        { role: "cut" },
        { role: "copy" },
        { role: "paste" },
        { role: "selectAll" },
      ],
    },
    {
      label: "View",
      submenu: [
        { role: "reload" },
        { role: "forceReload" },
        { role: "toggleDevTools" },
        { type: "separator" },
        { role: "resetZoom" },
        { role: "zoomIn" },
        { role: "zoomOut" },
        { type: "separator" },
        { role: "togglefullscreen" },
      ],
    },
    {
      label: "Help",
      submenu: [
        {
          label: "About Blue J",
          click: () => {
            dialog.showMessageBox(mainWindow, {
              type: "info",
              title: "About Blue J",
              message: "Blue J v1.0.0",
              detail:
                "A modern chat interface for Ollama AI models\n\n© 2026 Muhammad",
              buttons: ["OK"],
            });
          },
        },
        {
          label: "Check for Updates",
          click: () => {
            shell.openExternal("https://github.com/yourusername/blue-j");
          },
        },
      ],
    },
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

// IPC Handlers for file dialogs
ipcMain.handle("dialog:openFile", async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
    properties: ["openFile", "multiSelections"],
    filters: [
      { name: "Documents", extensions: ["txt", "pdf", "doc", "docx"] },
      { name: "Images", extensions: ["jpg", "jpeg", "png", "gif", "webp"] },
      { name: "All Files", extensions: ["*"] },
    ],
  });

  if (!canceled && filePaths.length > 0) {
    return filePaths;
  }
  return null;
});

// IPC Handlers for local tools (workspace scoped)
ipcMain.handle("tools:listWorkspaceFiles", async (event, options = {}) => {
  const relativePath = options.relativePath || ".";
  const target = resolveTargetPath(relativePath);
  const maxEntries = Math.min(
    Math.max(Number(options.maxEntries) || 100, 1),
    500,
  );

  const stat = await fs.promises.stat(target);
  if (!stat.isDirectory()) {
    throw new Error("Target path is not a directory");
  }

  const entries = await fs.promises.readdir(target, { withFileTypes: true });
  return entries.slice(0, maxEntries).map((entry) => ({
    name: entry.name,
    type: entry.isDirectory() ? "directory" : "file",
    path: path.join(target, entry.name),
    relativePath: path.relative(PROJECT_ROOT, path.join(target, entry.name)),
  }));
});

ipcMain.handle("tools:listPath", async (event, options = {}) => {
  const inputPath = options.path || options.relativePath || ".";
  const maxEntries = Math.min(
    Math.max(Number(options.maxEntries) || 100, 1),
    500,
  );
  const target = resolveTargetPath(inputPath);

  const stat = await fs.promises.stat(target);
  if (!stat.isDirectory()) {
    throw new Error("Target path is not a directory");
  }

  const entries = await fs.promises.readdir(target, { withFileTypes: true });
  return entries.slice(0, maxEntries).map((entry) => ({
    name: entry.name,
    type: entry.isDirectory() ? "directory" : "file",
    path: path.join(target, entry.name),
    relativePath: path.relative(PROJECT_ROOT, path.join(target, entry.name)),
  }));
});

ipcMain.handle("tools:readWorkspaceFile", async (event, options = {}) => {
  const relativePath = options.relativePath;
  if (!relativePath || typeof relativePath !== "string") {
    throw new Error("A relativePath string is required");
  }

  const readResult = await (async () => {
    const target = resolveTargetPath(relativePath);
    const stat = await fs.promises.stat(target);
    if (!stat.isFile()) {
      throw new Error("Target path is not a file");
    }

    const { start, end } = normalizeReadRange(
      Number(options.startLine),
      Number(options.endLine),
    );

    const maxChars = Math.min(
      Math.max(Number(options.maxChars) || 24000, 500),
      60000,
    );
    const content = await fs.promises.readFile(target, "utf8");
    const lines = content.split(/\r?\n/);
    const selected = lines.slice(start - 1, end);

    let sliced = selected.join("\n");
    let truncated = false;
    if (sliced.length > maxChars) {
      sliced = `${sliced.slice(0, maxChars)}\n...[truncated]`;
      truncated = true;
    }

    return {
      path: target,
      relativePath: path.relative(PROJECT_ROOT, target),
      startLine: start,
      endLine: Math.min(end, lines.length),
      totalLines: lines.length,
      truncated,
      content: sliced,
    };
  })();

  return readResult;
});

ipcMain.handle("tools:readPath", async (event, options = {}) => {
  const inputPath = options.path || options.relativePath;
  if (!inputPath || typeof inputPath !== "string") {
    throw new Error("A path string is required");
  }

  const target = resolveTargetPath(inputPath);
  const stat = await fs.promises.stat(target);
  if (!stat.isFile()) {
    throw new Error("Target path is not a file");
  }

  const { start, end } = normalizeReadRange(
    Number(options.startLine),
    Number(options.endLine),
  );

  const maxChars = Math.min(
    Math.max(Number(options.maxChars) || 24000, 500),
    60000,
  );
  const content = await fs.promises.readFile(target, "utf8");
  const lines = content.split(/\r?\n/);
  const selected = lines.slice(start - 1, end);

  let sliced = selected.join("\n");
  let truncated = false;
  if (sliced.length > maxChars) {
    sliced = `${sliced.slice(0, maxChars)}\n...[truncated]`;
    truncated = true;
  }

  return {
    path: target,
    relativePath: path.relative(PROJECT_ROOT, target),
    startLine: start,
    endLine: Math.min(end, lines.length),
    totalLines: lines.length,
    truncated,
    content: sliced,
  };
});

ipcMain.handle("tools:writePath", async (event, options = {}) => {
  const inputPath = options.path || options.relativePath;
  const content = options.content;
  const append = Boolean(options.append);
  const createDirs = options.createDirs !== false;

  if (!inputPath || typeof inputPath !== "string") {
    throw new Error("A path string is required");
  }

  if (typeof content !== "string") {
    throw new Error("content must be a string");
  }

  const target = resolveTargetPath(inputPath);
  if (createDirs) {
    await fs.promises.mkdir(path.dirname(target), { recursive: true });
  }

  if (append) {
    await fs.promises.appendFile(target, content, "utf8");
  } else {
    await fs.promises.writeFile(target, content, "utf8");
  }

  const stat = await fs.promises.stat(target);
  return {
    ok: true,
    path: target,
    relativePath: path.relative(PROJECT_ROOT, target),
    size: stat.size,
    mode: append ? "append" : "write",
  };
});

// IPC Handlers for store
ipcMain.handle("store:get", (event, key) => {
  return store.get(key);
});

ipcMain.handle("store:set", (event, key, value) => {
  store.set(key, value);
  return true;
});

ipcMain.handle("store:delete", (event, key) => {
  store.delete(key);
  return true;
});

// IPC Handlers for encrypted secret storage
ipcMain.handle("secure:get", (event, key) => {
  const encrypted = store.get(`secure:${key}`);
  if (!encrypted || typeof encrypted !== "string") {
    return null;
  }

  if (!safeStorage.isEncryptionAvailable()) {
    return null;
  }

  try {
    const buffer = Buffer.from(encrypted, "base64");
    return safeStorage.decryptString(buffer);
  } catch (error) {
    console.error("Failed to decrypt secure value:", error);
    return null;
  }
});

ipcMain.handle("secure:set", (event, key, value) => {
  if (typeof value !== "string") {
    throw new Error("Secure value must be a string");
  }

  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error("Secure storage is not available on this system");
  }

  const encrypted = safeStorage.encryptString(value);
  store.set(`secure:${key}`, encrypted.toString("base64"));
  return true;
});

ipcMain.handle("secure:delete", (event, key) => {
  store.delete(`secure:${key}`);
  return true;
});

// App lifecycle
app.whenReady().then(() => {
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

// Prevent multiple instances
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
} else {
  app.on("second-instance", (event, commandLine, workingDirectory) => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });
}
