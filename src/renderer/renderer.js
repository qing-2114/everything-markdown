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
} = window.queueUtils;

const state = {
  queue: [],
  nextId: 1,
  outputDir: "",
  language: "zh",
  color: "light",
  isConverting: false,
  lastOutputPath: "",
  lastOutputDir: "",
};

const elements = {
  statusPill: document.querySelector("#statusPill"),
  colorSwitcher: document.querySelector("#colorSwitcher"),
  colorLabel: document.querySelector("#colorLabel"),
  colorButton: document.querySelector("#colorButton"),
  colorButtonText: document.querySelector("#colorButtonText"),
  colorMenu: document.querySelector("#colorMenu"),
  colorOptions: Array.from(document.querySelectorAll("[data-color-option]")),
  languageSwitcher: document.querySelector("#languageSwitcher"),
  languageLabel: document.querySelector("#languageLabel"),
  languageButton: document.querySelector("#languageButton"),
  languageButtonText: document.querySelector("#languageButtonText"),
  languageMenu: document.querySelector("#languageMenu"),
  languageOptions: Array.from(document.querySelectorAll("[data-language-option]")),
  workspace: document.querySelector(".workspace"),
  sidePanel: document.querySelector(".side-panel"),
  fileDropZone: document.querySelector("#fileDropZone"),
  fileIcon: document.querySelector("#fileIcon"),
  fileTitle: document.querySelector("#fileTitle"),
  fileMeta: document.querySelector("#fileMeta"),
  sourceQueueLabel: document.querySelector(".section-label"),
  queueHeaderLabel: document.querySelector(".queue-list-header span"),
  queueList: document.querySelector("#queueList"),
  retryFailedButton: document.querySelector("#retryFailedButton"),
  clearCompletedButton: document.querySelector("#clearCompletedButton"),
  clearQueueButton: document.querySelector("#clearQueueButton"),
  outputSettingLabel: document.querySelector(".setting-copy span"),
  outputDirText: document.querySelector("#outputDirText"),
  selectFileButton: document.querySelector("#selectFileButton"),
  selectOutputButton: document.querySelector("#selectOutputButton"),
  convertButton: document.querySelector("#convertButton"),
  convertButtonText: document.querySelector("#convertButtonText"),
  hintText: document.querySelector("#hintText"),
  progressSummary: document.querySelector("#progressSummary"),
  resultPanel: document.querySelector("#resultPanel"),
  resultLabel: document.querySelector("#resultLabel"),
  resultPath: document.querySelector("#resultPath"),
  openLocationButton: document.querySelector("#openLocationButton"),
};

