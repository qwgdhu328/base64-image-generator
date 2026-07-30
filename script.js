/* ===== DevHub - Social Tech Community ===== */

// Supabase config (chiavi pubbliche)
const SUPABASE_URL = 'https://pwnfrodwvlyefxjqjknf.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_m95hApmt7P0NLXjFiYq_kw_-k3X96Td';
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// State
let currentUser = null;
let currentFeed = 'projects';
let userLikes = new Set(); // "project_ID" or "video_ID"
let currentDetail = null;  // { type: 'project'|'video', id: number }

/* ===== Toast ===== */
let toastTimer;
function showToast(msg, type = '') {
  const t = document.getElementById('toast');
  clearTimeout(toastTimer);
  t.textContent = msg;
  t.className = 'toast ' + type;
  requestAnimationFrame(() => t.classList.add('show'));
  toastTimer = setTimeout(() => t.classList.remove('show'), 2800);
}

/* ===== Modal Helpers ===== */
function openModal(id) {
  if (id === 'modalAuth' && currentUser) return;
  document.getElementById(id).classList.add('open');
}
function closeModal(id) { document.getElementById(id).classList.remove('open'); }

/* ===== Escape HTML ===== */
function esc(str) {
  if (!str) return '';
  const d = document.createElement('div');
  d.textContent = str;
  return d.innerHTML;
}

/* ===== Time Ago ===== */
function timeAgo(d) {
  const s = Math.floor((new Date() - new Date(d)) / 1000);
  if (s < 60) return 'Adesso';
  if (s < 3600) return Math.floor(s/60) + 'm fa';
  if (s < 86400) return Math.floor(s/3600) + 'h fa';
  if (s < 604800) return Math.floor(s/86400) + 'g fa';
  return new Date(d).toLocaleDateString('it-IT');
}

/* ===== Extract Video ID / Platform ===== */
function parseVideoUrl(url) {
  if (!url) return null;
  // YouTube
  let m = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/);
  if (m) return { platform: 'youtube', id: m[1], embed: 'https://www.youtube.com/embed/' + m[1] };
  // Vimeo
  m = url.match(/(?:vimeo\.com\/)(\d+)/);
  if (m) return { platform: 'vimeo', id: m[1], embed: 'https://player.vimeo.com/video/' + m[1] };
  return null;
}

/* ===== Auth ===== */
async function checkAuth() {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    currentUser = session?.user ?? null;
  } catch (e) {
    console.error('Supabase connection error:', e);
    showToast('Connessione al server fallita', 'error');
  }
  if (currentUser) await loadUserLikes();
  updateUI();
}

