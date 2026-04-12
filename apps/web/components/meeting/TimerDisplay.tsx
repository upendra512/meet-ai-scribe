'use client';

import { useState, useEffect } from 'react';
import { Clock } from 'lucide-react';
import { BotStatus } from '@/types';

function pad(n: number) {
  return String(n).padStart(2, '0');
}

export function TimerDisplay({ status }: { status: BotStatus }) {
  const [seconds, setSeconds] = useState(0);
  const running = status === 'live';

  useEffect(() => {
    if (!running) return;
    const interval = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(interval);
  }, [running]);

  // Reset when status goes from live back to something else
  useEffect(() => {
    if (status === 'joining' || status === 'idle') setSeconds(0);
  }, [status]);

  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;

  if (status === 'idle' || status === 'done') return null;

  return (
    <div className="flex items-center gap-1.5 text-sm text-gray-600 tabular-nums">
      <Clock className="h-4 w-4" />
      {h > 0 ? `${pad(h)}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`}
    </div>
  );
}
