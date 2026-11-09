// Дневник на сънищата: какво сънувах и как спах.
// Живее само в „Кътче“, в раздел „Сънища“.
import * as D from '../dates.js';
import { state, ui, esc, commit, openSheet, closeSheet, registerActions, formData, sheetRoot, toast, confirmSheet, chips, saveUi } from '../ui.js';
import { uid } from '../store.js';
import { icon } from '../icons.js';

export const DREAM_KINDS = [
  ['nice', '✨ Хубав'],
  ['calm', '🌙 Спокоен'],
  ['strange', '🌀 Странен'],
  ['scary', '😰 Кошмар'],
  ['repeat', '🔁 Повтаря се'],
  ['lucid', '💡 Знаех, че сънувам'],
];
export const SLEEP = [
  ['great', '😴 Отлично'],
  ['good', '🙂 Добре'],
  ['ok', '😐 Горе-долу'],
  ['bad', '😣 Лошо'],
];
const KIND_EMO = Object.fromEntries(DREAM_KINDS.map(([k, l]) => [k, l.split(' ')[0]]));
const SLEEP_TEXT = { great: '😴 спах отлично', good: '🙂 спах добре', ok: '😐 спах горе-долу', bad: '😣 спах лошо' };
const FILTERS = [
  ['all', 'Всички'],
  ['nice', '✨ Хубави'],
  ['scary', '😰 Кошмари'],
  ['repeat', '🔁 Повтарящи се'],
];

function headline(d) {
  if (d.title) return d.title;
  const first = (d.text || '').split('\n')[0].trim();
  if (first) return first.length > 60 ? first.slice(0, 58).trimEnd() + '…' : first;
  return 'Не помня какво сънувах';
}

function dreamCard(d) {
  const meta = [];
  const emo = (d.kinds || []).map((k) => KIND_EMO[k]).filter(Boolean).join(' ');
  if (emo) meta.push(`<span class="dream-emo">${emo}</span>`);
  if (d.sleep) meta.push(`<span class="tag">${SLEEP_TEXT[d.sleep]}</span>`);
  const showText = d.title && d.text;
  return `<button class="card dream" data-act="dream-edit" data-id="${d.id}">
    <span class="dream-date"><b>${D.dayNum(d.date)}</b><small>${D.MONTHS_SHORT[D.monthIdx(d.date)]}</small></span>
    <span class="dream-body"><b>${esc(headline(d))}</b>${showText ? `<em>${esc(d.text)}</em>` : ''}
      ${meta.length ? `<span class="dream-meta">${meta.join('')}</span>` : ''}</span>
  </button>`;
}

export function dreamsPage() {
  const all = [...state.dreams].sort((a, b) => b.date.localeCompare(a.date) || (b.added || '').localeCompare(a.added || ''));
  const f = ui.dreamFilter || 'all';
  const list = all.filter((d) => f === 'all' || (d.kinds || []).includes(f));
  const thisMonth = all.filter((d) => D.monthKey(d.date) === D.monthKey(D.today())).length;
  return `<figure class="banner"><img src="img/dreams.svg" alt="" width="960" height="536"></figure>
    <header class="page-head"><h1>Дневник на сънищата</h1><p class="muted">Записани: <b>${all.length}</b> · Този месец: <b>${thisMonth}</b></p></header>
    ${
      all.length
        ? `<div class="filter">${FILTERS.map(([k, l]) => `<button class="${f === k ? 'on' : ''}" data-act="dream-filter" data-f="${k}">${l}</button>`).join('')}</div>`
        : ''
    }
    <div class="list">${
      list.length
        ? list.map(dreamCard).join('')
        : all.length
          ? `<p class="empty card">Тук още няма такива сънища.</p>`
          : `<div class="card dream-tip">${icon('moon')}<p>Казват, че сънят от четвъртък срещу петък се сбъдва, а лошият сън се разказва на течаща вода, за да отплува надалеч. Сънищата са малки приказки, които душата ти разказва нощем. Запиши своята веднага щом станеш. С времето ще откриеш кои приказки се повтарят.</p></div>`
    }</div>
    <button class="btn primary wide" data-act="dream-new">${icon('plus')} Запиши сън</button>`;
}

function dreamForm(d) {
  return `<form class="form" data-form="dream" onsubmit="return false">
    <label class="field"><span>Дата</span><input type="date" name="date" value="${d.date || D.today()}"></label>
    <label class="field"><span>Заглавие (по желание)</span><input name="title" value="${esc(d.title || '')}" maxlength="80" placeholder="напр. Летях над морето" autocomplete="off"></label>
    <div class="field"><div class="field-head"><label for="dream-text">Какво сънувах</label>${
      canDictate() ? `<button type="button" class="mic-btn" data-act="dream-mic">${icon('mic')}<span>Диктувай</span></button>` : ''
    }</div><textarea id="dream-text" name="text" rows="6" maxlength="4000" placeholder="Хора, места, цветове, какво почувства…">${esc(d.text || '')}</textarea></div>
    <div class="field"><span>Какъв беше сънят</span>${chips('kinds', DREAM_KINDS, d.kinds || [], { multi: true })}</div>
    <div class="field"><span>Как спах</span>${chips('sleep', SLEEP, d.sleep || '')}</div>
    <button class="btn primary wide" data-act="dream-save" data-id="${d.id || ''}">Запази</button>
    ${d.id ? `<button class="btn ghost danger-text wide" data-act="dream-del" data-id="${d.id}">${icon('trash')} Изтрий</button>` : ''}
  </form>`;
}

