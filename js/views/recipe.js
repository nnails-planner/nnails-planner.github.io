// Моята кухня — страницата на рецептата, редакторът и добавянето от текст.
import * as D from '../dates.js';
import * as KM from '../kitchen-model.js';
import { state, esc, commit, openSheet, closeSheet, refreshSheet, registerActions, getAction, sheetRoot, toast, confirmSheet, chips, formData } from '../ui.js';
import { uid } from '../store.js';
import { icon } from '../icons.js';
import * as Photos from '../photos.js';

export const kitchen = () => state.kitchen;
export const recipeById = (id) => kitchen().recipes.find((r) => r.id === id);

// ── украси ──
export const ORN = `<svg class="orn" viewBox="0 0 140 20" aria-hidden="true"><path d="M2 10h44M94 10h44" stroke="currentColor" stroke-width=".8" stroke-linecap="round" opacity=".45"/><path d="M54 10c4-5 9-7 12.5-6.6-1 3.6-5.6 6.2-12.5 6.6Zm0 0c4 5 9 7 12.5 6.6-1-3.6-5.6-6.2-12.5-6.6Zm32 0c-4-5-9-7-12.5-6.6 1 3.6 5.6 6.2 12.5 6.6Zm0 0c-4 5-9 7-12.5 6.6 1-3.6 5.6-6.2 12.5-6.6Z" fill="currentColor" opacity=".7"/><circle cx="70" cy="10" r="2.4" fill="currentColor"/></svg>`;
const BRANCH = `<svg class="branch" viewBox="0 0 220 120" aria-hidden="true"><path d="M14 104C60 84 108 62 206 18" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>${[
  [40, 92, -30],
  [62, 82, 30],
  [86, 72, -32],
  [108, 61, 28],
  [132, 50, -34],
  [154, 40, 26],
  [178, 30, -30],
]
  .map(([x, y, a]) => `<path d="M0 0c6-9 16-12 24-11-3 9-13 13-24 11Z" transform="translate(${x} ${y}) rotate(${a - 24})" fill="currentColor" opacity="${0.35 + ((x / 10) % 3) * 0.12}"/>`)
  .join('')}<circle cx="206" cy="18" r="3.4" fill="currentColor" opacity=".6"/></svg>`;

export function seasonKey(r) {
  const s = (r && r.seasons) || [];
  if (!s.length || s.length === 4) return 'all';
  const now = KM.seasonOf(D.today());
  return s.includes(now) ? now : s[0];
}
const seasonTags = (r) =>
  (r.seasons || []).length === 4
    ? `<span class="ss-tag ss-all">${icon('sparkle')}целогодишно</span>`
    : (r.seasons || []).map((k) => `<span class="ss-tag ss-${k}">${icon(k)}${KM.label(KM.SEASONS, k).toLowerCase()}</span>`).join('');

// ── страницата на рецептата ──
let view = null; // { id, servings, done: Set, wake }
let lastNote = null;

function ingRows(r, factor) {
  let n = 0;
  return (r.ingredients || [])
    .map((i) => {
      if (i.group) return `<li class="rp-group">${esc(i.group)}</li>`;
      const k = 'i' + n++;
      const done = view && view.done.has(k);
      const q = KM.fmtQty(i, factor);
      return `<li><button type="button" class="rp-ing ${done ? 'done' : ''}" data-act="rp-tick" data-k="${k}">
        <span class="rp-q">${esc(q)}</span>
        <span class="rp-n">${esc(i.name)}${i.state ? ` <em>(${esc(i.state)})</em>` : ''}${i.note ? `<small>${esc(i.note)}</small>` : ''}</span></button></li>`;
    })
    .join('');
}

function stepRows(r) {
  return (r.steps || [])
    .map((s, idx) => {
      const k = 's' + idx;
      const done = view && view.done.has(k);
      const chipsHtml = [
        s.time && `<span class="rp-chip">${icon('timer')}${esc(s.time)}</span>`,
        s.temp && `<span class="rp-chip">${icon('thermo')}${esc(s.temp)}</span>`,
        s.mode && `<span class="rp-chip">${icon('flame')}${esc(s.mode)}</span>`,
      ]
        .filter(Boolean)
        .join('');
      return `<li><button type="button" class="rp-step ${done ? 'done' : ''}" data-act="rp-tick" data-k="${k}">
        <span class="rp-num">${idx + 1}</span>
        <span class="rp-st"><span class="rp-txt">${esc(s.text)}</span>${chipsHtml ? `<span class="rp-chips">${chipsHtml}</span>` : ''}${s.done ? `<span class="rp-ready">${icon('done')}<span><b>Готово, когато:</b> ${esc(s.done)}</span></span>` : ''}</span>
      </button></li>`;
    })
    .join('');
}

