// Моята кухня: книга с рецепти, седмично меню и списък за покупки.
// Всичко е лично — стои само на телефона, както останалите записи.
import * as D from '../dates.js';
import * as KM from '../kitchen-model.js';
import { fastDay, LEVELS } from '../fasting.js';
import { state, ui, esc, commit, openSheet, closeSheet, refreshSheet, registerActions, sheetRoot, toast, confirmSheet, chips, formData, saveUi } from '../ui.js';
import { uid } from '../store.js';
import { icon } from '../icons.js';
import * as Photos from '../photos.js';
import { openRecipe, openEditor, openImport, recipeById, seasonKey, ORN } from './recipe.js';

const K = () => state.kitchen;
const plan = () => K().plan;
const titleOf = (e) => recipeById(e.recipeId)?.title || e.title || 'Ястие';
const mealName = (m) => KM.label(KM.MEALS, m);
const MEAL_ORDER = Object.fromEntries(KM.MEALS.map(([k], i) => [k, i]));
const MEAL_FROM = { breakfast: 'закуската', lunch: 'обяда', snack: 'следобедната закуска', dinner: 'вечерята' };
const entriesOn = (date) => plan().filter((e) => e.date === date).sort((a, b) => MEAL_ORDER[a.meal] - MEAL_ORDER[b.meal]);
const portionsWord = (n) => (n === 1 ? 'порция' : 'порции');
const fmtP = (n) => `${KM.fmtNum(n)} ${portionsWord(n)}`;
const weekStart = () => (ui.kWeek = ui.kWeek || D.startOfWeek(D.today()));
const sourceOf = (e) => (e.from ? plan().find((x) => x.id === e.from) : null);
const kidsOf = (e) => plan().filter((x) => x.from === e.id);

function fromLabel(e) {
  const src = sourceOf(e);
  if (!src) return 'От сготвеното';
  if (src.date === e.date) return `От ${MEAL_FROM[src.meal]}`;
  return `От ${D.WD[D.wdIndex(src.date)]}`;
}

// ── пост само за мен ──
export function myFast(date) {
  const f = fastDay(date);
  const s = K().fast;
  let level = f.level;
  if (s.noWeekly && f.weekly) level = 'free';
  const allowed = new Set(LEVELS[level].ok);
  if (s.oil) allowed.add('oil').add('wine');
  if (s.fish) allowed.add('fish');
  if (s.dairy) allowed.add('dairy');
  return { level, name: LEVELS[level].name, allowed: [...allowed], period: f.period };
}
const showFast = () => K().fast.show;

function checkFor(e) {
  if (!e.forMe || !showFast()) return null;
  const f = myFast(e.date);
  if (f.level === 'free') return null;
  const r = recipeById(e.recipeId);
  if (!r) return { ok: null, issues: [], unknown: ['съставът'], f };
  return { ...KM.fastCheck(r, f.allowed), f };
}
const CHECK_IC = (c) => (!c ? '' : c.ok === true ? `<i class="kc ok" title="Отговаря">${icon('check')}</i>` : c.ok === false ? `<i class="kc no" title="Не отговаря">!</i>` : `<i class="kc unk" title="Провери">?</i>`);

// ── книга ──
function recipeCard(r) {
  const meta = [r.prep && `${icon('timer')}${esc(r.prep)}`, r.servings && `${KM.fmtNum(r.servings)} п.`].filter(Boolean).join(' · ');
  const ss = (r.seasons || []).length === 4 ? `<span class="ss-dot ss-all"></span>` : (r.seasons || []).map((k) => `<span class="ss-dot ss-${k}" title="${KM.label(KM.SEASONS, k)}"></span>`).join('');
  return `<button class="kr ss-${seasonKey(r)}" data-act="k-open" data-id="${r.id}" data-q="${esc(KM.searchText(r))}">
    <span class="kr-pic">${r.photo ? `<img data-photo="${r.photo}" alt="">` : `<span class="kr-mono">${esc((r.title || '?').charAt(0).toUpperCase())}</span>`}</span>
    <span class="kr-body"><b>${esc(r.title)}</b>${meta ? `<small>${meta}</small>` : ''}${ss ? `<span class="kr-ss">${ss}</span>` : ''}</span>
    ${r.fav ? `<span class="kr-fav">${icon('heart')}</span>` : ''}
  </button>`;
}

