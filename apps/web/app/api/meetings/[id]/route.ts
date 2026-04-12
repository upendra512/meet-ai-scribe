import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb, getAdminAuth } from '@/lib/firebase-admin';

async function getUserFromRequest(req: NextRequest) {
  const auth = req.headers.get('Authorization');
  if (!auth?.startsWith('Bearer ')) return null;
  const token = auth.slice(7);
  try {
    return await getAdminAuth().verifyIdToken(token);
  } catch {
    return null;
  }
}

// GET /api/meetings/[id]
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const db = getAdminDb();
  const doc = await db.collection('meetings').doc(params.id).get();

  if (!doc.exists) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const data = doc.data()!;
  if (data.userId !== user.uid) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  return NextResponse.json({ meeting: { id: doc.id, ...data } });
}

// DELETE /api/meetings/[id]
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const db = getAdminDb();
  const doc = await db.collection('meetings').doc(params.id).get();

  if (!doc.exists) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (doc.data()?.userId !== user.uid) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  await db.collection('meetings').doc(params.id).delete();
  return NextResponse.json({ success: true });
}
