const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const {
  SUPPORTED_EXTENSIONS,
  getFileInfo,
  ensureWritableDirectory,
  getAvailableOutputPath,
} = require("../src/conversion-utils");

test("recognizes supported and unsupported file types", () => {
  assert.equal(SUPPORTED_EXTENSIONS.has(".pdf"), true);
  assert.equal(SUPPORTED_EXTENSIONS.has(".docx"), true);
  assert.equal(SUPPORTED_EXTENSIONS.has(".exe"), false);
  assert.equal(getFileInfo("C:\\demo\\report.PDF").supported, true);
  assert.equal(getFileInfo("C:\\demo\\mock.psd").supported, false);
});

test("generates numbered markdown paths without overwriting existing files", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "everything-markdown-"));
  const inputPath = path.join(dir, "report.pdf");

  fs.writeFileSync(path.join(dir, "report.md"), "existing", "utf8");
  fs.writeFileSync(path.join(dir, "report (1).md"), "existing", "utf8");

  assert.equal(getAvailableOutputPath(inputPath, dir), path.join(dir, "report (2).md"));
});

test("validates output directory presence and writability", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "everything-markdown-"));
  assert.deepEqual(ensureWritableDirectory(dir), { ok: true });

  const missing = path.join(dir, "missing");
  const result = ensureWritableDirectory(missing);
  assert.equal(result.ok, false);
  assert.equal(result.errorCode, "OUTPUT_DIR_MISSING");
});
