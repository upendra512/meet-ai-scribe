import { Router, Request, Response, NextFunction } from 'express';
import { Server as SocketServer } from 'socket.io';
import { createBotController } from '../controllers/bot.controller';

export function createBotRouter(io: SocketServer): Router {
  const router = Router();
  const ctrl = createBotController(io);

  // Simple shared-secret auth middleware
  router.use((req: Request, res: Response, next: NextFunction) => {
    const secret = process.env.BOT_SERVICE_SECRET;
    if (secret) {
      const provided = req.headers['x-bot-secret'];
      if (provided !== secret) {
        return res.status(401).json({ error: 'Unauthorized' });
      }
    }
    next();
  });

  router.post('/start', ctrl.start);
  router.post('/stop', ctrl.stop);
  router.get('/status/:meetingId', ctrl.status);

  return router;
}
