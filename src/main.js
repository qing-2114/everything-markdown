const { app, BrowserWindow, dialog, ipcMain, shell } = require("electron");
const path = require("node:path");
const fs = require("node:fs");
const { spawn } = require("node:child_process");
const {
  SUPPORTED_EXTENSIONS,
  getFileInfo,
  ensureWritableDirectory,
  getAvailableOutputPath,
} = require("./conversion-utils");

const APP_ICON_PATH = path.join(__dirname, "assets", "app-icon.ico");

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

ipcMain.handle("get-app-state", () => {
  const config = readConfig();
  return {
    outputDir: config.outputDir || "",
    supportedExtensions: Array.from(SUPPORTED_EXTENSIONS).map((ext) => ext.replace(".", "")),
  };
});

ipcMain.handle("get-file-info", (_event, filePath) => {
  if (!filePath || !fs.existsSync(filePath)) {
    return null;
  }

  return getFileInfo(filePath);
});

ipcMain.handle("select-input-file", async () => {
  const result = await dialog.showOpenDialog({
    properties: ["openFile"],
    filters: [{ name: "All Files", extensions: ["*"] }],
  });

  if (result.canceled || result.filePaths.length === 0) {
    return null;
  }

  return getFileInfo(result.filePaths[0]);
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
  return runConverter(inputPath, outputPath);
});

ipcMain.handle("open-output-location", async (_event, payload) => {
  const outputPath = payload?.outputPath;
  if (!outputPath) {
    return { ok: false, message: "没有可打开的输出文件。" };
  }

  const result = await shell.showItemInFolder(outputPath);
  return { ok: result !== false };
});

app.whenReady().then(createWindow);

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
