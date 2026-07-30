/* ===== Tab Switching ===== */
const tabs = document.querySelectorAll('.tab');
const panels = document.querySelectorAll('.panel');

tabs.forEach(tab => {
  tab.addEventListener('click', () => {
    tabs.forEach(t => t.classList.remove('active'));
    panels.forEach(p => p.classList.remove('active'));
    tab.classList.add('active');
    document.getElementById(`panel-${tab.dataset.tab}`).classList.add('active');
  });
});

/* ===== DOM Refs ===== */
const dropzone = document.getElementById('dropzone');
const fileInput = document.getElementById('fileInput');
const btnGenerate = document.getElementById('btnGenerate');
const resultSection = document.getElementById('resultSection');
const resultImage = document.getElementById('resultImage');
const base64Output = document.getElementById('base64Output');
const resultSize = document.getElementById('resultSize');
const resultDimensions = document.getElementById('resultDimensions');
const resultType = document.getElementById('resultType');
const toast = document.getElementById('toast');

let currentBase64 = '';
let currentFormat = 'raw';
let currentMimeType = 'image/png';

/* ===== Toast ===== */
let toastTimer;
function showToast(msg, type = '') {
  clearTimeout(toastTimer);
  toast.textContent = msg;
  toast.className = `toast ${type}`;
  requestAnimationFrame(() => toast.classList.add('show'));
  toastTimer = setTimeout(() => toast.classList.remove('show'), 2500);
}

/* ===== Dropzone ===== */
dropzone.addEventListener('click', () => fileInput.click());

dropzone.addEventListener('dragover', (e) => {
  e.preventDefault();
  dropzone.classList.add('drag-over');
});

dropzone.addEventListener('dragleave', () => {
  dropzone.classList.remove('drag-over');
});

dropzone.addEventListener('drop', (e) => {
  e.preventDefault();
  dropzone.classList.remove('drag-over');
  const file = e.dataTransfer.files[0];
  if (file) processFile(file);
});

fileInput.addEventListener('change', () => {
  const file = fileInput.files[0];
  if (file) processFile(file);
});

/* ===== File Processing ===== */
function processFile(file) {
  if (!file.type.startsWith('image/')) {
    showToast('Per favore carica un file immagine!', 'error');
    return;
  }
  if (file.size > 10 * 1024 * 1024) {
    showToast('Il file è troppo grande! Max 10MB', 'error');
    return;
  }

  currentMimeType = file.type;
  const reader = new FileReader();
  reader.onload = () => {
    currentBase64 = reader.result;
    showResult(currentBase64, file.type, file.size);
  };
  reader.onerror = () => showToast('Errore nella lettura del file', 'error');
  reader.readAsDataURL(file);
}

