/* ===== Base64 Image Generator ===== */

// ── State ──────────────────────────────────────────
let generatedBase64 = '';
let convertedBase64 = '';
let convertedFormat = 'image/png';

// ── Tab Switching ──────────────────────────────────
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById(`tab-${btn.dataset.tab}`).classList.add('active');
  });
});

// ═══════════════════════════════════════════════════
//  TAB 1: GENERATORE
// ═══════════════════════════════════════════════════

// Show/hide gradient picker
document.getElementById('genBgType').addEventListener('change', (e) => {
  document.getElementById('gradientGroup').style.display = e.target.value === 'gradient' ? 'block' : 'none';
});

// Sync color picker <-> hex input
document.getElementById('genBgColor').addEventListener('input', (e) => {
  document.getElementById('genBgColorHex').value = e.target.value;
});
document.getElementById('genBgColorHex').addEventListener('input', (e) => {
  const v = e.target.value;
  if (/^#[0-9a-fA-F]{6}$/.test(v)) document.getElementById('genBgColor').value = v;
});

// Update preview dimensions display
function updatePreviewDisplay() {
  const w = document.getElementById('genWidth').value;
  const h = document.getElementById('genHeight').value;
  document.getElementById('previewDimensions').textContent = `${w} × ${h}`;
}
['genWidth', 'genHeight'].forEach(id => {
  document.getElementById(id).addEventListener('input', updatePreviewDisplay);
});

// Generate image
document.getElementById('btnGenerate').addEventListener('click', generateImage);

function generateImage() {
  const w = parseInt(document.getElementById('genWidth').value) || 400;
  const h = parseInt(document.getElementById('genHeight').value) || 300;
  const canvas = document.getElementById('previewCanvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');

  const bgType = document.getElementById('genBgType').value;
  const bgColor = document.getElementById('genBgColor').value;

  // Draw background
  if (bgType === 'solid') {
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, w, h);
  } else if (bgType === 'gradient') {
    const gradColor = document.getElementById('genGradColor').value;
    const grad = ctx.createLinearGradient(0, 0, w, h);
    grad.addColorStop(0, bgColor);
    grad.addColorStop(1, gradColor);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
  } else if (bgType === 'pattern') {
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = 'rgba(255,255,255,0.04)';
    const size = 40;
    for (let x = 0; x < w; x += size) {
      for (let y = 0; y < h; y += size) {
        if ((Math.floor(x / size) + Math.floor(y / size)) % 2 === 0) {
          ctx.fillRect(x, y, size, size);
        }
      }
    }
    // Overlay circles
    ctx.fillStyle = 'rgba(255,255,255,0.03)';
    for (let i = 0; i < 12; i++) {
      ctx.beginPath();
      ctx.arc(Math.random() * w, Math.random() * h, 20 + Math.random() * 80, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (bgType === 'noise') {
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, w, h);
    const imageData = ctx.getImageData(0, 0, w, h);
    const data = imageData.data;
    for (let i = 0; i < data.length; i += 4) {
      const noise = (Math.random() - 0.5) * 30;
      data[i] = Math.min(255, Math.max(0, data[i] + noise));
      data[i + 1] = Math.min(255, Math.max(0, data[i + 1] + noise));
      data[i + 2] = Math.min(255, Math.max(0, data[i + 2] + noise));
    }
    ctx.putImageData(imageData, 0, 0);
  }

  // Draw text
  const text = document.getElementById('genText').value;
  if (text) {
    const fontSize = parseInt(document.getElementById('genFontSize').value) || 48;
    const fontFamily = document.getElementById('genFontFamily').value;
    const textColor = document.getElementById('genTextColor').value;
    ctx.font = `700 ${fontSize}px ${fontFamily}`;
    ctx.fillStyle = textColor;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Add text shadow for depth
    ctx.shadowColor = 'rgba(0,0,0,0.3)';
    ctx.shadowBlur = fontSize * 0.2;
    ctx.shadowOffsetX = 2;
    ctx.shadowOffsetY = 2;

    // Word wrap
    const words = text.split(' ');
    const lines = [];
    let line = '';
    const maxWidth = w * 0.85;
    for (const word of words) {
      const test = line ? `${line} ${word}` : word;
      if (ctx.measureText(test).width > maxWidth && line) {
        lines.push(line);
        line = word;
      } else {
        line = test;
      }
    }
    if (line) lines.push(line);

    ctx.shadowColor = 'rgba(0,0,0,0.25)';
    ctx.shadowBlur = 3;
    ctx.shadowOffsetX = 1;
    ctx.shadowOffsetY = 1;
    const lineHeight = fontSize * 1.2;
    const startY = h / 2 - ((lines.length - 1) * lineHeight) / 2;
    lines.forEach((ln, i) => {
      ctx.fillText(ln, w / 2, startY + i * lineHeight);
    });
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;
  }

  generatedBase64 = canvas.toDataURL('image/png').split(',')[1];
  const dataUri = `data:image/png;base64,${generatedBase64}`;
  updateOutput('outputBase64', 'outputStats', generatedBase64, dataUri, w, h, 'image/png');
  updatePreviewDisplay();
}

// Generate a default preview on load
window.addEventListener('DOMContentLoaded', () => {
  setTimeout(generateImage, 200);
});

// ═══════════════════════════════════════════════════
//  TAB 2: CONVERTITORE
// ═══════════════════════════════════════════════════

const dropzone = document.getElementById('dropzone');
const fileInput = document.getElementById('fileInput');

dropzone.addEventListener('click', () => fileInput.click());
document.getElementById('btnBrowse').addEventListener('click', (e) => {
  e.stopPropagation();
  fileInput.click();
});

fileInput.addEventListener('change', (e) => {
  if (e.target.files[0]) handleFile(e.target.files[0]);
});

dropzone.addEventListener('dragover', (e) => {
  e.preventDefault();
  dropzone.classList.add('dragover');
});
dropzone.addEventListener('dragleave', () => {
  dropzone.classList.remove('dragover');
});
dropzone.addEventListener('drop', (e) => {
  e.preventDefault();
  dropzone.classList.remove('dragover');
  if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]);
});

