const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const packageJson = require("../package.json");
const {
  getWindowsUninstallerArgs,
  getWindowsUninstallerPath,
  isPathInsideDirectory,
} = require("../src/uninstall-utils");

const {
  SUPPORTED_EXTENSIONS,
  getFileInfo,
  ensureWritableDirectory,
  getAvailableOutputPath,
} = require("../src/conversion-utils");
const {
  QUEUE_STATUS,
  addFilesToQueue,
  canStartQueue,
  getNextQueuedItem,
  getQueueSummary,
  removeQueueItem,
  runQueueConversion,
  updateQueueItem,
} = require("../src/queue-utils");

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

test("adds files to a queue without duplicating existing paths", () => {
  const files = [
    getFileInfo("C:\\demo\\report.pdf"),
    getFileInfo("C:\\demo\\report.pdf"),
    getFileInfo("C:\\demo\\notes.exe"),
  ];

  const result = addFilesToQueue([], files, 1);
  assert.equal(result.queue.length, 2);
  assert.equal(result.nextId, 3);
  assert.equal(result.queue[0].status, QUEUE_STATUS.QUEUED);
  assert.equal(result.queue[1].status, QUEUE_STATUS.ERROR);
  assert.equal(result.queue[1].supported, false);
});

test("summarizes queue status and finds the next queued convertible file", () => {
  const { queue } = addFilesToQueue(
    [],
    [getFileInfo("C:\\demo\\first.pdf"), getFileInfo("C:\\demo\\second.docx"), getFileInfo("C:\\demo\\app.exe")],
    1,
  );

  const updated = updateQueueItem(queue, 1, {
    status: QUEUE_STATUS.SUCCESS,
    outputPath: "C:\\out\\first.md",
  });
  const summary = getQueueSummary(updated);

  assert.equal(summary.total, 3);
  assert.equal(summary.success, 1);
  assert.equal(summary.queued, 1);
  assert.equal(summary.error, 1);
  assert.equal(summary.convertible, 2);
  assert.equal(getNextQueuedItem(updated).id, 2);
  assert.equal(canStartQueue(updated), true);
});

test("removes only queued queue items", () => {
  const { queue } = addFilesToQueue(
    [],
    [
      getFileInfo("C:\\demo\\first.pdf"),
      getFileInfo("C:\\demo\\second.docx"),
      getFileInfo("C:\\demo\\third.pptx"),
      getFileInfo("C:\\demo\\app.exe"),
    ],
    1,
  );
  const withStatuses = updateQueueItem(updateQueueItem(queue, 1, { status: QUEUE_STATUS.CONVERTING }), 3, {
    status: QUEUE_STATUS.SUCCESS,
  });

  assert.equal(removeQueueItem(withStatuses, 1).length, 4);
  assert.equal(removeQueueItem(withStatuses, 2).length, 3);
  assert.equal(removeQueueItem(withStatuses, 3).length, 4);
  assert.equal(removeQueueItem(withStatuses, 4).length, 4);
});

test("queue conversion marks rejected invokes as errors and continues", async () => {
  const { queue } = addFilesToQueue(
    [],
    [getFileInfo("C:\\demo\\first.pdf"), getFileInfo("C:\\demo\\second.docx")],
    1,
  );
  const calls = [];
  const snapshots = [];
  let isConverting = false;

  async function runWithConvertingState() {
    isConverting = true;
    try {
      return await runQueueConversion({
        queue,
        outputDir: "C:\\out",
        convertFile: async (payload) => {
          calls.push(payload.inputPath);
          if (calls.length === 1) {
            throw new Error("IPC rejected");
          }

          return { ok: true, outputPath: "C:\\out\\second.md" };
        },
        onQueueChange: (nextQueue) => {
          snapshots.push(nextQueue.map((item) => item.status));
        },
      });
    } finally {
      isConverting = false;
    }
  }

  const result = await runWithConvertingState();

  assert.equal(isConverting, false);
  assert.deepEqual(calls, ["C:\\demo\\first.pdf", "C:\\demo\\second.docx"]);
  assert.equal(result.queue[0].status, QUEUE_STATUS.ERROR);
  assert.equal(result.queue[0].errorMessage, "IPC rejected");
  assert.equal(result.queue[1].status, QUEUE_STATUS.SUCCESS);
  assert.equal(result.lastOutputPath, "C:\\out\\second.md");
  assert.deepEqual(snapshots.at(-1), [QUEUE_STATUS.ERROR, QUEUE_STATUS.SUCCESS]);
});

