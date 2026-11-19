// Tabs, the back gesture/button, and swipe navigation between tabs.
// Every overlay (workout screen, sheet, non-home tab) pushes a "layer" onto the
// browser history, so the phone's back gesture closes it instead of leaving the app.
import { dismissUndo, html } from './dom.js';

export const TABS = ['today', 'plan', 'calendar', 'stats', 'crew'];
const pages = {};
let current = 'today';

const layers = [];
let skipPops = 0;
let pendingPushes = [];
const pendingCloses = [];

// history.back() is asynchronous. A layer opened while a back() is still in
// flight would have its entry popped instead, so its push waits for that popstate.
function pushEntry(layer) {
  layer.pushed = true;
  try { history.pushState({ gymLayer: true }, ''); } catch { /* sandboxed */ }
}

export function pushLayer(onBack) {
  const layer = { onBack, pushed: false };
  layers.push(layer);
  if (skipPops > 0) pendingPushes.push(layer);
  else pushEntry(layer);
  return () => closeLayer(layer);
}

function closeLayer(layer) {
  const i = layers.indexOf(layer);
  if (i < 0) return Promise.resolve();
  layers.splice(i, 1);
  if (!layer.pushed) { pendingPushes = pendingPushes.filter((l) => l !== layer); return Promise.resolve(); }
  // Callers that change layout after a dialog closes can wait until the
  // history traversal (including native scroll restoration) has finished.
  let finish;
  const closed = new Promise(resolve => { finish = resolve; });
  pendingCloses.push(finish);
  skipPops++;
  try { history.back(); } catch { skipPops--; pendingCloses.pop(); finish(); }
  return closed;
}

window.addEventListener('popstate', () => {
  if (skipPops > 0) {
    skipPops--;
    const finish = pendingCloses.shift();
    requestAnimationFrame(() => finish?.());
    if (!skipPops) { const queued = pendingPushes; pendingPushes = []; queued.forEach(pushEntry); }
    return;
  }
  const layer = layers.pop();
  if (layer) layer.onBack();
});

/** Hardware back button inside the Android app. */
export function handleNativeBack(exitApp) {
  if (layers.length) history.back();
  else if (current !== 'today') go('today');
  else exitApp();
}

export function registerPage(name, hooks) {
  pages[name] = hooks;
}

export function currentPage() {
  return current;
}

let tabLayerClose = null;
let cancelNavigationSwipe=()=>{};
const travelByRail = new WeakMap();
const activeMotion = new Set();
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');
const motionCurve = 'cubic-bezier(.42,.04,.24,1)';
let cancelSlide = () => {};
function stopMotion() {
  cancelSlide();
  activeMotion.forEach(animation => animation.cancel());
  activeMotion.clear();
}
function canAnimate(element) {
  if (!reduceMotion.matches) return typeof element?.animate === 'function';
  stopMotion();
  return false;
}
reduceMotion.addEventListener?.('change', () => { if (reduceMotion.matches) stopMotion(); });

function playMotion(element, frames, timing) {
  const animation = element.animate(frames, timing);
  activeMotion.add(animation);
  const clear = () => activeMotion.delete(animation);
  animation.addEventListener('finish', clear, { once: true });
  animation.addEventListener('cancel', clear, { once: true });
  return animation;
}

export const TAB_MOTION_MARKER = html`<span class="tab-motion-marker" data-key="tab-motion-marker" aria-hidden="true"></span>`;

function moveTabHighlight(previous, next, duration) {
  if (previous === next || !previous || !canAnimate(next)) return;
  const rail = next.parentElement;
  const marker = rail.querySelector(':scope > .tab-motion-marker');
  if (!marker || previous.parentElement !== rail) return;
  const running = travelByRail.get(rail);
  const start = (running?.motion.playState === 'running' ? marker : previous).getBoundingClientRect();
  running?.motion.cancel();
  running?.fill.cancel();
  const end = next.getBoundingClientRect();
  if (!start.width || !end.width) return;
  const bounds = rail.getBoundingClientRect();
  const frame = rect => ({
    transform: `translate3d(${rect.left - bounds.left - rail.clientLeft + rail.scrollLeft}px, ${rect.top - bounds.top - rail.clientTop + rail.scrollTop}px, 0)`,
    width: rect.width + 'px', height: rect.height + 'px', opacity: 1,
  });
  const motion = playMotion(marker, [frame(start), frame(end)], { duration, easing: motionCurve });
  const fill = playMotion(next, [{ backgroundColor: 'transparent' }, { backgroundColor: 'transparent' }], { duration });
  travelByRail.set(rail, { motion, fill });
}

