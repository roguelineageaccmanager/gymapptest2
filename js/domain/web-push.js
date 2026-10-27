export function webPushEligibility({ ios, standalone, secure, apis, configured }) {
  if (ios && !standalone) return { supported: false, hint: 'Share → Add to Home Screen, then open Gym Tracker from its icon to enable notifications.' };
  if (!secure || !apis) return { supported: false, hint: ios ? 'Notifications need iOS/iPadOS 16.4 or later and the Home Screen app.' : 'Notifications are not supported in this browser.' };
  if (!configured) return { supported: false, hint: 'Web notifications are awaiting the Firebase web push setup.' };
  return { supported: true, hint: '' };
}
