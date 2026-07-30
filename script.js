/* ===== Open Model Hub — Directory Modelli AI ===== */

let models = [];
let currentType = 'all';
let currentSort = 'rating';
let currentSearch = '';

// Type definitions with icons and labels
const TYPE_CONFIG = {
  llm: { icon: '🤖', label: 'LLM' },
  image: { icon: '🎨', label: 'Immagini' },
  audio: { icon: '🎵', label: 'Audio' },
  video: { icon: '🎬', label: 'Video' },
  multimodal: { icon: '👁️', label: 'Multimodale' },
  embedding: { icon: '🧬', label: 'Embedding' },
  other: { icon: '📦', label: 'Altro' }
};

/* ===== Load Models ===== */
async function loadModels() {
  try {
    const res = await fetch('models.json');
    models = await res.json();
    initApp();
  } catch (err) {
    document.getElementById('modelGrid').innerHTML = 
      '<div class="loading">❌ Errore nel caricamento dei modelli</div>';
  }
}

/* ===== Initialize ===== */
function initApp() {
  buildTypeFilters();
  updateStats();
  initCardDelegation();
  renderModels();
  bindEvents();
}

/* ===== Build Type Filter Chips ===== */
function buildTypeFilters() {
  const types = ['all', ...new Set(models.map(m => m.type))];
  const container = document.getElementById('typeFilters');
  
  container.innerHTML = types.map(type => {
    const config = TYPE_CONFIG[type];
    const icon = config ? config.icon : '';
    const label = type === 'all' ? 'Tutti' : (config ? config.label : type);
    const count = type === 'all' ? models.length : models.filter(m => m.type === type).length;
    return `<button class="chip${type === 'all' ? ' active' : ''}" data-type="${type}">
      ${icon} ${label} <span class="count">${count}</span>
    </button>`;
  }).join('');
}

/* ===== Update Stats ===== */
function updateStats() {
  const filtered = getFilteredModels();
  const types = new Set(filtered.map(m => m.type));
  const top = filtered.reduce((best, m) => m.rating > (best?.rating || 0) ? m : best, null);
  
  document.getElementById('statTotal').textContent = filtered.length;
  document.getElementById('statTypes').textContent = types.size;
  document.getElementById('statTop').textContent = top ? top.name.split(' ')[0] : '—';
  document.getElementById('footerCount').textContent = filtered.length;
}

/* ===== Get Filtered Models ===== */
function getFilteredModels() {
  let filtered = [...models];

  // Type filter
  if (currentType !== 'all') {
    filtered = filtered.filter(m => m.type === currentType);
  }

  // Search
  if (currentSearch.trim()) {
    const q = currentSearch.toLowerCase();
    filtered = filtered.filter(m =>
      m.name.toLowerCase().includes(q) ||
      m.author.toLowerCase().includes(q) ||
      m.description.toLowerCase().includes(q) ||
      m.tags.some(t => t.toLowerCase().includes(q))
    );
  }

  // Sort
  filtered.sort((a, b) => {
    switch (currentSort) {
      case 'downloads': return b.downloads - a.downloads;
      case 'newest': return new Date(b.addedDate) - new Date(a.addedDate);
      case 'name': return a.name.localeCompare(b.name);
      case 'rating':
      default: return b.rating - a.rating;
    }
  });

  return filtered;
}

/* ===== Format Downloads ===== */
function formatDownloads(n) {
  if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
  if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
  return n.toString();
}

