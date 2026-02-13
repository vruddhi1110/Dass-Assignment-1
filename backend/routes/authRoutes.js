const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { protect, authorize } = require('../middleware/authMiddleware');

// Public Routes
router.post('/register', authController.register);
router.post('/login', authController.login);
router.post('/forgot-password', authController.forgotPassword); // New public route

// Organizer requests a password reset (must be logged in as organizer)
router.post('/request-reset', protect, authController.requestPasswordReset);
router.get('/my-reset-requests', protect, authController.myPasswordResetRequests);

router.post('/reset-password', authController.resetPassword);

// Admin routes for managing requests
router.get('/admin/reset-requests', protect, authorize('Admin'), authController.listPasswordResetRequests);
router.post('/admin/reset-requests/:id/approve', protect, authorize('Admin'), authController.approvePasswordResetRequest);
router.post('/admin/reset-requests/:id/reject', protect, authorize('Admin'), authController.rejectPasswordResetRequest);

// Admin Only Route
router.post('/create-organizer', protect, authorize('Admin'), authController.createOrganizer);
router.delete('/organizer/:id', protect, authorize('Admin'), authController.deleteOrganizer);

// User Profile & Social Routes
router.get('/me', protect, authController.getProfile);
router.put('/me', protect, authController.updateProfile);
router.get('/organizers', protect, authController.getAllOrganizers);
router.post('/organizers/:organizerId/follow', protect, authController.toggleFollow);

module.exports = router;