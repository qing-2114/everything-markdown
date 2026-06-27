const { contextBridge, ipcRenderer, webUtils } = require("electron");

contextBridge.exposeInMainWorld("markdownApp", {
  getAppState: () => ipcRenderer.invoke("get-app-state"),
  getPathForFile: (file) => webUtils.getPathForFile(file),
  getFileInfo: (filePath) => ipcRenderer.invoke("get-file-info", filePath),
  selectInputFile: () => ipcRenderer.invoke("select-input-file"),
  selectOutputDirectory: () => ipcRenderer.invoke("select-output-directory"),
  convertFile: (payload) => ipcRenderer.invoke("convert-file", payload),
  openOutputLocation: (payload) => ipcRenderer.invoke("open-output-location", payload),
});
