// Service worker: guarda los archivos de la app para que abra rápido
// y se pueda instalar en el celular. Los datos (Firebase) siempre van por internet.
const VERSION = 'nexo-v6';
const ARCHIVOS = [
  './', 'index.html', 'manifest.webmanifest', 'css/estilos.css',
  'js/app.js', 'js/audio.js', 'js/firebase.js', 'js/firebase-config.js', 'js/iconos.js', 'js/tema.js', 'js/datos-ejemplo.js', 'js/componentes/comunes.js',
  'js/pantallas/ingreso.js', 'js/pantallas/inicio.js', 'js/pantallas/mensajes.js', 'js/pantallas/medicacion.js',
  'js/pantallas/cumpleanos.js', 'js/pantallas/mas.js', 'js/pantallas/familia.js', 'js/pantallas/ajustes.js',
  'iconos/icono-192.png', 'iconos/icono-512.png'
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(ARCHIVOS)));
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((claves) => Promise.all(claves.filter((k) => k !== VERSION).map((k) => caches.delete(k)))));
  self.clients.claim();
});

// Primero intenta internet (para tener siempre la última versión); si no hay, usa lo guardado
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  // Solo guarda los archivos de la app y las librerías; lo de Firebase (cuentas y datos) siempre va directo
  const url = new URL(e.request.url);
  const deLaApp = url.origin === self.location.origin;
  const libreria = /(^|\.)(jsdelivr\.net|gstatic\.com|googleapis\.com)$/.test(url.hostname) && !url.hostname.includes('identitytoolkit') && !url.hostname.includes('securetoken');
  if (!deLaApp && !libreria) return;
  e.respondWith(
    fetch(e.request)
      .then((r) => { const copia = r.clone(); caches.open(VERSION).then((c) => c.put(e.request, copia)).catch(() => {}); return r; })
      .catch(() => caches.match(e.request))
  );
});
