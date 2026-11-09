// Пости по календара на Българската православна църква.
// Степените са както в постните календари, които храмовете печатат, и съвпадат
// с бележките в календара на Българската патриаршия (bg-patriarshia.bg/calendar).
// Където църковният устав е по-строг, денят носи кратка бележка „По устава…“.
// Всичко се смята само за всяка година (подвижните дни — спрямо Великден).
import { orthodoxEaster, addDays, diffDays, wdIndex, fmtShort, fmtRange, WD } from './dates.js';

// ── степените на поста ──
// Хранителни групи: какво е позволено (true) и какво не (false).
export const FOODS = [
  ['meat', 'месо'],
  ['dairy', 'млечни и яйца'],
  ['fish', 'риба'],
  ['oil', 'олио'],
  ['wine', 'вино'],
  ['plant', 'растителна храна'],
];

export const LEVELS = {
  free: {
    name: 'Блажен ден',
    short: 'няма пост',
    text: 'Няма пост — може всичко.',
    ok: ['meat', 'dairy', 'fish', 'oil', 'wine', 'plant'],
  },
  dairy: {
    name: 'Без месо',
    short: 'без месо',
    text: 'Месо не се яде. Млечните храни, яйцата и рибата са позволени.',
    ok: ['dairy', 'fish', 'oil', 'wine', 'plant'],
  },
  fish: {
    name: 'Разрешава се риба',
    short: 'с риба',
    text: 'Постна храна с олио и риба. Без месо, млечни храни и яйца.',
    ok: ['fish', 'oil', 'wine', 'plant'],
  },
  oil: {
    name: 'Постно с олио',
    short: 'с олио',
    text: 'Растителна храна, сготвена с олио. Без риба, месо, млечни храни и яйца.',
    ok: ['oil', 'wine', 'plant'],
  },
  strict: {
    name: 'Строг пост',
    short: 'без олио',
    text: 'Растителна храна без олио и без вино — хляб, зеленчуци, плодове, варива, ядки, мед.',
    ok: ['plant'],
  },
  total: {
    name: 'Пълен пост',
    short: 'пълен пост',
    text: 'Ако здравето позволява, не се яде и не се пие нищо. На по-слабите — само хляб и вода.',
    ok: [],
  },
};

// ── четирите големи пости ──
const periodCache = new Map();

function periodsOf(y) {
  const e = orthodoxEaster(y);
  return [
    { key: 'lent', name: 'Великденски пости', the: 'Великденските пости', obj: 'Великденските пости', verb: 'започват', from: addDays(e, -48), to: addDays(e, -1), rule: 'Първата седмица и Страстната седмица са най-строги. В останалите дни — постно с олио. Риба се разрешава на Благовещение и Цветница.' },
    { key: 'petrov', name: 'Петров пост', the: 'Петровият пост', obj: 'Петровия пост', verb: 'започва', from: addDays(e, 57), to: `${y}-06-28`, rule: 'Разрешава се риба във всички дни освен сряда и петък — тогава е постно с олио.' },
    { key: 'dorm', name: 'Богородичен пост', the: 'Богородичният пост', obj: 'Богородичния пост', verb: 'започва', from: `${y}-08-01`, to: `${y}-08-14`, rule: 'Постно с олио всеки ден. Риба се разрешава само на Преображение (6 август).' },
    { key: 'xmas', name: 'Коледни пости', the: 'Коледните пости', obj: 'Коледните пости', verb: 'започват', from: `${y}-11-15`, to: `${y}-12-24`, rule: 'До 20 ноември и от 20 декември — постно с олио. От Въведение (21 ноември) до 19 декември се разрешава риба, освен в сряда и петък. На Никулден риба има винаги.' },
  ]
    .filter((f) => f.from <= f.to)
    .map((f) => ({ ...f, total: diffDays(f.from, f.to) + 1 }));
}

export function periods(y) {
  if (!periodCache.has(y)) periodCache.set(y, periodsOf(y));
  return periodCache.get(y);
}
const periodsFor = (date) => periods(Number(date.slice(0, 4)));

