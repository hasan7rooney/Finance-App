'use strict';
/* =====================================================================
   HUB · WALLET app — a balance with money in and out, fully separate from Finance.
   Built for several wallets; starts with one.
   ===================================================================== */

const W = { wallets: [], entries: [], cur: null, tab: 'home', log: { q: '', type: '', range: 'all' }, bound: false };
const saveWallets = () => kvSet('wallets', W.wallets);
const putEntries = list => storePut('walletTx', list);
const wal = () => W.wallets.find(w => w.id === W.cur) || W.wallets[0];
const signed = e => e.type === 'in' ? e.amount : -e.amount;
const entriesOf = id => W.entries.filter(e => e.walletId === id);
const byTime = (a, b) => a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt);
const balanceOf = id => entriesOf(id).reduce((s, e) => s + signed(e), 0);
function withRunning(id) { // oldest → newest, each with .after = balance right after it
  let bal = 0;
  return entriesOf(id).sort(byTime).map(e => { bal += signed(e); return { e, after: bal }; });
}
const hhmm = iso => { const d = new Date(iso); return `${pad(d.getHours())}:${pad(d.getMinutes())}`; };
const sgn = e => (e.type === 'in' ? '+' : '−') + fmtNum(e.amount);

/* ---------------- Home ---------------- */
function renderWallet() {
  const w = wal(); if (!w) return;
  $('#w-name').textContent = `${w.icon} ${w.name}`;
  $('#w-switch').innerHTML = W.wallets.length > 1 ? W.wallets.map(x => `<button class="chip ${x.id === w.id ? 'on' : ''}" data-wsel="${x.id}">${esc(x.icon)} ${esc(x.name)}</button>`).join('') : '';
  $('#w-switch').hidden = W.wallets.length < 2;
  const bal = balanceOf(w.id);
  const m = periodRange('month', today());
  const mon = entriesOf(w.id).filter(e => inRange(e, m));
  const mIn = mon.filter(e => e.type === 'in' && !e.start).reduce((s, e) => s + e.amount, 0);
  const mOut = mon.filter(e => e.type === 'out').reduce((s, e) => s + e.amount, 0);
  const runs = withRunning(w.id);
  const last = runs[runs.length - 1];
  $('#w-hero').innerHTML = `
    <div class="w-hero ${bal < 0 ? 'neg' : ''}">
      <div class="lbl">Balance</div>
      <div class="big">${cur().pre ? esc(cur().sym) + fmtNum(bal) : fmtNum(bal) + `<small>${esc(cur().sym)}</small>`}</div>
      ${bal < 0 ? '<div class="pill">⚠️ Below zero</div>' : ''}
      <div class="w-month">
        <div><span>↓ In · ${MONTHS[new Date().getMonth()]}</span><b>+${fmtNum(mIn)}</b></div>
        <div><span>↑ Out · ${MONTHS[new Date().getMonth()]}</span><b>−${fmtNum(mOut)}</b></div>
      </div>
      ${last ? `<div class="w-last">Last: ${esc(last.e.note || (last.e.type === 'in' ? 'Money in' : 'Money out'))} · ${sgn(last.e)} · ${niceDate(last.e.date)}</div>` : ''}
    </div>`;
  $('#w-chart').innerHTML = runs.length ? balanceChart(runs) : '';
  bindWChart();
  const recent = runs.slice(-6).reverse();
  $('#w-recent').innerHTML = recent.length ? `<div class="card-head" style="margin:6px 4px 8px"><h2>Recent</h2><button class="back-btn" data-wtab="log">See all ›</button></div>
    <div class="day-list">${recent.map(walletRow).join('')}</div>`
    : `<div class="card empty"><div class="e-ico">👛</div><b>No entries yet</b><div class="sub" style="margin-top:4px">Tap ＋ In or － Out to start.</div></div>`;
}
function walletRow({ e, after }) {
  return `<button class="wrow ${e.type}" data-wedit="${e.id}">
    <span class="wico">${e.start ? '🏁' : e.type === 'in' ? '↓' : '↑'}</span>
    <span style="min-width:0"><div class="exp-t ellip">${esc(e.note || (e.type === 'in' ? 'Money in' : 'Money out'))}</div>
      <div class="exp-n">${niceDate(e.date)} · ${hhmm(e.createdAt)}</div></span>
    <span class="exp-a"><span class="wamt">${sgn(e)}</span><span class="wafter">Bal ${fmtNum(after)}</span></span></button>`;
}

