// Дневник на сънищата: какво сънувах и как спах.
// Живее само в „Кътче“, в раздел „Сънища“.
import * as D from '../dates.js';
import { state, ui, esc, commit, openSheet, closeSheet, registerActions, formData, sheetRoot, toast, confirmSheet, chips, saveUi } from '../ui.js';
import { uid } from '../store.js';
import { icon } from '../icons.js';

export const DREAM_KINDS = [
  ['nice', '✨ Хубав'],
  ['calm', '🌙 Спокоен'],
  ['strange', '🌀 Странен'],
  ['scary', '😰 Кошмар'],
  ['repeat', '🔁 Повтаря се'],
  ['lucid', '💡 Знаех, че сънувам'],
];
export const SLEEP = [
  ['great', '😴 Отлично'],
  ['good', '🙂 Добре'],
  ['ok', '😐 Горе-долу'],
  ['bad', '😣 Лошо'],
];
const KIND_EMO = Object.fromEntries(DREAM_KINDS.map(([k, l]) => [k, l.split(' ')[0]]));
const SLEEP_TEXT = { great: '😴 спах отлично', good: '🙂 спах добре', ok: '😐 спах горе-долу', bad: '😣 спах лошо' };
const FILTERS = [
  ['all', 'Всички'],
  ['nice', '✨ Хубави'],
  ['scary', '😰 Кошмари'],
  ['repeat', '🔁 Повтарящи се'],
];

function headline(d) {
  if (d.title) return d.title;
  const first = (d.text || '').split('\n')[0].trim();
  if (first) return first.length > 60 ? first.slice(0, 58).trimEnd() + '…' : first;
  return 'Не помня какво сънувах';
}

function dreamCard(d) {
  const meta = [];
  const emo = (d.kinds || []).map((k) => KIND_EMO[k]).filter(Boolean).join(' ');
  if (emo) meta.push(`<span class="dream-emo">${emo}</span>`);
  if (d.sleep) meta.push(`<span class="tag">${SLEEP_TEXT[d.sleep]}</span>`);
  const showText = d.title && d.text;
  return `<button class="card dream" data-act="dream-edit" data-id="${d.id}">
    <span class="dream-date"><b>${D.dayNum(d.date)}</b><small>${D.MONTHS_SHORT[D.monthIdx(d.date)]}</small></span>
    <span class="dream-body"><b>${esc(headline(d))}</b>${showText ? `<em>${esc(d.text)}</em>` : ''}
      ${meta.length ? `<span class="dream-meta">${meta.join('')}</span>` : ''}</span>
  </button>`;
}

export function dreamsPage() {
  const all = [...state.dreams].sort((a, b) => b.date.localeCompare(a.date) || (b.added || '').localeCompare(a.added || ''));
  const f = ui.dreamFilter || 'all';
  const list = all.filter((d) => f === 'all' || (d.kinds || []).includes(f));
  const thisMonth = all.filter((d) => D.monthKey(d.date) === D.monthKey(D.today())).length;
  return `<figure class="banner"><img src="img/dreams.svg" alt="" width="960" height="536"></figure>
    <header class="page-head"><h1>Дневник на сънищата</h1><p class="muted">Записани: <b>${all.length}</b> · Този месец: <b>${thisMonth}</b></p></header>
    ${
      all.length
        ? `<div class="filter">${FILTERS.map(([k, l]) => `<button class="${f === k ? 'on' : ''}" data-act="dream-filter" data-f="${k}">${l}</button>`).join('')}</div>`
        : ''
    }
    <div class="list">${
      list.length
        ? list.map(dreamCard).join('')
        : all.length
          ? `<p class="empty card">Тук още няма такива сънища.</p>`
          : `<div class="card dream-tip">${icon('moon')}<p>Казват, че сънят от четвъртък срещу петък се сбъдва, а лошият сън се разказва на течаща вода, за да отплува надалеч. Сънищата са малки приказки, които душата ти разказва нощем. Запиши своята веднага щом станеш. С времето ще откриеш кои приказки се повтарят.</p></div>`
    }</div>
    <button class="btn primary wide" data-act="dream-new">${icon('plus')} Запиши сън</button>`;
}

function dreamForm(d) {
  return `<form class="form" data-form="dream" onsubmit="return false">
    <label class="field"><span>Дата</span><input type="date" name="date" value="${d.date || D.today()}"></label>
    <label class="field"><span>Заглавие (по желание)</span><input name="title" value="${esc(d.title || '')}" maxlength="80" placeholder="напр. Летях над морето" autocomplete="off"></label>
    <label class="field"><span>Какво сънувах</span><textarea name="text" rows="6" maxlength="4000" placeholder="Хора, места, цветове, какво почувства…">${esc(d.text || '')}</textarea></label>
    <div class="field"><span>Какъв беше сънят</span>${chips('kinds', DREAM_KINDS, d.kinds || [], { multi: true })}</div>
    <div class="field"><span>Как спах</span>${chips('sleep', SLEEP, d.sleep || '')}</div>
    <button class="btn primary wide" data-act="dream-save" data-id="${d.id || ''}">Запази</button>
    ${d.id ? `<button class="btn ghost danger-text wide" data-act="dream-del" data-id="${d.id}">${icon('trash')} Изтрий</button>` : ''}
  </form>`;
}

export function openDream(d) {
  openSheet({ title: d.id ? 'Сън' : `${D.fmtShort(d.date || D.today())} · Нов сън`, body: dreamForm(d) });
}

registerActions({
  'dream-filter': (el) => {
    ui.dreamFilter = el.dataset.f;
    saveUi();
    commit();
  },
  'dream-new': (el) => openDream({ date: el.dataset.date || D.today(), kinds: [] }),
  'dream-edit': (el) => {
    const d = state.dreams.find((x) => x.id === el.dataset.id);
    if (d) openDream(d);
  },
  'dream-save': (el) => {
    const f = formData(sheetRoot().querySelector('[data-form=dream]'));
    const data = {
      date: D.isValid(f.date) ? f.date : D.today(),
      title: f.title.trim(),
      text: f.text.trim(),
      kinds: f.kinds || [],
      sleep: f.sleep || '',
    };
    if (!data.title && !data.text && !data.kinds.length && !data.sleep) return toast('Напиши какво сънува или как спа.');
    const id = el.dataset.id;
    if (id) Object.assign(state.dreams.find((x) => x.id === id), data);
    else state.dreams.push({ id: uid(), added: new Date().toISOString(), ...data });
    closeSheet(true);
    commit();
    toast(data.kinds.includes('scary') ? 'Записано. Беше само сън 🤍' : 'Записано ✓');
  },
  'dream-del': (el) => {
    const id = el.dataset.id;
    confirmSheet({
      title: 'Да изтрия ли съня?',
      text: 'Ще изчезне от дневника.',
      ok: 'Изтрий',
      danger: true,
      onOk: () => {
        state.dreams = state.dreams.filter((x) => x.id !== id);
        commit();
      },
    });
  },
});