const para = (t) => esc(t).replace(/\n/g, '<br>');
const listHtml = (arr) => `<ul class="rp-list">${arr.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>`;

export function recipePage(r, { preview = false } = {}) {
  const base = Number(r.servings) || 0;
  const servings = !preview && view && view.id === r.id && view.servings ? view.servings : base;
  const factor = base ? servings / base : 1;
  const cats = (r.cats || []).map((c) => KM.label(KM.CATS, c)).join(' · ');
  const known = KM.CONTAINS.filter(([k]) => r.contains && r.contains[k] != null);
  const store = [
    ['Съхранение', r.storage],
    ['Претопляне', r.reheat],
    ['Замразяване', r.freeze],
    ['Подготовка предварително', r.ahead],
  ].filter(([, v]) => v);
  const times = [
    ['Подготовка', r.prep],
    ['Готвене', r.cook],
    ['Общо', r.total],
  ].filter(([, v]) => v);
  return `<article class="rp ss-${seasonKey(r)}">
    <div class="rp-hero ${r.photo ? 'has-photo' : ''}">${r.photo ? `<img data-photo="${r.photo}" alt="">` : BRANCH}</div>
    <header class="rp-head">
      ${cats ? `<p class="caps">${esc(cats)}</p>` : ''}
      <h1>${esc(r.title || 'Без име')}</h1>
      ${r.desc ? `<p class="rp-desc">${para(r.desc)}</p>` : ''}
      ${(r.seasons || []).length ? `<div class="rp-seasons">${seasonTags(r)}</div>` : ''}
    </header>
    ${ORN}
    ${
      base || times.length
        ? `<div class="rp-meta">
      ${
        base
          ? `<div class="rp-serv"><small>Порции</small>${
              preview
                ? `<b>${KM.fmtNum(base)}</b>`
                : `<span class="rp-stepper"><button type="button" data-act="rp-serv" data-n="-1" aria-label="По-малко">−</button><b>${KM.fmtNum(servings)}</b><button type="button" data-act="rp-serv" data-n="1" aria-label="Повече">+</button></span>`
            }${r.servingsText ? `<em>${esc(r.servingsText)}</em>` : ''}</div>`
          : ''
      }
      ${times.map(([l, v]) => `<div><small>${l}</small><b>${esc(v)}</b></div>`).join('')}
    </div>`
        : ''
    }
    ${factor !== 1 ? `<p class="rp-scaled">${icon('sparkle')}Количествата са преизчислени за ${KM.fmtNum(servings)} порции.</p>` : ''}
    ${
      known.length
        ? `<div class="rp-contains">${known.map(([k, n]) => `<span class="${r.contains[k] ? 'yes' : 'no'}">${r.contains[k] ? '' : 'без '}${n}</span>`).join('')}</div>`
        : ''
    }
    ${(r.equipment || []).length ? `<section class="rp-sec"><h2>${icon('utensils')}Съдове</h2>${listHtml(r.equipment)}</section>` : ''}
    ${(r.ingredients || []).length ? `<section class="rp-sec rp-paper"><h2>${icon('basket')}Продукти</h2><ul class="rp-ings">${ingRows(r, factor)}</ul>${preview ? '' : '<p class="rp-hint">Докосни продукт, за да го задраскаш.</p>'}</section>` : ''}
    ${(r.steps || []).length ? `<section class="rp-sec"><h2>${icon('pot')}Приготвяне</h2><ol class="rp-steps">${stepRows(r)}</ol></section>` : ''}
    ${(r.secrets || []).length ? `<section class="rp-secrets"><h2>Тайните за добър резултат</h2>${listHtml(r.secrets)}</section>` : ''}
    ${
      (r.swaps || []).length || (r.addons || []).length
        ? `<div class="rp-duo">${(r.swaps || []).length ? `<section class="rp-box"><h3>${icon('swap')}Възможни замени</h3>${listHtml(r.swaps)}</section>` : ''}${(r.addons || []).length ? `<section class="rp-box"><h3>${icon('plus')}Подходящи добавки</h3>${listHtml(r.addons)}</section>` : ''}</div>`
        : ''
    }
    ${r.fast ? `<section class="rp-box rp-fast"><h3>${icon('leaf')}Постен вариант</h3><p>${para(r.fast)}</p></section>` : ''}
    ${store.length ? `<section class="rp-sec"><h2>${icon('house')}Съхранение и подготовка</h2><dl class="rp-store">${store.map(([l, v]) => `<dt>${l}</dt><dd>${para(v)}</dd>`).join('')}</dl></section>` : ''}
    ${preview ? notesPreview(r) : notesBlock(r)}
    ${r.original ? `<details class="rp-orig"><summary>${icon('text')}Оригинален текст</summary><pre>${esc(r.original)}</pre></details>` : ''}
    ${r.unparsed ? `<details class="rp-orig"><summary>${icon('text')}Неразпознат текст</summary><pre>${esc(r.unparsed)}</pre></details>` : ''}
  </article>`;
}

