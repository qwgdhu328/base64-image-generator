/* ===== DevHub - Social Project Sharing App ===== */

// Supabase config (chiavi pubbliche - safe per il frontend)
const SUPABASE_URL = 'https://pwnfrodwvlyefxjqjknf.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_m95hApmt7P0NLXjFiYq_kw_-k3X96Td';

// Init Supabase client
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// State
let currentUser = null;
let currentCategory = 'all';
let currentDetailProject = null;
let userLikes = new Set(); // IDs dei progetti a cui l'utente ha messo like

/* ===== Toast ===== */
let toastTimer;
function showToast(msg, type = '') {
  const toast = document.getElementById('toast');
  clearTimeout(toastTimer);
  toast.textContent = msg;
  toast.className = `toast ${type}`;
  requestAnimationFrame(() => toast.classList.add('show'));
  toastTimer = setTimeout(() => toast.classList.remove('show'), 3000);
}

/* ===== Auth ===== */
async function checkAuth() {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    currentUser = session?.user ?? null;
  } catch (err) {
    console.error('Supabase connection error:', err);
    showToast('Connessione al server fallita', 'error');
  }
  updateUI();
  if (currentUser) await loadUserLikes();
}

async function signUp(email, password, username) {
  const { data, error } = await supabase.auth.signUp({ email, password, options: { data: { username } } });
  if (error) { document.getElementById('signupError').textContent = error.message; return; }
  if (data.user) {
    await supabase.from('profiles').upsert({ id: data.user.id, username }, { onConflict: 'id' });
    showToast('Registrato! Controlla la email per confermare.', 'success');
    closeModal('modalAuth');
    checkAuth();
  }
}

async function signIn(email, password) {
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) { document.getElementById('loginError').textContent = error.message; return; }
  showToast('Benvenuto! 👋', 'success');
  closeModal('modalAuth');
  checkAuth();
}

async function signOut() {
  await supabase.auth.signOut();
  currentUser = null;
  userLikes.clear();
  updateUI();
  showToast('Arrivederci! 👋', '');
}

/* ===== Load User Likes ===== */
async function loadUserLikes() {
  if (!currentUser) { userLikes.clear(); return; }
  const { data } = await supabase.from('likes').select('project_id').eq('user_id', currentUser.id);
  userLikes = new Set((data || []).map(l => l.project_id));
}

/* ===== UI Update ===== */
function updateUI() {
  const navActions = document.getElementById('navActions');
  const hero = document.getElementById('hero');
  const actionsBar = document.getElementById('actionsBar');
  const filters = document.getElementById('filters');

  if (currentUser) {
    const username = currentUser.user_metadata?.username || currentUser.email?.split('@')[0] || 'Dev';
    navActions.innerHTML = `
      <div class="user-chip" id="userChip">
        <div class="user-avatar">${username[0].toUpperCase()}</div>
        <span>${escapeHtml(username)}</span>
      </div>
      <button class="btn btn-outline btn-sm" id="btnLogout">Esci</button>
    `;
    document.getElementById('btnLogout').addEventListener('click', signOut);
    if (hero) hero.style.display = 'none';
    if (actionsBar) actionsBar.style.display = 'flex';
    if (filters) filters.style.display = 'block';
  } else {
    navActions.innerHTML = `<button class="btn btn-outline" id="btnLogin">🔐 Accedi</button>`;
    document.getElementById('btnLogin').addEventListener('click', () => openModal('modalAuth'));
    if (hero) hero.style.display = 'block';
    if (actionsBar) actionsBar.style.display = 'none';
    if (filters) filters.style.display = 'none';
    document.getElementById('projectGrid').innerHTML = '';
  }
  loadProjects();
}

