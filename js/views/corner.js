// Моето кътче: книги, мечтани пътувания и списъци за подаръци и покупки.
import * as D from '../dates.js';
import { state, ui, esc, commit, openSheet, closeSheet, registerActions, formData, sheetRoot, toast, confirmSheet, chips, saveUi } from '../ui.js';
import { uid } from '../store.js';
import { icon } from '../icons.js';
import * as Photos from '../photos.js';

const BOOK_STATUS = { want: 'Искам да я прочета', reading: 'Чета я', read: 'Прочетена' };
const TRIP_STATUS = { dream: 'Мечта', planned: 'Планирам', visited: 'Посетено ✓' };
const OCCASIONS = {
  christmas: ['🎄', 'Коледа'],
  birthday: ['🎂', 'Рожден ден'],
  nameday: ['💐', 'Имен ден'],
  valentine: ['💝', 'Свети Валентин'],
  march8: ['🌷', '8 март'],
  wedding: ['💍', 'Сватба'],
  home: ['🏡', 'За дома'],
  other: ['🛍️', 'Друго'],
};

const stars = (n, act = '', id = '') =>
  `<span class="stars" aria-label="${n} от 5">${[1, 2, 3, 4, 5]
    .map((i) => (act ? `<button data-act="${act}" data-id="${id}" data-n="${i}" class="${i <= n ? 'on' : ''}" aria-label="${i}">${icon('star')}</button>` : `<i class="${i <= n ? 'on' : ''}">${icon('star')}</i>`))
    .join('')}</span>`;

// ── книги ──
function books() {
  const year = D.yearOf(D.today());
  const all = state.books;
  const readThisYear = all.filter((b) => b.status === 'read' && (b.finished || '').startsWith(String(year))).length;
  const reading = all.filter((b) => b.status === 'reading').length;
  const f = ui.bookFilter || 'all';
  const order = { reading: 0, want: 1, read: 2 };
  const list = all.filter((b) => f === 'all' || b.status === f).sort((a, b) => order[a.status] - order[b.status] || (b.finished || '').localeCompare(a.finished || ''));
  return `<figure class="banner"><img src="img/books.webp" alt="" width="960" height="536"></figure>
    <header class="page-head"><h1>Моите книги</h1><p class="muted">Прочетени през ${year}: <b>${readThisYear}</b> · Чета сега: <b>${reading}</b></p></header>
    <div class="filter">${[['all', 'Всички'], ['reading', 'Чета'], ['want', 'Искам'], ['read', 'Прочетени']]
      .map(([k, l]) => `<button class="${f === k ? 'on' : ''}" data-act="book-filter" data-f="${k}">${l}</button>`)
      .join('')}</div>
    <div class="list">${
      list.length
        ? list
            .map(
              (b) => `<button class="card book" data-act="book-edit" data-id="${b.id}">
          <span class="book-spine s-${b.status}"></span>
          <span class="book-body"><b>${esc(b.title)}</b>${b.author ? `<small>${esc(b.author)}</small>` : ''}
            <span class="book-meta"><span class="pill pill-${b.status}">${BOOK_STATUS[b.status]}</span>${b.rating ? stars(b.rating) : ''}</span>
            ${b.note ? `<em>„${esc(b.note)}“</em>` : ''}</span>
        </button>`
            )
            .join('')
        : `<p class="empty card">${f === 'all' ? 'Списъкът е празен. Коя книга чакаш да прочетеш?' : 'Тук още няма книги.'}</p>`
    }</div>
    <button class="btn primary wide" data-act="book-new">${icon('plus')} Добави книга</button>`;
}

