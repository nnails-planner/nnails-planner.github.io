// Снимките към пътуванията — в IndexedDB, смалени, за да не пълнят паметта.
const DB_NAME = 'nnp-photos';
const STORE = 'photos';
let dbPromise = null;
const urls = new Map();

function db() {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(STORE);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
  return dbPromise;
}

function tx(mode, fn) {
  return db().then(
    (d) =>
      new Promise((resolve, reject) => {
        const t = d.transaction(STORE, mode);
        const store = t.objectStore(STORE);
        let result;
        const r = fn(store);
        if (r) r.onsuccess = () => (result = r.result);
        t.oncomplete = () => resolve(result);
        t.onerror = () => reject(t.error);
        t.onabort = () => reject(t.error);
      })
  );
}

export const putPhoto = (id, blob) => tx('readwrite', (s) => s.put(blob, id));
export const getPhoto = (id) => tx('readonly', (s) => s.get(id));
export async function delPhoto(id) {
  if (urls.has(id)) {
    URL.revokeObjectURL(urls.get(id));
    urls.delete(id);
  }
  return tx('readwrite', (s) => s.delete(id));
}
export const clearPhotos = () => tx('readwrite', (s) => s.clear());

export async function photoUrl(id) {
  if (urls.has(id)) return urls.get(id);
  const blob = await getPhoto(id).catch(() => null);
  if (!blob) return '';
  const u = URL.createObjectURL(blob);
  urls.set(id, u);
  return u;
}

// Пълни всички <img data-photo="id"> в даден елемент.
export function hydrate(root) {
  root.querySelectorAll('img[data-photo]').forEach(async (img) => {
    const u = await photoUrl(img.dataset.photo);
    if (u) {
      img.src = u;
      img.classList.add('ready');
    }
  });
}

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = (e) => {
      URL.revokeObjectURL(url);
      reject(e);
    };
    img.src = url;
  });
}

export async function compress(file, max = 1280, quality = 0.8) {
  const img = await loadImage(file);
  const scale = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
  const w = Math.round(img.naturalWidth * scale);
  const h = Math.round(img.naturalHeight * scale);
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  c.getContext('2d').drawImage(img, 0, 0, w, h);
  return new Promise((resolve) => c.toBlob((b) => resolve(b), 'image/jpeg', quality));
}

function blobToDataUrl(blob) {
  return new Promise((resolve) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.readAsDataURL(blob);
  });
}

export async function exportPhotos(ids) {
  const out = {};
  for (const id of ids) {
    const b = await getPhoto(id).catch(() => null);
    if (b) out[id] = await blobToDataUrl(b);
  }
  return out;
}

export async function importPhotos(map) {
  await clearPhotos();
  for (const [id, dataUrl] of Object.entries(map || {})) {
    const blob = await (await fetch(dataUrl)).blob();
    await putPhoto(id, blob);
  }
}
