import { html, render } from '../core/dom.js';
import { listen } from '../core/store.js';
import { restImage, setRestImage } from '../state.js';
import { account } from '../cloud/sync.js';
import { openSheet } from './sheet.js';

async function resize(file) {
  if ((file.type && !/^image\/(jpeg|png|webp|gif)$/i.test(file.type)) || file.size > 10 * 1024 * 1024) throw new Error('Choose a JPEG, PNG or WebP under 10 MB.');
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  try {
    const scale = Math.min(1, 1000 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas'); canvas.width = Math.max(1, Math.round(bitmap.width * scale)); canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const ctx = canvas.getContext('2d'); ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, canvas.width, canvas.height); ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', .82);
  } finally { bitmap.close(); }
}
export async function editRestDay() {
  const id = account.user?.id || null;
  let closed = false, busy = false, error = '', removeListener;
  try {
    await openSheet({ title: 'Rest day', className: 'rest-day-sheet', actions: [{ label: 'Done', tone: 'primary', value: true }],
      onMount: (sheet, close) => {
        const body = sheet.querySelector('.sheet-body');
        const paint = () => { if (!closed) render(body, html`<img class="rest-day-preview" src="${restImage()}" alt="Rest day picture"><div class="btn-row"><button type="button" class="btn btn-soft" data-rest-choose${busy ? ' disabled' : ''}>${busy ? 'Saving…' : 'Choose picture'}</button><button type="button" class="btn btn-ghost" data-rest-reset${busy ? ' disabled' : ''}>Reset</button></div><input type="file" data-rest-file accept="image/jpeg,image/png,image/webp,image/gif" hidden><p class="form-error" role="status">${error}</p>`); };
        body.addEventListener('click', event => {
          if (event.target.closest('[data-rest-choose]') && !busy) body.querySelector('[data-rest-file]').click();
          if (event.target.closest('[data-rest-reset]') && !busy && (account.user?.id || null) === id) { setRestImage(null); paint(); }
        });
        body.addEventListener('change', async event => {
          if (!event.target.matches('[data-rest-file]') || busy) return;
          const file = event.target.files?.[0]; if (!file) return;
          busy = true; error = ''; paint();
          try {
            const image = await resize(file);
            if ((account.user?.id || null) !== id) return;
            if (!setRestImage(image)) throw new Error('The picture could not be saved. Free some storage and try again.');
          } catch (e) { error = e.message; }
          finally { busy = false; paint(); }
        });
        removeListener = listen('gym:account', () => { if ((account.user?.id || null) !== id) close(); });
        paint();
      },
    });
  } finally { closed = true; removeListener?.(); }
}
