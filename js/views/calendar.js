// Календар: месец и седмица, ангажименти и задачи.
import * as D from '../dates.js';
import { dayMarks } from '../holidays.js';
import * as Fasts from './fasts.js';
import { cycleModel, dayStatus } from '../cycle-model.js';
import { state, ui, esc, commit, openSheet, closeSheet, registerActions, formData, sheetRoot, toast, confirmSheet, chips, saveUi, deliverFile, isIOS, isStandalone } from '../ui.js';
import { uid } from '../store.js';
import { icon } from '../icons.js';
import { SALON } from '../config.js';
import { salonStatus } from './salon.js';
import { goalProgress } from './goals.js';

export const CATS = {
  personal: { label: 'Лично', color: '#C4A062' },
  work: { label: 'Работа', color: '#8C7D70' },
  family: { label: 'Семейство', color: '#A47A4E' },
  health: { label: 'Здраве', color: '#6E8A66' },
  beauty: { label: 'Красота', color: '#D99A90' },
  nnails: { label: 'N NAILS', color: '#87672F' },
};

const byTime = (a, b) => (a.time || '99').localeCompare(b.time || '99') || a.title.localeCompare(b.title);
export const eventsOn = (date) => state.events.filter((e) => e.date === date).sort(byTime);

function ensureUi() {
  const t = D.today();
  if (!ui.sel) ui.sel = t;
  if (!ui.calMonth) ui.calMonth = D.monthKey(t);
}

function greeting() {
  const h = new Date().getHours();
  const g = h < 11 ? 'Добро утро' : h < 18 ? 'Добър ден' : 'Добър вечер';
  const name = state.profile.name.trim();
  return name ? `${g}, ${esc(name)}` : g;
}

// ── малките карти горе ──
function summary() {
  const t = D.today();
  const out = [];
  const m = cycleModel(state.cycle);
  if (m.hasData) {
    let main, sub;
    if (m.inPeriod) {
      main = `Ден ${m.cycleDay} от цикъла`;
      sub = 'Погрижи се за себе си';
    } else if (m.late) {
      main = `Закъснение ${m.late} ${m.late === 1 ? 'ден' : 'дни'}`;
      sub = `Ден ${m.cycleDay} от цикъла`;
    } else {
      main = m.daysToNext === 0 ? 'Цикълът се очаква днес' : `Цикъл ${D.relDays(m.daysToNext)}`;
      sub = `Ден ${m.cycleDay} от цикъла`;
    }
    out.push(`<button class="mini mini-rose" data-act="go" data-tab="cycle">${icon('drop')}<span><b>${main}</b><small>${sub}</small></span></button>`);
  } else {
    out.push(`<button class="mini mini-rose" data-act="go" data-tab="cycle">${icon('drop')}<span><b>Следи цикъла си</b><small>Отбележи първия ден</small></span></button>`);
  }
  const s = salonStatus();
  if (s.next) {
    out.push(`<button class="mini mini-gold" data-act="go" data-tab="salon">${icon('sparkle')}<span><b>Час в N NAILS</b><small>${D.fmtShort(s.next.date)}${s.next.time ? ', ' + s.next.time : ''}</small></span></button>`);
  } else if (s.due && s.dueIn <= 0) {
    out.push(`<button class="mini mini-gold" data-act="go" data-tab="salon">${icon('sparkle')}<span><b>Време е за маникюр</b><small>Запиши си час</small></span></button>`);
  } else {
    out.push(`<button class="mini mini-gold" data-act="go" data-tab="salon">${icon('sparkle')}<span><b>N NAILS</b><small>${s.due ? 'Маникюр ' + D.relDays(s.dueIn) : 'Запиши си час'}</small></span></button>`);
  }
  const q = D.quarterOf(t);
  const g = goalProgress(D.yearOf(t), q);
  out.push(`<button class="mini mini-leaf" data-act="go" data-tab="goals">${icon('goal')}<span><b>${g.main ? `Q${q}: ${g.pct}%` : `Цел за Q${q}`}</b><small>${g.main ? esc(g.main) : 'Напиши я'}</small></span></button>`);
  const fm = Fasts.mini();
  if (fm) fm.first ? out.unshift(fm.html) : out.push(fm.html);
  return `<div class="minis">${out.join('')}</div>`;
}