const translations = {
  zh: {
    waitingStatus: "等待文件",
    colorLabel: "颜色",
    colorSystem: "跟随系统",
    colorLight: "浅色",
    colorDark: "深色",
    languageLabel: "语言",
    workspaceLabel: "Markdown 转换工作台",
    settingsLabel: "转换设置",
    sourceQueue: "源文件队列",
    fileTitleEmpty: "选择或拖入多个文件开始转换",
    fileMetaEmpty: "支持 PDF、Word、PowerPoint、Excel、HTML、CSV、JSON、XML 和 TXT。",
    selectFile: "选择文件",
    queueTitle: "文件队列",
    retryFailed: "重试失败",
    clearCompleted: "清除成功",
    clearQueue: "清空队列",
    emptyQueue: "还没有文件。你可以点击选择文件，或把文件拖到上方区域。",
    outputLocation: "输出位置",
    noOutputDir: "尚未选择保存位置",
    selectFolder: "选择文件夹",
    progressEmpty: "0 个文件等待转换",
    convert: "转换为 Markdown",
    convertingButton: "正在转换",
    hintInitial: "先添加文件，再选择 Markdown 的保存位置。",
    hintChooseFiles: "请选择或拖入需要转换的文件。",
    hintChooseOutput: "请选择 Markdown 文件保存位置。",
    hintConverting: "转换正在进行，失败项会保留原因，队列会继续处理后续文件。",
    hintFinished: "队列已处理完成，可以继续添加文件。",
    hintNoConvertible: "队列中没有可转换的待处理文件。",
    hintReady: "准备就绪，将按队列顺序逐个转换。",
    addedFiles: "已添加 {count} 个文件",
    totalFiles: "共 {count} 个文件",
    queuedCount: "{count} 个等待",
    convertingCount: "{count} 个转换中",
    successCount: "{count} 个成功",
    errorCount: "{count} 个失败",
    queued: "等待",
    converting: "转换中",
    success: "成功",
    error: "失败",
    remove: "移除",
    markdownSaved: "Markdown 已保存。",
    conversionFailed: "转换失败。",
    convertingDetail: "正在转换为 Markdown。",
    partialConverted: "部分文件已转换",
    partialConvertedDetail: "{success} 个成功，{error} 个失败。",
    allConverted: "全部文件已转换",
    allConvertedDetail: "{success} 个 Markdown 文件已保存到输出目录。",
    noneConverted: "没有文件转换成功",
    noneConvertedDetail: "请查看队列中的失败原因。",
    openOutputFailed: "无法打开输出目录",
    openOutputFallback: "请手动打开保存位置。",
    resultLabel: "转换结果",
    openOutput: "打开输出目录",
  },
  en: {
    waitingStatus: "Waiting for files",
    colorLabel: "Color",
    colorSystem: "System",
    colorLight: "Light",
    colorDark: "Dark",
    languageLabel: "Language",
    workspaceLabel: "Markdown conversion workspace",
    settingsLabel: "Conversion settings",
    sourceQueue: "Source queue",
    fileTitleEmpty: "Choose or drop files to start converting",
    fileMetaEmpty: "Supports PDF, Word, PowerPoint, Excel, HTML, CSV, JSON, XML, and TXT.",
    selectFile: "Choose files",
    queueTitle: "File queue",
    retryFailed: "Retry failed",
    clearCompleted: "Clear successful",
    clearQueue: "Clear queue",
    emptyQueue: "No files yet. Choose files or drop them into the area above.",
    outputLocation: "Output location",
    noOutputDir: "No save location selected",
    selectFolder: "Choose folder",
    progressEmpty: "0 files waiting",
    convert: "Convert to Markdown",
    convertingButton: "Converting",
    hintInitial: "Add files, then choose where Markdown files should be saved.",
    hintChooseFiles: "Choose or drop files to convert.",
    hintChooseOutput: "Choose where Markdown files should be saved.",
    hintConverting: "Conversion is running. Failed items keep their reason and the queue continues.",
    hintFinished: "The queue is finished. You can add more files.",
    hintNoConvertible: "There are no convertible queued files.",
    hintReady: "Ready. Files will be converted in queue order.",
    addedFiles: "{count} files added",
    totalFiles: "{count} files total",
    queuedCount: "{count} waiting",
    convertingCount: "{count} converting",
    successCount: "{count} successful",
    errorCount: "{count} failed",
    queued: "Waiting",
    converting: "Converting",
    success: "Success",
    error: "Failed",
    remove: "Remove",
    markdownSaved: "Markdown saved.",
    conversionFailed: "Conversion failed.",
    convertingDetail: "Converting to Markdown.",
    partialConverted: "Some files converted",
    partialConvertedDetail: "{success} succeeded, {error} failed.",
    allConverted: "All files converted",
    allConvertedDetail: "{success} Markdown files saved to the output folder.",
    noneConverted: "No files converted",
    noneConvertedDetail: "Check the failed items in the queue.",
    openOutputFailed: "Cannot open output folder",
    openOutputFallback: "Open the save location manually.",
    resultLabel: "Conversion result",
    openOutput: "Open output folder",
  },
};

const STATUS_LABEL_KEYS = {
  [QUEUE_STATUS.QUEUED]: "queued",
  [QUEUE_STATUS.CONVERTING]: "converting",
  [QUEUE_STATUS.SUCCESS]: "success",
  [QUEUE_STATUS.ERROR]: "error",
};

const LANGUAGE_LABELS = {
  zh: "中文",
  en: "English",
};

