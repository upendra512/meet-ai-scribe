import 'dotenv/config';
import express from 'express';
import http from 'http';
import cors from 'cors';
import { Server as SocketServer } from 'socket.io';
import { createBotRouter } from './routes/bot.routes';
import { SOCKET_EVENTS } from './socket/events';
import { stopBot } from './services/meet.service';

const app = express();
const server = http.createServer(app);

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';

const io = new SocketServer(server, {
  cors: {
    origin: [FRONTEND_URL, 'http://localhost:3000', 'http://localhost:3001'],
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

// Middleware
app.use(cors({
  origin: [FRONTEND_URL, 'http://localhost:3000'],
  credentials: true,
}));
app.use(express.json());

// Health check (no auth required)
app.get('/health', (_req: import('express').Request, res: import('express').Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Bot API routes
app.use('/api/bot', createBotRouter(io));

// Socket.io connection handling
io.on('connection', (socket) => {
  console.log(`[socket] Client connected: ${socket.id}`);

  // Client subscribes to a specific meeting's events
  socket.on(SOCKET_EVENTS.JOIN_MEETING, (meetingId: string) => {
    socket.join(meetingId);
    console.log(`[socket] ${socket.id} joined room: ${meetingId}`);
  });

  socket.on(SOCKET_EVENTS.LEAVE_MEETING, (meetingId: string) => {
    socket.leave(meetingId);
    console.log(`[socket] ${socket.id} left room: ${meetingId}`);
  });

  // Client can request bot stop
  socket.on(SOCKET_EVENTS.BOT_STOP, async (meetingId: string) => {
    try {
      await stopBot(meetingId, io);
    } catch (err: any) {
      socket.emit(SOCKET_EVENTS.ERROR, { meetingId, message: err.message });
    }
  });

  socket.on('disconnect', () => {
    console.log(`[socket] Client disconnected: ${socket.id}`);
  });
});

const PORT = parseInt(process.env.PORT || '3001', 10);
server.listen(PORT, () => {
  console.log(`\n🤖 MeetScribe Bot Service running on port ${PORT}`);
  console.log(`   Health: http://localhost:${PORT}/health`);
  console.log(`   Bot API: http://localhost:${PORT}/api/bot\n`);
});
