const {
  QUEUE_STATUS,
  addFilesToQueue,
  canStartQueue,
  getNextQueuedItem,
  getQueueSummary,
  removeQueueItem,
  runQueueConversion,
} = window.queueUtils;

const state = {
  queue: [],
  nextId: 1,
  outputDir: "",
  isConverting: false,
  lastOutputPath: "",
  lastOutputDir: "",
};

const elements = {
  statusPill: document.querySelector("#statusPill"),
  fileDropZone: document.querySelector("#fileDropZone"),
  fileIcon: document.querySelector("#fileIcon"),
  fileTitle: document.querySelector("#fileTitle"),
  fileMeta: document.querySelector("#fileMeta"),
  queueList: document.querySelector("#queueList"),
  clearQueueButton: document.querySelector("#clearQueueButton"),
  outputDirText: document.querySelector("#outputDirText"),
  selectFileButton: document.querySelector("#selectFileButton"),
  selectOutputButton: document.querySelector("#selectOutputButton"),
  convertButton: document.querySelector("#convertButton"),
  convertButtonText: document.querySelector("#convertButtonText"),
  uninstallButton: document.querySelector("#uninstallButton"),
  hintText: document.querySelector("#hintText"),
  progressSummary: document.querySelector("#progressSummary"),
  resultPanel: document.querySelector("#resultPanel"),
  resultLabel: document.querySelector("#resultLabel"),
  resultPath: document.querySelector("#resultPath"),
  openLocationButton: document.querySelector("#openLocationButton"),
};

const STATUS_LABELS = {
  [QUEUE_STATUS.QUEUED]: "等待",
  [QUEUE_STATUS.CONVERTING]: "转换中",
  [QUEUE_STATUS.SUCCESS]: "成功",
  [QUEUE_STATUS.ERROR]: "失败",
};

function setStatus(label, tone = "idle") {
  elements.statusPill.textContent = label;
  elements.statusPill.dataset.tone = tone;
}

function setDropZoneState(stateName = "empty") {
  elements.fileDropZone.dataset.state = stateName;
}

function setFileIcon(label = "FILES", tone = "empty") {
  elements.fileIcon.textContent = label;
  elements.fileIcon.dataset.tone = tone;
}

function getFileIconLabel(item) {
  if (!item?.ext) {
    return "FILE";
  }

  const label = item.ext.toUpperCase();
  return label.length > 4 ? label.slice(0, 4) : label;
}

function getStatusTone(summary) {
  if (state.isConverting) {
    return "working";
  }

  if (summary.total === 0) {
    return "idle";
  }

  if (summary.error > 0 && summary.success === 0 && summary.queued === 0) {
    return "error";
  }

  if (summary.success > 0 && summary.queued === 0) {
    return summary.error > 0 ? "warning" : "success";
  }

  return "ready";
}

function formatProgress(summary) {
  if (summary.total === 0) {
    return "0 个文件等待转换";
  }

  const parts = [`共 ${summary.total} 个文件`];
  if (summary.queued > 0) {
    parts.push(`${summary.queued} 个等待`);
  }
  if (summary.converting > 0) {
    parts.push(`${summary.converting} 个转换中`);
  }
  if (summary.success > 0) {
    parts.push(`${summary.success} 个成功`);
  }
  if (summary.error > 0) {
    parts.push(`${summary.error} 个失败`);
  }
  return parts.join(" · ");
}

function setConverting(isConverting) {
  state.isConverting = isConverting;
  elements.convertButton.dataset.loading = String(isConverting);
  elements.selectFileButton.disabled = isConverting;
  elements.selectOutputButton.disabled = isConverting;
  elements.uninstallButton.disabled = isConverting;
  elements.clearQueueButton.disabled = isConverting || state.queue.length === 0;
}

function showResult({ label, path = "", tone = "neutral", canOpen = false }) {
  elements.resultPanel.hidden = false;
  elements.resultPanel.dataset.tone = tone;
  elements.resultLabel.textContent = label;
  elements.resultPath.textContent = path;
  elements.openLocationButton.hidden = !canOpen;
}

function clearResult() {
  elements.resultPanel.hidden = true;
  elements.resultPath.textContent = "";
  elements.openLocationButton.hidden = true;
  state.lastOutputPath = "";
  state.lastOutputDir = "";
}

function getItemDetail(item) {
  if (item.status === QUEUE_STATUS.SUCCESS) {
    return item.outputPath || "Markdown 已保存。";
  }

  if (item.status === QUEUE_STATUS.ERROR) {
    return item.errorMessage || "转换失败。";
  }

  if (item.status === QUEUE_STATUS.CONVERTING) {
    return "正在转换为 Markdown。";
  }

  return item.path;
}

