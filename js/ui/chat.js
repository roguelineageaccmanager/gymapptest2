import { $, html, render, on, toast } from '../core/dom.js';
import { listen } from '../core/store.js';
import { currentPage } from '../core/router.js';
import { account } from '../cloud/sync.js';
import * as api from '../cloud/chat.js';
import { loadChatProfiles } from '../cloud/profile-banners.js';
import { profileAvatar, paintProfileBanners } from './profile-banner.js';
import { openMemberProfile } from './profile.js';
import { openSheet, confirmDialog } from './sheet.js';
import { icons } from './icons.js';

let rows = [], owner = null, draft = '', error = '', loading = false, sending = false, hasOlder = false, initialized = false;
let retry = null, reply = null;
let holdTimer = null, held = false, holdStart = null, menuOpen = false;
let followup = false;
let expanded = false;
const uid = () => account.user?.id;
function reset() {
  clearTimeout(holdTimer); holdTimer = null; holdStart = null; held = false;
  owner = uid(); reply = null; rows = []; draft = ''; error = ''; loading = false; sending = false; retry = null; hasOlder = false; followup = false; expanded = false;
}
function messageRows() {
  let day = '';
  return html`${hasOlder ? html`<button type="button" class="btn btn-ghost btn-sm chat-older" data-chat-older>Earlier messages</button>` : ''}
    ${rows.length ? rows.map(m => {
      const date = new Date(m.created_at), label = date.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
      const divider = label !== day; day = label;
      return html`${divider ? html`<div class="chat-day" data-key="date-${label}">${label}</div>` : ''}
      <article class="chat-message${m.user_id === uid() ? ' mine' : ''}" data-message="${m.id}" data-key="message-${m.id}" tabindex="0" aria-label="Message from ${m.username}. Hold or press Enter for actions">
        <button type="button" class="chat-person" data-chat-profile="${m.user_id}" aria-label="View @${m.username} profile">${profileAvatar(m.username, 'sm', m.user_id)}<b>${m.user_id === uid() ? 'You' : '@' + m.username}</b></button>
        ${m.reply_to ? html`<blockquote class="chat-quote"><b>@${m.reply_username}</b><span>${m.reply_body}</span></blockquote>` : ''}
        <p>${m.body}</p><time datetime="${m.created_at}">${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</time>
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
      body: html`<p class="chat-action-preview">${message.body}</p>`,
      actions: [{ label: 'Reply', value: 'reply' }, { label: 'Copy text', value: 'copy' }, ...(message.user_id === captured ? [{ label: 'Delete message', value: 'delete', tone: 'danger' }] : [])],
      onMount(sheet, close) { remove = listen('gym:account', () => { if (captured !== uid()) close(); }); },
    });
    if (captured !== uid()) return;
    if (action === 'copy') {
      try { await navigator.clipboard.writeText(message.body); toast('Copied.'); }
      catch { await openSheet({ title: 'Copy text', body: html`<textarea class="input" readonly rows="5">${message.body}</textarea>` }); }
    }
    if (action === 'reply' && rows.some(m => m.id === id)) { reply = message; retry = null; paintReply(); $('chatInput')?.focus(); }
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
export function chatPanel() {
  if (owner !== uid()) reset();
  return html`<section class="chat-room" id="chatRoom" aria-label="Gym chat">
    <div class="chat-heading"><h2>Chat</h2><span class="muted small">Everyone</span></div>
    <div class="chat-messages" id="chatMessages" role="log" aria-label="Messages" aria-live="off" tabindex="0">${messageRows()}</div>
    <p class="chat-error small" id="chatError" role="status">${error}</p>
    <div id="chatReply">${replyMarkup()}</div><form class="chat-compose" id="chatForm"><label class="sr-only" for="chatInput">Message everyone</label><textarea class="input" id="chatInput" rows="2" maxlength="1000" placeholder="Message everyone…" enterkeyhint="send">${draft}</textarea><button type="submit" class="btn btn-primary" aria-label="Send message"${sending ? ' disabled' : ''}>Send</button></form>
  </section>`;
}
function paint({ bottom = false, older = false } = {}) {
  const list = $('chatMessages');
  if (!list || owner !== uid()) return;
  const height = list.scrollHeight, top = list.scrollTop;
  const follow = bottom || height - top - list.clientHeight < 80;
  render(list, messageRows());
  paintProfileBanners(list);
  if (older) list.scrollTop = top + list.scrollHeight - height;
  else if (follow) list.scrollTop = list.scrollHeight;
  if ($('chatError')) $('chatError').textContent = error;
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
    const retained = expanded && !older && page.length === 100 ? rows.filter(m => m.created_at < oldest.created_at || (m.created_at === oldest.created_at && m.id < oldest.id)) : [];
    const byId = new Map((older ? [...page, ...rows] : [...retained, ...page]).map(m => [m.id, m]));
    rows = [...byId.values()].sort((a, b) => a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id));
    if (older || !rows.length || rows.length <= 100) hasOlder = page.length === 100;
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
  on(root, 'input', '#chatInput', (e, input) => { draft = input.value; retry = null; });
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
      if (draft === text) { draft = ''; reply = null; paintReply(); if ($('chatInput')) $('chatInput').value = ''; }
      retry = null;
      await loadChat({ bottom: true });
    } catch (e) { if (captured === uid() && owner === captured) { error = e.message; paint(); } }
    finally { if (captured === owner) { sending = false; if (button.isConnected) button.disabled = false; } }
  });
  on(root, 'click', '[data-chat-older]', () => loadChat({ older: true }));
  on(root, 'click', '[data-chat-profile]', (event, button) => { if (!held) openMemberProfile(button.dataset.chatProfile); });
  on(root, 'click', '[data-cancel-reply]', () => { reply = null; retry = null; paintReply(); });
  const cancelHold = () => { clearTimeout(holdTimer); holdTimer = null; holdStart = null; };
  on(root, 'pointerdown', '[data-message]', (event, element) => {
    held = false;
    if (event.button !== 0 || event.target.closest('button')) return;
    cancelHold(); holdStart = { x: event.clientX, y: event.clientY };
    holdTimer = setTimeout(() => { held = true; holdTimer = null; messageMenu(element.dataset.message); }, 500);
  });
  root.addEventListener('pointermove', event => { if (holdStart && Math.hypot(event.clientX - holdStart.x, event.clientY - holdStart.y) > 10) cancelHold(); }, { passive: true });
  root.addEventListener('pointerup', cancelHold);
  root.addEventListener('pointercancel', cancelHold);
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
