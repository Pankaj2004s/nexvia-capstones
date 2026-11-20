const { Server } = require('socket.io');
const { verifyAccess } = require('../../shared/middleware/auth');
const { clientUrl } = require('../../config/env');
const service = require('./liveclasses.service');
const logger = require('../../shared/utils/logger');

let io;
const chatHistory = new Map(); // roomId -> last messages (in memory; fine for a single instance)

const room = (id) => `class:${id}`;
const sizeOf = (ns, roomName) => (ns.adapter.rooms.get(roomName) ? ns.adapter.rooms.get(roomName).size : 0);

// WebRTC signaling: the server only relays offers/answers/ICE candidates; media flows peer-to-peer.
function attachLiveSocket(httpServer) {
  io = new Server(httpServer, { cors: { origin: clientUrl.split(','), credentials: true } });
  const ns = io.of('/live');

  ns.use(async (socket, next) => {
    try {
      const payload = verifyAccess(socket.handshake.auth && socket.handshake.auth.token);
      const name = (await require('../users/users.service').getNames([payload.sub]))[payload.sub] || 'User';
      socket.data.user = { id: payload.sub, role: payload.role, name };
      next();
    } catch (e) {
      next(new Error('Authentication failed'));
    }
  });

  ns.on('connection', (socket) => {
    socket.on('join', async ({ classId } = {}, ack = () => {}) => {
      try {
        const { role } = await service.canJoin(socket.data.user, classId);
        const roomName = room(classId);
        if (sizeOf(ns, roomName) >= service.MAX_PARTICIPANTS) return ack({ ok: false, error: 'Class is full' });
        const peers = [];
        for (const sid of ns.adapter.rooms.get(roomName) || []) {
          const s = ns.sockets.get(sid);
          if (s) peers.push({ socketId: sid, userId: s.data.user.id, name: s.data.user.name, role: s.data.role });
        }
        socket.data.role = role;
        socket.data.classId = classId;
        socket.join(roomName);
        socket.to(roomName).emit('peer-joined', { socketId: socket.id, userId: socket.data.user.id, name: socket.data.user.name, role });
        return ack({ ok: true, selfId: socket.id, role, peers, history: chatHistory.get(roomName) || [] });
      } catch (e) {
        return ack({ ok: false, error: e.message });
      }
    });

    // relay offer/answer/candidate to one peer in the same room only
    socket.on('signal', ({ to, data } = {}) => {
      const target = ns.sockets.get(to);
      if (!target || !socket.data.classId || target.data.classId !== socket.data.classId) return;
      target.emit('signal', { from: socket.id, data });
    });

    socket.on('chat', ({ text } = {}) => {
      if (!socket.data.classId || typeof text !== 'string' || !text.trim()) return;
      const msg = { from: socket.data.user.name, role: socket.data.role, userId: socket.data.user.id, text: text.trim().slice(0, 500), at: new Date().toISOString() };
      const roomName = room(socket.data.classId);
      const hist = chatHistory.get(roomName) || [];
      hist.push(msg);
      chatHistory.set(roomName, hist.slice(-50));
      ns.to(roomName).emit('chat', msg);
    });

    socket.on('media-state', (state = {}) => {
      if (!socket.data.classId) return;
      socket.to(room(socket.data.classId)).emit('media-state', { socketId: socket.id, audio: Boolean(state.audio), video: Boolean(state.video) });
    });

    socket.on('disconnect', () => {
      if (socket.data.classId) socket.to(room(socket.data.classId)).emit('peer-left', { socketId: socket.id, userId: socket.data.user.id });
    });
  });

  logger.info('Live class signaling ready on /live');
  return io;
}

function notifyEnded(classId) {
  if (!io) return;
  io.of('/live').to(room(classId)).emit('class-ended', { classId });
  chatHistory.delete(room(classId));
}

const closeSocket = () => (io ? io.close() : undefined);

module.exports = { attachLiveSocket, notifyEnded, closeSocket };
