'use strict';
/* =====================================================================
   HUB · home screen, hub settings, backup/restore for every app, boot
   To add a new app later: add its tile in renderHub(), its markup in
   index.html, a new <app>.js file, and include it in doBackup/doRestore.
   ===================================================================== */
const VERSION = '2.0.0';

function greeting() { const h = new Date().getHours(); return h < 5 ? 'Good night' : h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'; }

function renderHub() {
  const now = new Date(); const t = today();
  $('#hub-date').textContent = `${WD_L[now.getDay()]}, ${now.getDate()} ${MONTHS_L[now.getMonth()]}`;
  $('#hub-hello').textContent = greeting();

  // backup reminder
  const has = S.expenses.length + N.notes.length; const lb = HUB.meta.lastBackup;
  const ago = lb ? daysBetween(ymd(new Date(lb)), t) : null;
  $('#hub-banner').innerHTML = has && (ago === null || ago > 7) ? `
    <div class="banner"><span class="ico">⚠️</span><div class="grow"><b>${ago === null ? 'No backup yet' : `Last backup ${ago} days ago`}</b><div class="sub">One file saves Finance + Notes</div></div>
    <button class="btn small primary" data-hact="backup">Back up</button></div>` : '';

  // finance stats
  const m = periodRange('month', t);
  const monthList = S.expenses.filter(e => inRange(e, m) && !isFullRefund(e));
  const monthTotal = sum(monthList); const todayTotal = sum(monthList.filter(e => e.date === t));
  // notes stats
  const c = noteCounts();
  const notesLine = c.open ? [c.overdue ? `<span class="hot">${c.overdue} overdue</span>` : '', c.today ? `${c.today} due today` : '', !c.overdue && !c.today ? `${c.open} open` : ''].filter(Boolean).join(' · ') : 'All clear ✨';

  $('#hub-apps').innerHTML = `
    <button class="app-tile finance" data-open-app="finance">
      <span class="tile-ico">💸</span>
      <span class="tile-name">Finance</span>
      <span class="tile-big">${compact(monthTotal)}${cur().pre ? '' : ' <small>' + esc(cur().sym) + '</small>'}</span>
      <span class="tile-sub">${MONTHS_L[now.getMonth()]} · ${todayTotal ? 'today ' + compact(todayTotal) : 'nothing today'}</span>
    </button>
    <button class="app-tile notes" data-open-app="notes">
      <span class="tile-ico">📝</span>
      <span class="tile-name">Notes</span>
      <span class="tile-big">${c.open}<small> open</small></span>
      <span class="tile-sub">${notesLine}</span>
    </button>
    <div class="app-tile soon"><span class="tile-ico">✨</span><span class="tile-name">More apps</span><span class="tile-sub">Your next idea goes here</span></div>`;

  // today panel: overdue + due today notes
  const due = openNotes().filter(n => n.due && n.due <= t).sort((a, b) => a.due.localeCompare(b.due));
  const quick = `<div class="quick-row">
      <button class="quick" data-hact="add-expense"><span>＋</span>Expense</button>
      <button class="quick" data-hact="add-note"><span>＋</span>Note</button></div>`;
  $('#hub-today').innerHTML = quick + `<div class="card hub-today">
    <div class="card-head"><h2>☀️ Today</h2><span class="sub">${due.length ? due.length + ' to do' : ''}</span></div>
    ${due.length ? `<div class="ncard flat">${due.slice(0, 5).map(noteRow).join('')}</div>${due.length > 5 ? `<button class="btn block small" data-open-app="notes" style="margin-top:8px">See all ${due.length}</button>` : ''}`
      : `<div class="sub" style="padding:4px 2px 2px">Nothing due today. 🎉</div>`}
    <div class="today-spend"><span>💸 Spent today</span><b class="num">${fmt(todayTotal)}</b></div>
  </div>`;
}

/* ---------------- Hub settings ---------------- */
function openHubSettings() {
  const lb = HUB.meta.lastBackup;
  const html = `<h3>⚙️ Hub settings</h3>
    <div class="lock"><span class="ico">🔒</span><div><b>Private & offline</b><div class="sub" style="margin-top:2px">${S.expenses.length} expenses and ${N.notes.length} notes stored only on this device. The app is blocked from making any network request.${HUB.meta.persisted ? ' Storage is marked persistent.' : ''}</div></div></div>
    <label class="form-l">Appearance</label>
    <div class="seg full" id="hs-theme"><button data-th="system">Match iPhone</button><button data-th="light">☀️ Light</button><button data-th="dark">🌙 Dark</button></div>
    <label class="form-l">Backup</label>
    <div class="list">
      <button class="item" data-hact="backup"><span>💾</span><span class="lbl">Back up everything</span><span class="val">${lb ? niceDate(ymd(new Date(lb))) : 'Never'}</span></button>
      <button class="item" data-hact="restore"><span>♻️</span><span class="lbl">Restore from backup</span><span class="chev">›</span></button>
    </div>
    <div class="note">The backup opens the share sheet → Save to Files → On My iPhone. Old backups from the Expenses version restore fine.</div>
    <div class="note" style="text-align:center;margin-top:14px">Hub v${VERSION}</div>`;
  openSheet(html, (sh, close) => {
    const draw = () => $$('#hs-theme button', sh).forEach(b => b.classList.toggle('on', b.dataset.th === HUB.settings.theme));
    draw();
    sh.addEventListener('click', async e => {
      const b = e.target.closest('button'); if (!b) return;
      if (b.dataset.th) { HUB.settings.theme = b.dataset.th; applyTheme(); await saveHub(); draw(); }
      else if (b.dataset.hact === 'backup') { close(); doBackup(); }
      else if (b.dataset.hact === 'restore') { close(); $('#restore-file').click(); }
    });
  });
}

/* ---------------- Backup / restore (all apps) ---------------- */
async function doBackup() {
  const data = {
    app: 'hub', version: 2, exportedAt: new Date().toISOString(),
    hub: { settings: HUB.settings },
    finance: { settings: S.settings, categories: S.cats, expenses: S.expenses },
    notes: { tags: N.tags, notes: N.notes },
  };
  const blob = new Blob([JSON.stringify(data, null, 1)], { type: 'application/json' });
  const ok = await shareOrDownload(blob, `hub-backup-${today()}.json`);
  if (ok) { HUB.meta.lastBackup = new Date().toISOString(); await saveHubMeta(); toast('✓ Backup created'); refreshAll(); }
}
async function doRestore(file) {
  let data;
  try { data = JSON.parse(await file.text()); } catch { toast('That file is not a valid backup'); return; }
  // v1 (Expenses) → same shape as v2
  if (data && data.app === 'expenses' && Array.isArray(data.expenses)) data = { app: 'hub', exportedAt: data.exportedAt, finance: { settings: data.settings, categories: data.categories, expenses: data.expenses } };
  if (!data || data.app !== 'hub') { toast('That file is not a Hub backup'); return; }
  const fx = data.finance?.expenses || [], nx = data.notes?.notes || [];
  const when = data.exportedAt ? niceDate(ymd(new Date(data.exportedAt)), true) : 'unknown date';
  const mode = await ask('Restore backup', `Backup from <b>${esc(when)}</b>: <b>${fx.length}</b> expenses, <b>${nx.length}</b> notes.<br><br><b>Merge</b> adds them to what's here. <b>Replace</b> wipes current data first.`,
    [{ label: 'Merge', value: 'merge', cls: 'primary' }, { label: 'Replace everything', value: 'replace', cls: 'danger' }]);
  if (!mode) return;

  // finance
  if (data.finance) {
    const clean = fx.filter(e => e && e.id && Number.isFinite(e.amount) && /^\d{4}-\d{2}-\d{2}$/.test(e.date))
      .map(e => ({ method: 'cash', note: '', subId: null, refunded: 0, createdAt: new Date().toISOString(), ...e }));
    const cats = data.finance.categories;
    if (mode === 'replace') {
      await storeClear('expenses'); S.expenses = [];
      if (Array.isArray(cats) && cats.length) S.cats = cats;
      if (data.finance.settings) { const { theme, ...rest } = data.finance.settings; S.settings = { ...DEFAULT_SETTINGS, ...rest }; }
    } else if (Array.isArray(cats)) {
      cats.forEach(bc => { const ex = catById(bc.id); if (!ex) S.cats.push({ ...bc, order: S.cats.length });
        else bc.subs?.forEach(bs => { if (!ex.subs.find(s => s.id === bs.id)) ex.subs.push(bs); }); });
    }
    await putExpenses(clean);
    const map = new Map(S.expenses.map(e => [e.id, e])); clean.forEach(e => map.set(e.id, e)); S.expenses = [...map.values()];
    await saveCats(); await saveSettings();
  }
  // notes
  if (data.notes) {
    const clean = nx.filter(n => n && n.id && typeof n.text === 'string');
    if (mode === 'replace') { await storeClear('notes'); N.notes = []; if (Array.isArray(data.notes.tags)) N.tags = data.notes.tags; }
    else (data.notes.tags || []).forEach(t => { if (!tagById(t.id)) N.tags.push(t); });
    await putNotes(clean);
    const map = new Map(N.notes.map(n => [n.id, n])); clean.forEach(n => map.set(n.id, n)); N.notes = [...map.values()];
    await saveTags();
  }
  if (mode === 'replace' && data.hub?.settings) { HUB.settings = { ...HUB.settings, ...data.hub.settings }; await saveHub(); applyTheme(); }
  toast(`✓ Restored ${fx.length} expenses, ${nx.length} notes`); refreshAll();
}

function refreshAll() {
  if (HUB.app === 'hub') renderHub();
  if (HUB.app === 'finance') refresh();
  if (HUB.app === 'notes') notesRefresh();
}

/* ---------------- Boot ---------------- */
APPS.hub = { onOpen() { renderHub(); } };
async function boot() {
  try { db = await openDB(); }
  catch (err) { document.body.innerHTML = `<div style="padding:40px;font-family:system-ui">Storage is unavailable. Don't use Private Browsing.<br><small>${esc(err && err.message)}</small></div>`; return; }
  const hs = await kvGet('hub');
  if (hs) HUB.settings = { ...HUB.settings, ...hs };
  else { const old = await kvGet('settings'); if (old && old.theme) HUB.settings.theme = old.theme; await saveHub(); } // v1 → v2
  HUB.meta = (await kvGet('hubMeta')) || {};
  applyTheme();
  await financeInit();
  await notesInit();
  if (!HUB.meta.lastBackup && S.meta.lastBackup) { HUB.meta.lastBackup = S.meta.lastBackup; saveHubMeta(); }

  $('#app-hub').addEventListener('click', e => {
    const b = e.target.closest('[data-open-app],[data-hact],[data-check],[data-open]'); if (!b) return;
    if (b.dataset.openApp) openApp(b.dataset.openApp);
    else if (b.dataset.check) toggleDone(b.dataset.check, true);
    else if (b.dataset.open) { openApp('notes'); openNote(b.dataset.open); }
    else if (b.dataset.hact === 'backup') doBackup();
    else if (b.dataset.hact === 'settings') openHubSettings();
    else if (b.dataset.hact === 'add-expense') openApp('finance');
    else if (b.dataset.hact === 'add-note') { openApp('notes'); setTimeout(() => $('#n-text').focus(), 50); }
  });
  $('#restore-file').addEventListener('change', e => { const f = e.target.files[0]; e.target.value = ''; if (f) doRestore(f); });

  // Coming back to the app on a new day → start fresh at the Hub
  let lastDay = today();
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) return;
    if (today() !== lastDay) { lastDay = today(); S.add.date = today(); S.dash.anchor = today(); N.draft.due = today(); }
    refreshAll();
  });
  openApp('hub');
}
boot();

if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {});