const noteDate = (n) => (n.date ? D.fmtFull(n.date) : 'Бележка');
function notesPreview(r) {
  return (r.notes || []).length ? `<section class="rp-sec"><h2>${icon('edit')}Лични бележки</h2>${r.notes.map((n) => `<p class="rp-note"><small>${noteDate(n)}</small>${para(n.text)}</p>`).join('')}</section>` : '';
}
function notesBlock(r) {
  return `<section class="rp-sec rp-notes"><h2>${icon('edit')}Лични бележки</h2>
    ${(r.notes || [])
      .map((n) => `<div class="rp-note"><small>${noteDate(n)}</small><p>${para(n.text)}</p><button type="button" class="icon-btn small" data-act="rp-note-del" data-nid="${n.id}" aria-label="Изтрий бележката">${icon('close')}</button></div>`)
      .join('')}
    <details class="rp-note-add"${(r.notes || []).length ? '' : ' open'}><summary>${icon('plus')}Бележка след готвене</summary>
      <textarea name="note" rows="3" maxlength="2000" placeholder="Какво се получи, какво да променя следващия път…" data-keep></textarea>
      <button type="button" class="btn small primary" data-act="rp-note-save">Запази бележката</button>
    </details>
  </section>`;
}

function recipeSheet() {
  const r = recipeById(view.id);
  if (!r) return '<p class="empty">Рецептата е изтрита.</p>';
  return `<div class="rp-bar">
      <button class="icon-btn" data-act="sheet-close" aria-label="Затвори">${icon('left')}</button>
      <span></span>
      <button class="icon-btn ${r.fav ? 'fav-on' : ''}" data-act="rp-fav" aria-label="${r.fav ? 'Махни от любими' : 'Любима'}">${icon('heart')}</button>
      <button class="icon-btn" data-act="rp-edit" aria-label="Редактирай">${icon('edit')}</button>
    </div>
    ${recipePage(r)}
    <div class="rp-actions">
      <button class="btn primary wide" data-act="k-to-menu" data-id="${r.id}">${icon('cal')} Добави в менюто</button>
      ${'wakeLock' in navigator ? `<button class="btn ghost wide" data-act="rp-wake">${icon('summer')} ${view.wake ? 'Екранът стои включен ✓' : 'Екранът да не гасне, докато готвя'}</button>` : ''}
      <button class="btn ghost wide" data-act="rp-edit">${icon('edit')} Редактирай рецептата</button>
    </div>`;
}

async function releaseWake() {
  if (view && view.wake) {
    try {
      await view.wake.release();
    } catch {}
    view.wake = null;
  }
}

export function openRecipe(id) {
  const r = recipeById(id);
  if (!r) return toast('Рецептата не е намерена.');
  view = { id, servings: Number(r.servings) || 0, done: new Set(), wake: null };
  openSheet({ cls: 'sheet-full sheet-recipe', title: '', render: recipeSheet, onMount: (el) => Photos.hydrate(el), onRefresh: (el) => Photos.hydrate(el), onClose: releaseWake });
}

// ── редактор ──
let draft = null; // { r, id, added: [], removed: [], banner, preview }

const triChips = (k, v) =>
  `<div class="tri"><span>${KM.label(KM.CONTAINS, k)}</span>${chips('c_' + k, [
    ['', '?'],
    ['no', 'не'],
    ['yes', 'да'],
  ], v === true ? 'yes' : v === false ? 'no' : '', { cls: 'chips-seg' })}</div>`;

const ta = (name, label, value, rows = 3, ph = '', hint = '') =>
  `<label class="field"><span>${label}</span><textarea name="${name}" rows="${rows}" placeholder="${esc(ph)}">${esc(value || '')}</textarea>${hint ? `<small class="muted">${hint}</small>` : ''}</label>`;

function photoField() {
  const p = draft.r.photo;
  return `<div class="field"><span>Снимка (по желание)</span><div class="photos rp-photo">${
    p ? `<span class="ph"><img data-photo="${p}" alt=""><button type="button" data-act="rp-photo-del" aria-label="Махни снимката">${icon('close')}</button></span>` : `<label class="ph ph-add">${icon('camera')}<span>Снимка</span><input type="file" accept="image/*" data-change="rp-photo-add"></label>`
  }</div></div>`;
}

