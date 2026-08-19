/* ══ FLORESCER — Service Worker ══════════════════════════════════
   Rede primeiro (pra sempre pegar a versão mais nova quando há sinal),
   cache como rede de segurança offline. As chamadas ao GitHub passam
   direto: o sync precisa falhar de verdade quando não há conexão.
   ════════════════════════════════════════════════════════════════ */

const CACHE = 'florescer-v19';
const CASCA = [
  './', './index.html', './style.css', './manifest.webmanifest',
  './js/core.js', './js/hoje.js', './js/alimentacao.js', './js/progresso.js',
  './js/relatorio.js', './js/agenda.js', './js/ajustes.js', './js/sync.js',
  './icons/icon-192.png', './icons/icon-512.png', './icons/apple-touch-icon.png',
];

self.addEventListener('install', e => {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then(c => Promise.allSettled(CASCA.map(u => c.add(u)))));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;   // GitHub e fontes passam direto

  e.respondWith(
    fetch(req)
      .then(res => {
        const copia = res.clone();
        caches.open(CACHE).then(c => c.put(req, copia)).catch(() => {});
        return res;
      })
      .catch(() => caches.match(req).then(r => r || caches.match('./index.html')))
  );
});
