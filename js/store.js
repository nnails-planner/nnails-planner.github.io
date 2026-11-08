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
    prefs: { holidays: true },
  };
}

const isObj = (v) => v && typeof v === 'object' && !Array.isArray(v);

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
