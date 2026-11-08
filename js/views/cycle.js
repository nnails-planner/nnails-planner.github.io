// Цикъл: начало и край, прогноза, овулация, настроение и симптоми.
import * as D from '../dates.js';
import { cycleModel, dayStatus, MOODS, SYMPTOMS, FLOWS } from '../cycle-model.js';
import { state, ui, esc, commit, openSheet, closeSheet, registerActions, formData, sheetRoot, toast, confirmSheet, chips } from '../ui.js';
import { uid } from '../store.js';
import { icon } from '../icons.js';
import { monthGridHtml } from './calendar.js';

function ensureUi() {
  if (!ui.cyMonth) ui.cyMonth = D.monthKey(D.today());
}

function ring(m) {
  const R = 84, C = 2 * Math.PI * R;
  const len = Math.max(m.avgCycle, m.cycleDay);
  const p = Math.min(1, m.cycleDay / len);
  const ovP = Math.min(1, (D.diffDays(m.last.start, m.ovulation) + 1) / len);
  const a = ovP * 2 * Math.PI - Math.PI / 2;
  const ox = 100 + R * Math.cos(a), oy = 100 + R * Math.sin(a);
  return `<svg class="ring" viewBox="0 0 200 200" aria-hidden="true">
    <defs><linearGradient id="rg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#E7B7AE"/><stop offset="1" stop-color="#C4A062"/></linearGradient></defs>
    <circle cx="100" cy="100" r="${R}" class="ring-track"/>
    <circle cx="100" cy="100" r="${R}" class="ring-val" stroke="url(#rg)" stroke-dasharray="${(C * p).toFixed(1)} ${C.toFixed(1)}" transform="rotate(-90 100 100)"/>
    ${m.late ? '' : `<circle cx="${ox.toFixed(1)}" cy="${oy.toFixed(1)}" r="6" class="ring-ov"/>`}
  </svg>`;
}

function statusCard(m) {
  const t = D.today();
  if (!m.hasData) {
    return `<section class="card cy-start">
      <h2>Да започнем</h2>
      <p class="muted">Кога започна последният ти цикъл? След това ще ти показвам кога да очакваш следващия и кои са плодните ти дни.</p>
      <label class="field"><span>Първи ден на последния цикъл</span><input type="date" name="cy-first" max="${t}" value="${t}"></label>
      <button class="btn primary wide" data-act="cy-first">Запази</button>
    </section>`;
  }
  let head, line;
  if (m.inPeriod) {
    head = 'Менструация';
    line = m.ongoing ? 'Когато свърши, натисни „Свърши днес“.' : `До ${D.fmtShort(m.lastEnd)}`;
  } else if (m.late) {
    head = `Закъснение ${m.late} ${m.late === 1 ? 'ден' : 'дни'}`;
    line = `Очаквахме го на ${D.fmtShort(m.nextStart)}.`;
  } else {
    head = m.daysToNext === 0 ? 'Цикълът се очаква днес' : `Следващ цикъл ${D.relDays(m.daysToNext)}`;
    line = `около ${D.fmtLong(m.nextStart).toLowerCase()}`;
  }
  // Ако плодните дни от този цикъл са минали, показваме следващите.
  const cur = D.diffDays(t, m.fertileEnd) >= 0 ? m : m.future[0];
  const nextOne = cur !== m;
  const facts = m.late
    ? ''
    : `<div class="facts">
        <div><span class="caps">${nextOne ? 'Следваща овулация' : 'Овулация'}</span><b>${D.fmtShort(cur.ovulation)}</b><small>${D.relDays(D.diffDays(t, cur.ovulation))}</small></div>
        <div><span class="caps">${nextOne ? 'Следващи плодни дни' : 'Плодни дни'}</span><b>${D.fmtRange(cur.fertileStart, cur.fertileEnd)}</b><small>прогноза</small></div>
      </div>`;
  const btn = m.ongoing
    ? `<button class="btn rose wide" data-act="cy-end-today">Свърши днес</button>`
    : `<button class="btn rose wide" data-act="cy-start-today">Цикълът започна днес</button>`;
  return `<section class="card cy-status">
    <div class="ring-wrap">${ring(m)}<div class="ring-text"><span class="caps">Ден</span><b class="foil">${m.cycleDay}</b><small>от ${m.avgCycle}</small></div></div>
    <h2>${head}</h2>
    <p class="muted">${line}</p>
    ${facts}
    <div class="btn-col">${btn}<button class="btn ghost wide" data-act="cy-day" data-date="${t}">Как се чувствам днес</button></div>
  </section>`;
}