test("builds Windows releases as an installer for faster app startup", () => {
  const winBuild = packageJson.build.win;
  const nsisBuild = packageJson.build.nsis;

  assert.equal(packageJson.build.electronDist, "node_modules/electron/dist");
  assert.equal(packageJson.scripts["dist:win"].includes(" portable"), false);
  assert.equal(winBuild.artifactName, "Everything Markdown Setup ${version}.${ext}");
  assert.deepEqual(winBuild.target, [
    {
      target: "nsis",
      arch: ["x64"],
    },
  ]);
  assert.equal(nsisBuild.oneClick, false);
  assert.equal(nsisBuild.allowToChangeInstallationDirectory, true);
});

test("Windows installer uses a cancellable wizard", () => {
  assert.equal(packageJson.build.nsis.oneClick, false);
});

test("resolves only the official uninstaller beside the installed app", () => {
  const appExePath = "C:\\Users\\demo\\AppData\\Local\\Programs\\everything-markdown\\Everything Markdown.exe";
  const uninstallerPath = getWindowsUninstallerPath(appExePath);

  assert.equal(
    uninstallerPath,
    "C:\\Users\\demo\\AppData\\Local\\Programs\\everything-markdown\\Uninstall Everything Markdown.exe",
  );
  assert.equal(isPathInsideDirectory(uninstallerPath, path.dirname(appExePath)), true);
  assert.equal(isPathInsideDirectory("C:\\Users\\demo\\Desktop\\notes.txt", path.dirname(appExePath)), false);
  assert.deepEqual(getWindowsUninstallerArgs(), ["/currentuser"]);
  assert.equal(getWindowsUninstallerArgs().includes("/S"), false);
});

test("shows the uninstall action near the top of the settings panel", () => {
  const html = fs.readFileSync(path.join(__dirname, "..", "src", "renderer", "index.html"), "utf8");

  assert.equal(html.includes('id="uninstallButton"'), false);
});

test("adds preferences and uninstall actions to the Edit menu", () => {
  const mainSource = fs.readFileSync(path.join(__dirname, "..", "src", "main.js"), "utf8");

  assert.match(mainSource, /label:\s*"Edit"/);
  assert.match(mainSource, /label:\s*"Language"/);
  assert.match(mainSource, /label:\s*"Color"/);
  assert.match(mainSource, /label:\s*"Uninstall Everything Markdown"/);
  assert.ok(mainSource.indexOf('label: "Uninstall Everything Markdown"') > mainSource.indexOf('label: "Color"'));
});

test("resets the installer default directory instead of reusing the previous install path", () => {
  const nsisInclude = packageJson.build.nsis.include;
  const scriptPath = path.join(__dirname, "..", nsisInclude);
  const script = fs.readFileSync(scriptPath, "utf8");

  assert.equal(nsisInclude, "installer/nsis/installer.nsh");
  assert.match(script, /!macro\s+customInit/);
  assert.match(script, /\$LOCALAPPDATA\\Programs\\everything-markdown/);
});

test("renderer supports Chinese and English UI text with color themes", () => {
  const rendererSource = fs.readFileSync(path.join(__dirname, "..", "src", "renderer", "renderer.js"), "utf8");
  const stylesSource = fs.readFileSync(path.join(__dirname, "..", "src", "renderer", "styles.css"), "utf8");

  assert.match(rendererSource, /const translations/);
  assert.match(rendererSource, /zh:/);
  assert.match(rendererSource, /en:/);
  assert.match(rendererSource, /applyPreferences/);
  assert.match(stylesSource, /html\[data-theme="dark"\]/);
});
