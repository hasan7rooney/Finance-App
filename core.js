'use strict';
/* =====================================================================
   HUB — core (shared by every app)
   Everything lives on this device (IndexedDB). This code contains NO
   fetch / XMLHttpRequest / WebSocket / analytics, and the page's
   Content-Security-Policy blocks network requests anyway.
   ===================================================================== */

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

/* ---------------- Dates (local, YYYY-MM-DD) ---------------- */
const pad = n => String(n).padStart(2, '0');
const ymd = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parse = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const today = () => ymd(new Date());
const addDays = (s, n) => { const d = parse(s); d.setDate(d.getDate() + n); return ymd(d); };
const daysBetween = (a, b) => Math.round((parse(b) - parse(a)) / 86400000);
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTHS_L = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const WD = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const WD_L = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
function niceDate(s, withYear) {
  const t = today();
  if (s === t) return 'Today';
  if (s === addDays(t, -1)) return 'Yesterday';
  if (s === addDays(t, 1)) return 'Tomorrow';
  const d = parse(s);
  const y = withYear || d.getFullYear() !== new Date().getFullYear() ? ' ' + d.getFullYear() : '';
  return `${WD[d.getDay()]}, ${d.getDate()} ${MONTHS[d.getMonth()]}${y}`;
}
const shortDate = s => { const d = parse(s); return `${d.getDate()} ${MONTHS[d.getMonth()]}`; };
const COLORS = ['c1', 'c2', 'c3', 'c4', 'c5', 'c6', 'c7', 'c8', 'gray'];

/* ---------------- IndexedDB (one database for the whole Hub) ----------------
   The name stays "expenses-db" so data saved by the first version keeps working.
   v1: expenses, kv      v2: + notes                                            */
let db;
const reqP = r => new Promise((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
const doneP = t => new Promise((res, rej) => { t.oncomplete = () => res(); t.onerror = t.onabort = () => rej(t.error); });
function openDB() {
  return new Promise((res, rej) => {
    const r = indexedDB.open('expenses-db', 2);
    r.onupgradeneeded = () => {
      const d = r.result;
      if (!d.objectStoreNames.contains('expenses')) d.createObjectStore('expenses', { keyPath: 'id' }).createIndex('date', 'date');
      if (!d.objectStoreNames.contains('kv')) d.createObjectStore('kv');
      if (!d.objectStoreNames.contains('notes')) d.createObjectStore('notes', { keyPath: 'id' });
    };
    r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
    r.onblocked = () => rej(new Error('Close other copies of the app and reopen'));
  });
}
const storeAll = name => reqP(db.transaction(name).objectStore(name).getAll());
async function storePut(name, list) { const t = db.transaction(name, 'readwrite'); const s = t.objectStore(name); list.forEach(x => s.put(x)); return doneP(t); }
async function storeDel(name, id) { const t = db.transaction(name, 'readwrite'); t.objectStore(name).delete(id); return doneP(t); }
async function storeClear(name) { const t = db.transaction(name, 'readwrite'); t.objectStore(name).clear(); return doneP(t); }
const kvGet = k => reqP(db.transaction('kv').objectStore('kv').get(k));
async function kvSet(k, v) { const t = db.transaction('kv', 'readwrite'); t.objectStore('kv').put(v, k); return doneP(t); }

/* ---------------- Toast (with optional Undo) ---------------- */
let toastTimer;
function toast(msg, action, onAction) {
  const t = $('#toast');
  t.innerHTML = `<span class="ellip">${esc(msg)}</span>${action ? `<button class="toast-act">${esc(action)}</button>` : ''}`;
  if (action) $('.toast-act', t).onclick = () => { t.classList.remove('show'); onAction && onAction(); };
  t.classList.add('show'); clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), action ? 4000 : 2000);
}
function shake(el) { if (!el) return; el.classList.remove('shake'); void el.offsetWidth; el.classList.add('shake'); }

/* ---------------- Bottom sheet ---------------- */
function openSheet(html, onMount) {
  const bd = document.createElement('div'); bd.className = 'backdrop';
  const sh = document.createElement('div'); sh.className = 'sheet';
  sh.innerHTML = '<div class="grab"></div><button class="sheet-x" aria-label="Close">✕</button>' + html;
  document.body.append(bd, sh);
  requestAnimationFrame(() => { bd.classList.add('show'); sh.classList.add('show'); });
  const close = () => { bd.classList.remove('show'); sh.classList.remove('show'); setTimeout(() => { bd.remove(); sh.remove(); }, 280); };
  bd.onclick = close; $('.sheet-x', sh).onclick = close;
  onMount && onMount(sh, close);
  return close;
}
function ask(title, msg, buttons) {
  return new Promise(res => {
    let val = null;
    openSheet(`<h3>${esc(title)}</h3><div class="sub" style="font-size:15px">${msg}</div>
      <div class="sheet-actions" style="flex-direction:column">${buttons.map((b, i) => `<button class="btn ${b.cls || ''}" data-i="${i}">${esc(b.label)}</button>`).join('')}
      <button class="btn" data-i="-1">Cancel</button></div>`, (sh, close) => {
      $$('[data-i]', sh).forEach(b => b.onclick = () => { const i = +b.dataset.i; val = i < 0 ? null : buttons[i].value; close(); });
      const obs = new MutationObserver(() => { if (!sh.isConnected) { obs.disconnect(); res(val); } });
      obs.observe(document.body, { childList: true });
    });
  });
}

/* ---------------- Files ---------------- */
async function shareOrDownload(blob, name) {
  const file = new File([blob], name, { type: blob.type });
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try { await navigator.share({ files: [file] }); return true; }
    catch (err) { if (err.name === 'AbortError') return false; }
  }
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name;
  document.body.appendChild(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
  return true;
}

/* ---------------- Hub-wide settings & meta ---------------- */
const HUB = { settings: { theme: 'system' }, meta: {}, app: 'hub' };
const saveHub = () => kvSet('hub', HUB.settings);
const saveHubMeta = () => kvSet('hubMeta', HUB.meta);

function applyTheme() {
  const t = HUB.settings.theme; const root = document.documentElement;
  if (t === 'system') root.removeAttribute('data-theme'); else root.setAttribute('data-theme', t);
  requestAnimationFrame(() => { $('#theme-color').content = getComputedStyle(document.body).backgroundColor; });
}
async function requestPersist() {
  if (HUB.meta.persisted || !navigator.storage?.persist) return;
  try { const p = await navigator.storage.persist(); if (p) { HUB.meta.persisted = true; saveHubMeta(); } } catch {}
}

/* ---------------- App switching ---------------- */
const APPS = {}; // filled by each app: { refresh(), onOpen() }
function openApp(name) {
  HUB.app = name;
  $$('.app').forEach(a => a.classList.toggle('on', a.id === 'app-' + name));
  const a = APPS[name]; a && a.onOpen && a.onOpen();
  const m = $('#app-' + name + ' main'); if (m) m.scrollTop = 0;
}
