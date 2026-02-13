const Registration = require('../models/Registration');
const Event = require('../models/Event');
const AttendanceAudit = require('../models/AttendanceAudit');
const QRCode = require('qrcode');
const nodemailer = require('nodemailer'); // Added for email
const EventEmitter = require('events');

// EventEmitter used to notify SSE clients about attendance updates
const attendanceEmitter = new EventEmitter();
attendanceEmitter.setMaxListeners(1000);

// export emitter so routes/tests can hook if needed
module.exports.attendanceEmitter = attendanceEmitter;

// Get a specific registration by ID (Organizer can view registrations for their events;
// Participant can view their own registration)
exports.getRegistrationById = async (req, res) => {
    try {
        const regId = req.params.id;
        const registration = await Registration.findById(regId).populate('eventId').lean();
        if (!registration) return res.status(404).json({ msg: 'Registration not found' });

        const userId = req.user.id;
        const userRole = req.user.role;

        if (userRole === 'Participant') {
            if (String(registration.participantId) !== String(userId)) {
                return res.status(403).json({ msg: 'Forbidden' });
            }
        } else if (userRole === 'Organizer') {
            // Organizer may view registrations only for their own events
            const event = await Event.findById(registration.eventId._id).lean();
            if (!event) return res.status(404).json({ msg: 'Event not found' });
            if (String(event.organizerId) !== String(userId)) {
                return res.status(403).json({ msg: 'Forbidden' });
            }
        } else {
            // Admin or others: deny for now (can be extended)
            return res.status(403).json({ msg: 'Forbidden' });
        }

        res.json(registration);
    } catch (err) {
        console.error('Error fetching registration by id:', err);
        res.status(500).send('Server Error');
    }
};

// 1. Get registrations for the logged-in user
exports.getMyRegistrations = async (req, res) => {
    try {
        // Find all registrations where participantId matches the logged-in user's ID
        // .populate('eventId') pulls in the event name, date, description and type from the Events collection
        let registrations = await Registration.find({ participantId: req.user.id })
            .populate('eventId', 'name description eventType eventDates status dates') 
            .sort({ createdAt: -1 }); // Show newest registrations first

        // Filter out any registrations where the event has been deleted (eventId is null)
        registrations = registrations.filter(reg => reg.eventId !== null);

        res.json(registrations);
    } catch (err) {
        console.error("Error fetching personal registrations:", err);
        res.status(500).send("Server Error while fetching your tickets");
    }
};