function editorForm() {
  const r = draft.r;
  return `<form class="form rp-form" data-form="recipe" onsubmit="return false">
    ${draft.banner || ''}
    <label class="field"><span>Име</span><input name="title" value="${esc(r.title)}" maxlength="140" autocomplete="off" placeholder="напр. Леща яхния"></label>
    ${ta('desc', 'Кратко описание', r.desc, 2)}
    <div class="field"><span>Сезони</span>${chips('seasons', KM.SEASONS, r.seasons, { multi: true })}</div>
    <div class="field"><span>Категории</span>${chips('cats', KM.CATS, r.cats, { multi: true })}</div>
    <div class="row3">
      <label class="field"><span>Порции</span><input name="servings" inputmode="decimal" value="${r.servings ?? ''}" maxlength="6"></label>
      <label class="field"><span>Подготовка</span><input name="prep" value="${esc(r.prep)}" maxlength="40" placeholder="15 мин"></label>
      <label class="field"><span>Готвене</span><input name="cook" value="${esc(r.cook)}" maxlength="40" placeholder="40 мин"></label>
    </div>
    ${r.servingsText ? `<label class="field"><span>Порции — както е в рецептата</span><input name="servingsText" value="${esc(r.servingsText)}" maxlength="60"></label>` : '<input type="hidden" name="servingsText" value="">'}
    ${r.total ? `<label class="field"><span>Общо време</span><input name="total" value="${esc(r.total)}" maxlength="40"></label>` : '<input type="hidden" name="total" value="">'}
    ${ta('equipment', 'Съдове и размери', (r.equipment || []).join('\n'), 2, 'Тава 25×35 см\nТенджера 3 л', 'По един на ред.')}
    ${ta('ingredients', 'Продукти', (r.ingredients || []).map(KM.ingredientToText).join('\n'), 7, '250 г леща (сурова)\n1 глава лук, нарязан\nсол, на вкус', 'По един на ред: количество, мярка, продукт и в скоби — суров, сварен, отцеден. Група: ред с двоеточие накрая, напр. „За плънката:“.')}
    <div class="rp-parsed" id="rp-parsed"></div>
    ${ta('steps', 'Стъпки', KM.stepsToText(r.steps), 8, '1. Измий лещата.\nВреме: 5 мин\n2. Запечи.\nТемпература: 180°C\nРежим на фурната: с вентилатор\nГотово, когато: е златиста', 'Номерирай стъпките. Под стъпката по желание: „Време:“, „Температура:“, „Режим на фурната:“, „Готово, когато:“.')}
    ${ta('secrets', 'Тайните за добър резултат', (r.secrets || []).join('\n'), 3, '', 'По една тайна на ред.')}
    ${ta('swaps', 'Възможни замени', (r.swaps || []).join('\n'), 2)}
    ${ta('addons', 'Подходящи добавки', (r.addons || []).join('\n'), 2)}
    ${ta('fast', 'Постен вариант', r.fast, 2)}
    <div class="field"><span>Съдържа</span><div class="tris">${KM.CONTAINS.map(([k]) => triChips(k, r.contains && r.contains[k])).join('')}</div><small class="muted">„?“ значи, че не е отбелязано. Така планерът няма да приеме ястието за постно, без да е сигурно.</small></div>
    ${ta('storage', 'Съхранение', r.storage, 2)}
    ${ta('reheat', 'Претопляне', r.reheat, 2)}
    ${ta('freeze', 'Замразяване', r.freeze, 2)}
    ${ta('ahead', 'Подготовка предварително', r.ahead, 2)}
    ${photoField()}
    ${r.unparsed ? ta('unparsed', 'Неразпознат текст — премести го, където трябва', r.unparsed, 4) : '<input type="hidden" name="unparsed" value="">'}
    <details class="field rp-orig-edit"><summary>${icon('text')} Оригинален текст</summary><textarea name="original" rows="6">${esc(r.original || '')}</textarea></details>
  </form>`;
}

function editorBody() {
  return `<div class="rp-editor">
    <div class="seg"><button class="${draft.preview ? '' : 'on'}" data-act="rp-mode" data-m="edit">${icon('edit')} Попълване</button><button class="${draft.preview ? 'on' : ''}" data-act="rp-mode" data-m="preview">${icon('book')} Преглед</button></div>
    <div id="rp-edit-pane" ${draft.preview ? 'hidden' : ''}>${editorForm()}</div>
    <div id="rp-prev-pane" ${draft.preview ? '' : 'hidden'}></div>
    <div class="rp-save">
      <button class="btn primary wide" data-act="rp-save">${icon('check')} ${draft.id ? 'Запази промените' : 'Запази в книгата'}</button>
      ${draft.id ? `<button class="btn ghost danger-text wide" data-act="rp-del">${icon('trash')} Изтрий рецептата</button>` : ''}
    </div>
  </div>`;
}

