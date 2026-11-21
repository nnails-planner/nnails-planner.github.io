// Ангажименти: повтаряне, файл за календара на телефона (.ics),
// връзка към Google Календар и текст на покана. Без сървър — всичко е на телефона.
import * as D from './dates.js';

export const FREQS = [
  ['', 'Не се повтаря'],
  ['daily', 'Всеки ден'],
  ['weekly', 'Всяка седмица'],
  ['monthly', 'Всеки месец'],
  ['yearly', 'Всяка година'],
];
export const UNIT = { daily: ['ден', 'дни'], weekly: ['седмица', 'седмици'], monthly: ['месец', 'месеца'], yearly: ['година', 'години'] };
const BYDAY = ['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU'];
const FEM = [false, false, true, false, false, true, true]; // сряда, събота, неделя — женски род

export const isRecurring = (e) => !!(e && e.repeat && e.repeat.freq);
const Y = (s) => Number(s.slice(0, 4));
const M = (s) => Number(s.slice(5, 7));
const interval = (r) => Math.max(1, Number(r.interval) || 1);
export const weekDays = (e) => (e.repeat.days && e.repeat.days.length ? [...e.repeat.days].sort() : [D.wdIndex(e.date)]);

// Пада ли се правилото на тази дата (без край и изключения).
function matches(e, date) {
  const r = e.repeat;
  const n = interval(r);
  switch (r.freq) {
    case 'daily':
      return D.diffDays(e.date, date) % n === 0;
    case 'weekly':
      if (!weekDays(e).includes(D.wdIndex(date))) return false;
      return (D.diffDays(D.startOfWeek(e.date), D.startOfWeek(date)) / 7) % n === 0;
    case 'monthly':
      return D.dayNum(date) === D.dayNum(e.date) && ((Y(date) - Y(e.date)) * 12 + M(date) - M(e.date)) % n === 0;
    case 'yearly':
      return date.slice(5) === e.date.slice(5) && (Y(date) - Y(e.date)) % n === 0;
  }
  return false;
}

// Последната дата при „след N пъти“ (както я брои и календарът на телефона).
const countCache = new Map();
function countEnd(e) {
  const key = `${e.date}|${JSON.stringify(e.repeat)}`;
  if (countCache.has(key)) return countCache.get(key);
  let left = Number(e.repeat.count);
  let d = e.date;
  let last = e.date;
  for (let i = 0; i < 366 * 40 && left > 0; i++, d = D.addDays(d, 1)) {
    if (matches(e, d)) {
      last = d;
      left--;
    }
  }
  if (countCache.size > 300) countCache.clear();
  countCache.set(key, last);
  return last;
}

export function endDate(e) {
  if (!isRecurring(e)) return e.date;
  if (e.repeat.count) return countEnd(e);
  return e.repeat.until || '';
}

export function occursOn(e, date) {
  if (!isRecurring(e)) return e.date === date;
  if (date < e.date) return false;
  const end = endDate(e);
  if (end && date > end) return false;
  if ((e.exdates || []).includes(date)) return false;
  return matches(e, date);
}

// Повторението като отделен ангажимент за деня.
export function occurrence(e, date) {
  if (!isRecurring(e)) return e;
  return { ...e, date, occ: date, done: (e.doneDates || []).includes(date) };
}

export function nextDate(e, from, days = 800) {
  if (!isRecurring(e)) return e.date >= from ? e.date : '';
  let d = e.date > from ? e.date : from;
  for (let i = 0; i < days; i++, d = D.addDays(d, 1)) if (occursOn(e, d)) return d;
  return '';
}
export function prevDate(e, to, days = 800) {
  if (!isRecurring(e)) return e.date <= to ? e.date : '';
  let d = to;
  for (let i = 0; i < days && d >= e.date; i++, d = D.addDays(d, -1)) if (occursOn(e, d)) return d;
  return '';
}

// Седмичното правило започва в ден, който е в правилото.
export function alignStart(e) {
  if (!isRecurring(e) || e.repeat.freq !== 'weekly') return e.date;
  let d = e.date;
  for (let i = 0; i < 7; i++, d = D.addDays(d, 1)) if (weekDays(e).includes(D.wdIndex(d))) return d;
  return e.date;
}

// ── с думи ──
const wdIn = (i) => D.WD[i];
const prep = (w) => (/^[вф]/i.test(w) ? 'във' : 'в');
// 1-во, 2-ро, 7-мо, 15-то (число)
const ord = (n) => {
  const t = n % 100;
  const u = n % 10;
  return `${n}-${u === 1 && t !== 11 ? 'во' : u === 2 && t !== 12 ? 'ро' : (u === 7 || u === 8) && t !== 17 && t !== 18 ? 'мо' : 'то'}`;
};
const joinBg = (arr) => (arr.length < 2 ? arr.join('') : `${arr.slice(0, -1).join(', ')} и ${arr[arr.length - 1]}`);

export function repeatText(e) {
  if (!isRecurring(e)) return '';
  const r = e.repeat;
  const n = interval(r);
  let t = '';
  if (r.freq === 'daily') t = n === 1 ? 'всеки ден' : `на всеки ${n} дни`;
  if (r.freq === 'weekly') {
    const days = weekDays(e);
    if (days.length === 7 && n === 1) t = 'всеки ден';
    else if (days.length === 1 && n === 1) t = `${FEM[days[0]] ? 'всяка' : 'всеки'} ${wdIn(days[0])}`;
    else {
      const names = days.map(wdIn);
      t = `${n === 1 ? 'всяка седмица' : `на всеки ${n} седмици`} ${prep(names[0])} ${joinBg(names)}`;
    }
  }
  if (r.freq === 'monthly') t = `${n === 1 ? 'всеки месец' : `на всеки ${n} месеца`} на ${ord(D.dayNum(e.date))} число`;
  if (r.freq === 'yearly') t = `${n === 1 ? 'всяка година' : `на всеки ${n} години`} на ${D.fmtShort(e.date)}`;
  if (r.count) t += `, ${r.count} ${Number(r.count) === 1 ? 'път' : 'пъти'}`;
  else if (r.until) t += ` до ${D.fmtFull(r.until)}`;
  return t;
}

