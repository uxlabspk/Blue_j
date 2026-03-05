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

  // Canvas/Presentation generation
  canvas: {
    generatePresentation: (prompt) =>
      ipcRenderer.invoke("canvas:generatePresentation", prompt),
    savePresentation: (sourcePath) =>
      ipcRenderer.invoke("canvas:savePresentation", sourcePath),
    onProgress: (callback) => {
      const handler = (_event, data) => callback(data);
      ipcRenderer.on("canvas:progress", handler);
      // Return cleanup function
      return () => ipcRenderer.removeListener("canvas:progress", handler);
    },
  },

  // Video generation via Remotion
  video: {
    render: (videoData) => ipcRenderer.invoke("video:render", videoData),
    save: (sourcePath) => ipcRenderer.invoke("video:save", sourcePath),
    onProgress: (callback) => {
      const handler = (_event, data) => callback(data);
      ipcRenderer.on("video:progress", handler);
      // Return cleanup function
      return () => ipcRenderer.removeListener("video:progress", handler);
    },
  },
});

// Log that preload script loaded successfully
console.log("Preload script loaded successfully");