/* ===== Load Projects ===== */
async function loadProjects() {
  const grid = document.getElementById('projectGrid');
  grid.innerHTML = '<div class="loading">Caricamento progetti...</div>';

  try {
    let query = supabase.from('projects').select('*').order('created_at', { ascending: false });
    if (currentCategory !== 'all') query = query.eq('category', currentCategory);

    const { data, error } = await query;
    if (error) throw error;
    if (!data) { grid.innerHTML = '<div class="loading">Nessun progetto. Sii il primo! 🚀</div>'; return; }

    document.getElementById('statProjects').textContent = data.length;
    document.getElementById('footerCount').textContent = data.length;

    const emptyState = document.getElementById('emptyState');
    if (data.length === 0) {
      grid.innerHTML = '';
      emptyState.style.display = 'block';
    } else {
      emptyState.style.display = 'none';
      grid.innerHTML = data.map((p, i) => renderProjectCard(p, i)).join('');
    }

    updateStats();
    bindCardListeners();
  } catch (err) {
    console.error('Load projects error:', err);
    grid.innerHTML = '<div class="loading">❌ Errore di connessione. Ricarica la pagina.</div>';
  }
}

/* ===== Update Single Project Card ===== */
function updateProjectCard(project) {
  const card = document.querySelector(`.project-card[data-id="${project.id}"]`);
  if (!card) return;
  const grid = document.getElementById('projectGrid');
  const cards = [...grid.children];
  const index = cards.indexOf(card);
  card.outerHTML = renderProjectCard(project, index);
  bindCardListeners();
}

/* ===== Render Project Card ===== */
const CAT_ICONS = { web: '🌐', mobile: '📱', ai: '🤖', game: '🎮', tool: '🛠️', other: '📦' };

function renderProjectCard(project, index) {
  const icon = CAT_ICONS[project.category] || '📦';
  const tags = (project.tags || []).slice(0, 4).map(t => `<span class="tag">#${escapeHtml(t)}</span>`).join('');
  const liked = userLikes.has(project.id);
  const image = project.image_url 
    ? `<img src="${project.image_url}" class="card-image" alt="${escapeHtml(project.title)}" onerror="this.style.display='none'">`
    : `<div class="card-image">${icon}</div>`;

  return `
    <div class="project-card" style="animation-delay:${index * 0.03}s" data-id="${project.id}">
      ${image}
      <div class="card-body">
        <div class="card-title">
          <span>${escapeHtml(project.title)}</span>
        </div>
        <div class="card-author">👤 ${escapeHtml(project.user_email || 'Anonimo')} · ${timeAgo(project.created_at)}</div>
        <p class="card-desc">${escapeHtml(project.description)}</p>
        <div class="card-tags">${tags}</div>
        <div class="card-footer">
          <div class="card-actions">
            <button class="action-btn like-btn ${liked ? 'liked' : ''}" data-id="${project.id}">
              ${liked ? '❤️' : '🤍'} <span class="count">${project.likes_count || 0}</span>
            </button>
            <button class="action-btn comment-btn" data-id="${project.id}">
              💬 <span class="count">${project.comments_count || 0}</span>
            </button>
            ${project.project_url ? `<a href="${project.project_url}" target="_blank" rel="noopener" class="action-btn" title="Visita">🔗</a>` : ''}
          </div>
          ${currentUser && currentUser.id === project.user_id ? 
            `<div style="display:flex;gap:0.3rem">
              <button class="btn btn-sm edit-project-btn" data-id="${project.id}">✏️</button>
              <button class="btn btn-sm btn-danger delete-project-btn" data-id="${project.id}">🗑️</button>
            </div>` : ''}
        </div>
      </div>
    </div>
  `;
}

