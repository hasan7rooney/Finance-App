'use strict';
/* =====================================================================
   HUB · NOTES app — quick notes with deadlines, tags, pin, done list
   ===================================================================== */

const DEFAULT_TAGS = [
  { id: 't_personal', name: 'Personal', icon: '🙂', color: 'c1' },
  { id: 't_work', name: 'Work', icon: '💼', color: 'c7' },
  { id: 't_ideas', name: 'Ideas', icon: '💡', color: 'c4' },
  { id: 't_errands', name: 'Errands', icon: '🛒', color: 'c3' },
  { id: 't_family', name: 'Family', icon: '❤️', color: 'c8' },
];
const N = { notes: [], tags: [], tab: 'todo', tagFilter: '', draft: { due: null, tag: null }, bound: false };
const saveTags = () => kvSet('noteTags', N.tags);
const putNotes = list => storePut('notes', list);
const tagById = id => N.tags.find(t => t.id === id);
const tagCol = t => t ? `var(--${t.color})` : 'var(--n-accent)';

/* ---------------- Deadline helpers ---------------- */
const GROUPS = [
  { k: 'pinned', label: 'Pinned', icon: '📌', c: 'var(--c4)' },
  { k: 'overdue', label: 'Overdue', icon: '⏰', c: 'var(--bad)' },
  { k: 'today', label: 'Today', icon: '☀️', c: 'var(--c2)' },
  { k: 'tomorrow', label: 'Tomorrow', icon: '🌙', c: 'var(--c1)' },
  { k: 'week', label: 'This week', icon: '🗓️', c: 'var(--c3)' },
  { k: 'later', label: 'Later', icon: '🔭', c: 'var(--c7)' },
  { k: 'nodate', label: 'No date', icon: '📝', c: 'var(--gray)' },
];
function groupOf(n) {
  if (n.pinned) return 'pinned';
  if (!n.due) return 'nodate';
  const d = daysBetween(today(), n.due);
  if (d < 0) return 'overdue';
  if (d === 0) return 'today';
  if (d === 1) return 'tomorrow';
  if (d <= 6) return 'week';
  return 'later';
}
function dueInfo(n) {
  if (!n.due) return null;
  const d = daysBetween(today(), n.due);
  if (d < 0) return { t: d === -1 ? 'Due yesterday' : `${-d} days late`, cls: 'late' };
  if (d === 0) return { t: 'Due today', cls: 'today' };
  if (d === 1) return { t: 'Tomorrow', cls: 'soon' };
  const dt = parse(n.due);
  if (d <= 6) return { t: `${WD_L[dt.getDay()]} · in ${d} days`, cls: 'soon' };
  return { t: `${WD[dt.getDay()]}, ${dt.getDate()} ${MONTHS[dt.getMonth()]}${dt.getFullYear() !== new Date().getFullYear() ? ' ' + dt.getFullYear() : ''} · in ${d} days`, cls: '' };
}
const openNotes = () => N.notes.filter(n => !n.done);
function noteCounts() {
  const o = openNotes(); const t = today();
  return {
    overdue: o.filter(n => n.due && n.due < t).length,
    today: o.filter(n => n.due === t).length,
    upcoming: o.filter(n => n.due && n.due > t).length,
    open: o.length,
    done: N.notes.filter(n => n.done).length,
  };
}

/* ---------------- Day strip (used in composer + edit sheet) ---------------- */
function dayStrip(selected, id) {
  const t = today(); let h = `<div class="daystrip" id="${id}">`;
  h += `<button class="day-chip nodate ${!selected ? 'on' : ''}" data-day=""><span class="dw">No</span><span class="dn">—</span><span class="dm">date</span></button>`;
  for (let i = 0; i < 14; i++) {
    const s = addDays(t, i); const d = parse(s);
    h += `<button class="day-chip ${s === selected ? 'on' : ''} ${i === 0 ? 'is-today' : ''}" data-day="${s}">
      <span class="dw">${i === 0 ? 'Today' : i === 1 ? 'Tmrw' : WD[d.getDay()]}</span><span class="dn">${d.getDate()}</span><span class="dm">${MONTHS[d.getMonth()]}</span></button>`;
  }
  const far = selected && daysBetween(t, selected) >= 14 || (selected && selected < t);
  h += `<label class="day-chip pick ${far ? 'on' : ''}"><span class="dw">${far ? WD[parse(selected).getDay()] : 'Pick'}</span><span class="dn">${far ? parse(selected).getDate() : '📅'}</span><span class="dm">${far ? MONTHS[parse(selected).getMonth()] : 'date'}</span><input type="date" data-pick value="${selected || ''}"></label>`;
  return h + '</div>';
}
function tagChips(selected, id, withNone = true) {
  return `<div class="chips tagrow" id="${id}">${withNone ? `<button class="chip ${!selected ? 'on' : ''}" data-tag="">No tag</button>` : ''}` +
    N.tags.map(t => `<button class="chip ${t.id === selected ? 'on' : ''}" data-tag="${t.id}" style="--c:${tagCol(t)}">${esc(t.icon)} ${esc(t.name)}</button>`).join('') + `</div>`;
}

