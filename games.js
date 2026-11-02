'use strict';
/* =====================================================================
   HUB · GAMES app — the shelf, play screen, scores and auto-save.
   Each game lives in its own file (g-*.js) and registers itself with
   GAMES.push({ id, name, emoji, grad, tagline, stat(d), open(ctx) }).
   open(ctx) must return { close() } and may use:
     ctx.el      – the board area          ctx.bar  – top-right buttons area
     ctx.d       – this game's saved data   ctx.save() – persist ctx.d
     ctx.over({ emoji, title, lines, again, label }) – end-of-game card
     ctx.rng     – Math.random or a seeded generator for daily games
   ===================================================================== */
const GAMES = [];
const G = { data: {}, open: null, current: null, timer: null };
const gameData = id => (G.data[id] = G.data[id] || { played: 0, wins: 0, best: null });
let gSaveT;
function gamesSave() { clearTimeout(gSaveT); gSaveT = setTimeout(() => kvSet('games', G.data), 250); }

/* Seeded random (for daily puzzles: same puzzle all day) */
function mulberry32(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const daySeed = (s = today()) => +s.replace(/-/g, '');
const shuffle = (arr, rnd = Math.random) => { for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; } return arr; };
const fmtTime = s => `${Math.floor(s / 60)}:${pad(s % 60)}`;

