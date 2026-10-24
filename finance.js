'use strict';
/* =====================================================================
   HUB · FINANCE app — expenses, dashboard, history, refunds
   ===================================================================== */

/* ---------------- Defaults ---------------- */
const WORK_SUBS = ['Team food', 'Subscriptions & tools', 'Team activities', 'Work transport', 'Office supplies', 'Courses & learning', 'Client & gifts'];
const DEFAULT_CATS = [
  ['Food', '🍽️', 'c2', ['Groceries', 'Restaurants', 'Coffee & snacks', 'Delivery']],
  ['Transport', '🚗', 'c1', ['Fuel', 'Taxi', 'Car maintenance']],
  ['Bills', '🧾', 'c4', ['Electricity', 'Generator', 'Internet', 'Phone', 'Water']],
  ['Home', '🏠', 'c3', ['Rent', 'Household items', 'Repairs']],
  ['Shopping', '🛍️', 'c5', ['Clothes', 'Electronics', 'Other']],
  ['Health', '💊', 'c6', ['Pharmacy', 'Doctor']],
  ['Entertainment', '🎮', 'c7', ['Outings', 'Subscriptions', 'Games']],
  ['Family & gifts', '🎁', 'c8', ['Gifts', 'Family support']],
  ['Work', '💼', 'c7', WORK_SUBS],
  ['Other', '📦', 'gray', []],
];
const makeDefaultCats = () => DEFAULT_CATS.map(([name, icon, color, subs], i) => ({
  id: 'cat_' + name.toLowerCase().replace(/[^a-z]+/g, '_'), name, icon, color, order: i, hidden: false, budget: 0,
  subs: subs.map(s => ({ id: 'sub_' + uid(), name: s, hidden: false })),
}));
const DEFAULT_SETTINGS = { currency: 'IQD', sep: ',', weekStart: 6, defaultMethod: 'last', budget: 0 };
const CUR = { IQD: { dec: 0, sym: 'IQD', pre: false }, USD: { dec: 2, sym: '$', pre: true } };

/* ---------------- State ---------------- */
const S = {
  expenses: [], cats: [], settings: { ...DEFAULT_SETTINGS }, meta: {},
  add: { amount: '', catId: null, subId: null, method: 'cash', date: today() },
  dash: { period: 'month', anchor: today(), from: addDays(today(), -29), to: today(), drill: null },
  hist: { q: '', status: '', cat: '', sub: '', method: '', range: 'all', from: '', to: '', min: '', max: '', limit: 150 },
  tab: 'add',
};

/* ---------------- Storage ---------------- */
const putExpenses = list => storePut('expenses', list);
const delExpense = id => storeDel('expenses', id);
const clearExpenses = () => storeClear('expenses');
const saveCats = () => kvSet('categories', S.cats);
const saveSettings = () => kvSet('settings', S.settings);
const saveMeta = () => kvSet('meta', S.meta);

/* ---------------- Money ---------------- */
const cur = () => CUR[S.settings.currency] || CUR.IQD;
function groupInt(i) { const sep = S.settings.sep === ' ' ? ' ' : S.settings.sep; return i.replace(/\B(?=(\d{3})+(?!\d))/g, sep); }
function fmtNum(minor) {
  const c = cur(); const neg = minor < 0; const v = Math.abs(minor) / 10 ** c.dec;
  let [i, f] = v.toFixed(c.dec).split('.');
  const s = groupInt(i) + (f ? (S.settings.sep === '.' ? ',' : '.') + f : '');
  return (neg ? '−' : '') + s;
}
function fmt(minor) { const c = cur(); return c.pre ? c.sym + fmtNum(minor) : fmtNum(minor) + ' ' + c.sym; }
function compact(minor) {
  const x = Math.abs(minor) / 10 ** cur().dec; let s;
  if (x >= 1e6) s = +(x / 1e6).toFixed(x >= 1e7 ? 0 : 1) + 'M';
  else if (x >= 1e3) s = +(x / 1e3).toFixed(x >= 1e4 ? 0 : 1) + 'K';
  else s = String(Math.round(x));
  return (cur().pre ? cur().sym : '') + s;
}
const toMinor = str => { const c = cur(); const n = parseFloat(String(str).replace(/[^\d.]/g, '')); return isFinite(n) ? Math.round(n * 10 ** c.dec) : 0; };
const fromMinor = m => { const c = cur(); return c.dec ? (m / 10 ** c.dec).toFixed(c.dec) : String(m); };

/* ---------------- Categories ---------------- */
const catById = id => S.cats.find(c => c.id === id);
const subById = (cat, id) => cat?.subs.find(s => s.id === id);
const sortedCats = (incHidden) => S.cats.filter(c => incHidden || !c.hidden).sort((a, b) => a.order - b.order);
const col = c => `var(--${c?.color || 'gray'})`;
const catName = id => catById(id)?.name || 'Unknown';
const catIcon = id => catById(id)?.icon || '❔';

/* =====================================================================
   ADD SCREEN
   ===================================================================== */
function renderKeypad() {
  const dot = cur().dec ? '.' : '000';   // IQD gets a "000" key, USD gets a decimal point
  $('#keypad').innerHTML = `
    <button class="key" data-k="1">1</button><button class="key" data-k="2">2</button><button class="key" data-k="3">3</button>
    <button class="key fn" data-k="del" aria-label="Delete">⌫</button>
    <button class="key" data-k="4">4</button><button class="key" data-k="5">5</button><button class="key" data-k="6">6</button>
    <button class="key save" data-k="save"><svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="m5 12.5 4.5 4.5L19 7.5"/></svg>Save</button>
    <button class="key" data-k="7">7</button><button class="key" data-k="8">8</button><button class="key" data-k="9">9</button>
    <button class="key fn" data-k="${dot}" style="font-size:${dot === '000' ? 19 : 26}px">${dot}</button><button class="key" data-k="0">0</button><button class="key fn" data-k="clear" style="font-size:15px">C</button>`;
}
function keyPress(k) {
  let a = S.add.amount;
  if (k === 'save') return saveAdd();
  if (k === 'del') a = a.slice(0, -1);
  else if (k === 'clear') a = '';
  else if (k === '.') { if (!a.includes('.')) a = (a || '0') + '.'; }
  else {
    if (a.includes('.') && a.split('.')[1].length >= cur().dec) return;
    if (a.replace('.', '').length >= 12) return;
    if ((a === '' || a === '0') && (k === '0' || k === '000')) { a = ''; }
    else a = (a === '0' ? '' : a) + k;
  }
  S.add.amount = a; renderAmount();
}
function renderAmount() {
  const a = S.add.amount; const el = $('#add-amt');
  let txt = '0';
  if (a) { const [i, f] = a.split('.'); txt = groupInt(i || '0') + (a.includes('.') ? (S.settings.sep === '.' ? ',' : '.') + (f || '') : ''); }
  el.textContent = (cur().pre && a ? cur().sym : '') + txt;
  el.classList.toggle('zero', !a);
  el.style.fontSize = txt.length > 11 ? '34px' : txt.length > 8 ? '40px' : '';
  $('#add-cur').textContent = cur().pre ? '' : cur().sym;
}
function renderAddCats() {
  const cats = sortedCats();
  if (!catById(S.add.catId) || catById(S.add.catId).hidden) S.add.catId = cats[0]?.id || null;
  $('#add-cats').innerHTML = cats.map(c => `
    <button class="cat-tile ${c.id === S.add.catId ? 'on' : ''}" data-cat="${c.id}" style="--c:${col(c)}">
      <span class="cat-ico">${esc(c.icon)}</span><span class="cat-name">${esc(c.name)}</span></button>`).join('');
  renderAddSubs();
}
function renderAddSubs() {
  const c = catById(S.add.catId);
  const subs = (c?.subs || []).filter(s => !s.hidden);
  if (S.add.subId && !subs.find(s => s.id === S.add.subId)) S.add.subId = null;
  $('#add-subs').innerHTML = subs.length ? subs.map(s => `<button class="chip ${s.id === S.add.subId ? 'on' : ''}" data-sub="${s.id}" style="--c:${col(c)}">${esc(s.name)}</button>`).join('')
    : `<span class="sub" style="padding:8px 4px">No subcategories</span>`;
  const card = $('#amount-card'); card.style.setProperty('--cat', col(c));
  const sub = subById(c, S.add.subId);
  $('#add-cat-label').innerHTML = c ? `<span>${esc(c.icon)}</span>${esc(c.name)}${sub ? ' <span class="muted">›</span> ' + esc(sub.name) : ''}` : '';
  // note suggestions: recent notes in this category
  const notes = [...new Set(S.expenses.filter(e => e.catId === S.add.catId && e.note).sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map(e => e.note))].slice(0, 8);
  $('#note-list').innerHTML = notes.map(n => `<option value="${esc(n)}">`).join('');
}
function renderAddDate() {
  const d = S.add.date;
  $('#add-date').value = d;
  $('#add-date-label').textContent = niceDate(d);
  $('#date-chip').classList.toggle('past', d !== today());
}
function renderAddMethod() { $$('#add-method button').forEach(b => b.classList.toggle('on', b.dataset.m === S.add.method)); }
function renderAdd() { renderKeypad(); renderAmount(); renderAddCats(); renderAddDate(); renderAddMethod(); }

