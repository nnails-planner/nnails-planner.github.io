// Моята кухня — логиката без екрани: мерни единици, разпознаване на рецепта от
// текст, порции, общ списък за покупки и проверка спрямо поста.
// Всичко остава на телефона. Нищо не се праща никъде.
import { monthIdx } from './dates.js';

export const SEASONS = [
  ['spring', 'Пролет'],
  ['summer', 'Лято'],
  ['autumn', 'Есен'],
  ['winter', 'Зима'],
];
export const CATS = [
  ['breakfast', 'Закуски'],
  ['soup', 'Супи'],
  ['main', 'Основни'],
  ['salad', 'Салати'],
  ['snack', 'Следобедни закуски'],
  ['dessert', 'Десерти'],
];
export const MEALS = [
  ['breakfast', 'Закуска'],
  ['lunch', 'Обяд'],
  ['snack', 'Следобедна закуска'],
  ['dinner', 'Вечеря'],
];
export const CONTAINS = [
  ['meat', 'месо'],
  ['fish', 'риба'],
  ['eggs', 'яйца'],
  ['dairy', 'млечни'],
  ['oil', 'олио'],
];
export const label = (list, k) => (list.find(([x]) => x === k) || [k, k])[1];

export function seasonOf(date) {
  const m = monthIdx(date);
  if (m >= 2 && m <= 4) return 'spring';
  if (m >= 5 && m <= 7) return 'summer';
  if (m >= 8 && m <= 10) return 'autumn';
  return 'winter';
}

// ── мерни единици ──
// family: кои мерки могат да се събират. Само г/кг и мл/л се превръщат една в друга.
const UNITS = [
  { key: 'kg', one: 'кг', many: 'кг', family: 'mass', f: 1000, al: ['кг', 'килограм', 'килограма', 'килограми'] },
  { key: 'g', one: 'г', many: 'г', family: 'mass', f: 1, al: ['г', 'гр', 'гр.', 'грам', 'грама'] },
  { key: 'l', one: 'л', many: 'л', family: 'vol', f: 1000, al: ['л', 'литър', 'литра', 'литри'] },
  { key: 'ml', one: 'мл', many: 'мл', family: 'vol', f: 1, al: ['мл', 'милилитър', 'милилитра'] },
  { key: 'tbsp', one: 'с.л.', many: 'с.л.', family: 'tbsp', f: 1, al: ['с.л.', 'с. л.', 'с.л', 'сл.', 'супена лъжица', 'супени лъжици'] },
  { key: 'tsp', one: 'ч.л.', many: 'ч.л.', family: 'tsp', f: 1, al: ['ч.л.', 'ч. л.', 'ч.л', 'чл.', 'чаена лъжичка', 'чаени лъжички', 'чаена лъжица', 'чаени лъжици'] },
  { key: 'csp', one: 'к.л.', many: 'к.л.', family: 'csp', f: 1, al: ['к.л.', 'к. л.', 'к.л', 'кафена лъжичка', 'кафени лъжички'] },
  { key: 'cup', one: 'ч.ч.', many: 'ч.ч.', family: 'cup', f: 1, al: ['ч.ч.', 'ч. ч.', 'ч.ч', 'чаена чаша', 'чаени чаши', 'чаша', 'чаши'] },
  { key: 'pc', one: 'бр.', many: 'бр.', family: 'count', f: 1, al: ['бр.', 'бр', 'брой', 'броя', 'бройки'] },
  { key: 'pinch', one: 'щипка', many: 'щипки', family: 'pinch', f: 1, al: ['щипка', 'щипки'] },
  { key: 'clove', one: 'скилидка', many: 'скилидки', family: 'clove', f: 1, al: ['скилидка', 'скилидки'] },
  { key: 'bunch', one: 'връзка', many: 'връзки', family: 'bunch', f: 1, al: ['връзка', 'връзки'] },
  { key: 'sprig', one: 'стрък', many: 'стръка', family: 'sprig', f: 1, al: ['стрък', 'стръка', 'стръкове'] },
  { key: 'pack', one: 'пакет', many: 'пакета', family: 'pack', f: 1, al: ['пакет', 'пакета', 'пакетче', 'пакетчета'] },
  { key: 'can', one: 'консерва', many: 'консерви', family: 'can', f: 1, al: ['консерва', 'консерви', 'кутия', 'кутии'] },
  { key: 'jar', one: 'буркан', many: 'буркана', family: 'jar', f: 1, al: ['буркан', 'буркана'] },
  { key: 'head', one: 'глава', many: 'глави', family: 'head', f: 1, al: ['глава', 'глави'] },
  { key: 'slice', one: 'филия', many: 'филии', family: 'slice', f: 1, al: ['филия', 'филии', 'филийка', 'филийки'] },
  { key: 'handful', one: 'шепа', many: 'шепи', family: 'handful', f: 1, al: ['шепа', 'шепи'] },
];
export const UNIT = Object.fromEntries(UNITS.map((u) => [u.key, u]));
const ALIASES = UNITS.flatMap((u) => u.al.map((a) => [a, u])).sort((a, b) => b[0].length - a[0].length);
const L = 'а-яёa-z';

