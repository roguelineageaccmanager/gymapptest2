// Loaded before the stylesheet paints: sets the light base at once, so a light
// theme does not flash dark while the app starts. js/ui/theme.js does the rest.
(function () {
  try {
    var settings = JSON.parse(localStorage.getItem('gymSettings') || '{}') || {};
    var t = settings.theme || {};
    var light = t.base === 'light' || (t.base === 'system' && window.matchMedia && matchMedia('(prefers-color-scheme: light)').matches);
    if (light) document.documentElement.setAttribute('data-theme', 'light');
    var background = /^#[0-9a-f]{6}$/i.test(settings.backgroundColor || '') ? settings.backgroundColor : '';
    if (background) document.documentElement.style.setProperty('--page-bg', background);
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta && background) meta.setAttribute('content', background);
    else if (meta && light) meta.setAttribute('content', '#f5f6f8');
  } catch { /* defaults to dark */ }
})();
