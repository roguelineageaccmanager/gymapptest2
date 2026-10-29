// Tabs, the back gesture/button, and swipe navigation between tabs.
// Every overlay (workout screen, sheet, non-home tab) pushes a "layer" onto the
// browser history, so the phone's back gesture closes it instead of leaving the app.
import { dismissUndo } from './dom.js';

export const TABS = ['today', 'plan', 'calendar', 'stats', 'crew'];
const pages = {};
let current = 'today';

const layers = [];
let skipPops = 0;
let pendingPushes = [];

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
  if (i < 0) return;
  layers.splice(i, 1);
  if (!layer.pushed) { pendingPushes = pendingPushes.filter((l) => l !== layer); return; }
  skipPops++;
  try { history.back(); } catch { skipPops--; }
}

window.addEventListener('popstate', () => {
  if (skipPops > 0) {
    skipPops--;
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

export function go(name, { fromBack = false, fromSwipe = false } = {}) {
  if (!pages[name]) return;
  cancelNavigationSwipe();
  const changed = name !== current;
  // Let the page we leave close its own history layers (e.g. the plan editor).
  if (changed) { pages[current]?.leave?.(); dismissUndo(); }
  // Focus inside the page being hidden would be lost: it moves to the new page's heading.
  const leaving = document.getElementById('page-' + current);
  const focusWasInPage = changed && !!leaving && leaving.contains(document.activeElement);
  current = name;
  document.querySelectorAll('.page').forEach((p) => { const active=p.id==='page-'+name;p.style.animation=active&&fromSwipe?'none':'';p.classList.toggle('active',active); });
  document.querySelectorAll('.nav-btn').forEach((b) => {
    const active = b.dataset.page === name;
    b.classList.toggle('active', active);
    if (active) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current');
  });
  document.body.dataset.page = name;
  pages[name].render?.();
  if (changed) pages[name].shown?.();
  if (changed) window.scrollTo(0, 0);
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
  setupSwipe();
}

function setupSwipe() {
  let startX=0,startY=0,tracking=false,horizontal=false,source=null,preview=null,sourceName='',width=0,settleTimer=0;
  const ignore='input, textarea, select, .no-swipe, .chat-view, .sheet-backdrop, .session, .graph, [data-drag]';
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
    if(!horizontal&&Math.abs(dx)>12&&Math.abs(dx)>Math.abs(dy)*1.4){horizontal=true;source.style.animation='none';source.classList.add('swiping-page');}
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