function slidePanels({ departed, destination, direction, duration, outgoingTop }) {
  const app = document.getElementById('app');
  const bounds = app.getBoundingClientRect();
  const target = destination.getBoundingClientRect();
  const height = innerHeight - target.top;
  if (!bounds.width || !target.width || height <= 0) return;
  const stride = direction * bounds.width;
  const distance = stride * departed.length;
  const translation = x => ({ transform: `translate3d(${x}px, 0, 0)` });
  const stage = document.createElement('div'), strip = document.createElement('div');
  stage.className = 'tab-slide-stage';
  stage.inert = true;
  stage.setAttribute('aria-hidden', 'true');
  Object.assign(stage.style, {
    width: bounds.width + 'px', height: height + 'px',
    left: bounds.left + 'px', top: target.top + 'px',
  });
  stage.append(strip);
  app.append(stage);
  const restore = departed.map(({ panel, live }, index) => {
    const tile = document.createElement('div');
    tile.className = 'tab-slide-tile';
    Object.assign(tile.style, {
      left: stride * index + 'px',
      paddingLeft: Math.max(0, target.left - bounds.left) + 'px',
      paddingRight: Math.max(0, bounds.right - target.right) + 'px',
    });
    const slot = live ? document.createComment('sliding page') : null;
    if (slot) panel.before(slot);
    const content = document.createElement('div');
    const parentPage = destination.parentElement.closest('.page');
    if (parentPage) {
      // Keep section typography and card spacing while the outgoing copy slides.
      content.className = 'page';
      content.dataset.slidePage = parentPage.id;
    }
    tile.append(content);
    content.append(panel);
    strip.append(tile);
    const top = index === 0 ? outgoingTop : target.top;
    const offset = top - panel.getBoundingClientRect().top;
    if (offset) content.style.transform = `translateY(${offset}px)`;
    return () => slot?.replaceWith(panel);
  });
  const timing = { duration, easing: motionCurve };
  const incoming = playMotion(destination, [translation(distance), translation(0)], timing);
  const outgoing = playMotion(strip, [translation(0), translation(-distance)], { ...timing, fill: 'forwards' });
  const scrollY = window.scrollY;
  const settle = () => { if (stage.isConnected) cancelSlide(); };
  const onScroll = () => { if (window.scrollY !== scrollY) settle(); };
  const onWheel = event => { if (Math.abs(event.deltaY) > Math.abs(event.deltaX)) settle(); };
  // A tap or keyboard click may scroll to content in the destination. Settle
  // first so its position is measured in the final, untransformed layout.
  destination.addEventListener('click', settle, true);
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('wheel', onWheel, { passive: true });
  cancelSlide = () => {
    cancelSlide = () => {};
    destination.removeEventListener('click', settle, true);
    window.removeEventListener('scroll', onScroll);
    window.removeEventListener('wheel', onWheel);
    restore.forEach(placeBack => placeBack());
    stage.remove();
    incoming.cancel();
    outgoing.cancel();
  };
  outgoing.addEventListener('finish', settle, { once: true });
  outgoing.addEventListener('cancel', settle, { once: true });
  incoming.addEventListener('cancel', settle, { once: true });
}

export function switchSectionTab(next, update, panelId) {
  const rail = next.closest('[role=tablist]');
  const previous = rail?.querySelector('[aria-selected=true]');
  const tabs = rail ? [...rail.querySelectorAll('[role=tab]')] : [];
  const distance = previous ? tabs.indexOf(next) - tabs.indexOf(previous) : 0;
  if (!distance) { update(); return; }
  cancelSlide();
  const before = document.getElementById(panelId);
  const outgoingTop = before?.getBoundingClientRect().top;
  const snapshot = canAnimate(before) ? before.cloneNode(true) : null;
  update();
  const duration = 300;
  moveTabHighlight(previous, document.getElementById(next.id), duration);
  const destination = document.getElementById(panelId);
  if (!snapshot || !destination) return;
  // The live view keeps IDs used by forms and focus. Retain unique SVG
  // clip-path IDs on the outgoing view so its bodygraph still renders.
  for (const el of [snapshot, ...snapshot.querySelectorAll('[id]')]) {
    if (document.getElementById(el.id)) el.removeAttribute('id');
  }
  slidePanels({ departed: [{ panel: snapshot }], destination, direction: Math.sign(distance), duration, outgoingTop });
}

