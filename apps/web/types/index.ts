export type BotStatus = 'idle' | 'joining' | 'waiting' | 'live' | 'processing' | 'done' | 'error';

export interface TranscriptLine {
  meetingId: string;
  line: string;
  speakerLabel: string;
  timestamp: number;
}

export interface MeetingSummary {
  title: string;
  overview: string;
  keyDecisions: string[];
  actionItems: Array<{ item: string; owner: string; deadline: string | null }>;
  participants: string[];
  topics: string[];
  generatedAt: string;
}

export interface Meeting {
  id: string;
  userId: string;
  meetUrl: string;
  title: string;
  status: BotStatus;
  botId?: string;
  startedAt: string | null;
  endedAt: string | null;
  duration: number | null;
  transcriptLines: number;
  transcriptUrl: string | null;
  summary: MeetingSummary | null;
  createdAt: string;
  updatedAt: string;
}

export interface User {
  uid: string;
  email: string;
  displayName: string;
  photoURL: string;
}