function bookForm(b) {
  return `<form class="form" data-form="book" onsubmit="return false">
    <label class="field"><span>Заглавие</span><input name="title" value="${esc(b.title)}" maxlength="160" autocomplete="off"></label>
    <label class="field"><span>Автор</span><input name="author" value="${esc(b.author || '')}" maxlength="120" autocomplete="off"></label>
    <div class="field"><span>Статус</span>${chips('status', Object.entries(BOOK_STATUS), b.status || 'want')}</div>
    <div class="field"><span>Оценка</span><div class="rate">${[1, 2, 3, 4, 5]
      .map((i) => `<label><input type="radio" name="rating" value="${i}" ${Number(b.rating) === i ? 'checked' : ''}><span>${icon('star')}</span></label>`)
      .join('')}<label class="rate-clear"><input type="radio" name="rating" value="0" ${!b.rating ? 'checked' : ''}><span>без</span></label></div></div>
    <label class="field"><span>Любим цитат или мисъл</span><textarea name="note" rows="3" maxlength="500">${esc(b.note || '')}</textarea></label>
    <button class="btn primary wide" data-act="book-save" data-id="${b.id || ''}">Запази</button>
    ${b.id ? `<button class="btn ghost danger-text wide" data-act="book-del" data-id="${b.id}">${icon('trash')} Изтрий</button>` : ''}
  </form>`;
}

// ── пътувания ──
function trips() {
  const all = state.trips;
  const order = { planned: 0, dream: 1, visited: 2 };
  const list = [...all].sort((a, b) => order[a.status] - order[b.status]);
  const visited = all.filter((t) => t.status === 'visited').length;
  return `<figure class="banner"><img src="img/travel.webp" alt="" width="960" height="536"></figure>
    <header class="page-head"><h1>Мечтани пътувания</h1><p class="muted">Мечти: <b>${all.length - visited}</b> · Посетени: <b>${visited}</b></p></header>
    <div class="trips">${
      list.length
        ? list
            .map(
              (t) => `<button class="card trip" data-act="trip-edit" data-id="${t.id}">
          <span class="trip-cover">${t.photos && t.photos.length ? `<img data-photo="${t.photos[0]}" alt="">` : `<span class="trip-ph">${icon('suitcase')}</span>`}<span class="pill pill-${t.status}">${TRIP_STATUS[t.status]}</span></span>
          <span class="trip-body"><b>${esc(t.place)}</b>${t.when ? `<small>${icon('cal')} ${esc(t.when)}</small>` : ''}${t.note ? `<em>${esc(t.note)}</em>` : ''}</span>
        </button>`
            )
            .join('')
        : `<p class="empty card">Къде мечтаеш да отидеш? Запиши мястото, идеите и снимки, които те вдъхновяват.</p>`
    }</div>
    <button class="btn primary wide" data-act="trip-new">${icon('plus')} Добави дестинация</button>`;
}

let tripDraft = null; // { added: [], removed: [], photos: [] }

function tripPhotosHtml() {
  return `${tripDraft.photos.map((id) => `<span class="ph"><img data-photo="${id}" alt=""><button type="button" data-act="trip-photo-del" data-pid="${id}" aria-label="Махни снимката">${icon('close')}</button></span>`).join('')}
    ${tripDraft.photos.length < 6 ? `<label class="ph ph-add">${icon('camera')}<span>Снимка</span><input type="file" accept="image/*" multiple data-change="trip-photo-add"></label>` : ''}`;
}

function tripForm(t) {
  return `<form class="form" data-form="trip" onsubmit="return false">
    <label class="field"><span>Къде</span><input name="place" value="${esc(t.place || '')}" maxlength="120" placeholder="напр. Санторини" autocomplete="off"></label>
    <label class="field"><span>Кога</span><input name="when" value="${esc(t.when || '')}" maxlength="80" placeholder="напр. пролетта на 2027"></label>
    <div class="field"><span>Статус</span>${chips('status', Object.entries(TRIP_STATUS), t.status || 'dream')}</div>
    <label class="field"><span>Бюджет</span><input name="budget" value="${esc(t.budget || '')}" maxlength="40" placeholder="напр. 1200 €"></label>
    <label class="field"><span>Идеи и бележки</span><textarea name="note" rows="4" maxlength="1500" placeholder="Места, ресторанти, плажове, какво да облека…">${esc(t.note || '')}</textarea></label>
    <div class="field"><span>Снимки и вдъхновение</span><div class="photos" id="trip-photos">${tripPhotosHtml()}</div></div>
    <button class="btn primary wide" data-act="trip-save" data-id="${t.id || ''}">Запази</button>
    ${t.id ? `<button class="btn ghost danger-text wide" data-act="trip-del" data-id="${t.id}">${icon('trash')} Изтрий</button>` : ''}
  </form>`;
}

