import { NextRequest, NextResponse } from 'next/server';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

// Decode Firebase JWT without verifying (client already verified by Firebase Auth)
function getUserFromToken(req: NextRequest): { uid: string; email: string } | null {
  const auth = req.headers.get('Authorization');
  const xUid = req.headers.get('x-user-id');

  if (xUid) return { uid: xUid, email: '' };

  if (!auth?.startsWith('Bearer ')) return null;
  const token = auth.slice(7);
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
    return { uid: payload.user_id || payload.sub, email: payload.email || '' };
  } catch {
    return null;
  }
}

function getDb() {
  if (getApps().length > 0) return getFirestore(getApps()[0]);

  const rawKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY ?? '';
  const privateKey = rawKey.includes('BEGIN PRIVATE KEY')
    ? rawKey.replace(/\\n/g, '\n')
    : Buffer.from(rawKey, 'base64').toString('utf8');

  const app = initializeApp({
    credential: cert({
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID!,
      clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL!,
      privateKey,
    }),
  });
  return getFirestore(app);
}

export async function GET(req: NextRequest) {
  const user = getUserFromToken(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const db = getDb();
    const snap = await db.collection('meetings')
      .where('userId', '==', user.uid)
      .orderBy('createdAt', 'desc')
      .limit(50).get();
    const meetings = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    return NextResponse.json({ meetings });
  } catch (e: unknown) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { meetUrl, userId: bodyUserId } = body;

    const jwtUser = getUserFromToken(req);
    const uid = jwtUser?.uid || req.headers.get('x-user-id') || bodyUserId;
    if (!uid) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!meetUrl) return NextResponse.json({ error: 'meetUrl is required' }, { status: 400 });

    // Write to Firestore via REST (no Admin SDK private key needed)
    const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID!;
    const meetingId = `meeting_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const title = `Meeting · ${new Date().toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit',
    })}`;

    const firestoreUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/meetings/${meetingId}?key=${process.env.NEXT_PUBLIC_FIREBASE_API_KEY}`;

    const firestoreRes = await fetch(firestoreUrl, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fields: {
          userId: { stringValue: uid },
          meetUrl: { stringValue: meetUrl },
          title: { stringValue: title },
          status: { stringValue: 'joining' },
          transcriptLines: { integerValue: 0 },
          transcriptUrl: { nullValue: null },
          summary: { nullValue: null },
          botId: { nullValue: null },
          startedAt: { nullValue: null },
          endedAt: { nullValue: null },
          duration: { nullValue: null },
          createdAt: { stringValue: new Date().toISOString() },
          updatedAt: { stringValue: new Date().toISOString() },
        },
      }),
    });

    if (!firestoreRes.ok) {
      const err = await firestoreRes.text();
      console.error('[firestore] write failed:', err);
      return NextResponse.json({ error: 'Failed to create meeting record' }, { status: 500 });
    }

    // Fire-and-forget bot call
    const botServiceUrl = process.env.BOT_SERVICE_URL || 'http://localhost:3001';
    const botSecret = process.env.BOT_SERVICE_SECRET || '';

    fetch(`${botServiceUrl}/api/bot/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-bot-secret': botSecret },
      signal: AbortSignal.timeout(25000),
      body: JSON.stringify({ meetUrl, meetingId, userId: uid }),
    }).then(async (r) => {
      if (!r.ok) console.error('[bot] failed:', await r.text());
    }).catch((e) => console.error('[bot] unreachable:', e?.message));

    return NextResponse.json({ meetingId, success: true });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[api/meetings] error:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
