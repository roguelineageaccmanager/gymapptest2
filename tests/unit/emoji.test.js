import { it, expect } from 'vitest';
import { cleanEmoji } from '../../js/domain/emoji.js';
it('accepts keyboard emoji sequences including skin tones, families, flags and keycaps',()=>{
 for(const emoji of ['🥰','👍🏽','👨‍👩‍👧‍👦','🇷🇴','1️⃣','🏳️‍🌈','🫩'])expect(cleanEmoji(emoji)).toBe(emoji);
});
it('canonicalizes text-style keyboard variants and rejects multiple emojis or markup',()=>{
 expect(cleanEmoji(' ❤ ')).toBe('❤️');expect(cleanEmoji('☀')).toBe('☀️');
 for(const bad of ['🔥🔥','<img src=x>','hello','',null,'🇷'])expect(cleanEmoji(bad)).toBe('');
});
