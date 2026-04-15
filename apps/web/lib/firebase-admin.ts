import { initializeApp, getApps, cert, App } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';

let adminApp: App;

function getAdminApp(): App {
  if (adminApp) return adminApp;
  if (getApps().length > 0) {
    adminApp = getApps()[0];
    return adminApp;
  }

  // Support both base64-encoded and raw key formats
  const rawKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY ?? '';
  let privateKey: string;
  if (rawKey.startsWith('-----BEGIN')) {
    // Already a real PEM key — just normalize escaped newlines if any
    privateKey = rawKey.replace(/\\n/g, '\n');
  } else {
    // Stored as base64 on Vercel to avoid newline corruption
    privateKey = Buffer.from(rawKey, 'base64').toString('utf8');
  }

  adminApp = initializeApp({
    credential: cert({
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
      privateKey,
    }),
  });

  return adminApp;
}

export function getAdminDb() {
  return getFirestore(getAdminApp());
}

export function getAdminAuth() {
  return getAuth(getAdminApp());
}