const COLOR_LABEL_KEYS = {
  system: "colorSystem",
  light: "colorLight",
  dark: "colorDark",
};

function t(key, values = {}) {
  const template = translations[state.language]?.[key] || translations.zh[key] || key;
  return Object.entries(values).reduce((text, [name, value]) => text.replaceAll(`{${name}}`, String(value)), template);
}

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
    return t("progressEmpty");
  }

  const parts = [t("totalFiles", { count: summary.total })];
  if (summary.queued > 0) {
    parts.push(t("queuedCount", { count: summary.queued }));
  }
  if (summary.converting > 0) {
    parts.push(t("convertingCount", { count: summary.converting }));
  }
  if (summary.success > 0) {
    parts.push(t("successCount", { count: summary.success }));
  }
  if (summary.error > 0) {
    parts.push(t("errorCount", { count: summary.error }));
  }
  return parts.join(" · ");
}

function setConverting(isConverting) {
  state.isConverting = isConverting;
  elements.convertButton.dataset.loading = String(isConverting);
  elements.selectFileButton.disabled = isConverting;
  elements.selectOutputButton.disabled = isConverting;
  elements.retryFailedButton.disabled = isConverting || !state.queue.some((item) => item.supported && item.status === QUEUE_STATUS.ERROR);
  elements.clearCompletedButton.disabled = isConverting || !state.queue.some((item) => item.status === QUEUE_STATUS.SUCCESS);
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
    return item.outputPath || t("markdownSaved");
  }

  if (item.status === QUEUE_STATUS.ERROR) {
    return item.errorMessage || t("conversionFailed");
  }

  if (item.status === QUEUE_STATUS.CONVERTING) {
    return t("convertingDetail");
  }

  return item.path;
}