function bookPage() {
  const all = K().recipes;
  const season = ui.kSeason || 'all';
  const cat = ui.kCat || 'all';
  const list = all
    .filter((r) => (season === 'all' ? true : season === 'fav' ? r.fav : (r.seasons || []).includes(season)) && (cat === 'all' || (r.cats || []).includes(cat)))
    .sort((a, b) => a.title.localeCompare(b.title, 'bg'));
  const favs = all.filter((r) => r.fav).length;
  const chapters =
    cat === 'all'
      ? [...KM.CATS, ['none', 'Без категория']].map(([k, l]) => [l, list.filter((r) => (k === 'none' ? !(r.cats || []).length : (r.cats || []).includes(k)))]).filter(([, l]) => l.length)
      : [[KM.label(KM.CATS, cat), list]];
  const head = `<figure class="banner"><img src="img/kitchen.svg" alt="" width="960" height="536"></figure>
    <header class="page-head"><h1>Моята кухня</h1><p class="muted">${all.length ? `Рецепти: <b>${all.length}</b> · Любими: <b>${favs}</b>` : 'Твоята лична книга с рецепти'}</p></header>`;
  if (!all.length) {
    return `${head}
    <section class="k-empty card">${ORN}
      <h2>Книгата чака първата ти рецепта</h2>
      <p>Записвай любимите си ястия по сезони — с точни количества, стъпки и твоите тайни. Рецептите виждаш само ти.</p>
      <div class="btn-col"><button class="btn primary wide" data-act="k-new">${icon('plus')} Нова рецепта</button><button class="btn ghost wide" data-act="k-import">${icon('text')} Добави от текст</button></div>
    </section>`;
  }
  return `${head}
    <label class="k-search">${icon('search')}<input type="search" name="kq" placeholder="Търси по име или продукт" autocomplete="off" data-keep data-ksearch></label>
    <div class="filter">${[['all', 'Всички'], ...KM.SEASONS, ['fav', '♥ Любими']].map(([k, l]) => `<button class="${season === k ? 'on' : ''}" data-act="k-season" data-f="${k}">${k !== 'all' && k !== 'fav' ? icon(k) : ''}${l}</button>`).join('')}</div>
    <div class="filter">${[['all', 'Всички ястия'], ...KM.CATS].map(([k, l]) => `<button class="${cat === k ? 'on' : ''}" data-act="k-cat" data-f="${k}">${l}</button>`).join('')}</div>
    <div class="btn-row"><button class="btn primary" data-act="k-new">${icon('plus')} Нова</button><button class="btn ghost" data-act="k-import">${icon('text')} От текст</button></div>
    ${
      chapters.length
        ? chapters.map(([l, rs]) => `<section class="k-chap"><h2 class="k-chap-h">${esc(l)}</h2><div class="k-list">${rs.map(recipeCard).join('')}</div></section>`).join('')
        : `<p class="empty card">Тук още няма рецепти.</p>`
    }
    <p class="empty card k-none" hidden>Не намерих такава рецепта.</p>`;
}

function filterBook(root) {
  const input = root.querySelector('[data-ksearch]');
  if (!input) return;
  const run = () => {
    const words = KM.normTitle(input.value).split(' ').filter(Boolean);
    let shown = 0;
    root.querySelectorAll('.k-chap').forEach((ch) => {
      let n = 0;
      ch.querySelectorAll('.kr').forEach((c) => {
        const ok = words.every((w) => c.dataset.q.includes(w));
        c.hidden = !ok;
        if (ok) n++;
      });
      ch.hidden = !n;
      shown += n;
    });
    const none = root.querySelector('.k-none');
    if (none) none.hidden = !!shown || !words.length;
  };
  input.addEventListener('input', run);
  run();
}

// ── меню ──
function familyLine() {
  const fam = K().family;
  const eat = fam.filter((m) => m.eats);
  return `${eat.map((m) => esc(m.name)).join(', ') || 'никой'} · <b>${fmtP(KM.familyPortions(fam))}</b> за семейно ястие`;
}

function pill(e) {
  const kids = kidsOf(e);
  const c = checkFor(e);
  const src = sourceOf(e);
  const early = src && src.date > e.date;
  const sub = [e.from ? fromLabel(e).toLowerCase() : '', `${KM.fmtNum(e.servings)} п.`, kids.length ? `+${kids.length} ${kids.length === 1 ? 'хранене' : 'хранения'}` : '', early ? 'преди готвенето!' : ''].filter(Boolean).join(' · ');
  return `<button class="kp ${e.forMe ? 'me' : ''} ${e.from ? 'left' : ''} ${e.recipeId ? '' : 'norec'}" data-act="k-entry" data-id="${e.id}">
    ${e.forMe ? `<span class="kp-me">${icon('leaf')}само за мен</span>` : ''}
    <span class="kp-t">${esc(titleOf(e))}</span><span class="kp-s">${sub}</span>${CHECK_IC(c)}
  </button>`;
}

function dayCard(date) {
  const es = entriesOn(date);
  const cook = !!K().cookDays[date];
  const f = showFast() ? myFast(date) : null;
  const t = D.today();
  return `<section class="kd ${date === t ? 'today' : ''} ${cook ? 'cook' : ''}" id="kd-${date}">
    <header class="kd-h"><span class="kd-date"><b>${D.cap(D.WD[D.wdIndex(date)])}</b><small>${D.fmtShort(date)}${date === t ? ' · днес' : ''}</small></span>
      ${f && f.level !== 'free' ? `<span class="tag tag-lv lv-${f.level}">${f.name}</span>` : ''}
      <button class="kd-cook ${cook ? 'on' : ''}" data-act="k-cookday" data-date="${date}" aria-pressed="${cook}">${icon('pot')}${cook ? 'Готвя' : 'Готвя?'}</button></header>
    ${KM.MEALS.map(
      ([m, l]) => `<div class="km"><span class="km-l">${l}</span><div class="km-list">${es
        .filter((e) => e.meal === m)
        .map(pill)
        .join('')}<button class="km-add" data-act="k-add" data-date="${date}" data-meal="${m}" aria-label="Добави — ${l}">${icon('plus')}</button></div></div>`
    ).join('')}
  </section>`;
}

function weekNav() {
  const s = weekStart();
  const cur = D.startOfWeek(D.today());
  return `<div class="cal-nav"><button class="icon-btn" data-act="k-week" data-n="-1" aria-label="Предишна седмица">${icon('left')}</button>
    <h2>${D.fmtRange(s, D.addDays(s, 6))}</h2>
    <button class="icon-btn" data-act="k-week" data-n="1" aria-label="Следваща седмица">${icon('right')}</button></div>
    ${s !== cur ? `<button class="link-btn k-thisweek" data-act="k-week" data-n="0">Тази седмица</button>` : ''}`;
}