async function saveAdd() {
  const amount = toMinor(S.add.amount);
  if (!amount) { shake($('#amount-card')); toast('Type an amount first'); return; }
  if (!S.add.catId) { shake($('#add-cats')); toast('Pick a category'); return; }
  const now = new Date();
  const e = {
    id: uid(), amount, method: S.add.method, catId: S.add.catId, subId: S.add.subId || null,
    note: $('#add-note').value.trim(), date: S.add.date || today(),
    createdAt: now.toISOString(), updatedAt: now.toISOString(),
  };
  await putExpenses([e]); S.expenses.push(e);
  S.meta.lastCat = e.catId; S.meta.lastMethod = e.method; saveMeta();
  requestPersist();
  toast(`✓ Saved ${fmt(amount)} · ${catName(e.catId)}${e.date !== today() ? ' · ' + niceDate(e.date) : ''}`);
  S.add.amount = ''; S.add.subId = null; S.add.date = today(); $('#add-note').value = '';
  renderAmount(); renderAddSubs(); renderAddDate();
}

/* =====================================================================
   DASHBOARD
   ===================================================================== */
function periodRange(p, anchor) {
  const d = parse(anchor);
  if (p === 'week') { const diff = (d.getDay() - S.settings.weekStart + 7) % 7; const from = addDays(anchor, -diff); return { from, to: addDays(from, 6) }; }
  if (p === 'month') return { from: ymd(new Date(d.getFullYear(), d.getMonth(), 1)), to: ymd(new Date(d.getFullYear(), d.getMonth() + 1, 0)) };
  if (p === 'year') return { from: `${d.getFullYear()}-01-01`, to: `${d.getFullYear()}-12-31` };
  let { from, to } = S.dash; if (from > to) [from, to] = [to, from]; return { from, to };
}
function shiftAnchor(p, anchor, dir) {
  const d = parse(anchor);
  if (p === 'week') return addDays(anchor, 7 * dir);
  if (p === 'month') return ymd(new Date(d.getFullYear(), d.getMonth() + dir, 1));
  if (p === 'year') return ymd(new Date(d.getFullYear() + dir, 0, 1));
  return anchor;
}
function prevRange(p, r) {
  if (p === 'custom') { const len = daysBetween(r.from, r.to) + 1; return { from: addDays(r.from, -len), to: addDays(r.from, -1) }; }
  return periodRange(p, shiftAnchor(p, r.from, -1));
}
function periodLabel(p, r) {
  const a = parse(r.from), b = parse(r.to);
  if (p === 'month') return `${MONTHS_L[a.getMonth()]} ${a.getFullYear()}`;
  if (p === 'year') return String(a.getFullYear());
  const sameY = a.getFullYear() === b.getFullYear();
  return `${a.getDate()} ${MONTHS[a.getMonth()]}${sameY ? '' : ' ' + a.getFullYear()} – ${b.getDate()} ${MONTHS[b.getMonth()]} ${b.getFullYear()}`;
}
const inRange = (e, r) => e.date >= r.from && e.date <= r.to;
/* Refunds: e.refunded = amount given back (0..amount). Everything counts the NET amount. */
const refundOf = e => Math.min(e.amount, Math.max(0, e.refunded || 0));
const net = e => e.amount - refundOf(e);
const isFullRefund = e => refundOf(e) >= e.amount;
const isRefunded = e => refundOf(e) > 0;
const sum = list => list.reduce((s, e) => s + net(e), 0);

function renderDash() {
  const p = S.dash.period;
  $$('#dash-period button').forEach(b => b.classList.toggle('on', b.dataset.p === p));
  $('#dash-custom').hidden = p !== 'custom';
  $('#dash-nav').style.display = p === 'custom' ? 'none' : '';
  if (p === 'custom') { $('#c-from').value = S.dash.from; $('#c-to').value = S.dash.to; }
  const r = periodRange(p, S.dash.anchor);
  $('#p-label').textContent = periodLabel(p, r);
  $('#p-next').style.visibility = r.to >= today() ? 'hidden' : '';

  // backup banner
  const n = S.expenses.length; const lb = HUB.meta.lastBackup;
  const ago = lb ? daysBetween(ymd(new Date(lb)), today()) : null;
  $('#dash-banner').innerHTML = n && (ago === null || ago > 7) ? `
    <div class="banner"><span class="ico">⚠️</span><div class="grow"><b>${ago === null ? 'No backup yet' : `Last backup ${ago} days ago`}</b><div class="sub">Save a copy to On My iPhone</div></div>
    <button class="btn small primary" data-act="backup">Back up</button></div>` : '';

  const all = S.expenses.filter(e => inRange(e, r));
  const list = all.filter(e => !isFullRefund(e));
  const refundedTotal = all.reduce((s, e) => s + refundOf(e), 0);
  const refundedCount = all.filter(isRefunded).length;
  const total = sum(list);
  const t = today();
  const elapsedTo = t < r.to ? t : r.to;
  const daysElapsed = t < r.from ? 0 : daysBetween(r.from, elapsedTo) + 1;
  const avg = daysElapsed ? Math.round(total / daysElapsed) : 0;

  // comparison: if the period is still running, compare to the same point of the previous period
  const pr = prevRange(p, r);
  let cmpHtml = '';
  const ongoing = t >= r.from && t < r.to;
  const prTo = ongoing ? (addDays(pr.from, daysElapsed - 1) < pr.to ? addDays(pr.from, daysElapsed - 1) : pr.to) : pr.to;
  const prevTotal = sum(S.expenses.filter(e => e.date >= pr.from && e.date <= prTo));
  const curCmp = ongoing ? sum(list.filter(e => e.date <= t)) : total;
  const word = { week: 'week', month: 'month', year: 'year', custom: 'period' }[p];
  const vs = ongoing ? `same point last ${word}` : `last ${word}`;
  if (prevTotal > 0) {
    const pct = Math.round((curCmp - prevTotal) / prevTotal * 100);
    cmpHtml = pct === 0 ? `<div class="pill">＝ Same as ${vs}</div>`
      : `<div class="pill">${pct > 0 ? '▲' : '▼'} ${Math.abs(pct)}% ${pct > 0 ? 'more' : 'less'} than ${vs}</div>`;
  } else if (curCmp > 0) cmpHtml = `<div class="pill">No spending in the previous ${word}</div>`;

  let html = `
  <div class="hero">
    <div class="lbl">Spent · ${esc(periodLabel(p, r))}</div>
    <div class="big">${cur().pre ? esc(cur().sym) + fmtNum(total) : fmtNum(total) + `<small>${esc(cur().sym)}</small>`}</div>
    ${cmpHtml}
    <div class="hero-stats">
      <div class="hero-stat"><b>${list.length}</b><span>expense${list.length !== 1 ? 's' : ''}</span></div>
      <div class="hero-stat"><b>${compact(avg)}</b><span>per day</span></div>
      <div class="hero-stat"><b>${list.length ? compact(Math.max(...list.map(net))) : '–'}</b><span>biggest</span></div>
    </div>
    ${refundedTotal ? `<div class="hero-refund">↩ ${fmt(refundedTotal)} refunded · ${refundedCount} transaction${refundedCount !== 1 ? 's' : ''} <button data-act="hist-refunds">View</button></div>` : ''}
  </div>`;

  html += budgetCard(p, r, list, daysElapsed);

  if (!list.length) {
    html += `<div class="card empty"><div class="e-ico">🧾</div><b>No expenses in this ${word}</b><div class="sub" style="margin-top:4px">Add one from the Add tab and it shows up here.</div></div>`;
    $('#dash-body').innerHTML = html; return;
  }

  html += S.dash.drill ? drillCard(list, r) : categoryCard(list, total);
  html += methodCard(list, total);
  html += trendCard(list, r, p);
  html += topCard(list);
  $('#dash-body').innerHTML = html;
  bindTrend();
}