function renderQueue() {
  elements.queueList.textContent = "";

  if (state.queue.length === 0) {
    const empty = document.createElement("p");
    empty.className = "empty-queue";
    empty.textContent = t("emptyQueue");
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
    badge.textContent = t(STATUS_LABEL_KEYS[item.status] || "queued");

    const removeButton = document.createElement("button");
    removeButton.className = "icon-button";
    removeButton.type = "button";
    removeButton.textContent = t("remove");
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

function updateStaticText() {
  document.documentElement.lang = state.language === "zh" ? "zh-CN" : "en";
  elements.colorLabel.textContent = t("colorLabel");
  elements.colorButtonText.textContent = t(COLOR_LABEL_KEYS[state.color] || "colorLight");
  for (const option of elements.colorOptions) {
    const selected = option.dataset.colorOption === state.color;
    option.textContent = t(COLOR_LABEL_KEYS[option.dataset.colorOption] || "colorLight");
    option.setAttribute("aria-selected", String(selected));
  }
  elements.languageLabel.textContent = t("languageLabel");
  elements.languageButtonText.textContent = LANGUAGE_LABELS[state.language] || state.language;
  for (const option of elements.languageOptions) {
    const selected = option.dataset.languageOption === state.language;
    option.setAttribute("aria-selected", String(selected));
  }
  elements.workspace.setAttribute("aria-label", t("workspaceLabel"));
  elements.sidePanel.setAttribute("aria-label", t("settingsLabel"));
  elements.sourceQueueLabel.textContent = t("sourceQueue");
  elements.selectFileButton.textContent = t("selectFile");
  elements.queueHeaderLabel.textContent = t("queueTitle");
  elements.retryFailedButton.textContent = t("retryFailed");
  elements.clearCompletedButton.textContent = t("clearCompleted");
  elements.clearQueueButton.textContent = t("clearQueue");
  elements.outputSettingLabel.textContent = t("outputLocation");
  elements.selectOutputButton.textContent = t("selectFolder");
  elements.resultLabel.textContent = t("resultLabel");
  elements.openLocationButton.textContent = t("openOutput");
}

function updateConvertAvailability() {
  const summary = getQueueSummary(state.queue);
  const hasOutput = Boolean(state.outputDir);
  const canStart = canStartQueue(state.queue);
  elements.convertButton.disabled = !canStart || !hasOutput || state.isConverting;
  elements.retryFailedButton.disabled = state.isConverting || !state.queue.some((item) => item.supported && item.status === QUEUE_STATUS.ERROR);
  elements.clearCompletedButton.disabled = state.isConverting || !state.queue.some((item) => item.status === QUEUE_STATUS.SUCCESS);
  elements.clearQueueButton.disabled = state.isConverting || state.queue.length === 0;
  elements.convertButtonText.textContent = state.isConverting ? t("convertingButton") : t("convert");
  elements.progressSummary.textContent = formatProgress(summary);

  if (state.isConverting) {
    elements.hintText.textContent = t("hintConverting");
  } else if (summary.total === 0 && !hasOutput) {
    elements.hintText.textContent = t("hintInitial");
  } else if (summary.total === 0) {
    elements.hintText.textContent = t("hintChooseFiles");
  } else if (!hasOutput) {
    elements.hintText.textContent = t("hintChooseOutput");
  } else if (!canStart && summary.success > 0) {
    elements.hintText.textContent = t("hintFinished");
  } else if (!canStart) {
    elements.hintText.textContent = t("hintNoConvertible");
  } else {
    elements.hintText.textContent = t("hintReady");
  }

  setStatus(summary.total === 0 ? t("waitingStatus") : state.isConverting ? t("converting") : formatProgress(summary), getStatusTone(summary));
}

function renderDropZone() {
  const summary = getQueueSummary(state.queue);
  const firstQueued = getNextQueuedItem(state.queue);

  if (summary.total === 0) {
    elements.fileTitle.textContent = t("fileTitleEmpty");
    elements.fileMeta.textContent = t("fileMetaEmpty");
    setFileIcon("FILES", "empty");
    setDropZoneState("empty");
    return;
  }

  elements.fileTitle.textContent = t("addedFiles", { count: summary.total });
  elements.fileMeta.textContent = formatProgress(summary);
  setFileIcon(firstQueued ? getFileIconLabel(firstQueued) : "DONE", summary.error > 0 && summary.success === 0 ? "error" : "ready");
  setDropZoneState(summary.error > 0 && summary.success === 0 && summary.queued === 0 ? "error" : "ready");
}

function renderOutputDir(outputDir) {
  state.outputDir = outputDir || "";
  elements.outputDirText.textContent = state.outputDir || t("noOutputDir");
  renderAll();
}

function getResolvedColor(color) {
  if (color !== "system") {
    return color;
  }

  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function applyPreferences(preferences = {}) {
  state.language = ["zh", "en"].includes(preferences.language) ? preferences.language : state.language;
  state.color = ["system", "light", "dark"].includes(preferences.color) ? preferences.color : state.color;
  document.documentElement.dataset.theme = getResolvedColor(state.color);
  updateStaticText();
  renderAll();
}

function renderAll() {
  updateStaticText();
  renderDropZone();
  renderQueue();
  renderOutputDirText();
  updateConvertAvailability();
}

function renderOutputDirText() {
  elements.outputDirText.textContent = state.outputDir || t("noOutputDir");
}

function setPreferenceMenuOpen(switcher, button, menu, isOpen) {
  button.setAttribute("aria-expanded", String(isOpen));

  if (isOpen) {
    menu.hidden = false;
    window.requestAnimationFrame(() => {
      switcher.dataset.open = "true";
    });
    return;
  }

  switcher.dataset.open = "false";
  window.setTimeout(() => {
    if (switcher.dataset.open !== "true") {
      menu.hidden = true;
    }
  }, 180);
}

function setColorMenuOpen(isOpen) {
  setPreferenceMenuOpen(elements.colorSwitcher, elements.colorButton, elements.colorMenu, isOpen);
}

function setLanguageMenuOpen(isOpen) {
  setPreferenceMenuOpen(elements.languageSwitcher, elements.languageButton, elements.languageMenu, isOpen);
}

async function chooseColor(color) {
  if (!["system", "light", "dark"].includes(color) || color === state.color) {
    setColorMenuOpen(false);
    return;
  }

  const previousPreferences = { language: state.language, color: state.color };
  applyPreferences({ language: state.language, color: color });
  setColorMenuOpen(false);

  if (!window.markdownApp?.setPreferences) {
    return;
  }

  try {
    const preferences = await window.markdownApp.setPreferences({ color: color });
    applyPreferences(preferences);
  } catch {
    applyPreferences(previousPreferences);
  }
}

async function chooseLanguage(language) {
  if (!["zh", "en"].includes(language) || language === state.language) {
    setLanguageMenuOpen(false);
    return;
  }

  const previousPreferences = { language: state.language, color: state.color };
  applyPreferences({ language: language, color: state.color });
  setLanguageMenuOpen(false);

  if (!window.markdownApp?.setPreferences) {
    return;
  }

  try {
    const preferences = await window.markdownApp?.setPreferences({ language: language });
    applyPreferences(preferences);
  } catch {
    applyPreferences(previousPreferences);
  }
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
      convertFiles: (payload) => window.markdownApp.convertFiles(payload),
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
      label: t("partialConverted"),
      path: t("partialConvertedDetail", { success: summary.success, error: summary.error }),
      tone: "warning",
      canOpen: Boolean(state.lastOutputPath),
    });
  } else if (summary.success > 0) {
    showResult({
      label: t("allConverted"),
      path: t("allConvertedDetail", { success: summary.success }),
      tone: "success",
      canOpen: Boolean(state.lastOutputPath),
    });
  } else if (summary.error > 0) {
    showResult({
      label: t("noneConverted"),
      path: t("noneConvertedDetail"),
      tone: "error",
    });
  }
}

