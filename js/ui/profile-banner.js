import { html } from '../core/dom.js';
import { profileBanner } from '../cloud/profile-banners.js';

export function bannerMarkup(id, className = '') {
  const banner = profileBanner(id);
  return html`<span class="profile-banner ${className}" data-profile-banner="${id}" aria-hidden="true">${banner?.image_data ? html`<img src="${banner.image_data}" alt="">` : ''}</span>`;
}
export function paintProfileBanners(root) {
  root.querySelectorAll('[data-profile-banner]').forEach(el => {
    const banner = profileBanner(el.dataset.profileBanner);
    el.style.backgroundColor = banner?.color || '';
  });
}