function budgetCard(p, r, list, daysElapsed) {
  if (p !== 'month') return '';
  const catsWithBudget = sortedCats(true).filter(c => c.budget > 0);
  const B = S.settings.budget;
  if (!B && !catsWithBudget.length) return '';
  const totalDays = daysBetween(r.from, r.to) + 1;
  const pace = Math.min(1, daysElapsed / totalDays);
  const status = (spent, budget) => {
    const f = spent / budget;
    if (f >= 1) return { c: 'var(--bad)', t: '⛔ Over budget' };
    if (f > pace + 0.1 || f >= 0.9) return { c: 'var(--warn)', t: '⚠️ Ahead of pace' };
    return { c: 'var(--good)', t: '✓ On track' };
  };
  let h = `<div class="card"><div class="card-head"><h2>💰 Budget</h2>`;
  if (B) {
    const spent = sum(list); const st = status(spent, B);
    h += `<span class="status" style="--st:${st.c}">${st.t}</span></div>
      <div class="row" style="justify-content:space-between;align-items:baseline"><div><b style="font-size:20px" class="num">${fmtNum(spent)}</b> <span class="sub">of ${fmt(B)}</span></div>
      <div class="sub num">${spent <= B ? fmt(B - spent) + ' left' : fmt(spent - B) + ' over'}</div></div>
      <div class="budget-bar" style="--st:${st.c}"><i style="width:${Math.min(100, spent / B * 100)}%"></i>${pace < 1 && pace > 0 ? `<span class="pace" style="left:${pace * 100}%" title="Today"></span>` : ''}</div>
      <div class="sub">${pace < 1 && pace > 0 ? `The line marks today · ${totalDays - daysElapsed} days left` : ''}</div>`;
  } else h += `</div>`;
  if (catsWithBudget.length) {
    h += `<div class="${B ? 'mini-budget' : ''}">` + catsWithBudget.map(c => {
      const spent = sum(list.filter(e => e.catId === c.id)); const st = status(spent, c.budget);
      return `<div class="row"><span>${esc(c.icon)}</span><span class="grow ellip"><b>${esc(c.name)}</b></span><span class="sub num">${compact(spent)} / ${compact(c.budget)}</span></div>
        <div class="budget-bar" style="--st:${st.c}"><i style="width:${Math.min(100, spent / c.budget * 100)}%"></i></div>`;
    }).join('') + `</div>`;
  }
  return h + `</div>`;
}

function donutSVG(items, total, center) {
  const R = 78, SW = 26, C = 2 * Math.PI * R; const gap = items.length > 1 ? 3 : 0;
  let off = 0;
  const segs = items.map(it => {
    const len = it.v / total * C; const dash = Math.max(0.6, len - gap);
    const s = `<circle class="donut-seg" data-drill="${it.id}" cx="100" cy="100" r="${R}" fill="none" stroke="${it.c}" stroke-width="${SW}"
      stroke-dasharray="${dash} ${C}" stroke-dashoffset="${-off}" transform="rotate(-90 100 100)"><title>${esc(it.name)}: ${fmt(it.v)}</title></circle>`;
    off += len; return s;
  }).join('');
  return `<div class="donut-wrap"><svg viewBox="0 0 200 200" role="img" aria-label="Spending by category">
    <circle cx="100" cy="100" r="${R}" fill="none" stroke="var(--card2)" stroke-width="${SW}"/>${segs}</svg>
    <div class="donut-center">${center}</div></div>`;
}

function categoryCard(list, total) {
  const by = {};
  list.forEach(e => by[e.catId] = (by[e.catId] || 0) + net(e));
  const items = Object.entries(by).map(([id, v]) => { const c = catById(id); return { id, v, name: c?.name || 'Unknown', icon: c?.icon || '❔', c: col(c) }; }).sort((a, b) => b.v - a.v);
  const top = items[0];
  return `<div class="card"><div class="card-head"><h2>📊 By category</h2><span class="sub">Tap for details</span></div>
    ${donutSVG(items, total, `<span>Top: ${esc(top.icon)} ${esc(top.name)}</span><b>${Math.round(top.v / total * 100)}%</b><span>${items.length} categor${items.length > 1 ? 'ies' : 'y'}</span>`)}
    <div class="legend">${items.map(it => {
      const pct = it.v / total * 100;
      return `<button class="leg-row" data-drill="${it.id}" style="--c:${it.c}">
        <span class="cat-ico">${esc(it.icon)}</span>
        <span><span class="leg-name"><span class="dot"></span>${esc(it.name)}</span><span class="leg-bar" style="display:block"><i style="width:${Math.max(2, pct)}%"></i></span></span>
        <span class="leg-amt"><b>${fmtNum(it.v)}</b><span>${pct < 1 ? '<1' : Math.round(pct)}% <span class="chev">›</span></span></span></button>`;
    }).join('')}</div></div>`;
}

function drillCard(list, r) {
  const c = catById(S.dash.drill);
  const L = list.filter(e => e.catId === S.dash.drill);
  const total = sum(L); const all = sum(list);
  const by = {};
  L.forEach(e => { const k = e.subId && subById(c, e.subId) ? e.subId : '_none'; by[k] = (by[k] || 0) + net(e); });
  const items = Object.entries(by).map(([id, v]) => ({ id, v, name: id === '_none' ? 'No subcategory' : subById(c, id).name })).sort((a, b) => b.v - a.v);
  const max = items[0]?.v || 1;
  const recent = [...L].sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt)).slice(0, 5);
  return `<div class="card" style="--c:${col(c)}">
    <div class="card-head"><button class="back-btn" data-act="undrill">‹ All categories</button><span class="sub">${all ? Math.round(total / all * 100) : 0}% of total</span></div>
    <div class="row" style="margin-bottom:14px"><span class="cat-ico" style="width:46px;height:46px;font-size:24px">${esc(c?.icon)}</span>
      <div class="grow"><h2 style="font-size:20px">${esc(c?.name || 'Unknown')}</h2><div class="sub">${L.length} expense${L.length !== 1 ? 's' : ''}</div></div>
      <b style="font-size:20px" class="num">${fmtNum(total)}</b></div>
    ${total ? items.map(it => `
      <div style="margin-bottom:12px"><div class="row" style="justify-content:space-between;font-size:14.5px"><span class="ellip ${it.id === '_none' ? 'muted' : ''}"><b>${esc(it.name)}</b></span>
        <span class="num"><b>${fmtNum(it.v)}</b> <span class="sub">· ${Math.round(it.v / total * 100)}%</span></span></div>
        <div class="leg-bar" style="height:10px;border-radius:5px"><i style="width:${Math.max(2, it.v / max * 100)}%;border-radius:5px;opacity:${it.id === '_none' ? .45 : 1}"></i></div></div>`).join('')
      : `<div class="empty">Nothing in ${esc(c?.name)} this period</div>`}
    ${recent.length ? `<div class="group-title" style="margin:16px 0 4px">Recent</div>` + recent.map(e => `
      <div class="row" style="padding:7px 0;border-top:1px solid var(--line);font-size:14px"><span class="grow ellip">${esc(e.note || subById(c, e.subId)?.name || c.name)}<span class="muted"> · ${shortDate(e.date)}</span></span><b class="num">${fmtNum(net(e))}</b></div>`).join('') : ''}
    <button class="btn block" style="margin-top:12px" data-act="hist-cat" data-cat="${c?.id}">See all in History</button>
  </div>`;
}

function methodCard(list, total) {
  const cash = sum(list.filter(e => e.method === 'cash')); const online = total - cash;
  const nc = list.filter(e => e.method === 'cash').length, no = list.length - nc;
  const pc = total ? Math.round(cash / total * 100) : 0;
  return `<div class="card"><div class="card-head"><h2>💳 Cash vs Online</h2></div>
    <div class="split">${cash ? `<i style="width:${cash / total * 100}%;background:var(--cash)"></i>` : ''}${online ? `<i style="width:${online / total * 100}%;background:var(--online)"></i>` : ''}</div>
    <div class="split-legend">
      <div class="split-item"><div class="t"><span class="dot" style="--c:var(--cash)"></span>💵 Cash</div><b>${fmtNum(cash)}</b><span>${pc}% · ${nc} expense${nc !== 1 ? 's' : ''}</span></div>
      <div class="split-item"><div class="t"><span class="dot" style="--c:var(--online)"></span>💳 Online</div><b>${fmtNum(online)}</b><span>${total ? 100 - pc : 0}% · ${no} expense${no !== 1 ? 's' : ''}</span></div>
    </div></div>`;
}

