// Shared data + auth helpers, backed by Supabase (see js/config.js and supabase/schema.sql).

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

const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
const CLIENT_KEY = 'mt_client';

let CLIENTS = []; // clients the signed-in user can see
let ITEMS = [];   // content for the client being viewed

/* ---------- small browser preferences (not data) ---------- */

function readPref(key) {
  try { return localStorage.getItem(key); } catch (e) { return null; }
}

function writePref(key, value) {
  try { localStorage.setItem(key, value); } catch (e) {}
}

/* ---------- row mapping (database <-> page) ---------- */

function fromRow(r) {
  return {
    id: r.id,
    clientId: r.client_id,
    title: r.title,
    platform: r.platform,
    type: r.type,
    date: r.publish_date,
    status: r.status,
    link: r.link || '',
    notes: r.notes || '',
    reach: r.reach,
    likes: r.likes,
    comments: r.comments,
    shares: r.shares,
    saves: r.saves
  };
}

function toRow(i) {
  return {
    client_id: i.clientId,
    title: i.title,
    platform: i.platform,
    type: i.type,
    publish_date: i.date,
    status: i.status,
    link: i.link || null,
    notes: i.notes || null,
    reach: i.reach,
    likes: i.likes,
    comments: i.comments,
    shares: i.shares,
    saves: i.saves
  };
}

/* ---------- auth ---------- */

// Signed-in user + their profile, or null.
async function getSession() {
  const { data: { session } } = await sb.auth.getSession();
  if (!session) return null;
  const { data: profile } = await sb.from('profiles')
    .select('email, full_name, role, client_id')
    .eq('id', session.user.id)
    .maybeSingle();
  if (!profile) return null;
  return {
    email: profile.email || session.user.email,
    name: profile.full_name,
    role: profile.role,
    clientId: profile.client_id
  };
}

async function login(email, password, role) {
  const { error } = await sb.auth.signInWithPassword({ email: email.trim().toLowerCase(), password });
  if (error) {
    return { error: /invalid login credentials/i.test(error.message) ? 'Incorrect email or password.' : error.message };
  }
  const s = await getSession();
  if (!s) {
    await sb.auth.signOut();
    return { error: 'This login isn\'t set up yet. Ask your WorthyOps admin.' };
  }
  if (s.role !== role) {
    await sb.auth.signOut();
    return { error: role === 'admin' ? 'This isn\'t an admin account. Use the Client portal tab.' : 'This is an admin account. Use the Admin tab.' };
  }
  return { session: s };
}

async function logout() {
  await sb.auth.signOut();
  location.href = 'index.html';
}

// Call at the top of each protected page: checks the login, loads the
// clients and the current client's content, then fills the header.
async function initPage(...roles) {
  const s = await getSession();
  if (!s) { location.href = 'index.html'; return null; }
  if (roles.length && !roles.includes(s.role)) { location.href = 'dashboard.html'; return null; }

  try {
    await loadClients();
    await loadItems(s);
  } catch (e) {
    showError('Couldn\'t load data from the database: ' + e.message);
  }

  initHeader(s);
  document.body.classList.add('ready');
  return s;
}

/* ---------- clients ---------- */

async function loadClients() {
  const { data, error } = await sb.from('clients').select('id, name').order('name');
  if (error) throw error;
  CLIENTS = data;
}

function getClients() {
  return CLIENTS;
}

function getClient(id) {
  return CLIENTS.find(c => c.id === id);
}

// Clients are locked to their own account; admins pick one in the header.
function currentClientId(session) {
  if (session.role === 'client') return session.clientId;
  const saved = readPref(CLIENT_KEY);
  if (getClient(saved)) return saved;
  return CLIENTS.length ? CLIENTS[0].id : null;
}

function setCurrentClient(id) {
  writePref(CLIENT_KEY, id);
}

// Creates a client and its login via the create-client Edge Function.
async function addClient(name, email, password) {
  name = name.trim();
  email = email.trim().toLowerCase();
  if (!name) return { error: 'Enter a client name.' };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: 'Enter a valid login email.' };
  if (password.length < 6) return { error: 'Password must be at least 6 characters.' };

  const { data, error } = await sb.functions.invoke('create-client', { body: { name, email, password } });
  if (error) {
    let msg = error.message;
    try {
      const body = await error.context.json();
      if (body && body.error) msg = body.error;
    } catch (e) {}
    if (error.context && error.context.status === 404) msg = 'The create-client function isn\'t deployed in Supabase yet.';
    return { error: msg };
  }
  return { client: data.client };
}

