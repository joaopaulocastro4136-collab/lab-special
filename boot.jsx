import { createRoot } from 'react-dom/client';
import App from './App.jsx';

// ─── window.storage sobre IndexedDB (muito mais espaço que localStorage) ───
const DB_NAME = 'lab-special';
const STORE = 'kv';

function abrirDB() {
  return new Promise((res, rej) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => res(req.result);
    req.onerror = () => rej(req.error);
  });
}

let dbPromise = null;
function getDB() {
  if (!dbPromise) dbPromise = abrirDB();
  return dbPromise;
}

function tx(mode, fn) {
  return getDB().then(db => new Promise((res, rej) => {
    const t = db.transaction(STORE, mode);
    const store = t.objectStore(STORE);
    const req = fn(store);
    req.onsuccess = () => res(req.result);
    req.onerror = () => rej(req.error);
  }));
}

window.storage = {
  async get(key) {
    const value = await tx('readonly', s => s.get(key));
    return value === undefined ? null : { key, value };
  },
  async set(key, value) {
    await tx('readwrite', s => s.put(value, key));
    return { key, value };
  },
  async delete(key) {
    await tx('readwrite', s => s.delete(key));
    return true;
  },
};

// Migração única: dados antigos que possam existir no localStorage → IndexedDB
async function migrarLocalStorage() {
  try {
    if (localStorage.getItem('ls-migrado')) return;
    const chaves = [];
    for (let i = 0; i < localStorage.length; i++) chaves.push(localStorage.key(i));
    for (const k of chaves) {
      if (k === 'ls-migrado') continue;
      const existente = await window.storage.get(k);
      if (!existente) await window.storage.set(k, localStorage.getItem(k));
    }
    localStorage.setItem('ls-migrado', '1');
  } catch (e) { /* localStorage indisponível */ }
}

// Meta tags para o modo "app de tela cheia" no iPhone
function prepararPWA() {
  const metas = [
    ['viewport', 'width=device-width, initial-scale=1, maximum-scale=1, viewport-fit=cover'],
    ['apple-mobile-web-app-capable', 'yes'],
    ['mobile-web-app-capable', 'yes'],
    ['apple-mobile-web-app-status-bar-style', 'black-translucent'],
    ['apple-mobile-web-app-title', 'Lab Special'],
    ['theme-color', '#1C1B19'],
  ];
  for (const [name, content] of metas) {
    let m = document.querySelector(`meta[name="${name}"]`);
    if (!m) {
      m = document.createElement('meta');
      m.name = name;
      document.head.appendChild(m);
    }
    m.content = content;
  }
  document.title = 'Lab Special';
}

export function boot() {
  prepararPWA();
  migrarLocalStorage().finally(() => {
    const el = document.getElementById('root');
    createRoot(el).render(<App />);
  });
}
