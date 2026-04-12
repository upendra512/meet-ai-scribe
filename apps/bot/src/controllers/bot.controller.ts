import { Request, Response } from 'express';
import { Server as SocketServer } from 'socket.io';
import { startBot, stopBot, getBotStatus, getBotCaptionCount } from '../services/meet.service';

export function createBotController(io: SocketServer) {
  return {
    async start(req: Request, res: Response) {
      const { meetUrl, meetingId, userId } = req.body as {
        meetUrl?: string;
        meetingId?: string;
        userId?: string;
      };

      if (!meetUrl || !meetingId) {
        return res.status(400).json({ error: 'meetUrl and meetingId are required' });
      }

      // Validate it's a Google Meet URL
      if (!meetUrl.includes('meet.google.com')) {
        return res.status(400).json({ error: 'Only Google Meet URLs are supported' });
      }

      try {
        const botId = await startBot(meetUrl, meetingId, io);
        return res.json({ success: true, botId, meetingId });
      } catch (err: any) {
        console.error('[controller] start error:', err);
        return res.status(500).json({ error: err.message || 'Failed to start bot' });
      }
    },

    async stop(req: Request, res: Response) {
      const { meetingId } = req.body as { meetingId?: string };

      if (!meetingId) {
        return res.status(400).json({ error: 'meetingId is required' });
      }

      try {
        await stopBot(meetingId, io);
        return res.json({ success: true });
      } catch (err: any) {
        return res.status(404).json({ error: err.message || 'Session not found' });
      }
    },

    async status(req: Request, res: Response) {
      const meetingId = Array.isArray(req.params.meetingId)
        ? req.params.meetingId[0]
        : req.params.meetingId;
      const status = getBotStatus(meetingId);

      if (!status) {
        return res.status(404).json({ error: 'No active session for this meeting' });
      }

      return res.json({
        meetingId,
        status,
        captionCount: getBotCaptionCount(meetingId as string),
      });
    },
  };
}
