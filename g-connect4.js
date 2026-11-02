'use strict';
/* Connect 4 — vs the computer (easy / medium / hard) or 2 players on one phone. */
GAMES.push({
  id: 'c4', name: 'Connect 4', emoji: '🔴', grad: 'linear-gradient(135deg,#ff6b6b,#fab005)', tagline: 'Four in a row wins',
  stat: d => d.played ? `W <b>${d.wins || 0}</b> · L <b>${d.losses || 0}</b> · D <b>${d.draws || 0}</b>` : '',
  open(ctx) {
    const COLS = 7, ROWS = 6; const DEPTH = { easy: 1, medium: 4, hard: 7 };
    let S_, busy = false, closed = false;
    ctx.el.innerHTML = `<div class="c4-status" id="c4-status"></div>
      <div class="c4-board" id="c4-board">${Array.from({ length: COLS }, (_, c) => `<div class="c4-col" data-c="${c}">${Array.from({ length: ROWS }, (_, r) => `<div class="c4-slot" data-r="${r}"></div>`).join('')}</div>`).join('')}</div>
      <div class="g-hint" id="c4-mode"></div>`;
    const board = $('#c4-board');
    const persist = () => { ctx.d.save = S_; ctx.save(); };
    function start(mode, level) {
      S_ = { mode, level, g: Array.from({ length: ROWS }, () => Array(COLS).fill(0)), turn: 1, over: false, win: null, moves: 0 };
      ctx.d.mode = mode; ctx.d.level = level; ctx.d.played++; persist(); draw();
    }
    function draw(drop) {
      $$('.c4-col', board).forEach((colEl, c) => [...colEl.children].forEach((s, r) => {
        const v = S_.g[r][c]; s.className = 'c4-slot' + (v ? ` p${v}` : '') + (S_.win && S_.win.some(([wr, wc]) => wr === r && wc === c) ? ' win' : '');
        if (drop && drop[0] === r && drop[1] === c) { s.style.setProperty('--fall', r + 1); s.classList.add('drop'); }
      }));
      const who = S_.mode === 'cpu' ? (S_.turn === 1 ? 'Your turn' : 'Computer is thinking…') : (S_.turn === 1 ? 'Red’s turn' : 'Yellow’s turn');
      $('#c4-status').innerHTML = S_.over ? '' : `<span class="c4-dot p${S_.turn}"></span>${who}`;
      $('#c4-mode').textContent = S_.mode === 'cpu' ? `You are red · vs computer (${S_.level})` : '2 players · pass the phone';
    }
    const lowest = (g, c) => { for (let r = ROWS - 1; r >= 0; r--) if (!g[r][c]) return r; return -1; };
    function winLine(g, p) {
      const dirs = [[0, 1], [1, 0], [1, 1], [1, -1]];
      for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) if (g[r][c] === p) for (const [dr, dc] of dirs) {
        const line = [[r, c]]; for (let k = 1; k < 4; k++) { const rr = r + dr * k, cc = c + dc * k; if (rr < 0 || rr >= ROWS || cc < 0 || cc >= COLS || g[rr][cc] !== p) break; line.push([rr, cc]); }
        if (line.length === 4) return line;
      }
      return null;
    }
    function play(c) {
      if (closed || S_.over || busy) return false; const r = lowest(S_.g, c); if (r < 0) return false;
      S_.g[r][c] = S_.turn; S_.moves++;
      const w = winLine(S_.g, S_.turn);
      if (w) { S_.over = true; S_.win = w; draw([r, c]); finish(S_.turn); return true; }
      if (S_.moves === ROWS * COLS) { S_.over = true; draw([r, c]); finish(0); return true; }
      S_.turn = 3 - S_.turn; draw([r, c]); persist();
      if (S_.mode === 'cpu' && S_.turn === 2) { busy = true; setTimeout(() => { if (closed) return; const m = bestMove(); busy = false; play(m); }, 380); }
      return true;
    }
    function finish(p) {
      if (S_.mode === 'cpu') { if (p === 1) ctx.d.wins++; else if (p === 2) ctx.d.losses = (ctx.d.losses || 0) + 1; else ctx.d.draws = (ctx.d.draws || 0) + 1; }
      persist();
      const t = p === 0 ? 'Draw!' : S_.mode === 'cpu' ? (p === 1 ? 'You win!' : 'Computer wins') : (p === 1 ? 'Red wins!' : 'Yellow wins!');
      setTimeout(() => ctx.over({ emoji: p === 0 ? '🤝' : (S_.mode === 'cpu' && p === 2 ? '🤖' : '🏆'), title: t,
        lines: S_.mode === 'cpu' ? [`vs computer · ${S_.level}`, `Record: W ${ctx.d.wins} · L ${ctx.d.losses || 0} · D ${ctx.d.draws || 0}`] : [`${S_.moves} moves`],
        again: () => start(S_.mode, S_.level) }), 900);
    }
    // ---- AI: minimax with alpha-beta ----
    const ORDER = [3, 2, 4, 1, 5, 0, 6];
    function scoreWindow(w, p) { const o = 3 - p; const pc = w.filter(x => x === p).length, oc = w.filter(x => x === o).length, e = w.filter(x => !x).length;
      if (pc === 4) return 1000; if (pc === 3 && e === 1) return 6; if (pc === 2 && e === 2) return 2; if (oc === 3 && e === 1) return -8; return 0; }
    function evaluate(g, p) {
      let s = 0; for (let r = 0; r < ROWS; r++) if (g[r][3] === p) s += 4;
      for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) for (const [dr, dc] of [[0, 1], [1, 0], [1, 1], [1, -1]]) {
        const er = r + dr * 3, ec = c + dc * 3; if (er < 0 || er >= ROWS || ec < 0 || ec >= COLS) continue;
        s += scoreWindow([0, 1, 2, 3].map(k => g[r + dr * k][c + dc * k]), p);
      }
      return s;
    }
    function minimax(g, depth, a, b, max, moves) {
      if (winLine(g, 2)) return 100000 + depth; if (winLine(g, 1)) return -100000 - depth;
      if (depth === 0 || moves === ROWS * COLS) return evaluate(g, 2);
      let best = max ? -Infinity : Infinity;
      for (const c of ORDER) { const r = lowest(g, c); if (r < 0) continue;
        g[r][c] = max ? 2 : 1; const v = minimax(g, depth - 1, a, b, !max, moves + 1); g[r][c] = 0;
        if (max) { best = Math.max(best, v); a = Math.max(a, v); } else { best = Math.min(best, v); b = Math.min(b, v); }
        if (a >= b) break; }
      return best;
    }
    function bestMove() {
      const g = S_.g.map(r => r.slice()); const valid = ORDER.filter(c => lowest(g, c) >= 0);
      for (const c of valid) { const r = lowest(g, c); g[r][c] = 2; if (winLine(g, 2)) return c; g[r][c] = 0; } // win now
      for (const c of valid) { const r = lowest(g, c); g[r][c] = 1; if (winLine(g, 1)) { g[r][c] = 0; if (S_.level !== 'easy' || Math.random() < .7) return c; } g[r][c] = 0; } // block
      if (S_.level === 'easy' && Math.random() < .5) return valid[Math.floor(Math.random() * valid.length)];
      let best = valid[0], bv = -Infinity;
      for (const c of valid) { const r = lowest(g, c); g[r][c] = 2; const v = minimax(g, DEPTH[S_.level] - 1, -Infinity, Infinity, false, S_.moves + 1); g[r][c] = 0; if (v > bv) { bv = v; best = c; } }
      return best;
    }
    board.addEventListener('click', e => { const col = e.target.closest('.c4-col'); if (!col) return; if (S_.mode === 'cpu' && S_.turn !== 1) return; play(+col.dataset.c); });
    ctx.button('New', async () => {
      const m = await ask('New game', 'Who do you want to play?', [{ label: '🙂 Computer · Easy', value: 'cpu:easy', cls: 'primary' }, { label: '🤔 Computer · Medium', value: 'cpu:medium', cls: 'primary' }, { label: '🔥 Computer · Hard', value: 'cpu:hard', cls: 'primary' }, { label: '👥 2 players', value: 'two:', cls: 'primary' }]);
      if (m) { const [mode, lv] = m.split(':'); start(mode, lv || 'medium'); }
    }, 'New game');
    const s = ctx.d.save;
    if (s && !s.over && s.g) { S_ = s; draw(); if (S_.mode === 'cpu' && S_.turn === 2) { busy = true; setTimeout(() => { busy = false; play(bestMove()); }, 300); } }
    else start(ctx.d.mode || 'cpu', ctx.d.level || 'medium');
    return { close() { busy = false; closed = true; } };
  },
});
