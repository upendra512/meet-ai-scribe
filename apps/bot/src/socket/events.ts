export const SOCKET_EVENTS = {
  // Bot emits to clients
  TRANSCRIPT_UPDATE: 'transcript:update',
  BOT_STATUS: 'bot:status',
  MEETING_ENDED: 'meeting:ended',
  ERROR: 'bot:error',

  // Clients emit to bot
  JOIN_MEETING: 'join:meeting',
  LEAVE_MEETING: 'leave:meeting',
  BOT_STOP: 'bot:stop',
} as const;

export type BotStatus = 'idle' | 'joining' | 'waiting' | 'live' | 'processing' | 'done' | 'error';

export interface TranscriptLine {
  meetingId: string;
  line: string;
  speakerLabel: string;
  timestamp: number;
}

export interface BotStatusPayload {
  meetingId: string;
  status: BotStatus;
  message?: string;
}

export interface MeetingEndedPayload {
  meetingId: string;
  totalLines: number;
  duration: number;
  transcriptUrl?: string;
}
