const path = require("node:path");

const WINDOWS_UNINSTALLER_NAME = "Uninstall Everything Markdown.exe";

function getWindowsUninstallerPath(appExePath) {
  return path.join(path.dirname(appExePath), WINDOWS_UNINSTALLER_NAME);
}

function getWindowsUninstallerArgs() {
  return ["/currentuser"];
}

function normalizeForCompare(targetPath) {
  return path.resolve(targetPath).toLowerCase();
}

function isPathInsideDirectory(targetPath, directoryPath) {
  const normalizedTarget = normalizeForCompare(targetPath);
  const normalizedDirectory = normalizeForCompare(directoryPath);
  return normalizedTarget === normalizedDirectory || normalizedTarget.startsWith(`${normalizedDirectory}${path.sep}`);
}

module.exports = {
  WINDOWS_UNINSTALLER_NAME,
  getWindowsUninstallerArgs,
  getWindowsUninstallerPath,
  isPathInsideDirectory,
};