async function init() {
  if (!window.markdownApp?.getAppState) {
    applyPreferences({ language: state.language, color: state.color });
    renderOutputDir("");
    return;
  }

  const appState = await window.markdownApp.getAppState();
  applyPreferences(appState.preferences);
  renderOutputDir(appState.outputDir);
}

elements.selectFileButton.addEventListener("click", chooseInputFiles);

elements.colorButton.addEventListener("click", () => {
  setLanguageMenuOpen(false);
  setColorMenuOpen(elements.colorSwitcher.dataset.open !== "true");
});

for (const option of elements.colorOptions) {
  option.addEventListener("click", () => {
    chooseColor(option.dataset.colorOption);
  });
}

elements.languageButton.addEventListener("click", () => {
  setColorMenuOpen(false);
  setLanguageMenuOpen(elements.languageSwitcher.dataset.open !== "true");
});

for (const option of elements.languageOptions) {
  option.addEventListener("click", () => {
    chooseLanguage(option.dataset.languageOption);
  });
}

document.addEventListener("click", (event) => {
  if (!elements.colorSwitcher.contains(event.target)) {
    setColorMenuOpen(false);
  }
  if (!elements.languageSwitcher.contains(event.target)) {
    setLanguageMenuOpen(false);
  }
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    setColorMenuOpen(false);
    setLanguageMenuOpen(false);
    if (elements.colorSwitcher.contains(document.activeElement)) {
      elements.colorButton.focus();
    } else {
      elements.languageButton.focus();
    }
  }
});

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

elements.retryFailedButton.addEventListener("click", () => {
  if (state.isConverting) {
    return;
  }

  state.queue = resetFailedQueueItems(state.queue);
  clearResult();
  renderAll();
});

elements.clearCompletedButton.addEventListener("click", () => {
  if (state.isConverting) {
    return;
  }

  state.queue = removeCompletedQueueItems(state.queue);
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

elements.openLocationButton.addEventListener("click", async () => {
  const outputPath = state.lastOutputPath || state.lastOutputDir;
  if (!outputPath) {
    return;
  }

  const result = await window.markdownApp.openOutputLocation({ outputPath });
  if (!result.ok) {
    showResult({
      label: t("openOutputFailed"),
      path: result.message || t("openOutputFallback"),
      tone: "error",
    });
  }
});

window.markdownApp?.onPreferencesChanged?.((preferences) => {
  applyPreferences(preferences);
});

window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
  if (state.color === "system") {
    applyPreferences({ language: state.language, color: state.color });
  }
});

init();
