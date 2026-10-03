(function () {
  const session = requireRole('admin');
  if (!session) return;
  initHeader(session);

  const fPlatform = document.getElementById('f-platform');
  fPlatform.innerHTML = '<option value="">All platforms</option>' +
    Object.keys(PLATFORMS).map(p => `<option>${p}</option>`).join('');

  function addDays(d, n) {
    const x = new Date(d);
    x.setDate(x.getDate() + n);
    return x;
  }

  function groupOf(dateIso, today) {
    // Weeks start on Monday
    const t = new Date(today + 'T00:00:00');
    const monday = addDays(t, -((t.getDay() + 6) % 7));
    const nextMonday = isoDate(addDays(monday, 7));
    const after = isoDate(addDays(monday, 14));
    if (dateIso < today) return 'Overdue';
    if (dateIso < nextMonday) return 'This week';
    if (dateIso < after) return 'Next week';
    return 'Later';
  }

  function itemHTML(i) {
    const d = new Date(i.date + 'T00:00:00');
    return `<div class="plan-item" style="--c:${platformColor(i.platform)}">
      <div class="date">
        <div class="d">${d.getDate()}</div>
        <div class="m">${d.toLocaleDateString(undefined, { month: 'short' })}</div>
      </div>
      <div class="info">
        <div class="t">${escapeHTML(i.title)}</div>
        <div class="meta">${platformTag(i.platform)}<span>${i.type}</span>${i.notes ? '<span>' + escapeHTML(i.notes) + '</span>' : ''}</div>
      </div>
      <span class="badge ${i.status}">${i.status}</span>
      <div class="btn-row">
        <a class="btn ghost small" href="content.html?id=${encodeURIComponent(i.id)}">Edit</a>
        <a class="btn small" href="content.html?id=${encodeURIComponent(i.id)}&publish=1">Mark published</a>
      </div>
    </div>`;
  }

  function render() {
    const today = isoDate(new Date());
    const p = fPlatform.value;
    const items = getItems()
      .filter(i => i.status !== 'published' && (!p || i.platform === p))
      .sort((a, b) => a.date.localeCompare(b.date));

    const el = document.getElementById('plan');
    if (!items.length) {
      el.innerHTML = '<div class="empty">Nothing planned yet. <a href="content.html?new=planned">Plan your first post</a>.</div>';
      return;
    }

    const order = ['Overdue', 'This week', 'Next week', 'Later'];
    const groups = {};
    items.forEach(i => (groups[groupOf(i.date, today)] ||= []).push(i));

    el.innerHTML = order.filter(g => groups[g]).map(g => `
      <div class="plan-group ${g === 'Overdue' ? 'overdue' : ''}">
        <h2>${g} <span class="count">${groups[g].length}</span></h2>
        ${groups[g].map(itemHTML).join('')}
      </div>`).join('');
  }

  fPlatform.addEventListener('change', render);
  render();
})();
