'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { isGoogleMeetUrl } from '@/lib/utils';
import { Bot, Link as LinkIcon, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

export function MeetingForm() {
  const { user } = useAuth();
  const router = useRouter();
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (!url.trim()) {
      setError('Please enter a Google Meet URL');
      return;
    }

    if (!isGoogleMeetUrl(url.trim())) {
      setError('Please enter a valid Google Meet URL (e.g. meet.google.com/abc-defg-hij)');
      return;
    }

    setLoading(true);

    try {
      const token = await user?.getIdToken(true).catch(() => user?.getIdToken());
      const res = await fetch('/api/meetings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token ?? ''}`,
          'x-user-id': user?.uid ?? '',
        },
        body: JSON.stringify({ meetUrl: url.trim(), userId: user?.uid }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || `Server error ${res.status}`);
      }

      const { meetingId } = data;
      toast.success('Bot is joining the meeting!');
      router.push(`/meeting/${meetingId}`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Something went wrong';
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-1.5">
        <label className="text-sm font-medium text-gray-700">Google Meet URL</label>
        <div className="relative">
          <LinkIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            type="url"
            placeholder="https://meet.google.com/abc-defg-hij"
            value={url}
            onChange={(e) => { setUrl(e.target.value); setError(''); }}
            className="pl-9"
            disabled={loading}
          />
        </div>
        {error && (
          <p className="flex items-center gap-1.5 text-sm text-red-600">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {error}
          </p>
        )}
      </div>

      <div className="rounded-lg bg-blue-50 border border-blue-100 p-3 text-sm text-blue-700">
        <p className="font-medium mb-1">Before sending the bot:</p>
        <ul className="space-y-0.5 text-blue-600">
          <li>• Make sure you are the host (or can admit guests)</li>
          <li>• The bot will appear as <strong>&quot;MeetScribe Bot&quot;</strong></li>
          <li>• Admit the bot when it requests to join</li>
        </ul>
      </div>

      <Button type="submit" size="lg" className="w-full gap-2" disabled={loading}>
        {loading ? (
          <>
            <span className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            Launching bot…
          </>
        ) : (
          <>
            <Bot className="h-4 w-4" />
            Send Bot to Meeting
          </>
        )}
      </Button>
    </form>
  );
}