let trendData = null;
function trendCard(list, r, p) {
  const days = daysBetween(r.from, r.to) + 1; const monthly = days > 62;
  const buckets = [];
  if (!monthly) for (let i = 0; i < days; i++) { const d = addDays(r.from, i); buckets.push({ key: d, v: 0, d }); }
  else {
    let d = parse(r.from); d = new Date(d.getFullYear(), d.getMonth(), 1); const end = parse(r.to);
    while (d <= end) { buckets.push({ key: `${d.getFullYear()}-${pad(d.getMonth() + 1)}`, v: 0, m: new Date(d) }); d = new Date(d.getFullYear(), d.getMonth() + 1, 1); }
  }
  const idx = Object.fromEntries(buckets.map((b, i) => [b.key, i]));
  list.forEach(e => { const k = monthly ? e.date.slice(0, 7) : e.date; if (idx[k] !== undefined) buckets[idx[k]].v += net(e); });
  const t = today();
  const W = 340, H = 170, pl = 36, pr = 4, pt = 12, pb = 22, iw = W - pl - pr, ih = H - pt - pb;
  const maxV = Math.max(1, ...buckets.map(b => b.v));
  const major = maxV / 10 ** cur().dec; const pw = 10 ** Math.floor(Math.log10(major || 1)); const n = major / pw;
  const top = (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * pw * 10 ** cur().dec;
  const n_ = buckets.length; const bw = iw / n_; const barW = Math.max(2, Math.min(28, bw * (n_ > 20 ? 0.62 : 0.56)));
  const y = v => pt + ih - v / top * ih;
  const elapsed = buckets.filter(b => monthly ? b.key <= t.slice(0, 7) : b.key <= t).length || 1;
  const avg = sum(list) / elapsed;
  let grid = '';
  [0, 0.5, 1].forEach(f => { const yy = pt + ih - f * ih; grid += `<line x1="${pl}" x2="${W - pr}" y1="${yy}" y2="${yy}" stroke="var(--line)" stroke-width="1" ${f ? 'stroke-dasharray="2 3"' : ''}/>
    <text x="${pl - 6}" y="${yy + 4}" text-anchor="end" font-size="10" fill="var(--muted)">${f ? compact(top * f) : '0'}</text>`; });
  const bar = (x, yy, w, h) => { const rr = Math.min(4, w / 2, h); return h <= 0 ? '' : `M${x},${yy + h}V${yy + rr}Q${x},${yy} ${x + rr},${yy}H${x + w - rr}Q${x + w},${yy} ${x + w},${yy + rr}V${yy + h}Z`; };
  const bars = buckets.map((b, i) => { const x = pl + i * bw + (bw - barW) / 2; const h = b.v / top * ih; const isNow = monthly ? b.key === t.slice(0, 7) : b.key === t;
    return `<path class="tbar" data-i="${i}" d="${bar(x, y(b.v), barW, h)}" fill="${isNow ? 'var(--accent)' : 'var(--c1)'}"/>`; }).join('');
  const step = monthly ? 1 : n_ <= 7 ? 1 : n_ <= 16 ? 2 : n_ <= 31 ? 5 : 10;
  const labels = buckets.map((b, i) => {
    if (monthly) return `<text x="${pl + i * bw + bw / 2}" y="${H - 6}" text-anchor="middle" font-size="10" fill="var(--muted)">${n_ > 12 ? MONTHS[b.m.getMonth()][0] : MONTHS[b.m.getMonth()].slice(0, n_ > 6 ? 1 : 3)}</text>`;
    const d = parse(b.d);
    if (n_ <= 7) return `<text x="${pl + i * bw + bw / 2}" y="${H - 6}" text-anchor="middle" font-size="10" fill="var(--muted)">${WD[d.getDay()]}</text>`;
    const dn = d.getDate(); if (!(i === 0 || (dn % step === 0 && dn !== 30) )) return '';
    return `<text x="${pl + i * bw + bw / 2}" y="${H - 6}" text-anchor="middle" font-size="10" fill="var(--muted)">${i === 0 && dn !== 1 ? shortDate(b.d) : dn}</text>`;
  }).join('');
  const avgLine = avg > 0 ? `<line x1="${pl}" x2="${W - pr}" y1="${y(avg)}" y2="${y(avg)}" stroke="var(--c2)" stroke-width="1.5" stroke-dasharray="4 3"/>
    <text x="${W - pr}" y="${y(avg) - 4}" text-anchor="end" font-size="10" font-weight="700" fill="var(--text2)">avg ${compact(avg)}</text>` : '';
  trendData = { buckets, monthly, pl, bw, W, top, ih, pt, y };
  return `<div class="card"><div class="card-head"><h2>📈 ${monthly ? 'Monthly' : 'Daily'} spending</h2><span class="sub">Tap a bar</span></div>
    <div class="chart" id="trend"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Spending over time">${grid}${bars}${avgLine}${labels}
      <rect id="trend-hit" x="${pl}" y="0" width="${iw}" height="${H}" fill="transparent"/></svg><div class="tip" id="trend-tip"></div></div></div>`;
}
function bindTrend() {
  const wrap = $('#trend'); if (!wrap || !trendData) return;
  const svg = $('svg', wrap), tip = $('#trend-tip');
  const show = ev => {
    const rect = svg.getBoundingClientRect(); const sx = (ev.clientX - rect.left) / rect.width * trendData.W;
    const i = Math.floor((sx - trendData.pl) / trendData.bw); const b = trendData.buckets[i];
    if (!b) return hide();
    $$('.tbar', svg).forEach(p => p.style.opacity = +p.dataset.i === i ? 1 : .35);
    const label = trendData.monthly ? `${MONTHS_L[b.m.getMonth()]} ${b.m.getFullYear()}` : niceDate(b.d, false);
    tip.innerHTML = `${fmt(b.v)}<small>${label}</small>`;
    const cx = (trendData.pl + i * trendData.bw + trendData.bw / 2) / trendData.W * rect.width;
    tip.style.left = Math.max(50, Math.min(rect.width - 50, cx)) + 'px';
    tip.style.top = (trendData.y(b.v) / trendData.W * rect.width - 8) + 'px';
    tip.classList.add('show');
  };
  const hide = () => { tip.classList.remove('show'); $$('.tbar', svg).forEach(p => p.style.opacity = 1); };
  svg.addEventListener('pointerdown', show); svg.addEventListener('pointermove', show); svg.addEventListener('pointerleave', hide);
}

function topCard(list) {
  const top = [...list].sort((a, b) => net(b) - net(a)).slice(0, 5);
  return `<div class="card"><div class="card-head"><h2>🔥 Biggest expenses</h2></div>
    ${top.map(e => { const c = catById(e.catId); return `<button class="exp" data-edit="${e.id}" style="--c:${col(c)};padding:9px 0">
      <span class="cat-ico">${esc(c?.icon || '❔')}</span>
      <span style="min-width:0"><div class="exp-t ellip">${esc(e.note || subById(c, e.subId)?.name || c?.name || '')}</div><div class="exp-n">${esc(c?.name || '')} · ${niceDate(e.date)}</div></span>
      <span class="exp-a">${fmtNum(net(e))}</span></button>`; }).join('')}</div>`;
}

/* =====================================================================
   HISTORY — search + filters for everything + refunds
   ===================================================================== */
const HIST_RANGES = [['all', 'All time'], ['week', 'This week'], ['month', 'This month'], ['lastmonth', 'Last month'], ['year', 'This year'], ['custom', 'Custom']];
function histRange(h = S.hist) {
  const t = today(); const k = h.range;
  if (k === 'week' || k === 'month' || k === 'year') return periodRange(k, t);
  if (k === 'lastmonth') return periodRange('month', shiftAnchor('month', t, -1));
  if (k === 'custom') { let f = h.from || '0000-01-01', to = h.to || '9999-12-31'; if (f > to) [f, to] = [to, f]; return { from: f, to }; }
  return null;
}
function histFilter(h = S.hist) {
  const q = (h.q || '').trim().toLowerCase(); const r = histRange(h);
  const min = h.min ? toMinor(h.min) : null, max = h.max ? toMinor(h.max) : null;
  return S.expenses.filter(e => {
    if (h.status === 'active' && isRefunded(e)) return false;
    if (h.status === 'refunded' && !isRefunded(e)) return false;
    if (h.cat && e.catId !== h.cat) return false;
    if (h.sub && e.subId !== h.sub) return false;
    if (h.method && e.method !== h.method) return false;
    if (r && !inRange(e, r)) return false;
    if (min !== null && e.amount < min) return false;
    if (max !== null && e.amount > max) return false;
    if (q) {
      const c = catById(e.catId);
      const hay = [e.note, e.refundNote, c?.name, subById(c, e.subId)?.name, fromMinor(e.amount)].join(' ').toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  }).sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));
}
function activeFilters(h = S.hist) {
  const out = [];
  if (h.cat) { const c = catById(h.cat); out.push(['cat', `${c?.icon || ''} ${c?.name || 'Category'}`, col(c)]); }
  if (h.sub) { const s = subById(catById(h.cat), h.sub); out.push(['sub', s?.name || 'Subcategory', col(catById(h.cat))]); }
  if (h.method) out.push(['method', h.method === 'cash' ? '💵 Cash' : '💳 Online', `var(--${h.method === 'cash' ? 'cash' : 'online'})`]);
  if (h.range !== 'all') out.push(['range', h.range === 'custom' ? `📅 ${h.from ? shortDate(h.from) : '…'} – ${h.to ? shortDate(h.to) : '…'}` : '📅 ' + HIST_RANGES.find(x => x[0] === h.range)[1], 'var(--accent)']);
  if (h.min || h.max) out.push(['amount', `💰 ${h.min ? compact(toMinor(h.min)) : '0'} – ${h.max ? compact(toMinor(h.max)) : '∞'}`, 'var(--accent)']);
  return out;
}
function renderHistFilters() {
  $('#h-q').value = S.hist.q;
  $$('#h-status button').forEach(b => b.classList.toggle('on', b.dataset.st === S.hist.status));
  const af = activeFilters();
  $('#h-fcount').textContent = af.length || '';
  $('#h-fcount').hidden = !af.length;
  $('#h-active').innerHTML = af.map(([k, label, c]) => `<button class="chip on" data-clear="${k}" style="--c:${c}">${esc(label)} <span class="x">✕</span></button>`).join('')
    + (af.length > 1 ? `<button class="chip" data-clear="all">Clear all</button>` : '');
  $('#h-active').hidden = !af.length;
}
function clearFilter(k) {
  const h = S.hist;
  if (k === 'cat') { h.cat = ''; h.sub = ''; } else if (k === 'sub') h.sub = ''; else if (k === 'method') h.method = '';
  else if (k === 'range') { h.range = 'all'; h.from = ''; h.to = ''; } else if (k === 'amount') { h.min = ''; h.max = ''; }
  else if (k === 'all') Object.assign(h, { cat: '', sub: '', method: '', range: 'all', from: '', to: '', min: '', max: '' });
  h.limit = 150; renderHistFilters(); renderHist();
}
function renderHist() {
  const list = histFilter();
  if (!list.length) {
    $('#hist-body').innerHTML = `<div class="card empty"><div class="e-ico">${S.expenses.length ? '🔍' : '🌱'}</div><b>${S.expenses.length ? 'Nothing matches' : 'No expenses yet'}</b><div class="sub" style="margin-top:4px">${S.expenses.length ? 'Try a different search or filter.' : 'Your expenses will appear here.'}</div></div>`;
    return;
  }
  const shown = list.slice(0, S.hist.limit);
  const groups = []; let g;
  shown.forEach(e => { if (!g || g.date !== e.date) { g = { date: e.date, items: [] }; groups.push(g); } g.items.push(e); });
  const dayTotal = d => sum(list.filter(e => e.date === d));
  const refunded = list.reduce((s, e) => s + refundOf(e), 0);
  $('#hist-body').innerHTML = `<div class="hist-sum"><span><b>${list.length}</b> transaction${list.length !== 1 ? 's' : ''}${refunded ? ` · <span class="refund-txt">↩ ${fmtNum(refunded)}</span>` : ''}</span><span>Net <b class="num">${fmt(sum(list))}</b></span></div>` +
    groups.map(g => `<div class="day"><div class="day-head"><span>${niceDate(g.date)}</span><span class="num">${fmtNum(dayTotal(g.date))}</span></div>
      <div class="day-list">${g.items.map(expRow).join('')}</div></div>`).join('') +
    (list.length > shown.length ? `<button class="btn block" data-act="more">Show more (${list.length - shown.length})</button>` : '');
}
function expRow(e) {
  const c = catById(e.catId); const s = subById(c, e.subId);
  const full = isFullRefund(e), part = isRefunded(e) && !full;
  const amt = full ? `<s class="muted">${fmtNum(e.amount)}</s>` : part ? `<s class="was">${fmtNum(e.amount)}</s>${fmtNum(net(e))}` : fmtNum(e.amount);
  const badge = full ? `<span class="badge refund">↩ Refunded</span>` : part ? `<span class="badge refund">↩ −${compact(refundOf(e))}</span>`
    : `<span class="badge ${e.method}">${e.method === 'cash' ? '💵 Cash' : '💳 Online'}</span>`;
  const q = isRefunded(e) ? '<span></span>' : `<button class="qrefund" data-qrefund="${e.id}" aria-label="Full refund">↩</button>`;
  return `<div class="exp hq ${full ? 'is-refunded' : ''}" data-edit="${e.id}" role="button" tabindex="0" style="--c:${col(c)}">
    <span class="cat-ico">${esc(c?.icon || '❔')}</span>
    <span style="min-width:0"><div class="exp-t ellip">${esc(c?.name || 'Unknown')}${s ? ` <span class="muted">›</span> ${esc(s.name)}` : ''}</div>
      ${e.note ? `<div class="exp-n ellip">${esc(e.note)}</div>` : ''}</span>
    <span class="exp-a">${amt}<br>${badge}</span>${q}</div>`;
}