document.getElementById('convertFormat').addEventListener('change', (e) => {
  convertedFormat = e.target.value;
  document.getElementById('qualityGroup').style.display = 
    (e.target.value === 'image/jpeg' || e.target.value === 'image/webp') ? 'block' : 'none';
  if (convertedBase64) reconvertImage();
});
document.getElementById('convertQuality').addEventListener('input', (e) => {
  document.getElementById('qualityValue').textContent = e.target.value;
  if (convertedBase64) reconvertImage();
});

let originalImage = null;

function handleFile(file) {
  if (!file.type.startsWith('image/')) {
    showToast('Seleziona un file immagine valido!', 'error');
    return;
  }

  const reader = new FileReader();
  reader.onload = (e) => {
    const img = new Image();
    img.onload = () => {
      originalImage = img;
      document.getElementById('convertPlaceholder').style.display = 'none';
      const imgEl = document.getElementById('convertImage');
      imgEl.src = e.target.result;
      imgEl.style.display = 'block';
      document.getElementById('convertDimensions').textContent = `${img.width} × ${img.height}`;
      convertImage(img);
      showToast(`Immagine caricata: ${img.width}×${img.height}`, 'success');
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}

function convertImage(img) {
  const format = document.getElementById('convertFormat').value;
  const quality = parseInt(document.getElementById('convertQuality').value) / 100;
  const canvas = document.createElement('canvas');
  canvas.width = img.width;
  canvas.height = img.height;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0);

  const dataUri = canvas.toDataURL(format, quality);
  convertedBase64 = dataUri.split(',')[1];
  convertedFormat = format;
  updateOutput('outputBase642', 'outputStats2', convertedBase64, dataUri, img.width, img.height, format);
}

function reconvertImage() {
  if (originalImage) convertImage(originalImage);
}

// ═══════════════════════════════════════════════════
//  OUTPUT & COPY
// ═══════════════════════════════════════════════════

function updateOutput(textareaId, statsId, base64, dataUri, w, h, format) {
  document.getElementById(textareaId).value = base64;

  const sizeBytes = Math.ceil(base64.length * 0.75);
  const sizeStr = sizeBytes < 1024 
    ? `${sizeBytes} B` 
    : sizeBytes < 1048576 
      ? `${(sizeBytes / 1024).toFixed(1)} KB` 
      : `${(sizeBytes / 1048576).toFixed(2)} MB`;

  document.getElementById(statsId).innerHTML = `
    <span>📐 ${w}×${h}</span>
    <span>📦 ${sizeStr}</span>
    <span>📄 ${format}</span>
    <span>🔢 ${base64.length.toLocaleString()} chars</span>
  `;
}

function getBase64AndUri(isGenerator) {
  const base64 = isGenerator ? generatedBase64 : convertedBase64;
  const format = isGenerator ? 'image/png' : convertedFormat;
  const dataUri = `data:${format};base64,${base64}`;
  return { base64, dataUri, format };
}

async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    showToast('Copiato negli appunti! ✅', 'success');
  } catch {
    // Fallback for older browsers
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
    showToast('Copiato! ✅', 'success');
  }
}

