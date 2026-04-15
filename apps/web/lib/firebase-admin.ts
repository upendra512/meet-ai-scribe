import { initializeApp, getApps, deleteApp, cert, App } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';

function getPrivateKey(): string {
  const raw = process.env.FIREBASE_ADMIN_PRIVATE_KEY ?? '';
  if (!raw) throw new Error('FIREBASE_ADMIN_PRIVATE_KEY is not set');

  // If it starts with the PEM header it's a raw key (possibly with escaped \n)
  if (raw.includes('BEGIN PRIVATE KEY')) {
    return raw.replace(/\\n/g, '\n');
  }

  // Otherwise treat as base64-encoded
  return Buffer.from(raw, 'base64').toString('utf8');
}

function getAdminApp(): App {
  // Re-use existing app if already initialized
  const existing = getApps().find(a => a.name === '[DEFAULT]');
  if (existing) return existing;

  return initializeApp({
    credential: cert({
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID!,
      clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL!,
      privateKey: getPrivateKey(),
    }),
  });
}

export function getAdminDb() {
  return getFirestore(getAdminApp());
}

export function getAdminAuth() {
  return getAuth(getAdminApp());
}
