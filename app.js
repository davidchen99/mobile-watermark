const MARGIN = 24;
const FONT_SIZE_RATIO = 0.035;

const state = {
  imageFiles: [],
  selectedIndex: 0,
  logoBitmap: null,
  working: false,
  batchResults: [],
  textColor: "#ffffff",
};

const el = {
  imagesInput: document.querySelector("#imagesInput"),
  watermarkText: document.querySelector("#watermarkText"),
  opacityRange: document.querySelector("#opacityRange"),
  fontScaleRange: document.querySelector("#fontScaleRange"),
  textColorPicker: document.querySelector("#textColorPicker"),
  colorChips: Array.from(document.querySelectorAll(".color-chip")),
  logoInput: document.querySelector("#logoInput"),
  logoName: document.querySelector("#logoName"),
  logoOpacityRange: document.querySelector("#logoOpacityRange"),
  logoScaleRange: document.querySelector("#logoScaleRange"),
  previewCanvas: document.querySelector("#previewCanvas"),
  previewStage: document.querySelector("#previewStage"),
  previewEmpty: document.querySelector("#previewEmpty"),
  thumbStrip: document.querySelector("#thumbStrip"),
  imageCount: document.querySelector("#imageCount"),
  currentFileName: document.querySelector("#currentFileName"),
  statusPill: document.querySelector("#statusPill"),
  progressText: document.querySelector("#progressText"),
  progressPercent: document.querySelector("#progressPercent"),
  progressBar: document.querySelector("#progressBar"),
  saveHint: document.querySelector("#saveHint"),
  previewBtn: document.querySelector("#previewBtn"),
  togglePreviewBtn: document.querySelector("#togglePreviewBtn"),
  downloadCurrentBtn: document.querySelector("#downloadCurrentBtn"),
  downloadAllBtn: document.querySelector("#downloadAllBtn"),
  resetBtn: document.querySelector("#resetBtn"),
  opacityValue: document.querySelector("#opacityValue"),
  fontScaleValue: document.querySelector("#fontScaleValue"),
  logoOpacityValue: document.querySelector("#logoOpacityValue"),
  logoScaleValue: document.querySelector("#logoScaleValue"),
  resultsSheet: document.querySelector("#resultsSheet"),
  sheetBackdrop: document.querySelector("#sheetBackdrop"),
  closeSheetBtn: document.querySelector("#closeSheetBtn"),
  sheetTitle: document.querySelector("#sheetTitle"),
  resultsList: document.querySelector("#resultsList"),
  downloadSheetAllBtn: document.querySelector("#downloadSheetAllBtn"),
  shareSheetAllBtn: document.querySelector("#shareSheetAllBtn"),
};

const previewCtx = el.previewCanvas.getContext("2d", { alpha: false });

function getSettings() {
  return {
    text: el.watermarkText.value.trim() || "© Watermark",
    textColor: state.textColor,
    opacity: clampNumber(Number(el.opacityRange.value), 20, 255, 110),
    fontScale: clampNumber(Number(el.fontScaleRange.value), 0.5, 2, 1),
    logoOpacity: clampNumber(Number(el.logoOpacityRange.value), 30, 255, 200),
    logoScale: clampNumber(Number(el.logoScaleRange.value), 0.3, 2, 1),
  };
}

function clampNumber(value, min, max, fallback) {
  if (!Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, value));
}

function updateValueLabels() {
  el.opacityValue.textContent = el.opacityRange.value;
  el.fontScaleValue.textContent = `${Number(el.fontScaleRange.value).toFixed(1)}x`;
  el.logoOpacityValue.textContent = el.logoOpacityRange.value;
  el.logoScaleValue.textContent = `${Number(el.logoScaleRange.value).toFixed(1)}x`;
}

function setProgress(done, total, label) {
  const percent = total ? Math.round((done / total) * 100) : 0;
  el.progressText.textContent = label;
  el.progressPercent.textContent = `${percent}%`;
  el.progressBar.style.width = `${percent}%`;
}

function setStatus(text) {
  el.statusPill.textContent = text;
}

function resetControls() {
  el.watermarkText.value = "© Watermark";
  el.opacityRange.value = "110";
  el.fontScaleRange.value = "1";
  el.logoOpacityRange.value = "200";
  el.logoScaleRange.value = "1";
  setTextColor("#ffffff");
  updateValueLabels();
  queuePreview();
}

function queuePreview() {
  window.requestAnimationFrame(() => {
    void renderSelectedPreview();
  });
}

async function fileToBitmap(file) {
  if ("createImageBitmap" in window) {
    try {
      return await createImageBitmap(file, { imageOrientation: "from-image" });
    } catch {
      try {
        return await createImageBitmap(file);
      } catch {
        // fall through
      }
    }
  }

  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error(`无法读取图片：${file.name}`));
    };
    if ("decoding" in img) img.decoding = "async";
    img.src = url;
  });
}