// Постът, в който е датата: { name, day, total, … } или null.
export function fastOn(date) {
  const f = periodsFor(date).find((x) => x.from <= date && date <= x.to);
  return f ? { ...f, day: diffDays(f.from, date) + 1 } : null;
}

// Постът, който започва точно на тази дата, или null.
export function fastStarting(date) {
  return periodsFor(date).find((x) => x.from === date) || null;
}

// Заговезни — последният блажен ден преди пост. Ако се падне в сряда или петък,
// се местят ден по-рано.
function zagovezni(start) {
  let d = addDays(start, -1);
  while ([2, 4].includes(wdIndex(d))) d = addDays(d, -1);
  return d;
}

const isWedFri = (wd) => wd === 2 || wd === 4;
const isWeekend = (wd) => wd >= 5;
const WEEKLY = {
  2: 'Сряда — постен ден. Спомняме си деня, в който Юда предава Христос.',
  4: 'Петък — постен ден. Спомняме си Разпятието Христово.',
};

// ── правилото за един ден ──
// Връща { level, title, why, note, period, zag, eve }.
function rule(date) {
  const y = Number(date.slice(0, 4));
  const md = date.slice(5);
  const wd = wdIndex(date);
  const k = diffDays(orthodoxEaster(y), date); // дни от Великден
  const p = fastOn(date);
  const inPeriod = p ? `${p.name} · ${p.total === 1 ? 'само 1 ден' : `ден ${p.day} от ${p.total}`}` : '';

  // Коледни празници (Святки) — блажи се дори в сряда и петък
  if (md === '12-25') return { level: 'free', why: 'Рождество Христово. Постът свършва — трапезата е блажна.' };
  if (md >= '12-26' || md <= '01-04') return { level: 'free', why: 'Коледни празници (Святки) — до 4 януари се блажи дори в сряда и петък.' };
  if (md === '01-05')
    return isWeekend(wd)
      ? { level: 'oil', why: 'Навечерие на Богоявление (Водици) — еднодневен пост. В събота и неделя се облекчава с олио.' }
      : { level: 'strict', why: 'Навечерие на Богоявление (Водици) — еднодневен строг пост.' };
  if (md === '01-06') return { level: 'free', why: 'Богоявление (Йордановден) — не се пости.' };

  // седмицата след Неделя на митаря и фарисея
  if (k >= -69 && k <= -64) return { level: 'free', why: 'Седмицата след Неделя на митаря и фарисея — блажи се дори в сряда и петък.' };
  if (k === -56) return { level: 'free', zag: 'Месни заговезни', why: 'Месни заговезни — последният ден, в който се яде месо, до Великден.' };
  if (k >= -55 && k <= -50) return { level: 'dairy', why: 'Сирна седмица — месо вече не се яде, но се блажи с млечни храни, яйца и риба.' };
  if (k === -49) return { level: 'dairy', zag: 'Сирни заговезни (Прошка)', why: 'Сирни заговезни — последният ден с млечни храни. Вечерта се иска прошка от близките.' };

  // Великденски пости
  if (k >= -48 && k <= -1) {
    if (md === '03-25') return { level: 'fish', period: inPeriod, why: 'Благовещение — светъл празник посред поста. Разрешава се риба.' };
    if (k === -8) return { level: 'oil', period: inPeriod, why: 'Лазарова събота (Лазаровден).', note: 'По устава днес е позволен и рибен хайвер.' };
    if (k === -7) return { level: 'fish', period: inPeriod, why: 'Цветница — Входът Господен в Йерусалим. Разрешава се риба.' };
    if (k >= -6 && k <= -4) return { level: 'strict', period: inPeriod, why: `Страстна седмица — Велики ${['понеделник', 'вторник', 'сряда'][k + 6]}. Най-строгите дни в годината.` };
    if (k === -3) return { level: 'oil', period: inPeriod, why: 'Велики четвъртък — Тайната вечеря. Боядисват се яйцата.' };
    if (k === -2) return { level: 'total', period: inPeriod, why: 'Разпети петък — денят на Разпятието. Най-строгият ден от годината.' };
    if (k === -1) return { level: 'oil', period: inPeriod, why: 'Велика събота — последният ден от поста. В полунощ — Възкресение!', note: 'По устава днес е без олио.' };
    if (k <= -44)
      return {
        level: 'strict',
        period: inPeriod,
        why: k === -48 ? 'Чист понеделник — начало на Великденските пости. Първата седмица е най-строга.' : 'Чиста седмица — първата седмица на поста е най-строга.',
        note: k <= -46 ? 'Някои по традиция не ядат нищо в първите три дни (тримерене) — само с благословия от свещеник.' : '',
      };
    const SUN = { '-42': 'Неделя Православна — Тържество на православието.', '-35': 'Неделя на св. Григорий Палама.', '-28': 'Кръстопоклонна неделя — средата на поста.', '-21': 'Неделя на св. Йоан Лествичник.', '-14': 'Неделя на св. Мария Египетска.' };
    const why = k === -43 ? 'Тодорова събота.' : SUN[k] || (isWedFri(wd) ? WEEKLY[wd] : 'Великденски пости — време за молитва, тишина и добрини.');
    return { level: 'oil', period: inPeriod, why, note: isWedFri(wd) ? 'По устава в сряда и петък през поста е без олио.' : '' };
  }

  // от Великден до Петдесетница
  if (k === 0) return { level: 'free', why: 'Великден — Христос воскресе! Постът свърши.' };
  if (k >= 1 && k <= 6) return { level: 'free', why: 'Светла седмица — блажи се дори в сряда и петък.' };
  if (k === 49) return { level: 'free', why: 'Петдесетница — не се пости.' };
  if (k >= 50 && k <= 55) return { level: 'free', why: 'Седмицата след Петдесетница — блажи се дори в сряда и петък.' };

  // Петров пост
  if (p && p.key === 'petrov') return isWedFri(wd) ? { level: 'oil', period: inPeriod, why: WEEKLY[wd] } : { level: 'fish', period: inPeriod, why: 'Петров пост — до Петровден.' };
  if (k === 56) {
    const petrov = periodsFor(date).some((x) => x.key === 'petrov');
    return { level: 'free', zag: petrov ? 'Петрови заговезни' : '', why: petrov ? 'Неделя на всички светии (Петрови заговезни). От утре — Петров пост.' : 'Неделя на всички светии.' };
  }

  // Богородичен пост
  if (p && p.key === 'dorm')
    return md === '08-06' ? { level: 'fish', period: inPeriod, why: 'Преображение Господне. Разрешава се риба.' } : { level: 'oil', period: inPeriod, why: 'Богородичен пост — до Голяма Богородица.' };

  // еднодневни пости
  if (md === '08-29')
    return isWeekend(wd)
      ? { level: 'oil', why: 'Отсичане главата на св. Йоан Кръстител — еднодневен пост. В събота и неделя се облекчава с олио.' }
      : { level: 'strict', why: 'Отсичане главата на св. Йоан Кръстител — еднодневен строг пост.' };
  if (md === '09-14')
    return isWeekend(wd)
      ? { level: 'oil', why: 'Кръстовден (Въздвижение на Светия Кръст) — еднодневен пост. В събота и неделя се облекчава с олио.' }
      : { level: 'strict', why: 'Кръстовден (Въздвижение на Светия Кръст) — еднодневен строг пост.' };

  // Коледни пости
  if (p && p.key === 'xmas') {
    if (md === '11-21') return { level: 'fish', period: inPeriod, why: 'Въведение Богородично — Ден на християнското семейство. Разрешава се риба.' };
    if (md === '12-06') return { level: 'fish', period: inPeriod, why: 'Никулден — по традиция на трапезата има риба.' };
    if (md === '12-24') return { level: 'oil', period: inPeriod, why: 'Бъдни вечер — постна трапеза с нечетен брой ястия, питка с паричка и много обич.' };
    if (md >= '11-22' && md <= '12-19') {
      if (isWedFri(wd)) return { level: 'oil', period: inPeriod, why: WEEKLY[wd] };
      return { level: 'fish', period: inPeriod, why: 'Коледни пости.', note: 'По устава в тези дни риба се яде само на Въведение и Никулден, а в останалите — миди, калмари и други морски дарове.' };
    }
    return { level: 'oil', period: inPeriod, why: md >= '12-20' ? 'Коледни пости — последните дни преди Рождество.' : 'Коледни пости — първите дни.' };
  }

  // сряда и петък през годината
  if (isWedFri(wd)) return { level: 'fish', why: WEEKLY[wd], weekly: true };
  return { level: 'free' };
}

