const state = {
  members: [],
  sortKey: 'missed',
  sortDir: 'desc',
  q: '',
  filter: 'all',
  page: document.body.dataset.page || 'war',
};

function num(v) { const n = Number(v); return Number.isFinite(n) ? n : 0; }

function actionClass(action) {
  const a = (action || '').toLowerCase();
  if (!a || a === 'ok') return 'ok';
  if (a.includes('demote') || a.includes('kick')) return 'bad';
  return 'warn';
}

function dayVal(v) {
  if (v === '' || v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function renderStats(members) {
  const atRisk = members.filter(m => (m.action || '').toLowerCase() !== 'ok' && m.action).length;
  const missed = members.filter(m => num(m.missed) > 0).length;
  const avgEff = members.length
    ? (members.reduce((s, m) => s + num(m.efficiency), 0) / members.length)
    : 0;
  const el = document.getElementById('stats');
  if (!el) return;
  el.innerHTML = `
    <div class="stat"><div class="label">Roster</div><div class="value">${members.length}</div></div>
    <div class="stat"><div class="label">Missed this war</div><div class="value">${missed}</div></div>
    <div class="stat"><div class="label">At risk</div><div class="value">${atRisk}</div></div>
    <div class="stat"><div class="label">Avg efficiency</div><div class="value">${avgEff.toFixed(1)}</div></div>
  `;
}

function filtered() {
  let rows = [...state.members];
  const q = state.q.trim().toLowerCase();
  if (q) rows = rows.filter(m => (m.name || '').toLowerCase().includes(q) || (m.tag || '').toLowerCase().includes(q));
  if (state.filter === 'missed') rows = rows.filter(m => num(m.missed) > 0);
  if (state.filter === 'risk') rows = rows.filter(m => (m.action || '').toLowerCase() !== 'ok' && m.action);
  if (state.page === 'efficiency') {
    // keep all after search/filter
  }
  if (state.page === 'risk') {
    rows = rows.filter(m => (m.action || '').toLowerCase() !== 'ok' && m.action);
  }
  const key = state.sortKey;
  const dir = state.sortDir === 'asc' ? 1 : -1;
  rows.sort((a, b) => {
    let av = a[key], bv = b[key];
    if (['missed','efficiency','contribution','fame','rank','daysInClan'].includes(key)) {
      av = num(av); bv = num(bv);
      return (av - bv) * dir;
    }
    av = String(av ?? ''); bv = String(bv ?? '');
    return av.localeCompare(bv) * dir;
  });
  return rows;
}

function dayCell(v) {
  const n = dayVal(v);
  if (n == null) return `<td class="daycell ok mono">—</td>`;
  if (n > 0) return `<td class="daycell miss mono">${n}</td>`;
  return `<td class="daycell ok mono">0</td>`;
}

function renderTable() {
  const tbody = document.getElementById('tbody');
  if (!tbody) return;
  const rows = filtered();
  if (!rows.length) {
    tbody.innerHTML = '';
    document.getElementById('empty').hidden = false;
    return;
  }
  document.getElementById('empty').hidden = true;
  if (state.page === 'efficiency') {
    tbody.innerHTML = rows.map(m => `
      <tr>
        <td><div class="name">${esc(m.name)}</div><div class="role">${esc(m.role)} · ${esc(m.tag)}</div></td>
        <td class="mono">${num(m.efficiency).toFixed(1)}</td>
        <td class="mono">${num(m.contribution).toFixed(1)}</td>
        <td class="mono">${m.rank || '—'}</td>
        <td class="mono">${esc(m.thisWeek)}</td>
        <td class="mono">${esc(m.lastWeek)}</td>
      </tr>`).join('');
    return;
  }
  if (state.page === 'risk') {
    tbody.innerHTML = rows.map(m => `
      <tr>
        <td><div class="name">${esc(m.name)}</div><div class="role">${esc(m.role)}</div></td>
        <td><span class="badge ${actionClass(m.action)}">${esc(m.action || '—')}</span></td>
        <td class="mono">${num(m.missed).toFixed(0)}</td>
        <td>${esc(m.reason || '—')}</td>
        <td class="mono">${num(m.efficiency).toFixed(1)}</td>
      </tr>`).join('');
    return;
  }
  // war
  tbody.innerHTML = rows.map(m => `
    <tr>
      <td><div class="name">${esc(m.name)}</div><div class="role">${esc(m.role)}</div></td>
      <td class="mono">${num(m.missed).toFixed(0)}</td>
      ${dayCell(m.d1)}${dayCell(m.d2)}${dayCell(m.d3)}${dayCell(m.d4)}
      <td><span class="badge ${actionClass(m.action)}">${esc(m.action || 'OK')}</span></td>
      <td class="mono">${num(m.efficiency).toFixed(1)}</td>
    </tr>`).join('');
}

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

function setSort(key) {
  if (state.sortKey === key) state.sortDir = state.sortDir === 'asc' ? 'desc' : 'asc';
  else { state.sortKey = key; state.sortDir = ['name','role','action'].includes(key) ? 'asc' : 'desc'; }
  document.querySelectorAll('th[data-sort]').forEach(th => {
    th.classList.toggle('sorted', th.dataset.sort === state.sortKey);
  });
  renderTable();
}

async function boot() {
  const res = await fetch('data/clandata.json', { cache: 'no-store' });
  const data = await res.json();
  state.members = data.members || [];
  const updated = document.getElementById('updated');
  if (updated) updated.textContent = data.updated ? `Data: ${data.updated}` : '';
  if (state.page === 'efficiency') { state.sortKey = 'efficiency'; state.sortDir = 'desc'; }
  if (state.page === 'risk') { state.sortKey = 'missed'; state.sortDir = 'desc'; }
  renderStats(state.members);
  renderTable();
  document.getElementById('search')?.addEventListener('input', e => { state.q = e.target.value; renderTable(); });
  document.getElementById('filter')?.addEventListener('change', e => { state.filter = e.target.value; renderTable(); });
  document.querySelectorAll('th[data-sort]').forEach(th => th.addEventListener('click', () => setSort(th.dataset.sort)));
}

boot().catch(err => {
  const empty = document.getElementById('empty');
  if (empty) { empty.hidden = false; empty.textContent = 'Could not load data/clandata.json'; }
  console.error(err);
});
