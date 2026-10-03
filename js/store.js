// Shared data + auth helpers. Data lives in localStorage (front-end only demo).

const PLATFORMS = {
  LinkedIn: ['Post', 'Carousel', 'Video'],
  Instagram: ['Post', 'Carousel', 'Reel', 'Story Sequence'],
  Twitter: ['Post', 'Thread'],
  YouTube: ['Video', 'Short']
};

// Each platform keeps the same color everywhere (defined in css/style.css).
function platformColor(p) {
  return 'var(--p-' + p.toLowerCase() + ')';
}

function platformTag(p) {
  return '<span class="ptag"><i style="background:' + platformColor(p) + '"></i>' + p + '</span>';
}

// Demo accounts. Replace with a real backend before going live.
const ADMINS = [
  { email: 'admin@demo.test', password: 'admin123', name: 'Admin' }
];

// Starter clients. Admins can add more from the header ("+" next to the client switcher).
const DEFAULT_CLIENTS = [
  { id: 'c1', name: 'Northwind Studio', email: 'client@demo.test', password: 'client123' },
  { id: 'c2', name: 'Bluepeak Fitness', email: 'bluepeak@demo.test', password: 'client123' },
  { id: 'c3', name: 'Acme Coaching', email: 'acme@demo.test', password: 'client123' }
];

const ITEMS_KEY = 'mt_items';
const SESSION_KEY = 'mt_session';
const CLIENT_KEY = 'mt_client';
const CLIENTS_KEY = 'mt_clients';

/* ---------- storage ---------- */

function readJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (e) {
    return fallback;
  }
}

function writeJSON(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) {}
}

function getItems() {
  let items = readJSON(ITEMS_KEY, null);
  if (!items) {
    items = DEFAULT_CLIENTS.flatMap((c, n) => seedItems(c.id, n));
    writeJSON(ITEMS_KEY, items);
  } else if (items.length && items.every(i => !i.clientId)) {
    // Data from before clients existed: it belongs to the first client.
    items.forEach(i => { i.clientId = DEFAULT_CLIENTS[0].id; });
    items = items.concat(DEFAULT_CLIENTS.slice(1).flatMap((c, n) => seedItems(c.id, n + 1)));
    writeJSON(ITEMS_KEY, items);
  }
  return items;
}

function saveItems(items) {
  writeJSON(ITEMS_KEY, items);
}

function getItem(id) {
  return getItems().find(i => i.id === id);
}

function upsertItem(item) {
  const items = getItems();
  const idx = items.findIndex(i => i.id === item.id);
  if (idx >= 0) items[idx] = item; else items.push(item);
  saveItems(items);
}

function removeItem(id) {
  saveItems(getItems().filter(i => i.id !== id));
}

function newId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

/* ---------- clients ---------- */

function getClients() {
  return DEFAULT_CLIENTS.concat(readJSON(CLIENTS_KEY, []));
}

function getClient(id) {
  return getClients().find(c => c.id === id);
}

// Everyone who can sign in: admins plus one login per client.
function getUsers() {
  return ADMINS.map(a => ({ ...a, role: 'admin' })).concat(getClients().map(c => ({
    email: c.email, password: c.password, role: 'client', name: c.name, clientId: c.id
  })));
}

// Creates a client with its own login. Returns { client } or { error }.
function addClient(name, email, password) {
  name = name.trim();
  email = email.trim().toLowerCase();
  if (!name) return { error: 'Enter a client name.' };
  if (getClients().some(c => c.name.toLowerCase() === name.toLowerCase())) return { error: 'A client with this name already exists.' };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: 'Enter a valid login email.' };
  if (getUsers().some(u => u.email === email)) return { error: 'This email is already used by another login.' };
  if (password.length < 6) return { error: 'Password must be at least 6 characters.' };

  const client = { id: 'c' + newId(), name, email, password };
  writeJSON(CLIENTS_KEY, readJSON(CLIENTS_KEY, []).concat(client));
  return { client };
}

// Clients are locked to their own account; admins pick one in the header.
function currentClientId(session) {
  if (session.role === 'client') return session.clientId || DEFAULT_CLIENTS[0].id;
  const saved = readJSON(CLIENT_KEY, null);
  return getClient(saved) ? saved : DEFAULT_CLIENTS[0].id;
}

