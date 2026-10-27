// Reproducible, pinned SDK bundles; no CDN scripts in the app or worker.
import { build } from 'esbuild';
import { readFileSync } from 'node:fs';
const version = ['app','messaging'].map(name => name + ' ' + JSON.parse(readFileSync('node_modules/@firebase/' + name + '/package.json', 'utf8')).version).join(' / ');
await build({ stdin: { contents: "export {initializeApp,getApps} from '@firebase/app';export {getMessaging,getToken,deleteToken,onMessage,isSupported} from '@firebase/messaging';", resolveDir: process.cwd() }, bundle: true, minify: true, format: 'esm', platform: 'browser', target: ['es2020'], outfile: 'vendor/firebase-messaging.js', banner: { js: `/*! Firebase JS SDK ${version} | Apache-2.0 | tools/vendor-firebase.mjs */` } });
await build({ stdin: { contents: `import {initializeApp} from '@firebase/app';import {getMessaging,onBackgroundMessage} from '@firebase/messaging/sw';import {FIREBASE_WEB_CONFIG} from './js/firebase-config.js';
const messaging=getMessaging(initializeApp(FIREBASE_WEB_CONFIG,'gym-tracker-web'));
onBackgroundMessage(messaging,payload=>{if(!payload.notification&&payload.data?.target==='chat')return self.registration.showNotification(String(payload.data.title||'New chat message').slice(0,80),{body:String(payload.data.body||'').slice(0,160),tag:'gym-chat',icon:new URL('icon-192.png',self.registration.scope).href,data:{gymTarget:'chat'}});});`, resolveDir: process.cwd() }, bundle: true, minify: true, format: 'iife', platform: 'browser', target: ['es2020'], outfile: 'vendor/firebase-messaging-worker.js', banner: { js: `/*! Firebase JS SDK ${version} | Apache-2.0 | tools/vendor-firebase.mjs */` } });
readFileSync('vendor/firebase-LICENSE.txt');
console.log('Vendored Firebase messaging only:', version);
