const Message = require('../models/Message');
const Event = require('../models/Event');
const User = require('../models/User');
const { getIo } = require('../socket');

// Get messages for an event (paginated optional in future)
exports.getMessagesForEvent = async (req, res) => {
  try {
    const eventId = req.params.id;
    const messages = await Message.find({ eventId })
      .sort([['pinned', -1], ['createdAt', 1]])
      .populate('userId', 'firstName lastName')
      .lean();
    res.json(messages);
  } catch (err) {
    console.error('getMessagesForEvent', err);
    res.status(500).send('Server Error');
  }
};

// Post a new message
exports.postMessage = async (req, res) => {
  try {
    const eventId = req.params.id;
    const { text, parentId, fileUrl, fileName, fileType } = req.body;
    if ((!text || text.trim() === '') && !fileUrl) return res.status(400).json({ msg: 'Message must have text or a file' });

    const newMessage = new Message({
      eventId,
      userId: req.user.id,
      text: text ? text.trim() : '',
      parentId: parentId || null,
      fileUrl,
      fileName,
      fileType
    });

    const saved = await newMessage.save();
    const populated = await saved.populate('userId', 'firstName lastName').execPopulate?.() || await Message.findById(saved._id).populate('userId', 'firstName lastName');

    // Broadcast via socket if available
    try {
      const io = getIo();
      if (io) io.to(eventId).emit('newMessage', populated);
    } catch (e) {
      console.warn('Failed to emit newMessage', e);
    }

    res.status(201).json(populated);
  } catch (err) {
    console.error('postMessage', err);
    res.status(500).send('Server Error');
  }
};

// Delete a message (moderation)
exports.deleteMessage = async (req, res) => {
  try {
    const { id: eventId, messageId } = req.params;
    const message = await Message.findById(messageId);
    if (!message) return res.status(404).json({ msg: 'Message not found' });

    // Permission: Admin OR Organizer of event OR message owner
    const event = await Event.findById(eventId);
    const isOrganizer = event && String(event.organizerId) === String(req.user?.id);
    const isAdmin = req.user?.role === 'Admin';
    const isOwner = String(message.userId) === String(req.user?.id);

    // Log debug context to help diagnose 500 errors seen in frontend
    console.log('[messages.delete] user:', req.user ? { id: req.user.id, role: req.user.role } : null, 'eventId:', eventId, 'messageId:', messageId, 'isAdmin:', isAdmin, 'isOrganizer:', isOrganizer, 'isOwner:', isOwner);

    if (!(isAdmin || isOrganizer || isOwner)) {
      return res.status(403).json({ msg: 'Forbidden' });
    }

    try {
      // Use deleteOne for a straightforward removal
      await Message.deleteOne({ _id: messageId });
    } catch (delErr) {
      console.error('[messages.delete] deletion failed', delErr);
      return res.status(500).json({ msg: 'Failed to delete message' });
    }

    try {
      const io = getIo();
      if (io) io.to(eventId).emit('deleteMessage', { _id: messageId });
    } catch (e) { console.warn('emit deleteMessage failed', e); }

    res.json({ msg: 'Message deleted' });
  } catch (err) {
    console.error('deleteMessage', err);
    res.status(500).send('Server Error');
  }
};

// Pin/unpin a message (Organizer/Admin)
exports.pinMessage = async (req, res) => {
  try {
    const { id: eventId, messageId } = req.params;
    const message = await Message.findById(messageId);
    if (!message) return res.status(404).json({ msg: 'Message not found' });

    const event = await Event.findById(eventId);
    const isOrganizer = event && String(event.organizerId) === String(req.user.id);
    const isAdmin = req.user.role === 'Admin';
    if (!(isAdmin || isOrganizer)) return res.status(403).json({ msg: 'Forbidden' });

    message.pinned = !!req.body.pinned; // Expected boolean
    await message.save();
    const populated = await Message.findById(message._id).populate('userId', 'firstName lastName');

    try {
      const io = getIo();
      if (io) io.to(eventId).emit('pinMessage', populated);
    } catch (e) { console.warn('emit pinMessage failed', e); }

    res.json(populated);
  } catch (err) {
    console.error('pinMessage', err);
    res.status(500).send('Server Error');
  }
};