function setCurrentClient(id) {
  writeJSON(CLIENT_KEY, id);
}

// Items belonging to the client currently being viewed.
function clientItems(session) {
  const cid = currentClientId(session);
  return getItems().filter(i => i.clientId === cid);
}

/* ---------- auth ---------- */

function login(email, password, role) {
  const user = getUsers().find(u =>
    u.email === email.trim().toLowerCase() && u.password === password && u.role === role);
  if (!user) return false;
  writeJSON(SESSION_KEY, { email: user.email, role: user.role, name: user.name, clientId: user.clientId });
  return true;
}

function logout() {
  try { localStorage.removeItem(SESSION_KEY); } catch (e) {}
  location.href = 'index.html';
}

function getSession() {
  return readJSON(SESSION_KEY, null);
}

// Call at the top of each protected page. Redirects if not allowed.
function requireRole(...roles) {
  const s = getSession();
  if (!s) { location.href = 'index.html'; return null; }
  if (roles.length && !roles.includes(s.role)) { location.href = 'dashboard.html'; return null; }
  return s;
}

// Fills the header: client switcher (admin) or client name, user label, logout.
function initHeader(session) {
  document.querySelectorAll('.admin-only').forEach(el => {
    if (session.role !== 'admin') el.remove();
  });

  const slot = document.getElementById('client-slot');
  if (slot) {
    const cid = currentClientId(session);
    if (session.role === 'admin') {
      slot.innerHTML = `<div class="client-bar">
        <label class="client-switch">
          <span class="client-dot">${escapeHTML(getClient(cid).name.charAt(0))}</span>
          <select id="client-select" aria-label="Client">
            ${getClients().map(c => `<option value="${c.id}"${c.id === cid ? ' selected' : ''}>${escapeHTML(c.name)}</option>`).join('')}
          </select>
        </label>
        <button type="button" class="icon-btn" id="add-client" title="Add client" aria-label="Add client">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>
        </button>
      </div>`;
      document.getElementById('client-select').addEventListener('change', e => {
        setCurrentClient(e.target.value);
        location.href = location.pathname.split('/').pop() || 'dashboard.html';
      });
      document.getElementById('add-client').addEventListener('click', openAddClient);
    } else {
      slot.innerHTML = `<span class="client-switch static">
        <span class="client-dot">${escapeHTML(getClient(cid).name.charAt(0))}</span>${escapeHTML(getClient(cid).name)}
      </span>`;
    }
  }

  const who = document.getElementById('who');
  if (who) who.textContent = session.email;
  const avatar = document.getElementById('avatar');
  if (avatar) avatar.textContent = session.role === 'admin' ? 'A' : 'C';
  const out = document.getElementById('logout');
  if (out) out.addEventListener('click', logout);
}

// Admin dialog: create a client and its login, then switch to it.
function openAddClient() {
  let dlg = document.getElementById('add-client-dialog');
  if (!dlg) {
    dlg = document.createElement('dialog');
    dlg.id = 'add-client-dialog';
    dlg.className = 'modal';
    dlg.innerHTML = `<form method="dialog" id="add-client-form" novalidate>
      <div class="modal-head">
        <div>
          <h2>Add client</h2>
          <div class="sub">They'll sign in to the client portal with these details.</div>
        </div>
        <button type="button" class="icon-btn ghost" data-close aria-label="Close">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>
        </button>
      </div>
      <div class="field">
        <label for="nc-name">Client name</label>
        <input id="nc-name" placeholder="e.g. Brightside Media" autocomplete="off">
      </div>
      <div class="field">
        <label for="nc-email">Login email</label>
        <input id="nc-email" type="email" placeholder="client@company.com" autocomplete="off">
      </div>
      <div class="field">
        <label for="nc-pass">Password</label>
        <input id="nc-pass" type="text" placeholder="At least 6 characters" autocomplete="off">
      </div>
      <div class="error" id="nc-error"></div>
      <div class="btn-row">
        <button type="button" class="btn ghost" data-close>Cancel</button>
        <button type="submit" class="btn">Create client</button>
      </div>
    </form>`;
    document.body.appendChild(dlg);

    dlg.querySelectorAll('[data-close]').forEach(b => b.addEventListener('click', () => dlg.close()));
    dlg.addEventListener('click', e => { if (e.target === dlg) dlg.close(); });
    dlg.querySelector('form').addEventListener('submit', e => {
      e.preventDefault();
      const res = addClient(
        document.getElementById('nc-name').value,
        document.getElementById('nc-email').value,
        document.getElementById('nc-pass').value);
      if (res.error) { document.getElementById('nc-error').textContent = res.error; return; }
      setCurrentClient(res.client.id);
      location.href = 'dashboard.html';
    });
  }
  dlg.querySelector('form').reset();
  document.getElementById('nc-error').textContent = '';
  dlg.showModal();
  document.getElementById('nc-name').focus();
}

