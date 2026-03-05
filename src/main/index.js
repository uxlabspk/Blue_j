const {
  app,
  BrowserWindow,
  Menu,
  shell,
  ipcMain,
  dialog,
} = require("electron");
const path = require("path");
const Store = require("electron-store");
const { spawn } = require("child_process");
const fs = require("fs");

const store = new Store();

let mainWindow;

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

// IPC Handler for presentation generation (3-step with progress)
ipcMain.handle("canvas:generatePresentation", async (event, userPrompt) => {
  return new Promise((resolve, reject) => {
    const timestamp = Date.now();
    const fileName = `presentation_${timestamp}.pptx`;
    const outputPath = path.join(app.getPath("temp"), fileName);
    const scriptPath = path.join(
      __dirname,
      "../scripts/presentation_generator.py",
    );

    if (!fs.existsSync(scriptPath)) {
      reject(new Error("Presentation generator script not found"));
      return;
    }

    const pythonProcess = spawn("python3", [
      scriptPath,
      userPrompt,
      outputPath,
    ]);

    let buffer = "";
    let lastResult = null;

    pythonProcess.stdout.on("data", (data) => {
      buffer += data.toString();
      // Process complete JSON lines
      const lines = buffer.split("\n");
      buffer = lines.pop(); // keep incomplete line in buffer

      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const progress = JSON.parse(line.trim());
          lastResult = progress;
          // Send progress to renderer
          if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send("canvas:progress", progress);
          }
        } catch (e) {
          // ignore non-JSON lines
        }
      }
    });

    pythonProcess.stderr.on("data", (data) => {
      console.error("Python stderr:", data.toString());
    });

    pythonProcess.on("close", (code) => {
      // Process any remaining buffer
      if (buffer.trim()) {
        try {
          const progress = JSON.parse(buffer.trim());
          lastResult = progress;
          if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send("canvas:progress", progress);
          }
        } catch (e) {
          /* ignore */
        }
      }

      if (code === 0 && lastResult && lastResult.step === "done") {
        const resultData = lastResult.data || {};
        resolve({
          success: true,
          filePath: outputPath,
          fileName: fileName,
          slides: resultData.slides,
          title: resultData.title,
        });
      } else if (lastResult && lastResult.step === "error") {
        reject(
          new Error(lastResult.message || "Presentation generation failed"),
        );
      } else {
        reject(new Error("Presentation generation failed unexpectedly"));
      }
    });

    pythonProcess.on("error", (error) => {
      reject(new Error(`Failed to start Python process: ${error.message}`));
    });
  });
});

// ─── Video Generation via Remotion ───────────────────────────────────────────

// Cache the webpack bundle between renders so only first render is slow
let remotionBundleDir = null;

// Find a system Chrome/Chromium — never use the Electron binary here.
// Returns the path if found, otherwise null (Remotion will use ensureBrowser).
function findSystemChrome() {
  const candidates = [
    "/usr/bin/google-chrome-stable",
    "/usr/bin/google-chrome",
    "/usr/bin/chromium-browser",
    "/usr/bin/chromium",
    "/snap/bin/chromium",
    "/usr/bin/brave-browser",
    "/usr/bin/microsoft-edge-stable",
    "/usr/bin/microsoft-edge",
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate;
  } 
  return null;
}

ipcMain.handle("video:render", async (event, videoData) => {
  const { bundle } = require("@remotion/bundler");
  const {
    renderMedia,
    getCompositions,
    ensureBrowser,
  } = require("@remotion/renderer");

  const entryPoint = path.join(__dirname, "../scripts/remotion/index.jsx");
  const outputPath = path.join(app.getPath("temp"), `video_${Date.now()}.mp4`);

  // Calculate total frames from all scenes
  const totalFrames =
    videoData.scenes && videoData.scenes.length > 0
      ? videoData.scenes.reduce((acc, s) => acc + (s.duration || 90), 0)
      : 300;

  const inputProps = { ...videoData, totalFrames };

  // ── Step 1: Resolve the browser executable ──
  // Prefer a system Chrome/Chromium; if none found, let Remotion download
  // its own compatible Chromium via ensureBrowser().
  // IMPORTANT: never pass the Electron binary — it is not a browser.
  let browserExecutable = findSystemChrome();
  if (!browserExecutable) {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send("video:progress", {
        step: "bundling",
        progress: 0,
        message: "Downloading Chromium for rendering…",
      });
    }
    const browserResult = await ensureBrowser();
    browserExecutable = browserResult.executablePath || browserResult;
  }

  // ── Step 2: Bundle (cached after first call) ──
  if (!remotionBundleDir) {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send("video:progress", {
        step: "bundling",
        progress: 0,
        message: "Setting up video engine (first time only)…",
      });
    }
    remotionBundleDir = await bundle({
      entryPoint,
      webpackOverride: (config) => config,
    });
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send("video:progress", {
        step: "bundling",
        progress: 100,
        message: "Video engine ready",
      });
    }
  }

  // ── Step 3: Resolve composition with dynamic duration ──
  const compositions = await getCompositions(remotionBundleDir, {
    inputProps,
    browserExecutable,
  });

  const composition = compositions.find((c) => c.id === "VideoComposition");
  if (!composition) {
    throw new Error("VideoComposition not found in Remotion bundle");
  }

  // Override the duration with actual scene total
  composition.durationInFrames = totalFrames;

  // ── Step 4: Render to MP4 ──
  await renderMedia({
    composition,
    serveUrl: remotionBundleDir,
    codec: "h264",
    outputLocation: outputPath,
    inputProps,
    browserExecutable,
    concurrency: 2,
    onProgress: ({ progress }) => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send("video:progress", {
          step: "rendering",
          progress: Math.round(progress * 100),
          message: `Rendering… ${Math.round(progress * 100)}%`,
        });
      }
    },
  });

  if (!fs.existsSync(outputPath)) {
    throw new Error("Rendered video file not found after render");
  }

  return {
    success: true,
    filePath: outputPath,
    fileName: path.basename(outputPath),
  };
});

// IPC Handler for saving the rendered video
ipcMain.handle("video:save", async (event, sourcePath) => {
  const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
    title: "Save Video",
    defaultPath: path.join(app.getPath("downloads"), "video.mp4"),
    filters: [{ name: "MP4 Video", extensions: ["mp4"] }],
  });

  if (!canceled && filePath) {
    try {
      fs.copyFileSync(sourcePath, filePath);
      return { success: true, filePath };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  return { success: false, error: "Save canceled" };
});

// IPC Handler for saving presentation
ipcMain.handle("canvas:savePresentation", async (event, sourcePath) => {
  const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
    title: "Save Presentation",
    defaultPath: path.join(app.getPath("downloads"), "presentation.pptx"),
    filters: [{ name: "PowerPoint Presentation", extensions: ["pptx"] }],
  });

  if (!canceled && filePath) {
    try {
      fs.copyFileSync(sourcePath, filePath);
      return { success: true, filePath };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  return { success: false, error: "Save canceled" };
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
