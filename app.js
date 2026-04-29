const MARGIN = 24;
const FONT_SIZE_RATIO = 0.035;

const state = {
  imageFiles: [],
  selectedIndex: 0,
  logoBitmap: null,
  logoName: "",
  working: false,
};

const presets = {
  light: { text: "© Watermark", opacity: 110, fontScale: 1, offsetX: 0, offsetY: 0, logoOpacity: 200, logoScale: 1 },
  brand: { text: "品牌出品", opacity: 145, fontScale: 1.2, offsetX: -8, offsetY: -8, logoOpacity: 220, logoScale: 1.1 },
  bold: { text: "请勿盗图", opacity: 180, fontScale: 1.5, offsetX: -16, offsetY: -12, logoOpacity: 235, logoScale: 1.25 },
};

const el = {
  imagesInput: document.querySelector("#imagesInput"),
  watermarkText: document.querySelector("#watermarkText"),
  opacityRange: document.querySelector("#opacityRange"),
  fontScaleRange: document.querySelector("#fontScaleRange"),
  offsetX: document.querySelector("#offsetX"),
  offsetY: document.querySelector("#offsetY"),
  logoInput: document.querySelector("#logoInput"),
  logoName: document.querySelector("#logoName"),
  logoOpacityRange: document.querySelector("#logoOpacityRange"),
  logoScaleRange: document.querySelector("#logoScaleRange"),
  namingMode: document.querySelector("#namingMode"),
  namePrefix: document.querySelector("#namePrefix"),
  presetButtons: Array.from(document.querySelectorAll(".preset-btn")),
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
  previewBtn: document.querySelector("#previewBtn"),
  togglePreviewBtn: document.querySelector("#togglePreviewBtn"),
  downloadCurrentBtn: document.querySelector("#downloadCurrentBtn"),
  downloadAllBtn: document.querySelector("#downloadAllBtn"),
  resetBtn: document.querySelector("#resetBtn"),
  opacityValue: document.querySelector("#opacityValue"),
  fontScaleValue: document.querySelector("#fontScaleValue"),
  logoOpacityValue: document.querySelector("#logoOpacityValue"),
  logoScaleValue: document.querySelector("#logoScaleValue"),
};

const previewCtx = el.previewCanvas.getContext("2d", { alpha: false });

