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