/* ===== Render Model Card ===== */
function renderModelCard(model, index) {
  const typeConfig = TYPE_CONFIG[model.type] || { icon: '📦' };
  
  return `
    <div class="model-card" style="animation-delay:${index * 0.04}s">
      <div class="card-header">
        <span class="card-type-icon" title="${typeConfig.label || model.type}">${typeConfig.icon}</span>
        <div class="card-rating">
          <span class="star">⭐</span> ${model.rating}
        </div>
      </div>
      <h3 class="card-name">${model.name}</h3>
      <p class="card-author">di ${model.author}</p>
      <p class="card-description">${model.description}</p>
      <div class="card-meta">
        <span class="meta-badge">📐 ${model.parameters}</span>
        <span class="meta-badge license">📜 ${model.license}</span>
        <span class="meta-badge">📥 ${formatDownloads(model.downloads)}</span>
      </div>
      <div class="card-tags">
        ${model.tags.map(t => `<span class="tag" data-tag="${t}">#${t}</span>`).join('')}
      </div>
      <div class="card-footer">
      <a href="${model.link.startsWith('http') ? model.link : '#'}" class="btn btn-primary" target="_blank" rel="noopener noreferrer">
        🔗 Vai al modello
      </a>
      <button class="btn btn-secondary copy-link-btn" data-link="${model.link}" title="Copia link" aria-label="Copia link modello">
        📋
      </button>
      </div>
    </div>
  `;
}

/* ===== Render All Models ===== */
function renderModels() {
  const filtered = getFilteredModels();
  const grid = document.getElementById('modelGrid');
  const noResults = document.getElementById('noResults');
  const resultsInfo = document.getElementById('resultsInfo');

  if (filtered.length === 0) {
    grid.innerHTML = '';
    noResults.style.display = 'block';
    resultsInfo.textContent = '';
  } else {
    noResults.style.display = 'none';
    grid.innerHTML = filtered.map((m, i) => renderModelCard(m, i)).join('');
    resultsInfo.textContent = `Mostrando ${filtered.length} di ${models.length} modelli`;
  }

  updateStats();
  bindCardEvents();
}

/* ===== Bind Events ===== */
function bindEvents() {
  // Search
  const searchInput = document.getElementById('searchInput');
  const searchClear = document.getElementById('searchClear');
  
  searchInput.addEventListener('input', (e) => {
    currentSearch = e.target.value;
    searchClear.classList.toggle('visible', !!currentSearch);
    renderModels();
  });
  
  searchClear.addEventListener('click', () => {
    searchInput.value = '';
    currentSearch = '';
    searchClear.classList.remove('visible');
    renderModels();
    searchInput.focus();
  });

  // Type filters
  document.getElementById('typeFilters').addEventListener('click', (e) => {
    const chip = e.target.closest('.chip');
    if (!chip) return;
    
    document.querySelectorAll('#typeFilters .chip').forEach(c => c.classList.remove('active'));
    chip.classList.add('active');
    currentType = chip.dataset.type;
    renderModels();
  });

  // Sort
  document.getElementById('sortSelect').addEventListener('change', (e) => {
    currentSort = e.target.value;
    renderModels();
  });

  // Reset filters
  document.getElementById('resetFilters').addEventListener('click', () => {
    currentSearch = '';
    currentType = 'all';
    currentSort = 'rating';
    document.getElementById('searchInput').value = '';
    document.getElementById('searchClear').classList.remove('visible');
    document.getElementById('sortSelect').value = 'rating';
    document.querySelectorAll('#typeFilters .chip').forEach(c => {
      c.classList.toggle('active', c.dataset.type === 'all');
    });
    renderModels();
  });

  // Keyboard shortcut: press '/' to focus search
  document.addEventListener('keydown', (e) => {
    if (e.key === '/' && document.activeElement !== searchInput) {
      e.preventDefault();
      searchInput.focus();
    }
    if (e.key === 'Escape') {
      searchInput.blur();
    }
  });
}

/* ===== Bind Card Events (event delegation) ===== */
function bindCardEvents() {
  // Already bound via delegation in init - no-op for re-renders
}

// Single delegated listener for card interactions
function initCardDelegation() {
  const grid = document.getElementById('modelGrid');
  
  grid.addEventListener('click', (e) => {
    // Tag clicks → search for that tag
    const tag = e.target.closest('.tag');
    if (tag) {
      currentSearch = tag.dataset.tag;
      const input = document.getElementById('searchInput');
      input.value = currentSearch;
      document.getElementById('searchClear').classList.add('visible');
      renderModels();
      input.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }
    
    // Copy link buttons
    const copyBtn = e.target.closest('.copy-link-btn');
    if (copyBtn) {
      navigator.clipboard.writeText(copyBtn.dataset.link).then(() => {
        showToast('Link copiato! ✅', 'success');
      }).catch(() => {
        showToast('Link: ' + copyBtn.dataset.link, '');
      });
      return;
    }
  });
}

/* ===== Toast ===== */
let toastTimer;
function showToast(msg, type = '') {
  const toast = document.getElementById('toast');
  clearTimeout(toastTimer);
  toast.textContent = msg;
  toast.className = `toast ${type}`;
  requestAnimationFrame(() => toast.classList.add('show'));
  toastTimer = setTimeout(() => toast.classList.remove('show'), 2500);
}

/* ===== Start ===== */
loadModels();