function menuPage() {
  const s = weekStart();
  const days = Array.from({ length: 7 }, (_, i) => D.addDays(s, i));
  const n = plan().filter((e) => e.date >= s && e.date <= days[6]);
  const cookN = days.filter((d) => K().cookDays[d]).length;
  return `<header class="page-head"><h1>Седмично меню</h1><p class="muted">${cookN ? `Готвиш ${cookN} ${cookN === 1 ? 'ден' : 'дни'} · ` : ''}${n.length} ${n.length === 1 ? 'ястие' : 'ястия'}</p></header>
    ${weekNav()}
    <div class="k-fam card"><span>${icon('users')}<span>${familyLine()}</span></span>
      <div class="btn-row"><button class="btn small ghost" data-act="k-family">${icon('users')} Порции</button><button class="btn small ghost" data-act="k-fastset">${icon('leaf')} Моят пост</button></div></div>
    ${days.map(dayCard).join('')}
    <p class="disclaimer">Подреждаш менюто сама. Планерът не измисля ястия и не преценява колко дълго се пази храната.</p>`;
}

// ── покупки ──
function shopWeek() {
  const s = weekStart();
  const w = (K().shop.weeks[s] = K().shop.weeks[s] || { marks: {}, manual: [] });
  return w;
}

function shopData() {
  const s = weekStart();
  const e = D.addDays(s, 6);
  const dishes = plan()
    .filter((x) => x.date >= s && x.date <= e && !x.from)
    .sort((a, b) => a.date.localeCompare(b.date) || MEAL_ORDER[a.meal] - MEAL_ORDER[b.meal]);
  const used = dishes.filter((x) => x.recipeId && recipeById(x.recipeId) && !K().shop.skip[x.id]);
  const res = KM.shoppingList(used, plan(), K().recipes);
  const w = shopWeek();
  const manual = w.manual.map((m) => ({ key: 'm:' + m.id, name: m.name, amount: m.qty || '', manual: true, from: [], notes: [], state: '' }));
  const all = [...res.items, ...manual];
  return { dishes, used, all, warnings: res.warnings, marks: w.marks, s, e };
}

function shopRow(i, mark) {
  return `<div class="si ${mark || ''}">
    <button class="tick ${mark === 'bought' ? 'on' : ''}" data-act="k-mark" data-key="${esc(i.key)}" data-m="bought" aria-label="Купено">${icon('check')}</button>
    <span class="si-t"><b>${esc(i.name)}${i.state ? ` <em>(${esc(i.state)})</em>` : ''}</b>${
      i.from.length ? `<small>за ${i.from.map(esc).join(', ')}${i.notes.length ? ' · ' + i.notes.map(esc).join(', ') : ''}</small>` : i.manual ? '<small>добавено от теб</small>' : ''
    }${i.mixed ? '<small class="warn">отделно — с различна мярка</small>' : ''}</span>
    <span class="si-q">${esc(i.amount || '')}</span>
    <button class="si-have ${mark === 'have' ? 'on' : ''}" data-act="k-mark" data-key="${esc(i.key)}" data-m="have" aria-label="Имам вкъщи">${icon('house')}<small>Имам</small></button>
    ${i.manual ? `<button class="icon-btn small" data-act="k-manual-del" data-key="${esc(i.key)}" aria-label="Махни">${icon('close')}</button>` : ''}
  </div>`;
}

function shopPage() {
  const d = shopData();
  const groups = { buy: [], have: [], bought: [] };
  d.all.forEach((i) => groups[d.marks[i.key] === 'have' ? 'have' : d.marks[i.key] === 'bought' ? 'bought' : 'buy'].push(i));
  const noRec = d.dishes.filter((x) => !x.recipeId || !recipeById(x.recipeId));
  return `<header class="page-head"><h1>Покупки</h1><p class="muted">${groups.buy.length ? `Да купя: <b>${groups.buy.length}</b>` : d.all.length ? 'Всичко е отметнато ✓' : 'Списъкът се прави от менюто'}${groups.bought.length ? ` · Купени: <b>${groups.bought.length}</b>` : ''}</p></header>
    ${weekNav()}
    ${
      d.dishes.length
        ? `<details class="k-dishes card"><summary>${icon('pot')} Ястия в списъка: ${d.used.length} от ${d.dishes.length}</summary>
        ${d.dishes
          .map((x) => {
            const on = !K().shop.skip[x.id] && x.recipeId && recipeById(x.recipeId);
            const kids = kidsOf(x);
            return `<div class="kdish"><button class="tick ${on ? 'on' : ''}" data-act="k-shop-skip" data-id="${x.id}" ${x.recipeId && recipeById(x.recipeId) ? '' : 'disabled'} aria-label="В списъка">${icon('check')}</button>
            <span><b>${esc(titleOf(x))}</b><small>${D.WD_SHORT[D.wdIndex(x.date)]} · ${mealName(x.meal)} · готвиш ${fmtP(KM.cookPortions(x, plan()))}${kids.length ? ` (и за ${kids.length} ${kids.length === 1 ? 'хранене' : 'хранения'})` : ''}${x.recipeId && recipeById(x.recipeId) ? '' : ' · без рецепта'}</small></span></div>`;
          })
          .join('')}
        <p class="muted small">Ястие, сготвено веднъж за няколко хранения, се брои само веднъж — с всичките му порции.</p></details>`
        : `<p class="empty card">Сложи ястия в менюто за тази седмица и списъкът ще се направи сам.</p>`
    }
    ${noRec.length ? `<p class="note">${icon('text')}<span>Без рецепта: ${noRec.map((x) => esc(titleOf(x))).join(', ')}. Добави продуктите им ръчно.</span></p>` : ''}
    ${d.warnings.map((w) => `<p class="note">${icon('sparkle')}<span>${esc(w)}</span></p>`).join('')}
    ${groups.buy.length ? `<section class="shop card"><h3>${icon('basket')} Да купя</h3>${groups.buy.map((i) => shopRow(i)).join('')}</section>` : ''}
    <form class="add-item k-manual" data-form="kman" onsubmit="return false">
      <div class="row2 k-man-row"><input name="mname" placeholder="Добави продукт" maxlength="80" autocomplete="off" data-keep><input name="mqty" placeholder="Колко" maxlength="30" autocomplete="off" data-keep></div>
      <button class="btn ghost wide" data-act="k-manual-add">${icon('plus')} Добави в списъка</button>
    </form>
    ${groups.have.length ? `<section class="shop card muted-card"><h3>${icon('house')} Имам вкъщи</h3>${groups.have.map((i) => shopRow(i, 'have')).join('')}</section>` : ''}
    ${groups.bought.length ? `<section class="shop card muted-card"><h3>${icon('check')} Купено</h3>${groups.bought.map((i) => shopRow(i, 'bought')).join('')}</section>` : ''}
    ${d.all.length ? `<div class="btn-row"><button class="btn ghost" data-act="k-shop-share">${icon('share')} Сподели</button><button class="btn ghost" data-act="k-shop-clear">${icon('redo')} Изчисти отметките</button></div>` : ''}`;
}

