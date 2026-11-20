import {html,on,toast} from '../core/dom.js';
import {listen,emit} from '../core/store.js';
import {fmtShort} from '../core/dates.js';
import {account} from '../cloud/sync.js';
import {announcementAdmin,loadAnnouncements as fetchAnnouncements,saveAnnouncement,deleteAnnouncement} from '../cloud/announcements.js';
import {openSheet,confirmDialog} from './sheet.js';
import {icons} from './icons.js';

let owner=null,posts=null,error='',loading=false;
export function announcementsPanel(){
 if(owner!==account.user?.id){owner=account.user?.id;posts=null;error='';}
 return html`<section class="announcements-panel" aria-label="Announcements">
  ${announcementAdmin()?html`<div class="announcements-toolbar"><span class="role-badge">Admin</span><button type="button" class="btn btn-primary" data-new-announcement>${icons.plus} New post</button></div>`:''}
  ${error?html`<div class="notice error" role="status">${error} <button type="button" class="link-btn inline" data-refresh-announcements>Try again</button></div>`:''}
  ${posts===null&&!error?html`<p class="muted small" role="status">Loading…</p>`:''}
  ${posts?.length===0?html`<div class="announcement-empty">${icons.announcement}<p>No announcements yet.</p></div>`:''}
  ${posts?.map(post=>html`<article class="card announcement-post" data-announcement="${post.id}" data-key="announcement-${post.id}">
   <header><div><span class="role-badge">Admin</span><time datetime="${post.created_at}">${fmtShort(post.created_at.slice(0,10))}</time></div>
   ${announcementAdmin()&&post.author_id===account.user?.id?html`<div class="announcement-actions"><button type="button" class="icon-btn sm" data-edit-announcement="${post.id}" aria-label="Edit announcement">${icons.edit}</button><button type="button" class="icon-btn sm" data-delete-announcement="${post.id}" aria-label="Remove announcement">${icons.x}</button></div>`:''}</header>
   <h2>${post.title}</h2><p class="announcement-body">${post.body}</p>
  </article>`)}
 </section>`;
}
export async function refreshAnnouncements(){
 const user=account.user?.id;if(!user||!account.ready||loading)return;
 if(owner!==user){owner=user;posts=null;error='';}
 loading=true;
 try{const rows=await fetchAnnouncements();if(account.user?.id!==user)return;posts=rows.filter(p=>typeof p.title==='string'&&typeof p.body==='string'&&/^\d{4}-\d{2}-\d{2}T/.test(p.created_at||''));error='';}
 catch(e){if(account.user?.id===user)error=e.message;}
 finally{loading=false;if(account.user?.id===user)emit('gym:announcements');else if(account.ready&&account.user)refreshAnnouncements();}
}
async function editPost(post){
 const user=account.user?.id;if(!user||!announcementAdmin())return;
 let off;const draftId=crypto.randomUUID();
 const result=await openSheet({title:post?'Edit announcement':'New announcement',className:'announcement-editor',
  body:html`<label class="field"><span>Title</span><input class="input" name="title" value="${post?.title||''}" maxlength="120" autocomplete="off" autofocus></label><label class="field"><span>Message</span><textarea class="input" name="body" rows="7" maxlength="4000">${post?.body||''}</textarea></label>`,
  actions:[{label:'Cancel',value:false,tone:'ghost'},{label:post?'Save':'Publish',tone:'primary',onClick:async(close,sheet,button)=>{
    if(account.user?.id!==user){close(false);return;}
    const values={title:sheet.elements.title.value.trim(),body:sheet.elements.body.value.trim()},status=sheet.querySelector('.form-status');
    if(!values.title||!values.body){status.textContent='Add a title and message.';return;}
    sheet.dataset.busy='true';button.disabled=true;button.textContent=post?'Saving…':'Publishing…';
    try{await saveAnnouncement({...values,id:draftId},post?.id,user,post?.updated_at);if(account.user?.id===user)close(true);else close(false);}
    catch(e){if(sheet.isConnected&&account.user?.id===user)status.textContent=e.message;}
    finally{if(sheet.isConnected){delete sheet.dataset.busy;button.disabled=false;button.textContent=post?'Save':'Publish';}}
  }}],onMount:(_sheet,close)=>{off=listen('gym:account',()=>{if(account.user?.id!==user)close(false);});}
 }).finally(()=>off?.());
 if(result&&account.user?.id===user){toast(post?'Announcement saved.':'Announcement published.');await refreshAnnouncements();}
}
export function initAnnouncements(page){
 on(page,'click','[data-new-announcement]',()=>editPost());
 on(page,'click','[data-edit-announcement]',(_e,b)=>editPost(posts?.find(p=>p.id===b.dataset.editAnnouncement)));
 on(page,'click','[data-refresh-announcements]',refreshAnnouncements);
 on(page,'click','[data-delete-announcement]',async(_e,b)=>{
  const user=account.user?.id,id=b.dataset.deleteAnnouncement;
  if(!announcementAdmin()||!await confirmDialog('Remove this announcement?',{title:'Remove announcement?',ok:'Remove',danger:true}))return;
  if(account.user?.id!==user)return;
  try{await deleteAnnouncement(id,user);if(account.user?.id!==user)return;toast('Announcement removed.');await refreshAnnouncements();}catch(e){if(account.user?.id===user)toast(e.message,{tone:'error'});}
 });
 listen('gym:account',()=>{if(owner!==account.user?.id){owner=account.user?.id;posts=null;error='';}});
}
