'use client';

import { useState, useEffect, useRef } from 'react';
import { getSocket } from '@/lib/socket-client';
import { TranscriptLine, BotStatus } from '@/types';

const TRANSCRIPT_UPDATE = 'transcript:update';
const BOT_STATUS = 'bot:status';
const MEETING_ENDED = 'meeting:ended';
const BOT_ERROR = 'bot:error';

export function useMeetingSocket(meetingId: string | null) {
  const [transcriptLines, setTranscriptLines] = useState<TranscriptLine[]>([]);
  const [botStatus, setBotStatus] = useState<BotStatus>('idle');
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [isEnded, setIsEnded] = useState(false);
  const joinedRef = useRef(false);

  useEffect(() => {
    if (!meetingId) return;

    const socket = getSocket();

    if (!joinedRef.current) {
      socket.emit('join:meeting', meetingId);
      joinedRef.current = true;
    }

    const onTranscript = (data: TranscriptLine) => {
      if (data.meetingId === meetingId) {
        setTranscriptLines((prev) => [...prev, data]);
      }
    };

    const onStatus = (data: { meetingId: string; status: BotStatus; message?: string }) => {
      if (data.meetingId === meetingId) {
        setBotStatus(data.status);
        if (data.message) setStatusMessage(data.message);
      }
    };

    const onEnded = (data: { meetingId: string }) => {
      if (data.meetingId === meetingId) {
        setIsEnded(true);
        setBotStatus('done');
      }
    };

    const onError = (data: { meetingId: string; message: string }) => {
      if (data.meetingId === meetingId) {
        setBotStatus('error');
        setStatusMessage(data.message);
      }
    };

    socket.on(TRANSCRIPT_UPDATE, onTranscript);
    socket.on(BOT_STATUS, onStatus);
    socket.on(MEETING_ENDED, onEnded);
    socket.on(BOT_ERROR, onError);

    return () => {
      socket.off(TRANSCRIPT_UPDATE, onTranscript);
      socket.off(BOT_STATUS, onStatus);
      socket.off(MEETING_ENDED, onEnded);
      socket.off(BOT_ERROR, onError);
      socket.emit('leave:meeting', meetingId);
      joinedRef.current = false;
    };
  }, [meetingId]);

  function stopBot() {
    if (!meetingId) return;
    const socket = getSocket();
    socket.emit('bot:stop', meetingId);
  }

  return { transcriptLines, botStatus, statusMessage, isEnded, stopBot };
}