function todayMood() {
  const t = D.today();
  const day = state.cycle.days[t] || {};
  return `<section class="card mood-card">
    <h3>Настроение днес</h3>
    <div class="moods">${MOODS.map(([k, label]) => `<button class="mood ${day.mood === k ? 'on' : ''}" data-act="cy-mood" data-mood="${k}">${label}</button>`).join('')}</div>
  </section>`;
}

function stats(m) {
  if (!m.hasData) return '';
  const rows = [...m.periods]
    .reverse()
    .slice(0, 6)
    .map((p, i, arr) => {
      const idx = m.periods.indexOf(p);
      const next = m.periods[idx + 1];
      const len = next ? D.diffDays(p.start, next.start) : null;
      const dur = p.end ? D.diffDays(p.start, p.end) + 1 : null;
      return `<button class="hist" data-act="cy-edit" data-id="${p.id}">
        <span><b>${D.fmtFull(p.start)}</b><small>${dur ? `${dur} дни менструация` : 'без отбелязан край'}</small></span>
        <span class="hist-len">${len ? `${len} дни` : 'сега'}</span>
      </button>`;
    })
    .join('');
  return `<section class="card">
    <h3>Моите цикли</h3>
    <div class="stat-row">
      <div><b class="foil">${m.avgCycle}</b><small>дни средно между циклите</small></div>
      <div><b class="foil">${m.avgPeriod}</b><small>дни средно менструация</small></div>
      <div><b class="foil">${m.periods.length}</b><small>отбелязани</small></div>
    </div>
    <div class="hists">${rows}</div>
  </section>`;
}

function settingsCard(m) {
  const s = state.cycle.settings;
  return `<section class="card">
    <h3>Обичайно при мен</h3>
    <p class="muted small">Докато отбележиш поне два цикъла, прогнозата се смята с тези числа. После планерът се учи от твоите дати.</p>
    <div class="stepper"><span>Дължина на цикъла</span><button class="icon-btn" data-act="cy-set" data-k="cycleLen" data-n="-1" aria-label="По-малко">−</button><b>${s.cycleLen} дни</b><button class="icon-btn" data-act="cy-set" data-k="cycleLen" data-n="1" aria-label="Повече">+</button></div>
    <div class="stepper"><span>Менструация</span><button class="icon-btn" data-act="cy-set" data-k="periodLen" data-n="-1" aria-label="По-малко">−</button><b>${s.periodLen} дни</b><button class="icon-btn" data-act="cy-set" data-k="periodLen" data-n="1" aria-label="Повече">+</button></div>
  </section>`;
}

export function render() {
  ensureUi();
  const m = cycleModel(state.cycle);
  return `<div class="page">
    <figure class="banner"><img src="img/cycle.webp" alt="" width="960" height="536"></figure>
    <header class="page-head"><h1>Моят цикъл</h1><p class="muted">${icon('lock')} Вижда го само този телефон.</p></header>
    ${statusCard(m)}
    ${m.hasData ? todayMood() : ''}
    <section class="card month">
      <div class="cal-nav"><button class="icon-btn" data-act="cy-month" data-n="-1" aria-label="Предишен месец">${icon('left')}</button>
        <h2>${D.monthTitle(ui.cyMonth)}</h2>
        <button class="icon-btn" data-act="cy-month" data-n="1" aria-label="Следващ месец">${icon('right')}</button></div>
      ${monthGridHtml(ui.cyMonth, { act: 'cy-day', noSel: true, noEvents: true })}
      <div class="legend"><span><i class="lg-period"></i>цикъл</span><span><i class="lg-pred"></i>очакван</span><span><i class="lg-fert"></i>плодни дни</span><span><i class="lg-ov"></i>овулация</span></div>
      <p class="muted small center">Докосни ден, за да отбележиш начало, край, настроение или симптоми.</p>
    </section>
    ${stats(m)}
    ${settingsCard(m)}
    <p class="disclaimer">Прогнозите са ориентировъчни и се смятат по средната дължина на твоите цикли. Те не са медицински съвет и не са метод за контрацепция.</p>
  </div>`;
}

