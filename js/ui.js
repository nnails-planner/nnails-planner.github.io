// Общото за всички екрани: данните, записването, листовете отдолу, съобщенията.
import { load, save } from './store.js';
import { icon } from './icons.js';

export const state = load();

const UI_KEY = 'nnp:ui';
const savedUi = (() => {
  try {
    return JSON.parse(localStorage.getItem(UI_KEY)) || {};
  } catch {
    return {};
  }
})();
export const ui = Object.assign({ tab: 'cal', calMode: 'month', corner: 'books', bookFilter: 'all' }, savedUi);
export function saveUi() {
  try {
    const { tab, calMode, corner, bookFilter } = ui;
    localStorage.setItem(UI_KEY, JSON.stringify({ tab, calMode, corner, bookFilter }));
  } catch {}
}

export const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

// ── действия (data-act) ──
const actions = {};
export function registerActions(obj) {
  Object.assign(actions, obj);
}
export const getAction = (name) => actions[name];

// ── прерисуване ──
let renderView = () => {};
export function setRenderer(fn) {
  renderView = fn;
}
export function rerender() {
  renderView();
  refreshSheet();
}
let persistTried = false;
export function commit() {
  if (!save(state)) toast('Паметта на телефона е пълна. Изтрий някоя снимка и опитай пак.');
  if (!persistTried && navigator.storage && navigator.storage.persist) {
    persistTried = true;
    navigator.storage.persist().catch(() => {});
  }
  rerender();
}

// ── съобщение долу ──
let toastTimer;
export function toast(msg) {
  const el = document.getElementById('toast');
  el.innerHTML = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2800);
}

// ── лист отдолу ──
let current = null;
export function openSheet({ title = '', body = '', render = null, onMount = null, onClose = null, cls = '' }) {
  const root = document.getElementById('sheet-root');
  if (current) {
    const prev = current;
    current = null;
    if (prev.onClose) prev.onClose();
    prev.el.remove();
  }
  const wrap = document.createElement('div');
  wrap.className = `sheet-wrap ${cls}`;
  wrap.innerHTML = `
    <div class="sheet-backdrop" data-act="sheet-close"></div>
    <section class="sheet" role="dialog" aria-modal="true" aria-label="${esc(title)}">
      <div class="sheet-handle" aria-hidden="true"></div>
      ${title ? `<header class="sheet-head"><h2>${esc(title)}</h2><button class="icon-btn" data-act="sheet-close" aria-label="Затвори">${icon('close')}</button></header>` : ''}
      <div class="sheet-body">${render ? render() : body}</div>
    </section>`;
  root.appendChild(wrap);
  document.body.classList.add('sheet-open');
  requestAnimationFrame(() => requestAnimationFrame(() => wrap.classList.add('in')));
  current = { el: wrap, render, onClose };
  if (onMount) onMount(wrap);
  return wrap;
}
// saved = true, когато листът се затваря след „Запази“ (тогава onClose не се вика).
export function closeSheet(saved = false) {
  if (!current) return;
  const { el, onClose } = current;
  current = null;
  if (!saved && onClose) onClose();
  el.classList.remove('in');
  document.body.classList.remove('sheet-open');
  setTimeout(() => el.remove(), 280);
}
export function refreshSheet() {
  if (!current || !current.render) return;
  const body = current.el.querySelector('.sheet-body');
  const keep = {};
  body.querySelectorAll('[data-keep]').forEach((i) => (keep[i.name] = i.value));
  const top = body.scrollTop;
  body.innerHTML = current.render();
  body.querySelectorAll('[data-keep]').forEach((i) => {
    if (keep[i.name] != null) i.value = keep[i.name];
  });
  body.scrollTop = top;
}
export const sheetRoot = () => current && current.el;

export function formData(root) {
  const o = {};
  root.querySelectorAll('[name]').forEach((el) => {
    if (el.type === 'checkbox') {
      if (el.dataset.multi) {
        o[el.name] = o[el.name] || [];
        if (el.checked) o[el.name].push(el.value);
      } else o[el.name] = el.checked;
    } else if (el.type === 'radio') {
      if (el.checked) o[el.name] = el.value;
      else if (!(el.name in o)) o[el.name] = '';
    } else o[el.name] = el.value;
  });
  return o;
}

// Хубав въпрос „Сигурна ли си?“ вместо системния.
export function confirmSheet({ title, text, ok = 'Да', danger = false, onOk }) {
  openSheet({
    title,
    cls: 'sheet-small',
    body: `<p class="lead">${text}</p>
      <div class="btn-row">
        <button class="btn ghost" data-act="sheet-close">Откажи</button>
        <button class="btn ${danger ? 'danger' : 'primary'}" data-act="confirm-ok">${esc(ok)}</button>
      </div>`,
  });
  registerActions({
    'confirm-ok': () => {
      closeSheet(true);
      onOk();
    },
  });
}

// Чипове-радио бутони
export function chips(name, options, value, { multi = false, cls = '' } = {}) {
  return `<div class="chips ${cls}">${options
    .map(([v, label]) => {
      const checked = multi ? (value || []).includes(v) : value === v;
      return `<label class="chip"><input type="${multi ? 'checkbox' : 'radio'}" name="${name}" value="${esc(v)}" ${multi ? 'data-multi="1"' : ''} ${checked ? 'checked' : ''}><span>${label}</span></label>`;
    })
    .join('')}</div>`;
}

export const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
export const isStandalone = () => window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;

// Сваляне/споделяне на файл (копие, напомняне за календара)
export async function deliverFile(blob, filename, { share = true } = {}) {
  const file = new File([blob], filename, { type: blob.type });
  if (share && navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: filename });
      return true;
    } catch (e) {
      if (e && e.name === 'AbortError') return false;
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
  return true;
}