/* ---------- helpers ---------- */

function engagements(i) {
  return (+i.likes || 0) + (+i.comments || 0) + (+i.shares || 0) + (+i.saves || 0);
}

function engagementRate(i) {
  return i.reach > 0 ? engagements(i) / i.reach : 0;
}

function fmtNum(n) {
  n = +n || 0;
  if (n >= 1e6) return (n / 1e6).toFixed(1).replace(/\.0$/, '') + 'M';
  if (n >= 1e3) return (n / 1e3).toFixed(1).replace(/\.0$/, '') + 'K';
  return String(n);
}

function fmtPct(r) {
  return (r * 100).toFixed(2) + '%';
}

function fmtDate(iso) {
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function isoDate(d) {
  const off = d.getTimezoneOffset();
  return new Date(d.getTime() - off * 60000).toISOString().slice(0, 10);
}

function escapeHTML(s) {
  return String(s ?? '').replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

/* ---------- sample data (first run only) ---------- */

function seedItems(clientId, n0) {
  let s = 7 + n0 * 101;
  const rand = () => (s = (s * 9301 + 49297) % 233280) / 233280;
  const titles = [
    '5 lessons from scaling a creator business', 'How I plan a week of content',
    'The hook formula that works', 'Behind the scenes: studio setup',
    'Why most funnels leak', 'Client results breakdown', 'Morning routine for focus',
    'Stop posting without a plan', '3 tools I use daily', 'Q&A: your top questions',
    'From 0 to 10K followers', 'Simple offer framework'
  ];
  const scale = [1, 0.55, 1.8][n0 % 3];
  const baseReach = { Instagram: 9000, Twitter: 6000, LinkedIn: 5000, YouTube: 12000 };
  const items = [];
  const today = new Date();

  for (let n = 0; n < 64; n++) {
    const platform = Object.keys(PLATFORMS)[(n + n0) % 4];
    const types = PLATFORMS[platform];
    const type = types[Math.floor(rand() * types.length)];
    const d = new Date(today);
    d.setDate(d.getDate() - Math.floor(rand() * 120) - 1);
    const reach = Math.round(baseReach[platform] * scale * (0.4 + rand() * 1.6));
    items.push({
      id: clientId + 's' + n,
      clientId,
      title: titles[(n + n0 * 5) % titles.length],
      platform, type,
      date: isoDate(d),
      status: 'published',
      link: '', notes: '',
      reach,
      likes: Math.round(reach * (0.02 + rand() * 0.05)),
      comments: Math.round(reach * (0.002 + rand() * 0.008)),
      shares: Math.round(reach * (0.001 + rand() * 0.006)),
      saves: Math.round(reach * (0.001 + rand() * 0.01))
    });
  }

  const upcoming = [
    ['Carousel: content pillars explained', 'Instagram', 'Carousel', 2, 'scheduled'],
    ['Thread: my content system', 'Twitter', 'Thread', 3, 'planned'],
    ['Weekly reel: quick tip', 'Instagram', 'Reel', 5, 'planned'],
    ['Long-form: full strategy walkthrough', 'YouTube', 'Video', 8, 'planned'],
    ['Post: lessons from this month', 'LinkedIn', 'Post', 10, 'planned']
  ];
  upcoming.forEach(([title, platform, type, days, status], n) => {
    const d = new Date(today);
    d.setDate(d.getDate() + days + n0);
    items.push({
      id: clientId + 'u' + n, clientId, title, platform, type, date: isoDate(d), status,
      link: '', notes: '', reach: 0, likes: 0, comments: 0, shares: 0, saves: 0
    });
  });

  return items;
}
