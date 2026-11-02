'use strict';
/* Block puzzle — drag shapes onto a 9×9 board; full rows, columns and 3×3 squares clear. */
GAMES.push({
  id: 'blocks', name: 'Block Puzzle', emoji: '🧩', grad: 'linear-gradient(135deg,#7b61ff,#4f8cff)', tagline: 'Drag, fit, clear',
  stat: d => d.best ? `Best <b>${d.best.toLocaleString()}</b>` : '',
  open(ctx) {
    const N = 9;
    const SHAPES = [
      [[0, 0]], [[0, 0], [0, 1]], [[0, 0], [1, 0]], [[0, 0], [0, 1], [0, 2]], [[0, 0], [1, 0], [2, 0]],
      [[0, 0], [0, 1], [0, 2], [0, 3]], [[0, 0], [1, 0], [2, 0], [3, 0]], [[0, 0], [0, 1], [0, 2], [0, 3], [0, 4]], [[0, 0], [1, 0], [2, 0], [3, 0], [4, 0]],
      [[0, 0], [0, 1], [1, 0], [1, 1]], [[0, 0], [0, 1], [0, 2], [1, 0], [1, 1], [1, 2], [2, 0], [2, 1], [2, 2]],
      [[0, 0], [1, 0], [1, 1]], [[0, 1], [1, 0], [1, 1]], [[0, 0], [0, 1], [1, 0]], [[0, 0], [0, 1], [1, 1]],
      [[0, 0], [1, 0], [2, 0], [2, 1]], [[0, 1], [1, 1], [2, 1], [2, 0]], [[0, 0], [0, 1], [1, 0], [2, 0]], [[0, 0], [0, 1], [1, 1], [2, 1]],
      [[0, 0], [0, 1], [0, 2], [1, 1]], [[1, 0], [1, 1], [1, 2], [0, 1]], [[0, 0], [1, 0], [2, 0], [1, 1]], [[0, 1], [1, 1], [2, 1], [1, 0]],
      [[0, 0], [0, 1], [1, 1], [1, 2]], [[0, 1], [0, 2], [1, 0], [1, 1]],
      [[0, 0], [1, 0], [2, 0], [2, 1], [2, 2]], [[0, 0], [0, 1], [0, 2], [1, 0], [2, 0]], [[0, 2], [1, 2], [2, 2], [2, 1], [2, 0]],
      [[0, 0], [1, 1]], [[0, 1], [1, 0]],
    ];
    const COLS = ['#ff6b6b', '#ffa94d', '#ffd43b', '#51cf66', '#22b8cf', '#4c6ef5', '#9775fa', '#f06595'];
    let board, tray, score, combo;
    ctx.el.innerHTML = `<div class="g-scores"><div><span>Score</span><b id="b-score">0</b></div><div><span>Best</span><b id="b-best">0</b></div></div>
      <div class="b-board" id="b-board"></div><div class="b-tray" id="b-tray"></div><div class="g-hint">Drag a piece onto the board</div>`;
    const bEl = $('#b-board'), tEl = $('#b-tray');
    bEl.innerHTML = Array.from({ length: 81 }, (_, i) => `<div class="b-cell ${((Math.floor(Math.floor(i / 9) / 3) + Math.floor((i % 9) / 3)) % 2) ? 'alt' : ''}" data-i="${i}"></div>`).join('');
    const cells = $$('.b-cell', bEl);
    const newPiece = () => ({ s: SHAPES[Math.floor(Math.random() * SHAPES.length)], col: COLS[Math.floor(Math.random() * COLS.length)] });
    const fits = (s, r, c) => s.every(([dr, dc]) => { const rr = r + dr, cc = c + dc; return rr >= 0 && rr < N && cc >= 0 && cc < N && !board[rr][cc]; });
    const canPlaceAny = s => { for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) if (fits(s, r, c)) return true; return false; };
    const persist = (over = false) => { ctx.d.save = { board, tray, score, combo, over }; ctx.save(); };
    const fresh = () => { board = Array.from({ length: N }, () => Array(N).fill(null)); tray = [newPiece(), newPiece(), newPiece()]; score = 0; combo = 0; ctx.d.played++; persist(); draw(); };
    function draw() {
      cells.forEach((el, i) => { const v = board[Math.floor(i / 9)][i % 9]; el.style.background = v || ''; el.classList.toggle('full', !!v); el.classList.remove('ghost', 'ghost-bad', 'clearing'); });
      $('#b-score').textContent = score.toLocaleString(); $('#b-best').textContent = Math.max(ctx.d.best || 0, score).toLocaleString();
      tEl.innerHTML = tray.map((p, i) => {
        if (!p) return '<div class="b-slot"></div>';
        const h = Math.max(...p.s.map(x => x[0])) + 1, w = Math.max(...p.s.map(x => x[1])) + 1; const ok = canPlaceAny(p.s);
        return `<div class="b-slot"><div class="b-piece ${ok ? '' : 'nofit'}" data-p="${i}" style="--w:${w};--h:${h}">${p.s.map(([r, c]) => `<i style="grid-row:${r + 1};grid-column:${c + 1};background:${p.col}"></i>`).join('')}</div></div>`;
      }).join('');
    }
    // ---- dragging ----
    let drag = null;
    const cellSize = () => bEl.getBoundingClientRect().width / N;
    tEl.addEventListener('pointerdown', e => {
      const pe = e.target.closest('.b-piece'); if (!pe) return;
      e.preventDefault(); const p = tray[+pe.dataset.p]; const cs = cellSize();
      const h = Math.max(...p.s.map(x => x[0])) + 1, w = Math.max(...p.s.map(x => x[1])) + 1;
      const fl = document.createElement('div'); fl.className = 'b-piece b-float'; fl.style.cssText = `--w:${w};--h:${h};--cs:${cs}px`;
      fl.innerHTML = p.s.map(([r, c]) => `<i style="grid-row:${r + 1};grid-column:${c + 1};background:${p.col}"></i>`).join('');
      document.body.appendChild(fl); pe.style.opacity = .25;
      drag = { i: +pe.dataset.p, p, fl, w, h, cs, src: pe, pos: null };
      moveFloat(e.clientX, e.clientY);
      try { tEl.setPointerCapture(e.pointerId); } catch {}
    });
    function moveFloat(x, y) {
      const { fl, w, h, cs } = drag; const lift = 70; // keep the piece above the finger
      const left = x - (w * cs) / 2, top = y - h * cs - lift + cs / 2;
      fl.style.transform = `translate(${left}px,${top}px)`;
      const br = bEl.getBoundingClientRect();
      const c = Math.round((left - br.left) / cs), r = Math.round((top - br.top) / cs);
      cells.forEach(el => el.classList.remove('ghost', 'ghost-bad'));
      if (r > -h && r < N && c > -w && c < N && fits(drag.p.s, r, c)) {
        drag.pos = [r, c];
        // preview which lines would clear
        drag.p.s.forEach(([dr, dc]) => { const el = cells[(r + dr) * 9 + c + dc]; el.classList.add('ghost'); el.style.setProperty('--gc', drag.p.col); });
      } else drag.pos = null;
    }
    tEl.addEventListener('pointermove', e => { if (drag) { e.preventDefault(); moveFloat(e.clientX, e.clientY); } });
    const end = () => {
      if (!drag) return; const { fl, pos, i, p, src } = drag; fl.remove(); src.style.opacity = ''; drag = null;
      cells.forEach(el => el.classList.remove('ghost'));
      if (!pos) return;
      p.s.forEach(([dr, dc]) => board[pos[0] + dr][pos[1] + dc] = p.col);
      score += p.s.length; tray[i] = null;
      clearLines();
    };
    tEl.addEventListener('pointerup', end); tEl.addEventListener('pointercancel', end);
    tEl.addEventListener('touchmove', e => { if (drag) e.preventDefault(); }, { passive: false });
    function clearLines() {
      const kill = new Set(); let n = 0;
      for (let r = 0; r < N; r++) if (board[r].every(Boolean)) { n++; for (let c = 0; c < N; c++) kill.add(r * 9 + c); }
      for (let c = 0; c < N; c++) if (board.every(row => row[c])) { n++; for (let r = 0; r < N; r++) kill.add(r * 9 + c); }
      for (let br = 0; br < 3; br++) for (let bc = 0; bc < 3; bc++) {
        let full = true; for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) if (!board[br * 3 + r][bc * 3 + c]) full = false;
        if (full) { n++; for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) kill.add((br * 3 + r) * 9 + bc * 3 + c); }
      }
      if (n) { combo++; const pts = n * 18 * combo + (n > 1 ? n * 10 : 0); score += pts; floatText(`+${pts}${combo > 1 ? ` · combo ×${combo}` : ''}`); }
      else combo = 0;
      draw();
      if (n) { kill.forEach(i => cells[i].classList.add('clearing')); setTimeout(() => { kill.forEach(i => board[Math.floor(i / 9)][i % 9] = null); afterPlace(); }, 260); }
      else afterPlace();
    }
    function afterPlace() {
      if (tray.every(x => !x)) tray = [newPiece(), newPiece(), newPiece()];
      if (score > (ctx.d.best || 0)) ctx.d.best = score;
      draw();
      if (!tray.some(p => p && canPlaceAny(p.s))) {
        persist(true);
        setTimeout(() => ctx.over({ emoji: '🧩', title: 'No space left', lines: [`Score <b>${score.toLocaleString()}</b>`, score >= (ctx.d.best || 0) ? '🎉 New best!' : `Best ${ctx.d.best.toLocaleString()}`], again: fresh }), 300);
      } else persist();
    }
    function floatText(t) { const f = document.createElement('div'); f.className = 'g-float'; f.textContent = t; ctx.el.appendChild(f); setTimeout(() => f.remove(), 900); }
    ctx.button('↻', async () => { const ok = score < 100 || await ask('New game?', 'Your current game will be lost.', [{ label: 'New game', value: true, cls: 'primary' }]); if (ok) fresh(); }, 'New game');
    const s = ctx.d.save;
    if (s && !s.over && s.board) { board = s.board; tray = s.tray; score = s.score; combo = s.combo || 0; draw(); } else fresh();
    return { close() { if (drag) { drag.fl.remove(); drag = null; } } };
  },
});