/* ---------------- Filters sheet ---------------- */
function openFilters() {
  const h = { ...S.hist };
  const html = `<h3>Filters</h3>
    <label class="form-l">Category</label><div class="chips wrap" id="f-cats"></div>
    <div id="f-subs-wrap"><label class="form-l">Subcategory</label><div class="chips wrap" id="f-subs"></div></div>
    <label class="form-l">Paid with</label>
    <div class="seg full method" id="f-method"><button data-m="">All</button><button data-m="cash">💵 Cash</button><button data-m="online">💳 Online</button></div>
    <label class="form-l">Date</label><div class="chips wrap" id="f-range"></div>
    <div class="custom-range" id="f-custom"><input type="date" class="field" id="f-from" aria-label="From"><input type="date" class="field" id="f-to" aria-label="To"></div>
    <label class="form-l">Amount (${esc(S.settings.currency)})</label>
    <div class="custom-range"><input class="field num" id="f-min" inputmode="numeric" placeholder="Min"><input class="field num" id="f-max" inputmode="numeric" placeholder="Max"></div>
    <div class="sheet-actions"><button class="btn" id="f-reset">Reset</button><button class="btn primary" id="f-apply">Show results</button></div>`;
  openSheet(html, (sh, close) => {
    $('#f-from', sh).value = h.from || ''; $('#f-to', sh).value = h.to || ''; $('#f-min', sh).value = h.min || ''; $('#f-max', sh).value = h.max || '';
    const draw = () => {
      $('#f-cats', sh).innerHTML = `<button class="chip ${!h.cat ? 'on' : ''}" data-fc="">All</button>` +
        sortedCats(true).map(c => `<button class="chip ${c.id === h.cat ? 'on' : ''}" data-fc="${c.id}" style="--c:${col(c)}">${esc(c.icon)} ${esc(c.name)}</button>`).join('');
      const c = catById(h.cat);
      $('#f-subs-wrap', sh).hidden = !c || !c.subs.length;
      if (c) $('#f-subs', sh).innerHTML = `<button class="chip ${!h.sub ? 'on' : ''}" data-fs="" style="--c:${col(c)}">All</button>` +
        c.subs.map(s => `<button class="chip ${s.id === h.sub ? 'on' : ''}" data-fs="${s.id}" style="--c:${col(c)}">${esc(s.name)}</button>`).join('');
      $$('#f-method button', sh).forEach(b => b.classList.toggle('on', b.dataset.m === h.method));
      $('#f-range', sh).innerHTML = HIST_RANGES.map(([k, l]) => `<button class="chip ${k === h.range ? 'on' : ''}" data-fr="${k}">${l}</button>`).join('');
      $('#f-custom', sh).hidden = h.range !== 'custom';
      const n = histFilter(h).length;
      $('#f-apply', sh).textContent = n ? `Show ${n} result${n !== 1 ? 's' : ''}` : 'No results';
    };
    draw();
    sh.addEventListener('input', () => { h.from = $('#f-from', sh).value; h.to = $('#f-to', sh).value; h.min = $('#f-min', sh).value; h.max = $('#f-max', sh).value; draw(); });
    sh.addEventListener('click', ev => {
      const b = ev.target.closest('button'); if (!b) return;
      if (b.dataset.fc !== undefined) { if (h.cat !== b.dataset.fc) h.sub = ''; h.cat = b.dataset.fc; }
      else if (b.dataset.fs !== undefined) h.sub = b.dataset.fs;
      else if (b.dataset.m !== undefined) h.method = b.dataset.m;
      else if (b.dataset.fr) h.range = b.dataset.fr;
      else if (b.id === 'f-reset') { Object.assign(h, { cat: '', sub: '', method: '', range: 'all', from: '', to: '', min: '', max: '' }); ['f-from', 'f-to', 'f-min', 'f-max'].forEach(i => $('#' + i, sh).value = ''); }
      else if (b.id === 'f-apply') { Object.assign(S.hist, h, { limit: 150 }); close(); renderHistFilters(); renderHist(); return; }
      else return;
      draw();
    });
  });
}