// ── файл за календара (.ics) ──
const esc = (s) => String(s || '').replace(/\\/g, '\\\\').replace(/\r?\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;');
const enc = new TextEncoder();
// Редовете над 75 байта се пренасят, както изисква форматът.
function fold(line) {
  if (enc.encode(line).length <= 74) return line;
  const out = [];
  let cur = '';
  for (const ch of line) {
    if (enc.encode(cur + ch).length > (out.length ? 73 : 74)) {
      out.push(cur);
      cur = '';
    }
    cur += ch;
  }
  out.push(cur);
  return out.join('\r\n ');
}

const ymd = (s) => s.replace(/-/g, '');
const hm = (t) => t.replace(':', '') + '00';
function endOf(date, time, end) {
  if (end && end > time) return `${ymd(date)}T${hm(end)}`;
  const [h, mi] = time.split(':').map(Number);
  const t2 = new Date(2000, 0, 1, h + 1, mi);
  return t2.getDate() === 1 ? `${ymd(date)}T${D.pad(t2.getHours())}${D.pad(t2.getMinutes())}00` : `${ymd(date)}T235900`;
}

export function rrule(e) {
  const r = e.repeat;
  const p = [`FREQ=${r.freq.toUpperCase()}`];
  if (interval(r) > 1) p.push(`INTERVAL=${interval(r)}`);
  if (r.freq === 'weekly') p.push(`BYDAY=${weekDays(e).map((i) => BYDAY[i]).join(',')}`);
  if (r.count) p.push(`COUNT=${r.count}`);
  else if (r.until) p.push(`UNTIL=${ymd(r.until)}${e.time ? 'T235959' : ''}`);
  return `RRULE:${p.join(';')}`;
}

// e: { id, date, time, end, title, note, place, repeat, exdates, alarms, seq }
export function vevent(e) {
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');
  const L = ['BEGIN:VEVENT', `UID:${e.id}@nnails-planner`, `DTSTAMP:${stamp}`, `SEQUENCE:${e.seq || 0}`];
  if (e.time) L.push(`DTSTART:${ymd(e.date)}T${hm(e.time)}`, `DTEND:${endOf(e.date, e.time, e.end)}`);
  else L.push(`DTSTART;VALUE=DATE:${ymd(e.date)}`, `DTEND;VALUE=DATE:${ymd(D.addDays(e.date, 1))}`);
  if (isRecurring(e)) {
    L.push(rrule(e));
    const ex = (e.exdates || []).filter((d) => d > e.date).sort();
    if (ex.length) L.push(e.time ? `EXDATE:${ex.map((d) => `${ymd(d)}T${hm(e.time)}`).join(',')}` : `EXDATE;VALUE=DATE:${ex.map(ymd).join(',')}`);
  }
  L.push(`SUMMARY:${esc(e.title)}`);
  if (e.note) L.push(`DESCRIPTION:${esc(e.note)}`);
  if (e.place) L.push(`LOCATION:${esc(e.place)}`);
  for (const a of e.alarms || []) L.push('BEGIN:VALARM', `TRIGGER:${a}`, 'ACTION:DISPLAY', `DESCRIPTION:${esc(e.title)}`, 'END:VALARM');
  L.push('END:VEVENT');
  return L;
}

export function calendarBlob(events) {
  const L = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//N NAILS//Planner//BG', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', ...events.flatMap(vevent), 'END:VCALENDAR'];
  return new Blob([L.map(fold).join('\r\n') + '\r\n'], { type: 'text/calendar;charset=utf-8' });
}

// ── Google Календар: отваря готово събитие, остава само „Запази“ ──
export function googleLink(e, { guests = [] } = {}) {
  const p = new URLSearchParams();
  p.set('action', 'TEMPLATE');
  p.set('text', e.title);
  if (e.time) {
    p.set('dates', `${ymd(e.date)}T${hm(e.time)}/${endOf(e.date, e.time, e.end)}`);
    p.set('ctz', 'Europe/Sofia');
  } else p.set('dates', `${ymd(e.date)}/${ymd(D.addDays(e.date, 1))}`);
  if (e.note) p.set('details', e.note);
  if (e.place) p.set('location', e.place);
  if (isRecurring(e)) p.set('recur', rrule(e));
  const mails = guests.map((g) => g.email).filter(Boolean);
  if (mails.length) p.set('add', mails.join(','));
  return `https://calendar.google.com/calendar/render?${p.toString()}`;
}

// ── текст на поканата ──
export function inviteText(e, from = '') {
  const when = `${D.fmtLong(e.date)}${e.time ? `, ${e.time}${e.end ? '–' + e.end : ''} ч.` : ''}`;
  const rep = repeatText(e);
  const L = [`Покана: ${e.title}`, `📅 ${when}`];
  if (rep) L.push(`🔁 ${rep.charAt(0).toUpperCase() + rep.slice(1)}`);
  if (e.place) L.push(`📍 ${e.place}`);
  if (e.note) L.push('', e.note);
  L.push('', `Добави го в Google Календар: ${googleLink(e)}`);
  if (from) L.push('', from);
  return L.join('\n');
}
