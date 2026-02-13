let io = null;
module.exports = {
  init: (server) => {
    const { Server } = require('socket.io');
    io = new Server(server, {
      cors: {
        origin: ['http://localhost:3000', 'http://127.0.0.1:3000'],
        methods: ['GET','POST']
      }
    });

    const Message = require('./models/Message');

    io.on('connection', (socket) => {
      // join specific event room
      socket.on('join', ({ eventId }) => {
        if (eventId) socket.join(eventId);
      });

      socket.on('leave', ({ eventId }) => {
        if (eventId) socket.leave(eventId);
      });

      // receive sendMessage from clients over websocket and persist & broadcast
      socket.on('sendMessage', async (payload) => {
        // payload: { eventId, text, userId, parentId }
        try {
          if (!payload || !payload.eventId || !payload.text) return;
          const msg = new Message({
            eventId: payload.eventId,
            userId: payload.userId,
            text: payload.text,
            parentId: payload.parentId || null
          });
          const saved = await msg.save();
          const populated = await saved.populate('userId', 'firstName lastName');
          io.to(payload.eventId).emit('newMessage', populated);
        } catch (e) {
          console.error('socket sendMessage error', e);
        }
      });
    });

    return io;
  },
  getIo: () => io
};
