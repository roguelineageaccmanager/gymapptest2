// Size overlays to the visible viewport and keep the focused field above the IME.
export function initKeyboard() {
  const viewport = window.visualViewport;
  let fullHeight = window.innerHeight, frame = 0;
  const editable = () => document.activeElement?.matches('input:not([type=checkbox]):not([type=radio]):not([type=color]):not([type=file]):not([type=range]):not([type=button]):not([type=submit]), textarea, [contenteditable=true]');
  const update = () => {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => {
      // Some Android WebViews resize innerHeight before visualViewport catches up.
      const height = Math.min(window.innerHeight, viewport?.height || window.innerHeight), top = viewport?.offsetTop || 0;
      fullHeight = Math.max(fullHeight, height, window.innerHeight);
      document.documentElement.style.setProperty('--view-height', height + 'px');
      document.documentElement.style.setProperty('--view-top', top + 'px');
      const compose = document.activeElement?.closest('.chat-compose');
      const keyboard = (!!editable() || !!compose) && fullHeight - height > 120 && (!viewport || viewport.scale === 1);
      document.body.classList.toggle('keyboard-open', keyboard);
      document.body.classList.toggle('chat-keyboard-open', keyboard && !!compose);
      // Chat fills the remaining visible screen, including its Send button.
      // Scrolling the page here would pan that fixed room a second time.
      if (keyboard && compose) return;
      if (!editable()) return;
      const field = document.activeElement, bounds = field.getBoundingClientRect();
      const container = field.closest('.sheet-body, .session-scroll');
      const box = container?.getBoundingClientRect();
      const header = document.querySelector('.page.active .editor-top')?.getBoundingClientRect();
      const upper = Math.max(top + 16, box ? box.top + 8 : header ? header.bottom + 12 : 16);
      const lower = Math.min(top + height - 20, box ? box.bottom - 8 : Infinity);
      const delta = bounds.bottom > lower ? bounds.bottom - lower : bounds.top < upper ? bounds.top - upper : 0;
      if (delta) { if (container) container.scrollTop += delta; else window.scrollBy(0, delta); }
    });
  };
  viewport?.addEventListener('resize', update);
  viewport?.addEventListener('scroll', update);
  window.addEventListener('resize', update);
  window.addEventListener('orientationchange', () => { fullHeight = window.innerHeight; update(); });
  document.addEventListener('focusin', () => { update(); setTimeout(update, 250); });
  document.addEventListener('focusout', () => setTimeout(update, 50));
  update();
}