function matchUnit(s) {
  const low = s.toLowerCase();
  for (const [a, u] of ALIASES) {
    if (!low.startsWith(a)) continue;
    const next = low.charAt(a.length);
    if (next && new RegExp(`[${L}]`).test(next)) continue; // „г“ не е началото на „гъби“
    return { u, len: a.length };
  }
  return null;
}
export const unitText = (key, qty) => {
  const u = UNIT[key];
  if (!u) return '';
  return qty != null && qty !== 1 ? u.many : u.one;
};

// ── количества ──
const FRAC = { '½': 0.5, '¼': 0.25, '¾': 0.75, '⅓': 1 / 3, '⅔': 2 / 3, '⅛': 0.125 };
const NUM = String.raw`\d+\s*[½¼¾⅓⅔⅛]|\d+\s+\d+\/\d+|\d+\/\d+|\d+(?:[.,]\d+)?|[½¼¾⅓⅔⅛]`;
const QTY_RE = new RegExp(String.raw`^(около|ок\.|приблизително|~)?\s*(${NUM})(?:\s*(?:-|–|—|до)\s*(${NUM}))?\s*`, 'i');

function parseNum(s) {
  s = String(s).trim();
  let m;
  if ((m = s.match(/^(\d+)\s*([½¼¾⅓⅔⅛])$/))) return Number(m[1]) + FRAC[m[2]];
  if ((m = s.match(/^(\d+)\s+(\d+)\/(\d+)$/))) return Number(m[1]) + Number(m[2]) / Number(m[3]);
  if ((m = s.match(/^(\d+)\/(\d+)$/))) return Number(m[1]) / Number(m[2]);
  if (FRAC[s] != null) return FRAC[s];
  const n = Number(s.replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

const NICE = [
  [0.125, '⅛'],
  [0.25, '¼'],
  [0.5, '½'],
  [0.75, '¾'],
  [1 / 3, '⅓'],
  [2 / 3, '⅔'],
];
// Хубаво число: 0,5 → ½ при лъжици и бройки; грамовете — цели.
export function fmtNum(q, unit = '') {
  if (q == null || !Number.isFinite(q)) return '';
  const fam = UNIT[unit]?.family;
  if (fam !== 'mass' && fam !== 'vol') {
    const whole = Math.floor(q + 1e-9);
    const frac = q - whole;
    const nice = NICE.find(([v]) => Math.abs(frac - v) < 0.02);
    if (frac < 0.02) return String(whole);
    if (nice) return (whole ? whole : '') + nice[1];
  }
  const r = q >= 100 ? Math.round(q) : q >= 10 ? Math.round(q * 2) / 2 : Math.round(q * 100) / 100;
  return String(r).replace('.', ',');
}

export function fmtQty(ing, factor = 1) {
  if (ing.qty == null) return '';
  const a = ing.qty * factor;
  const b = ing.qtyMax != null ? ing.qtyMax * factor : null;
  const n = b != null ? `${fmtNum(a, ing.unit)}–${fmtNum(b, ing.unit)}` : fmtNum(a, ing.unit);
  const u = unitText(ing.unit, b != null ? b : a);
  return `${ing.approx ? 'около ' : ''}${n}${u ? ' ' + u : ''}`;
}

// ── продукт от един ред ──
const STATE_RE = /сур|свар|отцед|сух|накисн|замраз|размраз|изпеч|печен|запечен|задушен|консерв|измер|обелен|почист/i;
const EMPTY = /^(?:—|–|-|няма|не е посочен[оаи]?|не са посочени|неизвестно|n\/a|\?)?$/i;
export const isEmptyVal = (v) => EMPTY.test(String(v || '').trim());

export function parseIngredient(line) {
  const raw = String(line).trim().replace(/^[-–—•*·]\s*/, '').trim();
  if (!raw) return null;
  const ing = { name: '', qty: null, qtyMax: null, approx: false, unit: '', state: '', note: '', raw };
  const extra = [];
  let rest = raw.replace(/\(([^)]*)\)/g, (_, t) => {
    t.split(/[;]/).forEach((p) => p.trim() && extra.push(p.trim()));
    return ' ';
  });
  rest = rest.replace(/\s+/g, ' ').trim();

  const takeQty = (s) => {
    const m = s.match(QTY_RE);
    if (!m || !m[2]) return null;
    const out = { approx: !!m[1], qty: parseNum(m[2]), qtyMax: m[3] ? parseNum(m[3]) : null, unit: '', rest: s.slice(m[0].length) };
    const u = matchUnit(out.rest);
    if (u) {
      out.unit = u.u.key;
      out.rest = out.rest.slice(u.len).replace(/^\.?\s*/, '');
    }
    return out;
  };

  let q = takeQty(rest);
  if (q) {
    Object.assign(ing, { qty: q.qty, qtyMax: q.qtyMax, approx: q.approx, unit: q.unit });
    rest = q.rest.replace(/^от\s+/i, '');
  } else {
    // „Леща – 250 г“ или „Леща: 250 г“
    const m = rest.match(/^(.+?)\s*(?:\s[–—-]\s|:)\s*(.+)$/);
    const q2 = m && takeQty(m[2]);
    if (q2) {
      Object.assign(ing, { qty: q2.qty, qtyMax: q2.qtyMax, approx: q2.approx, unit: q2.unit });
      rest = m[1];
      if (q2.rest.trim()) extra.push(q2.rest.trim());
    } else if (m && !/\d/.test(m[1])) {
      rest = m[1];
      extra.push(m[2]);
    } else {
      // „Леща 250 г“ — количеството накрая
      const t = rest.match(new RegExp(String.raw`^(.*?[^\d\s])\s+((?:около\s+)?(?:${NUM})(?:\s*[-–]\s*(?:${NUM}))?\s*\S*)$`, 'i'));
      const q3 = t && takeQty(t[2]);
      if (q3 && !q3.rest.trim()) {
        Object.assign(ing, { qty: q3.qty, qtyMax: q3.qtyMax, approx: q3.approx, unit: q3.unit });
        rest = t[1];
      }
    }
  }
  // „лук, нарязан на ситно“ → бележка след запетаята
  const comma = rest.indexOf(',');
  if (comma > 0) {
    extra.push(rest.slice(comma + 1).trim());
    rest = rest.slice(0, comma);
  }
  const dash = rest.match(/\s[–—-]\s(.+)$/);
  if (dash) {
    extra.push(dash[1].trim());
    rest = rest.slice(0, dash.index);
  }
  // „щипка сол“, „глава лук“ — мярка без число значи една
  if (ing.qty == null) {
    const u = matchUnit(rest);
    if (u && !['mass', 'vol'].includes(u.u.family) && rest.slice(u.len).trim()) {
      Object.assign(ing, { qty: 1, unit: u.u.key });
      rest = rest.slice(u.len).trim();
    }
  }
  ing.name = rest.trim().replace(/[.;:]$/, '');
  const st = [];
  const nt = [];
  extra.filter(Boolean).forEach((p) => (STATE_RE.test(p) ? st : nt).push(p));
  ing.state = st.join(', ');
  ing.note = nt.join(', ');
  if (!ing.name) {
    ing.name = raw;
    Object.assign(ing, { qty: null, qtyMax: null, unit: '', state: '', note: '' });
  }
  return ing;
}

export function ingredientToText(i) {
  if (i.group) return `${i.group}:`;
  const q = i.qty != null ? `${i.approx ? 'около ' : ''}${fmtNum(i.qty, i.unit)}${i.qtyMax != null ? '–' + fmtNum(i.qtyMax, i.unit) : ''}${i.unit ? ' ' + unitText(i.unit, i.qtyMax ?? i.qty) : ''} ` : '';
  return `${q}${i.name}${i.state ? ` (${i.state})` : ''}${i.note ? `, ${i.note}` : ''}`;
}

export function parseIngredients(text) {
  const out = [];
  String(text || '')
    .split('\n')
    .forEach((line) => {
      const t = line.trim();
      if (!t || isEmptyVal(t)) return;
      const bare = t.replace(/^[-–—•*·]\s*/, '');
      if (/:$/.test(bare) && !/\d/.test(bare) && bare.length < 60) out.push({ group: bare.replace(/:$/, '').trim() });
      else {
        const i = parseIngredient(t);
        if (i) out.push(i);
      }
    });
  return out;
}

// ── стъпки ──
const STEP_FIELDS = [
  ['time', /^(?:време|продължителност)$/i],
  ['temp', /^температура$/i],
  ['mode', /^(?:режим(?: на фурната)?|фурна)$/i],
  ['done', /^(?:готово,? когато|признак(?:ци)?(?: за готовност)?|готовност|как да познаеш, че е готово)$/i],
];
export const STEP_LABELS = { time: 'Време', temp: 'Температура', mode: 'Режим на фурната', done: 'Готово, когато' };

export function parseSteps(text) {
  const steps = [];
  let cur = null;
  String(text || '')
    .split('\n')
    .forEach((line) => {
      const t = line.trim();
      if (!t || isEmptyVal(t)) return;
      const sub = t.replace(/^[-–—•*·]\s*/, '').match(/^([^:]{3,40}):\s*(.*)$/);
      if (sub && cur) {
        const f = STEP_FIELDS.find(([, re]) => re.test(sub[1].trim()));
        if (f) {
          if (!isEmptyVal(sub[2])) cur[f[0]] = sub[2].trim();
          return;
        }
      }
      const num = t.match(/^(?:стъпка\s*)?(\d+)\s*[.)]\s*(.*)$/i);
      if (num) {
        cur = { text: num[2].trim() };
        steps.push(cur);
        return;
      }
      const bullet = t.match(/^[-–—•*·]\s*(.*)$/);
      if (bullet || !cur) {
        cur = { text: (bullet ? bullet[1] : t).trim() };
        steps.push(cur);
        return;
      }
      cur.text += (cur.text ? ' ' : '') + t;
    });
  return steps.filter((s) => s.text || s.time || s.temp || s.mode || s.done);
}

