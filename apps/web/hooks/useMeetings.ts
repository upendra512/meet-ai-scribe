'use client';

import { useState, useEffect } from 'react';
import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  doc,
  getDoc,
} from 'firebase/firestore';
import { db } from '@/lib/firebase-client';
import { Meeting } from '@/types';
import { useAuth } from './useAuth';

export function useMeetings() {
  const { user } = useAuth();
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setMeetings([]);
      setLoading(false);
      return;
    }

    const q = query(
      collection(db, 'meetings'),
      where('userId', '==', user.uid),
      orderBy('createdAt', 'desc')
    );

    const unsub = onSnapshot(q, (snap) => {
      const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Meeting));
      setMeetings(docs);
      setLoading(false);
    });

    return unsub;
  }, [user]);

  return { meetings, loading };
}

export function useMeeting(meetingId: string) {
  const [meeting, setMeeting] = useState<Meeting | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!meetingId) return;

    const ref = doc(db, 'meetings', meetingId);
    const unsub = onSnapshot(ref, (snap) => {
      if (snap.exists()) {
        setMeeting({ id: snap.id, ...snap.data() } as Meeting);
      }
      setLoading(false);
    });

    return unsub;
  }, [meetingId]);

  return { meeting, loading };
}