async function signUp(email, password, username) {
  const { data, error } = await supabase.auth.signUp({ email, password, options: { data: { username } } });
  if (error) { document.getElementById('signupError').textContent = error.message; return; }
  if (data.user) {
    await supabase.from('profiles').upsert({ id: data.user.id, username }, { onConflict: 'id' });
    showToast('Registrato! Controlla la email.', 'success');
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
  currentUser = null; userLikes.clear(); currentDetail = null;
  updateUI();
  showToast('Arrivederci! 👋');
}

/* ===== User Likes ===== */
async function loadUserLikes() {
  if (!currentUser) { userLikes.clear(); return; }
  const { data } = await supabase.from('likes').select('project_id, video_id').eq('user_id', currentUser.id);
  userLikes = new Set();
  (data || []).forEach(l => {
    if (l.project_id) userLikes.add('project_' + l.project_id);
    if (l.video_id) userLikes.add('video_' + l.video_id);
  });
}

/* ===== UI Update ===== */
function updateUI() {
  const nav = document.getElementById('navActions');
  const hero = document.getElementById('hero');
  const feedH = document.getElementById('feedHeader');

  if (currentUser) {
    const uname = currentUser.user_metadata?.username || currentUser.email?.split('@')[0] || 'Dev';
    nav.innerHTML = `
      <div class="user-chip"><div class="user-avatar">${uname[0].toUpperCase()}</div><span>${esc(uname)}</span></div>
      <button class="btn btn-outline btn-sm" id="btnLogout">Esci</button>
    `;
    document.getElementById('btnLogout').addEventListener('click', signOut);
    if (hero) hero.style.display = 'none';
    if (feedH) feedH.style.display = 'flex';
  } else {
    nav.innerHTML = '<button class="btn btn-outline" id="btnLogin">🔐 Accedi</button>';
    document.getElementById('btnLogin').addEventListener('click', () => openModal('modalAuth'));
    if (hero) hero.style.display = 'block';
    if (feedH) feedH.style.display = 'none';
    document.getElementById('contentGrid').innerHTML = '';
    document.getElementById('emptyState').style.display = 'none';
  }
  loadFeed();
}

/* ===== Load Feed ===== */
async function loadFeed() {
  const grid = document.getElementById('contentGrid');
  const empty = document.getElementById('emptyState');
  grid.innerHTML = '<div class="loading">Caricamento...</div>';
  empty.style.display = 'none';

  try {
    const table = currentFeed === 'projects' ? 'projects' : 'videos';
    const { data, error } = await supabase.from(table).select('*').order('created_at', { ascending: false });
    if (error) throw error;

    document.getElementById('footerCount').textContent = data?.length || 0;

    if (!data || data.length === 0) {
      grid.innerHTML = '';
      empty.style.display = 'block';
      document.getElementById('btnEmptyCreate').onclick = () => {
        if (!currentUser) { openModal('modalAuth'); return; }
        openModal(currentFeed === 'projects' ? 'modalProject' : 'modalVideo');
      };
      return;
    }

    grid.innerHTML = data.map((item, i) => renderCard(item, i)).join('');
    bindCardListeners();
  } catch (err) {
    console.error('Load feed error:', err);
    grid.innerHTML = '<div class="loading">❌ Errore di connessione. Riprova.</div>';
  }
}

/* ===== Render Card ===== */
function renderCard(item, i) {
  const isProject = currentFeed === 'projects';
  const icon = isProject ? '💻' : '🎬';
  const liked = userLikes.has((isProject ? 'project_' : 'video_') + item.id);
  const imgUrl = item.image_url || item.thumbnail_url;
  const image = imgUrl 
    ? `<img src="${esc(imgUrl)}" class="card-image" alt="${esc(item.title)}" onerror="this.outerHTML='<div class=\\'card-image\\'>${icon}</div>'" loading="lazy">`
    : `<div class="card-image">${icon}</div>`;
  const tags = (item.tags || []).slice(0, 4).map(t => `<span class="tag">#${esc(t)}</span>`).join('');

  return `
  <div class="card" style="animation-delay:${i*0.04}s" data-id="${item.id}" data-type="${isProject ? 'project' : 'video'}">
    ${image}
    <div class="card-body">
      <div class="card-title">
        ${esc(item.title)}
        <span class="card-badge ${isProject ? 'badge-project' : 'badge-video'}">${isProject ? 'Progetto' : 'Video'}</span>
      </div>
      <div class="card-author">👤 ${esc(item.user_email || 'Anonimo')} · ${timeAgo(item.created_at)}</div>
      <p class="card-desc">${esc(item.description)}</p>
      <div class="card-tags">${tags}</div>
      <div class="card-footer">
        <div class="card-actions">
          <button class="action-btn like-btn ${liked ? 'liked' : ''}" data-id="${item.id}">
            ${liked ? '❤️' : '🤍'} <span class="count">${item.likes_count || 0}</span>
          </button>
          <button class="action-btn comment-btn" data-id="${item.id}">💬 <span class="count">${item.comments_count || 0}</span></button>
          ${item.project_url && isProject ? `<a href="${esc(item.project_url)}" target="_blank" rel="noopener" class="action-btn" onclick="event.stopPropagation()" title="Visita">🔗</a>` : ''}
        </div>
        ${currentUser && currentUser.id === item.user_id ? 
          `<div style="display:flex;gap:0.3rem">
            <button class="btn btn-sm edit-btn" data-id="${item.id}">✏️</button>
            <button class="btn btn-sm btn-danger delete-btn" data-id="${item.id}">🗑️</button>
          </div>` : ''}
      </div>
    </div>
  </div>`;
}

/* ===== Bind Card Listeners ===== */
function bindCardListeners() {
  document.querySelectorAll('.delete-btn').forEach(b => {
    b.addEventListener('click', async (e) => {
      e.stopPropagation();
      if (!confirm('Eliminare?')) return;
      const table = currentFeed === 'projects' ? 'projects' : 'videos';
      const { error } = await supabase.from(table).delete().eq('id', parseInt(b.dataset.id));
      if (error) { showToast('Errore', 'error'); return; }
      showToast('Eliminato', 'success');
      loadFeed();
    });
  });

  document.querySelectorAll('.edit-btn').forEach(b => {
    b.addEventListener('click', async (e) => {
      e.stopPropagation();
      const table = currentFeed === 'projects' ? 'projects' : 'videos';
      const { data } = await supabase.from(table).select('*').eq('id', parseInt(b.dataset.id)).single();
      if (!data) return;
      if (table === 'projects') fillProjectForm(data);
      else fillVideoForm(data);
    });
  });

  document.querySelectorAll('.like-btn').forEach(b => {
    b.addEventListener('click', async (e) => {
      e.stopPropagation();
      if (!currentUser) { openModal('modalAuth'); return; }
      const id = parseInt(b.dataset.id);
      const prefix = currentFeed === 'projects' ? 'project_' : 'video_';
      const key = prefix + id;
      const col = currentFeed === 'projects' ? 'project_id' : 'video_id';
      const liked = userLikes.has(key);

      if (liked) {
        await supabase.from('likes').delete().eq(col, id).eq('user_id', currentUser.id);
        userLikes.delete(key);
      } else {
        await supabase.from('likes').insert({ [col]: id, user_id: currentUser.id });
        userLikes.add(key);
      }
      // Refresh card
      const table = currentFeed === 'projects' ? 'projects' : 'videos';
      const { data } = await supabase.from(table).select('*').eq('id', id).single();
      if (data) updateSingleCard(data);
    });
  });

  document.querySelectorAll('.comment-btn').forEach(b => {
    b.addEventListener('click', (e) => {
      e.stopPropagation();
      openDetail(parseInt(b.dataset.id));
    });
  });

  document.querySelectorAll('.card').forEach(card => {
    card.addEventListener('click', (e) => {
      if (e.target.closest('button') || e.target.closest('a')) return;
      openDetail(parseInt(card.dataset.id));
    });
  });
}

function updateSingleCard(item) {
  const el = document.querySelector(`.card[data-id="${item.id}"]`);
  if (!el) return;
  const grid = document.getElementById('contentGrid');
  const cards = [...grid.children];
  const i = cards.indexOf(el);
  el.outerHTML = renderCard(item, i);
  bindCardListeners();
}

/* ===== Open Detail ===== */
async function openDetail(contentId) {
  const table = currentFeed === 'projects' ? 'projects' : 'videos';
  const { data } = await supabase.from(table).select('*').eq('id', contentId).single();
  if (!data) return;

  currentDetail = { type: currentFeed === 'projects' ? 'project' : 'video', id: contentId };

  const { data: comments } = await supabase.from('comments')
    .select('*').eq(table === 'projects' ? 'project_id' : 'video_id', contentId)
    .order('created_at', { ascending: true });

  const modal = document.getElementById('modalDetail');
  const content = document.getElementById('detailContent');
  const isOwner = currentUser && currentUser.id === data.user_id;
  const tags = (data.tags || []).map(t => `<span class="tag">#${esc(t)}</span>`).join('');

  let mediaHtml = '';
  if (table === 'videos') {
    const vid = parseVideoUrl(data.video_url);
    if (vid) {
      mediaHtml = `<iframe class="video-embed" src="${vid.embed}" frameborder="0" allowfullscreen></iframe>`;
    }
  } else if (data.image_url) {
    mediaHtml = `<img src="${esc(data.image_url)}" class="detail-image" alt="${esc(data.title)}">`;
  }

  content.innerHTML = `
    <button class="modal-close" onclick="closeModal('modalDetail')">✕</button>
    <div class="detail-header">
      <h2>${esc(data.title)}</h2>
      <div class="detail-meta">
        <span>👤 ${esc(data.user_email || 'Anonimo')}</span>
        <span>🕒 ${timeAgo(data.created_at)}</span>
        <span>❤️ ${data.likes_count || 0} likes</span>
        <span>💬 ${data.comments_count || 0} commenti</span>
      </div>
    </div>
    ${mediaHtml}
    <p class="detail-desc">${esc(data.description)}</p>
    ${data.project_url ? `<a href="${esc(data.project_url)}" class="detail-link" target="_blank" rel="noopener">🔗 ${esc(data.project_url)}</a>` : ''}
    <div class="card-tags" style="margin-bottom:1rem">${tags}</div>
    ${isOwner ? `
      <div style="display:flex;gap:0.5rem;margin-bottom:1rem">
        <button class="btn btn-sm edit-detail-btn" data-id="${data.id}">✏️ Modifica</button>
        <button class="btn btn-sm btn-danger delete-detail-btn" data-id="${data.id}">🗑️ Elimina</button>
      </div>` : ''}

    <div class="comments-section">
      <h4>💬 Commenti (${comments?.length || 0})</h4>
      ${(comments || []).map(c => `
        <div class="comment">
          <div class="comment-header"><strong>${esc(c.user_email || 'Anonimo')}</strong> <span>${timeAgo(c.created_at)}</span></div>
          <div class="comment-body">${esc(c.content)}</div>
        </div>
      `).join('')}
      ${currentUser ? `
        <div class="comment-form">
          <input type="text" id="commentInput" placeholder="Scrivi un commento..." maxlength="500">
          <button class="btn btn-primary btn-sm" id="btnAddComment">Invia</button>
        </div>
      ` : `<p style="color:var(--text-muted);margin-top:0.75rem">🔐 <a href="#" onclick="openModal('modalAuth');return false" style="color:var(--primary-light)">Accedi</a> per commentare</p>`}
    </div>
  `;

  modal.classList.add('open');

  // Edit from detail
  document.querySelector('.edit-detail-btn')?.addEventListener('click', async () => {
    closeModal('modalDetail');
    const { data: full } = await supabase.from(table).select('*').eq('id', contentId).single();
    if (!full) return;
    if (table === 'projects') fillProjectForm(full);
    else fillVideoForm(full);
  });

  // Delete from detail
  document.querySelector('.delete-detail-btn')?.addEventListener('click', async () => {
    if (!confirm('Eliminare?')) return;
    await supabase.from(table).delete().eq('id', contentId);
    closeModal('modalDetail');
    showToast('Eliminato', 'success');
    loadFeed();
  });

  // Add comment
  document.getElementById('btnAddComment')?.addEventListener('click', async () => {
    const input = document.getElementById('commentInput');
    if (!input.value.trim()) return;
    const col = table === 'projects' ? 'project_id' : 'video_id';
    const { error } = await supabase.from('comments').insert({
      [col]: contentId, user_id: currentUser.id,
      content: input.value.trim(), user_email: currentUser.email
    });
    if (error) { showToast('Errore', 'error'); return; }
    input.value = '';
    showToast('Commento aggiunto!', 'success');
    openDetail(contentId);
  });
}

/* ===== Project Form ===== */
function fillProjectForm(data) {
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
}

document.getElementById('formProject').addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!currentUser) { showToast('🔐 Devi accedere prima!', 'error'); openModal('modalAuth'); return; }
  
  const id = document.getElementById('editProjectId').value;
  const title = document.getElementById('projectTitle').value.trim();
  const desc = document.getElementById('projectDesc').value.trim();
  const url = document.getElementById('projectUrl').value.trim();
  const img = document.getElementById('projectImage').value.trim();
  const cat = document.getElementById('projectCategory').value;
  const tags = document.getElementById('projectTags').value.split(',').map(t => t.trim()).filter(Boolean);

  const payload = { title, description: desc, project_url: url || null, image_url: img || null, category: cat, tags, user_id: currentUser.id, user_email: currentUser.email };

  let error;
  if (id) ({ error } = await supabase.from('projects').update(payload).eq('id', id));
  else ({ error } = await supabase.from('projects').insert(payload));

  if (error) { showToast('Errore: ' + error.message, 'error'); return; }
  showToast(id ? 'Progetto aggiornato! ✨' : 'Progetto pubblicato! 🎉', 'success');
  closeModal('modalProject');
  resetProjectForm();
  loadFeed();
});

