// Добре дошла, инсталиране, настройки и резервно копие.
import * as D from '../dates.js';
import { state, esc, commit, openSheet, closeSheet, registerActions, toast, confirmSheet, isIOS, isStandalone, deliverFile, sheetRoot } from '../ui.js';
import { defaults, normalize } from '../store.js';
import { icon } from '../icons.js';
import * as Photos from '../photos.js';
import { APP_VERSION } from '../config.js';
import { fastMode } from './fasts.js';

let installEvent = null;
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  installEvent = e;
});

const festive = () => {
  const m = D.monthIdx(D.today());
  return m === 11 || (m === 0 && D.dayNum(D.today()) <= 15);
};

export function openWelcome() {
  const sparkles = Array.from({ length: 18 }, (_, i) => `<i style="--x:${(i * 37) % 100}%;--d:${4 + (i % 5)}s;--delay:${(i * 0.7) % 5}s;--s:${0.6 + (i % 3) * 0.3}"></i>`).join('');
  openSheet({
    cls: 'sheet-full welcome',
    body: `<div class="sparkles" aria-hidden="true">${sparkles}</div>
      <img src="img/hero.webp" alt="" class="welcome-hero" width="720" height="894">
      <div class="welcome-text">
        <img src="img/nnails-logo.webp" alt="N NAILS" class="welcome-logo">
        <h1 class="foil">${festive() ? 'Весела Коледа!' : 'Добре дошла!'}</h1>
        <p>Това е твоят личен планер — подарък от нас в N NAILS. Тук подреждаш дните си, следиш цикъла си, мечтаеш и стигаш до целите си през цялата година.</p>
        <p class="small muted">${icon('lock')} Всичко, което записваш, остава само на твоя телефон. Ние не виждаме нищо.</p>
        <form class="form" data-form="welcome" onsubmit="return false">
          <label class="field"><span>Как да те наричаме?</span><input name="name" maxlength="40" autocomplete="given-name" placeholder="Твоето име"></label>
          <button class="btn primary wide" data-act="welcome-done">Да започваме ${icon('sparkle')}</button>
        </form>
      </div>`,
  });
}

function installBody() {
  if (isStandalone()) return `<p class="lead">${icon('check')} Планерът вече е на началния ти екран. Отваряй го оттам.</p>`;
  if (isIOS()) {
    return `<ol class="steps-list">
      <li><span>1</span><p>Отвори планера в <b>Safari</b>.</p></li>
      <li><span>2</span><p>Натисни бутона <b>„Сподели“</b> ${icon('share')} долу на екрана.</p></li>
      <li><span>3</span><p>Избери <b>„Добави към начален екран“</b> ${icon('addsq')}.</p></li>
      <li><span>4</span><p>Натисни <b>„Добави“</b>. Готово — златното N е на екрана ти.</p></li>
    </ol>
    <p class="note">${icon('sparkle')} Важно: след това отваряй планера само от иконата. Записаното в Safari не се прехвърля в иконата, затова започни да пишеш там.</p>`;
  }
  return `${installEvent ? `<button class="btn primary wide" data-act="install-now">${icon('download')} Инсталирай планера</button>` : ''}
    <ol class="steps-list">
      <li><span>1</span><p>Отвори планера в <b>Chrome</b>.</p></li>
      <li><span>2</span><p>Натисни менюто <b>⋮</b> горе вдясно.</p></li>
      <li><span>3</span><p>Избери <b>„Инсталиране на приложението“</b> или <b>„Добавяне към началния екран“</b>.</p></li>
    </ol>`;
}

export function openInstall() {
  openSheet({ title: 'Сложи планера на телефона', body: installBody() });
}