export function openDream(d) {
  openSheet({ title: d.id ? 'Сън' : `${D.fmtShort(d.date || D.today())} · Нов сън`, body: dreamForm(d), onClose: stopDictation });
}

// ── диктуване ──
// Работи там, където браузърът разпознава български (Chrome на Android).
// На iPhone Apple не го позволява в приложения от началния екран, затова там бутонът не се показва.
const SR = () => window.SpeechRecognition || window.webkitSpeechRecognition;
const isApple = () => /Apple/.test(navigator.vendor || '') || /iPad|iPhone|iPod/.test(navigator.userAgent);
export const canDictate = () => !!SR() && !isApple();

let rec = null;
const MIC_ERRORS = {
  'not-allowed': 'Планерът няма достъп до микрофона. Разреши го, когато телефонът те попита, или от настройките на браузъра.',
  'service-not-allowed': 'На този телефон диктуването не е разрешено. Можеш да пишеш с клавиатурата.',
  'language-not-supported': 'Този телефон не може да диктува на български. Можеш да пишеш с клавиатурата.',
  'no-speech': 'Не те чух. Натисни „Диктувай“ и опитай пак.',
  'audio-capture': 'Не намирам микрофон на телефона.',
  network: 'За диктуване трябва интернет.',
};

function micUi(on) {
  const root = sheetRoot();
  const btn = root && root.querySelector('.mic-btn');
  if (btn) {
    btn.classList.toggle('on', on);
    btn.innerHTML = on ? `<i class="mic-dot"></i><span>Слушам… Спри</span>` : `${icon('mic')}<span>Диктувай</span>`;
  }
  root?.querySelector('[name=text]')?.classList.toggle('listening', on);
}

function stopDictation() {
  const r = rec;
  rec = null;
  if (r) {
    try {
      r.abort();
    } catch (e) {}
  }
  micUi(false);
}

// Някои телефони повтарят вече казаното в следващия резултат („летях“, „летях над морето“).
function addPart(list, t) {
  const last = list[list.length - 1];
  if (last && t.toLowerCase().startsWith(last.toLowerCase())) list[list.length - 1] = t;
  else list.push(t);
}

function startDictation() {
  const Rec = SR();
  const ta = sheetRoot()?.querySelector('[data-form=dream] [name=text]');
  if (!Rec || !ta) return;
  const r = new Rec();
  r.lang = 'bg-BG';
  r.continuous = true;
  r.interimResults = true;
  const before = ta.value.replace(/\s+$/, '');
  const capital = !before || /[.!?…]$/.test(before);
  r.onresult = (e) => {
    if (rec !== r) return;
    const parts = [];
    let interim = '';
    for (const res of e.results) {
      const t = res[0].transcript.trim();
      if (!t) continue;
      if (res.isFinal) addPart(parts, t);
      else interim = t;
    }
    if (interim) addPart(parts, interim);
    let said = parts.join(' ');
    if (capital) said = said.charAt(0).toUpperCase() + said.slice(1);
    ta.value = ((before ? before + ' ' : '') + said).slice(0, 4000);
    ta.scrollTop = ta.scrollHeight;
  };
  r.onerror = (e) => {
    if (rec !== r) return;
    if (MIC_ERRORS[e.error]) toast(MIC_ERRORS[e.error]);
  };
  r.onend = () => {
    if (rec !== r) return;
    rec = null;
    micUi(false);
  };
  try {
    r.start();
  } catch (e) {
    toast('Диктуването не тръгна. Опитай пак.');
    return;
  }
  rec = r;
  micUi(true);
}

registerActions({
  'dream-filter': (el) => {
    ui.dreamFilter = el.dataset.f;
    saveUi();
    commit();
  },
  'dream-mic': () => (rec ? rec.stop() : startDictation()),
  'dream-new': (el) => openDream({ date: el.dataset.date || D.today(), kinds: [] }),
  'dream-edit': (el) => {
    const d = state.dreams.find((x) => x.id === el.dataset.id);
    if (d) openDream(d);
  },
  'dream-save': (el) => {
    stopDictation();
    const f = formData(sheetRoot().querySelector('[data-form=dream]'));
    const data = {
      date: D.isValid(f.date) ? f.date : D.today(),
      title: f.title.trim(),
      text: f.text.trim(),
      kinds: f.kinds || [],
      sleep: f.sleep || '',
    };
    if (!data.title && !data.text && !data.kinds.length && !data.sleep) return toast('Напиши какво сънува или как спа.');
    const id = el.dataset.id;
    if (id) Object.assign(state.dreams.find((x) => x.id === id), data);
    else state.dreams.push({ id: uid(), added: new Date().toISOString(), ...data });
    closeSheet(true);
    commit();
    toast(data.kinds.includes('scary') ? 'Записано. Беше само сън 🤍' : 'Записано ✓');
  },
  'dream-del': (el) => {
    const id = el.dataset.id;
    confirmSheet({
      title: 'Да изтрия ли съня?',
      text: 'Ще изчезне от дневника.',
      ok: 'Изтрий',
      danger: true,
      onOk: () => {
        state.dreams = state.dreams.filter((x) => x.id !== id);
        commit();
      },
    });
  },
});
