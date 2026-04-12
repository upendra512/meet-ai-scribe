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
  } catch {
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
      console.error('[api/meetings] Bot start failed:', await botRes.text());
      await ref.update({ status: 'error' });
      return NextResponse.json(
        { error: 'Bot service failed to start. Is it running?' },
        { status: 502 }
      );
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    console.error('[api/meetings] Cannot reach bot service:', msg);
    await ref.update({ status: 'error' });
    return NextResponse.json(
      { error: 'Could not reach bot service. Check BOT_SERVICE_URL.' },
      { status: 502 }
    );
  }

  return NextResponse.json({ meetingId, success: true });
}
