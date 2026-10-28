import { supabase, requestProgressPhotos, requestProgressReactions, requestProgressComments } from './client.js';
import { account } from './sync.js';
import { validProgressImage } from '../domain/progress.js';
import { cleanEmoji } from '../domain/emoji.js';
import { ymd, parseYmd } from '../core/dates.js';

async function session(expected) {
  const id = account.user?.id, { data, error } = await supabase.auth.getSession();
  if (error || !id || !account.ready || data.session?.user.id !== id || account.user?.id !== id || (expected && expected !== id)) throw new Error('Sign in again to post progress pictures.');
  return data.session;
}
export async function progressPhotos(before) { return requestProgressPhotos(await session(), 'GET', null, before); }
export async function postProgressPhoto(photo, expected) {
  if (!validProgressImage(photo.image_data) || !/^\d{4}-\d{2}-\d{2}$/.test(photo.photo_date) || ymd(parseYmd(photo.photo_date)) !== photo.photo_date || typeof photo.caption !== 'string' || photo.caption.length > 160) throw new Error('Check the picture, date and caption.');
  return requestProgressPhotos(await session(expected), 'POST', { ...photo, user_id: expected });
}
export async function deleteProgressPhoto(id, expected) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return;
  return requestProgressPhotos(await session(expected), 'DELETE', null, id);
}

const validId = id => typeof id === 'string' && /^[0-9a-f-]{36}$/i.test(id);
export async function progressReactions(ids, expected) {
  const chosen=[...new Set(ids.filter(validId))], token=await session(expected), result=[];
  for(let i=0;i<chosen.length;i+=30) result.push(...await requestProgressReactions(token,{ids:chosen.slice(i,i+30)}));
  return result;
}
export async function setProgressReaction(photoId,emoji,remove,expected) {
  if(!validId(photoId) || !cleanEmoji(emoji)) throw new Error('Choose a reaction.');
  return requestProgressReactions(await session(expected),{photoId,emoji:cleanEmoji(emoji),remove});
}

export async function progressComments(photoId,before,expected) {
 if(!validId(photoId))throw new Error('Picture not available.');
 return requestProgressComments(await session(expected),'GET',{photoId,before});
}
export async function postProgressComment(photoId,id,body,expected) {
 if(!validId(photoId)||!validId(id)||typeof body!=='string'||!body.trim()||body.trim().length>1000)throw new Error('Write a comment under 1,000 characters.');
 return requestProgressComments(await session(expected),'POST',{photoId,id,body:body.trim()});
}
export async function deleteProgressComment(id,expected) {
 if(!validId(id))throw new Error('Comment not available.');
 return requestProgressComments(await session(expected),'DELETE',{id});
}
