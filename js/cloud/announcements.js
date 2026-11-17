import {supabase,boundedFetch} from './client.js';
import {account} from './sync.js';

const cfg=window.GYM_CLOUD_CONFIG||{};
let roleOwner=null,admin=false;
export const announcementAdmin=()=>roleOwner===account.user?.id&&admin;
async function sessionFor(owner){
 const{data,error}=await supabase.auth.getSession();
 if(error||!account.ready||account.user?.id!==owner||data.session?.user.id!==owner)throw new Error('The account changed.');
 return data.session;
}
async function request(session,path,options={}){
 const response=await boundedFetch(cfg.url.replace(/\/$/,'')+'/rest/v1/'+path,{...options,headers:{apikey:cfg.anonKey,Authorization:'Bearer '+session.access_token,'Content-Type':'application/json',Prefer:'return=minimal',...options.headers}});
 if(!response.ok){
  const e=await response.json().catch(()=>({}));
  if(['42P01','42883','PGRST202','PGRST205'].includes(e.code))throw new Error('Announcements aren’t available yet.');
  throw new Error(response.status===403?'You don’t have permission to publish announcements.':'Could not update announcements. Try again.');
 }
 return response.status===204?null:response.text().then(text=>text?JSON.parse(text):null);
}
export async function loadAnnouncementRole(){
 const owner=account.user?.id;
 if(!owner){roleOwner=null;admin=false;return false;}
 if(roleOwner!==owner){roleOwner=owner;admin=false;}
 const session=await sessionFor(owner);
 const result=await request(session,'rpc/announcement_admin',{method:'POST',body:'{}'});
 if(account.user?.id!==owner)throw new Error('The account changed.');
 roleOwner=owner;admin=result===true;return admin;
}
export async function loadAnnouncements(){
 const owner=account.user?.id,session=await sessionFor(owner);
 const [rows]=await Promise.all([request(session,'announcements?select=id,author_id,title,body,created_at,updated_at&order=created_at.desc,id.desc&limit=100'),loadAnnouncementRole()]);
 if(account.user?.id!==owner)throw new Error('The account changed.');
 return Array.isArray(rows)?rows:[];
}
export async function saveAnnouncement(values,id,owner,expectedAt){
 const session=await sessionFor(owner);
 if(!announcementAdmin())throw new Error('You don’t have permission to publish announcements.');
 const title=String(values.title||'').trim(),body=String(values.body||'').trim();
 if(!title||title.length>120||!body||body.length>4000)throw new Error('Add a title and message.');
 if(id&&!/^[0-9a-f-]{36}$/i.test(id))throw new Error('Invalid announcement.');
 const path=id?'announcements?id=eq.'+id+'&author_id=eq.'+owner+(expectedAt?'&updated_at=eq.'+encodeURIComponent(expectedAt):''):'announcements?on_conflict=id';
 const result=await request(session,path,{method:id?'PATCH':'POST',headers:{Prefer:id?'return=representation':'resolution=ignore-duplicates,return=minimal'},body:JSON.stringify({...(!id?{id:values.id||crypto.randomUUID(),author_id:owner}:{}),title,body})});
 if(id&&(!Array.isArray(result)||result.length!==1))throw new Error('This announcement changed. Reload it and try again.');
}
export async function deleteAnnouncement(id,owner){
 const session=await sessionFor(owner);
 if(!announcementAdmin()||!/^[0-9a-f-]{36}$/i.test(id))throw new Error('You don’t have permission to remove this announcement.');
 await request(session,'announcements?id=eq.'+id+'&author_id=eq.'+owner,{method:'DELETE'});
}