/* ---------------- Render: To do ---------------- */
function renderNotes() {
  const c = noteCounts(); const now = new Date();
  $('#n-date').textContent = `${WD_L[now.getDay()]}, ${now.getDate()} ${MONTHS_L[now.getMonth()]}`;
  $('#n-stats').innerHTML = `
    <button class="nstat ${c.overdue ? 'hot' : ''}" data-jump="overdue" style="--c:var(--bad)"><b>${c.overdue}</b><span>Overdue</span></button>
    <button class="nstat" data-jump="today" style="--c:var(--c2)"><b>${c.today}</b><span>Today</span></button>
    <button class="nstat" data-jump="upcoming" style="--c:var(--c1)"><b>${c.upcoming}</b><span>Upcoming</span></button>
    <button class="nstat" data-jump="done" style="--c:var(--good)"><b>${c.done}</b><span>Done</span></button>`;
  renderComposer();
  // tag filter
  const usedTags = N.tags.filter(t => openNotes().some(n => n.tag === t.id));
  if (N.tagFilter && !usedTags.find(t => t.id === N.tagFilter)) N.tagFilter = '';
  $('#n-filter').innerHTML = usedTags.length ? `<button class="chip ${!N.tagFilter ? 'on' : ''}" data-tf="">All</button>` +
    usedTags.map(t => `<button class="chip ${t.id === N.tagFilter ? 'on' : ''}" data-tf="${t.id}" style="--c:${tagCol(t)}">${esc(t.icon)} ${esc(t.name)}</button>`).join('') : '';
  $('#n-filter').hidden = !usedTags.length;

  const list = openNotes().filter(n => !N.tagFilter || n.tag === N.tagFilter)
    .sort((a, b) => (a.due || '9999') .localeCompare(b.due || '9999') || b.createdAt.localeCompare(a.createdAt));
  if (!list.length) {
    $('#n-list').innerHTML = `<div class="n-empty"><div class="big-emoji">✨</div><b>${N.notes.length ? 'All clear!' : 'No notes yet'}</b><div class="sub">${N.notes.length ? 'Nothing left to do. Enjoy it.' : 'Write your first note above.'}</div></div>`;
    return;
  }
  $('#n-list').innerHTML = GROUPS.map(g => {
    const items = list.filter(n => groupOf(n) === g.k); if (!items.length) return '';
    return `<div class="ngroup" id="ng-${g.k}" style="--g:${g.c}">
      <div class="ngroup-head"><span class="gico">${g.icon}</span><span class="gname">${g.label}</span><span class="gcount">${items.length}</span></div>
      <div class="ncard">${items.map(noteRow).join('')}</div></div>`;
  }).join('');
}
function noteRow(n) {
  const t = tagById(n.tag); const di = n.done ? (n.due ? { t: 'Was due ' + niceDate(n.due).replace('Today', 'today').replace('Yesterday', 'yesterday').replace('Tomorrow', 'tomorrow'), cls: '' } : null) : dueInfo(n);
  const meta = [di ? `<span class="due ${di.cls}">${di.cls === 'late' ? '⏰ ' : ''}${esc(di.t)}</span>` : '',
    t ? `<span class="ntag" style="--c:${tagCol(t)}">${esc(t.icon)} ${esc(t.name)}</span>` : ''].join('');
  return `<div class="nrow ${n.done ? 'done' : ''}" data-nid="${n.id}" style="--c:${t ? tagCol(t) : 'var(--g)'}">
    <button class="check" data-check="${n.id}" aria-label="${n.done ? 'Mark not done' : 'Mark done'}"><svg viewBox="0 0 24 24"><path d="m6 12.5 4 4 8-9"/></svg></button>
    <button class="nbody" data-open="${n.id}"><div class="ntext">${esc(n.text)}</div>${meta ? `<div class="nmeta">${meta}</div>` : ''}</button>
    ${n.pinned && !n.done ? '<span class="pin">📌</span>' : ''}</div>`;
}

