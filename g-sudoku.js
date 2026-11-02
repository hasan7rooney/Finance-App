'use strict';
/* Sudoku — generated puzzles with a unique solution, notes, hints, undo, daily puzzle. */
const SUDOKU = (() => {
  const peers = Array.from({ length: 81 }, (_, i) => {
    const r = Math.floor(i / 9), c = i % 9, s = new Set();
    for (let k = 0; k < 9; k++) { s.add(r * 9 + k); s.add(k * 9 + c); }
    const br = r - r % 3, bc = c - c % 3; for (let a = 0; a < 3; a++) for (let b = 0; b < 3; b++) s.add((br + a) * 9 + bc + b);
    s.delete(i); return [...s];
  });
  const cands = (g, i) => { let m = 0x3FE; for (const p of peers[i]) if (g[p]) m &= ~(1 << g[p]); return m; };
  function solve(g, rnd, limit = 1) { // returns number of solutions found (up to limit); fills g with the first when rnd given
    let count = 0; const work = g.slice();
    (function bt() {
      if (count >= limit) return;
      let best = -1, bm = 0, bc = 10;
      for (let i = 0; i < 81; i++) if (!work[i]) { const m = cands(work, i); const n = popc(m); if (n < bc) { bc = n; best = i; bm = m; if (n <= 1) break; } }
      if (best < 0) { count++; if (count === 1 && rnd) for (let i = 0; i < 81; i++) g[i] = work[i]; return; }
      if (!bc) return;
      const ds = []; for (let d = 1; d <= 9; d++) if (bm & (1 << d)) ds.push(d);
      if (rnd) shuffle(ds, rnd);
      for (const d of ds) { work[best] = d; bt(); if (count >= limit) { if (!rnd) work[best] = 0; return; } work[best] = 0; }
    })();
    return count;
  }
  const popc = m => { let n = 0; while (m) { n += m & 1; m >>= 1; } return n; };
  function generate(level, rnd = Math.random) {
    const sol = Array(81).fill(0); solve(sol, rnd, 1);
    const target = { easy: 38, medium: 31, hard: 26 }[level] || 31;
    const puz = sol.slice(); let givens = 81;
    for (const i of shuffle([...Array(81).keys()], rnd)) {
      if (givens <= target) break;
      const v = puz[i]; puz[i] = 0;
      if (solve(puz, null, 2) !== 1) puz[i] = v; else givens--;
    }
    return { puz, sol };
  }
  return { generate, peers };
})();