/* ===== Bind Card Listeners ===== */
function bindCardListeners() {
  // Delete buttons
  document.querySelectorAll('.delete-project-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      if (!confirm('Eliminare questo progetto?')) return;
      const { error } = await supabase.from('projects').delete().eq('id', btn.dataset.id);
      if (error) { showToast('Errore', 'error'); return; }
      showToast('Progetto eliminato', 'success');
      loadProjects();
    });
  });

  // Edit buttons
  document.querySelectorAll('.edit-project-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const id = parseInt(btn.dataset.id);
      const { data } = await supabase.from('projects').select('*').eq('id', id).single();
      if (!data) return;
      document.getElementById('editProjectId').value = data.id;
      document.getElementById('projectTitle').value = data.title;
      document.getElementById('projectDesc').value = data.description;
      document.getElementById('projectUrl').value = data.project_url || '';
      document.getElementById('projectImage').value = data.image_url || '';
      document.getElementById('projectCategory').value = data.category;
      document.getElementById('projectTags').value = (data.tags || []).join(', ');
      document.getElementById('modalProjectTitle').textContent = '✏️ Modifica Progetto';
      document.getElementById('btnSubmitProject').textContent = '💾 Salva Modifiche';
      openModal('modalProject');
    });
  });

  // Like buttons
  document.querySelectorAll('.like-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      if (!currentUser) { openModal('modalAuth'); return; }
      const id = parseInt(btn.dataset.id);
      const liked = userLikes.has(id);
      
      if (liked) {
        await supabase.from('likes').delete().eq('project_id', id).eq('user_id', currentUser.id);
        userLikes.delete(id);
      } else {
        await supabase.from('likes').insert({ project_id: id, user_id: currentUser.id });
        userLikes.add(id);
      }
      
      // Aggiorna solo questa card invece di ricaricare tutto
      const { data } = await supabase.from('projects').select('*').eq('id', id).single();
      if (data) updateProjectCard(data);
    });
  });

  // Comment buttons → open detail
  document.querySelectorAll('.comment-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      openProjectDetail(parseInt(btn.dataset.id));
    });
  });

  // Card click → open detail
  document.querySelectorAll('.project-card').forEach(card => {
    card.addEventListener('click', (e) => {
      if (e.target.closest('button') || e.target.closest('a')) return;
      openProjectDetail(parseInt(card.dataset.id));
    });
  });
}

