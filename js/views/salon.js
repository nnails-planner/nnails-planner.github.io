// N NAILS: следващият час, напомняне за маникюр, контакти и нашите проекти.
import * as D from '../dates.js';
import { state, esc, commit, registerActions, toast, isIOS } from '../ui.js';
import { icon } from '../icons.js';
import { SALON, PROJECTS } from '../config.js';
import { openEventEditor, makeIcs } from './calendar.js';
import { deliverFile } from '../ui.js';

const bookHref = () => SALON.bookingUrl || `tel:${SALON.phone}`;
const bookAttrs = () => (SALON.bookingUrl ? 'target="_blank" rel="noopener"' : '');

export function salonStatus() {
  const t = D.today();
  const nn = state.events.filter((e) => e.cat === 'nnails');
  const next = nn.filter((e) => e.date >= t).sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time))[0] || null;
  const pastVisit = nn.filter((e) => e.date <= t).map((e) => e.date).sort().pop() || '';
  const last = [state.salon.lastVisit || '', pastVisit].sort().pop();
  const weeks = Number(state.salon.intervalWeeks) || 4;
  const due = last ? D.addDays(last, weeks * 7) : '';
  return { next, last, due, dueIn: due ? D.diffDays(t, due) : null, weeks: last ? Math.max(1, Math.round(D.diffDays(last, t) / 7)) : 0, interval: weeks };
}

function social(links) {
  return `<div class="socials">${links
    .map((l) => `<a class="soc" href="${l.url}" target="_blank" rel="noopener" aria-label="${esc(l.label)}">${icon(l.k)}<span>${esc(l.label)}</span></a>`)
    .join('')}</div>`;
}

function nextCard(s) {
  if (s.next) {
    const e = s.next;
    return `<section class="card next-appt">
      <p class="caps">Следващият ти час</p>
      <h2>${D.fmtLong(e.date)}${e.time ? `, ${e.time}` : ''}</h2>
      <p class="muted">${esc(e.title)} · ${D.relDays(D.diffDays(D.today(), e.date))}</p>
      <div class="btn-row"><button class="btn ghost" data-act="edit-event" data-id="${e.id}">${icon('edit')} Промени</button><button class="btn ghost" data-act="event-ics" data-id="${e.id}">${icon('bell')} Напомняне</button></div>
    </section>`;
  }
  return `<section class="card next-appt">
    <p class="caps">Твоят час в N NAILS</p>
    <h2>Нямаш записан час</h2>
    <p class="muted">Запиши си час и го добави тук. Ще го виждаш в календара заедно с всичко останало.</p>
    <div class="btn-col"><a class="btn gold wide" href="${bookHref()}" ${bookAttrs()}>${icon('phone')} Запиши час</a>
    <button class="btn ghost wide" data-act="new-event" data-cat="nnails" data-date="${D.today()}">${icon('plus')} Вече имам час — добави го</button></div>
  </section>`;
}

function reminderCard(s) {
  let status;
  if (!s.last) status = `<p class="muted">Кога беше последният ти маникюр? Ще ти покажа кога е време за следващия.</p>`;
  else if (s.dueIn <= 0) status = `<p class="due-now">${icon('sparkle')} Време е за нов маникюр. Последният беше ${D.relDays(D.diffDays(D.today(), s.last))}.</p>`;
  else status = `<p class="muted">Последен маникюр: <b>${D.fmtShort(s.last)}</b>. Следващият е около <b>${D.fmtShort(s.due)}</b> (${D.relDays(s.dueIn)}).</p>`;
  return `<section class="card">
    <h3>${icon('bell')} Напомняне за маникюр</h3>
    ${status}
    <div class="field"><span>Идвам на всеки … седмици</span><div class="chips chips-seg">${[2, 3, 4, 5, 6]
      .map((w) => `<button class="chip-btn ${s.interval === w ? 'on' : ''}" data-act="salon-interval" data-w="${w}" aria-label="${w} седмици">${w}</button>`)
      .join('')}</div></div>
    <div class="row2 end">
      <label class="field"><span>Последен маникюр</span><input type="date" name="last-visit" max="${D.today()}" value="${s.last || ''}" data-change="salon-last"></label>
      <button class="btn ghost" data-act="salon-today">${icon('check')} Днес бях</button>
    </div>
    ${s.due ? `<button class="btn ghost wide" data-act="salon-due-ics">${icon('cal')} Напомни ми в календара на телефона</button>` : ''}
  </section>`;
}

export function render() {
  const s = salonStatus();
  return `<div class="page salon">
    <figure class="salon-hero">
      <img src="img/salon.webp" alt="Салонът N NAILS" width="820" height="1172">
      <figcaption><h1>Твоят салон</h1><span class="caps">N NAILS · Студентски град · София</span></figcaption>
    </figure>
    <div class="btn-row three">
      <a class="btn gold" href="${bookHref()}" ${bookAttrs()}>${icon('cal')} Запиши час</a>
      <a class="btn ghost" href="tel:${SALON.phone}">${icon('phone')} Обади се</a>
      <a class="btn ghost" href="${SALON.mapsUrl}" target="_blank" rel="noopener">${icon('pin')} Как стигам</a>
    </div>
    ${nextCard(s)}
    ${reminderCard(s)}
    <section class="card">
      <h3>N NAILS</h3>
      <p class="muted">${esc(SALON.address)}<br>Телефон: <a href="tel:${SALON.phone}">${SALON.phoneDisplay}</a></p>
      ${social(SALON.social)}
    </section>
    <h2 class="section-title">Нашите проекти</h2>
    ${PROJECTS.map(
      (p) => `<section class="card project">
        <div class="project-head"><img src="${p.logo}" alt="${esc(p.name)}" class="project-logo ${p.id}"><h3>${esc(p.name)}</h3></div>
        <p>${esc(p.text)}</p>
        ${social(p.links)}
      </section>`
    ).join('')}
    <p class="signature">С любов от екипа на N NAILS 🤍</p>
  </div>`;
}

registerActions({
  'salon-interval': (el) => {
    state.salon.intervalWeeks = Number(el.dataset.w);
    commit();
  },
  'salon-today': () => {
    state.salon.lastVisit = D.today();
    commit();
    toast('Записах го ✓ Изглеждаш прекрасно 💅');
  },
  'salon-last': (el) => {
    if (!D.isValid(el.value) || el.value > D.today()) return;
    state.salon.lastVisit = el.value;
    commit();
    toast('Записано ✓');
  },
  'salon-due-ics': async () => {
    const s = salonStatus();
    const date = s.dueIn > 0 ? s.due : D.addDays(D.today(), 1);
    await deliverFile(
      makeIcs({ uidv: 'nnails-due-' + date, date, time: '10:00', end: '10:15', title: 'Време е за маникюр в N NAILS 💅', note: `Обади се на ${SALON.phoneDisplay}${SALON.bookingUrl ? ' или запиши час на ' + SALON.bookingUrl : ''}`, location: SALON.address, alarms: ['PT0M'] }),
      `N-NAILS-napomnyane-${date}.ics`,
      { share: false }
    );
    toast(isIOS() ? 'Отвори файла и натисни „Добави“ в календара.' : 'Отвори файла, за да влезе в календара.');
  },
});