function installHint() {
  if (state.profile.installHintHidden || isStandalone()) return '';
  return `<div class="hint card">
    <div class="hint-ic">${icon('addsq')}</div>
    <div><b>Сложи планера на началния екран</b><p>Така се отваря като приложение, работи без интернет и записите ти са на сигурно място.</p>
    <div class="hint-actions"><button class="btn small primary" data-act="install-open">Покажи ми как</button><button class="btn small ghost" data-act="install-hide">По-късно</button></div></div>
  </div>`;
}

function dueBanner() {
  const s = salonStatus();
  if (s.next || !s.due || s.dueIn > 0 || state.salon.dueHidden === s.due) return '';
  return `<div class="due card">
    <img src="img/nnails-logo.webp" alt="" class="due-logo">
    <div><b>Време е за нов маникюр</b><p>Минаха ${s.weeks} седмици от последното ти посещение в N NAILS.</p>
    <div class="hint-actions"><a class="btn small gold" href="${SALON.bookingUrl || 'tel:' + SALON.phone}" ${SALON.bookingUrl ? 'target="_blank" rel="noopener"' : ''}>${icon('phone')} Запиши час</a><button class="btn small ghost" data-act="due-hide" data-due="${s.due}">Скрий</button></div></div>
  </div>`;
}

// ── клетка от мрежата ──
function cell(date, monthKey, m, opts = {}) {
  const t = D.today();
  const out = D.monthKey(date) !== monthKey;
  const ev = eventsOn(date);
  const marks = state.prefs.holidays ? dayMarks(date) : null;
  const off = marks && marks.h.some((h) => h.off);
  const st = dayStatus(m, date);
  const cls = ['day', out && 'out', date === t && 'today', date === ui.sel && !opts.noSel && 'sel', st && 'cy-' + st, off && 'off', (D.wdIndex(date) > 4) && 'we'].filter(Boolean).join(' ');
  const dots = opts.noEvents ? '' : ev.slice(0, 3).map((e) => `<i style="background:${(CATS[e.cat] || CATS.personal).color}"></i>`).join('');
  const holi = marks && marks.h.length ? '<em class="holi"></em>' : '';
  const fast = opts.noEvents ? '' : Fasts.gridMark(date);
  return `<button class="${cls}" data-act="${opts.act || 'pick-day'}" data-date="${date}" aria-label="${D.fmtLong(date)}">${holi}<span>${D.dayNum(date)}</span><span class="dots">${dots}</span>${fast}</button>`;
}

export function monthGridHtml(monthKey, opts = {}) {
  const m = cycleModel(state.cycle);
  const days = D.monthGrid(monthKey);
  return `<div class="grid-head">${D.WD_SHORT.map((w, i) => `<span class="${i > 4 ? 'we' : ''}">${w}</span>`).join('')}</div>
    <div class="grid">${days.map((d) => cell(d, monthKey, m, opts)).join('')}</div>`;
}

function dayLine(date, opts = {}) {
  const parts = [];
  const marks = state.prefs.holidays ? dayMarks(date) : null;
  if (marks) {
    marks.h.forEach((h) => parts.push(`<span class="tag ${h.off ? 'tag-gold' : ''}">${esc(h.name)}${h.off ? ' · почивен ден' : ''}</span>`));
  }
  parts.push(...Fasts.dayTags(date, { withLevel: opts.week }));
  const m = cycleModel(state.cycle);
  const st = dayStatus(m, date);
  const stText = { period: 'Цикъл', predicted: 'Очакван цикъл', ovulation: 'Овулация (прогноза)', fertile: 'Плодни дни (прогноза)' }[st];
  if (stText) parts.push(`<span class="tag tag-${st}">${stText}</span>`);
  let html = parts.length ? `<div class="tags">${parts.join('')}</div>` : '';
  if (marks && marks.n.length) html += `<p class="nameday">${icon('gift')} Имен ден имат: ${esc(marks.n.join(', '))}</p>`;
  return html;
}