/* ===== Project Detail ===== */
async function openProjectDetail(projectId) {
  const { data } = await supabase.from('projects').select('*').eq('id', projectId).single();
  if (!data) return;
  currentDetailProject = data;

  const { data: comments } = await supabase.from('comments').select('*').eq('project_id', projectId).order('created_at', { ascending: true });
  
  const modal = document.getElementById('modalDetail');
  const content = document.getElementById('detailContent');
  const icon = CAT_ICONS[data.category] || '📦';
  const isOwner = currentUser && currentUser.id === data.user_id;
  
  content.innerHTML = `
    <button class="modal-close" onclick="closeModal('modalDetail')">✕</button>
    <div class="detail-header">
      <h2>${icon} ${escapeHtml(data.title)}</h2>
      <div class="detail-meta">
        <span>👤 ${escapeHtml(data.user_email || 'Anonimo')}</span>
        <span>${timeAgo(data.created_at)}</span>
        <span>❤️ ${data.likes_count || 0} likes</span>
        <span>💬 ${data.comments_count || 0} commenti</span>
      </div>
    </div>
    ${data.image_url ? `<img src="${data.image_url}" class="detail-image" alt="${escapeHtml(data.title)}">` : ''}
    <p class="detail-desc">${escapeHtml(data.description)}</p>
    ${data.project_url ? `<a href="${data.project_url}" target="_blank" rel="noopener" class="detail-link">🔗 ${escapeHtml(data.project_url)}</a>` : ''}
    <div class="card-tags" style="margin-bottom:1rem">${(data.tags || []).map(t => `<span class="tag">#${escapeHtml(t)}</span>`).join('')}</div>
    ${isOwner ? `<button class="btn btn-outline edit-detail-btn" data-id="${data.id}" style="margin-bottom:1rem">✏️ Modifica progetto</button>` : ''}
    
    <div class="comments-section">
      <h4>💬 Commenti (${comments?.length || 0})</h4>
      ${(comments || []).map(c => `
        <div class="comment">
          <div class="comment-header"><strong>${escapeHtml(c.user_email || 'Anonimo')}</strong> <span>${timeAgo(c.created_at)}</span></div>
          <div class="comment-body">${escapeHtml(c.content)}</div>
        </div>
      `).join('')}
      ${currentUser ? `
        <div class="comment-form">
          <input type="text" id="commentInput" placeholder="Scrivi un commento..." maxlength="500">
          <button class="btn btn-primary btn-sm" id="btnAddComment">Invia</button>
        </div>
      ` : '<p style="color:var(--text-muted);margin-top:0.75rem">🔐 <a href="#" onclick="openModal(\'modalAuth\');return false" style="color:var(--primary-light)">Accedi</a> per commentare</p>'}
    </div>
  `;

  modal.classList.add('open');

  // Edit from detail
  document.querySelector('.edit-detail-btn')?.addEventListener('click', async () => {
    closeModal('modalDetail');
    document.getElementById('editProjectId').value = data.id;
    document.getElementById('projectTitle').value = data.title;
    document.getElementById('projectDesc').value = data.description;
    document.getElementById('projectUrl').value = data.project_url || '';
    document.getElementById('projectImage').value = data.image_url || '';
    document.getElementById('projectCategory').value = data.category;
    document.getElementById('projectTags').value = (data.tags || []).join(', ');
    document.getElementById('modalProjectTitle').textContent = '✏️ Modifica Progetto';
    document.getElementById('btnSubmitProject').textContent = '💾 Salva Modifiche';
    openModal('modalProject');
  });

  // Comment submit
  document.getElementById('btnAddComment')?.addEventListener('click', async () => {
    const input = document.getElementById('commentInput');
    if (!input.value.trim()) return;
    const { error } = await supabase.from('comments').insert({
      project_id: projectId, user_id: currentUser.id,
      content: input.value.trim(), user_email: currentUser.email
    });
    if (error) { showToast('Errore', 'error'); return; }
    input.value = '';
    showToast('Commento aggiunto!', 'success');
    openProjectDetail(projectId);
  });
}

/* ===== Create/Edit Project ===== */
async function submitProject(e) {
  e.preventDefault();
  if (!currentUser) { showToast('🔐 Devi accedere prima!', 'error'); openModal('modalAuth'); return; }
  
  const id = document.getElementById('editProjectId').value;
  const title = document.getElementById('projectTitle').value.trim();
  const description = document.getElementById('projectDesc').value.trim();
  const project_url = document.getElementById('projectUrl').value.trim();
  const image_url = document.getElementById('projectImage').value.trim();
  const category = document.getElementById('projectCategory').value;
  const tagsInput = document.getElementById('projectTags').value.trim();
  const tags = tagsInput ? tagsInput.split(',').map(t => t.trim()).filter(Boolean) : [];

  const payload = { title, description, project_url: project_url || null, image_url: image_url || null, category, tags, user_id: currentUser.id, user_email: currentUser.email };

  let error;
  if (id) {
    ({ error } = await supabase.from('projects').update(payload).eq('id', id));
  } else {
    ({ error } = await supabase.from('projects').insert(payload));
  }

  if (error) { showToast('Errore: ' + error.message, 'error'); return; }
  showToast(id ? 'Progetto aggiornato! ✨' : 'Progetto pubblicato! 🎉', 'success');
  closeModal('modalProject');
  document.getElementById('formProject').reset();
  document.getElementById('editProjectId').value = '';
  document.getElementById('modalProjectTitle').textContent = '➕ Nuovo Progetto';
  document.getElementById('btnSubmitProject').textContent = '🚀 Pubblica Progetto';
  loadProjects();
}

/* ===== Stats ===== */
async function updateStats() {
  try {
    const { count: userCount } = await supabase.from('profiles').select('*', { count: 'exact', head: true });
    const { data: projects } = await supabase.from('projects').select('likes_count');
    const totalLikes = projects?.reduce((sum, p) => sum + (p.likes_count || 0), 0) || 0;
    document.getElementById('statUsers').textContent = userCount || 0;
    document.getElementById('statLikes').textContent = totalLikes;
  } catch { /* stats are non-critical */ }
}

/* ===== Modals ===== */
function openModal(id) {
  if (id === 'modalAuth' && currentUser) return;
  document.getElementById(id).classList.add('open');
}
function closeModal(id) {
  document.getElementById(id).classList.remove('open');
}

/* ===== Helpers ===== */
function escapeHtml(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function timeAgo(dateStr) {
  const now = new Date();
  const date = new Date(dateStr);
  const seconds = Math.floor((now - date) / 1000);
  if (seconds < 60) return 'Adesso';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m fa`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h fa`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}g fa`;
  return date.toLocaleDateString('it-IT');
}