/* ---------------- Composer ---------------- */
function renderComposer(keep) {
  const x = $('#n-days').scrollLeft, tx = $('#n-tags').scrollLeft;
  $('#n-days').outerHTML = dayStrip(N.draft.due, 'n-days');
  $('#n-tags').outerHTML = tagChips(N.draft.tag, 'n-tags');
  if (keep) $('#n-tags').scrollLeft = tx;
  if (keep) $('#n-days').scrollLeft = x; else fitStrip($('#n-days'));
  $('#n-add').disabled = !$('#n-text').value.trim();
}
// Keep the strip starting at "No date" unless the chosen day is off-screen; never leave a chip half-cut on the left
function fitStrip(strip) {
  if (!strip) return;
  const sel = $('.on', strip); strip.scrollLeft = 0;
  if (!sel) return;
  const over = sel.offsetLeft + sel.offsetWidth - (strip.clientWidth - 16);
  if (over > 0) strip.scrollLeft = sel.offsetLeft - 16 - 60;
}
function autoGrow(el) { el.style.height = 'auto'; el.style.height = Math.min(el.scrollHeight, 140) + 'px'; }
async function addNote() {
  const ta = $('#n-text'); const text = ta.value.trim();
  if (!text) { shake($('#n-composer')); ta.focus(); return; }
  const now = new Date().toISOString();
  const n = { id: uid(), text, due: N.draft.due || null, tag: N.draft.tag || null, pinned: false, done: false, doneAt: null, createdAt: now, updatedAt: now };
  await putNotes([n]); N.notes.push(n); requestPersist();
  ta.value = ''; autoGrow(ta);
  const di = dueInfo(n);
  toast(`✓ Added${di ? ' · ' + di.t : ''}`);
  renderNotes();
  const el = $(`[data-nid="${n.id}"]`); if (el) { el.classList.add('pop'); }
}

/* ---------------- Done ---------------- */
async function toggleDone(id, fromHub) {
  const n = N.notes.find(x => x.id === id); if (!n) return;
  const row = $$(`[data-nid="${id}"]`);
  const becomingDone = !n.done;
  row.forEach(r => r.classList.add(becomingDone ? 'checking' : 'unchecking'));
  n.done = becomingDone; n.doneAt = becomingDone ? new Date().toISOString() : null; n.updatedAt = new Date().toISOString();
  await putNotes([n]);
  setTimeout(() => {
    row.forEach(r => r.classList.add('leaving'));
    setTimeout(() => { notesRefresh(); fromHub && renderHub(); }, 260);
  }, 420);
  toast(becomingDone ? '✓ Done — nice!' : '↺ Back to your notes', 'Undo', async () => {
    n.done = !becomingDone; n.doneAt = n.done ? new Date().toISOString() : null; await putNotes([n]); notesRefresh(); renderHub();
  });
}
function renderDone() {
  const done = N.notes.filter(n => n.done).sort((a, b) => (b.doneAt || '').localeCompare(a.doneAt || ''));
  const weekAgo = addDays(today(), -6);
  const thisWeek = done.filter(n => n.doneAt && ymd(new Date(n.doneAt)) >= weekAgo).length;
  $('#nd-sum').innerHTML = done.length ? `<div class="done-hero"><div><b>${done.length}</b><span>completed</span></div><div><b>${thisWeek}</b><span>this week</span></div>
    <button class="btn small" data-nact="clear-done">Clear all</button></div>` : '';
  if (!done.length) { $('#nd-list').innerHTML = `<div class="n-empty"><div class="big-emoji">🏁</div><b>Nothing done yet</b><div class="sub">Tick a note and it lands here.</div></div>`; return; }
  const groups = []; let g;
  done.forEach(n => { const local = ymd(new Date(n.doneAt || n.updatedAt)); if (!g || g.d !== local) { g = { d: local, items: [] }; groups.push(g); } g.items.push(n); });
  $('#nd-list').innerHTML = groups.map(g => `<div class="ngroup" style="--g:var(--good)"><div class="ngroup-head"><span class="gname">${niceDate(g.d)}</span><span class="gcount">${g.items.length}</span></div>
    <div class="ncard">${g.items.map(noteRow).join('')}</div></div>`).join('');
}

