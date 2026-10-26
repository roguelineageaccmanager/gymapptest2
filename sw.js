// Offline support for the web version: the app shell is cached per version.
// A new version installs in the background and takes over when the user taps
// "Install update" in Settings (the page sends 'skip-waiting').
const VERSION = '4.0.1';
// Hash of the cached files (tools/sw-hash.mjs), so every change re-caches.
const BUILD = '27ac72737ccc';
const CACHE = 'tracker-' + VERSION + '-' + BUILD;

const FILES = [
  './',
  'index.html',
  'manifest.json',
  'cloud-config.js',
  'css/app.css',
  'vendor/supabase.js',
  'js/main.js',
  'js/theme-boot.js',
  'js/version.js',
  'js/state.js',
  'js/native.js',
  'js/workout-notification.js',
  'js/core/dates.js',
  'js/core/dom.js',
  'js/core/router.js',
  'js/core/store.js',
  'js/core/text.js',
  'js/domain/backup.js',
  'js/domain/catalog.js',
  'js/domain/gym-dates.js',
  'js/domain/logs.js',
  'js/domain/nutrition.js',
  'js/domain/plan.js',
  'js/domain/release.js',
  'js/domain/rest-timer.js',
  'js/domain/rest-sounds.js',
  'js/ui/rest-sound-editor.js',
  'js/audio/rest_beep.wav',
  'js/audio/rest_chime.wav',
  'js/audio/rest_bell.wav',
  'js/domain/theme.js',
  'js/domain/settings.js',
  'js/domain/appearance.js',
  'js/domain/weights.js',
  'js/cloud/client.js',
  'js/cloud/profile-pictures.js',
  'js/cloud/profile-banners.js',
  'js/cloud/gym-dates.js',
  'js/cloud/social.js',
  'js/cloud/themes.js',
  'js/cloud/chat.js',
  'js/cloud/sync.js',
  'js/ui/calendar.js',
  'js/ui/crew.js',
  'js/ui/sharing.js',
  'js/ui/profile.js',
  'js/ui/profile-banner.js',
  'js/ui/profile-editors.js',
  'js/ui/rest-day-editor.js',
  'js/ui/chat.js',
  'js/ui/graph.js',
  'js/ui/icons.js',
  'js/ui/plan.js',
  'js/ui/session.js',
  'js/ui/settings.js',
  'js/ui/patch-notes.js',
  'js/ui/keyboard.js',
  'js/ui/sheet.js',
  'js/ui/stats.js',
  'js/ui/progress.js',
  'js/domain/progress.js',
  'js/cloud/progress.js',
  'js/ui/theme.js',
  'js/ui/today.js',
  'fonts/inter-400.woff',
  'fonts/inter-600.woff',
  'fonts/inter-800.woff',
  'fonts/inter-display-800.woff',
  'rest.png',
  'snake-loading.gif',
  'icon-192.png',
  'icon-512.png',
  'icon-192-maskable.png',
  'icon-512-maskable.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(FILES.map((f) => new Request(f, { cache: 'reload' })))));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k.startsWith('tracker-') && k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener('message', (event) => {
  if (event.data === 'skip-waiting') self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  // Only the app's own files; Supabase and GitHub requests always go to the network.
  if (event.request.method !== 'GET' || url.origin !== self.location.origin) return;
  if (url.pathname.endsWith('/Version')) return;
  event.respondWith(
    caches.match(event.request, { ignoreSearch: true }).then((hit) => hit || fetch(event.request)),
  );
});