/* Balance-over-time chart: end-of-day balance for the last 30 days */
let wChart = null;
function balanceChart(runs) {
  const t = today(); const first = runs[0].e.date;
  const start = daysBetween(first, t) > 29 ? addDays(t, -29) : first;
  const n = daysBetween(start, t) + 1;
  let bal = runs.filter(r => r.e.date < start).reduce((s, r) => s + signed(r.e), 0);
  const pts = [];
  for (let i = 0; i < n; i++) { const d = addDays(start, i); runs.forEach(r => { if (r.e.date === d) bal += signed(r.e); }); pts.push({ d, v: bal }); }
  const W_ = 340, H = 140, pl = 36, pr = 6, pt = 12, pb = 20, iw = W_ - pl - pr, ih = H - pt - pb;
  const mx = Math.max(...pts.map(p => p.v), 0), mn = Math.min(...pts.map(p => p.v), 0);
  const span = (mx - mn) || 1;
  const x = i => pl + (n === 1 ? iw / 2 : i / (n - 1) * iw), y = v => pt + ih - (v - mn) / span * ih;
  const line = pts.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.v).toFixed(1)}`).join('');
  const area = `${line}L${x(n - 1).toFixed(1)},${y(mn)}L${x(0).toFixed(1)},${y(mn)}Z`;
  const zero = mn < 0 ? `<line x1="${pl}" x2="${W_ - pr}" y1="${y(0)}" y2="${y(0)}" stroke="var(--bad)" stroke-dasharray="3 3" stroke-width="1"/>` : '';
  const labels = [0, Math.floor((n - 1) / 2), n - 1].filter((v, i, a) => a.indexOf(v) === i).map(i => `<text x="${x(i)}" y="${H - 5}" text-anchor="${i === 0 ? 'start' : i === n - 1 ? 'end' : 'middle'}" font-size="10" fill="var(--muted)">${i === n - 1 ? 'Today' : shortDate(pts[i].d)}</text>`).join('');
  wChart = { pts, x, y, W: W_, pl, iw, n };
  return `<div class="card"><div class="card-head"><h2>📈 Balance · last ${n} day${n > 1 ? 's' : ''}</h2><span class="sub">Tap the line</span></div>
    <div class="chart" id="wchart"><svg viewBox="0 0 ${W_} ${H}" role="img" aria-label="Balance over time">
      <defs><linearGradient id="wg" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="var(--c3)" stop-opacity=".35"/><stop offset="1" stop-color="var(--c3)" stop-opacity="0"/></linearGradient></defs>
      <line x1="${pl}" x2="${W_ - pr}" y1="${y(mx)}" y2="${y(mx)}" stroke="var(--line)" stroke-dasharray="2 3"/>
      <text x="${pl - 6}" y="${y(mx) + 4}" text-anchor="end" font-size="10" fill="var(--muted)">${compact(mx)}</text>
      <text x="${pl - 6}" y="${y(mn) + 4}" text-anchor="end" font-size="10" fill="var(--muted)">${mn < 0 ? '−' + compact(-mn) : compact(mn)}</text>
      ${zero}<path d="${area}" fill="url(#wg)"/><path d="${line}" fill="none" stroke="var(--c3)" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round"/>
      <circle id="wdot" r="5" fill="var(--c3)" stroke="var(--card)" stroke-width="2" cx="${x(n - 1)}" cy="${y(pts[n - 1].v)}"/>
      ${labels}</svg><div class="tip" id="wtip"></div></div></div>`;
}
function bindWChart() {
  const wrap = $('#wchart'); if (!wrap || !wChart) return;
  const svg = $('svg', wrap), tip = $('#wtip'), dot = $('#wdot');
  const show = ev => {
    const r = svg.getBoundingClientRect(); const sx = (ev.clientX - r.left) / r.width * wChart.W;
    const i = Math.max(0, Math.min(wChart.n - 1, Math.round((sx - wChart.pl) / (wChart.iw / Math.max(1, wChart.n - 1)))));
    const p = wChart.pts[i]; const cx = wChart.x(i), cy = wChart.y(p.v);
    dot.setAttribute('cx', cx); dot.setAttribute('cy', cy);
    tip.innerHTML = `${fmt(p.v)}<small>${niceDate(p.d)}</small>`;
    tip.style.left = Math.max(55, Math.min(r.width - 55, cx / wChart.W * r.width)) + 'px';
    tip.style.top = (cy / wChart.W * r.width - 10) + 'px'; tip.classList.add('show');
  };
  svg.addEventListener('pointerdown', show); svg.addEventListener('pointermove', show);
  svg.addEventListener('pointerleave', () => tip.classList.remove('show'));
}

/* ---------------- Log (all entries, search + filters) ---------------- */
function renderLog() {
  const w = wal(); if (!w) return;
  const L = W.log; const q = L.q.trim().toLowerCase();
  $('#wl-q').value = L.q;
  $$('#wl-type button').forEach(b => b.classList.toggle('on', b.dataset.t === L.type));
  $$('#wl-range button').forEach(b => b.classList.toggle('on', b.dataset.r === L.range));
  const r = L.range === 'all' ? null : L.range === 'lastmonth' ? periodRange('month', shiftAnchor('month', today(), -1)) : periodRange(L.range, today());
  const rows = withRunning(w.id).reverse().filter(({ e }) =>
    (!L.type || e.type === L.type) && (!r || inRange(e, r)) &&
    (!q || (e.note || '').toLowerCase().includes(q) || fromMinor(e.amount).includes(q)));
  if (!rows.length) { $('#wl-body').innerHTML = `<div class="card empty"><div class="e-ico">${W.entries.length ? '🔍' : '👛'}</div><b>${entriesOf(w.id).length ? 'Nothing matches' : 'No entries yet'}</b></div>`; return; }
  const tin = rows.filter(x => x.e.type === 'in').reduce((s, x) => s + x.e.amount, 0), tout = rows.filter(x => x.e.type === 'out').reduce((s, x) => s + x.e.amount, 0);
  const groups = []; let g;
  rows.forEach(x => { if (!g || g.d !== x.e.date) { g = { d: x.e.date, items: [] }; groups.push(g); } g.items.push(x); });
  const dayNet = items => items.reduce((s, x) => s + signed(x.e), 0);
  $('#wl-body').innerHTML = `<div class="w-sum"><div class="in"><span>In</span><b>+${fmtNum(tin)}</b></div><div class="out"><span>Out</span><b>−${fmtNum(tout)}</b></div><div><span>${rows.length} entr${rows.length !== 1 ? 'ies' : 'y'}</span><b>${(tin - tout) >= 0 ? '+' : '−'}${fmtNum(Math.abs(tin - tout))}</b></div></div>` +
    groups.map(g => { const dn = dayNet(g.items); return `<div class="day"><div class="day-head"><span>${niceDate(g.d)}</span><span class="num" style="color:${dn >= 0 ? 'var(--good)' : 'var(--bad)'}">${dn >= 0 ? '+' : '−'}${fmtNum(Math.abs(dn))}</span></div>
      <div class="day-list">${g.items.map(walletRow).join('')}</div></div>`; }).join('');
}

/* ---------------- Entry sheet (add / edit) ---------------- */
function openEntry(type, id) {
  const ex = id ? W.entries.find(e => e.id === id) : null;
  const st = { type: ex ? ex.type : type, amount: ex ? fromMinor(ex.amount) : '', date: ex ? ex.date : today() };
  const html = `<div class="seg full wtype" id="we-type"><button data-ty="in">↓ Money in</button><button data-ty="out">↑ Money out</button></div>
    <div class="w-amt" id="we-amt-card"><div class="amt-row"><div class="amt zero" id="we-amt">0</div><div class="amt-cur">${cur().pre ? '' : esc(cur().sym)}</div></div>
      <div class="sub" id="we-after"></div></div>
    <div class="row" style="gap:8px;margin-bottom:10px">
      <div class="date-ctl" style="flex:none"><button class="icon-btn" data-wd="-1">‹</button><label class="date-chip" id="we-chip"><span>📅</span><span id="we-date-l"></span><input type="date" id="we-date"></label><button class="icon-btn" data-wd="1">›</button></div>
      <input class="field" id="we-note" placeholder="Note (optional)" maxlength="60" value="${esc(ex?.note || '')}" autocomplete="off" style="padding:10px 12px">
    </div>
    <div class="chips" id="we-sugg"></div>
    <div class="keypad" id="we-pad" style="margin-top:6px"></div>
    <div class="sheet-actions">${ex ? '<button class="btn danger" id="we-del">Delete</button>' : ''}<button class="btn primary w-save" id="we-save">Save</button></div>`;
  openSheet(html, (sh, close) => {
    const dot = cur().dec ? '.' : '000';
    $('#we-pad', sh).innerHTML = ['1', '2', '3', '4', '5', '6', '7', '8', '9', dot, '0', 'del'].map(k => `<button class="key ${k === 'del' || k === dot ? 'fn' : ''}" data-k="${k}">${k === 'del' ? '⌫' : k}</button>`).join('');
    $('#we-pad', sh).style.gridTemplateColumns = 'repeat(3,1fr)';
    const draw = () => {
      $$('#we-type button', sh).forEach(b => b.classList.toggle('on', b.dataset.ty === st.type));
      sh.dataset.ty = st.type;
      const a = st.amount; const el = $('#we-amt', sh);
      el.textContent = a ? groupInt(a.split('.')[0] || '0') + (a.includes('.') ? '.' + (a.split('.')[1] || '') : '') : '0';
      el.classList.toggle('zero', !a);
      const w = wal(); const base = balanceOf(w.id) - (ex ? signed(ex) : 0);
      const after = base + (st.type === 'in' ? 1 : -1) * toMinor(a || '0');
      $('#we-after', sh).innerHTML = `Balance after: <b style="color:${after < 0 ? 'var(--bad)' : 'inherit'}">${fmt(after)}</b>`;
      $('#we-date', sh).value = st.date; $('#we-date-l', sh).textContent = niceDate(st.date);
      $('#we-chip', sh).classList.toggle('past', st.date !== today());
      $('#we-save', sh).textContent = ex ? 'Save changes' : st.type === 'in' ? '＋ Add money in' : '－ Add money out';
      const used = {}; W.entries.filter(e => e.walletId === w.id && e.type === st.type && e.note).sort((x, y) => y.createdAt.localeCompare(x.createdAt)).forEach(e => used[e.note] = (used[e.note] || 0) + 1);
      $('#we-sugg', sh).innerHTML = Object.keys(used).slice(0, 8).map(n => `<button class="chip" data-sug="${esc(n)}">${esc(n)}</button>`).join('');
      $('#we-sugg', sh).hidden = !Object.keys(used).length;
    };
    draw();
    $('#we-date', sh).addEventListener('change', e => { if (e.target.value) { st.date = e.target.value; draw(); } });
    sh.addEventListener('click', async ev => {
      const b = ev.target.closest('button'); if (!b) return;
      if (b.dataset.ty) { st.type = b.dataset.ty; draw(); }
      else if (b.dataset.wd) { st.date = addDays(st.date, +b.dataset.wd); draw(); }
      else if (b.dataset.sug !== undefined) { $('#we-note', sh).value = b.dataset.sug; }
      else if (b.dataset.k) {
        const k = b.dataset.k; let a = st.amount;
        if (k === 'del') a = a.slice(0, -1);
        else if (k === '.') { if (!a.includes('.')) a = (a || '0') + '.'; }
        else if (a.includes('.') && a.split('.')[1].length >= cur().dec) return;
        else if (a.replace('.', '').length >= 12) return;
        else if (!a && (k === '0' || k === '000')) a = '';
        else a += k;
        st.amount = a; draw();
      }
      else if (b.id === 'we-save') {
        const amount = toMinor(st.amount || '0'); if (!amount) { shake($('#we-amt-card', sh)); return; }
        const now = new Date().toISOString(); const note = $('#we-note', sh).value.trim();
        const e = ex ? Object.assign(ex, { type: st.type, amount, date: st.date, note, updatedAt: now })
          : { id: uid(), walletId: wal().id, type: st.type, amount, date: st.date, note, createdAt: now, updatedAt: now };
        await putEntries([e]); if (!ex) W.entries.push(e); requestPersist();
        close(); walletRefresh();
        toast(`${e.type === 'in' ? '↓' : '↑'} ${sgn(e)} · balance ${fmt(balanceOf(e.walletId))}`);
      }
      else if (b.id === 'we-del') {
        await storeDel('walletTx', ex.id); W.entries = W.entries.filter(x => x.id !== ex.id); close(); walletRefresh();
        toast('Entry deleted', 'Undo', async () => { await putEntries([ex]); W.entries.push(ex); walletRefresh(); });
      }
    });
    // desktop typing
    sh.addEventListener('keydown', e => { if (e.target.matches('input')) return; if (/^[0-9]$/.test(e.key)) $(`[data-k="${e.key}"]`, sh)?.click(); else if (e.key === 'Backspace') $('[data-k="del"]', sh).click(); else if (e.key === 'Enter') $('#we-save', sh).click(); });
  });
}

/* ---------------- Wallet settings (rename, add, delete) ---------------- */
function openWalletSettings() {
  const w = wal();
  const html = `<h3>👛 Wallets</h3>
    <label class="form-l">This wallet</label>
    <div class="row"><input class="field" id="ws-icon" value="${esc(w.icon)}" style="width:60px;text-align:center;font-size:22px;padding:8px" aria-label="Emoji">
      <input class="field" id="ws-name" value="${esc(w.name)}" maxlength="24" placeholder="Wallet name"></div>
    <div class="sheet-actions" style="margin-top:10px"><button class="btn primary" id="ws-save">Save name</button></div>
    <label class="form-l">All wallets</label>
    <div class="list">${W.wallets.map(x => `<button class="item" data-wpick="${x.id}"><span>${esc(x.icon)}</span><span class="lbl">${esc(x.name)}</span><span class="val num">${fmtNum(balanceOf(x.id))}</span>${x.id === w.id ? '<span class="tag">open</span>' : ''}</button>`).join('')}
      <button class="item" id="ws-new" style="color:var(--accent);font-weight:700"><span style="font-size:20px">＋</span><span class="lbl">New wallet</span></button></div>
    ${W.wallets.length > 1 ? `<button class="btn danger block" id="ws-del" style="margin-top:16px">Delete “${esc(w.name)}” and its ${entriesOf(w.id).length} entries</button>` : ''}`;
  openSheet(html, (sh, close) => {
    sh.addEventListener('click', async ev => {
      const b = ev.target.closest('button'); if (!b) return;
      if (b.id === 'ws-save') { w.name = $('#ws-name', sh).value.trim() || w.name; w.icon = $('#ws-icon', sh).value.trim() || '👛'; await saveWallets(); close(); walletRefresh(); toast('✓ Saved'); }
      else if (b.dataset.wpick) { W.cur = b.dataset.wpick; HUB.meta.wallet = W.cur; saveHubMeta(); close(); walletRefresh(); }
      else if (b.id === 'ws-new') { close(); setTimeout(() => setupWallet(true), 300); }
      else if (b.id === 'ws-del') {
        close();
        const ok = await ask(`Delete “${w.name}”?`, `This deletes the wallet and all <b>${entriesOf(w.id).length}</b> entries in it. Back up first if unsure.`, [{ label: 'Delete wallet', value: true, cls: 'danger' }]);
        if (!ok) return;
        const t = db.transaction('walletTx', 'readwrite'); entriesOf(w.id).forEach(e => t.objectStore('walletTx').delete(e.id)); await doneP(t);
        W.entries = W.entries.filter(e => e.walletId !== w.id); W.wallets = W.wallets.filter(x => x.id !== w.id); W.cur = W.wallets[0].id;
        await saveWallets(); walletRefresh(); toast('Wallet deleted');
      }
    });
  });
}
/* First-time setup: name + what's in it right now */
function setupWallet(isExtra) {
  const html = `<h3>${isExtra ? 'New wallet' : '👛 Set up your wallet'}</h3>
    <div class="sub" style="font-size:15px;margin-bottom:6px">${isExtra ? '' : 'Give it a name and enter how much is in it right now. You can change both later.'}</div>
    <label class="form-l">Name</label>
    <div class="row"><input class="field" id="su-icon" value="👛" style="width:60px;text-align:center;font-size:22px;padding:8px" aria-label="Emoji">
      <input class="field" id="su-name" value="${isExtra ? '' : 'My wallet'}" placeholder="e.g. Petty cash" maxlength="24"></div>
    <label class="form-l">Amount in it now (${esc(S.settings.currency)})</label>
    <input class="field num" id="su-amt" inputmode="${cur().dec ? 'decimal' : 'numeric'}" placeholder="0" style="font-size:22px;font-weight:700">
    <div class="sheet-actions"><button class="btn primary" id="su-go">Create wallet</button></div>`;
  openSheet(html, (sh, close) => {
    $('#su-go', sh).onclick = async () => {
      const name = $('#su-name', sh).value.trim(); if (!name) { shake($('#su-name', sh)); return; }
      const w = { id: 'w_' + uid(), name, icon: $('#su-icon', sh).value.trim() || '👛', createdAt: new Date().toISOString() };
      W.wallets.push(w); await saveWallets(); W.cur = w.id; HUB.meta.wallet = w.id; saveHubMeta();
      const amt = toMinor($('#su-amt', sh).value);
      if (amt) { const now = new Date().toISOString(); const e = { id: uid(), walletId: w.id, type: 'in', start: true, amount: amt, date: today(), note: 'Starting balance', createdAt: now, updatedAt: now }; await putEntries([e]); W.entries.push(e); }
      close(); walletRefresh(); toast(`✓ ${name} ready`);
    };
  });
}

/* ---------------- Nav ---------------- */
function walletTab(tab) {
  W.tab = tab;
  $$('#w-tabs button').forEach(b => b.classList.toggle('on', b.dataset.tab === tab));
  $$('#app-wallet .screen').forEach(s => s.classList.toggle('on', s.id === 'ws-' + tab));
  $('#w-main').scrollTop = 0;
  walletRefresh();
}
function walletRefresh() { if (!wal()) return; if (W.tab === 'home') renderWallet(); else renderLog(); }
function walletBind() {
  $('#w-tabs').addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; if (b.dataset.tab === 'hub') openApp('hub'); else walletTab(b.dataset.tab); });
  $('#app-wallet').addEventListener('click', e => {
    const b = e.target.closest('[data-wadd],[data-wedit],[data-wtab],[data-wsel],[data-wact]'); if (!b || b.closest('.sheet')) return;
    if (b.dataset.wadd) openEntry(b.dataset.wadd);
    else if (b.dataset.wedit) openEntry(null, b.dataset.wedit);
    else if (b.dataset.wtab) walletTab(b.dataset.wtab);
    else if (b.dataset.wsel) { W.cur = b.dataset.wsel; HUB.meta.wallet = W.cur; saveHubMeta(); walletRefresh(); }
    else if (b.dataset.wact === 'settings') openWalletSettings();
  });
  $('#wl-q').addEventListener('input', e => { W.log.q = e.target.value; renderLog(); });
  $('#wl-type').addEventListener('click', e => { const b = e.target.closest('[data-t]'); if (b) { W.log.type = b.dataset.t; renderLog(); } });
  $('#wl-range').addEventListener('click', e => { const b = e.target.closest('[data-r]'); if (b) { W.log.range = b.dataset.r; renderLog(); } });
}
async function walletInit() {
  W.wallets = (await kvGet('wallets')) || [];
  W.entries = await storeAll('walletTx');
  W.cur = HUB.meta.wallet && W.wallets.find(w => w.id === HUB.meta.wallet) ? HUB.meta.wallet : W.wallets[0]?.id || null;
  walletBind();
}
APPS.wallet = { onOpen() { walletTab('home'); if (!W.wallets.length) setTimeout(() => setupWallet(false), 250); } };
