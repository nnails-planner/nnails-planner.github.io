// Дати като текст „ГГГГ-ММ-ДД“ в местно време — без изненади с часовите зони.

export const MONTHS = ['януари', 'февруари', 'март', 'април', 'май', 'юни', 'юли', 'август', 'септември', 'октомври', 'ноември', 'декември'];
export const MONTHS_SHORT = ['яну', 'фев', 'мар', 'апр', 'май', 'юни', 'юли', 'авг', 'сеп', 'окт', 'ное', 'дек'];
export const WD = ['понеделник', 'вторник', 'сряда', 'четвъртък', 'петък', 'събота', 'неделя'];
export const WD_SHORT = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Нд'];

export const pad = (n) => String(n).padStart(2, '0');
export const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

export function iso(d) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
export function parse(s) {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d || 1);
}
export const today = () => iso(new Date());
export const isValid = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s);

export function addDays(s, n) {
  const d = parse(s);
  d.setDate(d.getDate() + n);
  return iso(d);
}
// Колко дни има от a до b (b − a).
export function diffDays(a, b) {
  const [y1, m1, d1] = a.split('-').map(Number);
  const [y2, m2, d2] = b.split('-').map(Number);
  return Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / 86400000);
}
export const wdIndex = (s) => (parse(s).getDay() + 6) % 7; // 0 = понеделник
export const startOfWeek = (s) => addDays(s, -wdIndex(s));
export const monthKey = (s) => s.slice(0, 7);
export function addMonths(key, n) {
  const [y, m] = key.split('-').map(Number);
  const d = new Date(y, m - 1 + n, 1);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
}
export function monthTitle(key) {
  const [y, m] = key.split('-').map(Number);
  return `${cap(MONTHS[m - 1])} ${y}`;
}
// Дните за месечната мрежа, от понеделник.
export function monthGrid(key) {
  const [y, m] = key.split('-').map(Number);
  const first = `${key}-01`;
  const offset = wdIndex(first);
  const days = new Date(y, m, 0).getDate();
  const rows = Math.ceil((offset + days) / 7);
  const start = addDays(first, -offset);
  return Array.from({ length: rows * 7 }, (_, i) => addDays(start, i));
}

export const dayNum = (s) => Number(s.slice(8, 10));
export const monthIdx = (s) => Number(s.slice(5, 7)) - 1;
export const yearOf = (s) => Number(s.slice(0, 4));

export function fmtShort(s) {
  return `${dayNum(s)} ${MONTHS[monthIdx(s)]}`;
}
export function fmtLong(s) {
  return `${cap(WD[wdIndex(s)])}, ${dayNum(s)} ${MONTHS[monthIdx(s)]}`;
}
export function fmtFull(s) {
  return `${dayNum(s)} ${MONTHS[monthIdx(s)]} ${yearOf(s)}`;
}
export function fmtRange(a, b) {
  if (a === b) return fmtShort(a);
  if (monthIdx(a) === monthIdx(b)) return `${dayNum(a)} – ${dayNum(b)} ${MONTHS[monthIdx(b)]}`;
  return `${fmtShort(a)} – ${fmtShort(b)}`;
}
// „днес“, „утре“, „след 5 дни“, „преди 3 дни“
export function relDays(n) {
  if (n === 0) return 'днес';
  if (n === 1) return 'утре';
  if (n === -1) return 'вчера';
  if (n > 0) return `след ${n} ${n === 1 ? 'ден' : 'дни'}`;
  const k = -n;
  return `преди ${k} ${k === 1 ? 'ден' : 'дни'}`;
}
export const quarterOf = (s) => Math.floor(monthIdx(s) / 3) + 1;

// Православен Великден (за 1900–2099).
export function orthodoxEaster(y) {
  const a = y % 4, b = y % 7, c = y % 19;
  const d = (19 * c + 15) % 30;
  const e = (2 * a + 4 * b - d + 34) % 7;
  const month = Math.floor((d + e + 114) / 31);
  const day = ((d + e + 114) % 31) + 1;
  const jul = new Date(y, month - 1, day);
  jul.setDate(jul.getDate() + 13);
  return iso(jul);
}
