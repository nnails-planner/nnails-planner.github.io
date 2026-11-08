// Сметките за цикъла: средна дължина, прогноза, овулация, плодни дни.
import * as D from './dates.js';

export function cycleModel(cycle, now = D.today()) {
  const periods = [...(cycle.periods || [])].filter((p) => D.isValid(p.start)).sort((a, b) => a.start.localeCompare(b.start));
  const set = cycle.settings || { cycleLen: 28, periodLen: 5 };

  const lens = [];
  for (let i = 1; i < periods.length; i++) {
    const L = D.diffDays(periods[i - 1].start, periods[i].start);
    if (L >= 18 && L <= 50) lens.push(L);
  }
  const recent = lens.slice(-6);
  const avgCycle = recent.length ? Math.round(recent.reduce((a, b) => a + b, 0) / recent.length) : Number(set.cycleLen) || 28;
  const plens = periods
    .filter((p) => p.end)
    .map((p) => D.diffDays(p.start, p.end) + 1)
    .filter((L) => L >= 1 && L <= 12)
    .slice(-6);
  const avgPeriod = plens.length ? Math.round(plens.reduce((a, b) => a + b, 0) / plens.length) : Number(set.periodLen) || 5;

  const m = { periods, avgCycle, avgPeriod, lens, hasData: periods.length > 0, now };
  if (!m.hasData) return m;

  const last = periods[periods.length - 1];
  m.last = last;
  m.lastEnd = last.end || D.addDays(last.start, avgPeriod - 1);
  m.ongoing = !last.end && D.diffDays(last.start, now) >= 0 && D.diffDays(last.start, now) < Math.max(avgPeriod + 3, 8);
  m.inPeriod = D.diffDays(last.start, now) >= 0 && D.diffDays(now, m.lastEnd) >= 0;
  m.cycleDay = D.diffDays(last.start, now) + 1;
  m.nextStart = D.addDays(last.start, avgCycle);
  m.daysToNext = D.diffDays(now, m.nextStart);
  m.late = m.daysToNext < 0 ? -m.daysToNext : 0;

  // Текущият цикъл: овулация ~14 дни преди следващия.
  m.ovulation = D.addDays(m.nextStart, -14);
  m.fertileStart = D.addDays(m.ovulation, -5);
  m.fertileEnd = D.addDays(m.ovulation, 1);

  // Бъдещите цикли. Ако има закъснение, прогнозата тръгва от днес.
  const base = m.late ? now : m.nextStart;
  m.future = [];
  for (let k = 0; k < 12; k++) {
    const s = D.addDays(base, avgCycle * k);
    const ov = D.addDays(s, avgCycle - 14);
    m.future.push({ start: s, end: D.addDays(s, avgPeriod - 1), ovulation: ov, fertileStart: D.addDays(ov, -5), fertileEnd: D.addDays(ov, 1) });
  }
  return m;
}

// Какво е денят: period | predicted | ovulation | fertile | ''
export function dayStatus(m, date) {
  if (!m.hasData) return '';
  for (const p of m.periods) {
    const end = p.end || D.addDays(p.start, m.avgPeriod - 1);
    if (date >= p.start && date <= end) return 'period';
  }
  if (date < m.last.start) return '';
  const inRange = (a, b) => date >= a && date <= b;
  if (!m.late) {
    if (date === m.ovulation) return 'ovulation';
    if (inRange(m.fertileStart, m.fertileEnd) && date > m.lastEnd) return 'fertile';
  }
  for (const f of m.future) {
    if (date < f.start) break;
    if (inRange(f.start, f.end) && date >= m.now) return 'predicted';
    if (date === f.ovulation) return 'ovulation';
    if (inRange(f.fertileStart, f.fertileEnd)) return 'fertile';
  }
  return '';
}

export const MOODS = [
  ['happy', '😊 Радостна'],
  ['calm', '😌 Спокойна'],
  ['love', '🥰 Влюбена'],
  ['energy', '✨ Енергична'],
  ['tired', '😴 Уморена'],
  ['sad', '🥲 Тъжна'],
  ['irritated', '😤 Раздразнителна'],
  ['anxious', '😟 Притеснена'],
];
export const SYMPTOMS = [
  ['cramps', 'Спазми'],
  ['headache', 'Главоболие'],
  ['bloating', 'Подуване'],
  ['breasts', 'Чувствителни гърди'],
  ['backache', 'Болки в кръста'],
  ['acne', 'Акне'],
  ['cravings', 'Апетит за сладко'],
  ['insomnia', 'Лош сън'],
  ['nausea', 'Гадене'],
];
export const FLOWS = [
  ['0', 'Няма'],
  ['1', 'Слабо'],
  ['2', 'Средно'],
  ['3', 'Силно'],
];
