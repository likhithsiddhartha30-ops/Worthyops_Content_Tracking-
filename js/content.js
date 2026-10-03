(function () {
  const session = requireRole('admin');
  if (!session) return;
  initHeader(session);

  const $ = id => document.getElementById(id);
  const form = $('item-form');
  const METRICS = ['reach', 'likes', 'comments', 'shares', 'saves'];

  $('platform').innerHTML = Object.keys(PLATFORMS).map(p => `<option>${p}</option>`).join('');
  $('f-platform').innerHTML = '<option value="">All platforms</option>' +
    Object.keys(PLATFORMS).map(p => `<option>${p}</option>`).join('');

  function fillTypes(selected) {
    $('type').innerHTML = PLATFORMS[$('platform').value].map(t => `<option>${t}</option>`).join('');
    if (selected) $('type').value = selected;
  }

  function toggleMetrics() {
    $('metrics-wrap').classList.toggle('hidden', $('status').value !== 'published');
  }

  function resetForm() {
    form.reset();
    $('id').value = '';
    $('date').value = isoDate(new Date());
    fillTypes();
    toggleMetrics();
    $('form-title').textContent = 'Add content';
    $('save').textContent = 'Save content';
    $('cancel').classList.add('hidden');
  }

  function editItem(id, publish) {
    const i = getItem(id);
    if (!i) return;
    $('id').value = i.id;
    $('title').value = i.title;
    $('platform').value = i.platform;
    fillTypes(i.type);
    $('date').value = i.date;
    $('status').value = publish ? 'published' : i.status;
    METRICS.forEach(k => $(k).value = i[k] || 0);
    $('link').value = i.link || '';
    $('notes').value = i.notes || '';
    toggleMetrics();
    $('form-title').textContent = 'Edit content';
    $('save').textContent = 'Update content';
    $('cancel').classList.remove('hidden');
    form.scrollIntoView({ behavior: 'smooth', block: 'start' });
    $('title').focus();
  }

  function render() {
    const p = $('f-platform').value;
    const s = $('f-status').value;
    const items = getItems()
      .filter(i => (!p || i.platform === p) && (!s || i.status === s))
      .sort((a, b) => b.date.localeCompare(a.date));

    const rows = $('rows');
    if (!items.length) {
      rows.innerHTML = '<tr><td colspan="8" class="empty">No content yet.</td></tr>';
      return;
    }
    rows.innerHTML = items.map(i => {
      const published = i.status === 'published';
      return `<tr>
        <td>${fmtDate(i.date)}</td>
        <td class="title">${escapeHTML(i.title)}</td>
        <td>${platformTag(i.platform)}</td>
        <td>${i.type}</td>
        <td><span class="badge ${i.status}">${i.status}</span></td>
        <td class="num">${published ? fmtNum(i.reach) : '—'}</td>
        <td class="num">${published ? '<span class="er-pill">' + fmtPct(engagementRate(i)) + '</span>' : '—'}</td>
        <td class="num">
          <button class="btn ghost small" data-edit="${i.id}">Edit</button>
          <button class="btn danger small" data-del="${i.id}">Delete</button>
        </td>
      </tr>`;
    }).join('');
  }

  form.addEventListener('submit', e => {
    e.preventDefault();
    const title = $('title').value.trim();
    if (!title || !$('date').value) { $('title').focus(); return; }
    const published = $('status').value === 'published';
    const item = {
      id: $('id').value || newId(),
      title,
      platform: $('platform').value,
      type: $('type').value,
      date: $('date').value,
      status: $('status').value,
      link: $('link').value.trim(),
      notes: $('notes').value.trim()
    };
    METRICS.forEach(k => item[k] = published ? Math.max(0, parseInt($(k).value, 10) || 0) : 0);
    upsertItem(item);
    history.replaceState(null, '', 'content.html');
    resetForm();
    render();
  });

  $('rows').addEventListener('click', e => {
    const edit = e.target.dataset.edit;
    const del = e.target.dataset.del;
    if (edit) editItem(edit);
    if (del && confirm('Delete this content? This cannot be undone.')) {
      removeItem(del);
      if ($('id').value === del) resetForm();
      render();
    }
  });

  $('platform').addEventListener('change', () => fillTypes());
  $('status').addEventListener('change', toggleMetrics);
  $('cancel').addEventListener('click', () => {
    history.replaceState(null, '', 'content.html');
    resetForm();
  });
  $('f-platform').addEventListener('change', render);
  $('f-status').addEventListener('change', render);

  resetForm();
  render();

  // Deep links from the planner: ?id=...&publish=1 or ?new=planned
  const q = new URLSearchParams(location.search);
  if (q.get('id')) editItem(q.get('id'), q.get('publish') === '1');
  else if (q.get('new') === 'planned') { $('status').value = 'planned'; toggleMetrics(); $('title').focus(); }
})();