/* ---------------- Transaction sheet: edit, refund, delete ---------------- */
function openEdit(id) {
  const e = S.expenses.find(x => x.id === id); if (!e) return;
  const st = { catId: e.catId, subId: e.subId, method: e.method };
  const r = refundOf(e);
  const refundBox = r ? `
    <div class="refund-box">
      <div class="row"><span style="font-size:24px">↩</span><div class="grow"><b>${isFullRefund(e) ? 'Fully refunded' : 'Partly refunded'}</b>
        <div class="sub">${fmt(r)} of ${fmt(e.amount)} back${e.refundedAt ? ' · ' + niceDate(e.refundedAt) : ''}${e.refundNote ? ' · ' + esc(e.refundNote) : ''}</div></div></div>
      <div class="row" style="margin-top:10px"><button class="btn small" id="e-refund">Change</button><button class="btn small" id="e-unrefund">Undo refund</button>
        <span class="grow"></span><span class="sub">Counts as <b>${fmt(net(e))}</b></span></div>
    </div>` : `<button class="btn block refund-btn" id="e-refund">↩ I got this money back — Refund</button>`;
  const html = `<h3>Transaction</h3>
    ${refundBox}
    <label class="form-l">Amount (${esc(S.settings.currency)})</label>
    <input class="field num" id="e-amt" inputmode="${cur().dec ? 'decimal' : 'numeric'}" value="${fromMinor(e.amount)}" style="font-size:22px;font-weight:700">
    <label class="form-l">Paid with</label>
    <div class="seg full method" id="e-method"><button data-m="cash">💵 Cash</button><button data-m="online">💳 Online</button></div>
    <label class="form-l">Date</label>
    <input class="field" type="date" id="e-date" value="${e.date}">
    <label class="form-l">Category</label>
    <div class="chips wrap" id="e-cats"></div>
    <div class="chips wrap" id="e-subs"></div>
    <label class="form-l">Note</label>
    <input class="field" id="e-note" maxlength="80" value="${esc(e.note)}">
    <div class="sheet-actions"><button class="btn danger" id="e-del">Delete</button><button class="btn primary" id="e-save">Save changes</button></div>`;
  openSheet(html, (sh, close) => {
    const drawCats = () => {
      $('#e-cats', sh).innerHTML = sortedCats(true).filter(c => !c.hidden || c.id === st.catId).map(c => `<button class="chip ${c.id === st.catId ? 'on' : ''}" data-c="${c.id}" style="--c:${col(c)}">${esc(c.icon)} ${esc(c.name)}</button>`).join('');
      const c = catById(st.catId); const subs = (c?.subs || []).filter(s => !s.hidden || s.id === st.subId);
      $('#e-subs', sh).innerHTML = subs.map(s => `<button class="chip ${s.id === st.subId ? 'on' : ''}" data-s="${s.id}" style="--c:${col(c)}">${esc(s.name)}</button>`).join('');
      $$('#e-method button', sh).forEach(b => b.classList.toggle('on', b.dataset.m === st.method));
    };
    drawCats();
    sh.addEventListener('click', async ev => {
      const b = ev.target.closest('button'); if (!b) return;
      if (b.dataset.c) { if (st.catId !== b.dataset.c) st.subId = null; st.catId = b.dataset.c; drawCats(); }
      else if (b.dataset.s) { st.subId = st.subId === b.dataset.s ? null : b.dataset.s; drawCats(); }
      else if (b.dataset.m) { st.method = b.dataset.m; drawCats(); }
      else if (b.id === 'e-refund') { close(); setTimeout(() => openRefund(e), 300); }
      else if (b.id === 'e-unrefund') {
        const old = { refunded: e.refunded, refundedAt: e.refundedAt, refundNote: e.refundNote };
        Object.assign(e, { refunded: 0, refundedAt: null, refundNote: '', updatedAt: new Date().toISOString() });
        await putExpenses([e]); close(); refresh();
        toast('Refund removed', 'Undo', async () => { Object.assign(e, old); await putExpenses([e]); refresh(); });
      }
      else if (b.id === 'e-save') {
        const amount = toMinor($('#e-amt', sh).value); if (!amount) { shake($('#e-amt', sh)); return; }
        Object.assign(e, { amount, method: st.method, catId: st.catId, subId: st.subId, date: $('#e-date', sh).value || e.date, note: $('#e-note', sh).value.trim(), updatedAt: new Date().toISOString() });
        if (e.refunded > e.amount) e.refunded = e.amount;
        await putExpenses([e]); close(); toast('✓ Updated'); refresh();
      } else if (b.id === 'e-del') {
        close();
        const ok = await ask('Delete this expense?', `${esc(fmt(e.amount))} · ${esc(catName(e.catId))} · ${niceDate(e.date)}<br><br>If you got the money back, <b>Refund</b> keeps the record instead.`, [{ label: 'Delete forever', value: true, cls: 'danger' }]);
        if (ok) { await delExpense(e.id); S.expenses = S.expenses.filter(x => x.id !== e.id); toast('Deleted'); refresh(); }
      }
    });
  });
}
/* One tap on ↩ in History = full refund (with Undo). Partial refunds: open the transaction → Refund. */
async function quickRefund(id) {
  const e = S.expenses.find(x => x.id === id); if (!e || isRefunded(e)) return;
  const old = { refunded: e.refunded, refundedAt: e.refundedAt, refundNote: e.refundNote };
  Object.assign(e, { refunded: e.amount, refundedAt: today(), refundNote: e.refundNote || '', updatedAt: new Date().toISOString() });
  await putExpenses([e]); refresh();
  toast(`↩ Refunded ${fmt(e.amount)} · ${catName(e.catId)}`, 'Undo', async () => { Object.assign(e, old); await putExpenses([e]); refresh(); });
}
function openRefund(e) {
  const c = catById(e.catId);
  const html = `<h3>↩ Refund</h3>
    <div class="refund-sum" style="--c:${col(c)}"><span class="cat-ico">${esc(c?.icon || '❔')}</span>
      <div class="grow"><b>${esc(e.note || subById(c, e.subId)?.name || c?.name || '')}</b><div class="sub">${esc(c?.name || '')} · ${niceDate(e.date)}</div></div>
      <b class="num" style="font-size:18px">${fmt(e.amount)}</b></div>
    <button class="btn block refund-full" id="r-full">Full refund · ${fmt(e.amount)}</button>
    <div class="or"><span>or part of it</span></div>
    <div class="row"><input class="field num" id="r-amt" inputmode="${cur().dec ? 'decimal' : 'numeric'}" placeholder="Amount returned" value="${isRefunded(e) && !isFullRefund(e) ? fromMinor(refundOf(e)) : ''}" style="font-size:18px;font-weight:700">
      <button class="btn primary" id="r-part" style="white-space:nowrap;padding:12px 16px">Refund part</button></div>
    <label class="form-l">Note (optional)</label>
    <input class="field" id="r-note" maxlength="60" placeholder="e.g. Returned one item" value="${esc(e.refundNote || '')}">
    <div class="note">A refunded transaction stays in History (crossed out) but no longer counts in totals, charts or budgets.</div>`;
  openSheet(html, (sh, close) => {
    const apply = async amt => {
      const old = { refunded: e.refunded, refundedAt: e.refundedAt, refundNote: e.refundNote };
      Object.assign(e, { refunded: amt, refundedAt: today(), refundNote: $('#r-note', sh).value.trim(), updatedAt: new Date().toISOString() });
      await putExpenses([e]); close(); refresh();
      toast(amt >= e.amount ? `↩ Refunded ${fmt(amt)}` : `↩ ${fmt(amt)} back · now ${fmt(net(e))}`, 'Undo', async () => { Object.assign(e, old); await putExpenses([e]); refresh(); });
    };
    $('#r-full', sh).onclick = () => apply(e.amount);
    $('#r-part', sh).onclick = () => {
      const a = toMinor($('#r-amt', sh).value);
      if (!a || a > e.amount) { shake($('#r-amt', sh)); toast(a > e.amount ? 'More than the amount paid' : 'Type the amount you got back'); return; }
      apply(a);
    };
  });
}

/* =====================================================================
   SETTINGS
   ===================================================================== */