// ── отбелязване на начало и край ──
function markStart(date) {
  const ps = state.cycle.periods;
  const near = ps.find((p) => D.diffDays(date, p.start) >= 0 && D.diffDays(date, p.start) <= 9);
  if (near) {
    near.start = date;
    if (near.end && near.end < date) near.end = '';
    return 'moved';
  }
  const m = cycleModel(state.cycle);
  const inside = ps.find((p) => date > p.start && date <= (p.end || D.addDays(p.start, m.avgPeriod - 1)));
  if (inside) return 'inside';
  ps.push({ id: uid(), start: date, end: '' });
  return 'added';
}
function markEnd(date) {
  const p = [...state.cycle.periods]
    .filter((x) => x.start <= date && D.diffDays(x.start, date) <= 14)
    .sort((a, b) => b.start.localeCompare(a.start))[0];
  if (!p) return false;
  p.end = date;
  return true;
}

function dayForm(date) {
  const day = state.cycle.days[date] || {};
  const m = cycleModel(state.cycle);
  const st = dayStatus(m, date);
  const isStart = state.cycle.periods.some((p) => p.start === date);
  const stText = { period: 'Ден от цикъла', predicted: 'Очакван цикъл', ovulation: 'Овулация (прогноза)', fertile: 'Плодни дни (прогноза)' }[st];
  return `<form class="form" data-form="cyday" onsubmit="return false">
    ${stText ? `<div class="tags"><span class="tag tag-${st}">${stText}</span></div>` : ''}
    <div class="btn-row">
      <button class="btn rose-soft" data-act="cy-mark-start" data-date="${date}">${isStart ? '✓ Начало на цикъл' : 'Започна на тази дата'}</button>
      <button class="btn rose-soft" data-act="cy-mark-end" data-date="${date}">Свърши на тази дата</button>
    </div>
    <div class="field"><span>Колко силно</span>${chips('flow', FLOWS, String(day.flow ?? ''), { cls: 'chips-seg' })}</div>
    <div class="field"><span>Настроение</span>${chips('mood', MOODS, day.mood || '')}</div>
    <div class="field"><span>Симптоми</span>${chips('symptoms', SYMPTOMS, day.symptoms || [], { multi: true })}</div>
    <label class="field"><span>Бележка</span><textarea name="note" rows="3" maxlength="600" placeholder="Как спа, какво ти помогна…">${esc(day.note || '')}</textarea></label>
    <button class="btn primary wide" data-act="cy-day-save" data-date="${date}">Запази</button>
  </form>`;
}

export function openDay(date) {
  openSheet({ title: D.fmtLong(date), body: dayForm(date) });
}

function periodForm(p) {
  return `<form class="form" data-form="period" onsubmit="return false">
    <div class="row2">
      <label class="field"><span>Начало</span><input type="date" name="start" value="${p.start}"></label>
      <label class="field"><span>Край</span><input type="date" name="end" value="${p.end || ''}"></label>
    </div>
    <button class="btn primary wide" data-act="cy-period-save" data-id="${p.id}">Запази</button>
    <button class="btn ghost danger-text wide" data-act="cy-period-del" data-id="${p.id}">${icon('trash')} Изтрий този цикъл</button>
  </form>`;
}