// 2. Register for a new Event
exports.registerForEvent = async (req, res) => {
    try {
        console.log('[registerForEvent] incoming payload:', { body: req.body, userId: req.user && req.user.id });
        const { eventId, formResponses, merchandiseSelection } = req.body;

        // Check if event exists
        const event = await Event.findById(eventId);
        if (!event) return res.status(404).json({ msg: "Event not found" });

        // 1) Check registration deadline (support both event.registrationDeadline and event.dates.registrationDeadline)
        const now = new Date();
        const deadline = event.registrationDeadline || (event.dates && event.dates.registrationDeadline) || (event.eventDates && event.eventDates.registrationDeadline);
        if (deadline && new Date(deadline) < now) {
            return res.status(400).json({ msg: 'Registration deadline has passed' });
        }

        // 2) Check registration limit
        if (event.registrationLimit) {
            const currentCount = await Registration.countDocuments({ eventId: event._id, status: { $in: ['Successful', 'Pending'] } });
            if (currentCount >= event.registrationLimit) {
                return res.status(400).json({ msg: 'Registration limit reached' });
            }
        }

        // 3) Merchandise handling: ensure selection provided and sufficient stock. Reserve stock atomically.
        let finalStatus = event.eventType === 'Merchandise' ? 'Pending' : 'Successful';
        if (event.eventType === 'Merchandise') {
            // Expect merchandiseSelection: { variantId, variantName, quantity }
            if (!merchandiseSelection) {
                return res.status(400).json({ msg: 'Merchandise selection required for merchandise events' });
            }

            const qty = merchandiseSelection.quantity || 1;

            // Find the merchandise item inside event
            const item = (event.merchandiseItems || []).find(it => {
                if (merchandiseSelection.variantId && it._id && it._id.toString() === merchandiseSelection.variantId) return true;
                if (merchandiseSelection.variantName && it.variantName === merchandiseSelection.variantName) return true;
                return false;
            });

            if (!item) return res.status(400).json({ msg: 'Selected merchandise item not found' });

            console.log('[registerForEvent] selected merchandise item:', { itemId: item._id, variantName: item.variantName, stock: item.stockQuantity, reserved: item.reservedQuantity, qty });
            // Check available (stock - reserved)
            const available = (item.stockQuantity || 0) - (item.reservedQuantity || 0);
            if (available < qty) {
                return res.status(400).json({ msg: 'Selected merchandise is out of stock or insufficient quantity' });
            }

            // Atomically increment reservedQuantity to reserve items for approval workflow
            const updateResult = await Event.updateOne(
                { _id: event._id, 'merchandiseItems._id': item._id, 'merchandiseItems.reservedQuantity': { $gte: 0 } },
                { $inc: { 'merchandiseItems.$.reservedQuantity': qty } }
            );

            console.log('[registerForEvent] reserve updateResult:', updateResult);

            if (updateResult.modifiedCount === 0) {
                return res.status(400).json({ msg: 'Failed to reserve merchandise — try again' });
            }
        }

        // Check if already registered
        const existingReg = await Registration.findOne({ 
            participantId: req.user.id, 
            eventId 
        });
        if (existingReg) return res.status(400).json({ msg: "Already registered for this event" });

        // Logic for Merchandise stock (if applicable)
        if (event.eventType === 'Merchandise') {
            // Logic for stock decrementing can go here
        }

        // For Merchandise events we intentionally do NOT generate ticket/QR until approval.
        let ticketId = null;
        let qrCodeImage = null;
        if (finalStatus === 'Successful') {
            ticketId = `FEL-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
            qrCodeImage = await QRCode.toDataURL(ticketId);
        }

        // Create Registration
        const registrationData = {
            participantId: req.user.id,
            eventId: eventId,
            // ticketId is only set if valid
            qrCode: qrCodeImage,
            formResponses,
            status: finalStatus,
            merchandiseSelection // Save this so we can finalize stock later
        };

        if (ticketId) {
            registrationData.ticketId = ticketId;
        }

        const registration = new Registration(registrationData);

        await registration.save();
        console.log('[registerForEvent] registration saved:', registration._id);        // Lock the form (Assignment Requirement)
        event.formLocked = true;
        await event.save();

        // -----------------------------------------------------
        // EMAIL NOTIFICATION LOGIC (send only for Successful immediate registrations)
        // -----------------------------------------------------
        if (finalStatus === 'Successful' && process.env.EMAIL_USER && process.env.EMAIL_PASS) {
            const transporter = nodemailer.createTransport({
                host: process.env.EMAIL_HOST || 'smtp.gmail.com',
                port: process.env.EMAIL_PORT ? parseInt(process.env.EMAIL_PORT) : 587,
                secure: false,
                auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS }
            });

            // Get user details for email
            const user = await require('../models/User').findById(req.user.id);
            
            const mailOptions = {
                from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
                to: user.email,
                subject: `Registration Confirmed: ${event.name}`,
                html: `
                    <h1>Registration Confirmed!</h1>
                    <p>Dear ${user.firstName},</p>
                    <p>You have successfully registered for <b>${event.name}</b>.</p>
                    <p><b>Event Date:</b> ${event.eventDates ? new Date(event.eventDates.start).toDateString() : 'TBA'}</p>
                    <p><b>Your Ticket ID:</b> ${ticketId}</p>
                    <br/>
                    <p>Please find your QR Code attached.</p>
                    <p>Best Regards,<br/>Felicity Team</p>
                `,
                attachments: [
                    {
                        filename: 'ticket-qr.png',
                        content: qrCodeImage.split("base64,")[1],
                        encoding: 'base64'
                    }
                ]
            };

            transporter.sendMail(mailOptions, (err, info) => {
                if (err) console.error("Email sending failed:", err);
                else console.log("Ticket email sent:", info.response);
            });
        }

        res.status(201).json({ 
            msg: "Registration successful", 
            ticketId: registration.ticketId,
            qrCode: qrCodeImage 
        });
    } catch (err) {
        // Log full error and return message for easier local debugging
        console.error('[registerForEvent] Error:', err);
        // Return error message in JSON to help debugging locally (remove in prod)
        res.status(500).json({ msg: 'Server Error during registration', error: err.message });
    }
};

// 3. Cancel Registration (Participant cancels own, or Organizer rejects/cancels)
exports.cancelRegistration = async (req, res) => {
    try {
        const regId = req.params.id;
        
        // Find registration
        const registration = await Registration.findById(regId).populate('eventId');
        
        if (!registration) {
            return res.status(404).json({ msg: 'Registration not found' });
        }

        const userId = req.user.id;
        const userRole = req.user.role;

        // AUTH CHECK
        if (userRole === 'Participant') {
            // Participant can only cancel their own
            if (String(registration.participantId) !== String(userId)) {
                return res.status(403).json({ msg: 'Forbidden' });
            }
            // Cannot cancel if event is already over or cancelled
            if (registration.status === 'Cancelled' || registration.status === 'Rejected') {
                return res.status(400).json({ msg: 'Registration is already cancelled' });
            }
        } else if (userRole === 'Organizer') {
             // Organizer can only cancel registrations for their events
             // Check if event exists (handle populated eventId being null)
             if (!registration.eventId) {
                 return res.status(404).json({ msg: 'Associated event not found' });
             }
             
             // Check organizer ownership
             // registration.eventId is the populated event object
             if (String(registration.eventId.organizerId) !== String(userId)) {
                 return res.status(403).json({ msg: 'Forbidden' });
             }
        } 
        
        // If event is Merchandise type, try to restore or release reserved stock depending on current status
        if (registration.eventId.eventType === 'Merchandise' && registration.status !== 'Cancelled') {
            const merchSel = registration.merchandiseSelection;
            const eventDoc = registration.eventId; 

            if (merchSel && merchSel.variantId && merchSel.quantity) {
                try {
                    if (registration.status === 'Pending') {
                        // Release reservation
                        await Event.updateOne(
                            { _id: eventDoc._id, "merchandiseItems._id": merchSel.variantId },
                            { $inc: { "merchandiseItems.$.reservedQuantity": -merchSel.quantity } }
                        );
                        console.log(`Released reservation of ${merchSel.quantity} items for variant ${merchSel.variantId} in event ${eventDoc._id}`);
                    } else if (registration.status === 'Successful') {
                        // Restore sold stock
                        await Event.updateOne(
                            { _id: eventDoc._id, "merchandiseItems._id": merchSel.variantId },
                            { $inc: { "merchandiseItems.$.stockQuantity": merchSel.quantity } }
                        );
                        console.log(`Restored ${merchSel.quantity} items for variant ${merchSel.variantId} in event ${eventDoc._id}`);
                    }
                } catch (updateErr) {
                    console.error('Failed to restore/release merchandise stock:', updateErr);
                }
            }
        }

        // Perform Update
        // Allow organizer to specify 'Rejected' or default 'Cancelled'
        const newStatus = req.body.status === 'Rejected' ? 'Rejected' : 'Cancelled';
        registration.status = newStatus;
        
        await registration.save();
        res.json({ msg: `Registration ${newStatus} successfully`, status: newStatus });    } catch (err) {
        console.error('Error cancelling registration:', err);
        res.status(500).send('Server Error');
    }
};

// Approve a pending merchandise registration (Organizer or Admin)
exports.approveRegistration = async (req, res) => {
    try {
        const regId = req.params.id;
        const registration = await Registration.findById(regId).populate('eventId');
        if (!registration) return res.status(404).json({ msg: 'Registration not found' });

        if (registration.status !== 'Pending') return res.status(400).json({ msg: 'Only pending registrations can be approved' });

        const eventDoc = registration.eventId;
        if (!eventDoc) return res.status(404).json({ msg: 'Associated event not found' });

        // Authorization: Organizer must own the event or Admin
        if (req.user.role === 'Organizer' && String(eventDoc.organizerId) !== String(req.user.id)) {
            return res.status(403).json({ msg: 'Forbidden' });
        }

        const merchSel = registration.merchandiseSelection || {};
        const qty = merchSel.quantity || 1;

        // find variant
        const item = (eventDoc.merchandiseItems || []).find(it => {
            if (merchSel.variantId && it._id && it._id.toString() === merchSel.variantId) return true;
            if (merchSel.variantName && it.variantName === merchSel.variantName) return true;
            return false;
        });
        if (!item) return res.status(400).json({ msg: 'Merchandise variant not found' });

        // Atomically decrement stockQuantity and reservedQuantity
        const updateResult = await Event.updateOne(
            { _id: eventDoc._id, 'merchandiseItems._id': item._id, 'merchandiseItems.reservedQuantity': { $gte: qty }, 'merchandiseItems.stockQuantity': { $gte: qty } },
            { $inc: { 'merchandiseItems.$.stockQuantity': -qty, 'merchandiseItems.$.reservedQuantity': -qty } }
        );

        if (updateResult.modifiedCount === 0) {
            return res.status(400).json({ msg: 'Failed to finalize stock for approval — try again' });
        }

        // Generate ticket and QR now
        const ticketId = `FEL-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
        const qrCodeImage = await QRCode.toDataURL(ticketId);

        registration.ticketId = ticketId;
        registration.qrCode = qrCodeImage;
        registration.status = 'Successful';
        registration.approvedAt = new Date();
        await registration.save();

        // Send confirmation email if configured
        if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
            const transporter = nodemailer.createTransport({
                host: process.env.EMAIL_HOST || 'smtp.gmail.com',
                port: process.env.EMAIL_PORT ? parseInt(process.env.EMAIL_PORT) : 587,
                secure: false,
                auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS }
            });

            const user = await require('../models/User').findById(registration.participantId);

            const mailOptions = {
                from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
                to: user.email,
                subject: `Order Approved: ${eventDoc.name}`,
                html: `<p>Your order for <b>${eventDoc.name}</b> has been approved. Ticket ID: <b>${ticketId}</b></p>`,
                attachments: [
                    { filename: 'ticket-qr.png', content: qrCodeImage.split('base64,')[1], encoding: 'base64' }
                ]
            };

            transporter.sendMail(mailOptions, (err, info) => {
                if (err) console.error('Approval email failed:', err);
                else console.log('Approval email sent:', info && info.response);
            });
        }

        res.json({ msg: 'Registration approved and ticket generated', ticketId });
    } catch (err) {
        console.error('approveRegistration error:', err);
        res.status(500).json({ msg: 'Server Error' });
    }
};