// ── изглед ──
export function render() {
  const t = ui.kitchen || 'book';
  const body = t === 'menu' ? menuPage() : t === 'shop' ? shopPage() : bookPage();
  return `<div class="page kitchen">
    <div class="seg seg-corner sticky-seg">
      <button class="${t === 'book' ? 'on' : ''}" data-act="k-tab" data-t="book">${icon('book')} Книга</button>
      <button class="${t === 'menu' ? 'on' : ''}" data-act="k-tab" data-t="menu">${icon('cal')} Меню</button>
      <button class="${t === 'shop' ? 'on' : ''}" data-act="k-tab" data-t="shop">${icon('basket')} Покупки</button>
    </div>
    ${body}
  </div>`;
}

export function afterRender(root) {
  Photos.hydrate(root);
  filterBook(root);
}

// ── за календара ──
export function gridMark(date) {
  const any = plan().some((e) => e.date === date && !e.from);
  if (any) return '<em class="kmark"></em>';
  return K().cookDays[date] ? '<em class="kmark ring"></em>' : '';
}
export const monthHasKitchen = (monthKey) => plan().some((e) => e.date.startsWith(monthKey)) || Object.keys(K().cookDays).some((d) => d.startsWith(monthKey));

function calLabel(e) {
  return e.from ? `${fromLabel(e)}: ${titleOf(e)}` : `Готвя: ${titleOf(e)}`;
}

export function dayBlock(date) {
  const es = entriesOn(date);
  const cook = !!K().cookDays[date];
  if (!es.length && !cook) return '';
  return `<div class="kcal">
    <p class="caps">${icon('pot')} Кухня${cook ? ' · ден за готвене' : ''}</p>
    ${es
      .map((e) => {
        const r = recipeById(e.recipeId);
        return `<div class="kc-row">
        <button class="kc-main" data-act="${r ? 'k-open' : 'k-entry'}" data-id="${r ? r.id : e.id}"><span class="kc-ic">${icon(e.from ? 'redo' : 'pot')}</span>
          <span><b>${esc(calLabel(e))}</b><small>${mealName(e.meal)} · ${fmtP(e.servings)}${e.forMe ? ' · само за мен' : ''}</small></span>${r ? icon('right') : ''}</button>
        <button class="icon-btn small" data-act="k-entry" data-id="${e.id}" aria-label="Премести или промени">${icon('move')}</button>
      </div>`;
      })
      .join('')}
    ${!es.length ? `<p class="muted small">Още няма ястия за този ден.</p>` : ''}
    <button class="link-btn" data-act="k-goto-menu" data-date="${date}">Към менюто</button>
  </div>`;
}

export function weekTags(date) {
  return entriesOn(date)
    .filter((e) => !e.from)
    .map((e) => `<span class="tag tag-k">${icon('pot')}${esc(titleOf(e))}</span>`);
}

// ── листове: добавяне, хранене, преместване ──
let pick = null; // { date, meal, mode, entryId, forMe, scope }