registerActions({
  'cy-month': (el) => {
    ui.cyMonth = D.addMonths(ui.cyMonth, Number(el.dataset.n));
    commit();
  },
  'cy-first': () => {
    const v = document.querySelector('[name=cy-first]').value;
    if (!D.isValid(v) || v > D.today()) return toast('Избери дата до днес.');
    state.cycle.periods.push({ id: uid(), start: v, end: D.diffDays(v, D.today()) >= state.cycle.settings.periodLen ? D.addDays(v, state.cycle.settings.periodLen - 1) : '' });
    commit();
    toast('Записах го ✓ Вече виждаш прогнозата.');
  },
  'cy-start-today': () => {
    const r = markStart(D.today());
    commit();
    toast(r === 'inside' ? 'Днес вече е отбелязан като ден от цикъла.' : 'Отбелязах началото ✓ Грижи се за себе си 🤍');
  },
  'cy-end-today': () => {
    markEnd(D.today());
    commit();
    toast('Отбелязах края ✓');
  },
  'cy-day': (el) => openDay(el.dataset.date),
  'cy-mark-start': (el) => {
    const date = el.dataset.date;
    if (date > D.today()) return toast('Можеш да отбелязваш само дни до днес.');
    if (state.cycle.periods.some((p) => p.start === date)) {
      closeSheet(true);
      return toast('Този ден вече е начало на цикъл.');
    }
    const r = markStart(date);
    commit();
    closeSheet(true);
    toast(r === 'inside' ? 'Тази дата вече е в цикъл.' : r === 'moved' ? 'Преместих началото ✓' : 'Отбелязах началото ✓');
  },
  'cy-mark-end': (el) => {
    const date = el.dataset.date;
    if (date > D.today()) return toast('Можеш да отбелязваш само дни до днес.');
    if (!markEnd(date)) return toast('Първо отбележи деня, в който започна.');
    commit();
    closeSheet(true);
    toast('Отбелязах края ✓');
  },
  'cy-day-save': (el) => {
    const date = el.dataset.date;
    const f = formData(sheetRoot().querySelector('[data-form=cyday]'));
    const day = { flow: f.flow === '' ? undefined : Number(f.flow), mood: f.mood || '', symptoms: f.symptoms || [], note: f.note.trim() };
    if (day.flow === undefined && !day.mood && !day.symptoms.length && !day.note) delete state.cycle.days[date];
    else state.cycle.days[date] = day;
    closeSheet(true);
    commit();
    toast('Записано ✓');
  },
  'cy-mood': (el) => {
    const t = D.today();
    const day = state.cycle.days[t] || {};
    day.mood = day.mood === el.dataset.mood ? '' : el.dataset.mood;
    state.cycle.days[t] = day;
    commit();
  },
  'cy-set': (el) => {
    const s = state.cycle.settings;
    const k = el.dataset.k;
    const [min, max] = k === 'cycleLen' ? [20, 45] : [2, 10];
    s[k] = Math.min(max, Math.max(min, Number(s[k]) + Number(el.dataset.n)));
    commit();
  },
  'cy-edit': (el) => {
    const p = state.cycle.periods.find((x) => x.id === el.dataset.id);
    if (p) openSheet({ title: 'Промени цикъла', body: periodForm(p) });
  },
  'cy-period-save': (el) => {
    const p = state.cycle.periods.find((x) => x.id === el.dataset.id);
    const f = formData(sheetRoot().querySelector('[data-form=period]'));
    if (!D.isValid(f.start)) return toast('Избери начало.');
    if (f.end && f.end < f.start) return toast('Краят е преди началото.');
    p.start = f.start;
    p.end = f.end || '';
    closeSheet(true);
    commit();
    toast('Записано ✓');
  },
  'cy-period-del': (el) => {
    const id = el.dataset.id;
    confirmSheet({
      title: 'Да изтрия ли цикъла?',
      text: 'Прогнозата ще се сметне отново без него.',
      ok: 'Изтрий',
      danger: true,
      onOk: () => {
        state.cycle.periods = state.cycle.periods.filter((x) => x.id !== id);
        commit();
      },
    });
  },
});