/* ===== Init ===== */
document.addEventListener('DOMContentLoaded', () => {
  checkAuth();

  // Auth modal tabs
  document.querySelectorAll('.modal-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.modal-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      document.querySelectorAll('.auth-form').forEach(f => f.classList.remove('active'));
      document.getElementById(tab.dataset.tab === 'login' ? 'formLogin' : 'formSignup').classList.add('active');
    });
  });

  // Auth forms
  document.getElementById('formLogin').addEventListener('submit', e => {
    e.preventDefault();
    signIn(document.getElementById('loginEmail').value, document.getElementById('loginPassword').value);
  });
  document.getElementById('formSignup').addEventListener('submit', e => {
    e.preventDefault();
    signUp(document.getElementById('signupEmail').value, document.getElementById('signupPassword').value, document.getElementById('signupUsername').value);
  });

  // Project form
  document.getElementById('formProject').addEventListener('submit', submitProject);

  // New project button
  document.getElementById('btnNewProject').addEventListener('click', () => {
    if (!currentUser) { openModal('modalAuth'); return; }
    document.getElementById('editProjectId').value = '';
    document.getElementById('formProject').reset();
    document.getElementById('modalProjectTitle').textContent = '➕ Nuovo Progetto';
    document.getElementById('btnSubmitProject').textContent = '🚀 Pubblica Progetto';
    openModal('modalProject');
  });
  document.getElementById('btnEmptyCreate')?.addEventListener('click', () => {
    if (!currentUser) { openModal('modalAuth'); return; }
    document.getElementById('editProjectId').value = '';
    document.getElementById('formProject').reset();
    document.getElementById('modalProjectTitle').textContent = '➕ Nuovo Progetto';
    document.getElementById('btnSubmitProject').textContent = '🚀 Pubblica Progetto';
    openModal('modalProject');
  });
  document.getElementById('btnHeroStart')?.addEventListener('click', () => openModal('modalAuth'));

  // Modal closes
  document.getElementById('closeAuth').addEventListener('click', () => closeModal('modalAuth'));
  document.getElementById('closeProject').addEventListener('click', () => closeModal('modalProject'));
  document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.classList.remove('open'); });
  });
  // Chiudi modali con Escape
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      document.querySelectorAll('.modal-overlay.open').forEach(m => m.classList.remove('open'));
    }
  });

  // Category filters
  document.querySelectorAll('#categoryFilters .chip').forEach(chip => {
    chip.addEventListener('click', () => {
      document.querySelectorAll('#categoryFilters .chip').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      currentCategory = chip.dataset.cat;
      loadProjects();
    });
  });

  // Real-time: aggiorna likes_count e comments_count senza ricaricare tutto
  supabase.channel('projects-realtime')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'likes' }, async (payload) => {
      const projectId = payload.new?.project_id || payload.old?.project_id;
      if (projectId && currentDetailProject?.id === projectId) {
        openProjectDetail(projectId);
      }
      if (projectId) {
        const { data } = await supabase.from('projects').select('*').eq('id', projectId).single();
        if (data) updateProjectCard(data);
      }
      updateStats();
    })
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'comments' }, async (payload) => {
      const projectId = payload.new?.project_id;
      if (projectId && currentDetailProject?.id === projectId) {
        openProjectDetail(projectId);
      }
      if (projectId) {
        const { data } = await supabase.from('projects').select('*').eq('id', projectId).single();
        if (data) updateProjectCard(data);
      }
    })
    .subscribe();
});