function resetProjectForm() {
  document.getElementById('formProject').reset();
  document.getElementById('editProjectId').value = '';
  document.getElementById('modalProjectTitle').textContent = '➕ Nuovo Progetto';
  document.getElementById('btnSubmitProject').textContent = '🚀 Pubblica Progetto';
}

/* ===== Video Form ===== */
function fillVideoForm(data) {
  document.getElementById('editVideoId').value = data.id;
  document.getElementById('videoTitle').value = data.title;
  document.getElementById('videoDesc').value = data.description;
  document.getElementById('videoUrl').value = data.video_url || '';
  document.getElementById('videoTags').value = (data.tags || []).join(', ');
  document.getElementById('modalVideoTitle').textContent = '✏️ Modifica Video';
  document.getElementById('btnSubmitVideo').textContent = '💾 Salva Modifiche';
  openModal('modalVideo');
}

document.getElementById('formVideo').addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!currentUser) { showToast('🔐 Devi accedere prima!', 'error'); openModal('modalAuth'); return; }

  const id = document.getElementById('editVideoId').value;
  const title = document.getElementById('videoTitle').value.trim();
  const desc = document.getElementById('videoDesc').value.trim();
  const url = document.getElementById('videoUrl').value.trim();
  const tags = document.getElementById('videoTags').value.split(',').map(t => t.trim()).filter(Boolean);

  const videoInfo = parseVideoUrl(url);
  const platform = videoInfo?.platform || 'other';
  const thumbnail = videoInfo?.platform === 'youtube'
    ? `https://img.youtube.com/vi/${videoInfo.id}/hqdefault.jpg`
    : null;

  const payload = { title, description: desc, video_url: url, thumbnail_url: thumbnail, platform, tags, user_id: currentUser.id, user_email: currentUser.email };

  let error;
  if (id) ({ error } = await supabase.from('videos').update(payload).eq('id', id));
  else ({ error } = await supabase.from('videos').insert(payload));

  if (error) { showToast('Errore: ' + error.message, 'error'); return; }
  showToast(id ? 'Video aggiornato! ✨' : 'Video pubblicato! 🎥', 'success');
  closeModal('modalVideo');
  resetVideoForm();
  loadFeed();
});

