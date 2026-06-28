const { app, BrowserWindow, Menu, dialog, ipcMain, nativeTheme, shell } = require("electron");
const path = require("node:path");
const fs = require("node:fs");
const { spawn } = require("node:child_process");
const {
  SUPPORTED_EXTENSIONS,
  getFileInfo,
  ensureWritableDirectory,
  getAvailableOutputPath,
} = require("./conversion-utils");
const {
  getWindowsUninstallerArgs,
  getWindowsUninstallerPath,
  isPathInsideDirectory,
} = require("./uninstall-utils");

const APP_ICON_PATH = path.join(__dirname, "assets", "app-icon.ico");
const DEFAULT_PREFERENCES = {
  language: "zh",
  color: "light",
};

function getConfigPath() {
  return path.join(app.getPath("userData"), "config.json");
}

function readConfig() {
  try {
    const raw = fs.readFileSync(getConfigPath(), "utf8");
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

function writeConfig(nextConfig) {
  fs.mkdirSync(path.dirname(getConfigPath()), { recursive: true });
  fs.writeFileSync(getConfigPath(), JSON.stringify(nextConfig, null, 2), "utf8");
}

function getPreferences() {
  const config = readConfig();
  return {
    language: ["zh", "en"].includes(config.language) ? config.language : DEFAULT_PREFERENCES.language,
    color: ["system", "light", "dark"].includes(config.color) ? config.color : DEFAULT_PREFERENCES.color,
  };
}

function writePreferences(nextPreferences) {
  const config = readConfig();
  const preferences = {
    ...getPreferences(),
    ...nextPreferences,
  };
  writeConfig({ ...config, ...preferences });
  return preferences;
}

function sendPreferencesToWindows(preferences = getPreferences()) {
  for (const win of BrowserWindow.getAllWindows()) {
    win.webContents.send("preferences-changed", preferences);
  }
}

function getPythonCommand() {
  return process.platform === "win32" ? "python" : "python3";
}

function getBundledConverterPath() {
  if (!app.isPackaged) {
    return null;
  }

  const executableName = process.platform === "win32" ? "convert.exe" : "convert";
  return path.join(process.resourcesPath, "converter", executableName);
}

function getErrorMessage(error, fallback) {
  return error?.message || fallback;
}

function runConverter(inputPath, outputPath) {
  return new Promise((resolve) => {
    const bundledConverterPath = getBundledConverterPath();
    const useBundledConverter = bundledConverterPath && fs.existsSync(bundledConverterPath);
    const command = useBundledConverter ? bundledConverterPath : getPythonCommand();
    const args = useBundledConverter
      ? ["--input", inputPath, "--output", outputPath]
      : [path.join(__dirname, "..", "scripts", "convert.py"), "--input", inputPath, "--output", outputPath];

    const child = spawn(command, args, {
      windowsHide: true,
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });

    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    child.on("error", () => {
      resolve({
        ok: false,
        errorCode: useBundledConverter ? "CONVERTER_UNAVAILABLE" : "PYTHON_UNAVAILABLE",
        message: useBundledConverter
          ? "内置转换器不可用，请重新安装应用。"
          : "Python 环境不可用，请确认已安装 Python 并可在命令行运行。",
      });
    });

    child.on("close", () => {
      try {
        const parsed = JSON.parse(stdout.trim());
        resolve(parsed);
      } catch {
        resolve({
          ok: false,
          errorCode: "CONVERTER_INVALID_RESPONSE",
          message: stderr.trim() || "转换器没有返回有效结果，请检查 Python 和 MarkItDown 环境。",
        });
      }
    });
  });
}

async function createWindow() {
  const preferences = getPreferences();
  nativeTheme.themeSource = preferences.color;

  const win = new BrowserWindow({
    width: 980,
    height: 720,
    minWidth: 820,
    minHeight: 620,
    title: "everything-markdown",
    icon: APP_ICON_PATH,
    backgroundColor: "#eef6ff",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  await win.loadFile(path.join(__dirname, "renderer", "index.html"));
}

function setPreference(name, value) {
  const preferences = writePreferences({ [name]: value });
  nativeTheme.themeSource = preferences.color;
  buildApplicationMenu();
  sendPreferencesToWindows(preferences);
}

function buildApplicationMenu() {
  const preferences = getPreferences();
  const menu = Menu.buildFromTemplate([
    {
      label: "File",
      submenu: [{ role: "quit" }],
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
        { role: "delete" },
        { type: "separator" },
        { role: "selectAll" },
        { type: "separator" },
        {
          label: "Language",
          submenu: [
            {
              label: "中文",
              type: "radio",
              checked: preferences.language === "zh",
              click: () => setPreference("language", "zh"),
            },
            {
              label: "English",
              type: "radio",
              checked: preferences.language === "en",
              click: () => setPreference("language", "en"),
            },
          ],
        },
        {
          label: "Color",
          submenu: [
            {
              label: "System",
              type: "radio",
              checked: preferences.color === "system",
              click: () => setPreference("color", "system"),
            },
            {
              label: "Light",
              type: "radio",
              checked: preferences.color === "light",
              click: () => setPreference("color", "light"),
            },
            {
              label: "Dark",
              type: "radio",
              checked: preferences.color === "dark",
              click: () => setPreference("color", "dark"),
            },
          ],
        },
        { type: "separator" },
        {
          label: "Uninstall Everything Markdown",
          click: () => {
            requestUninstall();
          },
        },
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
      label: "Window",
      submenu: [{ role: "minimize" }, { role: "close" }],
    },
  ]);

  Menu.setApplicationMenu(menu);
}

ipcMain.handle("get-app-state", () => {
  const config = readConfig();
  return {
    outputDir: config.outputDir || "",
    preferences: getPreferences(),
    supportedExtensions: Array.from(SUPPORTED_EXTENSIONS).map((ext) => ext.replace(".", "")),
  };
});

ipcMain.handle("get-files-info", (_event, filePaths) => {
  if (!Array.isArray(filePaths)) {
    return [];
  }

  return filePaths.filter((filePath) => filePath && fs.existsSync(filePath)).map((filePath) => getFileInfo(filePath));
});

ipcMain.handle("select-input-files", async () => {
  const result = await dialog.showOpenDialog({
    properties: ["openFile", "multiSelections"],
    filters: [{ name: "All Files", extensions: ["*"] }],
  });

  if (result.canceled || result.filePaths.length === 0) {
    return [];
  }

  return result.filePaths.map((filePath) => getFileInfo(filePath));
});

ipcMain.handle("select-output-directory", async () => {
  const result = await dialog.showOpenDialog({
    properties: ["openDirectory", "createDirectory"],
  });

  if (result.canceled || result.filePaths.length === 0) {
    return null;
  }

  const config = readConfig();
  const nextConfig = { ...config, outputDir: result.filePaths[0] };
  writeConfig(nextConfig);

  return { path: result.filePaths[0] };
});

ipcMain.handle("convert-file", async (_event, payload) => {
  try {
    const inputPath = payload?.inputPath;
    const outputDir = payload?.outputDir;

    if (!inputPath || !fs.existsSync(inputPath)) {
      return { ok: false, errorCode: "INPUT_MISSING", message: "源文件不存在，请重新选择文件。" };
    }

    const fileInfo = getFileInfo(inputPath);
    if (!fileInfo.supported) {
      return { ok: false, errorCode: "UNSUPPORTED_FILE_TYPE", message: `暂不支持 .${fileInfo.ext || "unknown"} 文件。` };
    }

    const directoryCheck = ensureWritableDirectory(outputDir);
    if (!directoryCheck.ok) {
      return directoryCheck;
    }

    const outputPath = getAvailableOutputPath(inputPath, outputDir);
    return await runConverter(inputPath, outputPath);
  } catch (error) {
    return {
      ok: false,
      errorCode: "CONVERSION_FAILED",
      message: getErrorMessage(error, "转换失败，请检查文件、输出目录或 MarkItDown 环境。"),
    };
  }
});

ipcMain.handle("open-output-location", async (_event, payload) => {
  try {
    const outputPath = payload?.outputPath;
    if (!outputPath) {
      return { ok: false, errorCode: "OUTPUT_PATH_MISSING", message: "没有可打开的输出文件。" };
    }

    if (!fs.existsSync(outputPath)) {
      return {
        ok: false,
        errorCode: "OUTPUT_PATH_MISSING",
        message: "输出位置不存在，请检查文件是否已被移动或删除。",
      };
    }

    const stats = fs.statSync(outputPath);
    const targetPath = stats.isDirectory() ? outputPath : path.dirname(outputPath);
    const errorMessage = await shell.openPath(targetPath);
    if (errorMessage) {
      return {
        ok: false,
        errorCode: "OPEN_OUTPUT_LOCATION_FAILED",
        message: errorMessage,
      };
    }

    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      errorCode: "OPEN_OUTPUT_LOCATION_FAILED",
      message: getErrorMessage(error, "无法打开输出位置，请手动打开保存目录。"),
    };
  }
});

async function requestUninstall() {
  if (process.platform !== "win32" || !app.isPackaged) {
    return {
      ok: false,
      errorCode: "UNINSTALL_UNAVAILABLE",
      message: "只有安装后的 Windows 版本可以从软件内卸载。",
    };
  }

  const appDirectory = path.dirname(process.execPath);
  const uninstallerPath = getWindowsUninstallerPath(process.execPath);

  if (!isPathInsideDirectory(uninstallerPath, appDirectory) || !fs.existsSync(uninstallerPath)) {
    return {
      ok: false,
      errorCode: "UNINSTALLER_MISSING",
      message: "没有找到官方卸载程序，请从 Windows 设置中卸载 Everything Markdown。",
    };
  }

  const activeWindow = BrowserWindow.getFocusedWindow();
  const result = await dialog.showMessageBox(activeWindow, {
    type: "warning",
    buttons: ["取消", "卸载"],
    defaultId: 0,
    cancelId: 0,
    title: "卸载 Everything Markdown",
    message: "确定要卸载 Everything Markdown 吗？",
    detail: "这只会启动软件自带的官方卸载程序，删除本软件的安装文件，不会删除你选择或转换过的文件。",
    noLink: true,
  });

  if (result.response !== 1) {
    return { ok: true, canceled: true };
  }

  const child = spawn(uninstallerPath, getWindowsUninstallerArgs(), {
    detached: true,
    stdio: "ignore",
    windowsHide: false,
  });
  child.unref();
  app.quit();

  return { ok: true, started: true };
}

ipcMain.handle("request-uninstall", requestUninstall);

ipcMain.handle("set-preferences", (_event, nextPreferences) => {
  const allowed = {};
  if (["zh", "en"].includes(nextPreferences?.language)) {
    allowed.language = nextPreferences.language;
  }
  if (["system", "light", "dark"].includes(nextPreferences?.color)) {
    allowed.color = nextPreferences.color;
  }
  const preferences = writePreferences(allowed);
  nativeTheme.themeSource = preferences.color;
  buildApplicationMenu();
  sendPreferencesToWindows(preferences);
  return preferences;
});

nativeTheme.on("updated", () => {
  sendPreferencesToWindows();
});

app.whenReady().then(() => {
  nativeTheme.themeSource = getPreferences().color;
  buildApplicationMenu();
  createWindow();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
