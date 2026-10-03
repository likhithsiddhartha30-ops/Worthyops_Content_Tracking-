// Lightweight SVG/HTML charts with hover tooltips. No external libraries.

const SVG_NS = 'http://www.w3.org/2000/svg';

function svgEl(tag, attrs) {
  const el = document.createElementNS(SVG_NS, tag);
  for (const k in attrs) el.setAttribute(k, attrs[k]);
  return el;
}

function niceMax(v) {
  if (v <= 0) return 1;
  const pow = Math.pow(10, Math.floor(Math.log10(v)));
  const n = v / pow;
  const step = n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10;
  return step * pow;
}

// Vertical fade (color -> transparent) used under lines. Returns a <defs>.
let gradientSeq = 0;
function areaGradient(svg, color, opacity) {
  const id = 'grad' + (++gradientSeq);
  const defs = svgEl('defs', {});
  const g = svgEl('linearGradient', { id, x1: 0, y1: 0, x2: 0, y2: 1 });
  const s1 = svgEl('stop', { offset: '0%', style: `stop-color:${color};stop-opacity:${opacity}` });
  const s2 = svgEl('stop', { offset: '100%', style: `stop-color:${color};stop-opacity:0` });
  g.appendChild(s1);
  g.appendChild(s2);
  defs.appendChild(g);
  return defs;
}

/*
 * Tiny trend line for KPI tiles. values: number[]
 */
function sparkline(container, values, color = 'var(--accent)') {
  container.innerHTML = '';
  if (values.length < 2) return;
  const w = 200, h = 44, pad = 4;
  const max = Math.max(...values) || 1;
  const min = Math.min(...values);
  const range = max - min || 1;
  const x = i => (i / (values.length - 1)) * w;
  const y = v => pad + (h - pad * 2) * (1 - (v - min) / range);
  const svg = svgEl('svg', { viewBox: `0 0 ${w} ${h}`, preserveAspectRatio: 'none', 'aria-hidden': 'true' });
  const line = values.map((v, i) => (i ? 'L' : 'M') + x(i) + ' ' + y(v)).join(' ');
  const defs = areaGradient(svg, color, 0.35);
  svg.appendChild(defs);
  svg.appendChild(svgEl('path', { d: line + ` L${w} ${h} L0 ${h} Z`, fill: `url(#${defs.firstChild.id})` }));
  svg.appendChild(svgEl('path', { d: line, fill: 'none', stroke: color, 'stroke-width': 2, 'vector-effect': 'non-scaling-stroke', 'stroke-linejoin': 'round', 'stroke-linecap': 'round' }));
  container.appendChild(svg);
}

function makeTooltip(container) {
  let tip = container.querySelector('.tooltip');
  if (!tip) {
    tip = document.createElement('div');
    tip.className = 'tooltip';
    container.appendChild(tip);
  }
  return {
    show(html, x, y) {
      tip.innerHTML = html;
      tip.classList.add('show');
      const w = tip.offsetWidth;
      const h = tip.offsetHeight;
      const maxX = container.clientWidth - w;
      tip.style.left = Math.max(0, Math.min(maxX, x - w / 2)) + 'px';
      tip.style.top = Math.max(-h, y - h - 12) + 'px';
    },
    hide() { tip.classList.remove('show'); }
  };
}

/*
 * Area/line chart for one series over time.
 * points: [{ label, value, tip }]  color: CSS color
 */