// Reject a pending merchandise registration and release reserved stock
exports.rejectRegistration = async (req, res) => {
    try {
        const regId = req.params.id;
        const registration = await Registration.findById(regId).populate('eventId');
        if (!registration) return res.status(404).json({ msg: 'Registration not found' });

        if (registration.status !== 'Pending') return res.status(400).json({ msg: 'Only pending registrations can be rejected' });

        const eventDoc = registration.eventId;
        if (!eventDoc) return res.status(404).json({ msg: 'Associated event not found' });

        // Authorization: Organizer must own the event or Admin
        if (req.user.role === 'Organizer' && String(eventDoc.organizerId) !== String(req.user.id)) {
            return res.status(403).json({ msg: 'Forbidden' });
        }

        const merchSel = registration.merchandiseSelection || {};
        const qty = merchSel.quantity || 1;

        // decrement reservedQuantity to release items
        try {
            await Event.updateOne(
                { _id: eventDoc._id, 'merchandiseItems._id': merchSel.variantId },
                { $inc: { 'merchandiseItems.$.reservedQuantity': -qty } }
            );
        } catch (e) {
            console.error('Failed to release reserved stock on reject:', e);
        }

        registration.status = 'Rejected';
        registration.rejectedAt = new Date();
        await registration.save();

        // Optional: send rejection email
        if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
            const transporter = nodemailer.createTransport({
                host: process.env.EMAIL_HOST || 'smtp.gmail.com',
                port: process.env.EMAIL_PORT ? parseInt(process.env.EMAIL_PORT) : 587,
                secure: false,
                auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS }
            });

            const user = await require('../models/User').findById(registration.participantId);
            const mailOptions = {
                from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
                to: user.email,
                subject: `Order Rejected: ${eventDoc.name}`,
                html: `<p>Your order for <b>${eventDoc.name}</b> has been rejected by the organizer.</p>`
            };

            transporter.sendMail(mailOptions, (err, info) => {
                if (err) console.error('Rejection email failed:', err);
                else console.log('Rejection email sent:', info && info.response);
            });
        }

        res.json({ msg: 'Registration rejected' });
    } catch (err) {
        console.error('rejectRegistration error:', err);
        res.status(500).json({ msg: 'Server Error' });
    }
};

