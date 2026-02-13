const express = require('express');
const router = express.Router();
const regController = require('../controllers/registrationController');
const { protect, authorize } = require('../middleware/authMiddleware');
const multer = require('multer');

// multer memory storage so we can decode buffer directly
const storage = multer.memoryStorage();
const upload = multer({ storage });

// Get my registrations (alias '/me' and '/my-tickets' for frontend compatibility)
router.get('/me', protect, regController.getMyRegistrations);
router.get('/my-tickets', protect, regController.getMyRegistrations);

// Get a specific registration by id
router.get('/:id', protect, regController.getRegistrationById);

// Register for an event
// Accept both '/register' and POST '/' so frontend can call POST '/registrations' directly
router.post('/register', protect, regController.registerForEvent);
router.post('/', protect, regController.registerForEvent);

// Cancel Registration
router.patch('/:id/cancel', protect, regController.cancelRegistration);

// Mark Attendance (Organizer Only)
router.post('/events/:eventId/attendance', protect, regController.markAttendance);

// Image upload based scan
router.post('/events/:eventId/attendance/scan-image', protect, upload.single('image'), regController.scanImage);

// SSE stream for live attendance updates
router.get('/events/:eventId/attendance/stream', protect, regController.streamAttendance);

// Attendance audit listing (Organizer + Admin)
router.get('/events/:eventId/audit', protect, authorize('Organizer', 'Admin'), regController.getAttendanceAudit);

// Manual override for a registration's attendance (mark/unmark)
router.post('/:id/attendance/override', protect, regController.overrideAttendance);

// Approve / Reject pending merchandise registrations (Organizer/Admin)
router.post('/:id/approve', protect, authorize('Organizer', 'Admin'), regController.approveRegistration);
router.post('/:id/reject', protect, authorize('Organizer', 'Admin'), regController.rejectRegistration);

module.exports = router;