export function go(name, { fromBack = false, fromSwipe = false } = {}) {
  if (!pages[name]) return;
  cancelNavigationSwipe();
  cancelSlide();
  const changed = name !== current;
  const fromIndex = TABS.indexOf(current), toIndex = TABS.indexOf(name);
  const distance = toIndex < 0 ? 1 : fromIndex < 0 ? -1 : toIndex - fromIndex;
  const previousTab = document.querySelector('.nav-btn.active');
  const leaving = document.getElementById('page-' + current);
  const outgoingTop = leaving?.getBoundingClientRect().top;
  const slide = changed && !fromSwipe && canAnimate(leaving) && leaving.getBoundingClientRect().width > 0;
  // Let the page we leave close its own history layers (e.g. the plan editor).
  if (changed) { pages[current]?.leave?.(); dismissUndo(); }
  // Focus inside the page being hidden would be lost: it moves to the new page's heading.
  const focusWasInPage = changed && !!leaving && leaving.contains(document.activeElement);
  current = name;
  document.querySelectorAll('.page').forEach((p) => {
    const active = p.id === 'page-' + name;
    p.classList.toggle('active', active);
  });
  document.querySelectorAll('.nav-btn').forEach((b) => {
    const active = b.dataset.page === name;
    b.classList.toggle('active', active);
    if (active) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current');
  });
  document.body.dataset.page = name;
  pages[name].render?.();
  if (changed) pages[name].shown?.();
  if (changed) window.scrollTo(0, 0);
  if (changed) {
    const direction = Math.sign(distance);
    const duration = fromSwipe ? 220 : 280 + 115 * (Math.abs(distance) - 1);
    moveTabHighlight(previousTab, document.querySelector('.nav-btn.active'), duration);
    if (slide) {
      const departed = [{ panel: leaving, live: true }];
      if (fromIndex >= 0 && toIndex >= 0) {
        for (let index = fromIndex + direction; index !== toIndex; index += direction) {
          const between = TABS[index];
          pages[between].render?.();
          departed.push({ panel: document.getElementById('page-' + between), live: true });
        }
      }
      slidePanels({ departed, destination: document.getElementById('page-' + name), direction, duration, outgoingTop });
    }
  }
  if (focusWasInPage) {
    const h = document.querySelector(`#page-${name} h1`);
    if (h) { if (!h.hasAttribute('tabindex')) h.setAttribute('tabindex', '-1'); h.focus({ preventScroll: true }); }
  }
  // Any tab other than Today sits on one history layer, so "back" returns home.
  if (name === 'today') {
    if (tabLayerClose && !fromBack) tabLayerClose();
    tabLayerClose = null;
  } else if (TABS.includes(name) && !tabLayerClose) {
    tabLayerClose = pushLayer(() => { tabLayerClose = null; go('today', { fromBack: true }); });
  }
}

/** Re-renders the visible page (e.g. after cloud data arrived). */
export function refresh(name) {
  if (!name || name === current) pages[current]?.render?.();
}

export function initNav() {
  document.querySelectorAll('.nav-btn').forEach((b) => b.addEventListener('click', () => go(b.dataset.page)));
  for (const event of ['resize', 'blur', 'gym:account']) window.addEventListener(event, () => cancelSlide());
  document.addEventListener('visibilitychange', () => { if (document.hidden) cancelSlide(); });
  setupSwipe();
}

