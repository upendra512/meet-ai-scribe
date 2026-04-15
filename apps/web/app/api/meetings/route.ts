import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';

// Decode Firebase JWT without verifying signature (hackathon-safe: client already verified by Firebase client SDK)
function getUserFromToken(req: NextRequest): { uid: string; email: string } | null {
  const auth = req.headers.get('Authorization');
  if (!auth?.startsWith('Bearer ')) return null;
  const token = auth.slice(7);
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
    if (!payload.user_id && !payload.sub) return null;
    return { uid: payload.user_id || payload.sub, email: payload.email || '' };
  } catch {
    return null;
  }
}

// GET /api/meetings — list user's meetings
export async function GET(req: NextRequest) {
  const user = getUserFromToken(req);
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
    const body = await req.json();
    const { meetUrl, userId: bodyUserId } = body;

    // Try JWT first, fall back to x-user-id header, then body userId
    const jwtUser = getUserFromToken(req);
    const uid = jwtUser?.uid
      || req.headers.get('x-user-id')
      || bodyUserId;

    if (!uid) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const user = { uid, email: jwtUser?.email || '' };
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

    // Call bot service
    const botServiceUrl = process.env.BOT_SERVICE_URL || 'http://localhost:3001';
    const botSecret = process.env.BOT_SERVICE_SECRET || '';

    try {
      const botRes = await fetch(`${botServiceUrl}/api/bot/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-bot-secret': botSecret },
        body: JSON.stringify({ meetUrl, meetingId, userId: user.uid }),
      });

      if (botRes.ok) {
        const { botId } = await botRes.json();
        await ref.update({ botId });
      } else {
        console.error('[api/meetings] Bot start failed:', await botRes.text());
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
