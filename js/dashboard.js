(function () {
  const session = requireRole('admin', 'client');
  if (!session) return;
  initHeader(session);

  const fPlatform = document.getElementById('f-platform');
  const fType = document.getElementById('f-type');
  const fRange = document.getElementById('f-range');
  const DAY = 86400000;
  let sortKey = 'date';
  let sortAsc = false;

  fPlatform.innerHTML = '<option value="">All platforms</option>' +
    Object.keys(PLATFORMS).map(p => `<option>${p}</option>`).join('');

  function fillTypes() {
    const p = fPlatform.value;
    const types = p ? PLATFORMS[p] : [...new Set(Object.values(PLATFORMS).flat())];
    fType.innerHTML = '<option value="">All types</option>' +
      types.map(t => `<option>${t}</option>`).join('');
  }

  function daysAgo(n) {
    const d = new Date();
    d.setDate(d.getDate() - n);
    return isoDate(d);
  }

  // Published items matching platform/type, optionally within [from, to].
  function matching(from, to) {
    const p = fPlatform.value;
    const t = fType.value;
    return getItems().filter(i =>
      i.status === 'published' &&
      (!p || i.platform === p) &&
      (!t || i.type === t) &&
      (!from || i.date >= from) &&
      (!to || i.date <= to));
  }

  function summarize(items) {
    const reach = items.reduce((a, i) => a + (+i.reach || 0), 0);
    const eng = items.reduce((a, i) => a + engagements(i), 0);
    return { posts: items.length, reach, eng, er: reach ? eng / reach : 0 };
  }

  /* ---------- KPI deltas ---------- */

  function setDelta(id, cur, prev, range, isRate) {
    const el = document.getElementById(id);
    if (range === 'all' || !prev) { el.innerHTML = ''; return; }
    let change, text;
    if (isRate) {
      change = (cur - prev) * 100;
      text = Math.abs(change).toFixed(2) + ' pts';
    } else {
      change = (cur - prev) / prev * 100;
      text = Math.abs(change).toFixed(0) + '%';
    }
    const dir = Math.abs(change) < 0.005 ? 'flat' : change > 0 ? 'up' : 'down';
    const arrow = dir === 'up' ? '↑' : dir === 'down' ? '↓' : '→';
    el.className = 'delta ' + dir;
    el.innerHTML = `<b>${arrow} ${text}</b><span class="vs">vs previous ${range} days</span>`;
  }

  /* ---------- time buckets for the trend chart ---------- */

  function trendPoints(items, range) {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    let start;
    if (range === 'all') {
      const first = items.reduce((m, i) => (i.date < m ? i.date : m), isoDate(today));
      start = new Date(first + 'T00:00:00');
    } else {
      start = new Date(today.getTime() - (+range - 1) * DAY);
    }
    const span = Math.round((today - start) / DAY) + 1;
    const unit = span <= 14 ? 'day' : span <= 200 ? 'week' : 'month';

    const bucketStart = d => {
      const x = new Date(d); x.setHours(0, 0, 0, 0);
      if (unit === 'week') x.setDate(x.getDate() - ((x.getDay() + 6) % 7));
      if (unit === 'month') x.setDate(1);
      return x;
    };
    const step = d => {
      const x = new Date(d);
      if (unit === 'day') x.setDate(x.getDate() + 1);
      if (unit === 'week') x.setDate(x.getDate() + 7);
      if (unit === 'month') x.setMonth(x.getMonth() + 1);
      return x;
    };

    const map = new Map();
    for (let d = bucketStart(start); d <= today; d = step(d)) {
      map.set(isoDate(d), { date: new Date(d), value: 0, posts: 0 });
    }
    items.forEach(i => {
      const b = map.get(isoDate(bucketStart(new Date(i.date + 'T00:00:00'))));
      if (b) { b.value += +i.reach || 0; b.posts++; }
    });

    const short = { month: 'short', day: 'numeric' };
    document.getElementById('trend-sub').textContent = 'Per ' + unit;
    return [...map.values()].map(b => {
      const posts = b.posts + (b.posts === 1 ? ' post' : ' posts');
      if (unit === 'month') {
        return {
          value: b.value,
          label: b.date.toLocaleDateString(undefined, { month: 'short' }),
          tip: b.date.toLocaleDateString(undefined, { month: 'long', year: 'numeric' }) + ' · ' + posts
        };
      }
      const label = b.date.toLocaleDateString(undefined, short);
      return {
        value: b.value,
        label,
        tip: (unit === 'week' ? 'Week of ' + label : b.date.toLocaleDateString(undefined, { weekday: 'short', ...short })) + ' · ' + posts
      };
    });
  }

  /* ---------- render ---------- */

  function renderCharts(items, range) {
    const p = fPlatform.value;
    const seriesColor = p ? platformColor(p) : 'var(--accent)';

    lineChart(document.getElementById('chart-trend'), trendPoints(items, range), {
      color: seriesColor,
      label: 'Reach over time',
      format: v => fmtNum(v) + ' reach'
    });

    barChart(document.getElementById('chart-platform'), Object.keys(PLATFORMS).map(name => {
      const s = summarize(items.filter(i => i.platform === name));
      return {
        label: name,
        labelHTML: platformTag(name),
        value: s.reach,
        display: fmtNum(s.reach),
        color: platformColor(name),
        tip: `<div class="t-title">${name}</div><div class="t-val">${fmtNum(s.reach)} reach</div>${s.posts} posts · ${fmtPct(s.er)} eng. rate`
      };
    }));

    const byType = {};
    items.forEach(i => (byType[i.type] ||= []).push(i));
    const typeRows = Object.entries(byType).map(([type, list]) => {
      const s = summarize(list);
      return {
        label: type,
        value: s.er,
        display: fmtPct(s.er),
        color: seriesColor,
        tip: `<div class="t-title">${type}</div><div class="t-val">${fmtPct(s.er)} eng. rate</div>${s.posts} posts · ${fmtNum(s.reach)} reach`
      };
    }).sort((a, b) => b.value - a.value);
    barChart(document.getElementById('chart-type'), typeRows);
  }

  function render() {
    const range = fRange.value;
    const today = isoDate(new Date());
    const from = range === 'all' ? null : daysAgo(+range - 1);
    const items = matching(from, today);
    const s = summarize(items);

    document.getElementById('k-posts').textContent = s.posts;
    document.getElementById('k-reach').textContent = fmtNum(s.reach);
    document.getElementById('k-eng').textContent = fmtNum(s.eng);
    document.getElementById('k-er').textContent = fmtPct(s.er);

    const prev = range === 'all' ? null : summarize(matching(daysAgo(2 * +range - 1), daysAgo(+range)));
    setDelta('d-posts', s.posts, prev && prev.posts, range);
    setDelta('d-reach', s.reach, prev && prev.reach, range);
    setDelta('d-eng', s.eng, prev && prev.eng, range);
    setDelta('d-er', s.er, prev && prev.er, range, true);

    renderCharts(items, range);

    document.getElementById('platforms').innerHTML = Object.keys(PLATFORMS).map(p => {
      const ps = summarize(items.filter(i => i.platform === p));
      return `<div class="pcard" style="--c:${platformColor(p)}">
        <div class="name">${platformTag(p)}</div>
        <div class="big">${fmtNum(ps.reach)} <span class="sub" style="font-weight:400">reach</span></div>
        <div class="row"><span>Posts</span><span>${ps.posts}</span></div>
        <div class="row"><span>Engagements</span><span>${fmtNum(ps.eng)}</span></div>
        <div class="row"><span>Eng. rate</span><span>${fmtPct(ps.er)}</span></div>
      </div>`;
    }).join('');

    const val = i => sortKey === 'er' ? engagementRate(i) : sortKey === 'date' ? i.date : +i[sortKey] || 0;
    items.sort((a, b) => (val(a) > val(b) ? 1 : val(a) < val(b) ? -1 : 0) * (sortAsc ? 1 : -1));

    document.querySelectorAll('th.sortable').forEach(th => {
      th.classList.toggle('sorted', th.dataset.key === sortKey);
      th.classList.toggle('asc', th.dataset.key === sortKey && sortAsc);
    });

    document.getElementById('count-sub').textContent = items.length + (items.length === 1 ? ' post' : ' posts');

    const rows = document.getElementById('rows');
    if (!items.length) {
      rows.innerHTML = '<tr><td colspan="10" class="empty">No published content in this range.</td></tr>';
      return;
    }
    rows.innerHTML = items.map(i => `<tr>
      <td>${fmtDate(i.date)}</td>
      <td class="title">${/^https?:\/\//i.test(i.link || '') ? `<a href="${escapeHTML(i.link)}" target="_blank" rel="noopener">${escapeHTML(i.title)}</a>` : escapeHTML(i.title)}</td>
      <td>${platformTag(i.platform)}</td>
      <td>${i.type}</td>
      <td class="num">${fmtNum(i.reach)}</td>
      <td class="num">${fmtNum(i.likes)}</td>
      <td class="num">${fmtNum(i.comments)}</td>
      <td class="num">${fmtNum(i.shares)}</td>
      <td class="num">${fmtNum(i.saves)}</td>
      <td class="num"><span class="er-pill">${fmtPct(engagementRate(i))}</span></td>
    </tr>`).join('');
  }

  document.querySelectorAll('th.sortable').forEach(th => th.addEventListener('click', () => {
    if (sortKey === th.dataset.key) sortAsc = !sortAsc;
    else { sortKey = th.dataset.key; sortAsc = false; }
    render();
  }));

  fPlatform.addEventListener('change', () => { fillTypes(); render(); });
  fType.addEventListener('change', render);
  fRange.addEventListener('change', render);

  let resizeTimer;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(render, 150);
  });

  document.getElementById('today').textContent =
    new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });

  fillTypes();
  render();
})();