function eventRow(e) {
  const c = CATS[e.cat] || CATS.personal;
  const time = e.time ? `${e.time}${e.end ? '<small>' + e.end + '</small>' : ''}` : '<small>цял ден</small>';
  const check = e.kind === 'task' ? `<button class="tick ${e.done ? 'on' : ''}" data-act="toggle-task" data-id="${e.id}" aria-label="Готово">${icon('check')}</button>` : '';
  return `<div class="ev ${e.done ? 'done' : ''}" style="--c:${c.color}">
    ${check}
    <button class="ev-main" data-act="edit-event" data-id="${e.id}">
      <span class="ev-time">${time}</span>
      <span class="ev-text"><b>${esc(e.title)}</b>${e.note ? `<small>${esc(e.note)}</small>` : ''}</span>
      <span class="ev-cat">${e.cat === 'nnails' ? '<img src="img/nnails-logo.webp" alt="N NAILS">' : esc(c.label)}</span>
    </button>
  </div>`;
}

function dayPanel(date) {
  const ev = eventsOn(date);
  return `<section class="card day-panel">
    <header class="panel-head"><div><p class="caps">${D.relDays(D.diffDays(D.today(), date)).replace(/^./, (c) => c.toUpperCase())}</p><h3>${D.fmtLong(date)}</h3></div></header>
    ${Fasts.card(date)}
    ${dayLine(date)}
    <div class="evs">${ev.length ? ev.map(eventRow).join('') : `<p class="empty">Свободен ден. Добави среща, задача или нещо хубаво за себе си.</p>`}</div>
  </section>`;
}

function weekView() {
  const start = D.startOfWeek(ui.sel);
  const end = D.addDays(start, 6);
  const days = Array.from({ length: 7 }, (_, i) => D.addDays(start, i));
  const t = D.today();
  return `<div class="cal-nav"><button class="icon-btn" data-act="week-shift" data-n="-1" aria-label="Предишна седмица">${icon('left')}</button>
      <h2>${D.fmtRange(start, end)}</h2>
      <button class="icon-btn" data-act="week-shift" data-n="1" aria-label="Следваща седмица">${icon('right')}</button></div>
    <div class="week">${days
      .map((d) => {
        const ev = eventsOn(d);
        return `<section class="wk-day ${d === t ? 'today' : ''}">
          <header><button class="wk-date" data-act="pick-day-month" data-date="${d}"><b>${D.dayNum(d)}</b><span>${D.WD[D.wdIndex(d)]}</span></button>
          <button class="icon-btn small" data-act="new-event" data-date="${d}" aria-label="Добави">${icon('plus')}</button></header>
          ${dayLine(d, { week: true })}
          ${ev.length ? `<div class="evs">${ev.map(eventRow).join('')}</div>` : ''}
        </section>`;
      })
      .join('')}</div>`;
}

export function render() {
  ensureUi();
  const t = D.today();
  const mode = ui.calMode === 'week' ? 'week' : 'month';
  return `<div class="page cal-page">
    <header class="hello">
      <p class="caps">${D.fmtLong(t)} ${D.yearOf(t)}</p>
      <h1>${greeting()}</h1>
    </header>
    ${summary()}
    ${installHint()}
    ${dueBanner()}
    <div class="seg" role="tablist">
      <button class="${mode === 'month' ? 'on' : ''}" data-act="cal-mode" data-mode="month">Месец</button>
      <button class="${mode === 'week' ? 'on' : ''}" data-act="cal-mode" data-mode="week">Седмица</button>
    </div>
    ${
      mode === 'month'
        ? `<section class="card month">
        <div class="cal-nav"><button class="icon-btn" data-act="month-shift" data-n="-1" aria-label="Предишен месец">${icon('left')}</button>
          <h2>${D.monthTitle(ui.calMonth)}</h2>
          <button class="icon-btn" data-act="month-shift" data-n="1" aria-label="Следващ месец">${icon('right')}</button></div>
        ${monthGridHtml(ui.calMonth)}
        <div class="legend"><span><i class="lg-ev"></i>ангажимент</span><span><i class="lg-period"></i>цикъл</span><span><i class="lg-pred"></i>очакван</span><span><i class="lg-fert"></i>плодни дни</span>${Fasts.legend(ui.calMonth)}</div>
        ${ui.calMonth !== D.monthKey(t) || ui.sel !== t ? `<button class="link-btn" data-act="go-today">Към днес</button>` : ''}
      </section>
      ${dayPanel(ui.sel)}`
        : weekView()
    }
    <button class="fab" data-act="new-event" data-date="${ui.sel}" aria-label="Нов ангажимент">${icon('plus')}</button>
  </div>`;
}

