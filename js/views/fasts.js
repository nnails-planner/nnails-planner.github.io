// Постите в планера: карта „Трапеза днес“, бележки в мрежата и обяснения.
import * as D from '../dates.js';
import { fastDay, fastOn, fastStarting, LEVELS, FOODS, yearOverview } from '../fasting.js';
import { state, esc, openSheet, refreshSheet, registerActions } from '../ui.js';
import { icon } from '../icons.js';

// 'day' — всеки ден какво се яде; 'big' — само четирите големи пости; 'off' — нищо.
export function fastMode() {
  const v = state.prefs.fasts;
  if (v === true) return 'day';
  return v === 'day' || v === 'big' ? v : 'off';
}

const LV_ICON = { free: 'sparkle', dairy: 'egg', fish: 'fish', oil: 'oil', strict: 'leaf', total: 'candle' };
const FOOD_ICON = { meat: 'meat', dairy: 'egg', fish: 'fish', oil: 'oil', wine: 'wine', plant: 'leaf' };
const FOOD_SHORT = { meat: 'месо', dairy: 'млечно', fish: 'риба', oil: 'олио', wine: 'вино', plant: 'постно' };

function foods(f, long = false) {
  return `<span class="foods ${long ? 'foods-long' : ''}">${FOODS.map(([k, name]) => {
    const ok = f.ok.includes(k);
    return `<span class="food ${ok ? 'on' : 'off'}" aria-label="${esc(name)}: ${ok ? 'може' : 'не'}"><span class="food-ic">${icon(FOOD_ICON[k])}</span><small>${long ? esc(name) : FOOD_SHORT[k]}</small>${long ? `<em>${ok ? 'може' : 'не'}</em>` : ''}</span>`;
  }).join('')}</span>`;
}

// ── в мрежата на месеца ──
export function gridMark(date) {
  const mode = fastMode();
  if (mode === 'day') {
    const f = fastDay(date);
    return f.level === 'free' ? '' : `<em class="fm fm-${f.level}"></em>`;
  }
  if (mode === 'big') return fastOn(date) ? '<em class="fm fm-oil"></em>' : '';
  return '';
}

export function legend(monthKey) {
  const mode = fastMode();
  if (mode === 'big') return '<span><i class="lg-fm fm-oil"></i>пости</span>';
  if (mode !== 'day') return '';
  const seen = new Set(D.monthGrid(monthKey).filter((d) => D.monthKey(d) === monthKey).map((d) => fastDay(d).level));
  return ['dairy', 'fish', 'oil', 'strict', 'total']
    .filter((l) => seen.has(l))
    .map((l) => `<span><i class="lg-fm fm-${l}"></i>${LEVELS[l].short}</span>`)
    .join('');
}

// ── етикети към деня (в седмичния изглед и в режим „само големите пости“) ──
export function dayTags(date, { withLevel = false } = {}) {
  const mode = fastMode();
  if (mode === 'off') return [];
  const out = [];
  if (mode === 'day') {
    const f = fastDay(date);
    if (withLevel && f.level !== 'free') out.push(`<span class="tag tag-lv lv-${f.level}">${icon(LV_ICON[f.level])}${f.name}</span>`);
    if (withLevel && f.zag) out.push(`<span class="tag tag-lv lv-free">${icon('sparkle')}${esc(f.zag)}</span>`);
    return out;
  }
  const f = fastOn(date);
  const next = f ? null : fastStarting(D.addDays(date, 1));
  if (f) out.push(`<span class="tag tag-fast">${f.name} · ${f.total === 1 ? 'само 1 ден' : `ден ${f.day} от ${f.total}`}</span>`);
  else if (next) out.push(`<span class="tag tag-fast">Утре ${next.verb} ${next.the}</span>`);
  return out;
}

// ── картата „Трапеза“ в панела на деня ──
const dayWord = (date) => {
  const n = D.diffDays(D.today(), date);
  return n === 0 ? 'днес' : n === 1 ? 'утре' : n === -1 ? 'вчера' : '';
};

