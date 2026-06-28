(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.queueUtils = factory();
  }
})(typeof self !== "undefined" ? self : this, function () {
  const QUEUE_STATUS = {
    QUEUED: "queued",
    CONVERTING: "converting",
    SUCCESS: "success",
    ERROR: "error",
  };

  function createQueueItem(file, id) {
    const supported = Boolean(file?.supported);
    return {
      id,
      path: file?.path || "",
      name: file?.name || "Unknown file",
      ext: file?.ext || "",
      supported,
      status: supported ? QUEUE_STATUS.QUEUED : QUEUE_STATUS.ERROR,
      outputPath: "",
      errorMessage: supported ? "" : `暂不支持 .${file?.ext || "unknown"} 文件。`,
    };
  }

  function addFilesToQueue(queue, files, nextId) {
    const existingPaths = new Set(queue.map((item) => item.path));
    const nextQueue = [...queue];
    let currentId = nextId;

    for (const file of files) {
      if (!file?.path || existingPaths.has(file.path)) {
        continue;
      }

      nextQueue.push(createQueueItem(file, currentId));
      existingPaths.add(file.path);
      currentId += 1;
    }

    return { queue: nextQueue, nextId: currentId };
  }

  function removeQueueItem(queue, id) {
    return queue.filter((item) => item.id !== id || item.status !== QUEUE_STATUS.QUEUED);
  }

  function resetFailedQueueItems(queue) {
    return queue.map((item) => {
      if (item.supported && item.status === QUEUE_STATUS.ERROR) {
        return {
          ...item,
          status: QUEUE_STATUS.QUEUED,
          errorMessage: "",
          outputPath: "",
        };
      }

      return item;
    });
  }

  function removeCompletedQueueItems(queue) {
    return queue.filter((item) => item.status !== QUEUE_STATUS.SUCCESS);
  }

  function updateQueueItem(queue, id, updates) {
    return queue.map((item) => (item.id === id ? { ...item, ...updates } : item));
  }

  function getNextQueuedItem(queue) {
    return queue.find((item) => item.supported && item.status === QUEUE_STATUS.QUEUED) || null;
  }

  function getQueueSummary(queue) {
    const summary = {
      total: queue.length,
      queued: 0,
      converting: 0,
      success: 0,
      error: 0,
      convertible: 0,
      done: 0,
    };

    for (const item of queue) {
      if (item.supported) {
        summary.convertible += 1;
      }

      if (summary[item.status] !== undefined) {
        summary[item.status] += 1;
      }
    }

    summary.done = summary.success + summary.error;
    return summary;
  }

  function canStartQueue(queue) {
    return Boolean(getNextQueuedItem(queue));
  }

  function getConversionErrorMessage(resultOrError) {
    if (resultOrError?.message) {
      return resultOrError.message;
    }

    return "转换失败，请检查文件、输出目录或 MarkItDown 环境。";
  }

  async function runQueueConversion({ queue, outputDir, convertFile, convertFiles, onQueueChange = () => {} }) {
    let nextQueue = queue;
    let lastOutputPath = "";
    let lastOutputDir = "";

    if (typeof convertFiles === "function") {
      const items = nextQueue.filter((item) => item.supported && item.status === QUEUE_STATUS.QUEUED);
      if (items.length === 0) {
        return { queue: nextQueue, lastOutputPath, lastOutputDir };
      }

      nextQueue = nextQueue.map((item) =>
        items.some((queuedItem) => queuedItem.id === item.id)
          ? { ...item, status: QUEUE_STATUS.CONVERTING, errorMessage: "", outputPath: "" }
          : item,
      );
      onQueueChange(nextQueue);

      let result;
      try {
        result = await convertFiles({
          outputDir,
          items: items.map((item) => ({ id: item.id, inputPath: item.path })),
        });
      } catch (error) {
        result = {
          ok: false,
          message: getConversionErrorMessage(error),
          results: items.map((item) => ({ inputPath: item.path, ok: false, message: getConversionErrorMessage(error) })),
        };
      }

      const resultsByPath = new Map((result?.results || []).map((itemResult) => [itemResult.inputPath, itemResult]));
      for (const item of items) {
        const itemResult = resultsByPath.get(item.path);
        if (itemResult?.ok) {
          nextQueue = updateQueueItem(nextQueue, item.id, {
            status: QUEUE_STATUS.SUCCESS,
            outputPath: itemResult.outputPath,
          });
          lastOutputPath = itemResult.outputPath || "";
          lastOutputDir = outputDir;
        } else {
          nextQueue = updateQueueItem(nextQueue, item.id, {
            status: QUEUE_STATUS.ERROR,
            errorMessage: getConversionErrorMessage(itemResult || result),
          });
        }
      }

      onQueueChange(nextQueue);
      return { queue: nextQueue, lastOutputPath, lastOutputDir };
    }

    let item = getNextQueuedItem(nextQueue);

    while (item) {
      nextQueue = updateQueueItem(nextQueue, item.id, {
        status: QUEUE_STATUS.CONVERTING,
        errorMessage: "",
        outputPath: "",
      });
      onQueueChange(nextQueue);

      let result;
      try {
        result = await convertFile({
          inputPath: item.path,
          outputDir,
        });
      } catch (error) {
        result = {
          ok: false,
          errorCode: "CONVERSION_INVOKE_FAILED",
          message: getConversionErrorMessage(error),
        };
      }

      if (result?.ok) {
        nextQueue = updateQueueItem(nextQueue, item.id, {
          status: QUEUE_STATUS.SUCCESS,
          outputPath: result.outputPath,
        });
        lastOutputPath = result.outputPath || "";
        lastOutputDir = outputDir;
      } else {
        nextQueue = updateQueueItem(nextQueue, item.id, {
          status: QUEUE_STATUS.ERROR,
          errorMessage: getConversionErrorMessage(result),
        });
      }

      onQueueChange(nextQueue);
      item = getNextQueuedItem(nextQueue);
    }

    return { queue: nextQueue, lastOutputPath, lastOutputDir };
  }

  return {
    QUEUE_STATUS,
    addFilesToQueue,
    canStartQueue,
    createQueueItem,
    getNextQueuedItem,
    getQueueSummary,
    removeCompletedQueueItems,
    removeQueueItem,
    resetFailedQueueItems,
    runQueueConversion,
    updateQueueItem,
  };
});
