// Цели по тримесечия: една голяма цел за сезона и малки стъпки по месеци.
import * as D from '../dates.js';
import { state, ui, esc, commit, openSheet, closeSheet, registerActions, formData, sheetRoot, toast, confirmSheet } from '../ui.js';
import { uid } from '../store.js';
import { icon } from '../icons.js';

const SEASONS = [
  { q: 1, name: 'Зима', img: 'img/q1-winter.webp', months: [0, 1, 2], hint: 'Ново начало. Какво искаш да изградиш тази година?' },
  { q: 2, name: 'Пролет', img: 'img/q2-spring.webp', months: [3, 4, 5], hint: 'Време за растеж. Какво ще разцъфне в живота ти?' },
  { q: 3, name: 'Лято', img: 'img/q3-summer.webp', months: [6, 7, 8], hint: 'Светлина и свобода. Какво те прави щастлива?' },
  { q: 4, name: 'Есен', img: 'img/q4-autumn.webp', months: [9, 10, 11], hint: 'Прибиране на реколтата. С какво искаш да завършиш годината?' },
];

function ensureUi() {
  const t = D.today();
  if (!ui.goalYear) ui.goalYear = D.monthIdx(t) === 11 ? D.yearOf(t) + 1 : D.yearOf(t);
  if (!ui.goalQ) ui.goalQ = ui.goalYear === D.yearOf(t) ? D.quarterOf(t) : 1;
}

export function getQ(year, q, create = false) {
  const y = String(year);
  if (!state.goals[y]) {
    if (!create) return null;
    state.goals[y] = {};
  }
  if (!state.goals[y]['Q' + q]) {
    if (!create) return null;
    state.goals[y]['Q' + q] = { main: '', why: '', reward: '', steps: [] };
  }
  return state.goals[y]['Q' + q];
}

export function goalProgress(year, q) {
  const g = getQ(year, q);
  if (!g) return { main: '', pct: 0, done: 0, total: 0 };
  const total = g.steps.length;
  const done = g.steps.filter((s) => s.done).length;
  return { main: g.main, pct: total ? Math.round((done / total) * 100) : 0, done, total };
}

function stepRow(s) {
  return `<div class="step ${s.done ? 'done' : ''}">
    <button class="tick ${s.done ? 'on' : ''}" data-act="goal-step-toggle" data-id="${s.id}" aria-label="Готово">${icon('check')}</button>
    <button class="step-text" data-act="goal-step-edit" data-id="${s.id}">${esc(s.text)}</button>
  </div>`;
}

export function render() {
  ensureUi();
  const year = ui.goalYear;
  const season = SEASONS[ui.goalQ - 1];
  const g = getQ(year, season.q) || { main: '', why: '', reward: '', steps: [] };
  const p = goalProgress(year, season.q);
  const groups = [...season.months.map((mi) => [mi, D.MONTHS[mi]]), [-1, 'По всяко време']]
    .map(([mi, label]) => {
      const steps = g.steps.filter((s) => (s.month ?? -1) === mi);
      if (!steps.length) return '';
      return `<div class="step-group"><p class="caps">${D.cap(label)}</p>${steps.map(stepRow).join('')}</div>`;
    })
    .join('');
  return `<div class="page">
    <header class="page-head row-between">
      <div><p class="caps">Цели и развитие</p><h1>Моята ${year}</h1></div>
      <div class="year-nav"><button class="icon-btn" data-act="goal-year" data-n="-1" aria-label="Предишна година">${icon('left')}</button><button class="icon-btn" data-act="goal-year" data-n="1" aria-label="Следваща година">${icon('right')}</button></div>
    </header>
    <div class="seg seg4">${SEASONS.map((s) => {
      const pp = goalProgress(year, s.q);
      return `<button class="${s.q === ui.goalQ ? 'on' : ''}" data-act="goal-q" data-q="${s.q}"><b>${s.name}</b><small>Q${s.q}${pp.total ? ' · ' + pp.pct + '%' : ''}</small></button>`;
    }).join('')}</div>
    <section class="card goal-card">
      <figure class="banner banner-in"><img src="${season.img}" alt="" width="960" height="536"></figure>
      <p class="caps center">Q${season.q} · ${season.months.map((m) => D.MONTHS[m]).filter((_, i) => i !== 1).join(' – ')}</p>
      ${
        g.main
          ? `<button class="goal-main" data-act="goal-edit"><span class="caps">Голямата цел</span><b>${esc(g.main)}</b>${g.why ? `<small><em>Защо е важно:</em> ${esc(g.why)}</small>` : ''}${g.reward ? `<small><em>Наградата ми:</em> ${esc(g.reward)}</small>` : ''}<span class="edit-ic">${icon('edit')}</span></button>`
          : `<button class="goal-empty" data-act="goal-edit"><span>${esc(season.hint)}</span><b>${icon('plus')} Напиши голямата си цел</b></button>`
      }
      ${
        p.total
          ? `<div class="progress"><div class="bar"><i style="width:${p.pct}%"></i></div><p><b>${p.done} от ${p.total}</b> стъпки · ${p.pct}%</p></div>`
          : ''
      }
      ${p.total && p.done === p.total ? `<p class="bravo">${icon('sparkle')} Браво! Направи всички стъпки. Гордей се със себе си.</p>` : ''}
      <div class="steps">${groups}</div>
      <form class="add-step" data-form="step" onsubmit="return false">
        <input name="text" placeholder="Малка стъпка към целта…" maxlength="160" autocomplete="off" data-keep>
        <select name="month" aria-label="Месец" data-keep>${season.months.map((mi) => `<option value="${mi}">${D.MONTHS[mi]}</option>`).join('')}<option value="-1">по всяко време</option></select>
        <button class="round-btn" data-act="goal-step-add" aria-label="Добави стъпка">${icon('plus')}</button>
      </form>
    </section>
  </div>`;
}

