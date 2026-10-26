import { $, html, render, on, toast } from '../core/dom.js';
import { listen } from '../core/store.js';
import { currentPage } from '../core/router.js';
import { account } from '../cloud/sync.js';
import * as api from '../cloud/chat.js';
import { icons } from './icons.js';

let rows = [], owner = null, draft = '', error = '', loading = false, sending = false, hasOlder = false, initialized = false;
let retry = null;
let followup = false;
let expanded = false;
const uid = () => account.user?.id;
function reset() {
  owner = uid(); rows = []; draft = ''; error = ''; loading = false; sending = false; retry = null; hasOlder = false; followup = false; expanded = false;
}
function messageRows() {
  return html`${hasOlder ? html`<button type="button" class="btn btn-ghost btn-sm chat-older" data-chat-older>Earlier messages</button>` : ''}
    ${rows.length ? rows.map(m => html`<article class="chat-message${m.user_id === uid() ? ' mine' : ''}" data-key="message-${m.id}">
      <div class="chat-message-meta"><b>${m.user_id === uid() ? 'You' : '@' + m.username}</b><time datetime="${m.created_at}">${new Date(m.created_at).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</time>${m.user_id === uid() ? html`<button type="button" class="icon-btn sm" data-delete-message="${m.id}" aria-label="Delete your message">${icons.x}</button>` : ''}</div>
      <p>${m.body}</p></article>`) : html`<div class="chat-empty">${loading ? 'Loading…' : 'Start the conversation.'}</div>`}`;
}
export function chatPanel() {
  if (owner !== uid()) reset();
  return html`<section class="chat-room" id="chatRoom" aria-label="Gym chat">
    <div class="chat-heading"><h2>Gym chat</h2><span class="muted small">Everyone</span></div>
    <div class="chat-messages" id="chatMessages" role="log" aria-label="Messages" aria-live="off" tabindex="0">${messageRows()}</div>
    <p class="chat-error small" id="chatError" role="status">${error}</p>
    <form class="chat-compose" id="chatForm"><label class="sr-only" for="chatInput">Message everyone</label><textarea class="input" id="chatInput" rows="2" maxlength="1000" placeholder="Message everyone…" enterkeyhint="send">${draft}</textarea><button type="submit" class="btn btn-primary" aria-label="Send message"${sending ? ' disabled' : ''}>Send</button></form>
  </section>`;
}
function paint({ bottom = false, older = false } = {}) {
  const list = $('chatMessages');
  if (!list || owner !== uid()) return;
  const height = list.scrollHeight, top = list.scrollTop;
  const follow = bottom || height - top - list.clientHeight < 80;
  render(list, messageRows());
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
    const captured = uid(), text = draft;
    const id = retry?.text === text ? retry.id : crypto.randomUUID();
    retry = { id, text }; sending = true;
    const button = $('chatForm').querySelector('[type=submit]'); button.disabled = true;
    try {
      await api.sendMessage(id, text, captured);
      if (captured !== uid() || owner !== captured) return;
      if (draft === text) { draft = ''; if ($('chatInput')) $('chatInput').value = ''; }
      retry = null;
      await loadChat({ bottom: true });
    } catch (e) { if (captured === uid() && owner === captured) { error = e.message; paint(); } }
    finally { if (captured === owner) { sending = false; if (button.isConnected) button.disabled = false; } }
  });
  on(root, 'click', '[data-chat-older]', () => loadChat({ older: true }));
  on(root, 'click', '[data-delete-message]', async (e, button) => {
    const captured = uid(), id = button.dataset.deleteMessage;
    if (!rows.some(m => m.id === id && m.user_id === captured)) return;
    button.disabled = true;
    try {
      await api.removeMessage(id, captured);
      if (captured === uid() && owner === captured) { rows = rows.filter(m => m.id !== id); paint(); }
    } catch (e) { if (captured === uid()) toast(e.message, { tone: 'error' }); }
    finally { if (button.isConnected) button.disabled = false; }
  });
  listen('gym:account', () => { if (owner !== uid()) reset(); });
  setInterval(() => {
    if (!document.hidden && currentPage() === 'crew' && $('chatRoom')) loadChat();
  }, 5000);
}