function lineChart(container, points, opts = {}) {
  const color = opts.color || 'var(--accent)';
  const height = opts.height || 240;
  const fmt = opts.format || (v => v);
  container.innerHTML = '';

  if (!points.length || points.every(p => !p.value)) {
    container.innerHTML = '<div class="chart-empty">No data for this range</div>';
    return;
  }

  const width = container.clientWidth || 600;
  const m = { top: 16, right: 16, bottom: 28, left: 44 };
  const iw = width - m.left - m.right;
  const ih = height - m.top - m.bottom;
  const max = niceMax(Math.max(...points.map(p => p.value)) * 1.1);
  const x = i => m.left + (points.length === 1 ? iw / 2 : (i / (points.length - 1)) * iw);
  const y = v => m.top + ih - (v / max) * ih;

  const svg = svgEl('svg', { viewBox: `0 0 ${width} ${height}`, height, role: 'img', 'aria-label': opts.label || 'Line chart' });

  // gridlines + y ticks
  const ticks = 4;
  for (let t = 0; t <= ticks; t++) {
    const v = (max / ticks) * t;
    const yy = y(v);
    svg.appendChild(svgEl('line', { x1: m.left, x2: width - m.right, y1: yy, y2: yy, class: t === 0 ? 'baseline' : 'gridline' }));
    const txt = svgEl('text', { x: m.left - 8, y: yy + 4, 'text-anchor': 'end', class: 'tick' });
    txt.textContent = fmtNum(v);
    svg.appendChild(txt);
  }

  // x labels (thinned so they never collide)
  const every = Math.max(1, Math.ceil(points.length / Math.max(2, Math.floor(iw / 70))));
  points.forEach((p, i) => {
    if (i % every !== 0 && i !== points.length - 1) return;
    if (i !== points.length - 1 && points.length - 1 - i < every) return;
    const txt = svgEl('text', { x: x(i), y: height - 8, 'text-anchor': 'middle', class: 'tick' });
    txt.textContent = p.label;
    svg.appendChild(txt);
  });

  // area + line
  const linePath = points.map((p, i) => (i ? 'L' : 'M') + x(i) + ' ' + y(p.value)).join(' ');
  const areaPath = linePath + ` L${x(points.length - 1)} ${y(0)} L${x(0)} ${y(0)} Z`;
  const defs = areaGradient(svg, color, 0.28);
  svg.appendChild(defs);
  svg.appendChild(svgEl('path', { d: areaPath, fill: `url(#${defs.firstChild.id})`, stroke: 'none' }));
  svg.appendChild(svgEl('path', { d: linePath, fill: 'none', stroke: color, 'stroke-width': 2, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' }));

  // end dot + end label
  const li = points.length - 1;
  svg.appendChild(svgEl('circle', { cx: x(li), cy: y(points[li].value), r: 4, fill: color, stroke: 'var(--surface)', 'stroke-width': 2 }));

  // hover layer
  const cross = svgEl('line', { y1: m.top, y2: m.top + ih, class: 'crosshair', visibility: 'hidden' });
  const dot = svgEl('circle', { r: 5, fill: color, stroke: 'var(--surface)', 'stroke-width': 2, visibility: 'hidden' });
  svg.appendChild(cross);
  svg.appendChild(dot);
  const hit = svgEl('rect', { x: m.left, y: m.top, width: iw, height: ih, fill: 'transparent' });
  svg.appendChild(hit);

  container.appendChild(svg);
  const tip = makeTooltip(container);

  function onMove(e) {
    const rect = svg.getBoundingClientRect();
    const px = (e.clientX - rect.left) * (width / rect.width);
    let i = points.length === 1 ? 0 : Math.round(((px - m.left) / iw) * (points.length - 1));
    i = Math.max(0, Math.min(points.length - 1, i));
    const p = points[i];
    cross.setAttribute('x1', x(i));
    cross.setAttribute('x2', x(i));
    dot.setAttribute('cx', x(i));
    dot.setAttribute('cy', y(p.value));
    cross.setAttribute('visibility', 'visible');
    dot.setAttribute('visibility', 'visible');
    const scale = rect.width / width;
    tip.show(`<div class="t-title">${p.tip || p.label}</div><div class="t-val">${fmt(p.value)}</div>`,
      x(i) * scale, y(p.value) * scale);
  }

  function onLeave() {
    cross.setAttribute('visibility', 'hidden');
    dot.setAttribute('visibility', 'hidden');
    tip.hide();
  }

  hit.addEventListener('mousemove', onMove);
  hit.addEventListener('mouseleave', onLeave);
}

/*
 * Horizontal bar chart (direct-labeled).
 * rows: [{ label, value, display, color, tip }]
 */
function barChart(container, rows, opts = {}) {
  container.innerHTML = '';
  if (!rows.length || rows.every(r => !r.value)) {
    container.innerHTML = '<div class="chart-empty" style="height:160px">No data for this range</div>';
    return;
  }
  const max = Math.max(...rows.map(r => r.value)) || 1;
  const wrap = document.createElement('div');
  wrap.className = 'hbars';
  wrap.innerHTML = rows.map((r, i) => `
    <div class="hbar" data-i="${i}">
      <div class="lbl">${r.labelHTML || escapeHTML(r.label)}</div>
      <div class="track"><div class="fill" style="width:${(r.value / max) * 100}%;--c:${r.color || opts.color || 'var(--accent)'}"></div></div>
      <div class="val">${r.display}</div>
    </div>`).join('');
  container.appendChild(wrap);

  const tip = makeTooltip(container);
  wrap.querySelectorAll('.hbar').forEach(row => {
    const r = rows[+row.dataset.i];
    row.addEventListener('mousemove', e => {
      const rect = container.getBoundingClientRect();
      tip.show(r.tip || `<div class="t-val">${r.display}</div>`, e.clientX - rect.left, row.offsetTop);
    });
    row.addEventListener('mouseleave', tip.hide);
  });
}
