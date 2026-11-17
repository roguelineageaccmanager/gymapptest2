// Retire chat delivery in updated clients without deleting historical messages.
import {supabase,requestChatPush} from './cloud/client.js';
import {account} from './cloud/sync.js';
import {state,saveSettings} from './state.js';
import {read,listen} from './core/store.js';
import {webPushBridge} from './web-push.js';

export function retireChat(){
 let cleanedFor=null,pending=false,deviceCleanup=null;
 const disableDevice=()=>deviceCleanup||=(async()=>{
  const c=window.Capacitor;
  if(c?.isNativePlatform?.()){
   const push=c.Plugins?.ChatPush||(c.isPluginAvailable?.('ChatPush')?c.registerPlugin('ChatPush'):null);
   await push?.unregister();
   const status=c.Plugins?.WorkoutStatus||(c.isPluginAvailable?.('WorkoutStatus')?c.registerPlugin('WorkoutStatus'):null);await status?.clearChatNotifications();
  }else await webPushBridge.unregister();
 })().catch(()=>{deviceCleanup=null;});
 const cleanup=async()=>{
  disableDevice();
  const owner=account.user?.id;
  if(state.settings.chatNotifications===true){state.settings.chatNotifications=false;saveSettings();}
  if(pending||!owner||!account.ready||cleanedFor===owner)return;
  pending=true;
  try{
   const{data}=await supabase.auth.getSession();
   if(account.user?.id!==owner||data.session?.user.id!==owner)return;
   const session=data.session;
   await requestChatPush(session,'settings',{user_id:owner,enabled:false});
   const install=read('gymChatPushInstall',null);
   if(account.user?.id!==owner)return;
   if(/^[0-9a-f-]{36}$/i.test(install?.id||''))await requestChatPush(session,'remove',{device_id:install.id});
   if(account.user?.id===owner)cleanedFor=owner;
  }catch{/* Offline/older database: retry on the next ready/online event. */}
  finally{pending=false;if(account.user?.id&&account.user.id!==owner)cleanup();}
 };
 listen('gym:account',cleanup);window.addEventListener('online',cleanup);cleanup();
 const url=new URL(location.href);if(url.searchParams.get('open')==='chat'){url.searchParams.delete('open');history.replaceState(history.state,'',url.pathname+url.search+url.hash);}
}
