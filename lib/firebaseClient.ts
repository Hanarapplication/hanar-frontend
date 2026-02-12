/**
 * Firebase client for FCM web push (PWA).
 * Uses env placeholders; do not hardcode secrets.
 */
import { getApp, getApps, initializeApp, type FirebaseApp } from 'firebase/app';
import { getMessaging, isSupported, type Messaging } from 'firebase/messaging';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

let app: FirebaseApp | null = null;
let messaging: Messaging | null = null;

export function getFirebaseApp(): FirebaseApp | null {
  if (typeof window === 'undefined') return null;
  if (app) return app;
  const hasRequired =
    firebaseConfig.apiKey &&
    firebaseConfig.projectId &&
    firebaseConfig.messagingSenderId &&
    firebaseConfig.appId;
  if (!hasRequired) return null;
  app = getApps().length > 0 ? (getApp() as FirebaseApp) : initializeApp(firebaseConfig);
  return app;
}

export async function getFirebaseMessaging(): Promise<Messaging | null> {
  if (messaging) return messaging;
  const supported = await isSupported();
  if (!supported) return null;
  const firebaseApp = getFirebaseApp();
  if (!firebaseApp) return null;
  messaging = getMessaging(firebaseApp);
  return messaging;
}

export function getVapidKey(): string | null {
  const key = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY;
  return key && key.trim() ? key.trim() : null;
}

export function isFirebaseConfigured(): boolean {
  return !!(
    process.env.NEXT_PUBLIC_FIREBASE_API_KEY &&
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID &&
    process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID &&
    process.env.NEXT_PUBLIC_FIREBASE_APP_ID
  );
}
