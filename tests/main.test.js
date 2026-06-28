const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { execFile } = require("node:child_process");
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
  getAvailableOutputPaths,
  getAvailableOutputPath,
} = require("../src/conversion-utils");
const {
  QUEUE_STATUS,
  addFilesToQueue,
  canStartQueue,
  getNextQueuedItem,
  getQueueSummary,
  removeCompletedQueueItems,
  removeQueueItem,
  resetFailedQueueItems,
  runQueueConversion,
  updateQueueItem,
} = require("../src/queue-utils");

function execFileAsync(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    execFile(command, args, options, (error, stdout, stderr) => {
      if (error) {
        error.stdout = stdout;
        error.stderr = stderr;
        reject(error);
        return;
      }

      resolve({ stdout, stderr });
    });
  });
}

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

test("generates batch markdown paths without collisions inside the same batch", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "everything-markdown-"));
  fs.writeFileSync(path.join(dir, "report.md"), "existing", "utf8");

  const inputPaths = [
    path.join("C:\\demo", "report.pdf"),
    path.join("D:\\incoming", "report.docx"),
    path.join("D:\\incoming", "notes.txt"),
  ];

  assert.deepEqual(getAvailableOutputPaths(inputPaths, dir), [
    path.join(dir, "report (1).md"),
    path.join(dir, "report (2).md"),
    path.join(dir, "notes.md"),
  ]);
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

