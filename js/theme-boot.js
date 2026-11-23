// Restore the saved wallpaper before the stylesheet paints.
(function () {
  try {
    var settings = JSON.parse(localStorage.getItem('gymSettings') || '{}') || {};
    var t = settings.theme || {};
    var light = t.base === 'light' || (t.base === 'system' && window.matchMedia && matchMedia('(prefers-color-scheme: light)').matches);
    var root = document.documentElement;
    var isColor = function (value) { return typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value); };
    if (isColor(t.color)) root.style.setProperty('--accent', t.color);
    if (light) root.setAttribute('data-theme', 'light');
    var background = isColor(settings.backgroundColor) ? settings.backgroundColor : '';
    if (background) root.style.setProperty('--page-bg', background);
    if (settings.wallpaperGlass === true || (typeof settings.wallpaperGlass !== 'boolean' && settings.glassSurfaces !== false)) {
      root.setAttribute('data-wallpaper', '');
      var defaultMiddle = light ? '#ffffff' : !t.preset || t.preset === 'graphite' ? '#181b1f' : '#16181b';
      var surface = isColor(settings.surfaceColor) ? settings.surfaceColor : defaultMiddle;
      var middle = isColor(settings.wallpaperMiddle) ? settings.wallpaperMiddle : surface;
      root.style.setProperty('--wallpaper-middle', middle);
      if (settings.thirdWallpaperColor === true) {
        root.setAttribute('data-third-stop', '');
        root.style.setProperty('--wallpaper-end', isColor(settings.wallpaperEnd) ? settings.wallpaperEnd : isColor(t.color) ? t.color : '#d6e1eb');
      }
    }
    // Restore saved colors before the first stylesheet paint, including the
    // loading text. The module theme applies derived contrast colors later.
    var savedColors = {
      bodyColor: ['--body-color'], surfaceColor: ['--surface'], textColor: ['--text', '--muted', '--dim'],
      borderColor: ['--glow-color'], buttonTextColor: ['--button-text'],
      updateColor: ['--update-bg'], buttonColor: ['--control-bg'], selectedColor: ['--selected-bg'],
      selectedTextColor: ['--selected-ink'], inputColor: ['--field-bg'], badgeColor: ['--badge-bg'], streakColor: ['--streak-bg'], navColor: ['--nav-selected-bg'], navTextColor: ['--nav-selected-ink']
    };
    Object.keys(savedColors).forEach(function (key) {
      if (!isColor(settings[key])) return;
      savedColors[key].forEach(function (variable) { root.style.setProperty(variable, settings[key]); });
    });
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta && background) meta.setAttribute('content', background);
    else if (meta && light) meta.setAttribute('content', '#f5f6f8');
  } catch { /* defaults to dark */ }
})();
