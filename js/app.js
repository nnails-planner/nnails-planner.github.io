// N NAILS Planner — стартиране, навигация и офлайн режим.
import { state, ui, saveUi, setRenderer, rerender, getAction, registerActions, closeSheet, toast } from './ui.js';
import * as Calendar from './views/calendar.js';
import * as Cycle from './views/cycle.js';
import * as Goals from './views/goals.js';
import * as Corner from './views/corner.js';
import * as Salon from './views/salon.js';
import * as Settings from './views/settings.js';

const VIEWS = { cal: Calendar, cycle: Cycle, goals: Goals, corner: Corner, salon: Salon };
const view = document.getElementById('view');
let lastTab = null;

function render() {
  if (!VIEWS[ui.tab]) ui.tab = 'cal';
  const v = VIEWS[ui.tab];
  // пазим написаното в полетата с data-keep
  const keep = {};
  view.querySelectorAll('[data-keep]').forEach((i) => (keep[i.name] = i.value));
  view.innerHTML = v.render();
  view.querySelectorAll('[data-keep]').forEach((i) => {
    if (keep[i.name] != null) i.value = keep[i.name];
  });
  // плавно появяване само при смяна на раздела
  if (lastTab !== ui.tab) view.firstElementChild?.classList.add('enter');
  lastTab = ui.tab;
  if (v.afterRender) v.afterRender(view);
  document.querySelectorAll('.tabs [data-tab]').forEach((b) => b.setAttribute('aria-current', b.dataset.tab === ui.tab ? 'page' : 'false'));
  document.body.dataset.tab = ui.tab;
}
setRenderer(render);

registerActions({
  go: (el) => {
    ui.tab = el.dataset.tab;
    saveUi();
    rerender();
    window.scrollTo({ top: 0 });
  },
  'sheet-close': () => closeSheet(),
});

document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-act]');
  if (!el) return;
  const fn = getAction(el.dataset.act);
  if (!fn) return;
  if (el.tagName === 'BUTTON' || el.tagName === 'A' && !el.getAttribute('href')) e.preventDefault();
  fn(el, e);
});
document.addEventListener('change', (e) => {
  const el = e.target.closest('[data-change]');
  if (!el) return;
  const fn = getAction(el.dataset.change);
  if (fn) fn(el, e);
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeSheet();
  // Enter в бързите полета добавя
  if (e.key === 'Enter' && e.target.matches('.add-step input, .add-item input')) {
    e.preventDefault();
    e.target.closest('form').querySelector('[data-act]')?.click();
  }
});

// Когато денят се смени, докато приложението е отворено
let lastDay = new Date().toDateString();
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && new Date().toDateString() !== lastDay) {
    lastDay = new Date().toDateString();
    ui.sel = null;
    ui.calMonth = null;
    ui.cyMonth = null;
    rerender();
  }
});

render();
if (!state.profile.welcomed) setTimeout(Settings.openWelcome, 250);

// ── офлайн режим ──
if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('sw.js')
      .then((reg) => {
        const offerUpdate = (w) => {
          toast('Има нова версия на планера. <button class="toast-btn" data-act="sw-update">Обнови</button>');
          registerActions({ 'sw-update': () => w.postMessage('skipWaiting') });
        };
        if (reg.waiting && navigator.serviceWorker.controller) offerUpdate(reg.waiting);
        reg.addEventListener('updatefound', () => {
          const w = reg.installing;
          w?.addEventListener('statechange', () => {
            if (w.state === 'installed' && navigator.serviceWorker.controller) offerUpdate(w);
          });
        });
      })
      .catch((e) => console.warn('SW', e));
    let reloaded = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (reloaded) return;
      reloaded = true;
      location.reload();
    });
  });
}