function renderQueue() {
  elements.queueList.textContent = "";

  if (state.queue.length === 0) {
    const empty = document.createElement("p");
    empty.className = "empty-queue";
    empty.textContent = "还没有文件。你可以点击选择文件，或把文件拖到上方区域。";
    elements.queueList.append(empty);
    return;
  }

  const fragment = document.createDocumentFragment();
  for (const item of state.queue) {
    const row = document.createElement("article");
    row.className = "queue-item";
    row.dataset.status = item.status;

    const icon = document.createElement("div");
    icon.className = "queue-file-icon";
    icon.textContent = getFileIconLabel(item);
    icon.setAttribute("aria-hidden", "true");

    const copy = document.createElement("div");
    copy.className = "queue-copy";

    const title = document.createElement("strong");
    title.textContent = item.name;

    const detail = document.createElement("span");
    detail.textContent = getItemDetail(item);

    copy.append(title, detail);

    const badge = document.createElement("span");
    badge.className = "queue-status";
    badge.textContent = STATUS_LABELS[item.status] || item.status;

    const removeButton = document.createElement("button");
    removeButton.className = "icon-button";
    removeButton.type = "button";
    removeButton.textContent = "移除";
    removeButton.disabled = state.isConverting || item.status !== QUEUE_STATUS.QUEUED;
    removeButton.addEventListener("click", () => {
      state.queue = removeQueueItem(state.queue, item.id);
      renderAll();
    });

    row.append(icon, copy, badge, removeButton);
    fragment.append(row);
  }

  elements.queueList.append(fragment);
}

function updateConvertAvailability() {
  const summary = getQueueSummary(state.queue);
  const hasOutput = Boolean(state.outputDir);
  const canStart = canStartQueue(state.queue);
  elements.convertButton.disabled = !canStart || !hasOutput || state.isConverting;
  elements.clearQueueButton.disabled = state.isConverting || state.queue.length === 0;
  elements.convertButtonText.textContent = state.isConverting ? "正在转换" : "转换为 Markdown";
  elements.progressSummary.textContent = formatProgress(summary);

  if (state.isConverting) {
    elements.hintText.textContent = "转换正在进行，失败项会保留原因，队列会继续处理后续文件。";
  } else if (summary.total === 0 && !hasOutput) {
    elements.hintText.textContent = "先添加文件，再选择 Markdown 的保存位置。";
  } else if (summary.total === 0) {
    elements.hintText.textContent = "请选择或拖入需要转换的文件。";
  } else if (!hasOutput) {
    elements.hintText.textContent = "请选择 Markdown 文件保存位置。";
  } else if (!canStart && summary.success > 0) {
    elements.hintText.textContent = "队列已处理完成，可以继续添加文件。";
  } else if (!canStart) {
    elements.hintText.textContent = "队列中没有可转换的待处理文件。";
  } else {
    elements.hintText.textContent = "准备就绪，将按队列顺序逐个转换。";
  }

  setStatus(
    summary.total === 0 ? "等待文件" : state.isConverting ? "转换中" : formatProgress(summary),
    getStatusTone(summary),
  );
}

function renderDropZone() {
  const summary = getQueueSummary(state.queue);
  const firstQueued = getNextQueuedItem(state.queue);

  if (summary.total === 0) {
    elements.fileTitle.textContent = "选择或拖入多个文件开始转换";
    elements.fileMeta.textContent = "支持 PDF、Word、PowerPoint、Excel、HTML、CSV、JSON、XML 和 TXT。";
    setFileIcon("FILES", "empty");
    setDropZoneState("empty");
    return;
  }

  elements.fileTitle.textContent = `已添加 ${summary.total} 个文件`;
  elements.fileMeta.textContent = formatProgress(summary);
  setFileIcon(firstQueued ? getFileIconLabel(firstQueued) : "DONE", summary.error > 0 && summary.success === 0 ? "error" : "ready");
  setDropZoneState(summary.error > 0 && summary.success === 0 && summary.queued === 0 ? "error" : "ready");
}

function renderOutputDir(outputDir) {
  state.outputDir = outputDir || "";
  elements.outputDirText.textContent = state.outputDir || "尚未选择保存位置";
  renderAll();
}

function renderAll() {
  renderDropZone();
  renderQueue();
  updateConvertAvailability();
}