function pickerBody() {
  const fam = K().family;
  const season = KM.seasonOf(pick.date);
  const all = [...K().recipes].sort((a, b) => a.title.localeCompare(b.title, 'bg'));
  const list = all.filter((r) => (pick.scope === 'fav' ? r.fav : pick.scope === 'season' ? !(r.seasons || []).length || r.seasons.includes(season) : true));
  return `<form class="form" data-form="kpick" onsubmit="return false">
    <p class="muted">${D.fmtLong(pick.date)}${pick.mode === 'replace' ? ' · замяна' : ''}</p>
    ${pick.mode === 'add' ? `<div class="field"><span>Хранене</span>${chips('meal', KM.MEALS, pick.meal)}</div>
      <div class="field"><span>За кого</span>${chips('who', [['fam', `Семейството · ${fmtP(KM.familyPortions(fam))}`], ['me', `Само за мен · ${fmtP(KM.myPortion(fam))}`]], pick.forMe ? 'me' : 'fam')}</div>` : ''}
    <div class="filter">${[['season', `${icon(season)}За сезона`], ['fav', '♥ Любими'], ['all', 'Всички']].map(([k, l]) => `<button type="button" class="${pick.scope === k ? 'on' : ''}" data-act="k-pick-scope" data-s="${k}">${l}</button>`).join('')}</div>
    ${all.length > 6 ? `<label class="k-search">${icon('search')}<input type="search" placeholder="Търси" autocomplete="off" data-kpick></label>` : ''}
    <div class="k-picklist">${
      list.length
        ? list.map((r) => `<button type="button" class="kpick ss-${seasonKey(r)}" data-act="k-pick" data-id="${r.id}" data-q="${esc(KM.searchText(r))}"><span class="ss-bar"></span><span><b>${esc(r.title)}</b><small>${(r.cats || []).map((c) => KM.label(KM.CATS, c)).join(' · ') || 'без категория'}</small></span>${r.fav ? icon('heart') : ''}</button>`).join('')
        : `<p class="empty">${all.length ? 'Няма рецепти за този избор.' : 'Книгата ти още е празна.'}</p>`
    }</div>
    ${pick.mode === 'add' ? `<div class="field"><span>Или без рецепта</span><div class="k-free"><input name="free" placeholder="напр. Кисело мляко с плодове" maxlength="80" autocomplete="off"><button type="button" class="btn small primary" data-act="k-pick-free">Добави</button></div></div>` : ''}
  </form>`;
}

function readPick() {
  const form = sheetRoot()?.querySelector('[data-form=kpick]');
  if (!form || pick.mode !== 'add') return;
  const f = formData(form);
  pick.meal = f.meal || pick.meal;
  pick.forMe = f.who === 'me';
}

function openPicker(p) {
  pick = { scope: 'season', forMe: false, ...p };
  openSheet({
    title: p.mode === 'replace' ? 'Замени ястието' : 'Добави ястие',
    cls: 'sheet-tall',
    render: pickerBody,
    onMount: bindPickSearch,
    onRefresh: bindPickSearch,
  });
}
function bindPickSearch(el) {
  const input = el.querySelector('[data-kpick]');
  if (!input) return;
  input.addEventListener('input', () => {
    const words = KM.normTitle(input.value).split(' ').filter(Boolean);
    el.querySelectorAll('.kpick').forEach((b) => (b.hidden = !words.every((w) => b.dataset.q.includes(w))));
  });
}

function addEntry({ date, meal, recipeId = '', title = '', forMe = false }) {
  const fam = K().family;
  const e = { id: uid(), date, meal, recipeId, title, servings: forMe ? KM.myPortion(fam) : KM.familyPortions(fam) || 1, forMe, from: '' };
  plan().push(e);
  return e;
}

let entryId = null;
function entryBody() {
  const e = plan().find((x) => x.id === entryId);
  if (!e) return '<p class="empty">Ястието е махнато от менюто.</p>';
  const r = recipeById(e.recipeId);
  const src = sourceOf(e);
  const kids = kidsOf(e);
  const c = checkFor(e);
  const total = KM.cookPortions(e, plan());
  return `<div class="kentry">
    <p class="caps">${D.fmtLong(e.date)} · ${mealName(e.meal)}</p>
    <h3 class="kentry-t">${esc(titleOf(e))}</h3>
    ${src ? `<p class="muted">${icon('redo')} Приготвено ${D.fmtLong(src.date).toLowerCase()} за ${mealName(src.meal).toLowerCase()}.${src.date > e.date ? ' Внимание: денят на готвене е след това хранене.' : ''}</p>` : ''}
    ${r ? `<button class="btn primary wide" data-act="k-open" data-id="${r.id}">${icon('book')} Отвори рецептата</button>` : '<p class="muted small">Това ястие е без рецепта.</p>'}
    <div class="stepper"><span>Порции за това хранене</span><button class="icon-btn" data-act="k-serv" data-n="-1" aria-label="По-малко">−</button><b>${KM.fmtNum(e.servings)}</b><button class="icon-btn" data-act="k-serv" data-n="1" aria-label="Повече">+</button></div>
    ${!e.from && kids.length ? `<p class="note">${icon('pot')}<span>Готвиш общо <b>${fmtP(total)}</b>: ${KM.fmtNum(e.servings)} за това хранене и ${kids.map((k) => `${KM.fmtNum(k.servings)} за ${D.WD_SHORT[D.wdIndex(k.date)].toLowerCase()} · ${mealName(k.meal).toLowerCase()}`).join(', ')}.</span></p>` : ''}
    <label class="switch"><input type="checkbox" ${e.forMe ? 'checked' : ''} data-change="k-forme"><span></span>Само за мен (постен вариант)</label>
    ${
      c
        ? `<div class="kcheck ${c.ok === true ? 'ok' : c.ok === false ? 'no' : 'unk'}"><b>Постът за мен: ${c.f.name.toLowerCase()}${c.f.period ? ' · ' + esc(c.f.period) : ''}</b><span>${
            c.ok === true ? 'Според отбелязаното в рецептата ястието отговаря на поста.' : c.ok === false ? `Рецептата съдържа: ${c.issues.join(', ')}.` : ''
          }${c.unknown.length ? ` Не е отбелязано: ${c.unknown.join(', ')} — провери рецептата.` : ''}</span></div>`
        : ''
    }
    ${kids.length ? `<div class="field"><span>Предвидено и за</span>${kids.map((k) => `<div class="kkid"><span>${D.fmtLong(k.date)} · ${mealName(k.meal)} · ${fmtP(k.servings)}</span><button class="icon-btn small" data-act="k-del-quiet" data-id="${k.id}" aria-label="Махни">${icon('close')}</button></div>`).join('')}</div>` : ''}
    <div class="btn-grid">
      ${!e.from ? `<button class="btn ghost" data-act="k-left">${icon('redo')} И за друго хранене</button>` : ''}
      <button class="btn ghost" data-act="k-move">${icon('move')} Премести</button>
      ${!e.from ? `<button class="btn ghost" data-act="k-replace">${icon('swap')} Замени</button>` : ''}
      <button class="btn ghost danger-text" data-act="k-del">${icon('trash')} Махни</button>
    </div>
  </div>`;
}
function openEntry(id) {
  entryId = id;
  openSheet({ title: 'Ястие от менюто', render: entryBody });
}

