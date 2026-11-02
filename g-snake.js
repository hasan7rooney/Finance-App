'use strict';
/* Snake — swipe (or the arrows) to steer; eat to grow; it speeds up. */
GAMES.push({
  id: 'snake', name: 'Snake', emoji: '🐍', grad: 'linear-gradient(135deg,#40c057,#0ca678)', tagline: 'Eat, grow, don’t crash',
  stat: d => d.best ? `Best <b>${d.best}</b> 🍎` : '',
  open(ctx) {
    const C = 16, R = 18;
    let snake, dir, queue, food, score, speed, loop = null, state = 'ready', bonus = null;
    ctx.el.innerHTML = `<div class="g-scores"><div><span>Score</span><b id="sn-score">0</b></div><div><span>Best</span><b id="sn-best">0</b></div></div>
      <div class="sn-wrap"><canvas id="sn-cv"></canvas><div class="sn-msg" id="sn-msg"></div></div>
      <div class="sn-pad"><button data-d="up">▲</button><button data-d="left">◀</button><button data-d="down">▼</button><button data-d="right">▶</button></div>`;
    const cv = $('#sn-cv'), msg = $('#sn-msg'); const g = cv.getContext('2d');
    let cs = 20;
    function size() {
      const wrap = $('.sn-wrap', ctx.el); const w = Math.min(wrap.clientWidth || 340, 420); const hAvail = ctx.el.clientHeight - 230; cs = Math.max(12, Math.floor(Math.min(w / C, hAvail > 200 ? hAvail / R : 99)));
      const dpr = window.devicePixelRatio || 1; cv.width = C * cs * dpr; cv.height = R * cs * dpr; cv.style.width = C * cs + 'px'; cv.style.height = R * cs + 'px';
      g.setTransform(dpr, 0, 0, dpr, 0, 0); draw();
    }
    const css = v => getComputedStyle(document.documentElement).getPropertyValue(v).trim() || '#888';
    function reset() {
      snake = [{ x: 5, y: 9 }, { x: 4, y: 9 }, { x: 3, y: 9 }]; dir = 'right'; queue = []; score = 0; speed = 150; bonus = null;
      placeFood(); state = 'ready'; showMsg('▶ Tap to start', 'Swipe to steer'); draw();
    }
    function placeFood() { do { food = { x: Math.floor(Math.random() * C), y: Math.floor(Math.random() * R) }; } while (snake.some(s => s.x === food.x && s.y === food.y)); }
    function showMsg(a, b) { msg.innerHTML = a ? `<b>${a}</b>${b ? `<span>${b}</span>` : ''}` : ''; msg.hidden = !a; }
    function begin() { if (state === 'running') return; if (state === 'over') reset(); state = 'running'; showMsg(''); if (score === 0 && snake.length === 3) { ctx.d.played++; ctx.save(); } run(); }
    function run() { clearTimeout(loop); loop = setTimeout(step, speed); }
    function pause() { if (state !== 'running') return; state = 'paused'; clearTimeout(loop); showMsg('⏸ Paused', 'Tap to continue'); }
    const opp = { up: 'down', down: 'up', left: 'right', right: 'left' };
    function turn(d) {
      if (state !== 'running') { begin(); }
      const last = queue.length ? queue[queue.length - 1] : dir;
      if (d !== last && d !== opp[last] && queue.length < 3) queue.push(d);
    }
    function step() {
      if (queue.length) dir = queue.shift();
      const h = snake[0]; const n = { x: h.x + (dir === 'right') - (dir === 'left'), y: h.y + (dir === 'down') - (dir === 'up') };
      if (n.x < 0 || n.x >= C || n.y < 0 || n.y >= R || snake.slice(0, -1).some(s => s.x === n.x && s.y === n.y)) return die();
      snake.unshift(n);
      if (n.x === food.x && n.y === food.y) { score++; speed = Math.max(65, speed - 4); placeFood(); if (score % 5 === 0) spawnBonus(); }
      else if (bonus && n.x === bonus.x && n.y === bonus.y) { score += 3; bonus = null; }
      else snake.pop();
      if (bonus && --bonus.ttl <= 0) bonus = null;
      $('#sn-score').textContent = score; $('#sn-best').textContent = Math.max(ctx.d.best || 0, score);
      draw(); run();
    }
    function spawnBonus() { let b; do { b = { x: Math.floor(Math.random() * C), y: Math.floor(Math.random() * R), ttl: 40 }; } while (snake.some(s => s.x === b.x && s.y === b.y) || (b.x === food.x && b.y === food.y)); bonus = b; }
    function die() {
      state = 'over'; clearTimeout(loop);
      const rec = score > (ctx.d.best || 0); if (rec) ctx.d.best = score; ctx.save();
      draw(true);
      setTimeout(() => ctx.over({ emoji: '🐍', title: rec && score ? 'New best!' : 'Crashed!', lines: [`Score <b>${score}</b> · length <b>${snake.length}</b>`, `Best ${ctx.d.best || 0}`], again: () => { reset(); begin(); } }), 450);
    }
    function draw(dead) {
      if (!snake) return;
      const a = css('--card'), b = css('--card2');
      for (let y = 0; y < R; y++) for (let x = 0; x < C; x++) { g.fillStyle = (x + y) % 2 ? a : b; g.fillRect(x * cs, y * cs, cs, cs); }
      g.font = `${cs * .85}px system-ui`; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText('🍎', food.x * cs + cs / 2, food.y * cs + cs / 2 + 1);
      if (bonus) { g.globalAlpha = bonus.ttl < 10 ? (bonus.ttl % 2 ? .4 : 1) : 1; g.fillText('⭐', bonus.x * cs + cs / 2, bonus.y * cs + cs / 2 + 1); g.globalAlpha = 1; }
      snake.forEach((s, i) => {
        const t = i / Math.max(1, snake.length - 1);
        g.fillStyle = dead ? `hsl(0,70%,${50 + t * 15}%)` : `hsl(${145 - t * 50},65%,${42 + t * 10}%)`;
        const p = i === 0 ? 1 : 2; const r = i === 0 ? cs * .38 : cs * .3;
        g.beginPath(); g.roundRect(s.x * cs + p, s.y * cs + p, cs - p * 2, cs - p * 2, r); g.fill();
      });
      const h = snake[0]; g.fillStyle = '#fff';
      const ex = { right: [.65, .3, .65, .7], left: [.35, .3, .35, .7], up: [.3, .35, .7, .35], down: [.3, .65, .7, .65] }[dir];
      [[ex[0], ex[1]], [ex[2], ex[3]]].forEach(([fx, fy]) => { g.beginPath(); g.arc(h.x * cs + fx * cs, h.y * cs + fy * cs, cs * .1, 0, 7); g.fill(); });
    }
    onSwipe(ctx.el.querySelector('.sn-wrap'), turn, 16);
    $('.sn-wrap', ctx.el).addEventListener('click', () => { if (state === 'running') pause(); else begin(); });
    $('.sn-pad', ctx.el).addEventListener('pointerdown', e => { const b = e.target.closest('[data-d]'); if (b) { e.preventDefault(); turn(b.dataset.d); } });
    const key = e => { const m = { ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down' }[e.key]; if (m) { e.preventDefault(); turn(m); } else if (e.key === ' ') { e.preventDefault(); state === 'running' ? pause() : begin(); } };
    document.addEventListener('keydown', key); window.addEventListener('resize', size);
    reset(); requestAnimationFrame(size);
    return { close() { clearTimeout(loop); document.removeEventListener('keydown', key); window.removeEventListener('resize', size); }, pause };
  },
});