// Пълната информация за деня (с кеш, защото мрежата я пита за много дни).
const dayCache = new Map();
export function fastDay(date) {
  if (dayCache.has(date)) return dayCache.get(date);
  const r = rule(date);
  const y = Number(date.slice(0, 4));
  const tomorrow = fastStarting(addDays(date, 1));
  const zagFor = periods(y).find((x) => (x.key === 'dorm' || x.key === 'xmas') && zagovezni(x.from) === date);
  if (!r.zag && zagFor && r.level === 'free') {
    r.zag = zagFor.key === 'xmas' ? 'Коледни заговезни' : 'Богородични заговезни';
    r.why = `${r.zag} — последният блажен ден преди ${zagFor.obj}.`;
  }
  const out = { date, ...LEVELS[r.level], level: r.level, why: r.why || '', note: r.note || '', period: r.period || '', eve: tomorrow ? `Утре ${tomorrow.verb} ${tomorrow.the}.` : '', zag: r.zag || '', weekly: !!r.weekly };
  if (dayCache.size > 900) dayCache.clear();
  dayCache.set(date, out);
  return out;
}

// ── обзор на годината ──
export function yearOverview(y) {
  const e = orthodoxEaster(y);
  const wdName = (d) => WD[wdIndex(d)];
  const one = [
    { date: `${y}-01-05`, name: 'Навечерие на Богоявление (Водици)' },
    { date: addDays(e, -2), name: 'Разпети петък' },
    { date: `${y}-08-29`, name: 'Отсичане главата на св. Йоан Кръстител' },
    { date: `${y}-09-14`, name: 'Кръстовден' },
  ].map((x) => ({ ...x, label: `${fmtShort(x.date)}, ${wdName(x.date)}`, lv: fastDay(x.date) }));
  const free = [
    { from: `${y}-01-01`, to: `${y}-01-04`, name: 'Коледни празници' },
    { from: addDays(e, -69), to: addDays(e, -64), name: 'След Неделя на митаря и фарисея' },
    { from: addDays(e, -55), to: addDays(e, -50), name: 'Сирна седмица — без месо' },
    { from: addDays(e, 1), to: addDays(e, 6), name: 'Светла седмица' },
    { from: addDays(e, 50), to: addDays(e, 55), name: 'След Петдесетница' },
    { from: `${y}-12-25`, to: `${y}-12-31`, name: 'Коледни празници' },
  ].map((x) => ({ ...x, label: fmtRange(x.from, x.to) }));
  const zag = [
    { date: addDays(e, -56), name: 'Месни заговезни' },
    { date: addDays(e, -49), name: 'Сирни заговезни (Прошка)' },
    ...(periods(y).some((x) => x.key === 'petrov') ? [{ date: addDays(e, 56), name: 'Петрови заговезни' }] : []),
    { date: zagovezni(`${y}-08-01`), name: 'Богородични заговезни' },
    { date: zagovezni(`${y}-11-15`), name: 'Коледни заговезни' },
  ].map((x) => ({ ...x, label: `${fmtShort(x.date)}, ${wdName(x.date)}` }));
  const big = periods(y).map((p) => ({ ...p, label: fmtRange(p.from, p.to) }));
  return { big, one, free, zag, easter: e };
}