function renderSettings() {
  const s = S.settings; const lb = HUB.meta.lastBackup;
  const cats = sortedCats(true);
  $('#set-body').innerHTML = `
    <div class="lock"><span class="ico">🔒</span><div><b>Private & offline</b><div class="sub" style="margin-top:2px">${S.expenses.length} expense${S.expenses.length !== 1 ? 's' : ''} stored only on this device. The app is blocked from making any network request.${HUB.meta.persisted ? ' Storage is marked persistent.' : ''}</div></div></div>

    <div class="group-title">Backup</div>
    <div class="list">
      <button class="item" data-act="backup"><span>💾</span><span class="lbl">Back up now</span><span class="val">${lb ? niceDate(ymd(new Date(lb))) : 'Never'}</span></button>
      <button class="item" data-act="restore"><span>♻️</span><span class="lbl">Restore from backup</span><span class="chev">›</span></button>
      <button class="item" data-act="csv"><span>📄</span><span class="lbl">Export CSV (Numbers / Excel)</span><span class="chev">›</span></button>
    </div>
    <div class="note">One backup file covers the whole Hub (Finance + Notes). It opens the share sheet → Save to Files → On My iPhone.</div>

    <div class="group-title">Budget</div>
    <div class="list">
      <label class="item"><span>💰</span><span class="lbl">Monthly budget</span><input class="inline num" id="set-budget" inputmode="numeric" placeholder="None" value="${s.budget ? fromMinor(s.budget) : ''}"></label>
    </div>
    <div class="note">Per-category budgets are set inside each category below.</div>

    <div class="group-title">Categories</div>
    <div class="list">
      ${cats.map((c, i) => `<div class="item" style="--c:${col(c)};${c.hidden ? 'opacity:.5' : ''}">
        <span class="cat-ico">${esc(c.icon)}</span>
        <button class="lbl" style="text-align:left" data-editcat="${c.id}"><b>${esc(c.name)}</b>${c.hidden ? ' <span class="tag">hidden</span>' : ''}<div class="sub">${c.subs.filter(x => !x.hidden).length} subcategories${c.budget ? ' · budget ' + compact(c.budget) : ''}</div></button>
        <span class="ord"><button data-move="${c.id}" data-dir="-1" ${i === 0 ? 'disabled' : ''} aria-label="Move up">▲</button><button data-move="${c.id}" data-dir="1" ${i === cats.length - 1 ? 'disabled' : ''} aria-label="Move down">▼</button></span>
      </div>`).join('')}
      <button class="item" data-editcat="new" style="color:var(--accent);font-weight:700"><span style="font-size:20px">＋</span><span class="lbl">Add category</span></button>
    </div>

    <div class="group-title">Preferences</div>
    <div class="list">
      <label class="item"><span>💱</span><span class="lbl">Currency</span><select id="set-cur"><option value="IQD">IQD (no decimals)</option><option value="USD">USD ($)</option></select></label>
      <label class="item"><span>🔢</span><span class="lbl">Number format</span><select id="set-sep"><option value=",">1,250,000</option><option value=" ">1 250 000</option><option value=".">1.250.000</option></select></label>
      <label class="item"><span>📆</span><span class="lbl">Week starts on</span><select id="set-week"><option value="6">Saturday</option><option value="0">Sunday</option><option value="1">Monday</option></select></label>
      <label class="item"><span>💳</span><span class="lbl">Default payment</span><select id="set-method"><option value="last">Last used</option><option value="cash">Cash</option><option value="online">Online</option></select></label>
    </div>

    <div class="group-title">Danger zone</div>
    <div class="list"><button class="item" data-act="erase" style="color:var(--bad)"><span>🗑️</span><span class="lbl">Erase all expenses</span></button></div>
    <div class="note" style="margin-bottom:10px">Appearance (light/dark) is in Hub settings. Data never leaves this device.</div>`;
  $('#set-cur').value = s.currency; $('#set-sep').value = s.sep; $('#set-week').value = String(s.weekStart); $('#set-method').value = s.defaultMethod;
}

function openCatEditor(id) {
  const isNew = id === 'new';
  const c = isNew ? { id: 'cat_' + uid(), name: '', icon: '🏷️', color: 'c1', order: S.cats.length, hidden: false, budget: 0, subs: [] } : JSON.parse(JSON.stringify(catById(id)));
  const used = !isNew && S.expenses.some(e => e.catId === c.id);
  const html = `<h3>${isNew ? 'New category' : 'Edit category'}</h3>
    <div class="row"><input class="field" id="k-icon" value="${esc(c.icon)}" style="width:64px;text-align:center;font-size:24px;padding:8px" aria-label="Emoji icon">
      <input class="field" id="k-name" value="${esc(c.name)}" placeholder="Category name" maxlength="24"></div>
    <label class="form-l">Color</label>
    <div class="swatches" id="k-colors">${COLORS.map(k => `<button class="sw ${k === c.color ? 'on' : ''}" data-col="${k}" style="--c:var(--${k})" aria-label="${k}"></button>`).join('')}</div>
    <label class="form-l">Monthly budget (optional)</label>
    <input class="field num" id="k-budget" inputmode="numeric" placeholder="None" value="${c.budget ? fromMinor(c.budget) : ''}">
    <label class="form-l">Subcategories</label>
    <div id="k-subs"></div>
    <button class="btn small" id="k-addsub" style="margin-top:2px">＋ Add subcategory</button>
    ${isNew ? '' : `<div class="item" style="padding:14px 4px 0;border:0"><span class="lbl">Hide from Add screen</span><label class="toggle"><input type="checkbox" id="k-hidden" ${c.hidden ? 'checked' : ''}><span></span></label></div>`}
    <div class="sheet-actions">${isNew ? '' : `<button class="btn danger" id="k-del">${used ? 'Hide' : 'Delete'}</button>`}<button class="btn primary" id="k-save">Save</button></div>`;
  openSheet(html, (sh, close) => {
    const drawSubs = () => {
      $('#k-subs', sh).innerHTML = c.subs.map((s, i) => `<div class="sub-edit" style="${s.hidden ? 'opacity:.5' : ''}"><input class="field" data-si="${i}" value="${esc(s.name)}" placeholder="Name" maxlength="28">
        <button class="btn small" data-sx="${i}">${s.hidden ? 'Show' : (S.expenses.some(e => e.subId === s.id) ? 'Hide' : '✕')}</button></div>`).join('') || '<div class="sub" style="margin:0 4px 8px">None yet</div>';
    };
    drawSubs();
    sh.addEventListener('input', ev => { const i = ev.target.dataset.si; if (i !== undefined) c.subs[+i].name = ev.target.value; });
    sh.addEventListener('click', async ev => {
      const b = ev.target.closest('button'); if (!b) return;
      if (b.dataset.col) { c.color = b.dataset.col; $$('.sw', sh).forEach(x => x.classList.toggle('on', x === b)); }
      else if (b.id === 'k-addsub') { c.subs.push({ id: 'sub_' + uid(), name: '', hidden: false }); drawSubs(); $$('[data-si]', sh).pop().focus(); }
      else if (b.dataset.sx !== undefined) {
        const s = c.subs[+b.dataset.sx];
        if (s.hidden) s.hidden = false; else if (S.expenses.some(e => e.subId === s.id)) s.hidden = true; else c.subs.splice(+b.dataset.sx, 1);
        drawSubs();
      } else if (b.id === 'k-save') {
        c.name = $('#k-name', sh).value.trim(); if (!c.name) { shake($('#k-name', sh)); return; }
        c.icon = $('#k-icon', sh).value.trim() || '🏷️';
        c.budget = toMinor($('#k-budget', sh).value);
        if (!isNew) c.hidden = $('#k-hidden', sh).checked;
        c.subs = c.subs.filter(s => s.name.trim()).map(s => ({ ...s, name: s.name.trim() }));
        if (isNew) S.cats.push(c); else S.cats[S.cats.findIndex(x => x.id === c.id)] = c;
        await saveCats(); close(); toast('✓ Category saved'); refresh();
      } else if (b.id === 'k-del') {
        if (used) { const cc = catById(c.id); cc.hidden = true; await saveCats(); close(); toast('Hidden — old expenses keep it'); refresh(); return; }
        close();
        const ok = await ask(`Delete “${c.name}”?`, 'It has no expenses, so nothing else changes.', [{ label: 'Delete', value: true, cls: 'danger' }]);
        if (ok) { S.cats = S.cats.filter(x => x.id !== c.id); await saveCats(); refresh(); }
      }
    });
  });
}
async function moveCat(id, dir) {
  const cats = sortedCats(true); const i = cats.findIndex(c => c.id === id); const j = i + dir;
  if (j < 0 || j >= cats.length) return;
  [cats[i], cats[j]] = [cats[j], cats[i]]; cats.forEach((c, k) => c.order = k);
  await saveCats(); renderSettings(); renderAddCats();
}

