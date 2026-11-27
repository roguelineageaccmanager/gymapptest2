import { activityFor, activityLabel } from '../cloud/activity.js';
import { isYmd, parseYmd, relativeDay, ymd } from '../core/dates.js';
import { listen } from '../core/store.js';
import { html, avatar } from '../core/dom.js';
import { profileBanner } from '../cloud/profile-banners.js';
import { profilePicture } from '../cloud/profile-pictures.js';
import { inkFor } from '../domain/theme.js';

export function profileAvatar(name, size, id) {
  return html`<span class="profile-avatar" data-profile-avatar="${id}">${avatar(name, size, profilePicture(id))}</span>`;
}

function presenceKind(status) {
  if (status === 'Online') return 'online';
  if (status.startsWith('In workout')) return 'training';
  return 'offline';
}

export function presenceAvatar(name, size, id, status) {
  const presence = presenceKind(status);
  const label = status || 'Offline';
  return html`<span class="presence-avatar" data-member-avatar="${id}" data-status="${presence}">${profileAvatar(name, size, id)}<span class="presence-dot" data-presence="${presence}" role="img" title="${label}" aria-label="${label}"></span></span>`;
}

export function memberStatus(id, status, next) {
  const date = next?.workout_date;
  const days = isYmd(date) ? Math.round((Date.parse(date) - Date.parse(ymd())) / 86400000) : null;
  const when = days === null ? '' : days === 0 ? 'Today' : days === 1 ? 'Tomorrow' : days > 1 ? 'In ' + days + ' days' : relativeDay(parseYmd(date));
  return html`<small class="member-presence" data-member-status="${id}">${status || 'Offline'}</small>
    ${next && when ? html`<small class="member-next-workout">Next workout: ${next.workout_name} · <time datetime="${date}">${when}</time></small>` : ''}`;
}

listen('gym:presence', () => {
  const selector = '#page-crew.active, .member-profile-sheet';
  for (const root of document.querySelectorAll(selector)) {
    for (const label of root.querySelectorAll('[data-member-status]')) {
      const status = activityLabel(activityFor(label.dataset.memberStatus)) || 'Offline';
      if (label.textContent !== status) label.textContent = status;
    }
    for (const avatar of root.querySelectorAll('[data-member-avatar]')) {
      const status = activityLabel(activityFor(avatar.dataset.memberAvatar));
      const dot = avatar.querySelector('.presence-dot');
      const label = status || 'Offline';
      if (dot.title === label) continue;
      avatar.dataset.status = dot.dataset.presence = presenceKind(status);
      dot.title = label;
      dot.setAttribute('aria-label', label);
    }
  }
});

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