function readEditor() {
  const form = sheetRoot()?.querySelector('[data-form=recipe]');
  if (!form) return draft.r;
  const f = formData(form);
  const sv = String(f.servings || '').replace(',', '.').match(/\d+(?:\.\d+)?/);
  const contains = {};
  KM.CONTAINS.forEach(([k]) => {
    if (f['c_' + k] === 'yes') contains[k] = true;
    else if (f['c_' + k] === 'no') contains[k] = false;
  });
  return {
    ...draft.r,
    title: f.title.trim(),
    desc: f.desc.trim(),
    seasons: f.seasons || [],
    cats: f.cats || [],
    servings: sv ? Number(sv[0]) : null,
    servingsText: (f.servingsText || '').trim(),
    prep: f.prep.trim(),
    cook: f.cook.trim(),
    total: (f.total || '').trim(),
    equipment: KM.listFromText(f.equipment),
    ingredients: KM.parseIngredients(f.ingredients),
    steps: KM.parseSteps(f.steps),
    secrets: KM.listFromText(f.secrets),
    swaps: KM.listFromText(f.swaps),
    addons: KM.listFromText(f.addons),
    fast: f.fast.trim(),
    contains,
    storage: f.storage.trim(),
    reheat: f.reheat.trim(),
    freeze: f.freeze.trim(),
    ahead: f.ahead.trim(),
    unparsed: (f.unparsed || '').trim(),
    original: (f.original || '').trim(),
  };
}

function showParsed() {
  const box = document.getElementById('rp-parsed');
  const area = sheetRoot()?.querySelector('[name=ingredients]');
  if (!box || !area) return;
  const ings = KM.parseIngredients(area.value);
  const items = ings.filter((i) => !i.group);
  if (!items.length) {
    box.innerHTML = '';
    return;
  }
  box.innerHTML = `<p class="caps">Така ги разпознах</p>${ings
    .map((i) =>
      i.group
        ? `<span class="pg">${esc(i.group)}</span>`
        : `<span class="pi ${i.qty == null ? 'noq' : ''}"><b>${esc(KM.fmtQty(i) || 'без количество')}</b> ${esc(i.name)}${i.state ? ` <em>(${esc(i.state)})</em>` : ''}</span>`
    )
    .join('')}`;
}

export function openEditor(r, { id = '', banner = '' } = {}) {
  draft = { r: { ...KM.emptyRecipe(), ...JSON.parse(JSON.stringify(r)) }, id, added: [], removed: [], banner, preview: false };
  openSheet({
    title: id ? 'Редакция' : 'Нова рецепта',
    cls: 'sheet-tall',
    body: editorBody(),
    onMount: (el) => {
      Photos.hydrate(el);
      showParsed();
      el.querySelector('[name=ingredients]')?.addEventListener('input', showParsed);
    },
    onClose: () => {
      draft?.added.forEach((p) => Photos.delPhoto(p).catch(() => {}));
      draft = null;
    },
  });
}

function bannerFor(r, dup) {
  const s = KM.summary(r);
  const bits = [`${s.ingredients} продукта${s.noQty ? ` (${s.noQty} без количество)` : ''}`, `${s.steps} стъпки`];
  return `<div class="rp-banner">
    <p>${icon('sparkle')}<span>Разпознах ${bits.join(', ')}. Провери полетата и поправи, ако трябва. Натисни „Преглед“, за да видиш страницата.</span></p>
    ${dup ? `<p class="warn">${icon('copy')}<span>Подобна рецепта вече има: „${esc(dup.title)}“. Ако е същата, не я записвай втори път.</span></p>` : ''}
    ${s.unparsed ? `<p class="warn">${icon('text')}<span>${s.unparsed} ${s.unparsed === 1 ? 'ред не разпознах' : 'реда не разпознах'} — пазя ги в „Неразпознат текст“ най-долу.</span></p>` : ''}
  </div>`;
}

