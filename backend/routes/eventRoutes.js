const express = require('express');
const router = express.Router();
const eventController = require('../controllers/eventController');

// 1. Use ONLY this line for imports
const { protect, authorize } = require('../middleware/authMiddleware');


router.get('/organizer/my-events', protect, authorize('Organizer'), eventController.getOrganizerEvents);
router.get('/organizer/stats', protect, authorize('Organizer'), eventController.getOrganizerStats); // NEW Route

// Public Route: Anyone logged in can see the list
router.get('/', protect, eventController.getAllEvents);

// Messages: get/post/delete/pin
const messageController = require('../controllers/messageController');
router.get('/:id/messages', protect, messageController.getMessagesForEvent);
router.post('/:id/messages', protect, messageController.postMessage);
router.delete('/:id/messages/:messageId', protect, messageController.deleteMessage);
router.patch('/:id/messages/:messageId/pin', protect, messageController.pinMessage);

// Organizer: add a participant to an event (organizer registers someone else)
router.post('/:id/add-participant', protect, authorize('Organizer'), eventController.addParticipant);

// Organizer: Get participants for an event
router.get('/:id/participants', protect, authorize('Organizer', 'Admin'), eventController.getEventParticipants);

// Organizer: update event (registration deadline / limit)
// Allow Organizers and Admins to update an event (Admins get global edit capability)
router.patch('/:id', protect, authorize('Organizer', 'Admin'), eventController.updateEvent);

// Specific Event: Anyone logged in can see details (needed for registration)
// ICS download: return an .ics file for the event (place BEFORE the /:id route)
router.get('/:id/ics', protect, eventController.getEventICS);

router.get('/:id', protect, eventController.getEventById);

// Organizer Only: Only logged-in Organizers can create
router.post('/', protect, authorize('Organizer'), eventController.createEvent);

module.exports = router;