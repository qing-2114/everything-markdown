const state = {
  selectedFile: null,
  outputDir: "",
  isConverting: false,
  lastOutputPath: "",
};

const elements = {
  statusPill: document.querySelector("#statusPill"),
  fileDropZone: document.querySelector("#fileDropZone"),
  fileIcon: document.querySelector("#fileIcon"),
  fileTitle: document.querySelector("#fileTitle"),
  fileMeta: document.querySelector("#fileMeta"),
  outputDirText: document.querySelector("#outputDirText"),
  selectFileButton: document.querySelector("#selectFileButton"),
  selectOutputButton: document.querySelector("#selectOutputButton"),
  convertButton: document.querySelector("#convertButton"),
  convertButtonText: document.querySelector("#convertButtonText"),
  hintText: document.querySelector("#hintText"),
  resultPanel: document.querySelector("#resultPanel"),
  resultLabel: document.querySelector("#resultLabel"),
  resultPath: document.querySelector("#resultPath"),
  openLocationButton: document.querySelector("#openLocationButton"),
};

function setStatus(label, tone = "idle") {
  elements.statusPill.textContent = label;
  elements.statusPill.dataset.tone = tone;
}

function setDropZoneState(stateName = "empty") {
  elements.fileDropZone.dataset.state = stateName;
}

function setFileIcon(label = "FILE", tone = "empty") {
  elements.fileIcon.textContent = label;
  elements.fileIcon.dataset.tone = tone;
}

function getFileIconLabel(file) {
  if (!file?.ext) {
    return "FILE";
  }

  const label = file.ext.toUpperCase();
  return label.length > 4 ? label.slice(0, 4) : label;
}

function setConverting(isConverting) {
  state.isConverting = isConverting;
  elements.convertButton.dataset.loading = String(isConverting);
  elements.convertButtonText.textContent = isConverting ? "正在转换" : "转换为 Markdown";
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
}

function updateConvertAvailability() {
  const hasFile = Boolean(state.selectedFile);
  const hasOutput = Boolean(state.outputDir);
  const supported = Boolean(state.selectedFile?.supported);
  elements.convertButton.disabled = !hasFile || !hasOutput || !supported || state.isConverting;

  if (!state.isConverting) {
    elements.convertButtonText.textContent = state.lastOutputPath ? "再次转换" : "转换为 Markdown";
  }

  if (state.isConverting) {
    elements.hintText.textContent = "转换进行中，完成后会显示保存路径。";
  } else if (state.lastOutputPath) {
    elements.hintText.textContent = "已生成 Markdown 文件，可以继续转换或更换源文件。";
  } else if (!hasFile && !hasOutput) {
    elements.hintText.textContent = "先选择源文件，再选择 Markdown 的保存位置。";
  } else if (!hasFile) {
    elements.hintText.textContent = "请选择一个需要转换的文件。";
  } else if (!supported) {
    elements.hintText.textContent = "该文件类型暂不支持转换。";
  } else if (!hasOutput) {
    elements.hintText.textContent = "请选择 Markdown 文件保存位置。";
  } else {
    elements.hintText.textContent = "准备就绪，可以开始转换。";
  }
}

function renderSelectedFile(file) {
  state.selectedFile = file;
  clearResult();

  if (!file) {
    elements.fileTitle.textContent = "选择一个文件开始转换";
    elements.fileMeta.textContent = "支持 PDF、Word、PowerPoint、Excel、HTML、CSV、JSON、XML 和 TXT。";
    setFileIcon("FILE", "empty");
    setDropZoneState("empty");
    setStatus("等待文件", "idle");
    updateConvertAvailability();
    return;
  }

  elements.fileTitle.textContent = file.name;
  elements.fileMeta.textContent = file.supported
    ? `已识别 .${file.ext} 文件，可转换为 Markdown。`
    : `暂不支持 .${file.ext || "unknown"} 文件。`;

  setDropZoneState(file.supported ? "ready" : "error");
  setFileIcon(getFileIconLabel(file), file.supported ? "ready" : "error");
  setStatus(file.supported ? "可转换" : "不支持", file.supported ? "ready" : "error");

  if (!file.supported) {
    showResult({
      label: "暂不支持该文件",
      path: "请换用 PDF、DOCX、PPTX、XLSX、HTML、CSV、JSON、XML 或 TXT 文件。",
      tone: "error",
    });
  }

  updateConvertAvailability();
}

function renderOutputDir(outputDir) {
  state.outputDir = outputDir || "";
  elements.outputDirText.textContent = state.outputDir || "尚未选择保存位置";
  updateConvertAvailability();
}

function getDraggedFilePath(event) {
  const file = event.dataTransfer?.files?.[0];
  if (!file) {
    return "";
  }

  return window.markdownApp.getPathForFile(file) || file.path || "";
}

async function chooseInputFile() {
  const file = await window.markdownApp.selectInputFile();
  if (file) {
    renderSelectedFile(file);
  }
}

async function init() {
  const appState = await window.markdownApp.getAppState();
  renderOutputDir(appState.outputDir);
  renderSelectedFile(null);
}

elements.selectFileButton.addEventListener("click", chooseInputFile);

elements.fileDropZone.addEventListener("dragenter", (event) => {
  event.preventDefault();
  elements.fileDropZone.dataset.dragging = "true";
});

elements.fileDropZone.addEventListener("dragover", (event) => {
  event.preventDefault();
  event.dataTransfer.dropEffect = "copy";
  elements.fileDropZone.dataset.dragging = "true";
});

elements.fileDropZone.addEventListener("dragleave", (event) => {
  if (!elements.fileDropZone.contains(event.relatedTarget)) {
    elements.fileDropZone.dataset.dragging = "false";
  }
});

elements.fileDropZone.addEventListener("drop", async (event) => {
  event.preventDefault();
  elements.fileDropZone.dataset.dragging = "false";

  const filePath = getDraggedFilePath(event);
  if (!filePath) {
    return;
  }

  const file = await window.markdownApp.getFileInfo(filePath);
  renderSelectedFile(file);
});

elements.selectOutputButton.addEventListener("click", async () => {
  const result = await window.markdownApp.selectOutputDirectory();
  if (result) {
    renderOutputDir(result.path);
  }
});

elements.convertButton.addEventListener("click", async () => {
  if (!state.selectedFile || !state.outputDir || state.isConverting) {
    return;
  }

  setConverting(true);
  clearResult();
  setStatus("转换中", "working");
  updateConvertAvailability();

  const result = await window.markdownApp.convertFile({
    inputPath: state.selectedFile.path,
    outputDir: state.outputDir,
  });

  setConverting(false);

  if (result.ok) {
    state.lastOutputPath = result.outputPath;
    setStatus("转换完成", "success");
    showResult({
      label: "Markdown 已保存",
      path: result.outputPath,
      tone: "success",
      canOpen: true,
    });
  } else {
    setStatus("转换失败", "error");
    showResult({
      label: "转换失败",
      path: result.message || "请检查文件、输出目录或 MarkItDown 环境。",
      tone: "error",
    });
  }

  updateConvertAvailability();
});

elements.openLocationButton.addEventListener("click", async () => {
  if (!state.lastOutputPath) {
    return;
  }

  const result = await window.markdownApp.openOutputLocation({ outputPath: state.lastOutputPath });
  if (!result.ok) {
    showResult({
      label: "无法打开文件所在位置",
      path: result.message || "请手动复制路径打开。",
      tone: "error",
    });
  }
});

init();