/* Swipe helper: calls fn('left'|'right'|'up'|'down'); blocks page scrolling on el */
function onSwipe(el, fn, min = 24) {
  let sx = 0, sy = 0, active = false;
  el.addEventListener('touchstart', e => { const t = e.touches[0]; sx = t.clientX; sy = t.clientY; active = true; }, { passive: true });
  el.addEventListener('touchmove', e => { if (active) e.preventDefault(); }, { passive: false });
  el.addEventListener('touchend', e => {
    if (!active) return; active = false;
    const t = e.changedTouches[0]; const dx = t.clientX - sx, dy = t.clientY - sy;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < min) return;
    fn(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up'));
  });
  // mouse (desktop testing)
  let md = null;
  el.addEventListener('mousedown', e => md = { x: e.clientX, y: e.clientY });
  el.addEventListener('mouseup', e => { if (!md) return; const dx = e.clientX - md.x, dy = e.clientY - md.y; md = null; if (Math.max(Math.abs(dx), Math.abs(dy)) < min) return; fn(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up')); });
}

/* ---------------- Shelf ---------------- */
function renderShelf() {
  const t = today();
  const sd = gameData('sudoku'), wd = gameData('words');
  if (wd.streak && wd.lastDailyWin && wd.lastDailyWin < addDays(t, -1)) { wd.streak = 0; gamesSave(); } // missed a day
  const sDone = sd.dailyDone === t, wDone = wd.daily && wd.daily.date === t && wd.daily.over;
  $('#g-daily').innerHTML = `
    <div class="g-daily">
      <div class="g-daily-head"><span>🏆 Today's challenges</span><span class="sub">${(sDone ? 1 : 0) + (wDone ? 1 : 0)}/2 done</span></div>
      <div class="g-daily-row">
        <button class="g-dchip ${sDone ? 'done' : ''}" data-play="sudoku" data-daily="1"><span class="e">🔢</span><span><b>Daily Sudoku</b><small>${sDone ? 'Solved ✓' : 'Medium · same puzzle all day'}</small></span></button>
        <button class="g-dchip ${wDone ? 'done' : ''}" data-play="words" data-daily="1"><span class="e">🔤</span><span><b>Daily Word</b><small>${wDone ? (wd.daily.won ? 'Got it ✓' : 'Tomorrow 🙂') : '6 tries · new word daily'}</small></span></button>
      </div>
      ${wd.streak ? `<div class="g-streak">🔥 Word streak: <b>${wd.streak}</b> day${wd.streak > 1 ? 's' : ''}</div>` : ''}
    </div>`;
  $('#g-shelf').innerHTML = GAMES.map(g => {
    const d = gameData(g.id); const cont = d.save && !d.save.over;
    return `<button class="g-card" data-play="${g.id}" style="--gg:${g.grad}">
      ${cont ? '<span class="g-cont">▶ Continue</span>' : ''}
      <span class="g-emoji">${g.emoji}</span>
      <span class="g-name">${esc(g.name)}</span>
      <span class="g-tag">${esc(g.tagline)}</span>
      <span class="g-stat">${g.stat(d) || (d.played ? `Played ${d.played}×` : 'Not played yet')}</span></button>`;
  }).join('');
}
function renderGameStats() {
  const tot = GAMES.reduce((s, g) => s + (gameData(g.id).played || 0), 0);
  $('#g-stats').innerHTML = `<div class="hero g-hero"><div class="lbl">Games played</div><div class="big">${tot}</div>
      <div class="hero-stats"><div class="hero-stat"><b>${GAMES.filter(g => gameData(g.id).played).length}/${GAMES.length}</b><span>games tried</span></div>
      <div class="hero-stat"><b>${gameData('words').streak || 0}🔥</b><span>word streak</span></div>
      <div class="hero-stat"><b>${GAMES.reduce((s, g) => s + (gameData(g.id).wins || 0), 0)}</b><span>wins</span></div></div></div>
    <div class="list">${GAMES.map(g => { const d = gameData(g.id); return `<button class="item" data-play="${g.id}"><span class="g-mini" style="--gg:${g.grad}">${g.emoji}</span>
      <span class="lbl"><b>${esc(g.name)}</b><div class="sub">${g.stat(d) || (d.played ? `Played ${d.played}×` : 'Not played yet')}</div></span><span class="val num">${d.played || 0}×</span></button>`; }).join('')}</div>
    <div class="note">Scores and saved games are included in your Hub backup.</div>
    <button class="btn danger block" data-gact="reset" style="margin-top:14px">Reset all game scores</button>`;
}

/* ---------------- Play screen ---------------- */
function playGame(id, opts = {}) {
  const g = GAMES.find(x => x.id === id); if (!g) return;
  closeGame();
  $('#app-games').classList.add('playing');
  $('#g-title').innerHTML = `<span>${g.emoji}</span> ${esc(g.name)}`;
  $('#g-play').style.setProperty('--gg', g.grad);
  const el = $('#g-board'); el.innerHTML = ''; el.className = 'g-board g-' + id;
  const bar = $('#g-bar'); bar.innerHTML = '';
  $('#g-over').hidden = true;
  const d = gameData(id);
  const ctx = {
    el, bar, d, opts, save: gamesSave,
    rng: opts.daily ? mulberry32(daySeed() * 7 + id.length) : Math.random,
    over: o => showOver(o),
    button(label, fn, title) { const b = document.createElement('button'); b.className = 'g-bbtn'; b.innerHTML = label; if (title) b.setAttribute('aria-label', title); b.onclick = fn; bar.appendChild(b); return b; },
  };
  G.open = g; G.current = g.open(ctx) || {};
}
function closeGame() {
  if (G.current && G.current.close) try { G.current.close(); } catch {}
  G.current = null; G.open = null;
  $('#app-games').classList.remove('playing');
  $('#g-over').hidden = true;
}
function showOver({ emoji = '🎉', title = 'Game over', lines = [], again, label = 'Play again' }) {
  const o = $('#g-over');
  o.innerHTML = `<div class="g-over-card"><div class="g-over-emoji">${emoji}</div><h2>${esc(title)}</h2>
    ${lines.map(l => `<div class="g-over-line">${l}</div>`).join('')}
    <div class="sheet-actions"><button class="btn" data-gact="shelf">Games</button>${again ? `<button class="btn primary" data-gact="again">${esc(label)}</button>` : ''}</div></div>`;
  o.hidden = false;
  $('[data-gact="again"]', o)?.addEventListener('click', () => { o.hidden = true; again(); });
}

/* ---------------- Nav ---------------- */
function gamesTab(tab) {
  closeGame();
  $$('#g-tabs button').forEach(b => b.classList.toggle('on', b.dataset.tab === tab));
  $$('#app-games .screen').forEach(s => s.classList.toggle('on', s.id === 'gs-' + tab));
  $('#g-main').scrollTop = 0;
  if (tab === 'shelf') renderShelf(); else renderGameStats();
}
function gamesBind() {
  $('#g-tabs').addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; if (b.dataset.tab === 'hub') { closeGame(); openApp('hub'); } else gamesTab(b.dataset.tab); });
  $('#g-back').onclick = () => gamesTab('shelf');
  $('#app-games').addEventListener('click', async e => {
    const b = e.target.closest('[data-play],[data-gact]'); if (!b || b.closest('.sheet')) return;
    if (b.dataset.play) playGame(b.dataset.play, { daily: !!b.dataset.daily });
    else if (b.dataset.gact === 'shelf') gamesTab('shelf');
    else if (b.dataset.gact === 'reset') {
      const ok = await ask('Reset all game scores?', 'Best scores, stats, streaks and saved games will be cleared.', [{ label: 'Reset', value: true, cls: 'danger' }]);
      if (ok) { G.data = {}; await kvSet('games', G.data); renderGameStats(); toast('Scores reset'); }
    }
  });
  document.addEventListener('visibilitychange', () => { if (document.hidden && G.current && G.current.pause) G.current.pause(); });
}
async function gamesInit() { G.data = (await kvGet('games')) || {}; gamesBind(); }
APPS.games = { onOpen() { gamesTab('shelf'); } };