/* ---------------- Edit sheet ---------------- */
function openNote(id) {
  const n = N.notes.find(x => x.id === id); if (!n) return;
  const st = { due: n.due, tag: n.tag, pinned: !!n.pinned };
  const html = `<h3>${n.done ? 'Done note' : 'Edit note'}</h3>
    <textarea class="field ntextarea" id="ne-text" rows="3" maxlength="500">${esc(n.text)}</textarea>
    <label class="form-l">Deadline</label>
    <div id="ne-days-wrap">${dayStrip(st.due, 'ne-days')}</div>
    <label class="form-l">Tag</label>
    <div id="ne-tags-wrap">${tagChips(st.tag, 'ne-tags')}</div>
    <div class="item" style="padding:12px 4px 0;border:0"><span class="lbl">📌 Pin to top</span><label class="toggle"><input type="checkbox" id="ne-pin" ${st.pinned ? 'checked' : ''}><span></span></label></div>
    <div class="sub" style="margin:10px 4px 0">Created ${niceDate(ymd(new Date(n.createdAt)))}${n.done && n.doneAt ? ' · done ' + niceDate(ymd(new Date(n.doneAt))) : ''}</div>
    <div class="sheet-actions"><button class="btn danger" id="ne-del">Delete</button>
      ${n.done ? '<button class="btn" id="ne-undone">Not done</button>' : '<button class="btn" id="ne-done">✓ Done</button>'}
      <button class="btn primary" id="ne-save">Save</button></div>`;
  openSheet(html, (sh, close) => {
    const ta = $('#ne-text', sh); autoGrow(ta); ta.addEventListener('input', () => autoGrow(ta));
    fitStrip($('#ne-days', sh));
    const redraw = () => { const x = $('#ne-days', sh).scrollLeft, tx = $('#ne-tags', sh).scrollLeft; $('#ne-days-wrap', sh).innerHTML = dayStrip(st.due, 'ne-days'); $('#ne-days', sh).scrollLeft = x; $('#ne-tags-wrap', sh).innerHTML = tagChips(st.tag, 'ne-tags'); $('#ne-tags', sh).scrollLeft = tx; };
    sh.addEventListener('change', e => { if (e.target.matches('[data-pick]') && e.target.value) { st.due = e.target.value; redraw(); } });
    sh.addEventListener('click', async e => {
      const b = e.target.closest('button'); if (!b) return;
      if (b.dataset.day !== undefined) { st.due = b.dataset.day || null; redraw(); }
      else if (b.dataset.tag !== undefined) { st.tag = b.dataset.tag || null; redraw(); }
      else if (b.id === 'ne-save') {
        const text = ta.value.trim(); if (!text) { shake(ta); return; }
        Object.assign(n, { text, due: st.due, tag: st.tag, pinned: $('#ne-pin', sh).checked, updatedAt: new Date().toISOString() });
        await putNotes([n]); close(); toast('✓ Saved'); notesRefresh();
      } else if (b.id === 'ne-done' || b.id === 'ne-undone') { close(); setTimeout(() => toggleDone(n.id), 250); }
      else if (b.id === 'ne-del') {
        await storeDel('notes', n.id); N.notes = N.notes.filter(x => x.id !== n.id); close(); notesRefresh();
        toast('Note deleted', 'Undo', async () => { await putNotes([n]); N.notes.push(n); notesRefresh(); });
      }
    });
  });
}

/* ---------------- Tags manager ---------------- */
function openTags() {
  const tags = JSON.parse(JSON.stringify(N.tags));
  const html = `<h3>🏷️ Tags</h3><div id="tg-list"></div>
    <button class="btn small" id="tg-add" style="margin-top:4px">＋ Add tag</button>
    <div class="sheet-actions"><button class="btn primary" id="tg-save">Save tags</button></div>`;
  openSheet(html, (sh, close) => {
    const draw = () => {
      $('#tg-list', sh).innerHTML = tags.map((t, i) => `<div class="tag-edit" style="--c:var(--${t.color})">
        <div class="row"><input class="field" data-ti="${i}" data-f="icon" value="${esc(t.icon)}" style="width:56px;text-align:center;font-size:20px;padding:8px">
          <input class="field" data-ti="${i}" data-f="name" value="${esc(t.name)}" placeholder="Tag name" maxlength="18">
          <button class="btn small" data-tdel="${i}" aria-label="Delete tag">✕</button></div>
        <div class="swatches" style="margin-top:8px">${COLORS.map(k => `<button class="sw sm ${k === t.color ? 'on' : ''}" data-tcol="${i}" data-k="${k}" style="--c:var(--${k})" aria-label="${k}"></button>`).join('')}</div></div>`).join('')
        || '<div class="sub" style="margin:4px">No tags</div>';
    };
    draw();
    sh.addEventListener('input', e => { const i = e.target.dataset.ti; if (i !== undefined) tags[+i][e.target.dataset.f] = e.target.value; });
    sh.addEventListener('click', async e => {
      const b = e.target.closest('button'); if (!b) return;
      if (b.dataset.tcol !== undefined) { tags[+b.dataset.tcol].color = b.dataset.k; draw(); }
      else if (b.dataset.tdel !== undefined) { tags.splice(+b.dataset.tdel, 1); draw(); }
      else if (b.id === 'tg-add') { tags.push({ id: 't_' + uid(), name: '', icon: '🏷️', color: COLORS[tags.length % 8] }); draw(); $$('[data-f="name"]', sh).pop().focus(); }
      else if (b.id === 'tg-save') {
        N.tags = tags.filter(t => t.name.trim()).map(t => ({ ...t, name: t.name.trim(), icon: t.icon.trim() || '🏷️' }));
        const ids = new Set(N.tags.map(t => t.id)); const orphan = N.notes.filter(n => n.tag && !ids.has(n.tag));
        orphan.forEach(n => n.tag = null); if (orphan.length) await putNotes(orphan);
        if (N.draft.tag && !ids.has(N.draft.tag)) N.draft.tag = null;
        await saveTags(); close(); toast('✓ Tags saved'); notesRefresh();
      }
    });
  });
}