// Generator copy buttons
document.getElementById('btnCopyRaw').addEventListener('click', () => {
  const { base64 } = getBase64AndUri(true);
  if (!base64) { showToast('Genera prima un\'immagine!', 'error'); return; }
  copyToClipboard(base64);
});
document.getElementById('btnCopyDataUri').addEventListener('click', () => {
  const { dataUri } = getBase64AndUri(true);
  if (!getBase64AndUri(true).base64) { showToast('Genera prima un\'immagine!', 'error'); return; }
  copyToClipboard(dataUri);
});
document.getElementById('btnCopyCss').addEventListener('click', () => {
  const { dataUri } = getBase64AndUri(true);
  if (!getBase64AndUri(true).base64) { showToast('Genera prima un\'immagine!', 'error'); return; }
  copyToClipboard(`background-image: url("${dataUri}");`);
});
document.getElementById('btnCopyHtml').addEventListener('click', () => {
  const { dataUri } = getBase64AndUri(true);
  if (!getBase64AndUri(true).base64) { showToast('Genera prima un\'immagine!', 'error'); return; }
  copyToClipboard(`<img src="${dataUri}" alt="Base64 Image" />`);
});
document.getElementById('btnDownload').addEventListener('click', () => {
  const { dataUri } = getBase64AndUri(true);
  if (!getBase64AndUri(true).base64) { showToast('Genera prima un\'immagine!', 'error'); return; }
  downloadFile(dataUri, 'generated-image.png');
});

// Converter copy buttons
document.getElementById('btnCopyRaw2').addEventListener('click', () => {
  const { base64 } = getBase64AndUri(false);
  if (!base64) { showToast('Carica prima un\'immagine!', 'error'); return; }
  copyToClipboard(base64);
});
document.getElementById('btnCopyDataUri2').addEventListener('click', () => {
  const { dataUri } = getBase64AndUri(false);
  if (!getBase64AndUri(false).base64) { showToast('Carica prima un\'immagine!', 'error'); return; }
  copyToClipboard(dataUri);
});
document.getElementById('btnCopyCss2').addEventListener('click', () => {
  const { dataUri } = getBase64AndUri(false);
  if (!getBase64AndUri(false).base64) { showToast('Carica prima un\'immagine!', 'error'); return; }
  copyToClipboard(`background-image: url("${dataUri}");`);
});
document.getElementById('btnCopyHtml2').addEventListener('click', () => {
  const { dataUri } = getBase64AndUri(false);
  if (!getBase64AndUri(false).base64) { showToast('Carica prima un\'immagine!', 'error'); return; }
  copyToClipboard(`<img src="${dataUri}" alt="Base64 Image" />`);
});
document.getElementById('btnDownload2').addEventListener('click', () => {
  const { dataUri, format } = getBase64AndUri(false);
  if (!getBase64AndUri(false).base64) { showToast('Carica prima un\'immagine!', 'error'); return; }
  const ext = format === 'image/png' ? 'png' : format === 'image/jpeg' ? 'jpg' : 'webp';
  downloadFile(dataUri, `converted-image.${ext}`);
});

function downloadFile(dataUri, filename) {
  const a = document.createElement('a');
  a.href = dataUri;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  showToast(`Scaricato: ${filename} 💾`, 'success');
}

// ═══════════════════════════════════════════════════
//  TOAST
// ═══════════════════════════════════════════════════

let toastTimer;
function showToast(msg, type = '') {
  const toast = document.getElementById('toast');
  clearTimeout(toastTimer);
  toast.textContent = msg;
  toast.className = `toast ${type}`;
  requestAnimationFrame(() => toast.classList.add('show'));
  toastTimer = setTimeout(() => toast.classList.remove('show'), 2800);
}