// Mark Attendance (Organizer Only, via Scanner)
exports.markAttendance = async (req, res) => {
    try {
        const { ticketId } = req.body;
        const eventId = req.params.eventId; // From route /:eventId/attendance

        // Validate event ownership if needed (middleware handles basics usually)
        
        const registration = await Registration.findOne({ ticketId, eventId });
        if (!registration) {
            return res.status(404).json({ msg: 'Invalid Ticket for this Event' });
        }

        if (registration.status !== 'Successful') {
            return res.status(400).json({ msg: `Cannot scan. Status is ${registration.status}` });
        }

        if (registration.attendance && registration.attendance.isScanned) {
            return res.status(400).json({ msg: 'Ticket already used/scanned' });
        }

        // Update attendance
        registration.attendance = {
            isScanned: true,
            scannedAt: new Date()
        };
        await registration.save();

        // Create audit record for this scan
        try {
            await AttendanceAudit.create({
                eventId,
                registrationId: registration._id,
                actorId: req.user ? req.user.id : null,
                actorRole: req.user ? req.user.role : 'Organizer',
                action: 'scan',
                reason: 'QR scanned via scanner'
            });
        } catch (auditErr) {
            console.error('Failed to write attendance audit:', auditErr);
        }

        // Emit attendance update for SSE clients (send eventId and simple payload)
        attendanceEmitter.emit('attendanceUpdated', { eventId: String(eventId), registrationId: String(registration._id), ticketId, participantId: registration.participantId });

        res.json({ msg: 'Attendance Marked', participant: registration.participantId });
    } catch (err) {
        console.error('Attendance Scan Error:', err);
        res.status(500).send('Server Error');
    }
};