function resetVideoForm() {
  document.getElementById('formVideo').reset();
  document.getElementById('editVideoId').value = '';
  document.getElementById('modalVideoTitle').textContent = '🎥 Nuovo Video';
  document.getElementById('btnSubmitVideo').textContent = '🎥 Pubblica Video';
}

/* ===== Init ===== */
document.addEventListener('DOMContentLoaded', () => {
  checkAuth();

  // Feed tabs
  document.querySelectorAll('.feed-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.feed-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      currentFeed = tab.dataset.feed;
      loadFeed();
    });
  });

  // Auth tabs
  document.querySelectorAll('.modal-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.modal-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      document.querySelectorAll('.auth-form').forEach(f => f.classList.remove('active'));
      document.getElementById(tab.dataset.tab === 'login' ? 'formLogin' : 'formSignup').classList.add('active');
      document.getElementById('loginError').textContent = '';
      document.getElementById('signupError').textContent = '';
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

  // Open project modal
  document.getElementById('btnNewProject').addEventListener('click', () => {
    if (!currentUser) { openModal('modalAuth'); return; }
    resetProjectForm();
    openModal('modalProject');
  });
  // btnEmptyCreate handler è dinamico in loadFeed() — non duplicarlo qui

  // Open video modal
  document.getElementById('btnNewVideo').addEventListener('click', () => {
    if (!currentUser) { openModal('modalAuth'); return; }
    resetVideoForm();
    openModal('modalVideo');
  });

  // Hero button
  document.getElementById('btnHeroStart').addEventListener('click', () => openModal('modalAuth'));

  // Close buttons
  document.getElementById('closeAuth').addEventListener('click', () => closeModal('modalAuth'));
  document.getElementById('closeProject').addEventListener('click', () => closeModal('modalProject'));
  document.getElementById('closeVideo').addEventListener('click', () => closeModal('modalVideo'));

  // Overlay close
  document.querySelectorAll('.modal-overlay').forEach(o => {
    o.addEventListener('click', (e) => { if (e.target === o) o.classList.remove('open'); });
  });
  // Escape
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') document.querySelectorAll('.modal-overlay.open').forEach(m => m.classList.remove('open'));
  });

  // Real-time: likes
  supabase.channel('realtime-likes')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'likes' }, async (payload) => {
      const pid = payload.new?.project_id || payload.old?.project_id;
      const vid = payload.new?.video_id || payload.old?.video_id;
      const table = pid ? 'projects' : 'videos';
      const id = pid || vid;
      if (id && currentDetail && 
          ((currentDetail.type === 'project' && pid) || (currentDetail.type === 'video' && vid)) &&
          currentDetail.id === id) {
        openDetail(id);
      }
      if (id) {
        const { data } = await supabase.from(table).select('*').eq('id', id).single();
        if (data) updateSingleCard(data);
      }
    })
    .subscribe();

  // Real-time: comments
  supabase.channel('realtime-comments')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'comments' }, async (payload) => {
      const pid = payload.new?.project_id;
      const vid = payload.new?.video_id;
      const table = pid ? 'projects' : 'videos';
      const id = pid || vid;
      if (id && currentDetail && 
          ((currentDetail.type === 'project' && pid) || (currentDetail.type === 'video' && vid)) &&
          currentDetail.id === id) {
        openDetail(id);
      }
      if (id) {
        const { data } = await supabase.from(table).select('*').eq('id', id).single();
        if (data) updateSingleCard(data);
      }
    })
    .subscribe();
});