test("resets failed supported files and removes completed files from the queue", () => {
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
  const withStatuses = updateQueueItem(
    updateQueueItem(updateQueueItem(queue, 1, { status: QUEUE_STATUS.SUCCESS }), 2, {
      status: QUEUE_STATUS.ERROR,
      errorMessage: "Locked",
    }),
    3,
    { status: QUEUE_STATUS.CONVERTING },
  );

  const retried = resetFailedQueueItems(withStatuses);
  assert.equal(retried[0].status, QUEUE_STATUS.SUCCESS);
  assert.equal(retried[1].status, QUEUE_STATUS.QUEUED);
  assert.equal(retried[1].errorMessage, "");
  assert.equal(retried[2].status, QUEUE_STATUS.CONVERTING);
  assert.equal(retried[3].status, QUEUE_STATUS.ERROR);

  const remaining = removeCompletedQueueItems(retried);
  assert.deepEqual(
    remaining.map((item) => item.id),
    [2, 3, 4],
  );
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

test("queue conversion can invoke a batch converter once and keep per-file results", async () => {
  const { queue } = addFilesToQueue(
    [],
    [getFileInfo("C:\\demo\\first.pdf"), getFileInfo("C:\\demo\\second.docx")],
    1,
  );
  const snapshots = [];
  let batchCalls = 0;

  const result = await runQueueConversion({
    queue,
    outputDir: "C:\\out",
    convertFiles: async ({ items, outputDir }) => {
      batchCalls += 1;
      assert.equal(outputDir, "C:\\out");
      assert.deepEqual(
        items.map((item) => item.inputPath),
        ["C:\\demo\\first.pdf", "C:\\demo\\second.docx"],
      );
      return {
        ok: true,
        results: [
          { inputPath: "C:\\demo\\first.pdf", ok: true, outputPath: "C:\\out\\first.md" },
          { inputPath: "C:\\demo\\second.docx", ok: false, message: "Cannot read file" },
        ],
      };
    },
    onQueueChange: (nextQueue) => {
      snapshots.push(nextQueue.map((item) => item.status));
    },
  });

  assert.equal(batchCalls, 1);
  assert.equal(result.queue[0].status, QUEUE_STATUS.SUCCESS);
  assert.equal(result.queue[0].outputPath, "C:\\out\\first.md");
  assert.equal(result.queue[1].status, QUEUE_STATUS.ERROR);
  assert.equal(result.queue[1].errorMessage, "Cannot read file");
  assert.equal(result.lastOutputPath, "C:\\out\\first.md");
  assert.deepEqual(snapshots[0], [QUEUE_STATUS.CONVERTING, QUEUE_STATUS.CONVERTING]);
  assert.deepEqual(snapshots.at(-1), [QUEUE_STATUS.SUCCESS, QUEUE_STATUS.ERROR]);
});

test("converter script supports batch jobs and returns per-file output", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "everything-markdown-"));
  const firstInput = path.join(dir, "first.txt");
  const secondInput = path.join(dir, "second.html");
  const firstOutput = path.join(dir, "first.md");
  const secondOutput = path.join(dir, "second.md");

  fs.writeFileSync(firstInput, "Plain text sample", "utf8");
  fs.writeFileSync(secondInput, "<h1>Heading</h1><p>Body</p>", "utf8");

  const { stdout } = await execFileAsync("python", [
    path.join(__dirname, "..", "scripts", "convert.py"),
    "--jobs-json",
    JSON.stringify([
      { input: firstInput, output: firstOutput },
      { input: secondInput, output: secondOutput },
    ]),
  ]);

  const parsed = JSON.parse(stdout.trim());
  assert.equal(parsed.ok, true);
  assert.deepEqual(
    parsed.results.map((item) => item.ok),
    [true, true],
  );
  assert.equal(fs.readFileSync(firstOutput, "utf8").includes("Plain text sample"), true);
  assert.equal(fs.readFileSync(secondOutput, "utf8").includes("Heading"), true);
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

test("package version is bumped for the next installer name", () => {
  assert.equal(packageJson.version, "0.1.3");
  assert.equal(packageJson.build.win.artifactName, "Everything Markdown Setup ${version}.${ext}");
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

test("adds color preference and uninstall actions to the Edit menu", () => {
  const mainSource = fs.readFileSync(path.join(__dirname, "..", "src", "main.js"), "utf8");

  assert.match(mainSource, /label:\s*"Edit"/);
  assert.doesNotMatch(mainSource, /label:\s*"Language"/);
  assert.match(mainSource, /label:\s*"Color"/);
  assert.match(mainSource, /label:\s*"Uninstall Everything Markdown"/);
  assert.ok(mainSource.indexOf('label: "Uninstall Everything Markdown"') > mainSource.indexOf('label: "Color"'));
});

test("shows language switching in the top bar instead of the Edit menu", () => {
  const html = fs.readFileSync(path.join(__dirname, "..", "src", "renderer", "index.html"), "utf8");
  const rendererSource = fs.readFileSync(path.join(__dirname, "..", "src", "renderer", "renderer.js"), "utf8");

  assert.match(html, /class="topbar-actions"/);
  assert.match(html, /id="languageSelect"/);
  assert.match(html, /value="zh"/);
  assert.match(html, /value="en"/);
  assert.match(rendererSource, /languageSelect/);
  assert.match(rendererSource, /setPreferences\(\{\s*language:/);
});

test("renderer applies language changes immediately and preserves partial preferences", () => {
  const rendererSource = fs.readFileSync(path.join(__dirname, "..", "src", "renderer", "renderer.js"), "utf8");
  const localApplyIndex = rendererSource.indexOf("applyPreferences({ language: language, color: state.color })");
  const saveIndex = rendererSource.indexOf("window.markdownApp.setPreferences({ language: language })");

  assert.ok(localApplyIndex > -1);
  assert.ok(saveIndex > -1);
  assert.ok(localApplyIndex < saveIndex);
  assert.match(rendererSource, /preferences\.language\) \? preferences\.language : state\.language/);
  assert.match(rendererSource, /preferences\.color\) \? preferences\.color : state\.color/);
});

test("main process filters supported input files and blocks unexpected navigation", () => {
  const mainSource = fs.readFileSync(path.join(__dirname, "..", "src", "main.js"), "utf8");

  assert.match(mainSource, /name:\s*"Supported files"/);
  assert.match(mainSource, /filters:\s*getSupportedFileFilters\(\)/);
  assert.match(mainSource, /setWindowOpenHandler/);
  assert.match(mainSource, /will-navigate/);
  assert.match(mainSource, /event\.preventDefault\(\)/);
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