let moveMode = null; // 'move' | 'left'
function moveBody() {
  const e = plan().find((x) => x.id === entryId);
  if (!e) return '<p class="empty">Ястието е махнато.</p>';
  const left = moveMode === 'left';
  const quick = [1, 2, 3].map((n) => D.addDays(e.date, n));
  return `<form class="form" data-form="kmove" onsubmit="return false">
    <p class="muted">${esc(titleOf(e))}${left ? ' — приготвяш го веднъж и го отбелязваш и за друго хранене.' : ''}</p>
    <div class="field"><span>Ден</span><div class="chips">${(left ? [e.date, ...quick] : [e.date, ...quick]).map((d, i) => `<label class="chip"><input type="radio" name="qd" value="${d}" ${i === (left ? 1 : 0) ? 'checked' : ''}><span>${i === 0 ? 'същия ден' : D.WD_SHORT[D.wdIndex(d)] + ' ' + D.dayNum(d)}</span></label>`).join('')}</div>
      <input type="date" name="date" value="" aria-label="Друга дата"><small class="muted">Или избери друга дата.</small></div>
    <div class="field"><span>Хранене</span>${chips('meal', KM.MEALS, left ? (e.meal === 'lunch' ? 'dinner' : 'lunch') : e.meal)}</div>
    ${left ? `<label class="field"><span>Порции</span><input name="serv" inputmode="decimal" value="${KM.fmtNum(e.servings)}"></label><p class="muted small">Планерът не преценява колко дълго се пази ястието — това решаваш ти.</p>` : ''}
    <button class="btn primary wide" data-act="k-move-save">${left ? `${icon('redo')} Добави` : `${icon('move')} Премести`}</button>
  </form>`;
}

// ── семейство и пост ──
const PORTIONS = [
  [1, '1'],
  [0.75, '¾'],
  [0.5, '½'],
  [0.25, '¼'],
];
function familyBody() {
  const fam = K().family;
  return `<div class="kfam">
    <p class="muted">Кой яде от семейните ястия и каква порция. Който не е отбелязан — например бебе на мляко — не се брои.</p>
    ${fam
      .map(
        (m) => `<div class="kmem">
      <div class="kmem-top"><input value="${esc(m.name)}" maxlength="30" data-change="k-fam-name" data-id="${m.id}" aria-label="Име">${m.me ? '<span class="tag">аз</span>' : `<button class="icon-btn small" data-act="k-fam-del" data-id="${m.id}" aria-label="Махни">${icon('trash')}</button>`}</div>
      <div class="kmem-p"><span>Порция</span>${PORTIONS.map(([v, l]) => `<button class="${Number(m.portion) === v ? 'on' : ''}" data-act="k-fam-portion" data-id="${m.id}" data-v="${v}">${l}</button>`).join('')}</div>
      <label class="switch"><input type="checkbox" ${m.eats ? 'checked' : ''} data-change="k-fam-eats" data-id="${m.id}"><span></span>Яде от семейните ястия</label>
    </div>`
      )
      .join('')}
    <button class="btn ghost wide" data-act="k-fam-add">${icon('plus')} Добави член на семейството</button>
    <p class="note">${icon('users')}<span>Семейно ястие: <b>${fmtP(KM.familyPortions(fam))}</b>. Само за мен: <b>${fmtP(KM.myPortion(fam))}</b>. Можеш да промениш порциите на всяко хранене.</span></p>
  </div>`;
}

function fastSetBody() {
  const s = K().fast;
  const sw = (k, l) => `<label class="switch"><input type="checkbox" ${s[k] ? 'checked' : ''} data-change="k-fast-set" data-k="${k}"><span></span>${l}</label>`;
  return `<div class="form">
    ${sw('show', 'Показвай поста в менюто')}
    <p class="muted small">Ястията „само за мен“ се сверяват с постния календар на планера и с отбелязаното в рецептата: месо, риба, яйца, млечни и олио. Ако нещо не е отбелязано, ще видиш „?“ — постно ястие не значи, че става за всеки постен ден.</p>
    <section class="set-block"><h3>${icon('leaf')} Моите облекчения</h3>
      <p class="muted small">Ако по здравословни причини или с благословия постиш по-леко, отбележи го тук. Важи само за проверката в менюто.</p>
      ${sw('oil', 'Олио и вино винаги')}
      ${sw('fish', 'Риба винаги')}
      ${sw('dairy', 'Млечни и яйца винаги')}
      ${sw('noWeekly', 'Не постя в обикновените сряда и петък')}
    </section>
  </div>`;
}

