// Всичко се пази само на телефона на клиентката (localStorage). Снимките са в IndexedDB (photos.js).
import { today } from './dates.js';

const KEY = 'nnp:v1';

export function defaults() {
  return {
    v: 1,
    profile: { name: '', welcomed: false, created: today(), installHintHidden: false },
    events: [],
    cycle: { periods: [], days: {}, settings: { cycleLen: 28, periodLen: 5 } },
    goals: {},
    books: [],
    trips: [],
    lists: [],
    dreams: [],
    salon: { lastVisit: '', intervalWeeks: 4, dueHidden: '' },
    prefs: { holidays: true, fasts: 'day' },
    kitchen: kitchenDefaults(),
  };
}

const isObj = (v) => v && typeof v === 'object' && !Array.isArray(v);

// Моята кухня: рецепти, меню, семейство и покупки — всичко лично.
export function kitchenDefaults() {
  return {
    recipes: [],
    plan: [],
    cookDays: {},
    family: [{ id: 'me', name: 'Аз', portion: 1, eats: true, me: true }],
    fast: { show: true, oil: false, fish: false, dairy: false, noWeekly: false },
    shop: { skip: {}, weeks: {} },
  };
}

// Слага липсващите полета, без да пипа записаното.
export function normalize(data) {
  const base = defaults();
  if (!isObj(data)) return base;
  for (const k of Object.keys(base)) {
    if (!(k in data)) continue;
    if (Array.isArray(base[k])) base[k] = Array.isArray(data[k]) ? data[k] : base[k];
    else if (isObj(base[k]) && isObj(data[k])) {
      base[k] = { ...base[k], ...data[k] };
    } else base[k] = data[k];
  }
  base.cycle.settings = { ...defaults().cycle.settings, ...(base.cycle.settings || {}) };
  if (!Array.isArray(base.cycle.periods)) base.cycle.periods = [];
  if (!isObj(base.cycle.days)) base.cycle.days = {};
  if (!isObj(base.goals)) base.goals = {};
  const kd = kitchenDefaults();
  const k = (base.kitchen = isObj(base.kitchen) ? { ...kd, ...base.kitchen } : kd);
  if (!Array.isArray(k.recipes)) k.recipes = [];
  if (!Array.isArray(k.plan)) k.plan = [];
  if (!isObj(k.cookDays)) k.cookDays = {};
  if (!Array.isArray(k.family) || !k.family.length) k.family = kd.family;
  if (!k.family.some((m) => m.me)) k.family[0].me = true;
  k.fast = { ...kd.fast, ...(isObj(k.fast) ? k.fast : {}) };
  k.shop = { ...kd.shop, ...(isObj(k.shop) ? k.shop : {}) };
  if (!isObj(k.shop.skip)) k.shop.skip = {};
  if (!isObj(k.shop.weeks)) k.shop.weeks = {};
  return base;
}

export function load() {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? normalize(JSON.parse(raw)) : defaults();
  } catch (e) {
    console.warn('load failed', e);
    return defaults();
  }
}

export function save(state) {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
    return true;
  } catch (e) {
    console.warn('save failed', e);
    return false;
  }
}

export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