// ── добавяне от текст ──
export const GEMINI = `Здравей! Ще ти изпратя една или няколко рецепти. Препиши всяка рецепта точно по образеца по-долу, за да я внеса в планера си.

Правила:
1. Не измисляй нищо. Ако в рецептата липсва количество, време, температура, брой порции, съд или друга подробност, остави полето празно.
2. Всеки продукт е на отделен ред и започва с тире: количество, мерна единица, продукт. В скоби напиши дали е измерен суров, сварен, отцеден, накиснат и т.н. — само ако е посочено. Пример: „- 250 г леща (сурова)“. Без количество: „- сол, на вкус“.
3. Използвай тези мерни единици: г, кг, мл, л, с.л., ч.л., к.л., ч.ч., бр., щипка, скилидка, връзка, стрък, пакет, консерва, глава.
4. Ако продуктите са на групи, напиши името на групата на отделен ред, който завършва с двоеточие, например „За плънката:“.
5. Стъпките са номерирани. Под всяка стъпка добави само посочените в рецептата редове „Време:“, „Температура:“, „Режим на фурната:“ и „Готово, когато:“.
6. Сезони: пролет, лято, есен, зима. Категории: закуски, супи, основни, салати, следобедни закуски, десерти. Ако не е ясно, остави празно.
7. „Съдържа:“ попълни с „да“ или „не“ само ако личи от продуктите.
8. „Лични бележки:“ остави празно, освен ако в разговора има мои бележки за рецептата.
9. Под „Оригинален текст:“ копирай рецептата дословно, както е в нашия разговор, за да не се изгуби нищо.
10. Всяка рецепта започва с ред „=== РЕЦЕПТА ===“ и завършва с ред „=== КРАЙ ===“. Без удебелен текст, таблици и емоджита.

Образец:
=== РЕЦЕПТА ===
Име:
Кратко описание:
Сезони:
Категории:
Порции:
Подготовка:
Готвене:

Съдове:
-

Продукти:
-

Стъпки:
1.
Време:
Температура:
Режим на фурната:
Готово, когато:

Тайните за добър резултат:
-

Замени:
-

Подходящи добавки:
-

Постен вариант:

Съдържа: месо – ; риба – ; яйца – ; млечни – ; олио –

Съхранение:
Претопляне:
Замразяване:
Подготовка предварително:

Лични бележки:

Оригинален текст:
=== КРАЙ ===`;

function importBody() {
  return `<div class="form rp-import">
    <p class="lead">Постави една или няколко рецепти, написани по образеца. Планерът ги разпределя в полетата и ти показва преглед, преди да ги запише.</p>
    <div class="rp-gem">
      <p><b>Рецепти от Gemini</b><small>Изпрати на Gemini този текст заедно с рецептите. Той ги подрежда по образеца, без да измисля количества.</small></p>
      <div class="btn-row"><button class="btn small ghost" data-act="rp-gemini-copy">${icon('copy')} Копирай</button>${navigator.share ? `<button class="btn small ghost" data-act="rp-gemini-share">${icon('share')} Сподели</button>` : `<button class="btn small ghost" data-act="rp-gemini-show">${icon('text')} Покажи</button>`}</div>
    </div>
    <label class="field"><span>Текст на рецептата</span><textarea name="paste" rows="10" placeholder="=== РЕЦЕПТА ===\nИме: …" data-keep></textarea></label>
    <label class="btn ghost wide">${icon('file')} Зареди от файл (.txt)<input type="file" accept=".txt,text/plain" data-change="rp-import-file" hidden></label>
    <button class="btn primary wide" data-act="rp-parse">${icon('sparkle')} Разпознай</button>
    <p class="muted small">Внасянето само добавя. Нищо от книгата ти не се изтрива.</p>
  </div>`;
}

export function openImport() {
  openSheet({ title: 'Добави от текст', cls: 'sheet-tall', body: importBody() });
}

let bulk = null; // [{ r, dup, sel }]
function bulkBody() {
  const sel = bulk.filter((b) => b.sel).length;
  return `<div class="rp-bulk">
    <p class="lead">Намерих ${bulk.length} рецепти. Отметнатите ще влязат в твоята книга. Подобните на вече записани не са отметнати.</p>
    ${bulk
      .map((b, i) => {
        const s = KM.summary(b.r);
        return `<div class="rb ${b.sel ? 'on' : ''}">
        <button type="button" class="tick ${b.sel ? 'on' : ''}" data-act="rp-bulk-sel" data-i="${i}" aria-label="Внеси">${icon('check')}</button>
        <div class="rb-body"><b>${esc(b.r.title || 'Без име')}</b>
          <small>${s.ingredients} продукта${s.noQty ? ` (${s.noQty} без количество)` : ''} · ${s.steps} стъпки${b.r.servings ? ` · ${KM.fmtNum(b.r.servings)} порции` : ' · без порции'}</small>
          ${b.dup ? `<small class="warn">Подобна вече има: „${esc(b.dup.title)}“</small>` : ''}
          ${s.unparsed ? `<small class="warn">${s.unparsed} неразпознати реда — запазени в рецептата</small>` : ''}
          <details><summary>Виж</summary>${recipePage(b.r, { preview: true })}</details>
        </div></div>`;
      })
      .join('')}
    <button class="btn primary wide" data-act="rp-bulk-import" ${sel ? '' : 'disabled'}>${icon('book')} Внеси ${sel} ${sel === 1 ? 'рецепта' : 'рецепти'}</button>
  </div>`;
}