export function card(date) {
  if (fastMode() !== 'day') return '';
  const f = fastDay(date);
  const w = dayWord(date);
  const head = w ? `Трапеза ${w}` : `Трапеза · ${D.fmtShort(date)}`;
  const lines = [f.period, f.level === 'free' && !f.why ? (w === 'днес' ? 'Днес няма пост — може всичко.' : 'Няма пост — може всичко.') : f.why].filter(Boolean);
  return `<button class="fast-card lv-${f.level}" data-act="fast-info" data-date="${date}">
    <span class="fc-top"><span class="fc-ic">${icon(LV_ICON[f.level])}</span>
      <span class="fc-txt"><small class="caps">${head}</small><b>${f.name}</b></span>
      <span class="fc-go">${icon('right')}</span></span>
    ${lines.map((l, i) => `<span class="fc-line ${i === 0 && f.period ? 'fc-period' : ''}">${esc(l)}</span>`).join('')}
    ${f.level === 'free' ? '' : foods(f)}
    ${f.eve ? `<span class="fc-eve">${icon('sparkle')}${esc(f.eve)}</span>` : ''}
  </button>`;
}

// ── малката карта горе (винаги за днес) ──
export function mini() {
  if (fastMode() !== 'day') return null;
  const t = D.today();
  const f = fastDay(t);
  const sub = f.level === 'free' ? (f.zag || (f.eve ? f.eve.replace(/\.$/, '') : 'Днес няма пост')) : `Днес · ${f.period ? f.period.split(' · ')[0] : f.short}`;
  return {
    first: f.level !== 'free',
    html: `<button class="mini mini-fast lv-${f.level}" data-act="fast-info" data-date="${t}">${icon(LV_ICON[f.level])}<span><b>${f.name}</b><small>${esc(sub)}</small></span></button>`,
  };
}

// ── лист с подробности за деня ──
let infoDate = null;

function infoBody() {
  const f = fastDay(infoDate);
  const w = dayWord(infoDate);
  const prev = D.addDays(infoDate, -1);
  const next = D.addDays(infoDate, 1);
  return `<div class="fi">
    <section class="fi-hero lv-${f.level}">
      <span class="fi-ic">${icon(LV_ICON[f.level])}</span>
      <p class="caps">${w ? D.cap(w) + ' · ' : ''}${D.fmtLong(infoDate)}</p>
      <h3>${f.name}</h3>
      ${f.period ? `<p class="fi-period">${esc(f.period)}</p>` : ''}
      ${f.why ? `<p>${esc(f.why)}</p>` : ''}
    </section>
    ${foods(f, true)}
    <p class="fi-text">${esc(f.text)}</p>
    ${f.note ? `<p class="note">${icon('cross')}<span>${esc(f.note)}</span></p>` : ''}
    ${f.eve ? `<p class="note">${icon('sparkle')}<span>${esc(f.eve)}</span></p>` : ''}
    <div class="fi-nav">
      <button class="btn ghost" data-act="fast-day" data-date="${prev}">${icon('left')} ${D.fmtShort(prev)}</button>
      <button class="btn ghost" data-act="fast-day" data-date="${next}">${D.fmtShort(next)} ${icon('right')}</button>
    </div>
    <button class="btn primary wide" data-act="fast-year" data-y="${D.yearOf(infoDate)}">${icon('cross')} Постите през ${D.yearOf(infoDate)} г.</button>
  </div>`;
}

export function openFastInfo(date) {
  infoDate = date;
  openSheet({ title: 'Трапеза', render: infoBody, cls: 'sheet-fast' });
}

// ── лист „Постите през годината“ ──
let yearShown = null;

function levelRow(l) {
  const f = LEVELS[l];
  return `<li class="lv-row lv-${l}"><span class="fc-ic">${icon(LV_ICON[l])}</span><span><b>${f.name}</b><small>${esc(f.text)}</small></span></li>`;
}

