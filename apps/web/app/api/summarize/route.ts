import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';
import { summarizeMeeting } from '@/lib/gemini';
import { TranscriptLine } from '@/types';
import { FieldValue } from 'firebase-admin/firestore';

// This endpoint is called by the bot service when a meeting ends.
// It also can be called directly from the client (with Firebase auth).
export async function POST(req: NextRequest) {
  // Allow calls from bot service with shared secret
  const botSecret = req.headers.get('x-bot-secret');
  const isFromBot = botSecret && botSecret === process.env.BOT_SERVICE_SECRET;

  // Or from authenticated user
  if (!isFromBot) {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  const body = await req.json() as {
    meetingId: string;
    transcript: TranscriptLine[];
    transcriptUrl?: string;
  };

  const { meetingId, transcript, transcriptUrl } = body;

  if (!meetingId || !transcript?.length) {
    return NextResponse.json({ error: 'meetingId and transcript are required' }, { status: 400 });
  }

  const db = getAdminDb();
  const meetingRef = db.collection('meetings').doc(meetingId);

  // Mark as processing
  await meetingRef.update({
    status: 'processing',
    transcriptLines: transcript.length,
    transcriptUrl: transcriptUrl ?? null,
    updatedAt: FieldValue.serverTimestamp(),
  });

  try {
    const summary = await summarizeMeeting(transcript);

    await meetingRef.update({
      status: 'done',
      title: summary.title || 'Meeting Summary',
      summary,
      endedAt: new Date().toISOString(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    return NextResponse.json({ success: true, summary });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    console.error('[api/summarize] Gemini error:', err);
    await meetingRef.update({
      status: 'error',
      updatedAt: FieldValue.serverTimestamp(),
    });
    return NextResponse.json({ error: 'Summarization failed', detail: msg }, { status: 500 });
  }
}