function saveNewRecipe(r) {
  const now = new Date().toISOString();
  const rec = { ...KM.emptyRecipe(), ...r, id: uid(), created: now, updated: now };
  kitchen().recipes.push(rec);
  return rec;
}

registerActions({
  'rp-tick': (el) => {
    if (!view) return;
    const k = el.dataset.k;
    view.done.has(k) ? view.done.delete(k) : view.done.add(k);
    el.classList.toggle('done', view.done.has(k));
  },
  'rp-serv': (el) => {
    const r = view && recipeById(view.id);
    if (!r) return;
    const base = Number(r.servings) || 1;
    const step = base >= 4 ? 1 : 0.5;
    view.servings = Math.max(step, Math.round(((view.servings || base) + step * Number(el.dataset.n)) * 2) / 2);
    refreshSheet();
  },
  'rp-fav': () => {
    const r = recipeById(view.id);
    if (!r) return;
    r.fav = !r.fav;
    commit();
    toast(r.fav ? 'Добавена в любими ♥' : 'Махната от любими');
  },
  'rp-wake': async () => {
    if (!view) return;
    if (view.wake) {
      await releaseWake();
    } else {
      try {
        view.wake = await navigator.wakeLock.request('screen');
        view.wake.addEventListener?.('release', () => {
          if (view) view.wake = null;
        });
      } catch {
        toast('Телефонът не позволи екранът да стои включен.');
      }
    }
    refreshSheet();
  },
  'rp-note-save': () => {
    const r = recipeById(view.id);
    const area = sheetRoot()?.querySelector('.rp-note-add textarea');
    const text = area && area.value.trim();
    if (!r || !text) return toast('Напиши бележката.');
    r.notes = [...(r.notes || []), { id: uid(), date: D.today(), text }];
    area.value = '';
    commit();
    toast('Бележката е записана ✓');
  },
  'rp-note-del': (el) => {
    const r = recipeById(view.id);
    if (!r) return;
    const n = (r.notes || []).find((x) => x.id === el.dataset.nid);
    r.notes = (r.notes || []).filter((x) => x.id !== el.dataset.nid);
    lastNote = { rid: r.id, n };
    commit();
    toast('Бележката е изтрита <button class="toast-btn" data-act="rp-note-undo">Върни</button>');
  },
  'rp-note-undo': () => {
    const r = lastNote && recipeById(lastNote.rid);
    if (!r) return;
    r.notes = [...(r.notes || []), lastNote.n].sort((a, b) => (a.date || '').localeCompare(b.date || ''));
    lastNote = null;
    commit();
  },
  'rp-edit': () => {
    const r = recipeById(view.id);
    if (r) openEditor(r, { id: r.id });
  },
  'rp-mode': (el) => {
    if (!draft) return;
    const toPreview = el.dataset.m === 'preview';
    if (toPreview) draft.r = readEditor();
    draft.preview = toPreview;
    const root = sheetRoot();
    root.querySelector('#rp-edit-pane').hidden = toPreview;
    const pv = root.querySelector('#rp-prev-pane');
    pv.hidden = !toPreview;
    pv.innerHTML = toPreview ? recipePage(draft.r, { preview: true }) : '';
    if (toPreview) Photos.hydrate(pv);
    root.querySelectorAll('.rp-editor > .seg button').forEach((b) => b.classList.toggle('on', b === el));
    root.querySelector('.sheet-body').scrollTop = 0;
  },
  'rp-photo-add': async (el) => {
    const file = el.files && el.files[0];
    el.value = '';
    if (!file || !draft) return;
    const d = draft;
    try {
      const blob = await Photos.compress(file);
      const id = 'ph_' + uid();
      await Photos.putPhoto(id, blob);
      if (draft !== d) return Photos.delPhoto(id).catch(() => {});
      if (d.r.photo) (d.added.includes(d.r.photo) ? Photos.delPhoto(d.r.photo).catch(() => {}) : d.removed.push(d.r.photo));
      d.added.push(id);
      d.r.photo = id;
      const box = sheetRoot().querySelector('.rp-photo').closest('.field');
      box.outerHTML = photoField();
      Photos.hydrate(sheetRoot());
    } catch {
      toast('Тази снимка не можа да се добави.');
    }
  },
  'rp-photo-del': () => {
    if (!draft || !draft.r.photo) return;
    const p = draft.r.photo;
    if (draft.added.includes(p)) {
      draft.added = draft.added.filter((x) => x !== p);
      Photos.delPhoto(p).catch(() => {});
    } else draft.removed.push(p);
    draft.r.photo = '';
    sheetRoot().querySelector('.rp-photo').closest('.field').outerHTML = photoField();
  },
  'rp-save': () => {
    if (!draft) return;
    const r = draft.preview ? draft.r : readEditor();
    if (!r.title) {
      if (draft.preview) sheetRoot().querySelector('[data-m=edit]')?.click();
      toast('Напиши името на рецептата.');
      sheetRoot()?.querySelector('[name=title]')?.focus();
      return;
    }
    let saved;
    if (draft.id) {
      saved = recipeById(draft.id);
      Object.assign(saved, r, { updated: new Date().toISOString() });
    } else saved = saveNewRecipe(r);
    draft.removed.forEach((p) => Photos.delPhoto(p).catch(() => {}));
    draft.added = [];
    draft = null;
    closeSheet(true);
    commit();
    toast('Рецептата е в книгата ✓');
    setTimeout(() => openRecipe(saved.id), 320);
  },
  'rp-del': () => {
    const id = draft && draft.id;
    if (!id) return;
    const r = recipeById(id);
    const uses = kitchen().plan.filter((e) => e.recipeId === id).length;
    confirmSheet({
      title: 'Да изтрия ли рецептата?',
      text: `„${esc(r.title)}“ ще изчезне от книгата.${uses ? ` В менюто е ${uses} ${uses === 1 ? 'път' : 'пъти'} — там ще остане само името.` : ''}`,
      ok: 'Изтрий',
      danger: true,
      onOk: () => {
        if (r.photo) Photos.delPhoto(r.photo).catch(() => {});
        kitchen().plan.forEach((e) => {
          if (e.recipeId === id) {
            e.title = e.title || r.title;
            e.recipeId = '';
          }
        });
        kitchen().recipes = kitchen().recipes.filter((x) => x.id !== id);
        commit();
        toast('Рецептата е изтрита.');
      },
    });
  },
  'rp-gemini-copy': async () => {
    try {
      await navigator.clipboard.writeText(GEMINI);
      toast('Текстът за Gemini е копиран ✓ Постави го в разговора с рецептите.');
    } catch {
      getAction('rp-gemini-show')();
    }
  },
  'rp-gemini-share': async () => {
    try {
      await navigator.share({ text: GEMINI });
    } catch {}
  },
  'rp-gemini-show': () => {
    openSheet({ title: 'Текст за Gemini', cls: 'sheet-tall', body: `<p class="muted small">Задръж върху текста, избери „Избери всичко“ и „Копирай“.</p><textarea class="rp-gem-text" readonly rows="18">${esc(GEMINI)}</textarea><button class="btn ghost wide" data-act="k-import">${icon('left')} Обратно към добавянето</button>` });
  },
  'rp-import-file': async (el) => {
    const file = el.files && el.files[0];
    el.value = '';
    if (!file) return;
    const text = await file.text();
    const area = sheetRoot()?.querySelector('[name=paste]');
    if (area) area.value = text;
    toast('Файлът е зареден. Натисни „Разпознай“.');
  },
  'rp-parse': () => {
    const text = sheetRoot()?.querySelector('[name=paste]')?.value || '';
    const blocks = KM.splitRecipes(text);
    if (!blocks.length) return toast('Постави текста на рецептата.');
    const all = kitchen().recipes;
    if (blocks.length === 1) {
      const r = KM.parseRecipe(blocks[0]);
      openEditor(r, { banner: bannerFor(r, KM.findDuplicate(r, all)) });
      return;
    }
    const parsed = blocks.map((b) => KM.parseRecipe(b));
    bulk = parsed.map((r, i) => {
      const dup = KM.findDuplicate(r, all) || KM.findDuplicate(r, parsed.slice(0, i).map((x, j) => ({ ...x, id: 'b' + j })));
      return { r, dup, sel: !dup && !!r.title };
    });
    openSheet({ title: 'Преглед преди внасяне', cls: 'sheet-tall', render: bulkBody });
  },
  'rp-bulk-sel': (el) => {
    const b = bulk && bulk[Number(el.dataset.i)];
    if (!b) return;
    b.sel = !b.sel;
    refreshSheet();
  },
  'rp-bulk-import': () => {
    if (!bulk) return;
    const pick = bulk.filter((b) => b.sel);
    pick.forEach((b) => saveNewRecipe({ ...b.r, title: b.r.title || 'Без име' }));
    bulk = null;
    closeSheet(true);
    commit();
    toast(`Внесох ${pick.length} ${pick.length === 1 ? 'рецепта' : 'рецепти'} в книгата ти ✓`);
  },
});

