import { html, render } from '../core/dom.js';
import { EMOJIS, cleanEmoji } from '../domain/emoji.js';
import { openSheet } from './sheet.js';
const popular=['💪','🔥','❤️','👏','👍','💯','😂','😍','🥰','🤩','😎','😤','🫡','🤝','🙌','🏆','🥇','⚡','🚀','👑','🦾','🎯','💥','🫶'];
const groups=[['Popular','Popular'],['All','All'],['Smileys & Emotion','Smileys'],['People & Body','People'],['Animals & Nature','Animals'],['Food & Drink','Food'],['Travel & Places','Travel'],['Activities','Activities'],['Objects','Objects'],['Symbols','Symbols'],['Flags','Flags']];
export function pickEmoji() {
 let group='Popular',query='',shown=96;
 return openSheet({title:'React',className:'emoji-picker',body:html`<label class="sr-only" for="emojiSearch">Search or type an emoji</label><input class="input" id="emojiSearch" placeholder="Search or type an emoji" autocomplete="off" maxlength="80"><div class="emoji-categories chips" aria-label="Emoji categories"></div><div class="emoji-results"></div>`,onMount(sheet,finish){
 const paint=()=>{
  render(sheet.querySelector('.emoji-categories'),html`${groups.map(([id,name])=>html`<button type="button" class="chip${group===id?' on':''}" data-emoji-group="${id}" aria-pressed="${group===id}">${name}</button>`)}`);
  const typed=cleanEmoji(query),matches=query?EMOJIS.filter(([emoji,name])=>emoji===typed||name.toLowerCase().includes(query.toLowerCase())):group==='Popular'?popular.map(emoji=>EMOJIS.find(row=>row[0]===emoji)).filter(Boolean):EMOJIS.filter(row=>group==='All'||row[2]===group);
  render(sheet.querySelector('.emoji-results'),html`${typed?html`<button type="button" class="btn btn-soft emoji-use" data-reaction-choice="${typed}">Use ${typed}</button>`:''}<div class="reaction-choices">${matches.slice(0,shown).map(([emoji,name])=>html`<button type="button" data-reaction-choice="${emoji}" aria-label="React ${emoji}" title="${name}">${emoji}</button>`)}</div>${matches.length>shown?html`<button type="button" class="link-btn" data-emoji-more>More emojis</button>`:''}${!matches.length?html`<p class="empty-inline">No matching emoji.</p>`:''}`);
 };
 sheet.addEventListener('input',event=>{if(event.target.id==='emojiSearch'){query=event.target.value.trim();shown=96;paint();}});
 sheet.addEventListener('click',event=>{const choice=event.target.closest('[data-reaction-choice]'),category=event.target.closest('[data-emoji-group]');if(choice)finish(choice.dataset.reactionChoice);if(category){group=category.dataset.emojiGroup;query='';sheet.querySelector('#emojiSearch').value='';shown=96;paint();}if(event.target.closest('[data-emoji-more]')){shown+=96;paint();}});
 paint();
 }});
}
