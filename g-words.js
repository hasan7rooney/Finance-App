'use strict';
/* Word Guess — find the 5-letter word in 6 tries. Daily word + unlimited practice. */
GAMES.push({
  id: 'words', name: 'Word Guess', emoji: '🔤', grad: 'linear-gradient(135deg,#51cf66,#fcc419)', tagline: '5 letters, 6 tries',
  stat: d => d.played ? `Won <b>${Math.round((d.wins || 0) / d.played * 100)}%</b> · streak <b>${d.streak || 0}</b>🔥` : '',
  open(ctx) {
    const daily = !!ctx.opts.daily; const t = today();
    const dayIndex = daysBetween('2026-01-01', t);
    let S_, typing = '', busy = false;
    ctx.el.innerHTML = `<div class="wg-top" id="wg-top"></div><div class="wg-board" id="wg-board">${Array.from({ length: 6 }, () => `<div class="wg-row">${'<div class="wg-tile"></div>'.repeat(5)}</div>`).join('')}</div>
      <div class="wg-kb" id="wg-kb">${['qwertyuiop', 'asdfghjkl', '⏎zxcvbnm⌫'].map(r => `<div class="wg-kr">${[...r].map(k => `<button data-k="${k}" class="${k === '⏎' || k === '⌫' ? 'wide' : ''}">${k === '⏎' ? 'Enter' : k}</button>`).join('')}</div>`).join('')}</div>`;
    const rows = $$('.wg-row', ctx.el);
    const persist = () => { if (daily) ctx.d.daily = { date: t, ...S_ }; else ctx.d.save = S_; ctx.save(); };
    function start() {
      const answer = daily ? WORD_ANS[dayIndex % WORD_ANS.length] : WORD_ANS[Math.floor(Math.random() * WORD_ANS.length)];
      S_ = { answer, guesses: [], over: false, won: false }; typing = ''; persist(); draw();
    }
    function score(guess, ans) { // 2 = right spot, 1 = in word, 0 = not in word (handles repeated letters)
      const res = Array(5).fill(0), pool = {};
      for (let i = 0; i < 5; i++) if (guess[i] === ans[i]) res[i] = 2; else pool[ans[i]] = (pool[ans[i]] || 0) + 1;
      for (let i = 0; i < 5; i++) if (res[i] !== 2 && pool[guess[i]]) { res[i] = 1; pool[guess[i]]--; }
      return res;
    }
    function draw(reveal) {
      $('#wg-top').innerHTML = daily ? `🏆 Daily word · ${shortDate(t)}` : '🎲 Practice';
      rows.forEach((row, r) => {
        const g = S_.guesses[r]; const tiles = row.children;
        for (let i = 0; i < 5; i++) {
          const el = tiles[i];
          if (g) { const sc = score(g, S_.answer)[i]; el.textContent = g[i]; el.className = 'wg-tile filled ' + ['no', 'near', 'yes'][sc] + (reveal === r ? ' reveal' : ''); el.style.animationDelay = reveal === r ? i * 0.18 + 's' : ''; }
          else if (r === S_.guesses.length && !S_.over) { el.textContent = typing[i] || ''; el.className = 'wg-tile' + (typing[i] ? ' typed' : ''); el.style.animationDelay = ''; }
          else { el.textContent = ''; el.className = 'wg-tile'; }
        }
      });
      const best = {}; S_.guesses.forEach(g => score(g, S_.answer).forEach((s, i) => { best[g[i]] = Math.max(best[g[i]] ?? -1, s); }));
      setTimeout(() => $$('#wg-kb button').forEach(b => { const k = b.dataset.k; b.className = (k.length > 1 || k === '⏎' || k === '⌫' ? 'wide ' : '') + (best[k] !== undefined ? ['no', 'near', 'yes'][best[k]] : ''); }), reveal !== undefined ? 1000 : 0);
    }
    function press(k) {
      if (S_.over || busy) return;
      if (k === '⌫' || k === 'Backspace') typing = typing.slice(0, -1);
      else if (k === '⏎' || k === 'Enter') return submit();
      else if (/^[a-z]$/.test(k) && typing.length < 5) typing += k;
      draw();
    }
    function submit() {
      const row = rows[S_.guesses.length];
      if (typing.length < 5) { shake(row); toast('Not enough letters'); return; }
      if (!WORD_VALID.has(typing)) { shake(row); toast('Not in the word list'); return; }
      S_.guesses.push(typing); typing = ''; busy = true;
      const won = S_.guesses[S_.guesses.length - 1] === S_.answer;
      if (won || S_.guesses.length === 6) { S_.over = true; S_.won = won; record(won); }
      persist(); draw(S_.guesses.length - 1);
      setTimeout(() => { busy = false; if (S_.over) end(); }, 1100);
    }
    function record(won) {
      ctx.d.played++; if (won) ctx.d.wins++;
      ctx.d.dist = ctx.d.dist || [0, 0, 0, 0, 0, 0]; if (won) ctx.d.dist[S_.guesses.length - 1]++;
      if (daily) { // streak counts daily words only
        const yesterday = addDays(t, -1);
        ctx.d.streak = won ? (ctx.d.lastDailyWin === yesterday ? (ctx.d.streak || 0) + 1 : 1) : 0;
        if (won) ctx.d.lastDailyWin = t; ctx.d.maxStreak = Math.max(ctx.d.maxStreak || 0, ctx.d.streak);
      }
    }
    function end() {
      const d = ctx.d.dist || [0, 0, 0, 0, 0, 0]; const mx = Math.max(1, ...d);
      const bars = `<div class="wg-dist">${d.map((n, i) => `<div><span>${i + 1}</span><i style="width:${Math.max(8, n / mx * 100)}%" class="${S_.won && S_.guesses.length === i + 1 ? 'me' : ''}">${n}</i></div>`).join('')}</div>`;
      ctx.over({ emoji: S_.won ? ['🤯', '🔥', '🎯', '👏', '😅', '😮‍💨'][S_.guesses.length - 1] : '😶', title: S_.won ? ['Genius!', 'Magnificent!', 'Impressive!', 'Splendid!', 'Great!', 'Phew!'][S_.guesses.length - 1] : 'The word was ' + S_.answer.toUpperCase(),
        lines: [`Played <b>${ctx.d.played}</b> · Won <b>${Math.round(ctx.d.wins / ctx.d.played * 100)}%</b> · Streak <b>${ctx.d.streak || 0}</b>🔥`, bars],
        again: daily ? () => playGame('words') : start, label: daily ? 'Practice mode' : 'Next word' });
    }
    $('#wg-kb').addEventListener('click', e => { const b = e.target.closest('[data-k]'); if (b) press(b.dataset.k); });
    const key = e => { if (e.metaKey || e.ctrlKey || $('.sheet')) return; if (e.key === 'Enter' || e.key === 'Backspace' || /^[a-zA-Z]$/.test(e.key)) { e.preventDefault(); press(e.key.length === 1 ? e.key.toLowerCase() : e.key); } };
    document.addEventListener('keydown', key);
    if (!daily) ctx.button('↻', async () => { const ok = !S_.guesses.length || S_.over || await ask('Skip this word?', 'It will count as a loss.', [{ label: 'Skip', value: true, cls: 'danger' }]); if (!ok) return; if (S_.guesses.length && !S_.over) { record(false); toast('It was ' + S_.answer.toUpperCase()); } start(); }, 'New word');
    const s = daily ? (ctx.d.daily && ctx.d.daily.date === t ? ctx.d.daily : null) : ctx.d.save;
    if (s && s.answer && (daily || !s.over)) { S_ = { answer: s.answer, guesses: s.guesses, over: s.over, won: s.won }; draw(); if (S_.over) setTimeout(end, 300); }
    else start();
    return { close() { document.removeEventListener('keydown', key); } };
  },
});
