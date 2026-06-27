const path = require("node:path");
const fs = require("node:fs");

const SUPPORTED_EXTENSIONS = new Set([
  ".pdf",
  ".docx",
  ".pptx",
  ".xlsx",
  ".html",
  ".htm",
  ".csv",
  ".json",
  ".xml",
  ".txt",
]);

function getFileInfo(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return {
    path: filePath,
    name: path.basename(filePath),
    ext: ext.replace(".", ""),
    supported: SUPPORTED_EXTENSIONS.has(ext),
  };
}

function ensureWritableDirectory(outputDir) {
  if (!outputDir || !fs.existsSync(outputDir)) {
    return { ok: false, errorCode: "OUTPUT_DIR_MISSING", message: "输出目录不存在，请重新选择保存位置。" };
  }

  const stat = fs.statSync(outputDir);
  if (!stat.isDirectory()) {
    return { ok: false, errorCode: "OUTPUT_DIR_INVALID", message: "输出位置不是文件夹，请重新选择保存位置。" };
  }

  const probe = path.join(outputDir, `.write-test-${Date.now()}.tmp`);
  try {
    fs.writeFileSync(probe, "ok", "utf8");
    fs.unlinkSync(probe);
    return { ok: true };
  } catch {
    return { ok: false, errorCode: "OUTPUT_DIR_NOT_WRITABLE", message: "输出目录不可写，请重新选择保存位置。" };
  }
}

function getAvailableOutputPath(inputPath, outputDir) {
  const baseName = path.basename(inputPath, path.extname(inputPath));
  let candidate = path.join(outputDir, `${baseName}.md`);
  let index = 1;

  while (fs.existsSync(candidate)) {
    candidate = path.join(outputDir, `${baseName} (${index}).md`);
    index += 1;
  }

  return candidate;
}

module.exports = {
  SUPPORTED_EXTENSIONS,
  getFileInfo,
  ensureWritableDirectory,
  getAvailableOutputPath,
};
