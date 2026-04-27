const { contextBridge, ipcRenderer } = require("electron");

// Expose protected methods that allow the renderer process to use
// ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld("electronAPI", {
  // File dialog
  openFileDialog: () => ipcRenderer.invoke("dialog:openFile"),

  // Persistent store (alternative to localStorage)
  store: {
    get: (key) => ipcRenderer.invoke("store:get", key),
    set: (key, value) => ipcRenderer.invoke("store:set", key, value),
    delete: (key) => ipcRenderer.invoke("store:delete", key),
  },

  // Encrypted secret store for sensitive values (API keys)
  secureStore: {
    get: (key) => ipcRenderer.invoke("secure:get", key),
    set: (key, value) => ipcRenderer.invoke("secure:set", key, value),
    delete: (key) => ipcRenderer.invoke("secure:delete", key),
  },

  tools: {
    listWorkspaceFiles: (options) =>
      ipcRenderer.invoke("tools:listWorkspaceFiles", options),
    readWorkspaceFile: (options) =>
      ipcRenderer.invoke("tools:readWorkspaceFile", options),
    listPath: (options) => ipcRenderer.invoke("tools:listPath", options),
    readPath: (options) => ipcRenderer.invoke("tools:readPath", options),
    writePath: (options) => ipcRenderer.invoke("tools:writePath", options),
  },

  // Menu actions
  onNewChat: (callback) => {
    ipcRenderer.on("new-chat", callback);
  },
  onOpenSettings: (callback) => {
    ipcRenderer.on("open-settings", callback);
  },

  // Platform info
  platform: process.platform,

  // Check if running in Electron
  isElectron: true,
});

// Log that preload script loaded successfully
console.log("Preload script loaded successfully");