function getSettings() {
  return {
    text: el.watermarkText.value.trim() || "© Watermark",
    opacity: clampNumber(Number(el.opacityRange.value), 20, 255, 110),
    fontScale: clampNumber(Number(el.fontScaleRange.value), 0.5, 2, 1),
    offsetX: clampNumber(Number(el.offsetX.value), -1000, 1000, 0),
    offsetY: clampNumber(Number(el.offsetY.value), -1000, 1000, 0),
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

async function fileToBitmap(file) {
  if ("createImageBitmap" in window) {
    try {
      return await createImageBitmap(file, { imageOrientation: "from-image" });
    } catch (error) {
      try {
        return await createImageBitmap(file);
      } catch {
        console.warn("createImageBitmap failed, fallback to HTMLImageElement", error);
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

function sanitizeBaseName(value) {
  return value.replace(/[\\/:*?"<>|]/g, "_").trim() || "watermarked";
}

function formatOutputName(file, index) {
  const dotIndex = file.name.lastIndexOf(".");
  const base = sanitizeBaseName(dotIndex >= 0 ? file.name.slice(0, dotIndex) : file.name);
  const mode = el.namingMode.value;
  const prefix = sanitizeBaseName(el.namePrefix.value || "wm");
  if (mode === "prefix") return `${prefix}_${base}.jpg`;
  if (mode === "sequence") return `${prefix}_${String(index + 1).padStart(3, "0")}.jpg`;
  if (mode === "timestamp") return `${prefix}_${makeTimestamp()}_${String(index + 1).padStart(3, "0")}.jpg`;
  return `${base}_watermarked.jpg`;
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

function applyPreset(name) {
  const preset = presets[name];
  if (!preset) return;
  el.watermarkText.value = preset.text;
  el.opacityRange.value = String(preset.opacity);
  el.fontScaleRange.value = String(preset.fontScale);
  el.offsetX.value = String(preset.offsetX);
  el.offsetY.value = String(preset.offsetY);
  el.logoOpacityRange.value = String(preset.logoOpacity);
  el.logoScaleRange.value = String(preset.logoScale);
  updateValueLabels();
}

function resetControls() {
  applyPreset("light");
  el.namingMode.value = "suffix";
  el.namePrefix.value = "wm";
  updateValueLabels();
  queuePreview();
}

function queuePreview() {
  window.requestAnimationFrame(() => {
    void renderSelectedPreview();
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
    button.appendChild(img);
    button.addEventListener("click", () => {
      state.selectedIndex = index;
      renderThumbnails();
      queuePreview();
    });
    el.thumbStrip.appendChild(button);
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
  const x = Math.max(MARGIN, width - textWidth - MARGIN + settings.offsetX);
  const y = Math.max(MARGIN, height - textHeight - MARGIN + settings.offsetY);

  ctx.fillStyle = `rgba(0, 0, 0, ${Math.min(255, settings.opacity + 70) / 255})`;
  ctx.fillText(settings.text, x + 2, y + 2);
  ctx.fillStyle = `rgba(255, 255, 255, ${settings.opacity / 255})`;
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
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

async function downloadCurrent() {
  const file = state.imageFiles[state.selectedIndex];
  if (!file || state.working) return;
  state.working = true;
  try {
    setStatus("导出当前图片");
    setProgress(0, 1, "正在生成当前图片");
    const blob = await exportBlob(file);
    downloadBlob(blob, formatOutputName(file, state.selectedIndex));
    setProgress(1, 1, "当前图片已下载");
    setStatus("当前图片已下载");
  } catch (error) {
    console.error(error);
    setStatus("导出失败");
    setProgress(0, 1, "导出失败");
    alert("当前图片导出失败，请重试。");
  } finally {
    state.working = false;
  }
}

function makeTimestamp() {
  const now = new Date();
  const pad = (value) => String(value).padStart(2, "0");
  return `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
}

const crcTable = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(bytes) {
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i += 1) crc = crcTable[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function toDosDate(date) {
  const year = Math.max(1980, date.getFullYear());
  return ((year - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate();
}

function toDosTime(date) {
  return (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2);
}

function writeU16(view, offset, value) {
  view.setUint16(offset, value, true);
}

function writeU32(view, offset, value) {
  view.setUint32(offset, value >>> 0, true);
}

async function createZip(entries) {
  const encoder = new TextEncoder();
  const date = new Date();
  const dosDate = toDosDate(date);
  const dosTime = toDosTime(date);
  const localChunks = [];
  const centralChunks = [];
  let offset = 0;

  for (const entry of entries) {
    const nameBytes = encoder.encode(entry.name);
    const data = new Uint8Array(await entry.blob.arrayBuffer());
    const crc = crc32(data);

    const localHeader = new ArrayBuffer(30 + nameBytes.length);
    const localView = new DataView(localHeader);
    writeU32(localView, 0, 0x04034b50);
    writeU16(localView, 4, 20);
    writeU16(localView, 6, 0);
    writeU16(localView, 8, 0);
    writeU16(localView, 10, dosTime);
    writeU16(localView, 12, dosDate);
    writeU32(localView, 14, crc);
    writeU32(localView, 18, data.length);
    writeU32(localView, 22, data.length);
    writeU16(localView, 26, nameBytes.length);
    writeU16(localView, 28, 0);
    new Uint8Array(localHeader, 30).set(nameBytes);
    localChunks.push(new Uint8Array(localHeader), data);

    const centralHeader = new ArrayBuffer(46 + nameBytes.length);
    const centralView = new DataView(centralHeader);
    writeU32(centralView, 0, 0x02014b50);
    writeU16(centralView, 4, 20);
    writeU16(centralView, 6, 20);
    writeU16(centralView, 8, 0);
    writeU16(centralView, 10, 0);
    writeU16(centralView, 12, dosTime);
    writeU16(centralView, 14, dosDate);
    writeU32(centralView, 16, crc);
    writeU32(centralView, 20, data.length);
    writeU32(centralView, 24, data.length);
    writeU16(centralView, 28, nameBytes.length);
    writeU16(centralView, 30, 0);
    writeU16(centralView, 32, 0);
    writeU16(centralView, 34, 0);
    writeU16(centralView, 36, 0);
    writeU32(centralView, 38, 0);
    writeU32(centralView, 42, offset);
    new Uint8Array(centralHeader, 46).set(nameBytes);
    centralChunks.push(new Uint8Array(centralHeader));
    offset += localHeader.byteLength + data.length;
  }

  const centralSize = centralChunks.reduce((sum, chunk) => sum + chunk.byteLength, 0);
  const endRecord = new ArrayBuffer(22);
  const endView = new DataView(endRecord);
  writeU32(endView, 0, 0x06054b50);
  writeU16(endView, 4, 0);
  writeU16(endView, 6, 0);
  writeU16(endView, 8, entries.length);
  writeU16(endView, 10, entries.length);
  writeU32(endView, 12, centralSize);
  writeU32(endView, 16, offset);
  writeU16(endView, 20, 0);
  return new Blob([...localChunks, ...centralChunks, new Uint8Array(endRecord)], { type: "application/zip" });
}

async function downloadAllZip() {
  if (!state.imageFiles.length || state.working) return;
  state.working = true;
  try {
    setStatus("批量处理中");
    const entries = [];
    const total = state.imageFiles.length;
    for (let i = 0; i < total; i += 1) {
      const file = state.imageFiles[i];
      setProgress(i, total, `正在处理 ${i + 1}/${total}: ${file.name}`);
      const blob = await exportBlob(file);
      entries.push({ name: formatOutputName(file, i), blob });
    }
    setProgress(total, total, "正在打包 ZIP");
    const zipBlob = await createZip(entries);
    downloadBlob(zipBlob, `watermark_batch_${makeTimestamp()}.zip`);
    setStatus("ZIP 已下载");
    setProgress(total, total, "全部完成");
  } catch (error) {
    console.error(error);
    setStatus("批量导出失败");
    setProgress(0, state.imageFiles.length || 1, "批量导出失败");
    alert("批量导出失败，请减少图片数量后重试。");
  } finally {
    state.working = false;
  }
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
    state.logoName = "";
    el.logoName.textContent = "未选择";
    queuePreview();
    return;
  }

  if (state.logoBitmap && typeof state.logoBitmap.close === "function") state.logoBitmap.close();
  state.logoBitmap = await fileToBitmap(file);
  state.logoName = file.name;
  el.logoName.textContent = file.name;
  queuePreview();
}

[
  el.watermarkText,
  el.opacityRange,
  el.fontScaleRange,
  el.offsetX,
  el.offsetY,
  el.logoOpacityRange,
  el.logoScaleRange,
  el.namingMode,
  el.namePrefix,
].forEach((node) => {
  node.addEventListener("input", () => {
    updateValueLabels();
    queuePreview();
  });
});

el.presetButtons.forEach((button) => {
  button.addEventListener("click", () => {
    applyPreset(button.dataset.preset);
    queuePreview();
  });
});

el.imagesInput.addEventListener("change", (event) => {
  void handleImagesSelected(event);
});

el.logoInput.addEventListener("change", (event) => {
  void handleLogoSelected(event);
});

el.previewBtn.addEventListener("click", () => {
  void renderSelectedPreview();
});

el.togglePreviewBtn.addEventListener("click", togglePreviewStage);

el.downloadCurrentBtn.addEventListener("click", () => {
  void downloadCurrent();
});

el.downloadAllBtn.addEventListener("click", () => {
  void downloadAllZip();
});

el.resetBtn.addEventListener("click", resetControls);

resetControls();
updateValueLabels();
setProgress(0, 1, "未开始");