// ── редактор ──
function eventForm(e) {
  const isNew = !e.id;
  return `<form class="form" data-form="event" onsubmit="return false">
    <label class="field"><span>Какво</span><input name="title" value="${esc(e.title)}" placeholder="напр. Среща с Мария" autocomplete="off" maxlength="120"></label>
    ${chips('kind', [['event', 'Среща'], ['task', 'Задача']], e.kind || 'event', { cls: 'chips-seg' })}
    <div class="row2">
      <label class="field"><span>Дата</span><input type="date" name="date" value="${e.date}" required></label>
      <label class="field"><span>Час</span><input type="time" name="time" value="${e.time || ''}"></label>
    </div>
    <label class="field"><span>До (по желание)</span><input type="time" name="end" value="${e.end || ''}"></label>
    <div class="field"><span>Вид</span>${chips('cat', Object.entries(CATS).map(([k, c]) => [k, `<i class="dot" style="background:${c.color}"></i>${c.label}`]), e.cat || 'personal')}</div>
    <label class="field"><span>Бележка</span><textarea name="note" rows="3" placeholder="Адрес, какво да взема, идеи…" maxlength="1000">${esc(e.note || '')}</textarea></label>
    <button class="btn primary wide" data-act="save-event" data-id="${e.id || ''}">${isNew ? 'Запази' : 'Запази промените'}</button>
    ${
      isNew
        ? ''
        : `<div class="btn-row">
        <button class="btn ghost" data-act="event-ics" data-id="${e.id}">${icon('bell')} Напомни ми</button>
        <button class="btn ghost danger-text" data-act="delete-event" data-id="${e.id}">${icon('trash')} Изтрий</button>
      </div>`
    }
  </form>`;
}

export function openEventEditor(e) {
  openSheet({
    title: e.id ? 'Промени' : 'Нов ангажимент',
    body: eventForm(e),
    onMount: (el) => {
      if (!e.id) setTimeout(() => el.querySelector('[name=title]').focus({ preventScroll: true }), 320);
    },
  });
}

// ── напомняне за календара на телефона (.ics) ──
function icsEscape(s) {
  return String(s || '').replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;');
}
export function makeIcs({ uidv, date, time, end, title, note, location, alarms }) {
  const d = date.replace(/-/g, '');
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//N NAILS//Planner//BG', 'CALSCALE:GREGORIAN', 'BEGIN:VEVENT', `UID:${uidv}@nnails-planner`, `DTSTAMP:${stamp}`];
  if (time) {
    const st = `${d}T${time.replace(':', '')}00`;
    let en = end && end > time ? `${d}T${end.replace(':', '')}00` : null;
    if (!en) {
      const [h, mi] = time.split(':').map(Number);
      const t2 = new Date(2000, 0, 1, h + 1, mi);
      en = t2.getDate() === 1 ? `${d}T${D.pad(t2.getHours())}${D.pad(t2.getMinutes())}00` : `${d}T235900`;
    }
    lines.push(`DTSTART:${st}`, `DTEND:${en}`);
  } else {
    lines.push(`DTSTART;VALUE=DATE:${d}`, `DTEND;VALUE=DATE:${D.addDays(date, 1).replace(/-/g, '')}`);
  }
  lines.push(`SUMMARY:${icsEscape(title)}`);
  if (note) lines.push(`DESCRIPTION:${icsEscape(note)}`);
  if (location) lines.push(`LOCATION:${icsEscape(location)}`);
  for (const a of alarms) lines.push('BEGIN:VALARM', `TRIGGER:${a}`, 'ACTION:DISPLAY', `DESCRIPTION:${icsEscape(title)}`, 'END:VALARM');
  lines.push('END:VEVENT', 'END:VCALENDAR');
  return new Blob([lines.join('\r\n')], { type: 'text/calendar;charset=utf-8' });
}