/* ---------------- Backup / restore / CSV ---------------- */
async function doCSV() {
  const q = v => { const s = String(v ?? ''); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
  const rows = [['Date', 'Amount', 'Refunded', 'Net', 'Currency', 'Payment', 'Category', 'Subcategory', 'Note', 'Created']];
  [...S.expenses].sort((a, b) => a.date.localeCompare(b.date)).forEach(e => { const c = catById(e.catId);
    rows.push([e.date, fromMinor(e.amount), fromMinor(refundOf(e)), fromMinor(net(e)), S.settings.currency, e.method === 'cash' ? 'Cash' : 'Online', c?.name || '', subById(c, e.subId)?.name || '', e.note, e.createdAt]); });
  const blob = new Blob(['﻿' + rows.map(r => r.map(q).join(',')).join('\r\n')], { type: 'text/csv' });
  await shareOrDownload(blob, `expenses-${today()}.csv`);
}
async function eraseAll() {
  const ok = await ask('Erase all expenses?', `This deletes all <b>${S.expenses.length}</b> expenses on this device. Categories and settings stay. Make a backup first if unsure.`,
    [{ label: 'Back up first', value: 'backup', cls: 'primary' }, { label: 'Erase everything', value: 'erase', cls: 'danger' }]);
  if (ok === 'backup') return doBackup();
  if (ok === 'erase') { await clearExpenses(); S.expenses = []; toast('All expenses erased'); refresh(); }
}
/* =====================================================================
   NAV + EVENTS
   ===================================================================== */
function showTab(tab) {
  S.tab = tab;
  $$('#f-tabs button').forEach(b => b.classList.toggle('on', b.dataset.tab === tab));
  $$('#app-finance .screen').forEach(s => s.classList.toggle('on', s.id === 's-' + tab));
  $('#f-main').scrollTop = 0;
  refresh();
}
function refresh() {
  if (S.tab === 'add') { renderAmount(); renderAddCats(); renderAddDate(); renderAddMethod(); }
  if (S.tab === 'dash') renderDash();
  if (S.tab === 'hist') { renderHistFilters(); renderHist(); }
  if (S.tab === 'set') renderSettings();
}

function bind() {
  $('#f-tabs').addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; if (b.dataset.tab === 'hub') openApp('hub'); else showTab(b.dataset.tab); });

  // Add screen
  $('#keypad').addEventListener('click', e => { const b = e.target.closest('[data-k]'); if (b) keyPress(b.dataset.k); });
  let holdT; $('#keypad').addEventListener('pointerdown', e => { if (e.target.closest('[data-k="del"]')) holdT = setTimeout(() => { S.add.amount = ''; renderAmount(); }, 550); });
  ['pointerup', 'pointerleave', 'pointercancel'].forEach(ev => $('#keypad').addEventListener(ev, () => clearTimeout(holdT)));
  $('#add-cats').addEventListener('click', e => { const b = e.target.closest('[data-cat]'); if (!b) return; if (S.add.catId !== b.dataset.cat) S.add.subId = null; S.add.catId = b.dataset.cat; renderAddCats(); });
  $('#add-subs').addEventListener('click', e => { const b = e.target.closest('[data-sub]'); if (!b) return; S.add.subId = S.add.subId === b.dataset.sub ? null : b.dataset.sub; renderAddSubs(); });
  $('#add-method').addEventListener('click', e => { const b = e.target.closest('[data-m]'); if (b) { S.add.method = b.dataset.m; renderAddMethod(); } });
  $('#add-date').addEventListener('change', e => { if (e.target.value) { S.add.date = e.target.value; renderAddDate(); } });
  $('#d-prev').onclick = () => { S.add.date = addDays(S.add.date, -1); renderAddDate(); };
  $('#d-next').onclick = () => { S.add.date = addDays(S.add.date, 1); renderAddDate(); };
  $('#add-note').addEventListener('keydown', e => { if (e.key === 'Enter') { e.target.blur(); } });
  document.addEventListener('keydown', e => { // desktop typing support
    if (HUB.app !== 'finance' || S.tab !== 'add' || e.target.matches('input,select,textarea') || $('.sheet')) return;
    if (/^[0-9]$/.test(e.key)) keyPress(e.key); else if (e.key === 'Backspace') keyPress('del'); else if (e.key === '.' && cur().dec) keyPress('.'); else if (e.key === 'Enter') saveAdd();
  });

  // Dashboard
  $('#dash-period').addEventListener('click', e => { const b = e.target.closest('[data-p]'); if (!b) return; S.dash.period = b.dataset.p; S.dash.anchor = today(); renderDash(); });
  $('#p-prev').onclick = () => { S.dash.anchor = shiftAnchor(S.dash.period, periodRange(S.dash.period, S.dash.anchor).from, -1); renderDash(); };
  $('#p-next').onclick = () => { S.dash.anchor = shiftAnchor(S.dash.period, periodRange(S.dash.period, S.dash.anchor).from, 1); renderDash(); };
  $('#c-from').onchange = e => { if (e.target.value) { S.dash.from = e.target.value; renderDash(); } };
  $('#c-to').onchange = e => { if (e.target.value) { S.dash.to = e.target.value; renderDash(); } };

  // History
  $('#h-q').addEventListener('input', e => { S.hist.q = e.target.value; S.hist.limit = 150; renderHist(); });
  $('#h-status').addEventListener('click', e => { const b = e.target.closest('[data-st]'); if (!b) return; S.hist.status = b.dataset.st; S.hist.limit = 150; renderHistFilters(); renderHist(); });
  $('#h-filter-btn').onclick = openFilters;
  $('#h-active').addEventListener('click', e => { const b = e.target.closest('[data-clear]'); if (b) clearFilter(b.dataset.clear); });

  // Settings inputs
  $('#set-body').addEventListener('change', async e => {
    const id = e.target.id; const s = S.settings;
    if (id === 'set-cur') {
      if (S.expenses.length && e.target.value !== s.currency) {
        const ok = await ask('Change currency?', 'Existing amounts are <b>not converted</b>; only the label and decimals change. Best done before you start logging.', [{ label: 'Change anyway', value: true, cls: 'danger' }]);
        if (!ok) { e.target.value = s.currency; return; }
      }
      s.currency = e.target.value; renderKeypad();
    }
    else if (id === 'set-sep') s.sep = e.target.value;
    else if (id === 'set-week') s.weekStart = +e.target.value;
    else if (id === 'set-method') s.defaultMethod = e.target.value;
    else if (id === 'set-budget') s.budget = toMinor(e.target.value);
    else return;
    await saveSettings(); renderSettings(); toast('✓ Saved');
  });

  // Global delegated actions
  document.addEventListener('click', e => {
    const b = e.target.closest('[data-qrefund],[data-act],[data-drill],[data-edit],[data-editcat],[data-move]'); if (!b || b.closest('.sheet') || !b.closest('#app-finance')) return;
    if (b.dataset.qrefund) return quickRefund(b.dataset.qrefund);
    if (b.dataset.drill) { S.dash.drill = b.dataset.drill; renderDash(); $('#dash-body').scrollIntoView({ block: 'start', behavior: 'smooth' }); return; }
    if (b.dataset.edit) return openEdit(b.dataset.edit);
    if (b.dataset.editcat) return openCatEditor(b.dataset.editcat);
    if (b.dataset.move) return moveCat(b.dataset.move, +b.dataset.dir);
    const a = b.dataset.act;
    if (a === 'undrill') { S.dash.drill = null; renderDash(); }
    else if (a === 'backup') doBackup();
    else if (a === 'csv') doCSV();
    else if (a === 'restore') $('#restore-file').click();
    else if (a === 'go-hub-settings') { openApp('hub'); openHubSettings(); }
    else if (a === 'erase') eraseAll();
    else if (a === 'more') { S.hist.limit += 150; renderHist(); }
    else if (a === 'hist-cat' || a === 'hist-refunds') {
      const r = periodRange(S.dash.period, S.dash.anchor);
      Object.assign(S.hist, { q: '', status: a === 'hist-refunds' ? 'refunded' : '', cat: a === 'hist-cat' ? b.dataset.cat : '', sub: '', method: '', range: 'custom', from: r.from, to: r.to, min: '', max: '', limit: 150 });
      showTab('hist');
    }
  });

  // When the app comes back to the foreground on a new day, reset the add-date to today
  let lastDay = today();
  document.addEventListener('visibilitychange', () => { if (!document.hidden && today() !== lastDay) { lastDay = today(); S.add.date = today(); S.dash.anchor = today(); refresh(); } });
}

/* ---------------- Init (called by the Hub) ---------------- */
async function financeInit() {
  S.settings = { ...DEFAULT_SETTINGS, ...(await kvGet('settings') || {}) };
  S.meta = (await kvGet('meta')) || {};
  if (S.meta.lastBackup && !HUB.meta.lastBackup) HUB.meta.lastBackup = S.meta.lastBackup; // v1 → v2
  S.cats = (await kvGet('categories')) || null;
  if (!S.cats) { S.cats = makeDefaultCats(); await saveCats(); S.meta.addedWork = true; saveMeta(); }
  if (!S.meta.addedWork) { // v2.1: add the Work category once for existing users, just above "Other"
    if (!S.cats.find(c => c.id === 'cat_work')) {
      const other = S.cats.find(c => c.id === 'cat_other'); const at = other ? other.order : S.cats.length;
      S.cats.forEach(c => { if (c.order >= at) c.order++; });
      S.cats.push({ id: 'cat_work', name: 'Work', icon: '💼', color: 'c7', order: at, hidden: false, budget: 0, subs: WORK_SUBS.map(n => ({ id: 'sub_' + uid(), name: n, hidden: false })) });
      await saveCats();
    }
    S.meta.addedWork = true; await saveMeta();
  }
  S.expenses = await storeAll('expenses');
  S.add.catId = S.meta.lastCat || null;
  S.add.method = S.settings.defaultMethod === 'last' ? (S.meta.lastMethod || 'cash') : S.settings.defaultMethod;
  bind(); renderAdd();
}
APPS.finance = { onOpen() { S.add.date = today(); showTab('add'); } };