export function stepsToText(steps) {
  return (steps || [])
    .map((s, i) => [`${i + 1}. ${s.text || ''}`, ...Object.keys(STEP_LABELS).filter((k) => s[k]).map((k) => `${STEP_LABELS[k]}: ${s[k]}`)].join('\n'))
    .join('\n');
}

const lines = (text) =>
  String(text || '')
    .split('\n')
    .map((l) => l.trim().replace(/^[-–—•*·]\s*/, '').trim())
    .filter((l) => l && !isEmptyVal(l));
export const listFromText = lines;

// ── рецепта по образеца ──
const FIELDS = [
  ['title', ['име', 'име на рецептата', 'название', 'заглавие']],
  ['desc', ['кратко описание', 'описание']],
  ['seasons', ['сезони', 'сезон']],
  ['cats', ['категории', 'категория']],
  ['servings', ['брой порции', 'порции', 'порция']],
  ['ahead', ['подготовка предварително', 'предварителна подготовка']],
  ['prep', ['време за подготовка', 'подготовка']],
  ['cook', ['време за готвене', 'време за печене', 'готвене', 'печене']],
  ['total', ['общо време']],
  ['equipment', ['необходими съдове и размери', 'необходими съдове', 'съдове и размери', 'съдове']],
  ['ingredients', ['продукти', 'необходими продукти', 'съставки', 'продукти с точни количества']],
  ['steps', ['номерирани стъпки', 'стъпки', 'начин на приготвяне', 'приготвяне']],
  ['secrets', ['тайните за добър резултат', 'тайни за добър резултат', 'тайните']],
  ['swaps', ['възможни замени', 'замени']],
  ['addons', ['подходящи добавки', 'добавки']],
  ['fast', ['постен вариант']],
  ['contains', ['съдържа', 'обозначения']],
  ['storage', ['съхранение']],
  ['reheat', ['претопляне']],
  ['freeze', ['замразяване']],
  ['notes', ['лични бележки', 'бележки']],
  ['original', ['оригинален текст']],
];
const FIELD_ALIASES = FIELDS.flatMap(([k, al]) => al.map((a) => [a, k])).sort((a, b) => b[0].length - a[0].length);