GAMES.push({
  id: 'sudoku', name: 'Sudoku', emoji: '🔢', grad: 'linear-gradient(135deg,#20c997,#1c7ed6)', tagline: 'Numbers 1–9, no repeats',
  stat: d => { const b = d.bestTime || {}; const parts = ['easy', 'medium', 'hard'].filter(k => b[k]).map(k => `${k[0].toUpperCase()}${k.slice(1)} ${fmtTime(b[k])}`); return parts.length ? 'Best ' + parts.join(' · ') : (d.wins ? `${d.wins} solved` : ''); },
  open(ctx) {
    const daily = !!ctx.opts.daily; const t = today();
    let S_, sel = -1, notesMode = false, undo = [], timer = null;
    ctx.el.innerHTML = `<div class="sd-top"><span id="sd-level"></span><span id="sd-mist"></span><span id="sd-time">0:00</span></div>
      <div class="sd-grid" id="sd-grid">${Array.from({ length: 81 }, (_, i) => `<button class="sd-cell" data-i="${i}"></button>`).join('')}</div>
      <div class="sd-tools"><button data-t="undo"><span>↶</span>Undo</button><button data-t="erase"><span>⌫</span>Erase</button><button data-t="notes" id="sd-notes"><span>✏️</span>Notes</button><button data-t="hint"><span>💡</span>Hint</button></div>
      <div class="sd-pad" id="sd-pad">${[1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => `<button data-n="${n}"><b>${n}</b><small></small></button>`).join('')}</div>`;
    const cells = $$('.sd-cell', ctx.el);
    const persist = () => { if (daily) { ctx.d.dailySave = { date: t, ...S_ }; } else ctx.d.save = S_; ctx.save(); };
    function start(level) {
      const g = SUDOKU.generate(level, daily ? ctx.rng : Math.random);
      S_ = { level, puz: g.puz, sol: g.sol, val: g.puz.slice(), notes: Array(81).fill(0), mistakes: 0, time: 0, hints: 0, over: false };
      sel = -1; undo = []; ctx.d.played++; persist(); draw(); tick();
    }
    function draw() {
      const v = S_.val, selV = sel >= 0 ? v[sel] : 0;
      const pe = sel >= 0 ? new Set(SUDOKU.peers[sel]) : new Set();
      cells.forEach((el, i) => {
        const val = v[i]; const given = !!S_.puz[i]; const wrong = val && !given && val !== S_.sol[i];
        el.className = 'sd-cell' + (given ? ' given' : '') + (wrong ? ' wrong' : '') + (i === sel ? ' sel' : '') + (pe.has(i) ? ' peer' : '') + (selV && val === selV && i !== sel ? ' same' : '');
        if (val) el.innerHTML = val;
        else if (S_.notes[i]) el.innerHTML = `<span class="sd-notes">${[1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => `<i>${S_.notes[i] & (1 << n) ? n : ''}</i>`).join('')}</span>`;
        else el.innerHTML = '';
      });
      const counts = Array(10).fill(0); v.forEach((x, i) => { if (x && x === S_.sol[i]) counts[x]++; });
      $$('#sd-pad button').forEach(b => { const n = +b.dataset.n; const left = 9 - counts[n]; b.classList.toggle('done', left <= 0); $('small', b).textContent = left > 0 ? left : '✓'; });
      $('#sd-level').innerHTML = `${daily ? '🏆 Daily · ' : ''}${S_.level[0].toUpperCase() + S_.level.slice(1)}`;
      $('#sd-mist').innerHTML = `Mistakes <b>${S_.mistakes}</b>`;
      $('#sd-time').textContent = '⏱ ' + fmtTime(S_.time);
      $('#sd-notes').classList.toggle('on', notesMode);
    }
    function tick() { clearInterval(timer); if (S_.over) return; timer = setInterval(() => { if (document.hidden) return; S_.time++; $('#sd-time').textContent = '⏱ ' + fmtTime(S_.time); if (S_.time % 5 === 0) persist(); }, 1000); }
    function setVal(i, n) {
      if (S_.over || i < 0 || S_.puz[i]) return;
      undo.push({ i, val: S_.val[i], notes: S_.notes.slice() });
      if (notesMode && n) { S_.notes[i] ^= (1 << n); S_.val[i] = 0; }
      else {
        S_.val[i] = S_.val[i] === n ? 0 : n;
        if (n && S_.val[i] === n) {
          if (n !== S_.sol[i]) { S_.mistakes++; shake(cells[i]); }
          else { S_.notes[i] = 0; SUDOKU.peers[i].forEach(p => S_.notes[p] &= ~(1 << n)); }
        }
      }
      persist(); draw(); checkWin();
    }
    function checkWin() {
      if (!S_.val.every((x, i) => x === S_.sol[i])) return;
      S_.over = true; clearInterval(timer); ctx.d.wins++;
      ctx.d.bestTime = ctx.d.bestTime || {}; const bt = ctx.d.bestTime[S_.level]; const rec = !bt || S_.time < bt;
      if (rec) ctx.d.bestTime[S_.level] = S_.time;
      if (daily) ctx.d.dailyDone = t;
      persist();
      cells.forEach((el, i) => setTimeout(() => el.classList.add('win'), (Math.floor(i / 9) + i % 9) * 25));
      setTimeout(() => ctx.over({ emoji: daily ? '🏆' : '🎉', title: daily ? 'Daily solved!' : 'Solved!', lines: [`Time <b>${fmtTime(S_.time)}</b>${rec ? ' · new best!' : ''}`, `Mistakes <b>${S_.mistakes}</b> · Hints <b>${S_.hints}</b>`],
        again: daily ? null : () => start(S_.level), label: 'New puzzle' }), 700);
    }
    ctx.el.addEventListener('click', e => {
      const c = e.target.closest('.sd-cell'); if (c) { sel = +c.dataset.i; draw(); return; }
      const nb = e.target.closest('[data-n]'); if (nb) { setVal(sel, +nb.dataset.n); return; }
      const tb = e.target.closest('[data-t]'); if (!tb || S_.over) return;
      const tt = tb.dataset.t;
      if (tt === 'notes') { notesMode = !notesMode; draw(); }
      else if (tt === 'erase') { if (sel >= 0 && !S_.puz[sel]) { undo.push({ i: sel, val: S_.val[sel], notes: S_.notes.slice() }); S_.val[sel] = 0; S_.notes[sel] = 0; persist(); draw(); } }
      else if (tt === 'undo') { const u = undo.pop(); if (u) { S_.val[u.i] = u.val; S_.notes = u.notes; sel = u.i; persist(); draw(); } }
      else if (tt === 'hint') {
        let i = sel >= 0 && !S_.puz[sel] && S_.val[sel] !== S_.sol[sel] ? sel : -1;
        if (i < 0) { const open = S_.val.map((x, k) => x !== S_.sol[k] ? k : -1).filter(k => k >= 0); i = open[Math.floor(Math.random() * open.length)]; }
        if (i === undefined || i < 0) return;
        undo.push({ i, val: S_.val[i], notes: S_.notes.slice() });
        S_.val[i] = S_.sol[i]; S_.notes[i] = 0; S_.hints++; sel = i; SUDOKU.peers[i].forEach(p => S_.notes[p] &= ~(1 << S_.sol[i]));
        persist(); draw(); cells[i].classList.add('hinted'); checkWin();
      }
    });
    const key = e => { if (/^[1-9]$/.test(e.key)) setVal(sel, +e.key); else if (e.key === 'Backspace') $('[data-t="erase"]', ctx.el).click(); else if (e.key.startsWith('Arrow') && sel >= 0) { const d = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -9, ArrowDown: 9 }[e.key]; sel = (sel + d + 81) % 81; draw(); } };
    document.addEventListener('keydown', key);
    if (!daily) ctx.button('New', async () => {
      const lv = await ask('New puzzle', 'Pick a difficulty' + (S_ && !S_.over ? '. Your current puzzle will be lost.' : '.'), [{ label: '🙂 Easy', value: 'easy', cls: 'primary' }, { label: '🤔 Medium', value: 'medium', cls: 'primary' }, { label: '🔥 Hard', value: 'hard', cls: 'primary' }]);
      if (lv) start(lv);
    }, 'New puzzle');
    const s = daily ? (ctx.d.dailySave && ctx.d.dailySave.date === t ? ctx.d.dailySave : null) : ctx.d.save;
    if (s && s.puz && (!s.over || daily)) { S_ = { ...s }; delete S_.date; draw(); tick(); if (S_.over) setTimeout(() => ctx.over({ emoji: '✅', title: 'Already solved today', lines: [`Time <b>${fmtTime(S_.time)}</b>`, 'Come back tomorrow for a new one.'] }), 200); }
    else start(daily ? 'medium' : (ctx.d.lastLevel || 'easy'));
    return { close() { clearInterval(timer); document.removeEventListener('keydown', key); if (S_ && !daily) ctx.d.lastLevel = S_.level; persist(); } };
  },
});
