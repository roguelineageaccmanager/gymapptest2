import { html, avatar } from '../core/dom.js';
import { profileBanner } from '../cloud/profile-banners.js';
import { profilePicture } from '../cloud/profile-pictures.js';
import { inkFor } from '../domain/theme.js';

export function profileAvatar(name, size, id) {
  return html`<span class="profile-avatar" data-profile-avatar="${id}">${avatar(name, size, profilePicture(id))}</span>`;
}

export function presenceAvatar(name, size, id, status) {
  const presence = status === 'Online' ? 'online' : status.startsWith('In workout') ? 'training' : status ? 'offline' : 'unknown';
  const label = status || 'Unknown';
  return html`<span class="presence-avatar" data-status="${presence}">${profileAvatar(name, size, id)}<span class="presence-dot" data-presence="${presence}" role="img" title="${label}" aria-label="${label}"></span></span>`;
}

export function bannerMarkup(id, className = '') {
  const banner = profileBanner(id);
  return html`<span class="profile-banner ${className}" data-profile-banner="${id}" aria-hidden="true">${banner?.image_data ? html`<img src="${banner.image_data}" alt="">` : ''}</span>`;
}
export function paintProfileBanners(root) {
  root.querySelectorAll('[data-profile-banner]').forEach(el => {
    const banner = profileBanner(el.dataset.profileBanner);
    el.style.backgroundColor = banner?.color || '';
  });
  root.querySelectorAll('[data-profile-avatar]').forEach(el => {
    const color = profileBanner(el.dataset.profileAvatar)?.avatar_color, image = el.querySelector('.avatar');
    if (image) { image.style.backgroundColor = color || ''; image.style.color = color ? inkFor(color) : ''; }
  });
}
