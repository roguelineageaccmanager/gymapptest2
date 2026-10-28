import { html, render } from '../core/dom.js';
import { listen } from '../core/store.js';
import { account } from '../cloud/sync.js';
import * as api from '../cloud/progress.js';
import { openSheet, confirmDialog } from './sheet.js';
import { openMemberProfile } from './profile.js';
export async function openProgressComments(photoId) {
 const owner=account.user?.id;if(!owner||!account.ready)return;
 let rows=[],older=false,loading=false,sending=false,closed=false,request=null,remove,interval,sequence=0;
 try {await openSheet({title:'Comments',className:'photo-comments-sheet',body:html`<div class="photo-comments-list" role="log" aria-label="Comments"></div><p class="photo-comments-status small" role="status"></p><div class="photo-comment-compose"><label class="sr-only" for="photoCommentInput">Write a comment</label><textarea class="input" id="photoCommentInput" maxlength="1000" rows="1" placeholder="Write a comment…"></textarea><button type="button" class="btn btn-soft" data-post-comment>Post</button></div>`,onMount(sheet,finish){
 const list=sheet.querySelector('.photo-comments-list'),input=sheet.querySelector('#photoCommentInput'),status=sheet.querySelector('.photo-comments-status'),post=sheet.querySelector('[data-post-comment]');
 const active=()=>!closed&&account.user?.id===owner&&account.ready;
 const paint=()=>render(list,html`${older?html`<button type="button" class="link-btn" data-older-comments>Earlier comments</button>`:''}${rows.length?rows.map(row=>html`<article class="photo-comment" data-key="comment-${row.id}"><header><button type="button" class="chat-author" data-comment-profile="${row.user_id}">@${row.username}</button><time datetime="${row.created_at}">${new Date(row.created_at).toLocaleDateString([],{month:'short',day:'numeric'})}</time>${row.user_id===owner?html`<button type="button" class="link-btn" data-remove-comment="${row.id}" aria-label="Delete your comment">···</button>`:''}</header><p>${row.body}</p></article>`):html`<p class="empty-inline">${loading?'Loading…':'No comments yet.'}</p>`}`);
 const load=async(more=false,bottom=false)=>{
  if(loading||!active())return;const token=++sequence;loading=true;
  const height=list.scrollHeight,top=list.scrollTop,follow=bottom||height-list.clientHeight-top<60;
  try{const page=await api.progressComments(photoId,more?rows[0]:null,owner);if(!active()||token!==sequence)return;
   rows=[...new Map((more?[...page,...rows]:page).map(row=>[row.id,row])).values()].sort((a,b)=>a.created_at.localeCompare(b.created_at)||a.id.localeCompare(b.id));
   if(more||rows.length<=30)older=page.length===30;status.textContent='';paint();
   if(more)list.scrollTop=top+list.scrollHeight-height;else if(follow)list.scrollTop=list.scrollHeight;
  }catch(e){if(active())status.textContent=e.message;}finally{if(active()&&token===sequence)loading=false;}
 };
 const send=async()=>{
  if(sending||!active()||!input.value.trim())return;
  const text=input.value;if(!request||request.body!==text)request={id:crypto.randomUUID(),body:text};
  sending=true;post.disabled=true;status.textContent='';
  try{await api.postProgressComment(photoId,request.id,text,owner);if(!active())return;if(input.value===text)input.value='';request=null;await load(false,true,true);}
  catch(e){if(active())status.textContent=e.message;}finally{if(active()){sending=false;post.disabled=false;}}
 };
 sheet.addEventListener('click',async event=>{
  if(event.target.closest('[data-post-comment]'))send();
  if(event.target.closest('[data-older-comments]'))load(true);
  const profile=event.target.closest('[data-comment-profile]');if(profile)openMemberProfile(profile.dataset.commentProfile);
  const button=event.target.closest('[data-remove-comment]');
  if(button&&active()&&await confirmDialog('Delete your comment?',{title:'Delete comment?',ok:'Delete',danger:true})&&active()){
   button.disabled=true;try{await api.deleteProgressComment(button.dataset.removeComment,owner);if(active())await load(false,false,true);}catch(e){if(active()){status.textContent=e.message;button.disabled=false;}}
  }
 });
 sheet.addEventListener('keydown',event=>{if(event.target===input&&event.key==='Enter'&&!event.shiftKey&&!event.isComposing){event.preventDefault();send();}});
 remove=listen('gym:account',()=>{if(account.user?.id!==owner)finish();});
 interval=setInterval(()=>{if(!document.hidden&&!sending&&!older)load();},15000);
 load(false,true);
 }});}finally{closed=true;sequence++;clearInterval(interval);remove?.();}
}