function yearBody() {
  const y = yearShown;
  const o = yearOverview(y);
  const days = (n) => `${n} ${n === 1 ? 'ден' : 'дни'}`;
  return `<div class="fy">
    <div class="fy-year"><button class="icon-btn" data-act="fast-year-shift" data-n="-1" aria-label="Предишна година">${icon('left')}</button><h3>${y}</h3><button class="icon-btn" data-act="fast-year-shift" data-n="1" aria-label="Следваща година">${icon('right')}</button></div>
    <p class="fy-intro">Постът е време за тишина, благодарност и грижа за душата — не диета. Започни постепенно: първо със сряда и петък, а после и с големите пости. Великден през ${y} г. е на ${D.fmtShort(o.easter)}.</p>

    <h4>Какво означава всеки ден</h4>
    <ul class="lv-list">${['free', 'dairy', 'fish', 'oil', 'strict', 'total'].map(levelRow).join('')}</ul>

    <h4>Четирите големи пости</h4>
    <div class="fy-big">${o.big
      .map((p) => `<section class="fy-fast"><header><b>${p.name}</b><span>${days(p.total)}</span></header><p class="fy-dates">${p.label}</p><p>${esc(p.rule)}</p></section>`)
      .join('')}</div>

    <h4>Еднодневни пости</h4>
    <ul class="fy-list">${o.one.map((x) => `<li><span><b>${esc(x.name)}</b><small>${x.label}</small></span><span class="tag tag-lv lv-${x.lv.level}">${x.lv.name}</span></li>`).join('')}</ul>

    <h4>Сряда и петък</h4>
    <p>Всяка сряда и всеки петък през годината са постни — без месо, млечни храни и яйца, но с риба и олио. В сряда си спомняме предателството на Юда, а в петък — Разпятието Христово. Изключение са седмиците, в които се блажи:</p>
    <ul class="fy-list">${o.free.map((x) => `<li><span><b>${esc(x.name)}</b><small>${x.label}</small></span></li>`).join('')}</ul>

    <h4>Заговезни</h4>
    <p>Последният ден с блажна храна преди пост — семейството сяда заедно на трапеза. На Месни заговезни за последно се яде месо, а на Сирни заговезни — млечни храни и яйца. Вечерта си искаме прошка.</p>
    <ul class="fy-list">${o.zag.map((x) => `<li><span><b>${esc(x.name)}</b><small>${x.label}</small></span></li>`).join('')}</ul>

    <h4>Добре е да знаеш</h4>
    <ul class="fy-notes">
      <li>Миди, калмари, октопод и охлюви се смятат за постна храна.</li>
      <li>Преди причастие се пости, а сутринта преди светата литургия не се яде и не се пие нищо.</li>
      <li>Децата, болните, бременните и кърмещите жени и пътуващите постят облекчено. Ако имаш здравословен проблем, посъветвай се с лекар и със свещеник.</li>
      <li>Някои дни носят бележка „По устава…“ — там църковният устав е по-строг от постния календар. Който иска, може да пости и по него.</li>
    </ul>
    <p class="fy-src">По календара на Българската патриаршия и постните календари, които храмовете печатат.</p>
  </div>`;
}

export function openFastYear(y) {
  yearShown = y;
  openSheet({ title: 'Постите през годината', render: yearBody, cls: 'sheet-fast' });
}

registerActions({
  'fast-info': (el) => openFastInfo(el.dataset.date || D.today()),
  'fast-day': (el) => {
    infoDate = el.dataset.date;
    refreshSheet();
  },
  'fast-year': (el) => openFastYear(Number(el.dataset.y) || D.yearOf(D.today())),
  'fast-year-shift': (el) => {
    yearShown = Math.min(2099, Math.max(1901, yearShown + Number(el.dataset.n)));
    refreshSheet();
  },
});
