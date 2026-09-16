const state = {
  members: [],
  sortKey: 'missed',
  sortDir: 'desc',
  q: '',
  filter: 'all',
  page: document.body.dataset.page || 'war',
  dayCardsLoaded: false,
};

function num(v) { const n = Number(v); return Number.isFinite(n) ? n : 0; }

function shortAction(action) {
  const a = (action || 'OK').trim();
  if (!a || a.toUpperCase() === 'OK') return 'OK';
  if (/^kick$/i.test(a)) return 'Kick';
  if (/flag for removal/i.test(a)) return 'Kick';
  if (/^demote/i.test(a)) return 'Demote';
  if (/^promote to /i.test(a)) return 'Promote';
  if (/fast-track/i.test(a)) return 'Fast-Track';
  return a;
}

function isTruthyFlag(v) {
  if (v === true || v === 1) return true;
  const s = String(v ?? '').trim().toLowerCase();
  return s === 'true' || s === 'yes' || s === '1' || s === 'checked';
}

/** Card Status from script only — never invent from Eff/Fame. Supports Yellow+OrangeN. */
function parseCardStatus(raw) {
  const s = String(raw ?? '').trim();
  if (!s) return { kind: 'empty' };
  if (/^OK$/i.test(s)) return { kind: 'ok' };
  if (/^Kick$/i.test(s)) return { kind: 'kick' };
  if (/^Demote$/i.test(s)) return { kind: 'demote' };
  const compound = s.match(/^Yellow\s*\+\s*Orange([1-3])$/i);
  if (compound) return { kind: 'compound', orange: parseInt(compound[1], 10) };
  if (/^Yellow$/i.test(s)) return { kind: 'yellow' };
  const orange = s.match(/^Orange([1-3])$/i);
  if (orange) return { kind: 'orange', orange: parseInt(orange[1], 10) };
  return { kind: 'unknown', raw: s };
}

function isAtRiskMember(m) {
  // Prefer flags — catches Yellow+Orange2 without exact-match bugs
  if (isTruthyFlag(m.yellowActive)) return true;
  if (num(m.orangeStreak) > 0) return true;
  const s = String(m.status ?? '').trim();
  if (/Kick|Demote|Yellow|Orange/i.test(s)) return true;
  // Demotions/kicks no longer live in Suggested Action — ignore it here
  return false;
}

function tipParts(m, parsed) {
  const reason = String(m.statusReason || '').trim();
  const roleAfter = String(m.roleAfter || '').trim();
  const notified = isTruthyFlag(m.pendingNotice);
  const parts = [];
  if (parsed.kind === 'yellow') parts.push('Yellow');
  else if (parsed.kind === 'orange') parts.push(`Orange ${parsed.orange}`);
  else if (parsed.kind === 'compound') parts.push(`Yellow + Orange ${parsed.orange}`);
  else if (parsed.kind === 'demote') parts.push(roleAfter ? `Demote → ${roleAfter}` : 'Demote');
  else if (parsed.kind === 'kick') parts.push('Kick');
  else if (parsed.kind === 'unknown') parts.push(parsed.raw);
  if (reason) parts.push(reason);
  if (notified) parts.push('Notified');
  return parts.join(' · ') || 'OK';
}

function wrapTip(inner, tip) {
  const tipAttr = esc(tip);
  if (!tip || tip === 'OK') return inner;
  return `<span class="has-tip" tabindex="0" role="button" aria-expanded="false" title="${tipAttr}" data-tip="${tipAttr}">${inner}</span>`;
}

function tilesHtml(kind, count) {
  const n = Math.max(1, Math.min(3, count));
  return Array.from({ length: n }, () => `<span class="card-tile ${kind}"></span>`).join('');
}

function actionBadge(m) {
  const parsed = parseCardStatus(m.status);
  const tip = tipParts(m, parsed);
  const notified = isTruthyFlag(m.pendingNotice);

  if (parsed.kind === 'compound') {
    const inner = `<span class="action-cards">${tilesHtml('yellow', 1)}${tilesHtml('orange', parsed.orange)}</span>`;
    return wrapTip(inner, tip);
  }
  if (parsed.kind === 'orange') {
    return wrapTip(`<span class="action-cards">${tilesHtml('orange', parsed.orange)}</span>`, tip);
  }
  if (parsed.kind === 'yellow') {
    return wrapTip(`<span class="action-cards">${tilesHtml('yellow', 1)}</span>`, tip);
  }
  if (parsed.kind === 'kick') {
    const label = 'Kick' + (notified ? ' · N' : '');
    return wrapTip(`<span class="badge bad">${esc(label)}</span>`, tip);
  }
  if (parsed.kind === 'demote') {
    const label = 'Demote' + (notified ? ' · N' : '');
    return wrapTip(`<span class="badge bad">${esc(label)}</span>`, tip);
  }

  // Card Status OK/empty: promotions live only in Suggested Action now
  const promo = String(m.action ?? '').trim();
  if (promo && !/^OK$/i.test(promo) && /promote|fast-track/i.test(promo)) {
    const promoTip = [shortAction(promo), String(m.reason || '').trim(), notified ? 'Notified' : '']
      .filter(Boolean).join(' · ');
    const label = shortAction(promo) + (notified ? ' · N' : '');
    return wrapTip(`<span class="badge ${actionClass(promo)}">${esc(label)}</span>`, promoTip || promo);
  }

  const label = 'OK' + (notified ? ' · N' : '');
  if (notified) return wrapTip(`<span class="badge ok">${esc(label)}</span>`, 'Notified');
  return `<span class="badge ok">OK</span>`;
}

