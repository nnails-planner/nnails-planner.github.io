// Календар: месец и седмица, ангажименти и задачи.
import * as D from '../dates.js';
import { dayMarks } from '../holidays.js';
import * as Fasts from './fasts.js';
import * as Kitchen from './kitchen.js';
import * as E from '../events.js';
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
export const eventsOn = (date) => state.events.flatMap((e) => (E.occursOn(e, date) ? [E.occurrence(e, date)] : [])).sort(byTime);

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
  const kmark = opts.noEvents ? '' : Kitchen.gridMark(date);
  return `<button class="${cls}" data-act="${opts.act || 'pick-day'}" data-date="${date}" aria-label="${D.fmtLong(date)}">${holi}${kmark}<span>${D.dayNum(date)}</span><span class="dots">${dots}</span>${fast}</button>`;
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
  if (opts.week) parts.push(...Kitchen.weekTags(date));
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
  const check = e.kind === 'task' ? `<button class="tick ${e.done ? 'on' : ''}" data-act="toggle-task" data-id="${e.id}" data-date="${e.date}" aria-label="Готово">${icon('check')}</button>` : '';
  const meta = [E.isRecurring(e) && `<span>${icon('redo')}${esc(E.repeatText(e))}</span>`, e.place && `<span>${icon('pin')}${esc(e.place)}</span>`, e.guests && e.guests.length && `<span>${icon('users')}поканени: ${e.guests.length}</span>`].filter(Boolean);
  return `<div class="ev ${e.done ? 'done' : ''}" style="--c:${c.color}">
    ${check}
    <button class="ev-main" data-act="edit-event" data-id="${e.id}" data-date="${e.date}">
      <span class="ev-time">${time}</span>
      <span class="ev-text"><b>${esc(e.title)}</b>${meta.length ? `<span class="ev-meta">${meta.join('')}</span>` : ''}${e.note ? `<small>${esc(e.note)}</small>` : ''}</span>
      <span class="ev-cat">${e.cat === 'nnails' ? '<img src="img/nnails-logo.webp" alt="N NAILS">' : esc(c.label)}</span>
    </button>
  </div>`;
}