/* ---------------- Nav ---------------- */
function notesTab(tab) {
  N.tab = tab;
  $$('#n-tabs button').forEach(b => b.classList.toggle('on', b.dataset.tab === tab));
  $$('#app-notes .screen').forEach(s => s.classList.toggle('on', s.id === 'ns-' + tab));
  $('#n-main').scrollTop = 0;
  notesRefresh();
}
function notesRefresh() {
  if (N.tab === 'todo') renderNotes(); else renderDone();
  const c = noteCounts(); const badge = $('#n-done-badge'); badge.textContent = c.done; badge.hidden = !c.done;
}
function notesBind() {
  $('#n-tabs').addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; if (b.dataset.tab === 'hub') openApp('hub'); else notesTab(b.dataset.tab); });
  const ta = $('#n-text');
  ta.addEventListener('input', () => { autoGrow(ta); $('#n-add').disabled = !ta.value.trim(); });
  ta.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey && window.matchMedia('(pointer:fine)').matches) { e.preventDefault(); addNote(); } });
  $('#n-add').onclick = addNote;
  $('#n-composer').addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.day !== undefined) { N.draft.due = b.dataset.day || null; renderComposer(true); }
    else if (b.dataset.tag !== undefined) { N.draft.tag = b.dataset.tag || null; renderComposer(true); }
  });
  $('#n-composer').addEventListener('change', e => { if (e.target.matches('[data-pick]') && e.target.value) { N.draft.due = e.target.value; renderComposer(); } });
  $('#app-notes').addEventListener('click', e => {
    const b = e.target.closest('[data-check],[data-open],[data-tf],[data-jump],[data-nact]'); if (!b || b.closest('.sheet')) return;
    if (b.dataset.check) toggleDone(b.dataset.check);
    else if (b.dataset.open) openNote(b.dataset.open);
    else if (b.dataset.tf !== undefined) { N.tagFilter = b.dataset.tf; renderNotes(); }
    else if (b.dataset.jump) {
      if (b.dataset.jump === 'done') return notesTab('done');
      const target = b.dataset.jump === 'upcoming' ? ($('#ng-tomorrow') || $('#ng-week') || $('#ng-later')) : $('#ng-' + b.dataset.jump);
      if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' }); else toast('Nothing there');
    }
    else if (b.dataset.nact === 'tags') openTags();
    else if (b.dataset.nact === 'clear-done') clearDone();
  });
}
async function clearDone() {
  const done = N.notes.filter(n => n.done);
  const ok = await ask('Clear done notes?', `Deletes all <b>${done.length}</b> completed notes.`, [{ label: 'Clear all', value: true, cls: 'danger' }]);
  if (!ok) return;
  const t = db.transaction('notes', 'readwrite'); done.forEach(n => t.objectStore('notes').delete(n.id)); await doneP(t);
  N.notes = N.notes.filter(n => !n.done); notesRefresh(); toast('Cleared');
}

async function notesInit() {
  N.tags = (await kvGet('noteTags')) || null;
  if (!N.tags) { N.tags = DEFAULT_TAGS.map(t => ({ ...t })); await saveTags(); }
  N.notes = await storeAll('notes');
  N.draft.due = today();
  notesBind();
}
APPS.notes = { onOpen() { if (!N.draft.due || N.draft.due < today()) N.draft.due = today(); notesTab('todo'); } };