// ── текст за споделяне ──
function shopText() {
  const d = shopData();
  const line = (i) => `${i.name}${i.state ? ` (${i.state})` : ''}${i.amount ? ' — ' + i.amount : ''}`;
  const buy = d.all.filter((i) => !d.marks[i.key]);
  const have = d.all.filter((i) => d.marks[i.key] === 'have');
  return [`Покупки за ${D.fmtRange(d.s, d.e)}`, '', ...buy.map((i) => '☐ ' + line(i)), ...(have.length ? ['', 'Имам вкъщи:', ...have.map((i) => '✓ ' + line(i))] : [])].join('\n');
}

registerActions({
  'k-tab': (el) => {
    ui.kitchen = el.dataset.t;
    saveUi();
    commit();
    window.scrollTo({ top: 0 });
  },
  'k-season': (el) => {
    ui.kSeason = el.dataset.f;
    commit();
  },
  'k-cat': (el) => {
    ui.kCat = el.dataset.f;
    commit();
  },
  'k-open': (el) => openRecipe(el.dataset.id),
  'k-new': () => openEditor(KM.emptyRecipe()),
  'k-import': () => openImport(),
  'k-week': (el) => {
    const n = Number(el.dataset.n);
    ui.kWeek = n === 0 ? D.startOfWeek(D.today()) : D.addDays(weekStart(), 7 * n);
    commit();
  },
  'k-cookday': (el) => {
    const d = el.dataset.date;
    if (K().cookDays[d]) delete K().cookDays[d];
    else K().cookDays[d] = true;
    commit();
  },
  'k-add': (el) => openPicker({ date: el.dataset.date, meal: el.dataset.meal, mode: 'add' }),
  'k-to-menu': (el) => {
    const r = recipeById(el.dataset.id);
    if (!r) return;
    placeId = r.id;
    openSheet({ title: 'Добави в менюто', render: placeBody });
  },
  'k-pick-scope': (el) => {
    readPick();
    pick.scope = el.dataset.s;
    refreshSheet();
  },
  'k-pick': (el) => {
    readPick();
    const r = recipeById(el.dataset.id);
    if (!r) return;
    if (pick.mode === 'replace') {
      const e = plan().find((x) => x.id === pick.entryId);
      if (e) Object.assign(e, { recipeId: r.id, title: r.title });
      closeSheet(true);
      commit();
      toast(`Заменено с „${esc(r.title)}“`);
      return;
    }
    addEntry({ date: pick.date, meal: pick.meal, recipeId: r.id, title: r.title, forMe: pick.forMe });
    closeSheet(true);
    commit();
    toast(`Добавено: ${esc(r.title)} · ${mealName(pick.meal).toLowerCase()}, ${D.WD_SHORT[D.wdIndex(pick.date)].toLowerCase()}`);
  },
  'k-pick-free': () => {
    readPick();
    const v = sheetRoot()?.querySelector('[name=free]')?.value.trim();
    if (!v) return toast('Напиши ястието.');
    addEntry({ date: pick.date, meal: pick.meal, title: v, forMe: pick.forMe });
    closeSheet(true);
    commit();
    toast(`Добавено: ${esc(v)}`);
  },
  'k-entry': (el) => openEntry(el.dataset.id),
  'k-serv': (el) => {
    const e = plan().find((x) => x.id === entryId);
    if (!e) return;
    e.servings = Math.max(0.5, Math.round(((Number(e.servings) || 1) + 0.5 * Number(el.dataset.n)) * 2) / 2);
    commit();
  },
  'k-forme': (el) => {
    const e = plan().find((x) => x.id === entryId);
    if (!e) return;
    e.forMe = el.checked;
    if (e.forMe && e.servings === KM.familyPortions(K().family)) e.servings = KM.myPortion(K().family);
    else if (!e.forMe && e.servings === KM.myPortion(K().family)) e.servings = KM.familyPortions(K().family) || 1;
    commit();
  },
  'k-left': () => {
    moveMode = 'left';
    openSheet({ title: 'И за друго хранене', render: moveBody });
  },
  'k-move': () => {
    moveMode = 'move';
    openSheet({ title: 'Премести', render: moveBody });
  },
  'k-replace': () => {
    const e = plan().find((x) => x.id === entryId);
    if (e) openPicker({ date: e.date, meal: e.meal, mode: 'replace', entryId: e.id });
  },
  'k-move-save': () => {
    const e = plan().find((x) => x.id === entryId);
    const f = formData(sheetRoot().querySelector('[data-form=kmove]'));
    if (!e) return;
    const date = D.isValid(f.date) ? f.date : f.qd;
    if (moveMode === 'left') {
      const serv = Number(String(f.serv || '').replace(',', '.')) || e.servings;
      const k = { id: uid(), date, meal: f.meal, recipeId: e.recipeId, title: e.title || titleOf(e), servings: serv, forMe: e.forMe, from: e.id };
      plan().push(k);
      closeSheet(true);
      commit();
      toast(`Отбелязано и за ${D.WD_SHORT[D.wdIndex(date)].toLowerCase()} · ${mealName(f.meal).toLowerCase()} ✓`);
    } else {
      Object.assign(e, { date, meal: f.meal });
      closeSheet(true);
      commit();
      toast(`Преместено за ${D.fmtLong(date).toLowerCase()} ✓`);
    }
    setTimeout(() => openEntry(e.id), 320);
  },
  'k-del': () => {
    const e = plan().find((x) => x.id === entryId);
    if (!e) return;
    const kids = kidsOf(e);
    const go = () => {
      const ids = new Set([e.id, ...kids.map((k) => k.id)]);
      K().plan = plan().filter((x) => !ids.has(x.id));
      commit();
      toast('Махнато от менюто.');
    };
    if (kids.length) confirmSheet({ title: 'Да махна ли ястието?', text: kids.length === 1 ? 'Ще махна и храненето, за което е предвидено.' : `Ще махна и ${kids.length} хранения, за които е предвидено.`, ok: 'Махни', danger: true, onOk: go });
    else {
      closeSheet(true);
      go();
    }
  },
  'k-del-quiet': (el) => {
    K().plan = plan().filter((x) => x.id !== el.dataset.id);
    commit();
  },
  'k-goto-menu': (el) => {
    ui.tab = 'kitchen';
    ui.kitchen = 'menu';
    ui.kWeek = D.startOfWeek(el.dataset.date);
    saveUi();
    commit();
    requestAnimationFrame(() => document.getElementById('kd-' + el.dataset.date)?.scrollIntoView({ block: 'start', behavior: 'smooth' }));
  },
  // семейство
  'k-family': () => openSheet({ title: 'Семейство и порции', render: familyBody }),
  'k-fam-name': (el) => {
    const m = K().family.find((x) => x.id === el.dataset.id);
    if (m) m.name = el.value.trim() || m.name;
    commit();
  },
  'k-fam-portion': (el) => {
    const m = K().family.find((x) => x.id === el.dataset.id);
    if (m) m.portion = Number(el.dataset.v);
    commit();
  },
  'k-fam-eats': (el) => {
    const m = K().family.find((x) => x.id === el.dataset.id);
    if (m) m.eats = el.checked;
    commit();
  },
  'k-fam-add': () => {
    K().family.push({ id: uid(), name: 'Член на семейството', portion: 1, eats: true });
    commit();
  },
  'k-fam-del': (el) => {
    K().family = K().family.filter((x) => x.id !== el.dataset.id || x.me);
    commit();
  },
  'k-fastset': () => openSheet({ title: 'Моят пост', render: fastSetBody }),
  'k-fast-set': (el) => {
    K().fast[el.dataset.k] = el.checked;
    commit();
  },
  // покупки
  'k-mark': (el) => {
    const w = shopWeek();
    const k = el.dataset.key;
    w.marks[k] = w.marks[k] === el.dataset.m ? undefined : el.dataset.m;
    if (!w.marks[k]) delete w.marks[k];
    commit();
  },
  'k-shop-skip': (el) => {
    const id = el.dataset.id;
    if (K().shop.skip[id]) delete K().shop.skip[id];
    else K().shop.skip[id] = true;
    commit();
  },
  'k-manual-add': () => {
    const form = document.querySelector('[data-form=kman]');
    const f = formData(form);
    if (!f.mname.trim()) return form.querySelector('[name=mname]').focus();
    shopWeek().manual.push({ id: uid(), name: f.mname.trim(), qty: f.mqty.trim() });
    form.querySelectorAll('input').forEach((i) => (i.value = ''));
    commit();
  },
  'k-manual-del': (el) => {
    const w = shopWeek();
    const id = el.dataset.key.slice(2);
    w.manual = w.manual.filter((m) => m.id !== id);
    delete w.marks[el.dataset.key];
    commit();
  },
  'k-shop-clear': () => {
    shopWeek().marks = {};
    commit();
    toast('Отметките са изчистени.');
  },
  'k-shop-share': async () => {
    const text = shopText();
    try {
      if (navigator.share) await navigator.share({ text });
      else {
        await navigator.clipboard.writeText(text);
        toast('Списъкът е копиран ✓');
      }
    } catch (e) {
      if (e && e.name !== 'AbortError') toast('Не можах да споделя списъка.');
    }
  },
  'k-place-save': () => {
    const f = formData(sheetRoot().querySelector('[data-form=kplace]'));
    const r = recipeById(placeId);
    if (!r || !D.isValid(f.date)) return toast('Избери ден.');
    addEntry({ date: f.date, meal: f.meal, recipeId: r.id, title: r.title, forMe: f.who === 'me' });
    closeSheet(true);
    commit();
    toast(`„${esc(r.title)}“ е в менюто за ${D.fmtLong(f.date).toLowerCase()} ✓`);
  },
});