function headerOf(line) {
  const clean = line
    .replace(/^#{1,6}\s*/, '')
    .replace(/\*\*|__/g, '')
    .replace(/^[-•*]\s+(?=[А-Яа-я])/, '')
    .trim();
  const low = clean.toLowerCase();
  for (const [a, k] of FIELD_ALIASES) {
    if (!low.startsWith(a)) continue;
    const rest = clean.slice(a.length);
    if (rest === '') return { key: k, value: '' };
    const m = rest.match(/^\s*(?:\([^)]*\)|за [^:]{1,40})?\s*:\s*(.*)$/);
    if (m) return { key: k, value: m[1].trim() };
  }
  return null;
}

function parseSeasons(text) {
  const t = text.toLowerCase();
  if (/целогодиш|всички сезони|през цялата година/.test(t)) return SEASONS.map(([k]) => k);
  const out = [];
  if (/пролет/.test(t)) out.push('spring');
  if (/лят/.test(t)) out.push('summer');
  if (/есен/.test(t)) out.push('autumn');
  if (/зим/.test(t)) out.push('winter');
  return out;
}
function parseCats(text) {
  const t = text.toLowerCase();
  const out = [];
  const cleaned = t.replace(/следобедн\S*\s+закуск\S*/g, () => {
    out.push('snack');
    return '';
  });
  if (/закуск/.test(cleaned)) out.push('breakfast');
  if (/суп|чорб/.test(t)) out.push('soup');
  if (/основн/.test(t)) out.push('main');
  if (/салат/.test(t)) out.push('salad');
  if (/десерт|сладк/.test(t)) out.push('dessert');
  return [...new Set(out)];
}
export function parseContains(text) {
  const out = {};
  const keys = [
    ['meat', /мес[оа]|месни/],
    ['fish', /риб/],
    ['eggs', /яйц/],
    ['dairy', /млечн|мляко/],
    ['oil', /олио|мазнин/],
  ];
  String(text || '')
    .toLowerCase()
    .split(/[;,\n]/)
    .forEach((part) => {
      const k = keys.find(([, re]) => re.test(part));
      if (!k) return;
      const v = part.replace(k[1], ' ');
      if (/(?:^|[^а-яa-z])(?:не|no|няма|без)(?![а-яa-z])|✗|✘/.test(v)) out[k[0]] = false;
      else if (/(?:^|[^а-яa-z])(?:да|yes|има|съдържа)(?![а-яa-z])|✓|✔/.test(v)) out[k[0]] = true;
    });
  return out;
}