function bindActionTips() {
  const tbody = document.getElementById('tbody');
  if (!tbody || tbody.dataset.tipsBound === '1') return;
  tbody.dataset.tipsBound = '1';
  tbody.addEventListener('click', (e) => {
    const badge = e.target.closest('.has-tip');
    if (!badge) return;
    e.preventDefault();
    const open = badge.classList.contains('open');
    tbody.querySelectorAll('.has-tip.open').forEach((el) => {
      el.classList.remove('open');
      el.setAttribute('aria-expanded', 'false');
    });
    if (!open) {
      badge.classList.add('open');
      badge.setAttribute('aria-expanded', 'true');
    }
  });
  document.addEventListener('click', (e) => {
    if (e.target.closest('.has-tip')) return;
    tbody.querySelectorAll('.has-tip.open').forEach((el) => {
      el.classList.remove('open');
      el.setAttribute('aria-expanded', 'false');
    });
  });
}

function actionClass(action) {
  const a = (action || '').toLowerCase();
  if (!a || a === 'ok') return 'ok';
  if (a.includes('promote') || a.includes('fast-track')) return 'ok';
  if (a.includes('demote') || a.includes('kick') || a.includes('removal')) return 'bad';
  return 'warn';
}

function dayVal(v) {
  if (v === '' || v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function renderStats(members) {
  const atRisk = members.filter(isAtRiskMember).length;
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
  if (state.filter === 'risk') rows = rows.filter(isAtRiskMember);
  if (state.page === 'efficiency') {
    // keep all after search/filter
  }
  if (state.page === 'risk') {
    rows = rows.filter(isAtRiskMember);
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

function dayChip(v) {
  const n = dayVal(v);
  if (n == null) return `<span class="dchip mut">—</span>`;
  if (n > 0) return `<span class="dchip miss">${n}</span>`;
  return `<span class="dchip ok">0</span>`;
}

function daysCompactCell(m) {
  const chips = [m.d1, m.d2, m.d3, m.d4].map(dayChip).join('<span class="ddot">·</span>');
  return `<td class="days-compact mono">${chips}</td>`;
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
        <td>${actionBadge(m)}</td>
        <td class="mono">${num(m.missed).toFixed(0)}</td>
        <td>${esc(m.reason || '—')}</td>
        <td class="mono">${num(m.efficiency).toFixed(1)}</td>
      </tr>`).join('');
    bindActionTips();
    return;
  }
  // war — compact war days + in-clan / all-time fame
  tbody.innerHTML = rows.map(m => `
    <tr>
      <td><div class="name">${esc(m.name)}</div><div class="role">${esc(m.role)}</div></td>
      <td class="mono">${num(m.missed).toFixed(0)}</td>
      ${daysCompactCell(m)}
      <td>${actionBadge(m)}</td>
      <td class="mono">${num(m.daysInClan).toFixed(0)}</td>
      <td class="mono">${num(m.fame).toLocaleString()}</td>
      <td class="col-eff mono">${num(m.efficiency).toFixed(1)}</td>
    </tr>`).join('');
  bindActionTips();
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

// Live ClanData tab (same Sheet Softr reads). gviz CSV allows CORS from GitHub Pages.
const SHEET_ID = '1ffsk-7UxvODOG8YHL7Cnqe_Zxu2iIrzPR7Fxqi8p-9U';
const SHEET_GID = '0';
const SHEET_CSV_URL =
  `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&gid=${SHEET_GID}`;
const DAILY_SUMMARY_GID = '616046757';
const DAILY_SUMMARY_CSV_URL =
  `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&gid=${DAILY_SUMMARY_GID}`;
const BATTLE_DAY_LABELS = ['Thu', 'Fri', 'Sat', 'Sun'];

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    const next = text[i + 1];
    if (inQuotes) {
      if (c === '"' && next === '"') { cell += '"'; i++; }
      else if (c === '"') { inQuotes = false; }
      else { cell += c; }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ',') {
      row.push(cell); cell = '';
    } else if (c === '\n') {
      row.push(cell); rows.push(row); row = []; cell = '';
    } else if (c === '\r') {
      // skip
    } else {
      cell += c;
    }
  }
  if (cell.length || row.length) { row.push(cell); rows.push(row); }
  return rows.filter(r => r.some(x => String(x).trim() !== ''));
}

function sheetRowsToMembers(csvText) {
  const grid = parseCsv(csvText);
  if (grid.length < 2) return [];
  const headers = grid[0].map(h => String(h).trim());
  // Card Status only — never fall back to legacy "Status" (quietly wrong cards).
  if (headers.indexOf('Card Status') < 0) {
    throw new Error('Missing required column: Card Status');
  }
  const idx = (name) => headers.indexOf(name);
  const get = (cells, name) => {
    const i = idx(name);
    return i >= 0 ? String(cells[i] ?? '').trim() : '';
  };
  return grid.slice(1).map(cells => ({
    tag: get(cells, 'Player Tag'),
    name: get(cells, 'Name'),
    role: get(cells, 'Role'),
    missed: num(get(cells, 'Missed Attacks')),
    d1: get(cells, 'Day 1 Missed'),
    d2: get(cells, 'Day 2 Missed'),
    d3: get(cells, 'Day 3 Missed'),
    d4: get(cells, 'Day 4 Missed'),
    action: get(cells, 'Suggested Action'),
    reason: get(cells, 'Reason'),
    status: get(cells, 'Card Status'),
    statusReason: get(cells, 'Status Reason'),
    roleAfter: get(cells, 'Role After'),
    yellowActive: get(cells, 'Yellow Active'),
    yellowCleanStreak: num(get(cells, 'Yellow Clean Streak')),
    streakWeeks: num(get(cells, 'Streak Weeks')),
    orangeStreak: num(get(cells, 'Orange Streak')),
    efficiency: num(get(cells, 'Attack Efficiency')),
    contribution: num(get(cells, 'Contribution Score')),
    rank: num(get(cells, 'Contribution Rank')),
    thisWeek: get(cells, 'This Week Summary'),
    lastWeek: get(cells, 'Last Week Summary'),
    fame: num(get(cells, 'All-Time Fame')),
    daysInClan: num(get(cells, 'Days in Clan')),
    pendingNotice: get(cells, 'Pending Notice'),
  })).filter(m => m.name || m.tag);
}


function defaultDayCards() {
  return BATTLE_DAY_LABELS.map((label, i) => ({
    order: i + 1,
    label,
    perfect: 0,
    total: 0,
    summary: `${label}: —`,
    empty: true,
  }));
}

function parseDailySummary(csvText) {
  const grid = parseCsv(csvText);
  if (grid.length < 2) return null;
  const headers = grid[0].map(h => String(h).trim());
  const idx = (name) => headers.indexOf(name);
  const get = (cells, name) => {
    const i = idx(name);
    return i >= 0 ? String(cells[i] ?? '').trim() : '';
  };
  const byOrder = {};
  for (const cells of grid.slice(1)) {
    const order = num(get(cells, 'Day Order')) || 0;
    if (!order) continue;
    const label = get(cells, 'Day Label') || BATTLE_DAY_LABELS[order - 1] || `Day ${order}`;
    const perfect = num(get(cells, 'Perfect'));
    const total = num(get(cells, 'Total'));
    let summary = get(cells, 'Summary');
    const empty = total <= 0 || !summary || summary.endsWith('—') || summary.includes(': —');
    if (!summary) {
      summary = empty ? `${label}: —` : `${label}: ${perfect} perfect attacks out of ${total} members`;
    }
    byOrder[order] = { order, label, perfect, total, summary, empty };
  }
  return BATTLE_DAY_LABELS.map((label, i) => {
    const order = i + 1;
    return byOrder[order] || { order, label, perfect: 0, total: 0, summary: `${label}: —`, empty: true };
  });
}

function dayCardsFromMembers(members) {
  const dayKeys = ['d1', 'd2', 'd3', 'd4'];
  return BATTLE_DAY_LABELS.map((label, i) => {
    const key = dayKeys[i];
    const settled = members.filter(m => dayVal(m[key]) != null);
    if (!settled.length) {
      return { order: i + 1, label, perfect: 0, total: 0, summary: `${label}: —`, empty: true };
    }
    const perfect = settled.filter(m => dayVal(m[key]) === 0).length;
    const total = settled.length;
    return {
      order: i + 1,
      label,
      perfect,
      total,
      summary: `${label}: ${perfect} perfect attacks out of ${total} members`,
      empty: false,
    };
  });
}

function renderDayCards(cards) {
  const el = document.getElementById('daycards');
  if (!el) return;
  const list = cards && cards.length ? cards : defaultDayCards();
  el.innerHTML = list.map(c => {
    const cls = c.empty ? 'daycard empty' : 'daycard live';
    // Day label is already in .day — don't repeat "Thu:" in the body line
    let line;
    if (c.empty) {
      line = '—';
    } else {
      line = `<span class="em">${c.perfect}</span> perfect attacks out of ${c.total} members`;
    }
    return `<div class="${cls}"><div class="day">${esc(c.label)}</div><div class="line">${line}</div></div>`;
  }).join('');
}

async function loadDailySummaryCards() {
  const res = await fetch(DAILY_SUMMARY_CSV_URL, { cache: 'no-store' });
  if (!res.ok) throw new Error(`DailySummary HTTP ${res.status}`);
  const text = await res.text();
  if (!text.includes('Day Label') && !text.includes('Summary')) {
    throw new Error('DailySummary response unexpected');
  }
  const cards = parseDailySummary(text);
  if (!cards) throw new Error('DailySummary parse failed');
  renderDayCards(cards);
  return cards;
}

function setUpdatedLabel(text) {
  const updated = document.getElementById('updated');
  if (updated) updated.textContent = text;
}

function applyMembers(members, label) {
  state.members = members;
  setUpdatedLabel(label);
  if (state.page === 'efficiency') { state.sortKey = 'efficiency'; state.sortDir = 'desc'; }
  if (state.page === 'risk') { state.sortKey = 'missed'; state.sortDir = 'desc'; }
  renderStats(state.members);
  renderTable();
  // War page only: if DailySummary hasn't painted yet, derive chips from Day 1–4 columns.
  if (document.getElementById('daycards') && !state.dayCardsLoaded) {
    renderDayCards(dayCardsFromMembers(members));
  }
}

async function loadLiveSheet() {
  const res = await fetch(SHEET_CSV_URL, { cache: 'no-store' });
  if (!res.ok) throw new Error(`Sheet HTTP ${res.status}`);
  const text = await res.text();
  if (!text.includes('Player Tag') && !text.includes('Name')) {
    throw new Error('Sheet response did not look like ClanData CSV');
  }
  const members = sheetRowsToMembers(text);
  if (!members.length) throw new Error('Sheet CSV parsed to 0 members');
  const when = new Date().toLocaleString(undefined, {
    month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
  });
  applyMembers(members, `Live from Sheet · ${when}`);
}

async function loadFallbackJson() {
  const res = await fetch('data/clandata.json', { cache: 'no-store' });
  const data = await res.json();
  applyMembers(data.members || [], data.updated
    ? `Cached snapshot · ${data.updated}`
    : 'Cached snapshot (Sheet unreachable)');
}

async function boot() {
  setUpdatedLabel('Loading live Sheet…');
  const empty = document.getElementById('empty');
  if (empty) { empty.hidden = true; }
  if (document.getElementById('daycards')) {
    renderDayCards(defaultDayCards());
  }

  const sheetPromise = loadLiveSheet().catch(async (err) => {
    const msg = String(err && err.message ? err.message : err);
    // Missing Card Status: fail loudly — never read another column or hide behind cache.
    if (msg.includes('Card Status')) {
      console.error(err);
      if (empty) {
        empty.hidden = false;
        empty.textContent = 'Data unavailable — Sheet is missing the Card Status column.';
      }
      setUpdatedLabel('Data unavailable');
      return;
    }
    console.warn('Live Sheet failed, falling back to cached JSON', err);
    try {
      await loadFallbackJson();
    } catch (err2) {
      console.error(err2);
      if (empty) {
        empty.hidden = false;
        empty.textContent = 'Data unavailable — could not load live Sheet or cached data.';
      }
      setUpdatedLabel('Data unavailable');
    }
  });

  const daysPromise = document.getElementById('daycards')
    ? loadDailySummaryCards()
        .then(() => { state.dayCardsLoaded = true; })
        .catch((err) => {
          console.warn('DailySummary failed; using Day 1–4 from ClanData', err);
          if (state.members.length) renderDayCards(dayCardsFromMembers(state.members));
        })
    : Promise.resolve();

  await Promise.all([sheetPromise, daysPromise]);

  document.getElementById('search')?.addEventListener('input', e => { state.q = e.target.value; renderTable(); });
  document.getElementById('filter')?.addEventListener('change', e => { state.filter = e.target.value; renderTable(); });
  document.querySelectorAll('th[data-sort]').forEach(th => th.addEventListener('click', () => setSort(th.dataset.sort)));
}

boot();