function dayPanel(date) {
  const ev = eventsOn(date);
  return `<section class="card day-panel">
    <header class="panel-head"><div><p class="caps">${D.relDays(D.diffDays(D.today(), date)).replace(/^./, (c) => c.toUpperCase())}</p><h3>${D.fmtLong(date)}</h3></div></header>
    ${Fasts.card(date)}
    ${Kitchen.dayBlock(date)}
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
        <div class="legend"><span><i class="lg-ev"></i>ангажимент</span><span><i class="lg-period"></i>цикъл</span><span><i class="lg-pred"></i>очакван</span><span><i class="lg-fert"></i>плодни дни</span>${Fasts.legend(ui.calMonth)}${Kitchen.monthHasKitchen(ui.calMonth) ? '<span><i class="lg-k"></i>готвя</span>' : ''}</div>
        ${ui.calMonth !== D.monthKey(t) || ui.sel !== t ? `<button class="link-btn" data-act="go-today">Към днес</button>` : ''}
      </section>
      ${dayPanel(ui.sel)}`
        : weekView()
    }
    <button class="fab" data-act="new-event" data-date="${ui.sel}" aria-label="Нов ангажимент">${icon('plus')}</button>
  </div>`;
}

// ── редактор ──
let evDraft = null; // { id, occ, guests: [] }
const unitWord = (freq, n) => (E.UNIT[freq] ? E.UNIT[freq][Number(n) === 1 ? 0 : 1] : '');

function repeatFields(e) {
  const r = e.repeat || {};
  const f = r.freq || '';
  const days = f === 'weekly' && r.days && r.days.length ? r.days : [D.wdIndex(e.date || D.today())];
  const endKind = r.count ? 'count' : r.until ? 'until' : 'never';
  return `<div class="field rep"><span>Повтаряне</span>
    <select name="freq" data-change="ev-freq">${E.FREQS.map(([k, l]) => `<option value="${k}" ${k === f ? 'selected' : ''}>${l}</option>`).join('')}</select>
    <div class="rep-more" ${f ? '' : 'hidden'}>
      <div class="rep-days chips" data-change="ev-days" ${f === 'weekly' ? '' : 'hidden'}>${D.WD_SHORT.map((w, i) => `<label class="chip"><input type="checkbox" name="rdays" value="${i}" data-multi="1" ${days.includes(i) ? 'checked' : ''}><span>${w}</span></label>`).join('')}</div>
      <label class="rep-int">На всеки <input type="number" name="rint" min="1" max="99" inputmode="numeric" value="${r.interval || 1}" data-change="ev-rint"> <span class="rep-unit">${unitWord(f, r.interval || 1)}</span></label>
      <div class="rep-end"><small>Край</small><div data-change="ev-rend">${chips('rend', [['never', 'Никога'], ['until', 'На дата'], ['count', 'След брой']], endKind, { cls: 'chips-seg' })}</div>
        <input type="date" name="runtil" value="${r.until || ''}" aria-label="До дата" ${endKind === 'until' ? '' : 'hidden'}>
        <label class="rep-count" ${endKind === 'count' ? '' : 'hidden'}><input type="number" name="rcount" min="1" max="999" inputmode="numeric" value="${r.count || 10}"> пъти</label>
      </div>
    </div>
  </div>`;
}

function guestsHtml() {
  return evDraft.guests
    .map(
      (g, i) => `<span class="guest"><span><b>${esc(g.name || g.email || g.tel)}</b>${g.name && (g.email || g.tel) ? `<small>${esc(g.email || g.tel)}</small>` : ''}</span>
      <button type="button" data-act="ev-guest-del" data-i="${i}" aria-label="Махни">${icon('close')}</button></span>`
    )
    .join('');
}
const canPickContacts = () => 'contacts' in navigator && navigator.contacts && 'select' in navigator.contacts;

function eventForm(e) {
  const isNew = !e.id;
  return `<form class="form" data-form="event" onsubmit="return false">
    <label class="field"><span>Какво</span><input name="title" value="${esc(e.title)}" placeholder="напр. Среща с Мария" autocomplete="off" maxlength="120"></label>
    ${chips('kind', [['event', 'Среща'], ['task', 'Задача']], e.kind || 'event', { cls: 'chips-seg' })}
    <div class="row2">
      <label class="field"><span>Дата</span><input type="date" name="date" value="${e.date}" required data-change="ev-date"></label>
      <label class="field"><span>Час</span><input type="time" name="time" value="${e.time || ''}"></label>
    </div>
    <label class="field"><span>До (по желание)</span><input type="time" name="end" value="${e.end || ''}"></label>
    ${repeatFields(e)}
    <label class="field"><span>Къде (по желание)</span><input name="place" value="${esc(e.place || '')}" maxlength="140" placeholder="напр. ул. Витоша 12, София" autocomplete="off"></label>
    <div class="field"><span>Вид</span>${chips('cat', Object.entries(CATS).map(([k, c]) => [k, `<i class="dot" style="background:${c.color}"></i>${c.label}`]), e.cat || 'personal')}</div>
    <label class="field"><span>Бележка</span><textarea name="note" rows="3" placeholder="Адрес, какво да взема, идеи…" maxlength="1000">${esc(e.note || '')}</textarea></label>
    <div class="field"><span>Покани хора</span>
      <div class="guests" id="ev-guests">${guestsHtml()}</div>
      <div class="guest-add"><input name="gname" placeholder="Име" autocomplete="off" maxlength="60"><input name="gcontact" placeholder="Имейл или тел." autocomplete="off" maxlength="80"><button type="button" class="round-btn" data-act="ev-guest-add" aria-label="Добави човек">${icon('plus')}</button></div>
      ${canPickContacts() ? `<button type="button" class="link-btn left" data-act="ev-guest-pick">${icon('users')} Избери от контактите</button>` : ''}
    </div>
    <button class="btn primary wide" data-act="save-event" data-id="${e.id || ''}">${isNew ? 'Запази' : 'Запази промените'}</button>
    ${
      isNew
        ? ''
        : `<div class="btn-row">
        <button class="btn ghost" data-act="ev-phone" data-id="${e.id}" data-date="${e.date}">${icon('bell')} Напомни ми</button>
        <button class="btn ghost" data-act="ev-invite" data-id="${e.id}" data-date="${e.date}">${icon('share')} Покани</button>
      </div>
      <button class="btn ghost danger-text wide" data-act="delete-event" data-id="${e.id}">${icon('trash')} Изтрий</button>`
    }
  </form>`;
}

export function openEventEditor(e, { occ = '' } = {}) {
  evDraft = { id: e.id || '', occ, guests: (e.guests || []).map((g) => ({ ...g })), daysTouched: !!(e.repeat && e.repeat.days && e.repeat.days.length) };
  openSheet({
    title: e.id ? (E.isRecurring(e) && occ ? 'Повтарящ се ангажимент' : 'Промени') : 'Нов ангажимент',
    body: eventForm(e),
    onMount: (el) => {
      if (!e.id) setTimeout(() => el.querySelector('[name=title]').focus({ preventScroll: true }), 320);
    },
  });
}

function readRepeat(f, date) {
  if (!f.freq) return null;
  const n = Math.min(99, Math.max(1, parseInt(f.rint, 10) || 1));
  const r = { freq: f.freq, interval: n, until: '', count: 0 };
  if (f.freq === 'weekly') {
    r.days = (f.rdays || []).map(Number).sort();
    if (!r.days.length) r.days = [D.wdIndex(date)];
  }
  if (f.rend === 'until' && D.isValid(f.runtil) && f.runtil >= date) r.until = f.runtil;
  if (f.rend === 'count') r.count = Math.min(999, Math.max(1, parseInt(f.rcount, 10) || 1));
  return r;
}

// Докато не е избрала дни сама, седмичното повтаряне следва деня от датата.
function syncDays() {
  const form = sheetRoot()?.querySelector('[data-form=event]');
  if (!form || !evDraft || evDraft.daysTouched) return;
  const d = form.querySelector('[name=date]').value;
  if (!D.isValid(d)) return;
  const wd = String(D.wdIndex(d));
  form.querySelectorAll('[name=rdays]').forEach((c) => (c.checked = c.value === wd));
}

function takeTypedGuest(form) {
  const n = form.querySelector('[name=gname]');
  const c = form.querySelector('[name=gcontact]');
  const name = n.value.trim();
  const contact = c.value.trim();
  if (!name && !contact) return false;
  evDraft.guests.push({ name, email: contact.includes('@') ? contact : '', tel: contact && !contact.includes('@') ? contact : '' });
  n.value = '';
  c.value = '';
  return true;
}
function redrawGuests() {
  const box = sheetRoot()?.querySelector('#ev-guests');
  if (box) box.innerHTML = guestsHtml();
}

const shift = (list, n) => (list || []).map((d) => D.addDays(d, n));
let pending = null; // повтарящ се ангажимент чака избор „само този път / всички“

function saveAll(e, data, occ) {
  const delta = occ ? D.diffDays(occ, data.date) : 0;
  e.seq = (e.seq || 0) + 1;
  if (!data.repeat) {
    const done = occ ? (e.doneDates || []).includes(occ) : e.done;
    Object.assign(e, data, { exdates: [], doneDates: [], done: !!done });
    return e.date;
  }
  const start = occ ? D.addDays(e.date, delta) : data.date;
  // преместен ден при „всяка седмица“ — дните от седмицата се местят заедно с него
  const same = e.repeat && JSON.stringify(e.repeat.days || []) === JSON.stringify(data.repeat.days || []);
  if (data.repeat.freq === 'weekly' && same && delta % 7) data.repeat.days = [...new Set(data.repeat.days.map((d) => (((d + delta) % 7) + 7) % 7))].sort();
  Object.assign(e, data, { date: start, exdates: shift(e.exdates, delta), doneDates: shift(e.doneDates, delta) });
  e.date = E.alignStart(e);
  return occ ? data.date : e.date;
}

function finishSave(e, showDate) {
  ui.sel = showDate;
  ui.calMonth = D.monthKey(showDate);
  closeSheet(true);
  commit();
  if (state.prefs.askPhone !== false || (e.guests && e.guests.length)) setTimeout(() => openSaved(e.id, showDate), 320);
  else toast('Записано ✓');
}

// ── след запис: календарът на телефона и поканите ──
let saved = null;
const target = () => state.prefs.calTarget || (isIOS() ? 'ics' : 'google');
const TARGET_NAME = { ics: 'файл за календара', google: 'Google Календар' };

function savedBody() {
  const e = state.events.find((x) => x.id === saved.id);
  if (!e) return '<p class="empty">Ангажиментът е изтрит.</p>';
  const o = E.occurrence(e, saved.date);
  const mails = (e.guests || []).filter((g) => g.email);
  return `<div class="ev-saved">
    <div class="ev-saved-card"><b>${esc(e.title)}</b><span>${D.fmtLong(o.date)}${e.time ? `, ${e.time}${e.end ? '–' + e.end : ''}` : ''}</span>${E.isRecurring(e) ? `<span>${icon('redo')}${esc(E.repeatText(e))}</span>` : ''}${e.place ? `<span>${icon('pin')}${esc(e.place)}</span>` : ''}</div>
    <button class="btn primary wide" data-act="ev-phone" data-id="${e.id}" data-date="${o.date}">${icon('bell')} Добави в календара на телефона</button>
    <p class="muted small center">Чрез ${TARGET_NAME[target()]} · смени в Настройки</p>
    ${
      (e.guests || []).length
        ? `<div class="ev-inv"><p class="caps">Покани: ${e.guests.map((g) => esc(g.name || g.email || g.tel)).join(', ')}</p>
      <button class="btn ghost wide" data-act="ev-invite" data-id="${e.id}" data-date="${o.date}">${icon('share')} Изпрати покана</button>
      <p class="muted small">През Viber, WhatsApp, SMS или имейл — с линк, през който го добавят в календара си.</p>
      ${mails.length ? `<button class="btn ghost wide" data-act="ev-ginvite" data-id="${e.id}" data-date="${o.date}">${icon('cal')} Покана по имейл през Google</button><p class="muted small">Отваря твоя Google Календар с ${mails.length === 1 ? 'госта' : 'гостите'}. Натисни „Запази“ — Google праща покана с отговор „Да / Не“ и ангажиментът влиза и в твоя календар.</p>` : ''}</div>`
        : ''
    }
    <button class="btn ghost wide" data-act="sheet-close">Готово</button>
    <label class="switch"><input type="checkbox" ${state.prefs.askPhone !== false ? 'checked' : ''} data-change="set-askphone"><span></span>Питай ме след всеки запис</label>
  </div>`;
}
function openSaved(id, date) {
  saved = { id, date };
  openSheet({ title: 'Записано ✓', render: savedBody });
}

// Ангажиментът, както отива в календара на телефона.
export function phoneEvent(e, { forGuests = false } = {}) {
  const nn = e.cat === 'nnails';
  const notes = [e.note, nn ? `N NAILS · ${SALON.phoneDisplay}` : '', !forGuests && e.guests && e.guests.length ? `Поканени: ${e.guests.map((g) => g.name || g.email || g.tel).join(', ')}` : ''].filter(Boolean);
  return { ...e, note: notes.join('\n'), place: e.place || (nn ? SALON.address : ''), alarms: e.time ? (nn ? ['-P1D', '-PT2H'] : ['-PT30M']) : ['PT9H'] };
}

export function makeIcs({ uidv, date, time, end, title, note, location, alarms }) {
  return E.calendarBlob([{ id: uidv, date, time, end, title, note, place: location, alarms }]);
}

const findEv = (el) => state.events.find((x) => x.id === el.dataset.id);
const fileName = (e) => `${e.cat === 'nnails' ? 'N-NAILS-chas' : 'napomnyane'}-${e.date}.ics`;

export async function addToPhone(e) {
  if (target() === 'google') {
    window.open(E.googleLink(phoneEvent(e)), '_blank', 'noopener');
    return;
  }
  await deliverFile(E.calendarBlob([phoneEvent(e)]), fileName(e), { share: false });
  toast(isIOS() ? 'Отвори файла и натисни „Добави“ в календара.' : 'Отвори файла, за да влезе в календара на телефона.');
}
export const exportEventIcs = addToPhone;

async function shareInvite(e) {
  const text = E.inviteText(phoneEvent(e, { forGuests: true }), state.profile.name ? `— ${state.profile.name}` : '');
  const file = new File([E.calendarBlob([phoneEvent(e, { forGuests: true })])], `pokana-${e.date}.ics`, { type: 'text/calendar' });
  try {
    if (navigator.canShare && navigator.canShare({ files: [file], text })) return await navigator.share({ files: [file], text, title: e.title });
    if (navigator.share) return await navigator.share({ text, title: e.title });
  } catch (err) {
    if (err && err.name === 'AbortError') return;
  }
  try {
    await navigator.clipboard.writeText(text);
    toast('Текстът на поканата е копиран. Постави го в чат или имейл.');
  } catch {
    toast('Не успях да споделя поканата от този телефон.');
  }
}

function scopeSheet({ title, text, options }) {
  openSheet({
    title,
    cls: 'sheet-small',
    body: `<p class="lead">${text}</p><div class="btn-col">${options.map(([k, l, cls]) => `<button class="btn ${cls || 'ghost'} wide" data-act="ev-scope" data-s="${k}">${l}</button>`).join('')}<button class="btn ghost wide" data-act="sheet-close">Откажи</button></div>`,
  });
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
    const e = findEv(el);
    if (!e) return;
    const occ = E.isRecurring(e) && el.dataset.date ? el.dataset.date : '';
    openEventEditor({ ...e, date: occ || e.date }, { occ });
  },
  // повтаряне
  'ev-freq': (el) => {
    const root = el.closest('.rep');
    syncDays();
    root.querySelector('.rep-more').hidden = !el.value;
    root.querySelector('.rep-days').hidden = el.value !== 'weekly';
    root.querySelector('.rep-unit').textContent = unitWord(el.value, root.querySelector('[name=rint]').value);
  },
  'ev-days': () => {
    if (evDraft) evDraft.daysTouched = true;
  },
  'ev-date': () => syncDays(),
  'ev-rint': (el) => {
    const root = el.closest('.rep');
    root.querySelector('.rep-unit').textContent = unitWord(root.querySelector('[name=freq]').value, el.value);
  },
  'ev-rend': (el) => {
    const v = el.querySelector('input:checked')?.value;
    const root = el.closest('.rep-end');
    root.querySelector('[name=runtil]').hidden = v !== 'until';
    root.querySelector('.rep-count').hidden = v !== 'count';
  },
  // гости
  'ev-guest-add': () => {
    const form = sheetRoot()?.querySelector('[data-form=event]');
    if (!form || !takeTypedGuest(form)) return toast('Напиши име, имейл или телефон.');
    redrawGuests();
  },
  'ev-guest-del': (el) => {
    evDraft.guests.splice(Number(el.dataset.i), 1);
    redrawGuests();
  },
  'ev-guest-pick': async () => {
    try {
      const list = await navigator.contacts.select(['name', 'email', 'tel'], { multiple: true });
      (list || []).forEach((c) => evDraft.guests.push({ name: (c.name || [])[0] || '', email: (c.email || [])[0] || '', tel: (c.tel || [])[0] || '' }));
      redrawGuests();
    } catch {
      toast('Контактите не се отвориха.');
    }
  },
  'save-event': (el) => {
    const form = sheetRoot().querySelector('[data-form=event]');
    const f = formData(form);
    let title = f.title.trim();
    if (!title && f.cat === 'nnails') title = 'Маникюр в N NAILS';
    if (!title) {
      toast('Напиши какво е ангажиментът.');
      form.querySelector('[name=title]').focus();
      return;
    }
    if (!D.isValid(f.date)) {
      toast('Избери дата.');
      return;
    }
    takeTypedGuest(form);
    const data = {
      title,
      kind: f.kind || 'event',
      date: f.date,
      time: f.time || '',
      end: f.time && f.end ? f.end : '',
      cat: f.cat || 'personal',
      note: f.note.trim(),
      place: f.place.trim(),
      guests: evDraft.guests.map((g) => ({ ...g })),
      repeat: readRepeat(f, f.date),
    };
    const id = el.dataset.id;
    if (id) {
      const e = state.events.find((x) => x.id === id);
      if (E.isRecurring(e) && evDraft.occ) {
        pending = { kind: 'save', id, occ: evDraft.occ, data };
        scopeSheet({ title: 'Кои дни да променя?', text: `„${esc(e.title)}“ се повтаря ${esc(E.repeatText(e))}.`, options: [['one', `Само ${D.fmtShort(evDraft.occ)}`, 'primary'], ['all', 'Всички повторения']] });
        return;
      }
      finishSave(e, saveAll(e, data, ''));
    } else {
      const e = { id: uid(), done: false, exdates: [], doneDates: [], seq: 0, ...data };
      if (e.repeat) e.date = E.alignStart(e);
      state.events.push(e);
      finishSave(e, e.date);
    }
  },
  'delete-event': (el) => {
    const id = el.dataset.id;
    const e = state.events.find((x) => x.id === id);
    if (!e) return;
    if (E.isRecurring(e) && evDraft && evDraft.occ) {
      pending = { kind: 'del', id, occ: evDraft.occ };
      scopeSheet({ title: 'Какво да изтрия?', text: `„${esc(e.title)}“ се повтаря ${esc(E.repeatText(e))}.`, options: [['one', `Само ${D.fmtShort(evDraft.occ)}`, 'primary'], ['next', 'Този и следващите'], ['all', 'Всички повторения', 'danger']] });
      return;
    }
    confirmSheet({
      title: 'Да изтрия ли?',
      text: E.isRecurring(e) ? 'Ще изтрия всички повторения на ангажимента.' : 'Ангажиментът ще изчезне от планера.',
      ok: 'Изтрий',
      danger: true,
      onOk: () => {
        state.events = state.events.filter((x) => x.id !== id);
        commit();
        toast('Изтрито');
      },
    });
  },
  'ev-scope': (el) => {
    const p = pending;
    pending = null;
    const e = p && state.events.find((x) => x.id === p.id);
    if (!e) return closeSheet(true);
    const s = el.dataset.s;
    if (p.kind === 'save') {
      if (s === 'one') {
        e.exdates = [...new Set([...(e.exdates || []), p.occ])];
        e.seq = (e.seq || 0) + 1;
        const single = { id: uid(), done: (e.doneDates || []).includes(p.occ), exdates: [], doneDates: [], seq: 0, ...p.data, repeat: null };
        state.events.push(single);
        finishSave(single, single.date);
      } else finishSave(e, saveAll(e, p.data, p.occ));
      return;
    }
    // изтриване
    if (s === 'one') {
      e.exdates = [...new Set([...(e.exdates || []), p.occ])];
      e.seq = (e.seq || 0) + 1;
    } else if (s === 'next' && p.occ > e.date) {
      e.repeat = { ...e.repeat, until: D.addDays(p.occ, -1), count: 0 };
      e.seq = (e.seq || 0) + 1;
    } else state.events = state.events.filter((x) => x.id !== e.id);
    closeSheet(true);
    commit();
    toast('Изтрито');
  },
  'toggle-task': (el) => {
    const e = findEv(el);
    if (!e) return;
    if (E.isRecurring(e)) {
      const d = el.dataset.date;
      const set = new Set(e.doneDates || []);
      set.has(d) ? set.delete(d) : set.add(d);
      e.doneDates = [...set];
    } else e.done = !e.done;
    commit();
  },
  // календарът на телефона и поканите
  'ev-phone': (el) => {
    const e = findEv(el);
    if (e) addToPhone(e);
  },
  'event-ics': (el) => {
    const e = findEv(el);
    if (e) addToPhone(e);
  },
  'ev-invite': (el) => {
    const e = findEv(el);
    if (e) shareInvite(e);
  },
  'ev-ginvite': (el) => {
    const e = findEv(el);
    if (e) window.open(E.googleLink(phoneEvent(e, { forGuests: true }), { guests: e.guests || [] }), '_blank', 'noopener');
  },
  'set-askphone': (el) => {
    state.prefs.askPhone = el.checked;
    commit();
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
