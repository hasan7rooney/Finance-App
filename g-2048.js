'use strict';
/* 2048 — swipe to slide tiles; equal tiles merge. */
GAMES.push({
  id: '2048', name: '2048', emoji: '🟧', grad: 'linear-gradient(135deg,#f7a541,#ee6a3b)', tagline: 'Swipe & merge',
  stat: d => d.best ? `Best <b>${d.best.toLocaleString()}</b>${d.top ? ` · top tile ${d.top}` : ''}` : '',
  open(ctx) {
    const N = 4; let tiles, score, nextId, prev, won, keepGoing;
    ctx.el.innerHTML = `<div class="g-scores"><div><span>Score</span><b id="t-score">0</b></div><div><span>Best</span><b id="t-best">0</b></div></div>
      <div class="t-grid" id="t-grid">${'<div class="t-cell"></div>'.repeat(16)}<div class="t-layer" id="t-layer"></div></div>
      <div class="g-hint">Swipe anywhere on the board</div>`;
    const layer = $('#t-layer'); const els = new Map();
    const fresh = () => {
      tiles = []; score = 0; nextId = 1; prev = null; won = false; keepGoing = false;
      add(); add(); ctx.d.played++; persist(); draw();
    };
    const empty = () => { const e = []; for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) if (!tiles.find(t => t.r === r && t.c === c)) e.push([r, c]); return e; };
    const add = () => { const e = empty(); if (!e.length) return; const [r, c] = e[Math.floor(Math.random() * e.length)]; tiles.push({ id: nextId++, r, c, v: Math.random() < .9 ? 2 : 4, isNew: true }); };
    const persist = () => { ctx.d.save = { tiles: tiles.map(({ id, r, c, v }) => ({ id, r, c, v })), score, nextId, won, keepGoing, over: false }; ctx.save(); };
    function draw() {
      $('#t-score').textContent = score.toLocaleString(); $('#t-best').textContent = Math.max(ctx.d.best || 0, score).toLocaleString();
      const live = new Set(tiles.map(t => t.id));
      for (const [id, el] of els) if (!live.has(id)) { el.remove(); els.delete(id); }
      tiles.forEach(t => {
        let el = els.get(t.id);
        if (!el) { el = document.createElement('div'); el.className = 't-tile'; layer.appendChild(el); els.set(t.id, el); }
        el.style.setProperty('--r', t.r); el.style.setProperty('--c', t.c);
        el.dataset.v = t.v > 2048 ? 'big' : t.v; el.textContent = t.v;
        el.classList.toggle('t-new', !!t.isNew); el.classList.toggle('t-merged', !!t.merged);
        t.isNew = false; t.merged = false;
      });
    }
    function move(dir) {
      if (ctx.d.save?.over) return;
      const vec = { left: [0, -1], right: [0, 1], up: [-1, 0], down: [1, 0] }[dir];
      const order = [...Array(N).keys()]; if (vec[0] === 1 || vec[1] === 1) order.reverse();
      const grid = Array.from({ length: N }, () => Array(N).fill(null)); tiles.forEach(t => grid[t.r][t.c] = t);
      const snapshot = { tiles: tiles.map(t => ({ ...t })), score };
      let moved = false; const dead = [];
      for (const r of (vec[0] ? order : [...Array(N).keys()])) for (const c of (vec[1] ? order : [...Array(N).keys()])) {
        const t = grid[r][c]; if (!t) continue;
        let nr = r, nc = c;
        while (true) {
          const tr = nr + vec[0], tc = nc + vec[1];
          if (tr < 0 || tr >= N || tc < 0 || tc >= N) break;
          const o = grid[tr][tc];
          if (!o) { nr = tr; nc = tc; continue; }
          if (o.v === t.v && !o.merged && !o.justMerged) { // merge
            grid[r][c] = null; t.r = tr; t.c = tc; dead.push(t); o.v *= 2; o.justMerged = true; o.merged = true; score += o.v; moved = true;
            nr = null; break;
          }
          break;
        }
        if (nr === null) continue;
        if (nr !== r || nc !== c) { grid[r][c] = null; grid[nr][nc] = t; t.r = nr; t.c = nc; moved = true; }
      }
      if (!moved) return;
      prev = snapshot;
      tiles.forEach(t => delete t.justMerged);
      // let the merged-away tiles slide into place, then remove them
      draw(); dead.forEach(t => { const el = els.get(t.id); if (el) el.style.zIndex = 0; });
      tiles = tiles.filter(t => !dead.includes(t));
      setTimeout(() => { add(); draw(); afterMove(); }, 110);
    }
    function afterMove() {
      if (score > (ctx.d.best || 0)) ctx.d.best = score;
      const top = Math.max(...tiles.map(t => t.v)); if (top > (ctx.d.top || 0)) ctx.d.top = top;
      persist();
      if (!won && top >= 2048 && !keepGoing) { won = true; ctx.d.wins++; persist(); ctx.over({ emoji: '🏆', title: 'You made 2048!', lines: [`Score <b>${score.toLocaleString()}</b>`], again: () => { keepGoing = true; persist(); }, label: 'Keep going' }); return; }
      if (!canMove()) { ctx.d.save.over = true; ctx.save(); ctx.over({ emoji: '🧱', title: 'No more moves', lines: [`Score <b>${score.toLocaleString()}</b>`, `Top tile <b>${top}</b>`, score >= (ctx.d.best || 0) ? '🎉 New best!' : `Best ${ctx.d.best.toLocaleString()}`], again: fresh }); }
    }
    function canMove() {
      if (empty().length) return true;
      const g = Array.from({ length: N }, () => Array(N).fill(0)); tiles.forEach(t => g[t.r][t.c] = t.v);
      for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) if ((c < N - 1 && g[r][c] === g[r][c + 1]) || (r < N - 1 && g[r][c] === g[r + 1][c])) return true;
      return false;
    }
    ctx.button('↶', () => { if (!prev || ctx.d.save?.over) return; tiles = prev.tiles.map(t => ({ ...t, isNew: false, merged: false })); score = prev.score; prev = null; draw(); persist(); }, 'Undo');
    ctx.button('↻', async () => { const ok = score < 200 || await ask('New game?', 'Your current game will be lost.', [{ label: 'New game', value: true, cls: 'primary' }]); if (ok) { layer.innerHTML = ''; els.clear(); fresh(); } }, 'New game');
    onSwipe(ctx.el, move);
    const key = e => { const m = { ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down' }[e.key]; if (m) { e.preventDefault(); move(m); } };
    document.addEventListener('keydown', key);
    const s = ctx.d.save;
    if (s && !s.over && s.tiles?.length) { tiles = s.tiles.map(t => ({ ...t })); score = s.score; nextId = s.nextId; won = s.won; keepGoing = s.keepGoing; prev = null; draw(); }
    else fresh();
    return { close() { document.removeEventListener('keydown', key); } };
  },
});
