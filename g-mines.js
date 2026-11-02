'use strict';
/* Minesweeper — tap to open, long-press (or flag mode) to flag. First tap is always safe. */
GAMES.push({
  id: 'mines', name: 'Minesweeper', emoji: '💣', grad: 'linear-gradient(135deg,#868e96,#343a40)', tagline: 'Find every safe square',
  stat: d => { const b = d.bestTime || {}; const p = [['easy', 'Easy'], ['medium', 'Med'], ['hard', 'Hard']].filter(([k]) => b[k]).map(([k, l]) => `${l} ${fmtTime(b[k])}`); return p.length ? 'Best ' + p.join(' · ') : (d.played ? `${d.wins}/${d.played} won` : ''); },
  open(ctx) {
    const LV = { easy: { c: 8, r: 10, m: 10 }, medium: { c: 10, r: 14, m: 24 }, hard: { c: 12, r: 18, m: 42 } };
    let S_, timer, flagMode = false;
    ctx.el.innerHTML = `<div class="ms-top"><span id="ms-left">💣 0</span><button class="ms-face" id="ms-face">🙂</button><span id="ms-time">⏱ 0:00</span></div>
      <div class="ms-wrap"><div class="ms-grid" id="ms-grid"></div></div>
      <div class="seg full ms-mode" id="ms-mode"><button data-mm="dig" class="on">⛏️ Dig</button><button data-mm="flag">🚩 Flag</button></div>
      <div class="g-hint">Long-press a square to flag it</div>`;
    const grid = $('#ms-grid');
    const persist = () => { ctx.d.save = S_; ctx.save(); };
    function start(level) {
      const L = LV[level]; S_ = { level, ...L, mines: null, open: Array(L.c * L.r).fill(0), flag: Array(L.c * L.r).fill(0), time: 0, over: false, started: false };
      ctx.d.lastLevel = level; build(); draw(); persist(); clearInterval(timer);
    }
    const nb = i => { const { c, r } = S_; const x = i % c, y = Math.floor(i / c), out = []; for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { if (!dx && !dy) continue; const nx = x + dx, ny = y + dy; if (nx >= 0 && nx < c && ny >= 0 && ny < r) out.push(ny * c + nx); } return out; };
    const count = i => nb(i).filter(j => S_.mines[j]).length;
    function build() {
      grid.style.gridTemplateColumns = `repeat(${S_.c},1fr)`;
      grid.innerHTML = Array.from({ length: S_.c * S_.r }, (_, i) => `<button class="ms-cell" data-i="${i}"></button>`).join('');
    }
    function plant(safe) {
      const n = S_.c * S_.r; const avoid = new Set([safe, ...nb(safe)]);
      const spots = shuffle([...Array(n).keys()].filter(i => !avoid.has(i))).slice(0, S_.m);
      S_.mines = Array(n).fill(0); spots.forEach(i => S_.mines[i] = 1);
      S_.started = true; ctx.d.played++; startTimer();
    }
    function startTimer() { clearInterval(timer); timer = setInterval(() => { if (document.hidden || S_.over) return; S_.time++; $('#ms-time').textContent = '⏱ ' + fmtTime(S_.time); if (S_.time % 5 === 0) persist(); }, 1000); }
    function draw() {
      const els = grid.children;
      for (let i = 0; i < els.length; i++) {
        const el = els[i]; let cls = 'ms-cell', txt = '';
        if (S_.open[i]) {
          cls += ' open';
          if (S_.mines && S_.mines[i]) { cls += ' boom'; txt = '💣'; }
          else { const n = count(i); if (n) { txt = n; cls += ' n' + n; } }
        } else if (S_.flag[i]) { cls += ' flag'; txt = '🚩'; if (S_.over && S_.mines && !S_.mines[i]) { txt = '❌'; } }
        else if (S_.over && S_.mines && S_.mines[i]) { cls += ' mine'; txt = '💣'; }
        el.className = cls; el.textContent = txt;
      }
      $('#ms-left').textContent = '💣 ' + (S_.m - S_.flag.reduce((a, b) => a + b, 0));
      $('#ms-time').textContent = '⏱ ' + fmtTime(S_.time);
      $('#ms-face').textContent = S_.over ? (S_.won ? '😎' : '😵') : '🙂';
    }
    function reveal(i) {
      if (S_.over || S_.flag[i]) return;
      if (!S_.mines) plant(i);
      if (S_.open[i]) { // chord: open neighbours if flags match
        const n = count(i); if (n && nb(i).filter(j => S_.flag[j]).length === n) nb(i).forEach(j => { if (!S_.open[j] && !S_.flag[j]) openCell(j); });
      } else openCell(i);
      draw(); persist(); check();
    }
    function openCell(i) {
      const stack = [i];
      while (stack.length) {
        const k = stack.pop(); if (S_.open[k] || S_.flag[k]) continue;
        S_.open[k] = 1;
        if (S_.mines[k]) { S_.over = true; S_.won = false; return; }
        if (!count(k)) nb(k).forEach(j => { if (!S_.open[j]) stack.push(j); });
      }
    }
    function toggleFlag(i) { if (S_.over || S_.open[i]) return; S_.flag[i] ^= 1; draw(); persist(); }
    function check() {
      if (S_.over && !S_.won) { clearInterval(timer); persist(); setTimeout(() => ctx.over({ emoji: '💥', title: 'Boom!', lines: [`Time <b>${fmtTime(S_.time)}</b>`, 'Every game is a fresh board — try again.'], again: () => start(S_.level), label: 'Try again' }), 700); return; }
      const safe = S_.open.filter((v, i) => v && !S_.mines[i]).length;
      if (safe === S_.c * S_.r - S_.m) {
        S_.over = true; S_.won = true; clearInterval(timer); ctx.d.wins++;
        S_.mines.forEach((m, i) => { if (m) S_.flag[i] = 1; });
        ctx.d.bestTime = ctx.d.bestTime || {}; const b = ctx.d.bestTime[S_.level]; const rec = !b || S_.time < b; if (rec) ctx.d.bestTime[S_.level] = S_.time;
        draw(); persist();
        setTimeout(() => ctx.over({ emoji: '😎', title: 'Cleared!', lines: [`Time <b>${fmtTime(S_.time)}</b>${rec ? ' · new best!' : ''}`, `${ctx.d.wins} win${ctx.d.wins > 1 ? 's' : ''} so far`], again: () => start(S_.level) }), 500);
      }
    }
    // tap vs long-press
    let pressT = null, longFired = false;
    grid.addEventListener('pointerdown', e => { const c = e.target.closest('.ms-cell'); if (!c) return; longFired = false; pressT = setTimeout(() => { longFired = true; toggleFlag(+c.dataset.i); }, 380); });
    ['pointerup', 'pointerleave', 'pointercancel'].forEach(t => grid.addEventListener(t, () => clearTimeout(pressT)));
    grid.addEventListener('contextmenu', e => { e.preventDefault(); const c = e.target.closest('.ms-cell'); if (c && !longFired) toggleFlag(+c.dataset.i); longFired = true; });
    grid.addEventListener('click', e => { const c = e.target.closest('.ms-cell'); if (!c) return; if (longFired) { longFired = false; return; } const i = +c.dataset.i; if (flagMode && !S_.open[i]) toggleFlag(i); else reveal(i); });
    $('#ms-mode').addEventListener('click', e => { const b = e.target.closest('[data-mm]'); if (!b) return; flagMode = b.dataset.mm === 'flag'; $$('#ms-mode button').forEach(x => x.classList.toggle('on', x === b)); });
    $('#ms-face').onclick = () => start(S_.level);
    ctx.button('Level', async () => {
      const lv = await ask('New game', 'Pick a board size.', [{ label: '🙂 Easy · 8×10, 10 mines', value: 'easy', cls: 'primary' }, { label: '🤔 Medium · 10×14, 24 mines', value: 'medium', cls: 'primary' }, { label: '🔥 Hard · 12×18, 42 mines', value: 'hard', cls: 'primary' }]);
      if (lv) start(lv);
    }, 'Change level');
    const s = ctx.d.save;
    if (s && !s.over && s.open) { S_ = s; build(); draw(); if (S_.started) startTimer(); } else start(ctx.d.lastLevel || 'easy');
    return { close() { clearInterval(timer); if (S_) persist(); } };
  },
});