export function exportEventIcs(e) {
  const nn = e.cat === 'nnails';
  const blob = makeIcs({
    uidv: e.id,
    date: e.date,
    time: e.time,
    end: e.end,
    title: e.title,
    note: nn ? `${e.note ? e.note + '\n' : ''}N NAILS · ${SALON.phoneDisplay}` : e.note,
    location: nn ? SALON.address : '',
    alarms: e.time ? (nn ? ['-P1D', '-PT2H'] : ['-PT30M']) : ['PT9H'],
  });
  return deliverFile(blob, `${nn ? 'N-NAILS-chas' : 'napomnyane'}-${e.date}.ics`, { share: false });
}

registerActions({
  'cal-mode': (el) => {
    ui.calMode = el.dataset.mode;
    saveUi();
    commit();
  },
  'month-shift': (el) => {
    ui.calMonth = D.addMonths(ui.calMonth, Number(el.dataset.n));
    commit();
  },
  'week-shift': (el) => {
    ui.sel = D.addDays(ui.sel, 7 * Number(el.dataset.n));
    ui.calMonth = D.monthKey(ui.sel);
    commit();
  },
  'go-today': () => {
    ui.sel = D.today();
    ui.calMonth = D.monthKey(ui.sel);
    commit();
  },
  'pick-day': (el) => {
    const d = el.dataset.date;
    if (ui.sel === d && D.monthKey(d) === ui.calMonth) {
      openEventEditor({ title: '', date: d, kind: 'event', cat: 'personal' });
      return;
    }
    ui.sel = d;
    if (D.monthKey(d) !== ui.calMonth) ui.calMonth = D.monthKey(d);
    commit();
    requestAnimationFrame(() => document.querySelector('.day-panel')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }));
  },
  'pick-day-month': (el) => {
    ui.sel = el.dataset.date;
    ui.calMonth = D.monthKey(ui.sel);
    ui.calMode = 'month';
    saveUi();
    commit();
  },
  'new-event': (el) => openEventEditor({ title: '', date: el.dataset.date || ui.sel || D.today(), kind: 'event', cat: el.dataset.cat || 'personal' }),
  'edit-event': (el) => {
    const e = state.events.find((x) => x.id === el.dataset.id);
    if (e) openEventEditor({ ...e });
  },
  'save-event': (el) => {
    const f = formData(sheetRoot().querySelector('[data-form=event]'));
    let title = f.title.trim();
    if (!title && f.cat === 'nnails') title = 'Маникюр в N NAILS';
    if (!title) {
      toast('Напиши какво е ангажиментът.');
      sheetRoot().querySelector('[name=title]').focus();
      return;
    }
    if (!D.isValid(f.date)) {
      toast('Избери дата.');
      return;
    }
    const data = { title, kind: f.kind || 'event', date: f.date, time: f.time || '', end: f.time && f.end ? f.end : '', cat: f.cat || 'personal', note: f.note.trim() };
    const id = el.dataset.id;
    if (id) {
      const e = state.events.find((x) => x.id === id);
      Object.assign(e, data);
    } else state.events.push({ id: uid(), done: false, ...data });
    ui.sel = data.date;
    ui.calMonth = D.monthKey(data.date);
    closeSheet(true);
    commit();
    toast('Записано ✓');
  },
  'delete-event': (el) => {
    const id = el.dataset.id;
    confirmSheet({
      title: 'Да изтрия ли?',
      text: 'Ангажиментът ще изчезне от планера.',
      ok: 'Изтрий',
      danger: true,
      onOk: () => {
        state.events = state.events.filter((x) => x.id !== id);
        commit();
        toast('Изтрито');
      },
    });
  },
  'toggle-task': (el) => {
    const e = state.events.find((x) => x.id === el.dataset.id);
    if (!e) return;
    e.done = !e.done;
    commit();
  },
  'event-ics': async (el) => {
    const e = state.events.find((x) => x.id === el.dataset.id);
    if (!e) return;
    await exportEventIcs(e);
    toast(isIOS() ? 'Отвори файла и натисни „Добави“ в календара.' : 'Отвори файла, за да влезе в календара на телефона.');
  },
  'install-hide': () => {
    state.profile.installHintHidden = true;
    commit();
  },
  'due-hide': (el) => {
    state.salon.dueHidden = el.dataset.due;
    commit();
  },
});