// Manual override endpoint for organizers/admins to mark/unmark attendance with audit logging
exports.overrideAttendance = async (req, res) => {
    try {
        const regId = req.params.id;
        const { action, reason } = req.body; // action: 'mark' or 'unmark'

        const registration = await Registration.findById(regId);
        if (!registration) return res.status(404).json({ msg: 'Registration not found' });

        const eventId = registration.eventId;

        if (action === 'mark') {
            if (registration.attendance && registration.attendance.isScanned) return res.status(400).json({ msg: 'Already marked' });
            registration.attendance = { isScanned: true, scannedAt: new Date() };
            await registration.save();

            await AttendanceAudit.create({ eventId, registrationId: registration._id, actorId: req.user.id, actorRole: req.user.role, action: 'admin-mark', reason: reason || 'Manual override mark' });

            // emit
            attendanceEmitter.emit('attendanceUpdated', { eventId: String(eventId), registrationId: String(registration._id), ticketId: registration.ticketId, participantId: registration.participantId });

            return res.json({ msg: 'Attendance manually marked' });
        } else if (action === 'unmark') {
            if (!registration.attendance || !registration.attendance.isScanned) return res.status(400).json({ msg: 'Not currently marked' });
            registration.attendance = { isScanned: false, scannedAt: null };
            await registration.save();

            await AttendanceAudit.create({ eventId, registrationId: registration._id, actorId: req.user.id, actorRole: req.user.role, action: 'admin-unmark', reason: reason || 'Manual override unmark' });

            attendanceEmitter.emit('attendanceUpdated', { eventId: String(eventId), registrationId: String(registration._id), ticketId: registration.ticketId, participantId: registration.participantId });

            return res.json({ msg: 'Attendance manually unmarked' });
        } else {
            return res.status(400).json({ msg: 'Invalid action' });
        }
    } catch (err) {
        console.error('Override attendance error:', err);
        res.status(500).send('Server Error');
    }
};