function setupSwipe() {
  let startX=0,startY=0,tracking=false,horizontal=false,source=null,preview=null,sourceName='',width=0,settleTimer=0;
  const ignore='input, textarea, select, .no-swipe, .sheet-backdrop, .session, .graph, [data-drag]';
  const inSideScroller=el=>{
    for(;el&&el!==document.body;el=el.parentElement)if(el.scrollWidth>el.clientWidth+2&&/auto|scroll/.test(getComputedStyle(el).overflowX))return true;
    return false;
  };
  function clearPreview() {
    if(!preview)return;
    const {element,ariaHidden,inert}=preview;
    element.classList.remove('swipe-preview','swipe-settling');element.style.removeProperty('transform');
    for(const key of ['left','top','width','height'])element.style.removeProperty('--swipe-'+key);
    if(ariaHidden===null)element.removeAttribute('aria-hidden');else element.setAttribute('aria-hidden',ariaHidden);
    element.inert=inert;preview=null;
  }
  function cleanup() {
    clearTimeout(settleTimer);settleTimer=0;clearPreview();
    if(source){source.classList.remove('swiping-page','swipe-settling');source.style.removeProperty('transform');delete source.dataset.swipeOffset;}
    tracking=false;horizontal=false;source=null;
  }
  cancelNavigationSwipe=cleanup;
  function prepare(dx) {
    const direction=dx<0?1:-1,next=TABS[TABS.indexOf(sourceName)+direction];
    if(!next){clearPreview();source.style.transform='translateX(0px)';return;}
    if(preview?.name!==next){
      clearPreview();pages[next]?.render?.();
      const element=document.getElementById('page-'+next),app=document.getElementById('app'),rect=source.getBoundingClientRect();
      const top=parseFloat(getComputedStyle(app).paddingTop)+(window.visualViewport?.offsetTop||0);
      preview={name:next,element,direction,ariaHidden:element.getAttribute('aria-hidden'),inert:element.inert};
      element.inert=true;element.setAttribute('aria-hidden','true');
      element.style.setProperty('--swipe-left',(rect.x-(Number(source.dataset.swipeOffset)||0))+'px');
      element.style.setProperty('--swipe-top',top+'px');element.style.setProperty('--swipe-width',rect.width+'px');
      element.style.setProperty('--swipe-height',Math.max(0,(window.visualViewport?.height||innerHeight)-top)+'px');
      element.classList.add('swipe-preview');
    }
    const offset=Math.max(-width,Math.min(width,dx));source.dataset.swipeOffset=String(offset);
    source.style.transform='translateX('+offset+'px)';preview.element.style.transform='translateX('+(preview.direction*width+offset)+'px)';
  }
  function settle(dx,cancel=false) {
    const accepted=!cancel&&preview&&Math.abs(dx)>Math.min(96,Math.max(64,width*.2));
    const destination=accepted?preview.name:null;
    const finish=()=>{if(source)delete source.dataset.swipeOffset;cleanup();if(destination)go(destination,{fromSwipe:true});};
    tracking=false;
    if(!preview||matchMedia('(prefers-reduced-motion: reduce)').matches){finish();return;}
    source.classList.add('swipe-settling');preview.element.classList.add('swipe-settling');
    source.style.transform='translateX('+(accepted?-preview.direction*width:0)+'px)';
    preview.element.style.transform='translateX('+(accepted?0:preview.direction*width)+'px)';
    settleTimer=setTimeout(finish,270);
  }
  document.addEventListener('touchstart',event=>{
    if(settleTimer)return;
    cleanup();
    tracking=event.touches.length===1&&!event.target.closest(ignore)&&!inSideScroller(event.target)&&TABS.includes(current)&&(window.visualViewport?.scale||1)===1;
    if(!tracking)return;
    startX=event.touches[0].clientX;startY=event.touches[0].clientY;sourceName=current;
    source=document.getElementById('page-'+current);width=document.getElementById('app').getBoundingClientRect().width;
  },{passive:true});
  document.addEventListener('touchmove',event=>{
    if(!tracking)return;
    if(event.touches.length!==1||current!==sourceName){cleanup();return;}
    const dx=event.touches[0].clientX-startX,dy=event.touches[0].clientY-startY;
    if(!horizontal&&Math.abs(dy)>12&&Math.abs(dy)>Math.abs(dx)){cleanup();return;}
    if(!horizontal&&Math.abs(dx)>12&&Math.abs(dx)>Math.abs(dy)*1.4){horizontal=true;cancelSlide();source.classList.add('swiping-page');}
    if(horizontal){event.preventDefault();prepare(dx);}
  },{passive:false});
  document.addEventListener('touchend',event=>{
    if(!tracking||!horizontal){if(!settleTimer)cleanup();return;}
    settle(event.changedTouches[0].clientX-startX);
  },{passive:true});
  document.addEventListener('touchcancel',cleanup,{passive:true});
  window.addEventListener('blur',cleanup);window.addEventListener('resize',cleanup);
  document.addEventListener('visibilitychange',()=>{if(document.hidden)cleanup();});
}