function openTrip(t) {
  tripDraft = { added: [], removed: [], photos: [...(t.photos || [])] };
  openSheet({
    title: t.id ? t.place : 'Нова дестинация',
    body: tripForm(t),
    onMount: (el) => Photos.hydrate(el),
    onClose: () => {
      // затворено без „Запази“ — махаме новите снимки
      tripDraft.added.forEach((id) => Photos.delPhoto(id).catch(() => {}));
      tripDraft = null;
    },
  });
}

function redrawTripPhotos() {
  const box = document.getElementById('trip-photos');
  if (!box) return;
  box.innerHTML = tripPhotosHtml();
  Photos.hydrate(box);
}

// ── подаръци и покупки ──
function listStats(l) {
  const done = l.items.filter((i) => i.done).length;
  const sum = l.items.reduce((a, i) => a + (parseFloat(String(i.price).replace(',', '.')) || 0), 0);
  return { done, total: l.items.length, sum };
}
const money = (n) => (n ? `${n.toFixed(n % 1 ? 2 : 0).replace('.', ',')} €` : '');

function gifts() {
  const year = D.yearOf(D.today());
  const lists = [...state.lists].sort((a, b) => (a.date || '9999').localeCompare(b.date || '9999'));
  const suggest = [
    ['christmas', `Коледа ${D.yearOf(defaultChristmasDate())}`],
    ['birthday', 'Рождени дни'],
    ['nameday', 'Имени дни'],
    ['valentine', 'Свети Валентин'],
    ['march8', '8 март'],
  ].filter(([occ]) => !state.lists.some((l) => l.occasion === occ));
  return `<figure class="banner"><img src="img/gifts.webp" alt="" width="960" height="536"></figure>
    <header class="page-head"><h1>Подаръци и покупки</h1><p class="muted">Списъци за празници, рождени дни и всичко, което искаш да купиш.</p></header>
    <div class="list">${lists
      .map((l) => {
        const s = listStats(l);
        const [emo] = OCCASIONS[l.occasion] || OCCASIONS.other;
        const when = l.date ? `${D.fmtShort(l.date)} · ${D.relDays(D.diffDays(D.today(), l.date))}` : '';
        return `<button class="card glist" data-act="list-open" data-id="${l.id}">
          <span class="emo">${emo}</span>
          <span class="glist-body"><b>${esc(l.name)}</b><small>${when}</small>
            <span class="bar"><i style="width:${s.total ? (s.done / s.total) * 100 : 0}%"></i></span>
            <small>${s.total ? `${s.done} от ${s.total} купени` : 'Празен списък'}${s.sum ? ' · ' + money(s.sum) : ''}</small></span>
          ${icon('right')}
        </button>`;
      })
      .join('')}</div>
    ${
      suggest.length
        ? `<div class="suggest"><p class="caps">Бързо начало</p><div class="chips">${suggest
            .map(([occ, name]) => `<button class="chip-btn" data-act="list-quick" data-occ="${occ}" data-name="${esc(name)}">${OCCASIONS[occ][0]} ${esc(name)}</button>`)
            .join('')}</div></div>`
        : ''
    }
    <button class="btn primary wide" data-act="list-new">${icon('plus')} Нов списък</button>`;
}

