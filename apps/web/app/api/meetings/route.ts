import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb, getAdminAuth } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';

async function getUserFromRequest(req: NextRequest) {
  const auth = req.headers.get('Authorization');
  if (!auth?.startsWith('Bearer ')) return null;
  const token = auth.slice(7);
  try {
    const adminAuth = getAdminAuth();
    const decoded = await adminAuth.verifyIdToken(token);
    return decoded;
  } catch (e) {
    console.error('[auth] verifyIdToken failed:', e);
    return null;
  }
}

// GET /api/meetings — list user's meetings
export async function GET(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const db = getAdminDb();
  const snap = await db
    .collection('meetings')
    .where('userId', '==', user.uid)
    .orderBy('createdAt', 'desc')
    .limit(50)
    .get();

  const meetings = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  return NextResponse.json({ meetings });
}

// POST /api/meetings — create meeting + call bot/start
export async function POST(req: NextRequest) {
  try {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { meetUrl } = await req.json();
  if (!meetUrl) return NextResponse.json({ error: 'meetUrl is required' }, { status: 400 });

  const db = getAdminDb();
  const title = `Meeting · ${new Date().toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })}`;

  const ref = db.collection('meetings').doc();
  const meetingId = ref.id;

  await ref.set({
    userId: user.uid,
    meetUrl,
    title,
    status: 'joining',
    botId: null,
    startedAt: null,
    endedAt: null,
    duration: null,
    transcriptLines: 0,
    transcriptUrl: null,
    summary: null,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });

  // Call bot service to start the bot
  const botServiceUrl = process.env.BOT_SERVICE_URL || 'http://localhost:3001';
  const botSecret = process.env.BOT_SERVICE_SECRET || '';

  try {
    const botRes = await fetch(`${botServiceUrl}/api/bot/start`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-bot-secret': botSecret,
      },
      body: JSON.stringify({ meetUrl, meetingId, userId: user.uid }),
    });

    if (botRes.ok) {
      const { botId } = await botRes.json();
      await ref.update({ botId });
    } else {
      const errText = await botRes.text();
      console.error('[api/meetings] Bot start failed:', errText);
      // Don't fail the whole request — let the meeting be created, bot retries can happen
      await ref.update({ status: 'error' });
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    console.error('[api/meetings] Cannot reach bot service:', msg);
    await ref.update({ status: 'error' });
  }

  return NextResponse.json({ meetingId, success: true });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[api/meetings] Unhandled error:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