function goalForm(g) {
  return `<form class="form" data-form="goal" onsubmit="return false">
    <label class="field"><span>Голямата цел за сезона</span><textarea name="main" rows="3" maxlength="200" placeholder="напр. Да тичам 5 км без почивка">${esc(g.main)}</textarea></label>
    <label class="field"><span>Защо е важна за мен</span><textarea name="why" rows="2" maxlength="300" placeholder="Когато ми е трудно, ще прочета това.">${esc(g.why)}</textarea></label>
    <label class="field"><span>С какво ще се наградя</span><input name="reward" maxlength="120" value="${esc(g.reward)}" placeholder="напр. SPA ден или нов цвят на ноктите 💅"></label>
    <button class="btn primary wide" data-act="goal-save">Запази</button>
  </form>`;
}

registerActions({
  'goal-year': (el) => {
    ui.goalYear += Number(el.dataset.n);
    commit();
  },
  'goal-q': (el) => {
    ui.goalQ = Number(el.dataset.q);
    commit();
  },
  'goal-edit': () => {
    const g = getQ(ui.goalYear, ui.goalQ) || { main: '', why: '', reward: '' };
    openSheet({ title: `Цел за ${SEASONS[ui.goalQ - 1].name.toLowerCase()} ${ui.goalYear}`, body: goalForm(g) });
  },
  'goal-save': () => {
    const f = formData(sheetRoot().querySelector('[data-form=goal]'));
    const g = getQ(ui.goalYear, ui.goalQ, true);
    g.main = f.main.trim();
    g.why = f.why.trim();
    g.reward = f.reward.trim();
    closeSheet(true);
    commit();
    toast(g.main ? 'Целта е записана ✓ Ти можеш!' : 'Записано');
  },
  'goal-step-add': () => {
    const form = document.querySelector('[data-form=step]');
    const f = formData(form);
    const text = f.text.trim();
    if (!text) {
      form.querySelector('[name=text]').focus();
      return;
    }
    const g = getQ(ui.goalYear, ui.goalQ, true);
    g.steps.push({ id: uid(), text, month: Number(f.month), done: false });
    form.querySelector('[name=text]').value = '';
    commit();
    document.querySelector('[data-form=step] [name=text]')?.focus({ preventScroll: true });
  },
  'goal-step-toggle': (el) => {
    const g = getQ(ui.goalYear, ui.goalQ);
    const s = g && g.steps.find((x) => x.id === el.dataset.id);
    if (!s) return;
    s.done = !s.done;
    commit();
    const p = goalProgress(ui.goalYear, ui.goalQ);
    if (s.done && p.done === p.total) toast('✨ Всички стъпки са готови! Браво!');
  },
  'goal-step-edit': (el) => {
    const g = getQ(ui.goalYear, ui.goalQ);
    const s = g && g.steps.find((x) => x.id === el.dataset.id);
    if (!s) return;
    const season = SEASONS[ui.goalQ - 1];
    openSheet({
      title: 'Стъпка',
      body: `<form class="form" data-form="stepedit" onsubmit="return false">
        <label class="field"><span>Какво</span><input name="text" value="${esc(s.text)}" maxlength="160"></label>
        <label class="field"><span>Месец</span><select name="month">${season.months.map((mi) => `<option value="${mi}" ${s.month === mi ? 'selected' : ''}>${D.MONTHS[mi]}</option>`).join('')}<option value="-1" ${s.month === -1 ? 'selected' : ''}>по всяко време</option></select></label>
        <button class="btn primary wide" data-act="goal-step-save" data-id="${s.id}">Запази</button>
        <button class="btn ghost danger-text wide" data-act="goal-step-del" data-id="${s.id}">${icon('trash')} Изтрий стъпката</button>
      </form>`,
    });
  },
  'goal-step-save': (el) => {
    const g = getQ(ui.goalYear, ui.goalQ);
    const s = g.steps.find((x) => x.id === el.dataset.id);
    const f = formData(sheetRoot().querySelector('[data-form=stepedit]'));
    if (f.text.trim()) s.text = f.text.trim();
    s.month = Number(f.month);
    closeSheet(true);
    commit();
  },
  'goal-step-del': (el) => {
    const g = getQ(ui.goalYear, ui.goalQ);
    g.steps = g.steps.filter((x) => x.id !== el.dataset.id);
    closeSheet(true);
    commit();
    toast('Изтрито');
  },
});