function listDetail(id) {
  const l = state.lists.find((x) => x.id === id);
  if (!l) return '<p class="empty">Списъкът е изтрит.</p>';
  const s = listStats(l);
  const items = [...l.items].sort((a, b) => Number(a.done) - Number(b.done));
  return `<div class="ldetail">
    <p class="muted">${s.total ? `${s.done} от ${s.total} купени` : 'Добави първата идея за подарък или покупка.'}${s.sum ? ` · общо ${money(s.sum)}` : ''}</p>
    <div class="items">${items
      .map(
        (i) => `<div class="item ${i.done ? 'done' : ''}">
        <button class="tick ${i.done ? 'on' : ''}" data-act="item-toggle" data-list="${l.id}" data-id="${i.id}" aria-label="Купено">${icon('check')}</button>
        <span class="item-text"><b>${esc(i.text)}</b>${i.who ? `<small>за ${esc(i.who)}</small>` : ''}</span>
        ${i.price ? `<span class="price">${esc(String(i.price).replace('.', ','))} €</span>` : ''}
        <button class="icon-btn small" data-act="item-del" data-list="${l.id}" data-id="${i.id}" aria-label="Изтрий">${icon('close')}</button>
      </div>`
      )
      .join('')}</div>
    <form class="add-item" data-form="item" onsubmit="return false">
      <input name="text" placeholder="Какво" maxlength="120" autocomplete="off" data-keep>
      <div class="row2"><input name="who" placeholder="За кого" maxlength="60" autocomplete="off" data-keep><input name="price" inputmode="decimal" placeholder="Цена €" maxlength="10" data-keep></div>
      <button class="btn primary wide" data-act="item-add" data-list="${l.id}">${icon('plus')} Добави</button>
    </form>
    <div class="btn-row"><button class="btn ghost" data-act="list-edit" data-id="${l.id}">${icon('edit')} Промени списъка</button><button class="btn ghost danger-text" data-act="list-del" data-id="${l.id}">${icon('trash')} Изтрий</button></div>
  </div>`;
}

function openList(id) {
  const l = state.lists.find((x) => x.id === id);
  if (!l) return;
  openSheet({ title: `${(OCCASIONS[l.occasion] || OCCASIONS.other)[0]} ${l.name}`, render: () => listDetail(id) });
}

function listForm(l) {
  return `<form class="form" data-form="list" onsubmit="return false">
    <label class="field"><span>Име на списъка</span><input name="name" value="${esc(l.name || '')}" maxlength="80" placeholder="напр. Рожденият ден на мама" autocomplete="off"></label>
    <div class="field"><span>Повод</span>${chips('occasion', Object.entries(OCCASIONS).map(([k, [e, n]]) => [k, `${e} ${n}`]), l.occasion || 'other')}</div>
    <label class="field"><span>Дата (по желание)</span><input type="date" name="date" value="${l.date || ''}"></label>
    <button class="btn primary wide" data-act="list-save" data-id="${l.id || ''}">Запази</button>
  </form>`;
}

export function render() {
  const tab = ui.corner || 'books';
  const body = tab === 'trips' ? trips() : tab === 'gifts' ? gifts() : books();
  return `<div class="page corner">
    <div class="seg seg3 sticky-seg">
      <button class="${tab === 'books' ? 'on' : ''}" data-act="corner" data-t="books">${icon('book')} Книги</button>
      <button class="${tab === 'trips' ? 'on' : ''}" data-act="corner" data-t="trips">${icon('suitcase')} Пътувания</button>
      <button class="${tab === 'gifts' ? 'on' : ''}" data-act="corner" data-t="gifts">${icon('gift')} Подаръци</button>
    </div>
    ${body}
  </div>`;
}

export function afterRender(root) {
  Photos.hydrate(root);
}

function defaultChristmasDate() {
  const t = D.today();
  const y = D.yearOf(t);
  return `${y}-12-25` >= t ? `${y}-12-25` : `${y + 1}-12-25`;
}

