import { it, expect } from 'vitest';
import { messagePayload, firebaseAccessToken } from '../../supabase/functions/chat-push/fcm.mjs';
import { cleanSettings, editPreferences, mergePreferences } from '../../js/domain/settings.js';

it('keeps chat notifications as a separate account preference', () => {
  expect(cleanSettings({ chatNotifications: true })).toEqual({ chatNotifications: true });
  expect(cleanSettings({ chatNotifications: 'true' })).toEqual({});
  expect(mergePreferences(editPreferences({}, { chatNotifications: false }, 20), editPreferences({}, { restTimers: true }, 10)).values).toEqual({ chatNotifications: false, restTimers: true });
});
it('sends bounded private chat notifications with a stable message tag and no training data', () => {
  const payload = messagePayload({ message_id: '00000000-0000-4000-8000-000000000001', username: 'avery', body: 'x'.repeat(300), privateWorkout: 'Never include' }, 'device-token');
  expect(payload.message.notification).toEqual({ title: '@avery', body: 'x'.repeat(160) });
  expect(payload.message.android.notification.visibility).toBe('PRIVATE');
  expect(payload.message.android.notification.tag).toBe('gym-chat-00000000-0000-4000-8000-000000000001');
  expect(payload.message.data.target).toBe('chat');
  expect(JSON.stringify(payload)).not.toContain('Never include');
});
it('authenticates the sender with a verified RS256 assertion scoped only to Firebase messaging', async () => {
  const pair = await crypto.subtle.generateKey({ name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' }, true, ['sign', 'verify']);
  const bytes = await crypto.subtle.exportKey('pkcs8', pair.privateKey);
  const service = { project_id: 'test-project', client_email: 'push@test-project.iam.gserviceaccount.com', private_key: '-----BEGIN PRIVATE KEY-----\n' + Buffer.from(bytes).toString('base64') + '\n-----END PRIVATE KEY-----' };
  const request = async (url, options) => {
    expect(url).toBe('https://oauth2.googleapis.com/token');
    const assertion = options.body.get('assertion'), [header, claims, signature] = assertion.split('.');
    expect(JSON.parse(Buffer.from(header, 'base64url'))).toEqual({ alg: 'RS256', typ: 'JWT' });
    const body = JSON.parse(Buffer.from(claims, 'base64url'));
    expect(body.iss).toBe(service.client_email); expect(body.scope).toBe('https://www.googleapis.com/auth/firebase.messaging');
    expect(body.exp - body.iat).toBe(3600);
    expect(await crypto.subtle.verify('RSASSA-PKCS1-v1_5', pair.publicKey, Buffer.from(signature, 'base64url'), new TextEncoder().encode(header + '.' + claims))).toBe(true);
    return Response.json({ access_token: 'synthetic-access-token' });
  };
  expect(await firebaseAccessToken(service, request, 100000)).toBe('synthetic-access-token');
});