/* ---------- content ---------- */

async function loadItems(session) {
  ITEMS = [];
  const cid = currentClientId(session);
  if (!cid) return;
  const { data, error } = await sb.from('content_items')
    .select('*')
    .eq('client_id', cid)
    .order('publish_date', { ascending: false });
  if (error) throw error;
  ITEMS = data.map(fromRow);
}

// Content for the client being viewed (already loaded by initPage).
function clientItems() {
  return ITEMS;
}

function getItem(id) {
  return ITEMS.find(i => i.id === id);
}

// Inserts (no id) or updates (with id). Returns { item } or { error }.
async function saveItem(item) {
  const row = toRow(item);
  const query = item.id
    ? sb.from('content_items').update(row).eq('id', item.id)
    : sb.from('content_items').insert(row);
  const { data, error } = await query.select().single();
  if (error) return { error: error.message };
  const saved = fromRow(data);
  const idx = ITEMS.findIndex(i => i.id === saved.id);
  if (idx >= 0) ITEMS[idx] = saved; else ITEMS.push(saved);
  return { item: saved };
}

async function deleteItem(id) {
  const { error } = await sb.from('content_items').delete().eq('id', id);
  if (error) return { error: error.message };
  ITEMS = ITEMS.filter(i => i.id !== id);
  return {};
}

/* ---------- header ---------- */

// Fills the header: client switcher (admin) or client name, user label, logout.
function initHeader(session) {
  document.querySelectorAll('.admin-only').forEach(el => {
    if (session.role !== 'admin') el.remove();
  });

  const slot = document.getElementById('client-slot');
  if (slot) {
    const cid = currentClientId(session);
    const client = getClient(cid);
    const initial = client ? escapeHTML(client.name.charAt(0)) : '?';
    if (session.role === 'admin') {
      slot.innerHTML = `<div class="client-bar">
        ${CLIENTS.length ? `<label class="client-switch">
          <span class="client-dot">${initial}</span>
          <select id="client-select" aria-label="Client">
            ${CLIENTS.map(c => `<option value="${c.id}"${c.id === cid ? ' selected' : ''}>${escapeHTML(c.name)}</option>`).join('')}
          </select>
        </label>` : '<span class="client-switch static">No clients yet</span>'}
        <button type="button" class="icon-btn" id="add-client" title="Add client" aria-label="Add client">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>
        </button>
      </div>`;
      const select = document.getElementById('client-select');
      if (select) select.addEventListener('change', e => {
        setCurrentClient(e.target.value);
        location.href = location.pathname.split('/').pop() || 'dashboard.html';
      });
      document.getElementById('add-client').addEventListener('click', openAddClient);
    } else if (client) {
      slot.innerHTML = `<span class="client-switch static">
        <span class="client-dot">${initial}</span>${escapeHTML(client.name)}
      </span>`;
    }
  }

  const name = document.getElementById('client-name');
  if (name) {
    const client = getClient(currentClientId(session));
    name.textContent = client ? client.name : (session.role === 'admin' ? 'No client selected' : 'No client linked to this login');
  }

  const who = document.getElementById('who');
  if (who) who.textContent = session.email;
  const avatar = document.getElementById('avatar');
  if (avatar) avatar.textContent = session.role === 'admin' ? 'A' : 'C';
  const out = document.getElementById('logout');
  if (out) out.addEventListener('click', logout);
}

// Banner at the top of the page for load/save problems.
function showError(msg) {
  let el = document.getElementById('app-error');
  if (!el) {
    el = document.createElement('div');
    el.id = 'app-error';
    el.className = 'app-error';
    const main = document.querySelector('main');
    main.insertBefore(el, main.firstChild);
  }
  el.textContent = msg;
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
        <button type="submit" class="btn" id="nc-submit">Create client</button>
      </div>
    </form>`;
    document.body.appendChild(dlg);

    dlg.querySelectorAll('[data-close]').forEach(b => b.addEventListener('click', () => dlg.close()));
    dlg.addEventListener('click', e => { if (e.target === dlg) dlg.close(); });
    dlg.querySelector('form').addEventListener('submit', async e => {
      e.preventDefault();
      const btn = document.getElementById('nc-submit');
      btn.disabled = true;
      btn.textContent = 'Creating…';
      const res = await addClient(
        document.getElementById('nc-name').value,
        document.getElementById('nc-email').value,
        document.getElementById('nc-pass').value);
      btn.disabled = false;
      btn.textContent = 'Create client';
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