registerActions({
  corner: (el) => {
    ui.corner = el.dataset.t;
    saveUi();
    commit();
    window.scrollTo({ top: 0 });
  },
  // книги
  'book-filter': (el) => {
    ui.bookFilter = el.dataset.f;
    saveUi();
    commit();
  },
  'book-new': () => openSheet({ title: 'Нова книга', body: bookForm({ title: '', status: 'want' }) }),
  'book-edit': (el) => {
    const b = state.books.find((x) => x.id === el.dataset.id);
    if (b) openSheet({ title: 'Книга', body: bookForm(b) });
  },
  'book-save': (el) => {
    const f = formData(sheetRoot().querySelector('[data-form=book]'));
    if (!f.title.trim()) return toast('Напиши заглавието.');
    const data = { title: f.title.trim(), author: f.author.trim(), status: f.status || 'want', rating: Number(f.rating) || 0, note: f.note.trim() };
    const id = el.dataset.id;
    if (id) {
      const b = state.books.find((x) => x.id === id);
      if (data.status === 'read' && b.status !== 'read') data.finished = D.today();
      Object.assign(b, data);
    } else state.books.push({ id: uid(), added: D.today(), finished: data.status === 'read' ? D.today() : '', ...data });
    closeSheet(true);
    commit();
    toast(data.status === 'read' ? 'Още една прочетена книга 📖' : 'Записано ✓');
  },
  'book-del': (el) => {
    const id = el.dataset.id;
    confirmSheet({ title: 'Да изтрия ли книгата?', text: 'Ще изчезне от списъка.', ok: 'Изтрий', danger: true, onOk: () => { state.books = state.books.filter((x) => x.id !== id); commit(); } });
  },
  // пътувания
  'trip-new': () => openTrip({ status: 'dream' }),
  'trip-edit': (el) => {
    const t = state.trips.find((x) => x.id === el.dataset.id);
    if (t) openTrip(t);
  },
  'trip-photo-add': (el) => {
    const draft = tripDraft;
    if (!draft) return;
    const files = [...(el.files || [])].slice(0, 6 - draft.photos.length);
    el.value = '';
    if (!files.length) return;
    toast('Добавям снимките…');
    const prev = draft.busy || Promise.resolve();
    draft.busy = prev.then(async () => {
      for (const file of files) {
        try {
          const blob = await Photos.compress(file);
          const id = 'ph_' + uid();
          await Photos.putPhoto(id, blob);
          if (tripDraft !== draft) {
            Photos.delPhoto(id).catch(() => {});
            continue;
          }
          draft.added.push(id);
          draft.photos.push(id);
        } catch (e) {
          console.warn(e);
          toast('Тази снимка не можа да се добави.');
        }
      }
      if (tripDraft === draft) redrawTripPhotos();
    });
  },
  'trip-photo-del': (el) => {
    const id = el.dataset.pid;
    tripDraft.photos = tripDraft.photos.filter((x) => x !== id);
    if (tripDraft.added.includes(id)) {
      tripDraft.added = tripDraft.added.filter((x) => x !== id);
      Photos.delPhoto(id).catch(() => {});
    } else tripDraft.removed.push(id);
    redrawTripPhotos();
  },
  'trip-save': async (el) => {
    if (tripDraft && tripDraft.busy) {
      el.disabled = true;
      await tripDraft.busy;
      el.disabled = false;
    }
    if (!tripDraft || !sheetRoot()) return;
    const f = formData(sheetRoot().querySelector('[data-form=trip]'));
    if (!f.place.trim()) return toast('Напиши мястото.');
    const data = { place: f.place.trim(), when: f.when.trim(), status: f.status || 'dream', budget: f.budget.trim(), note: f.note.trim(), photos: [...tripDraft.photos] };
    const id = el.dataset.id;
    if (id) Object.assign(state.trips.find((x) => x.id === id), data);
    else state.trips.push({ id: uid(), ...data });
    tripDraft.removed.forEach((pid) => Photos.delPhoto(pid).catch(() => {}));
    tripDraft = null;
    closeSheet(true);
    commit();
    toast(data.status === 'visited' ? 'Още едно сбъднато пътуване ✈️' : 'Записано ✓');
  },
  'trip-del': (el) => {
    const id = el.dataset.id;
    confirmSheet({
      title: 'Да изтрия ли дестинацията?',
      text: 'Ще се изтрият и снимките към нея.',
      ok: 'Изтрий',
      danger: true,
      onOk: () => {
        const t = state.trips.find((x) => x.id === id);
        (t?.photos || []).forEach((pid) => Photos.delPhoto(pid).catch(() => {}));
        if (tripDraft) tripDraft.added.forEach((pid) => Photos.delPhoto(pid).catch(() => {}));
        tripDraft = null;
        state.trips = state.trips.filter((x) => x.id !== id);
        commit();
      },
    });
  },
  // списъци
  'list-quick': (el) => {
    const occ = el.dataset.occ;
    const t = D.today();
    const y = D.yearOf(t);
    const dates = { christmas: defaultChristmasDate(), valentine: `${y}-02-14` >= t ? `${y}-02-14` : `${y + 1}-02-14`, march8: `${y}-03-08` >= t ? `${y}-03-08` : `${y + 1}-03-08` };
    const l = { id: uid(), name: el.dataset.name, occasion: occ, date: dates[occ] || '', items: [] };
    if (occ === 'christmas') l.name = `Коледа ${D.yearOf(l.date)}`;
    state.lists.push(l);
    commit();
    openList(l.id);
  },
  'list-new': () => openSheet({ title: 'Нов списък', body: listForm({ occasion: 'other' }) }),
  'list-edit': (el) => {
    const l = state.lists.find((x) => x.id === el.dataset.id);
    if (l) openSheet({ title: 'Промени списъка', body: listForm(l) });
  },
  'list-save': (el) => {
    const f = formData(sheetRoot().querySelector('[data-form=list]'));
    const name = f.name.trim() || (OCCASIONS[f.occasion] || OCCASIONS.other)[1];
    const id = el.dataset.id;
    let l;
    if (id) {
      l = state.lists.find((x) => x.id === id);
      Object.assign(l, { name, occasion: f.occasion || 'other', date: f.date || '' });
    } else {
      l = { id: uid(), name, occasion: f.occasion || 'other', date: f.date || '', items: [] };
      state.lists.push(l);
    }
    closeSheet(true);
    commit();
    setTimeout(() => openList(l.id), 300);
  },
  'list-open': (el) => openList(el.dataset.id),
  'list-del': (el) => {
    const id = el.dataset.id;
    confirmSheet({ title: 'Да изтрия ли списъка?', text: 'Ще изчезнат и всички неща в него.', ok: 'Изтрий', danger: true, onOk: () => { state.lists = state.lists.filter((x) => x.id !== id); commit(); } });
  },
  'item-add': (el) => {
    const l = state.lists.find((x) => x.id === el.dataset.list);
    const form = sheetRoot().querySelector('[data-form=item]');
    const f = formData(form);
    if (!f.text.trim()) {
      form.querySelector('[name=text]').focus();
      return;
    }
    l.items.push({ id: uid(), text: f.text.trim(), who: f.who.trim(), price: f.price.trim().replace(',', '.'), done: false });
    form.querySelectorAll('input').forEach((i) => (i.value = ''));
    commit();
    sheetRoot()?.querySelector('[data-form=item] [name=text]')?.focus({ preventScroll: true });
  },
  'item-toggle': (el) => {
    const l = state.lists.find((x) => x.id === el.dataset.list);
    const i = l && l.items.find((x) => x.id === el.dataset.id);
    if (!i) return;
    i.done = !i.done;
    commit();
  },
  'item-del': (el) => {
    const l = state.lists.find((x) => x.id === el.dataset.list);
    if (!l) return;
    l.items = l.items.filter((x) => x.id !== el.dataset.id);
    commit();
  },
});
