const { contextBridge, ipcRenderer, webUtils } = require("electron");

contextBridge.exposeInMainWorld("markdownApp", {
  getAppState: () => ipcRenderer.invoke("get-app-state"),
  getPathForFile: (file) => webUtils.getPathForFile(file),
  getFilesInfo: (filePaths) => ipcRenderer.invoke("get-files-info", filePaths),
  selectInputFiles: () => ipcRenderer.invoke("select-input-files"),
  selectOutputDirectory: () => ipcRenderer.invoke("select-output-directory"),
  convertFile: (payload) => ipcRenderer.invoke("convert-file", payload),
  openOutputLocation: (payload) => ipcRenderer.invoke("open-output-location", payload),
  requestUninstall: () => ipcRenderer.invoke("request-uninstall"),
  setPreferences: (preferences) => ipcRenderer.invoke("set-preferences", preferences),
  onPreferencesChanged: (callback) => {
    const listener = (_event, preferences) => callback(preferences);
    ipcRenderer.on("preferences-changed", listener);
    return () => ipcRenderer.removeListener("preferences-changed", listener);
  },
});
