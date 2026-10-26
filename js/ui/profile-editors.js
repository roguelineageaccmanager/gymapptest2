import { html, render, busyAttr } from '../core/dom.js';
import { listen } from '../core/store.js';
import { account } from '../cloud/sync.js';
import { profilePicture, saveProfilePicture, prepareProfilePicture } from '../cloud/profile-pictures.js';
import { profileBanner, saveProfileBanner, prepareBannerImage } from '../cloud/profile-banners.js';
import { bannerMarkup, paintProfileBanners, profileAvatar } from './profile-banner.js';
import { openSheet } from './sheet.js';

export async function editProfileAppearance(kind) {
  const id = account.user?.id;
  if (!id || !account.ready) return;
  const picture = kind === 'picture';
  let busy = false, error = '', closed = false, removeAccountListener;
  const banner = () => profileBanner(id) || { color: '#343456', image_data: null, avatar_color: null };
  try {
    await openSheet({ title: picture ? 'Edit picture' : 'Edit banner', className: 'profile-edit-sheet',
      actions: [{ label: 'Done', tone: 'primary', value: true }],
      onMount: (sheet, close) => {
        const body = sheet.querySelector('.sheet-body');
        const paint = () => {
          if (closed || account.user?.id !== id) return;
          const image = picture ? profilePicture(id) : banner().image_data;
          render(body, html`<div class="profile-editor-preview">${picture ? profileAvatar(account.profile?.username, 'lg', id) : bannerMarkup(id, 'profile-hero-banner')}</div>
            <div class="btn-row"><button type="button" class="btn btn-soft" data-editor-choose${busyAttr(busy)}>${busy ? 'Saving…' : 'Choose image'}</button>${image ? html`<button type="button" class="btn btn-ghost" data-editor-remove${picture ? html` data-remove-profile-picture` : ''}${busyAttr(busy)}>Remove image</button>` : ''}</div>
            <label class="banner-color-label profile-editor-color">Color<input type="color" data-editor-color value="${picture ? banner().avatar_color || '#343456' : banner().color}"${busy ? ' disabled' : ''}></label>
            <input type="file" data-editor-file${picture ? html` data-profile-picture-file` : html` data-banner-file`} accept="image/jpeg,image/png,image/webp" hidden>
            <p class="form-error" role="status">${error}</p>`);
          paintProfileBanners(body);
        };
        async function act(action) {
          if (busy || account.user?.id !== id) return;
          busy = true; error = ''; paint();
          try { await action(); }
          catch (e) { error = e.message; }
          finally { busy = false; paint(); }
        }
        body.addEventListener('click', event => {
          if (event.target.closest('[data-editor-choose]') && !busy) body.querySelector('[data-editor-file]').click();
          if (event.target.closest('[data-editor-remove]')) act(() => picture ? saveProfilePicture(null, id) : saveProfileBanner({ ...banner(), image_data: null }, id));
        });
        body.addEventListener('change', event => {
          if (event.target.matches('[data-editor-file]')) {
            const file = event.target.files?.[0];
            if (file) act(async () => {
              if (picture) await saveProfilePicture(await prepareProfilePicture(file), id);
              else await saveProfileBanner({ ...banner(), image_data: await prepareBannerImage(file) }, id);
            });
          }
          if (event.target.matches('[data-editor-color]')) {
            const color = event.target.value;
            act(async () => {
              await saveProfileBanner(picture ? { ...banner(), avatar_color: color } : { ...banner(), color, image_data: null }, id);
              if (picture) await saveProfilePicture(null, id);
            });
          }
        });
        removeAccountListener = listen('gym:account', () => { if (account.user?.id !== id) close(); });
        paint();
      },
    });
  } finally { closed = true; removeAccountListener?.(); }
}