export function emptyRecipe() {
  return {
    title: '',
    desc: '',
    seasons: [],
    cats: [],
    fav: false,
    servings: null,
    servingsText: '',
    prep: '',
    cook: '',
    total: '',
    equipment: [],
    ingredients: [],
    steps: [],
    secrets: [],
    swaps: [],
    addons: [],
    fast: '',
    contains: {},
    storage: '',
    reheat: '',
    freeze: '',
    ahead: '',
    notes: [],
    original: '',
    unparsed: '',
    photo: '',
  };
}

// Разделя поставения текст на рецепти по редовете „=== РЕЦЕПТА ===“.
export function splitRecipes(text) {
  const src = String(text || '').replace(/\r\n?/g, '\n');
  const parts = src.split(/^\s*=+\s*рецепта\s*=*\s*$/im);
  const blocks = parts
    .map((p) => p.split(/^\s*=+\s*край\s*=*\s*$/im)[0].trim())
    .filter(Boolean);
  if (parts.length === 1) return blocks.length ? [blocks[0]] : [];
  // текстът преди първото „=== РЕЦЕПТА ===“ (поздрав на Gemini и т.н.) не е рецепта
  return parts[0].trim() && !headerOf(parts[0].trim().split('\n')[0] || '') ? blocks.slice(1) : blocks;
}

