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

// Clients the admin manages. Add a client here and give it a login below.
const CLIENTS = [
  { id: 'c1', name: 'Northwind Studio' },
  { id: 'c2', name: 'Bluepeak Fitness' },
  { id: 'c3', name: 'Acme Coaching' }
];

// Demo accounts. Replace with a real backend before going live.
const USERS = [
  { email: 'admin@demo.test', password: 'admin123', role: 'admin', name: 'Admin' },
  { email: 'client@demo.test', password: 'client123', role: 'client', name: 'Northwind Studio', clientId: 'c1' },
  { email: 'bluepeak@demo.test', password: 'client123', role: 'client', name: 'Bluepeak Fitness', clientId: 'c2' },
  { email: 'acme@demo.test', password: 'client123', role: 'client', name: 'Acme Coaching', clientId: 'c3' }
];

const ITEMS_KEY = 'mt_items';
const SESSION_KEY = 'mt_session';
const CLIENT_KEY = 'mt_client';

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
    items = CLIENTS.flatMap((c, n) => seedItems(c.id, n));
    writeJSON(ITEMS_KEY, items);
  } else if (items.length && items.every(i => !i.clientId)) {
    // Data from before clients existed: it belongs to the first client.
    items.forEach(i => { i.clientId = CLIENTS[0].id; });
    items = items.concat(CLIENTS.slice(1).flatMap((c, n) => seedItems(c.id, n + 1)));
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

function getClient(id) {
  return CLIENTS.find(c => c.id === id);
}

// Clients are locked to their own account; admins pick one in the header.
function currentClientId(session) {
  if (session.role === 'client') return session.clientId || CLIENTS[0].id;
  const saved = readJSON(CLIENT_KEY, null);
  return getClient(saved) ? saved : CLIENTS[0].id;
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
  const user = USERS.find(u =>
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
      slot.innerHTML = `<label class="client-switch">
        <span class="client-dot">${escapeHTML(getClient(cid).name.charAt(0))}</span>
        <select id="client-select" aria-label="Client">
          ${CLIENTS.map(c => `<option value="${c.id}"${c.id === cid ? ' selected' : ''}>${escapeHTML(c.name)}</option>`).join('')}
        </select>
      </label>`;
      document.getElementById('client-select').addEventListener('change', e => {
        setCurrentClient(e.target.value);
        location.href = location.pathname.split('/').pop() || 'dashboard.html';
      });
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