// Image-based QR scan endpoint (file upload expected)
exports.scanImage = async (req, res) => {
    try {
        // multer will have attached file at req.file
        if (!req.file) return res.status(400).json({ msg: 'No image uploaded' });

        // Decode image for QR using Jimp + qrcode-reader
        const Jimp = require('jimp');
        const QrCodeReader = require('qrcode-reader');

        const buffer = req.file.buffer;
        const img = await Jimp.read(buffer);
        const qr = new QrCodeReader();

        const value = await new Promise((resolve, reject) => {
            qr.callback = (err, v) => {
                if (err) return reject(err);
                resolve(v && v.result ? v.result : null);
            };
            qr.decode(img.bitmap);
        });

        if (!value) return res.status(400).json({ msg: 'No QR code found in image' });

        const ticketId = value;
        const eventId = req.params.eventId;

        // Reuse markAttendance logic pattern
        const registration = await Registration.findOne({ ticketId, eventId });
        if (!registration) return res.status(404).json({ msg: 'Invalid Ticket for this Event' });
        if (registration.status !== 'Successful') return res.status(400).json({ msg: `Cannot scan. Status is ${registration.status}` });
        if (registration.attendance && registration.attendance.isScanned) return res.status(400).json({ msg: 'Ticket already used/scanned' });

        registration.attendance = { isScanned: true, scannedAt: new Date() };
        await registration.save();

        // audit
        try { await AttendanceAudit.create({ eventId, registrationId: registration._id, actorId: req.user ? req.user.id : null, actorRole: req.user ? req.user.role : 'Organizer', action: 'scan', reason: 'Image QR scan' }); } catch (e) { console.error('Audit write failed', e); }

        attendanceEmitter.emit('attendanceUpdated', { eventId: String(eventId), registrationId: String(registration._id), ticketId, participantId: registration.participantId });

        res.json({ msg: 'Attendance Marked (from image)', participant: registration.participantId });
    } catch (err) {
        console.error('scanImage error:', err);
        res.status(500).json({ msg: 'Failed to decode image' });
    }
};

// SSE stream for live attendance updates for an event
exports.streamAttendance = async (req, res) => {
    try {
        const eventId = req.params.eventId;

        // Set headers for SSE
        res.writeHead(200, {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            Connection: 'keep-alive'
        });

        const sendSnapshot = async () => {
            // Provide a simple snapshot: counts
            const totalRegs = await Registration.countDocuments({ eventId, status: 'Successful' });
            const scanned = await Registration.countDocuments({ eventId, 'attendance.isScanned': true });
            res.write(`event: snapshot\n`);
            res.write(`data: ${JSON.stringify({ totalRegs, scanned })}\n\n`);
        };

        // Send initial snapshot
        await sendSnapshot();

        const listener = async (payload) => {
            if (!payload || String(payload.eventId) !== String(eventId)) return;
            // send the payload to client
            res.write(`event: attendanceUpdated\n`);
            res.write(`data: ${JSON.stringify(payload)}\n\n`);

            // send updated counts as well
            await sendSnapshot();
        };

        attendanceEmitter.on('attendanceUpdated', listener);

        // Clean up when client disconnects
        req.on('close', () => {
            attendanceEmitter.removeListener('attendanceUpdated', listener);
        });
    } catch (err) {
        console.error('streamAttendance error:', err);
        res.status(500).end();
    }
};

// Get Attendance Audit records for an event (Organizer can only view their own events)
exports.getAttendanceAudit = async (req, res) => {
    try {
        const eventId = req.params.eventId;

        // If Organizer, ensure they own the event
        if (req.user.role === 'Organizer') {
            const ev = await Event.findById(eventId).lean();
            if (!ev) return res.status(404).json({ msg: 'Event not found' });
            if (String(ev.organizerId) !== String(req.user.id)) return res.status(403).json({ msg: 'Forbidden' });
        }

        const audits = await AttendanceAudit.find({ eventId })
            .populate('registrationId', 'ticketId participantId')
            .populate('actorId', 'firstName lastName email')
            .sort({ createdAt: -1 })
            .lean();

        res.json(audits);
    } catch (err) {
        console.error('Failed to fetch attendance audits:', err);
        res.status(500).json({ msg: 'Server Error' });
    }
};