import { EMOJIS } from '../../vendor/emoji-data.js';
export { EMOJIS };
const canonical = new Map(EMOJIS.map(([emoji]) => [emoji.replace(/\ufe0f/g, ''), emoji]));
export function cleanEmoji(value) {
  if (typeof value !== 'string' || value.length > 64) return '';
  return canonical.get(value.trim().replace(/\ufe0f/g, '')) || '';
}