function settingsBody() {
  return `<div class="form">
    <label class="field"><span>Твоето име</span><input name="name" value="${esc(state.profile.name)}" maxlength="40" data-change="set-name"></label>
    <label class="switch"><input type="checkbox" ${state.prefs.holidays ? 'checked' : ''} data-change="set-holidays"><span></span>Празници и имени дни в календара</label>
    <div class="field"><span>Пости в календара</span>
      <div class="seg seg-fasts">${[['day', 'Всеки ден'], ['big', 'Само големите'], ['off', 'Без пости']].map(([v, l]) => `<button type="button" class="${fastMode() === v ? 'on' : ''}" data-act="set-fasts" data-v="${v}">${l}</button>`).join('')}</div>
      <small class="muted">„Всеки ден“ показва какво се яде днес — по календара на Българската православна църква. „Само големите“ показва само четирите големи пости.</small>
    </div>
    <button class="btn ghost wide" data-act="install-open">${icon('addsq')} Сложи планера на началния екран</button>
    <section class="set-block">
      <h3>Резервно копие</h3>
      <p class="muted small">Записите ти са само на този телефон. Запази копие от време на време — в Файлове, в имейл или в чат със себе си. С него прехвърляш всичко и на нов телефон.</p>
      <div class="btn-col"><button class="btn ghost wide" data-act="backup-export">${icon('download')} Запази копие</button>
      <label class="btn ghost wide">${icon('upload')} Възстанови от копие<input type="file" accept="application/json,.json" data-change="backup-import" hidden></label></div>
    </section>
    <section class="set-block">
      <h3>${icon('lock')} Поверителност</h3>
      <p class="muted small">Планерът няма регистрация. Всичко, което записваш — ангажименти, цикъл, цели, рецепти, снимки — стои само в паметта на телефона ти. Нито ние, нито някой друг го вижда.</p>
    </section>
    <button class="btn ghost danger-text wide" data-act="wipe">${icon('trash')} Изтрий всички записи</button>
    <p class="muted small center">N NAILS Planner ${APP_VERSION} · Подарък от N NAILS с любов</p>
  </div>`;
}

export function openSettings() {
  openSheet({ title: 'Настройки', body: settingsBody() });
}

async function exportBackup() {
  const ids = [...state.trips.flatMap((t) => t.photos || []), ...state.kitchen.recipes.map((r) => r.photo).filter(Boolean)];
  const photos = await Photos.exportPhotos(ids);
  const data = { app: 'nnails-planner', v: 1, exported: new Date().toISOString(), state, photos };
  const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
  await deliverFile(blob, `N-Planner-kopie-${D.today()}.json`);
}

async function importBackup(file) {
  let data;
  try {
    data = JSON.parse(await file.text());
  } catch {
    return toast('Този файл не е копие на планера.');
  }
  if (!data || data.app !== 'nnails-planner' || !data.state) return toast('Този файл не е копие на планера.');
  confirmSheet({
    title: 'Да възстановя ли копието?',
    text: `Копието е от ${data.exported ? D.fmtFull(data.exported.slice(0, 10)) : 'неизвестна дата'}. Сегашните записи на този телефон ще бъдат заменени с него.`,
    ok: 'Възстанови',
    onOk: async () => {
      const fresh = normalize(data.state);
      Object.keys(state).forEach((k) => delete state[k]);
      Object.assign(state, fresh);
      try {
        await Photos.importPhotos(data.photos);
      } catch (e) {
        console.warn(e);
      }
      commit();
      toast('Копието е възстановено ✓');
    },
  });
}

registerActions({
  'welcome-done': () => {
    const v = sheetRoot().querySelector('[name=name]').value.trim();
    state.profile.name = v;
    state.profile.welcomed = true;
    closeSheet(true);
    commit();
    if (isIOS() && !isStandalone()) setTimeout(openInstall, 450);
    else toast(v ? `Радваме се, че си тук, ${esc(v)} 🤍` : 'Радваме се, че си тук 🤍');
  },
  'install-open': () => openInstall(),
  'install-now': async () => {
    if (!installEvent) return;
    installEvent.prompt();
    await installEvent.userChoice.catch(() => {});
    installEvent = null;
    closeSheet(true);
  },
  settings: () => openSettings(),
  'set-name': (el) => {
    state.profile.name = el.value.trim();
    commit();
    toast('Записано ✓');
  },
  'set-holidays': (el) => {
    state.prefs.holidays = el.checked;
    commit();
  },
  'set-fasts': (el) => {
    state.prefs.fasts = el.dataset.v;
    el.parentElement.querySelectorAll('button').forEach((b) => b.classList.toggle('on', b === el));
    commit();
  },
  'backup-export': () => exportBackup().catch(() => toast('Копието не можа да се запази.')),
  'backup-import': (el) => {
    const f = el.files && el.files[0];
    if (f) importBackup(f);
  },
  wipe: () =>
    confirmSheet({
      title: 'Да изтрия ли всичко?',
      text: 'Всички ангажименти, цикли, цели, рецепти, менюта, книги, пътувания и списъци ще изчезнат от този телефон. Това не може да се върне.',
      ok: 'Изтрий всичко',
      danger: true,
      onOk: async () => {
        const fresh = defaults();
        fresh.profile.welcomed = true;
        Object.keys(state).forEach((k) => delete state[k]);
        Object.assign(state, fresh);
        await Photos.clearPhotos().catch(() => {});
        commit();
        toast('Всичко е изтрито.');
      },
    }),
});
