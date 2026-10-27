import { $, html, render, on, toast } from '../core/dom.js';
import { listen } from '../core/store.js';
import { ymd, fmtShort } from '../core/dates.js';
import { refresh, currentPage } from '../core/router.js';
import { account } from '../cloud/sync.js';
import { loadProfilePictures } from '../cloud/profile-pictures.js';
import { loadProfileBanners } from '../cloud/profile-banners.js';
import { profileAvatar, paintProfileBanners } from './profile-banner.js';
import { openMemberProfile } from './profile.js';
import { validProgressImage, prepareProgressImage, PROGRESS_REACTIONS } from '../domain/progress.js';
import * as api from '../cloud/progress.js';
import { openSheet, confirmDialog, markBusy } from './sheet.js';
import { icons } from './icons.js';
import { isNativeApp } from '../native.js';

let reactions=[], reactionRevision=0;
const reactionPending=new Set();
let owner, rows = [], loading = false, error = '', older = false, revision = 0, queued = false;
function reset() { if (owner !== account.user?.id) { owner = account.user?.id; rows = []; reactions=[]; reactionRevision++; error = ''; older = false; revision++; } }
function reactionBar(photoId) {
  return html`<div class="photo-reactions" role="group" aria-label="Picture reactions">${PROGRESS_REACTIONS.map(emoji=>{
    const item=reactions.find(r=>r.photo_id===photoId && r.emoji===emoji);
    return item?.reaction_count > 0 ? html`<button type="button" class="photo-reaction${item.mine ? ' selected' : ''}" data-key="reaction-${photoId}-${emoji}" data-photo-reaction="${photoId}" data-emoji="${emoji}" aria-pressed="${item.mine ? 'true' : 'false'}" aria-label="${emoji}: ${item.reaction_count} reactions${item.mine ? ', including yours' : ''}"${reactionPending.has(owner+':'+photoId) ? ' disabled' : ''}><span>${emoji}</span><b>${item.reaction_count}</b></button>` : '';
  })}<button type="button" class="photo-reaction add-reaction" data-add-reaction="${photoId}" aria-label="Add reaction"${reactionPending.has(owner+':'+photoId) ? ' disabled' : ''}>☺ +</button></div>`;
}
async function refreshReactions(ids=rows.map(row=>row.id)) {
  const user=owner,rev=reactionRevision;
  const result=await api.progressReactions(ids,user);
  if(user!==account.user?.id || rev!==reactionRevision) return;
  const selected=new Set(ids); reactions=[...reactions.filter(r=>!selected.has(r.photo_id)),...result];
}
async function toggleReaction(photoId,emoji) {
  const user=owner,key=user+':'+photoId;
  if(!user || reactionPending.has(key) || !rows.some(r=>r.id===photoId)) return;
  const remove=!!reactions.find(r=>r.photo_id===photoId && r.emoji===emoji)?.mine;
  reactionPending.add(key); reactionRevision++; repaint();
  try {
    await api.setProgressReaction(photoId,emoji,remove,user);
    if(account.user?.id!==user) return;
    await refreshReactions([photoId]);
  } catch(e) { if(account.user?.id===user) toast(e.message,{tone:'error'}); }
  finally { reactionPending.delete(key); if(account.user?.id===user) repaint(); }
}
export function progressPanel() {
  reset();
  if (!owner) return html`<section class="card empty"><h2>Progress pictures</h2><button type="button" class="btn btn-soft" data-open-settings>Sign in</button></section>`;
  return html`<section class="progress-heading"><div><h2>Progress pictures</h2><small class="muted">Friends only</small></div><button type="button" class="btn btn-soft btn-sm" data-add-progress>${icons.plus} Add picture</button></section>
    ${error ? html`<p class="notice error">${error} <button type="button" class="link-btn inline" data-refresh-progress>Try again</button></p>` : ''}
    <div class="progress-feed">${rows.filter(row => validProgressImage(row.image_data)).map(row => html`<article class="progress-post" data-key="photo-${row.id}"><header><button type="button" class="friend-profile-link" data-progress-profile="${row.user_id}" aria-label="View @${row.owner?.username || 'friend'} profile">${profileAvatar(row.owner?.username, 'sm', row.user_id)}<b>@${row.owner?.username || account.profile?.username || 'friend'}</b></button><time datetime="${row.photo_date}">${fmtShort(row.photo_date)}</time></header><button type="button" class="progress-image-button" data-open-progress="${row.id}" aria-label="View progress picture from ${fmtShort(row.photo_date)}"><img src="${row.image_data}" alt="Progress picture" loading="lazy"></button>${row.caption ? html`<p>${row.caption}</p>` : ''}${reactionBar(row.id)}</article>`)}</div>
    ${!rows.length ? html`<div class="empty-inline"><p>${loading ? 'Loading pictures…' : 'No progress pictures yet.'}</p></div>` : ''}
    ${older ? html`<button type="button" class="btn btn-soft btn-block" data-more-progress${loading ? ' disabled' : ''}>${loading ? 'Loading…' : 'Earlier pictures'}</button>` : ''}`;
}
function repaint() { if (currentPage() === 'stats') { refresh('stats'); paintProfileBanners($('page-stats')); } }
export async function loadProgress({ more = false } = {}) {
  reset(); if (!owner || !account.ready) return;
  if (loading) { if (!more) queued = true; return; }
  const id = owner, version = revision; loading = true;
  try {
    const page = await api.progressPhotos(more ? rows.at(-1) : null);
    if (account.user?.id !== id || version !== revision) return;
    rows = more ? [...new Map([...rows, ...page].map(row => [row.id, row])).values()] : page;
    older = page.length === 30; error = '';
    await refreshReactions(page.map(row=>row.id));
    await Promise.all([loadProfilePictures(page.map(row => row.user_id)), loadProfileBanners(page.map(row => row.user_id))]);
  } catch (e) { if (account.user?.id === id && version === revision) error = e.message; }
  finally { if(account.user?.id===id && version===revision) {loading=false;repaint();if(queued){queued=false;loadProgress();}} }
}
function cameraFile(data) {
  if (typeof data !== 'string' || data.length > 14 * 1024 * 1024 || !/^data:image\/jpeg;base64,[A-Za-z0-9+/]+=*$/.test(data)) throw new Error('Invalid camera picture');
  const bytes = Uint8Array.from(atob(data.split(',')[1]), c => c.charCodeAt(0));
  return new File([bytes], 'camera.jpg', { type: 'image/jpeg' });
}
async function addPicture() {
  const id = account.user?.id;
  if (!id || !account.ready) return;
  let image = '', preparation = 0, requestId = crypto.randomUUID(), remove, dismissed = false;
  try {
    await openSheet({ title: 'Progress picture', className: 'progress-editor', body: html`<div class="progress-picture-preview" data-progress-preview>${icons.image}</div><div class="btn-row"><button type="button" class="btn btn-soft" data-progress-camera>Take picture</button><button type="button" class="btn btn-soft" data-progress-choose>Choose picture</button></div><input type="file" accept="image/jpeg,image/png,image/webp" data-progress-file hidden><input type="file" accept="image/*" capture="environment" data-progress-capture hidden><label class="field"><span>Date</span><input class="input" type="date" name="date" value="${ymd()}"></label><label class="field"><span>Caption</span><textarea class="input" name="caption" maxlength="160" rows="2" placeholder="Optional"></textarea></label><p class="muted small">Visible to your accepted friends.</p><p class="form-error" role="status"></p>`,
      actions: [{ label: 'Post picture', submit: true, onClick: async (close, sheet, button) => {
        if (!image) { sheet.querySelector('.form-error').textContent = 'Choose a picture first.'; return; }
        if (account.user?.id !== id) { close(); return; }
        const done = markBusy(sheet, button, 'Posting…');
        sheet.querySelectorAll('[data-progress-camera], [data-progress-choose]').forEach(b => { b.disabled = true; });
        try {
          await api.postProgressPhoto({ id: requestId, image_data: image, photo_date: sheet.elements.date.value, caption: sheet.elements.caption.value.trim() }, id);
          if (account.user?.id === id) { close(); toast('Picture posted.'); loadProgress(); }
        } catch (e) { if (account.user?.id === id) sheet.querySelector('.form-error').textContent = e.message; }
        finally { done(); sheet.querySelectorAll('[data-progress-camera], [data-progress-choose]').forEach(b => { b.disabled = false; }); }
      } }],
      onMount(sheet, close) {
        remove = listen('gym:account', () => { if (account.user?.id !== id) close(); });
        const file = sheet.querySelector('[data-progress-file]'), capture = sheet.querySelector('[data-progress-capture]');
        const apply = async selected => {
          if (!selected) return;
          const current = ++preparation;
          const button = sheet.querySelector('[type=submit]'); button.disabled = true;
          try {
            const prepared = await prepareProgressImage(selected);
            if (dismissed || current !== preparation || !sheet.isConnected || account.user?.id !== id) return;
            image = prepared; requestId = crypto.randomUUID();
            render(sheet.querySelector('[data-progress-preview]'), html`<img src="${image}" alt="Picture to post">`);
            sheet.querySelector('.form-error').textContent = '';
          } catch (e) { if (!dismissed && account.user?.id === id) sheet.querySelector('.form-error').textContent = e.message; }
          finally { if (current === preparation) { button.disabled = false; file.value = ''; capture.value = ''; } }
        };
        file.onchange = () => apply(file.files[0]); capture.onchange = () => apply(capture.files[0]);
        sheet.querySelector('[data-progress-choose]').onclick = () => file.click();
        sheet.querySelector('[data-progress-camera]').onclick = async () => {
          const c = window.Capacitor;
          if (!isNativeApp() || !c.isPluginAvailable?.('ProgressPhoto')) { capture.click(); return; }
          try {
            const camera = c.Plugins?.ProgressPhoto || c.registerPlugin('ProgressPhoto');
            const result = await camera.takePicture();
            if (!dismissed && account.user?.id === id) await apply(cameraFile(result.dataUrl));
          } catch (e) { if (!dismissed && account.user?.id === id && !/cancel/i.test(e.message)) sheet.querySelector('.form-error').textContent = 'Could not open the camera. Choose a picture instead.'; }
        };
      },
    });
  } finally { dismissed = true; remove?.(); image = ''; }
}
async function openPicture(photoId) {
  const row = rows.find(photo => photo.id === photoId), id = account.user?.id;
  if (!row || !id) return;
  let remove;
  try {
    const action = await openSheet({ title: fmtShort(row.photo_date), className: 'progress-viewer', body: html`<img class="progress-full-image" src="${row.image_data}" alt="Progress picture"><p>${row.caption}</p>`,
      actions: row.user_id === id ? [{ label: 'Delete picture', value: 'delete', tone: 'danger' }] : [],
      onMount(sheet, close) { remove = listen('gym:account', () => { if (account.user?.id !== id) close(); }); },
    });
    if (action !== 'delete' || account.user?.id !== id || !await confirmDialog('Delete this progress picture?', { title: 'Delete picture?', ok: 'Delete', danger: true }) || account.user?.id !== id) return;
    await api.deleteProgressPhoto(photoId, id);
    if (account.user?.id === id) { rows = rows.filter(row => row.id !== photoId); repaint(); }
  } catch (e) { if (account.user?.id === id) toast(e.message, { tone: 'error' }); }
  finally { remove?.(); }
}
export function initProgress(root) {
  on(root,'click','[data-photo-reaction]',(event,button)=>toggleReaction(button.dataset.photoReaction,button.dataset.emoji));
  on(root,'click','[data-add-reaction]',async(event,button)=>{
    const user=owner,photoId=button.dataset.addReaction;
    const emoji=await openSheet({title:'React',className:'reaction-picker',body:html`<div class="reaction-choices">${PROGRESS_REACTIONS.map(emoji=>html`<button type="button" data-reaction-choice="${emoji}" aria-label="React ${emoji}">${emoji}</button>`)}</div>`,onMount(sheet,finish){sheet.addEventListener('click',event=>{const choice=event.target.closest('[data-reaction-choice]');if(choice)finish(choice.dataset.reactionChoice);});}});
    if(emoji && account.user?.id===user) await toggleReaction(photoId,emoji);
  });
  setInterval(()=>{if(!document.hidden && currentPage()==='stats' && document.querySelector('[data-add-progress]') && !reactionPending.size)refreshReactions().then(repaint).catch(()=>{});},15000);

  on(root, 'click', '[data-add-progress]', addPicture);
  on(root, 'click', '[data-refresh-progress]', () => loadProgress());
  on(root, 'click', '[data-more-progress]', () => loadProgress({ more: true }));
  on(root, 'click', '[data-open-progress]', (e, button) => openPicture(button.dataset.openProgress));
  on(root, 'click', '[data-progress-profile]', (e, button) => openMemberProfile(button.dataset.progressProfile));
  listen('gym:account', () => { reset(); if (currentPage() === 'stats' && document.querySelector('[data-add-progress]')) loadProgress(); });
  listen('gym:crew-updated', () => { if (currentPage() === 'stats' && document.querySelector('[data-add-progress]')) loadProgress(); });
  document.addEventListener('visibilitychange', () => { if (!document.hidden && currentPage() === 'stats' && document.querySelector('[data-add-progress]')) loadProgress(); });
}
