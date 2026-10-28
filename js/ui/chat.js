import { $, html, render, on, toast } from '../core/dom.js';
import { listen } from '../core/store.js';
import { currentPage } from '../core/router.js';
import { account } from '../cloud/sync.js';
import * as api from '../cloud/chat.js';
import { loadChatProfiles } from '../cloud/profile-banners.js';
import { profileAvatar, paintProfileBanners } from './profile-banner.js';
import { openMemberProfile } from './profile.js';
import { pickEmoji } from './emoji-picker.js';
import { openSheet, confirmDialog, markBusy } from './sheet.js';
import { icons } from './icons.js';

let rows = [], owner = null, draft = '', error = '', loading = false, sending = false, hasOlder = false, initialized = false;
let retry = null, reply = null;
let holdTimer = null, held = false, holdStart = null, holdElement = null, menuOpen = false;
let followup = false;
let followLatest = true, observedList = null, resizeObserver = null;
let expanded = false, swipe = null;
function cancelSwipe() {
  swipe?.element.classList.remove('swiping'); swipe?.element.style.removeProperty('--reply-swipe'); swipe = null;
}
function replyToMessage(id) {
  const message=rows.find(m=>m.id===id);
  if(!message || owner!==uid())return;
  reply=message; retry=null; paintReply(); $('chatInput')?.focus({preventScroll:true});
}
const uid = () => account.user?.id;
function cancelHold() {
  clearTimeout(holdTimer); holdTimer = null; holdStart = null;
  holdElement?.classList.remove('holding'); holdElement = null;
}
function sizeComposer() {
  const input=$('chatInput'); if(!input)return;
  const style=getComputedStyle(input),min=parseFloat(style.minHeight)||40,max=parseFloat(style.maxHeight)||112;
  input.style.height='auto'; input.style.height=Math.min(max,Math.max(min,input.scrollHeight))+'px';
}
function reset() {
  cancelHold(); cancelSwipe(); held = false;
  resizeObserver?.disconnect(); observedList = null; followLatest = true;
  owner = uid(); reply = null; rows = []; draft = ''; error = ''; loading = false; sending = false; retry = null; hasOlder = false; followup = false; expanded = false;
}
function messageRows() {
  let day = '';
  return html`${hasOlder ? html`<button type="button" class="btn btn-ghost btn-sm chat-older" data-chat-older>Earlier messages</button>` : ''}
    ${rows.length ? rows.map((m, index) => {
      const date = new Date(m.created_at), label = date.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
      const divider = label !== day; day = label;
      const previous = rows[index - 1], gap = date - new Date(previous?.created_at);
      const continued = !divider && previous?.user_id === m.user_id && gap >= 0 && gap < 5 * 60 * 1000 && !m.reply_to && !previous.reply_to;
      const time = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      return html`${divider ? html`<div class="chat-day" data-key="date-${label}">${label}</div>` : ''}
      <article class="chat-message${m.user_id === uid() ? ' mine' : ''}${continued ? ' continued' : ''}" data-message="${m.id}" data-key="message-${m.id}" tabindex="0" aria-label="Message from ${m.username}. Hold or press Enter for actions">
        ${continued ? html`<time class="chat-inline-time" datetime="${m.created_at}">${time}</time>` : html`<button type="button" class="chat-person" data-chat-profile="${m.user_id}" aria-label="View @${m.username} profile">${profileAvatar(m.username, 'sm', m.user_id)}</button>`}
        <div class="chat-content">${continued ? '' : html`<div class="chat-message-meta"><button type="button" class="chat-author" data-chat-profile="${m.user_id}">@${m.username}</button><time datetime="${m.created_at}">${time}</time></div>`}${m.reply_to ? html`<blockquote class="chat-quote"><b>@${m.reply_username}</b><span>${m.reply_body}</span></blockquote>` : ''}
        <p>${m.body}</p>${m.reactions?.length ? html`<div class="chat-reactions">${m.reactions.map(r=>html`<button type="button" class="chat-reaction" data-chat-react="${m.id}" data-emoji="${r.emoji}" aria-pressed="${r.mine?'true':'false'}" aria-label="${r.mine?'Remove':'Add'} ${r.emoji} reaction">${r.emoji}<small>${r.count}</small></button>`)}</div>`:''}</div>
      </article>`;
    }) : html`<div class="chat-empty">${loading ? 'Loading…' : 'Start the conversation.'}</div>`}`;
}
function replyMarkup() {
  return reply ? html`<div class="chat-reply-preview"><div><b>Reply to @${reply.username}</b><span>${reply.body.slice(0, 160)}</span></div><button type="button" class="icon-btn sm" data-cancel-reply aria-label="Cancel reply">${icons.x}</button></div>` : '';
}
function paintReply() { if ($('chatReply')) render($('chatReply'), replyMarkup()); }
async function messageMenu(id) {
  const message = rows.find(m => m.id === id), captured = uid();
  if (!message || menuOpen) return;
  menuOpen = true;
  let remove;
  document.activeElement?.blur();
  try {
    const action = await openSheet({ title: 'Message', className: 'chat-actions-sheet',
      body: html`<div class="chat-quick-reactions" aria-label="React to message">${['❤️','🔥','😂','👍','💪','👏'].map(emoji=>html`<button type="button" class="icon-btn" data-menu-react="${emoji}" aria-label="React ${emoji}">${emoji}</button>`)}<button type="button" class="icon-btn" data-more-reactions aria-label="More reactions">+</button></div>`,
      actions: [{ label: 'Reply', value: 'reply' }, { label: 'Copy text', value: 'copy' }, ...(message.user_id === captured ? [{ label:'Edit message',value:'edit' }, { label: 'Delete message', value: 'delete', tone: 'danger' }] : [])],
      onMount(sheet, close) { sheet.addEventListener('click',event=>{const button=event.target.closest('[data-menu-react],[data-more-reactions]');if(button)close({reaction:button.dataset.menuReact||'more'});}); remove = listen('gym:account', () => { if (captured !== uid()) close(); }); },
    });
    if (captured !== uid()) return;
    if (action === 'copy') {
      try { await navigator.clipboard.writeText(message.body); toast('Copied.'); }
      catch { await openSheet({ title: 'Copy text', body: html`<textarea class="input" readonly rows="5">${message.body}</textarea>` }); }
    }
    if (action?.reaction) { const emoji=action.reaction==='more'?await pickEmoji():action.reaction; if(emoji && captured===uid())await react(id,emoji); }
    if (action === 'edit') await edit(id,captured);
    if (action === 'reply') replyToMessage(id);
    if (action === 'delete' && await confirmDialog('Delete this message for everyone?', { title: 'Delete message?', ok: 'Delete', danger: true }) && captured === uid()) {
      await api.removeMessage(id, captured);
      if (captured === uid() && owner === captured) {
        rows = rows.filter(m => m.id !== id).map(m => m.reply_to === id ? { ...m, reply_to: null, reply_body: null, reply_username: null } : m);
        if (reply?.id === id) { reply = null; paintReply(); }
        paint();
      }
    }
  } catch (error) { if (captured === uid()) toast(error.message, { tone: 'error' }); }
  finally { remove?.(); menuOpen = false; }
}
const reacting=new Set();
async function react(id,emoji) {
  const captured=uid(),message=rows.find(m=>m.id===id),key=id+emoji;
  if(!message||reacting.has(key))return;reacting.add(key);
  try{await api.reactMessage(id,emoji,!message.reactions?.find(r=>r.emoji===emoji)?.mine,captured);if(captured===uid())await loadChat();}
  catch(error){if(captured===uid())toast(error.message,{tone:'error'});}finally{reacting.delete(key);}
}
async function edit(id,captured) {
  const message=rows.find(m=>m.id===id);if(!message || message.user_id!==captured || captured!==uid())return;
  let off;
  await openSheet({title:'Edit message',body:html`<label class="field">Message<textarea class="input" name="message" maxlength="1000" rows="4">${message.body}</textarea></label><p class="form-error" role="status"></p>`,onMount(sheet,close){off=listen('gym:account',()=>{if(captured!==uid())close();});},actions:[{label:'Save',submit:true,onClick:async(finish,sheet)=>{
    if(sheet.querySelector('[type=submit]').getAttribute('aria-disabled')==='true')return;
    const input=sheet.querySelector('textarea'),text=input.value.trim(),done=markBusy(sheet,sheet.querySelector('[type=submit]'),'Saving…');
    try{await api.editMessage(id,text,captured);if(captured!==uid())return;rows=rows.map(m=>m.id===id?{...m,body:text}:m.reply_to===id?{...m,reply_body:text.slice(0,160)}:m);paint();finish(true);}
    catch(error){if(captured===uid())sheet.querySelector('.form-error').textContent=error.message;}finally{done();}
  }},{label:'Cancel',value:null,tone:'ghost'}]}).finally(()=>off?.());
}
export function chatPanel() {
  if (owner !== uid()) reset();
  return html`<section class="chat-room" id="chatRoom" aria-label="Gym chat">
    <div class="chat-messages" id="chatMessages" role="log" aria-label="Messages" aria-live="off" tabindex="0">${messageRows()}</div>
    <p class="chat-error small" id="chatError" role="status">${error}</p>
    <div id="chatReply">${replyMarkup()}</div><form class="chat-compose" id="chatForm"><label class="sr-only" for="chatInput">Message everyone</label><textarea class="input" id="chatInput" rows="1" maxlength="1000" placeholder="Message…" enterkeyhint="send">${draft}</textarea><button type="submit" class="btn btn-primary" aria-label="Send message"${sending ? ' disabled' : ''}>Send</button></form>
  </section>`;
}
function paint({ bottom = false, older = false } = {}) {
  const list = $('chatMessages');
  if (!list || owner !== uid()) return;
  const height = list.scrollHeight, top = list.scrollTop;
  const follow = bottom || height - top - list.clientHeight < 80;
  followLatest = !older && follow;
  render(list, messageRows());
  paintProfileBanners(list);
  if (older) list.scrollTop = top + list.scrollHeight - height;
  else if (follow) list.scrollTop = list.scrollHeight;
  if ($('chatError')) $('chatError').textContent = error;
}
export function bindChatScroll() {
  sizeComposer();
  const list=$('chatMessages');
  if(list===observedList) return;
  resizeObserver?.disconnect(); observedList=list;
  if(!list) return;
  list.onscroll=()=>{followLatest=list.scrollHeight-list.scrollTop-list.clientHeight<80;};
  resizeObserver=new ResizeObserver(()=>{if(followLatest && list.isConnected)list.scrollTop=list.scrollHeight;});
  resizeObserver.observe(list);
}
export function scrollChatToLatest() {
  bindChatScroll(); followLatest=true;
  requestAnimationFrame(() => { const list = $('chatMessages'); if (list) list.scrollTop = list.scrollHeight; });
}
export async function loadChat({ older = false, bottom = false } = {}) {
  if (!uid() || !account.ready) return;
  if (loading) { if (bottom) followup = true; return; }
  if (owner !== uid()) reset();
  const captured = owner;
  loading = true;
  try {
    const page = await api.messages(older ? rows[0] : null);
    if (captured !== uid() || owner !== captured) return;
    const first = !rows.length;
    if (older) expanded = true;
    const oldest = page.at(-1);
    const retained = expanded && !older && page.length === 50 ? rows.filter(m => m.created_at < oldest.created_at || (m.created_at === oldest.created_at && m.id < oldest.id)) : [];
    const byId = new Map((older ? [...page, ...rows] : [...retained, ...page]).map(m => [m.id, m]));
    rows = [...byId.values()].sort((a, b) => a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id));
    if (older || !rows.length || rows.length <= 50) hasOlder = page.length === 50;
    error = '';
    loading = false;
    paint({ bottom: bottom || first, older });
    loadChatProfiles(page.map(m => m.user_id)).then(() => { if (captured === uid()) paint(); }).catch(() => {});
  } catch (e) { if (captured === uid() && owner === captured) { error = e.message; loading = false; paint(); } }
  finally {
    if (captured === owner) {
      loading = false;
      if (followup) { followup = false; loadChat({ bottom: true }); }
    }
  }
}
export function initChat(root) {
  if (initialized) return;
  initialized = true;
  on(root, 'input', '#chatInput', (e, input) => { draft = input.value; retry = null; sizeComposer(); });
  on(root, 'pointerdown', '#chatForm [type=submit]', e => {
    if (document.activeElement?.id === 'chatInput') e.preventDefault();
  });
  on(root, 'keydown', '#chatInput', (e) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); $('chatForm')?.requestSubmit(); }
  });
  on(root, 'submit', '#chatForm', async e => {
    e.preventDefault();
    if (sending || !draft.trim()) return;
    const captured = uid(), text = draft, replying = reply?.id || null;
    const id = retry?.text === text && retry.replying === replying ? retry.id : crypto.randomUUID();
    retry = { id, text, replying }; sending = true;
    const button = $('chatForm').querySelector('[type=submit]'); button.disabled = true;
    try {
      await api.sendMessage(id, text, captured, replying);
      if (captured !== uid() || owner !== captured) return;
      if (draft === text) { draft = ''; reply = null; paintReply(); if ($('chatInput')) { $('chatInput').value = ''; sizeComposer(); } }
      retry = null;
      await loadChat({ bottom: true });
    } catch (e) { if (captured === uid() && owner === captured) { error = e.message; paint(); } }
    finally { if (captured === owner) { sending = false; if (button.isConnected) button.disabled = false; } }
  });
  on(root, 'click', '[data-chat-older]', () => loadChat({ older: true }));
  on(root, 'click', '[data-chat-profile]', (event, button) => { if (!held) openMemberProfile(button.dataset.chatProfile); });
  on(root,'click','[data-chat-react]',(event,button)=>react(button.dataset.chatReact,button.dataset.emoji));
  on(root, 'click', '[data-cancel-reply]', () => { reply = null; retry = null; paintReply(); });
  on(root, 'pointerdown', '[data-message]', (event, element) => {
    held = false; cancelHold(); cancelSwipe();
    if (event.button !== 0 || event.target.closest('button')) return;
    if(event.pointerType==='touch'||event.pointerType==='pen')event.preventDefault();
    holdStart = { x: event.clientX, y: event.clientY }; holdElement=element;
    if(event.pointerType==='touch'||event.pointerType==='pen')swipe={element,x:event.clientX,y:event.clientY,pointer:event.pointerId,owner:uid(),distance:0};
    element.classList.add('holding');
    const captured=uid();
    holdTimer = setTimeout(() => { cancelHold(); cancelSwipe(); if(captured!==uid()||!element.isConnected)return; held = true; messageMenu(element.dataset.message); }, 500);
  });
  root.addEventListener('pointermove', event => {
    if (holdStart && Math.hypot(event.clientX-holdStart.x,event.clientY-holdStart.y)>10) cancelHold();
    if(!swipe || event.pointerId!==swipe.pointer || swipe.owner!==uid())return;
    const dx=event.clientX-swipe.x,dy=event.clientY-swipe.y;
    if(!swipe.distance && Math.abs(dy)>12 && Math.abs(dy)>Math.abs(dx)){cancelSwipe();return;}
    if(dx < -12 && Math.abs(dx)>Math.abs(dy)*1.5){
      cancelHold(); event.preventDefault();
      try{swipe.element.setPointerCapture(event.pointerId);}catch{/* Synthetic or ended pointer. */}
      swipe.distance=Math.min(88,-dx);swipe.element.classList.add('swiping');
      swipe.element.style.setProperty('--reply-swipe',-swipe.distance+'px');
    }
  }, { passive:false });
  root.addEventListener('touchmove',event=>{if(swipe?.distance)event.preventDefault();},{passive:false});
  root.addEventListener('pointerup', event=>{
    const captured=swipe;cancelHold();cancelSwipe();
    if(captured && event.pointerId===captured.pointer && captured.owner===uid() && captured.element.isConnected && captured.distance>=64){held=true;replyToMessage(captured.element.dataset.message);}
  });
  root.addEventListener('pointercancel',()=>{cancelHold();cancelSwipe();});
  root.addEventListener('scroll',()=>{cancelHold();cancelSwipe();},true);
  window.addEventListener('blur',()=>{cancelHold();cancelSwipe();});
  document.addEventListener('visibilitychange',()=>{if(document.hidden){cancelHold();cancelSwipe();}});
  on(root, 'contextmenu', '[data-message]', (event, element) => { event.preventDefault(); cancelHold(); messageMenu(element.dataset.message); });
  on(root, 'keydown', '[data-message]', (event, element) => {
    if (event.target !== element) return;
    if (event.key === 'Enter' || event.key === 'ContextMenu' || (event.shiftKey && event.key === 'F10')) { event.preventDefault(); messageMenu(element.dataset.message); }
  });
  listen('gym:account', () => { if (owner !== uid()) reset(); });
  setInterval(() => {
    if (!document.hidden && currentPage() === 'crew' && $('chatRoom')) loadChat();
  }, 5000);
}
