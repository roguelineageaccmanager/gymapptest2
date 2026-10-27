import { it, expect } from 'vitest';
import { webPushEligibility } from '../../js/domain/web-push.js';
import { invalidDeviceFailure, messagePayload } from '../../supabase/functions/chat-push/fcm.mjs';

it('requires the Home Screen app on iOS and never promises support without APIs', () => {
  const ready = { ios: true, standalone: true, secure: true, apis: true, configured: true };
  expect(webPushEligibility(ready).supported).toBe(true);
  expect(webPushEligibility({ ...ready, standalone: false }).hint).toContain('Add to Home Screen');
  expect(webPushEligibility({ ...ready, apis: false }).supported).toBe(false);
  expect(webPushEligibility({ ...ready, secure: false }).supported).toBe(false);
  expect(webPushEligibility({ ...ready, configured: false }).supported).toBe(false);
});
it('targets only Gym Tracker chat and preserves Android privacy', () => {
  const { message } = messagePayload({ message_id: '00000000-0000-4000-8000-000000000001', username: 'sam', body: 'hi', url: 'https://attacker.invalid' }, 'synthetic');
  expect(message.webpush.fcm_options.link).toBe('https://roguelineageaccmanager.github.io/gymapptest2/?open=chat');
  expect(message.webpush.headers.TTL).toBe('86400');
  expect(message.android.notification.visibility).toBe('PRIVATE');
  expect(JSON.stringify(message)).not.toContain('attacker');
});
it('does not remove valid devices for unrelated payload errors', () => {
  expect(invalidDeviceFailure({ error: { details: [{ errorCode: 'UNREGISTERED' }] } })).toBe(true);
  expect(invalidDeviceFailure({ error: { status: 'INVALID_ARGUMENT', message: 'Invalid notification title' } })).toBe(false);
});
