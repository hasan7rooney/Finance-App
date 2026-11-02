'use strict';
/* Memory — flip cards, find the pairs in as few moves as you can. */
GAMES.push({
  id: 'memory', name: 'Memory', emoji: '🃏', grad: 'linear-gradient(135deg,#f783ac,#cc5de8)', tagline: 'Find all the pairs',
  stat: d => { const b = d.bestMoves || {}; const p = [['easy', 'Easy'], ['medium', 'Med'], ['hard', 'Hard']].filter(([k]) => b[k]).map(([k, l]) => `${l} ${b[k]}`); return p.length ? 'Fewest moves ' + p.join(' · ') : ''; },
  open(ctx) {
    const SETS = ['🍕🍔🌮🍣🍩🍉🍓🍇🥑🍪🧁🍿🥨🍒🥝', '🐶🐱🦊🐼🐨🐯🦁🐸🐵🐧🦄🐙🐢🦋🐝', '⚽🏀🎾🏐🎱🏓🥊🎯🎮🎲🧩🎸🎺🚲🛹'];
    const LV = { easy: { cols: 4, pairs: 8 }, medium: { cols: 4, pairs: 10 }, hard: { cols: 5, pairs: 15 } };
    let S_, open = [], lock = false, timer;
    ctx.el.innerHTML = `<div class="g-scores three"><div><span>Moves</span><b id="mm-moves">0</b></div><div><span>Pairs</span><b id="mm-pairs">0</b></div><div><span>Time</span><b id="mm-time">0:00</b></div></div>
      <div class="mm-grid" id="mm-grid"></div>`;
    const grid = $('#mm-grid');
    const persist = () => { ctx.d.save = S_; ctx.save(); };
    function start(level) {
      const L = LV[level]; const set = [...SETS[Math.floor(Math.random() * SETS.length)]].filter(ch => ch.trim());
      const pick = shuffle(set.slice()).slice(0, L.pairs);
      S_ = { level, cols: L.cols, cards: shuffle([...pick, ...pick]), found: [], moves: 0, time: 0, over: false };
      open = []; lock = false; ctx.d.played++; ctx.d.lastLevel = level; persist(); build(); tick();
    }
    function build() {
      grid.style.gridTemplateColumns = `repeat(${S_.cols},1fr)`;
      grid.innerHTML = S_.cards.map((e, i) => `<button class="mm-card ${S_.found.includes(i) ? 'flip found' : ''}" data-i="${i}"><span class="mm-in"><span class="mm-back"></span><span class="mm-front">${e}</span></span></button>`).join('');
      stats();
    }
    function stats() { $('#mm-moves').textContent = S_.moves; $('#mm-pairs').textContent = `${S_.found.length / 2}/${S_.cards.length / 2}`; $('#mm-time').textContent = fmtTime(S_.time); }
    function tick() { clearInterval(timer); if (S_.over) return; timer = setInterval(() => { if (document.hidden || !S_.moves) return; S_.time++; $('#mm-time').textContent = fmtTime(S_.time); }, 1000); }
    grid.addEventListener('click', e => {
      const c = e.target.closest('.mm-card'); if (!c || lock || S_.over) return;
      const i = +c.dataset.i; if (open.includes(i) || S_.found.includes(i)) return;
      c.classList.add('flip'); open.push(i);
      if (open.length < 2) return;
      S_.moves++; const [a, b] = open;
      if (S_.cards[a] === S_.cards[b]) {
        S_.found.push(a, b); open = [];
        setTimeout(() => { grid.children[a].classList.add('found'); grid.children[b].classList.add('found'); }, 250);
        if (S_.found.length === S_.cards.length) win();
      } else {
        lock = true;
        setTimeout(() => { grid.children[a].classList.remove('flip'); grid.children[b].classList.remove('flip'); open = []; lock = false; }, 750);
      }
      stats(); persist();
    });
    function win() {
      S_.over = true; clearInterval(timer); ctx.d.wins++;
      ctx.d.bestMoves = ctx.d.bestMoves || {}; const b = ctx.d.bestMoves[S_.level]; const rec = !b || S_.moves < b; if (rec) ctx.d.bestMoves[S_.level] = S_.moves;
      persist();
      setTimeout(() => ctx.over({ emoji: '🧠', title: 'All pairs found!', lines: [`<b>${S_.moves}</b> moves · <b>${fmtTime(S_.time)}</b>`, rec ? '🎉 New best!' : `Best ${ctx.d.bestMoves[S_.level]} moves`], again: () => start(S_.level) }), 600);
    }
    ctx.button('Level', async () => {
      const lv = await ask('New game', 'Pick a size.', [{ label: '🙂 Easy · 16 cards', value: 'easy', cls: 'primary' }, { label: '🤔 Medium · 20 cards', value: 'medium', cls: 'primary' }, { label: '🔥 Hard · 30 cards', value: 'hard', cls: 'primary' }]);
      if (lv) start(lv);
    }, 'Change level');
    const s = ctx.d.save;
    if (s && !s.over && s.cards) { S_ = s; build(); tick(); } else start(ctx.d.lastLevel || 'easy');
    return { close() { clearInterval(timer); } };
  },
});