function safeBaseName(fileName) {
  const dotIndex = fileName.lastIndexOf(".");
  const base = dotIndex >= 0 ? fileName.slice(0, dotIndex) : fileName;
  return (base || "watermarked").replace(/[\\/:*?"<>|]/g, "_");
}

function formatOutputName(file, index) {
  return `${safeBaseName(file.name)}_${String(index + 1).padStart(3, "0")}.jpg`;
}

function makeObjectUrl(blob) {
  return URL.createObjectURL(blob);
}

function revokeBatchUrls() {
  state.batchResults.forEach((item) => {
    if (item.url) URL.revokeObjectURL(item.url);
  });
}

function renderThumbnails() {
  el.thumbStrip.innerHTML = "";
  if (!state.imageFiles.length) {
    el.thumbStrip.classList.add("empty");
    el.imageCount.textContent = "0 张";
    return;
  }

  el.thumbStrip.classList.remove("empty");
  el.imageCount.textContent = `${state.imageFiles.length} 张`;

  state.imageFiles.forEach((file, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `thumb${index === state.selectedIndex ? " active" : ""}`;

    const img = document.createElement("img");
    img.alt = file.name;
    img.src = URL.createObjectURL(file);
    img.addEventListener("load", () => URL.revokeObjectURL(img.src), { once: true });

    const remove = document.createElement("span");
    remove.className = "thumb-remove";
    remove.textContent = "×";

    button.appendChild(img);
    button.appendChild(remove);
    button.addEventListener("click", (event) => {
      const rect = button.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;
      if (x >= rect.width - 34 && x <= rect.width && y >= 0 && y <= 34) {
        removeImage(index);
        return;
      }
      state.selectedIndex = index;
      renderThumbnails();
      queuePreview();
    });

    el.thumbStrip.appendChild(button);
  });
}

function removeImage(index) {
  state.imageFiles.splice(index, 1);
  if (!state.imageFiles.length) {
    state.selectedIndex = 0;
  } else if (state.selectedIndex >= state.imageFiles.length) {
    state.selectedIndex = state.imageFiles.length - 1;
  }
  renderThumbnails();
  queuePreview();
  setStatus(state.imageFiles.length ? "图片已更新" : "等待图片");
}

function setTextColor(color) {
  state.textColor = color;
  el.colorChips.forEach((chip) => {
    chip.classList.toggle("active", chip.dataset.color === color);
  });
}

async function drawWatermark(bitmap, canvas, settings) {
  const width = bitmap.width;
  const height = bitmap.height;
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext("2d", { alpha: false });
  ctx.clearRect(0, 0, width, height);
  ctx.drawImage(bitmap, 0, 0);

  const fontSize = Math.max(18, Math.floor(Math.min(width, height) * FONT_SIZE_RATIO * settings.fontScale));
  ctx.font = `600 ${fontSize}px "Segoe UI","PingFang SC","Hiragino Sans GB","Microsoft YaHei",sans-serif`;
  ctx.textBaseline = "top";

  const textMetrics = ctx.measureText(settings.text);
  const textWidth = textMetrics.width;
  const textHeight = Math.max(fontSize, (textMetrics.actualBoundingBoxAscent || fontSize) + (textMetrics.actualBoundingBoxDescent || 0));
  const x = Math.max(MARGIN, width - textWidth - MARGIN);
  const y = Math.max(MARGIN, height - textHeight - MARGIN);

  ctx.fillStyle = `rgba(0, 0, 0, ${Math.min(255, settings.opacity + 70) / 255})`;
  ctx.fillText(settings.text, x + 2, y + 2);
  const { r, g, b } = hexToRgb(settings.textColor);
  ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${settings.opacity / 255})`;
  ctx.fillText(settings.text, x, y);

  if (state.logoBitmap) {
    const maxSide = Math.max(48, Math.floor(Math.min(width, height) * 0.16 * settings.logoScale));
    const ratio = Math.min(maxSide / state.logoBitmap.width, maxSide / state.logoBitmap.height, 1);
    const logoWidth = Math.max(1, Math.floor(state.logoBitmap.width * ratio));
    const logoHeight = Math.max(1, Math.floor(state.logoBitmap.height * ratio));
    const logoX = Math.max(MARGIN, width - logoWidth - MARGIN);
    const logoY = Math.max(MARGIN, height - logoHeight - textHeight - MARGIN - 12);
    ctx.save();
    ctx.globalAlpha = settings.logoOpacity / 255;
    ctx.drawImage(state.logoBitmap, logoX, logoY, logoWidth, logoHeight);
    ctx.restore();
  }
}

async function renderSelectedPreview() {
  const file = state.imageFiles[state.selectedIndex];
  if (!file) {
    previewCtx.clearRect(0, 0, el.previewCanvas.width, el.previewCanvas.height);
    el.previewCanvas.width = 0;
    el.previewCanvas.height = 0;
    el.previewEmpty.style.display = "grid";
    el.currentFileName.textContent = "还没选择图片";
    setStatus("等待图片");
    return;
  }

  setStatus("正在预览");
  el.currentFileName.textContent = file.name;
  const bitmap = await fileToBitmap(file);
  const workCanvas = document.createElement("canvas");
  await drawWatermark(bitmap, workCanvas, getSettings());

  const maxWidth = Math.min(window.innerWidth - 40, 720);
  const ratio = Math.min(maxWidth / workCanvas.width, 1);
  el.previewCanvas.width = Math.max(1, Math.floor(workCanvas.width * ratio));
  el.previewCanvas.height = Math.max(1, Math.floor(workCanvas.height * ratio));
  previewCtx.clearRect(0, 0, el.previewCanvas.width, el.previewCanvas.height);
  previewCtx.drawImage(workCanvas, 0, 0, el.previewCanvas.width, el.previewCanvas.height);
  el.previewEmpty.style.display = "none";
  setStatus(`预览：${file.name}`);
  if (typeof bitmap.close === "function") bitmap.close();
}

function togglePreviewStage() {
  const expanded = el.previewStage.classList.toggle("expanded");
  el.previewStage.classList.toggle("compact", !expanded);
  el.togglePreviewBtn.textContent = expanded ? "收起预览" : "展开预览";
}

async function canvasToJpegBlob(canvas, quality) {
  if (canvas.toBlob) {
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
    if (blob) return blob;
  }
  const dataUrl = canvas.toDataURL("image/jpeg", quality);
  const response = await fetch(dataUrl);
  return response.blob();
}

async function exportBlob(file) {
  const bitmap = await fileToBitmap(file);
  const canvas = document.createElement("canvas");
  await drawWatermark(bitmap, canvas, getSettings());
  const blob = await canvasToJpegBlob(canvas, 0.95);
  if (typeof bitmap.close === "function") bitmap.close();
  if (!blob) throw new Error("图片导出失败");
  return blob;
}

function downloadBlob(blob, filename) {
  const url = makeObjectUrl(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

function hexToRgb(hex) {
  const normalized = hex.replace("#", "");
  const value = normalized.length === 3
    ? normalized.split("").map((ch) => ch + ch).join("")
    : normalized;
  const int = parseInt(value, 16);
  return {
    r: (int >> 16) & 255,
    g: (int >> 8) & 255,
    b: int & 255,
  };
}

async function shareFiles(items) {
  if (!navigator.share || !navigator.canShare) return false;
  try {
    const files = items.map((item) => new File([item.blob], item.name, { type: "image/jpeg" }));
    if (!navigator.canShare({ files })) return false;
    await navigator.share({
      files,
      title: files.length === 1 ? "图片已生成" : "批量图片已生成",
      text: "请选择保存、发送到微信，或继续分享。",
    });
    return true;
  } catch (error) {
    if (error && error.name === "AbortError") return true;
    return false;
  }
}

function openSheet() {
  el.resultsSheet.classList.remove("hidden");
}

function closeSheet() {
  el.resultsSheet.classList.add("hidden");
}

function renderResultsSheet() {
  el.sheetTitle.textContent = `已生成 ${state.batchResults.length} 张图片`;
  el.resultsList.innerHTML = "";

  state.batchResults.forEach((item, index) => {
    const card = document.createElement("div");
    card.className = "result-card";

    const thumb = document.createElement("div");
    thumb.className = "result-thumb";
    const img = document.createElement("img");
    img.src = item.url;
    img.alt = item.name;
    thumb.appendChild(img);

    const body = document.createElement("div");
    body.className = "result-body";

    const name = document.createElement("p");
    name.className = "result-name";
    name.textContent = item.name;

    const status = document.createElement("p");
    status.className = "result-status";
    status.textContent = "可下载，可分享，可转微信。";

    const actions = document.createElement("div");
    actions.className = "result-actions";

    const saveBtn = document.createElement("button");
    saveBtn.className = "secondary-btn";
    saveBtn.type = "button";
    saveBtn.textContent = "下载";
    saveBtn.addEventListener("click", () => {
      downloadBlob(item.blob, item.name);
    });

    const shareBtn = document.createElement("button");
    shareBtn.className = "primary-btn";
    shareBtn.type = "button";
    shareBtn.textContent = "分享";
    shareBtn.addEventListener("click", async () => {
      const ok = await shareFiles([item]);
      if (!ok) downloadBlob(item.blob, item.name);
    });

    actions.append(saveBtn, shareBtn);
    body.append(name, status, actions);
    card.append(thumb, body);
    el.resultsList.appendChild(card);
  });
}

async function downloadCurrent() {
  const file = state.imageFiles[state.selectedIndex];
  if (!file || state.working) return;
  state.working = true;
  try {
    setStatus("导出当前图片");
    setProgress(0, 1, "正在生成当前图片");
    const blob = await exportBlob(file);
    const name = formatOutputName(file, state.selectedIndex);
    downloadBlob(blob, name);
    setProgress(1, 1, "当前图片已生成");
    setStatus("当前图片已生成");
    el.saveHint.textContent = "图片文件已生成。你可以从系统下载中查看，或继续转发到微信 / 文件。";
  } catch (error) {
    console.error(error);
    setStatus("导出失败");
    setProgress(0, 1, "导出失败");
    alert("当前图片导出失败，请重试。");
  } finally {
    state.working = false;
  }
}

async function generateBatchResults() {
  if (!state.imageFiles.length || state.working) return;
  state.working = true;
  try {
    revokeBatchUrls();
    state.batchResults = [];
    setStatus("批量处理中");
    const total = state.imageFiles.length;
    for (let i = 0; i < total; i += 1) {
      const file = state.imageFiles[i];
      setProgress(i, total, `正在处理 ${i + 1}/${total}: ${file.name}`);
      const blob = await exportBlob(file);
      state.batchResults.push({
        name: formatOutputName(file, i),
        blob,
        url: makeObjectUrl(blob),
      });
    }
    setProgress(total, total, "全部处理完成");
    setStatus("批量结果已生成");
    renderResultsSheet();
    openSheet();
    el.saveHint.textContent = "批量结果已生成。建议在结果面板里逐张下载或分享，路径更明确。";
  } catch (error) {
    console.error(error);
    setStatus("批量导出失败");
    setProgress(0, state.imageFiles.length || 1, "批量导出失败");
    alert("批量导出失败，请减少图片数量后重试。");
  } finally {
    state.working = false;
  }
}

function downloadAllBatchFiles() {
  if (!state.batchResults.length) return;
  state.batchResults.forEach((item, index) => {
    setTimeout(() => downloadBlob(item.blob, item.name), index * 180);
  });
}

async function shareAllBatchFiles() {
  if (!state.batchResults.length) return;
  const ok = await shareFiles(state.batchResults);
  if (!ok) downloadAllBatchFiles();
}

async function handleImagesSelected(event) {
  const files = Array.from(event.target.files || []).filter((file) => file.type.startsWith("image/"));
  state.imageFiles = files;
  state.selectedIndex = 0;
  renderThumbnails();
  setProgress(0, files.length || 1, files.length ? "图片已载入" : "未开始");
  setStatus(files.length ? "图片已载入" : "等待图片");
  await renderSelectedPreview();
}

async function handleLogoSelected(event) {
  const [file] = Array.from(event.target.files || []);
  if (!file) {
    if (state.logoBitmap && typeof state.logoBitmap.close === "function") state.logoBitmap.close();
    state.logoBitmap = null;
    el.logoName.textContent = "未选择";
    queuePreview();
    return;
  }

  if (state.logoBitmap && typeof state.logoBitmap.close === "function") state.logoBitmap.close();
  state.logoBitmap = await fileToBitmap(file);
  el.logoName.textContent = file.name;
  queuePreview();
}

[
  el.watermarkText,
  el.opacityRange,
  el.fontScaleRange,
  el.logoOpacityRange,
  el.logoScaleRange,
].forEach((node) => {
  node.addEventListener("input", () => {
    updateValueLabels();
    queuePreview();
  });
});

el.imagesInput.addEventListener("change", (event) => {
  void handleImagesSelected(event);
});

el.logoInput.addEventListener("change", (event) => {
  void handleLogoSelected(event);
});

el.textColorPicker.addEventListener("click", (event) => {
  const chip = event.target.closest(".color-chip");
  if (!chip) return;
  setTextColor(chip.dataset.color);
  queuePreview();
});

el.previewBtn.addEventListener("click", () => {
  void renderSelectedPreview();
});

el.togglePreviewBtn.addEventListener("click", togglePreviewStage);
el.downloadCurrentBtn.addEventListener("click", () => { void downloadCurrent(); });
el.downloadAllBtn.addEventListener("click", () => { void generateBatchResults(); });
el.downloadSheetAllBtn.addEventListener("click", downloadAllBatchFiles);
el.shareSheetAllBtn.addEventListener("click", () => { void shareAllBatchFiles(); });
el.closeSheetBtn.addEventListener("click", closeSheet);
el.sheetBackdrop.addEventListener("click", closeSheet);
el.resetBtn.addEventListener("click", resetControls);

resetControls();
updateValueLabels();
setProgress(0, 1, "未开始");