/* ===== Generate Image ===== */
btnGenerate.addEventListener('click', () => {
  const width = parseInt(document.getElementById('genWidth').value) || 400;
  const height = parseInt(document.getElementById('genHeight').value) || 300;
  const bgColor = document.getElementById('genBgColor').value || '#6366f1';
  const textColor = document.getElementById('genTextColor').value || '#ffffff';
  const text = document.getElementById('genText').value || 'Hello World';
  const fontSize = parseInt(document.getElementById('genFontSize').value) || 48;

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');

  // Background
  ctx.fillStyle = bgColor;
  ctx.fillRect(0, 0, width, height);

  // Subtle grid pattern for visual interest
  ctx.strokeStyle = 'rgba(255,255,255,0.04)';
  ctx.lineWidth = 1;
  const gridSize = 30;
  for (let x = 0; x < width; x += gridSize) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, height); ctx.stroke();
  }
  for (let y = 0; y < height; y += gridSize) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(width, y); ctx.stroke();
  }

  // Text
  ctx.fillStyle = textColor;
  ctx.font = `bold ${fontSize}px "Segoe UI", system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // Word wrap for long text
  const maxWidth = width * 0.85;
  const words = text.split(' ');
  const lines = [];
  let currentLine = '';

  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    if (ctx.measureText(testLine).width > maxWidth && currentLine) {
      lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = testLine;
    }
  }
  if (currentLine) lines.push(currentLine);

  // Check for any overly long lines and reduce font if needed
  let effectiveFontSize = fontSize;
  for (const line of lines) {
    const lineWidth = ctx.measureText(line).width;
    if (lineWidth > maxWidth) {
      effectiveFontSize = Math.min(effectiveFontSize, Math.floor(maxWidth / lineWidth * fontSize * 0.9));
    }
  }
  if (effectiveFontSize !== fontSize) {
    ctx.font = `bold ${effectiveFontSize}px "Segoe UI", system-ui, sans-serif`;
  }

  const lineHeight = fontSize * 1.3;
  const totalHeight = lines.length * lineHeight;
  const startY = (height - totalHeight) / 2 + lineHeight / 2;

  lines.forEach((line, i) => {
    ctx.fillText(line, width / 2, startY + i * lineHeight);
  });

  currentMimeType = 'image/png';
  currentBase64 = canvas.toDataURL('image/png');
  // More accurate size: strip data URI prefix before estimating
  const base64Body = currentBase64.split(',')[1] || currentBase64;
  const sizeBytes = Math.round((base64Body.length * 3) / 4);
  showResult(currentBase64, 'image/png', sizeBytes);

  showToast('Immagine generata con successo!', 'success');
});

/* ===== Show Result ===== */
function showResult(dataUri, mimeType, sizeBytes) {
  resultImage.src = dataUri;
  resultSection.style.display = 'block';

  // Info
  const sizeKB = (sizeBytes / 1024).toFixed(1);
  const sizeMB = sizeBytes > 1024 * 1024 ? ` (${(sizeBytes / 1024 / 1024).toFixed(2)} MB)` : '';
  resultSize.textContent = `📦 ${sizeKB} KB${sizeMB}`;

  resultType.textContent = `🏷️ ${mimeType}`;

  resultImage.onload = () => {
    resultDimensions.textContent = `📐 ${resultImage.naturalWidth} × ${resultImage.naturalHeight} px`;
  };
  if (resultImage.complete) {
    resultDimensions.textContent = `📐 ${resultImage.naturalWidth} × ${resultImage.naturalHeight} px`;
  }

  // Format output
  updateOutputFormat();
  resultSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

/* ===== Output Format ===== */
function updateOutputFormat() {
  switch (currentFormat) {
    case 'raw':
      base64Output.value = currentBase64.split(',')[1] || currentBase64;
      break;
    case 'datauri':
      base64Output.value = currentBase64;
      break;
    case 'css':
      base64Output.value = `url(${currentBase64})`;
      break;
    case 'html':
      base64Output.value = `<img src="${currentBase64}" alt="Base64 Image">`;
      break;
    default:
      base64Output.value = currentBase64;
  }
}

document.querySelectorAll('.base64-format-btns .btn-xs').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.base64-format-btns .btn-xs').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentFormat = btn.dataset.format;
    updateOutputFormat();
  });
});

/* ===== Copy ===== */
document.getElementById('btnCopy').addEventListener('click', copyBase64);
document.getElementById('btnCopyInline').addEventListener('click', copyBase64);

async function copyBase64() {
  try {
    await navigator.clipboard.writeText(base64Output.value);
    showToast('Copiato negli appunti! ✅', 'success');
  } catch {
    base64Output.select();
    document.execCommand('copy');
    showToast('Copiato! ✅', 'success');
  }
}

/* ===== Download ===== */
document.getElementById('btnDownload').addEventListener('click', () => {
  const link = document.createElement('a');
  const ext = currentMimeType.split('/')[1] || 'png';
  link.download = `base64-image.${ext}`;
  link.href = currentBase64;
  link.click();
  showToast('Download avviato! 🎉', 'success');
});

/* ===== Clear ===== */
document.getElementById('btnClear').addEventListener('click', () => {
  currentBase64 = '';
  base64Output.value = '';
  resultImage.src = '';
  resultSection.style.display = 'none';
  showToast('Cancellato!', '');
});

/* ===== Color Sync ===== */
document.getElementById('genBgColor').addEventListener('input', (e) => {
  document.getElementById('genBgColorText').value = e.target.value;
});
document.getElementById('genBgColorText').addEventListener('input', (e) => {
  const val = e.target.value;
  if (/^#[0-9a-fA-F]{6}$/.test(val)) {
    document.getElementById('genBgColor').value = val;
  }
});

document.getElementById('genTextColor').addEventListener('input', (e) => {
  document.getElementById('genTextColorText').value = e.target.value;
});
document.getElementById('genTextColorText').addEventListener('input', (e) => {
  const val = e.target.value;
  if (/^#[0-9a-fA-F]{6}$/.test(val)) {
    document.getElementById('genTextColor').value = val;
  }
});

/* ===== Font Size ===== */
document.getElementById('genFontSize').addEventListener('input', (e) => {
  document.getElementById('genFontSizeVal').textContent = `${e.target.value}px`;
});