// ── от рецептата към менюто ──
let placeId = null;
function placeBody() {
  const r = recipeById(placeId);
  const fam = K().family;
  const t = D.today();
  const days = Array.from({ length: 7 }, (_, i) => D.addDays(t, i));
  return `<form class="form" data-form="kplace" onsubmit="return false">
    <p class="muted">${esc(r ? r.title : '')}</p>
    <div class="field"><span>Ден</span><div class="chips">${days.map((d, i) => `<label class="chip"><input type="radio" name="qd" value="${d}" ${i === 0 ? 'checked' : ''} data-change="k-place-day"><span>${i === 0 ? 'днес' : D.WD_SHORT[D.wdIndex(d)] + ' ' + D.dayNum(d)}${K().cookDays[d] ? ' · готвя' : ''}</span></label>`).join('')}</div>
      <input type="date" name="date" value="${t}" aria-label="Дата"></div>
    <div class="field"><span>Хранене</span>${chips('meal', KM.MEALS, 'lunch')}</div>
    <div class="field"><span>За кого</span>${chips('who', [['fam', `Семейството · ${fmtP(KM.familyPortions(fam))}`], ['me', `Само за мен · ${fmtP(KM.myPortion(fam))}`]], 'fam')}</div>
    <button class="btn primary wide" data-act="k-place-save">${icon('cal')} Добави в менюто</button>
  </form>`;
}
registerActions({
  'k-place-day': (el) => {
    const input = sheetRoot()?.querySelector('[data-form=kplace] [name=date]');
    if (input) input.value = el.value;
  },
});