export function parseRecipe(block) {
  const r = emptyRecipe();
  const sec = {};
  const unparsed = [];
  let key = null;
  let guess = '';
  const text = String(block || '').replace(/\r\n?/g, '\n');
  for (const rawLine of text.split('\n')) {
    if (key === 'original') {
      sec.original.push(rawLine);
      continue;
    }
    const line = rawLine.trim();
    const h = line && headerOf(line);
    if (h) {
      key = h.key;
      sec[key] = sec[key] || [];
      if (h.value) sec[key].push(h.value);
      continue;
    }
    if (!line) {
      if (key) sec[key].push('');
      continue;
    }
    if (key) sec[key].push(line.replace(/\*\*|__/g, ''));
    else if (!guess && line.length < 90) guess = line.replace(/^#+\s*/, '').replace(/\*\*|__/g, '').trim();
    else unparsed.push(line);
  }
  r.title = guess;
  if (sec.title && guess) unparsed.unshift(guess);
  const txt = (k) => (sec[k] || []).join('\n').trim();
  const one = (k) => {
    const v = txt(k);
    return isEmptyVal(v) ? '' : v;
  };
  if (sec.title) r.title = one('title').split('\n')[0];
  r.desc = one('desc');
  if (sec.seasons) r.seasons = parseSeasons(txt('seasons'));
  if (sec.cats) r.cats = parseCats(txt('cats'));
  const sv = one('servings');
  if (sv) {
    const n = sv.match(/\d+(?:[.,]\d+)?/);
    r.servings = n ? Number(n[0].replace(',', '.')) : null;
    if (!n || sv.replace(/порци[ия]/i, '').trim() !== n[0]) r.servingsText = sv;
  }
  r.prep = one('prep');
  r.cook = one('cook');
  r.total = one('total');
  r.equipment = lines(txt('equipment'));
  r.ingredients = parseIngredients(txt('ingredients'));
  r.steps = parseSteps(txt('steps'));
  r.secrets = lines(txt('secrets'));
  r.swaps = lines(txt('swaps'));
  r.addons = lines(txt('addons'));
  r.fast = one('fast');
  r.contains = parseContains(txt('contains'));
  r.storage = one('storage');
  r.reheat = one('reheat');
  r.freeze = one('freeze');
  r.ahead = one('ahead');
  const notes = lines(txt('notes'));
  r.notes = notes.length ? [{ id: 'n' + Date.now().toString(36), date: '', text: notes.join('\n') }] : [];
  r.original = sec.original ? sec.original.join('\n').trim() : text.trim();
  r.unparsed = unparsed.join('\n');
  return r;
}

// Колко е разпознато — за прегледа преди записване.
export function summary(r) {
  const ing = r.ingredients.filter((i) => !i.group);
  const noQty = ing.filter((i) => i.qty == null).length;
  return { ingredients: ing.length, noQty, steps: r.steps.length, seasons: r.seasons.length, cats: r.cats.length, unparsed: r.unparsed ? r.unparsed.split('\n').length : 0 };
}

export const normTitle = (s) =>
  String(s || '')
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();

export function findDuplicate(rec, list, skipId = '') {
  const t = normTitle(rec.title);
  if (!t) return null;
  return (
    list.find((r) => {
      if (r.id === skipId) return false;
      const o = normTitle(r.title);
      return o === t || (t.length >= 6 && o.length >= 6 && (o.includes(t) || t.includes(o)));
    }) || null
  );
}

// ── търсене ──
export function searchText(r) {
  return normTitle([r.title, r.desc, ...(r.ingredients || []).map((i) => i.name || i.group || '')].join(' '));
}

// ── порции ──
export const familyPortions = (family) => family.filter((m) => m.eats).reduce((a, m) => a + (Number(m.portion) || 0), 0);
export const myPortion = (family) => Number((family.find((m) => m.me) || {}).portion) || 1;

// Колко порции се готвят: за това хранене + за храненията, за които е предвидено.
export function cookPortions(entry, plan) {
  if (entry.from) return 0;
  return (Number(entry.servings) || 0) + plan.filter((e) => e.from === entry.id).reduce((a, e) => a + (Number(e.servings) || 0), 0);
}

// ── списък за покупки ──
export const normName = (s) =>
  String(s || '')
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/[^\p{L}\p{N} ]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();

export function shoppingList(entries, plan, recipes) {
  const byId = new Map(recipes.map((r) => [r.id, r]));
  const items = new Map();
  const warnings = [];
  for (const e of entries) {
    if (e.from || !e.recipeId) continue;
    const r = byId.get(e.recipeId);
    if (!r) continue;
    const portions = cookPortions(e, plan);
    const base = Number(r.servings) > 0 ? Number(r.servings) : null;
    const factor = base ? portions / base : 1;
    if (!base) warnings.push(`„${r.title}“ няма посочени порции, затова е сметната веднъж, както е в рецептата.`);
    for (const ing of r.ingredients || []) {
      if (ing.group || !ing.name) continue;
      const u = UNIT[ing.unit];
      const fam = ing.qty == null ? 'none' : u ? u.family : 'count';
      const key = `${normName(ing.name)}|${normName(ing.state)}|${fam}`;
      let it = items.get(key);
      if (!it) {
        it = { key, name: ing.name, state: ing.state || '', fam, unit: u ? (u.family === 'mass' ? 'g' : u.family === 'vol' ? 'ml' : u.key) : '', min: 0, max: 0, ranged: false, approx: false, notes: new Set(), from: new Set() };
        items.set(key, it);
      }
      if (ing.qty != null) {
        const f = u ? u.f : 1;
        it.min += ing.qty * f * factor;
        it.max += (ing.qtyMax != null ? ing.qtyMax : ing.qty) * f * factor;
        if (ing.qtyMax != null) it.ranged = true;
        if (ing.approx) it.approx = true;
      }
      if (ing.note) it.notes.add(ing.note);
      it.from.add(r.title);
    }
  }
  const list = [...items.values()].sort((a, b) => a.name.localeCompare(b.name, 'bg'));
  // един и същ продукт с различни мерки — остават отделно и се отбелязват
  const counts = {};
  list.forEach((i) => (counts[normName(i.name) + '|' + normName(i.state)] = (counts[normName(i.name) + '|' + normName(i.state)] || 0) + 1));
  list.forEach((i) => {
    i.mixed = counts[normName(i.name) + '|' + normName(i.state)] > 1;
    i.from = [...i.from];
    i.notes = [...i.notes];
    i.amount = amountText(i);
  });
  return { items: list, warnings: [...new Set(warnings)] };
}

function amountText(i) {
  if (i.fam === 'none') return '';
  let unit = i.unit;
  let a = i.min;
  let b = i.max;
  if (i.fam === 'mass' && a >= 1000) {
    unit = 'kg';
    a /= 1000;
    b /= 1000;
  }
  if (i.fam === 'vol' && a >= 1000) {
    unit = 'l';
    a /= 1000;
    b /= 1000;
  }
  const fmt = (q) => (unit === 'kg' || unit === 'l' ? String(Math.round(q * 100) / 100).replace('.', ',') : fmtNum(q, unit));
  const n = i.ranged && Math.abs(b - a) > 1e-9 ? `${fmt(a)}–${fmt(b)}` : fmt(a);
  const u = unitText(unit, b);
  return `${i.approx ? 'около ' : ''}${n}${u ? ' ' + u : ''}`;
}

// ── пост: какво знаем за ястието спрямо деня ──
const FOOD_OF = { meat: 'meat', fish: 'fish', eggs: 'dairy', dairy: 'dairy', oil: 'oil' };
export function fastCheck(recipe, allowed) {
  const issues = [];
  const unknown = [];
  const c = (recipe && recipe.contains) || {};
  for (const [k, name] of CONTAINS) {
    if (allowed.includes(FOOD_OF[k])) continue;
    if (c[k] === true) issues.push(name);
    else if (c[k] !== false) unknown.push(name);
  }
  return { ok: issues.length ? false : unknown.length ? null : true, issues, unknown };
}