function getDraggedFilePaths(event) {
  return Array.from(event.dataTransfer?.files || [])
    .map((file) => window.markdownApp.getPathForFile(file) || file.path || "")
    .filter(Boolean);
}

function addFiles(files) {
  if (!Array.isArray(files) || files.length === 0) {
    return;
  }

  const result = addFilesToQueue(state.queue, files, state.nextId);
  state.queue = result.queue;
  state.nextId = result.nextId;
  clearResult();
  renderAll();
}

async function chooseInputFiles() {
  const files = await window.markdownApp.selectInputFiles();
  addFiles(files);
}

async function convertQueue() {
  if (!state.outputDir || state.isConverting || !canStartQueue(state.queue)) {
    return;
  }

  setConverting(true);
  clearResult();
  renderAll();

  try {
    const result = await runQueueConversion({
      queue: state.queue,
      outputDir: state.outputDir,
      convertFile: (payload) => window.markdownApp.convertFile(payload),
      onQueueChange: (nextQueue) => {
        state.queue = nextQueue;
        renderAll();
      },
    });

    state.queue = result.queue;
    state.lastOutputPath = result.lastOutputPath;
    state.lastOutputDir = result.lastOutputDir;
  } finally {
    setConverting(false);
    renderAll();
  }

  const summary = getQueueSummary(state.queue);
  if (summary.success > 0 && summary.error > 0) {
    showResult({
      label: "部分文件已转换",
      path: `${summary.success} 个成功，${summary.error} 个失败。`,
      tone: "warning",
      canOpen: Boolean(state.lastOutputPath),
    });
  } else if (summary.success > 0) {
    showResult({
      label: "全部文件已转换",
      path: `${summary.success} 个 Markdown 文件已保存到输出目录。`,
      tone: "success",
      canOpen: Boolean(state.lastOutputPath),
    });
  } else if (summary.error > 0) {
    showResult({
      label: "没有文件转换成功",
      path: "请查看队列中的失败原因。",
      tone: "error",
    });
  }
}

async function requestUninstall() {
  if (state.isConverting) {
    return;
  }

  const result = await window.markdownApp.requestUninstall();
  if (!result.ok) {
    showResult({
      label: "无法卸载软件",
      path: result.message || "请从 Windows 设置中卸载 Everything Markdown。",
      tone: "error",
    });
  }
}

async function init() {
  const appState = await window.markdownApp.getAppState();
  renderOutputDir(appState.outputDir);
  renderAll();
}

elements.selectFileButton.addEventListener("click", chooseInputFiles);

elements.fileDropZone.addEventListener("dragenter", (event) => {
  event.preventDefault();
  if (!state.isConverting) {
    elements.fileDropZone.dataset.dragging = "true";
  }
});

elements.fileDropZone.addEventListener("dragover", (event) => {
  event.preventDefault();
  event.dataTransfer.dropEffect = state.isConverting ? "none" : "copy";
  if (!state.isConverting) {
    elements.fileDropZone.dataset.dragging = "true";
  }
});

elements.fileDropZone.addEventListener("dragleave", (event) => {
  if (!elements.fileDropZone.contains(event.relatedTarget)) {
    elements.fileDropZone.dataset.dragging = "false";
  }
});

elements.fileDropZone.addEventListener("drop", async (event) => {
  event.preventDefault();
  elements.fileDropZone.dataset.dragging = "false";

  if (state.isConverting) {
    return;
  }

  const filePaths = getDraggedFilePaths(event);
  if (filePaths.length === 0) {
    return;
  }

  const files = await window.markdownApp.getFilesInfo(filePaths);
  addFiles(files);
});

elements.clearQueueButton.addEventListener("click", () => {
  if (state.isConverting) {
    return;
  }

  state.queue = [];
  clearResult();
  renderAll();
});

elements.selectOutputButton.addEventListener("click", async () => {
  const result = await window.markdownApp.selectOutputDirectory();
  if (result) {
    renderOutputDir(result.path);
  }
});

elements.convertButton.addEventListener("click", convertQueue);

elements.uninstallButton.addEventListener("click", requestUninstall);

elements.openLocationButton.addEventListener("click", async () => {
  const outputPath = state.lastOutputPath || state.lastOutputDir;
  if (!outputPath) {
    return;
  }

  const result = await window.markdownApp.openOutputLocation({ outputPath });
  if (!result.ok) {
    showResult({
      label: "无法打开输出目录",
      path: result.message || "请手动打开保存位置。",
      tone: "error",
    });
  }
});

init();
