const Event = require('../models/Event');
const Registration = require('../models/Registration'); // Required for counting participants
const User = require('../models/User');
const bcrypt = require('bcryptjs');
const QRCode = require('qrcode');
const nodemailer = require('nodemailer');
const https = require('https'); // For Discord Webhook

// Configure optional email transporter if environment variables provided
let transporter = null;
if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
    transporter = nodemailer.createTransport({
        host: process.env.EMAIL_HOST || 'smtp.gmail.com',
        port: process.env.EMAIL_PORT ? parseInt(process.env.EMAIL_PORT) : 587,
        secure: false,
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS
        }
    });
}

// 1. Create a new Event (Organizer Only)
exports.createEvent = async (req, res) => {
    try {
        const { 
            name, description, eventType, dates, 
            registrationLimit, eligibility, customForm, merchandiseItems, status,
            registrationFee, registrationDeadline
        } = req.body;

        // Normalize dates into schema's eventDates field and set registrationDeadline/fee
        const eventDates = dates && (dates.start || dates.end) ? { start: dates.start, end: dates.end } : undefined;
        const deadline = registrationDeadline || (dates && dates.registrationDeadline) || undefined;

        const newEvent = new Event({
            name,
            description,
            eventType,
            organizerId: req.user.id, // Populated from authMiddleware
            eventDates: eventDates,
            registrationDeadline: deadline,
            registrationFee: registrationFee || 0,
            registrationLimit,
            eligibility,
            customForm, 
            merchandiseItems,
            status: status || 'Draft' // Default to Draft now, requires explicit Publish
        });

        const event = await newEvent.save();

        // -----------------------------------------------------
        // DISCORD WEBHOOK LOGIC (Requirement 10.5)
        // -----------------------------------------------------
        // Prioritize Organizer's personal webhook, fallback to global if set
        const webhookUrl = req.user.discordWebhook || process.env.DISCORD_WEBHOOK_URL;
        if (process.env.NODE_ENV !== 'production') console.log('[Discord] Attempting webhook:', webhookUrl);

        if (webhookUrl) {
            const payload = JSON.stringify({
                content: `📢 **New Event Published!**\n**${name}**\n${description}\nType: ${eventType}`
            });
            
            try {
                const url = new URL(webhookUrl);
                const reqDiscord = https.request({
                    hostname: url.hostname,
                    path: url.pathname + url.search, // Include query params like ?wait=true
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Content-Length': Buffer.byteLength(payload)
                    }
                }, (resD) => {
                    if (resD.statusCode < 200 || resD.statusCode > 299) {
                         console.error(`[Discord] Error Status Code: ${resD.statusCode}`);
                    }
                });
                
                reqDiscord.on('error', (e) => console.error('[Discord] Request Error:', e));
                reqDiscord.write(payload);
                reqDiscord.end();
            } catch (uErr) {
                console.error('[Discord] Invalid URL:', uErr);
            }
        }

        res.status(201).json(event);
    } catch (err) {
        console.error(err);
        res.status(500).send("Server Error while creating event");
    }
};

// 2. Get Events (Filtered by Role + Registration Counts)
exports.getAllEvents = async (req, res) => {
    try {
        // Always show published events to callers (public listing).
        const query = { status: 'Published' };

        // -----------------------------------------------------
        // SEARCH & FILTER LOGIC (Requirement 9.3)
        // -----------------------------------------------------
        const { search, type, eligibility, startDate, endDate, trend, organizer } = req.query;

        // Search: Partial & Fuzzy (using Regex)
        if (search) {
            // First, find organizer IDs whose name/email match the search so we can include their events
            try {
                const orgMatches = await User.find({
                    role: 'Organizer',
                    $or: [
                        { firstName: { $regex: search, $options: 'i' } },
                        { lastName: { $regex: search, $options: 'i' } },
                        { email: { $regex: search, $options: 'i' } }
                    ]
                }).select('_id').lean();

                const organizerIds = orgMatches.map(o => o._id);

                query.$or = [
                    { name: { $regex: search, $options: 'i' } },
                    { description: { $regex: search, $options: 'i' } }
                ];

                if (organizerIds.length > 0) {
                    query.$or.push({ organizerId: { $in: organizerIds } });
                }
            } catch (err) {
                // If organizer lookup fails for any reason, fall back to searching only event fields
                query.$or = [
                    { name: { $regex: search, $options: 'i' } },
                    { description: { $regex: search, $options: 'i' } }
                ];
            }
        }

        // Followed clubs filter: if requested, return events whose organizer is in the user's followed list
        if (req.query.followed === 'true') {
            try {
                // protect middleware ensures req.user exists for authenticated requests
                if (!req.user || !req.user._id) {
                    return res.status(401).json({ msg: 'Authentication required for followed filter' });
                }
                const currentUser = await User.findById(req.user._id).select('preferences');
                const followed = (currentUser?.preferences?.followedClubs || []).map(id => id);
                if (!followed || followed.length === 0) {
                    // Return empty list early if user follows no clubs
                    return res.json([]);
                }
                // Override organizer filter to the followed list
                query.organizerId = { $in: followed };
            } catch (err) {
                console.error('Error applying followed filter:', err);
            }
        }

        // Filters
        if (type) query.eventType = type;
        if (eligibility) query.eligibility = eligibility;
        if (organizer) query.organizerId = organizer; // Add Organizer Filter
        
        // Date Range
        if (startDate || endDate) {
            query['eventDates.start'] = {};
            if (startDate) query['eventDates.start'].$gte = new Date(startDate);
            if (endDate) query['eventDates.start'].$lte = new Date(endDate);
        }

        // Fetch events
        let events = await Event.find(query)
            .populate('organizerId', 'firstName lastName')
            .lean();

        // For each event, add the current number of registrations
        const eventsWithCounts = await Promise.all(events.map(async (event) => {
            const count = await Registration.countDocuments({ 
                eventId: event._id,
                status: { $in: ['Successful', 'Pending'] } 
            });
            return { ...event, registrationCount: count };
        }));

        
        // -----------------------------------------------------
        // Personalization: If the request is authenticated, boost events that match
        // the user's preferences (areasOfInterest <-> event.tags) and events from
        // organizers the user follows. This affects ordering/recommendations.
        try {
            if (req.user && req.user.id) {
                const currentUser = await User.findById(req.user.id).select('preferences').lean();
                const areas = (currentUser?.preferences?.areasOfInterest || []).map(a => String(a).toLowerCase());
                const followed = (currentUser?.preferences?.followedClubs || []).map(id => String(id));

                // Compute a score for each event and sort by score desc, then registrationCount
                eventsWithCounts.forEach(ev => {
                    let score = 0;
                    try {
                        // Organizer boost
                        const orgId = ev.organizerId && ev.organizerId._id ? String(ev.organizerId._id) : String(ev.organizerId);
                        if (followed.includes(orgId)) score += 5;

                        // Tag/area match boost
                        if (Array.isArray(ev.tags) && ev.tags.length > 0 && areas.length > 0) {
                            const tagMatches = ev.tags.reduce((acc, t) => {
                                if (!t) return acc;
                                if (areas.includes(String(t).toLowerCase())) return acc + 1;
                                return acc;
                            }, 0);
                            score += tagMatches * 2;
                        }
                    } catch (e) {
                        // ignore scoring errors for resilience
                        score += 0;
                    }
                    ev._preferenceScore = score;
                });

                // Only reorder if any score > 0
                const anyBoost = eventsWithCounts.some(e => e._preferenceScore && e._preferenceScore > 0);
                if (anyBoost) {
                    eventsWithCounts.sort((a, b) => {
                        if ((b._preferenceScore || 0) !== (a._preferenceScore || 0)) return (b._preferenceScore || 0) - (a._preferenceScore || 0);
                        if ((b.registrationCount || 0) !== (a.registrationCount || 0)) return (b.registrationCount || 0) - (a.registrationCount || 0);
                        // fallback to newer events first
                        return new Date(b.createdAt) - new Date(a.createdAt);
                    });
                }
            }
        } catch (e) {
            console.error('Error applying personalization:', e);
        }

        if (trend === 'true') {
            // Sort by registration count descending
            eventsWithCounts.sort((a, b) => b.registrationCount - a.registrationCount);
            // Return top 5
            return res.json(eventsWithCounts.slice(0, 5));
        }

        res.json(eventsWithCounts);
    } catch (err) {
        console.error(err);
        res.status(500).send("Server Error");
    }
};

// 2.a Get events for the logged-in Organizer (Organizer dashboard)
exports.getOrganizerEvents = async (req, res) => {
    try {
        const organizerId = req.user.id;
        const events = await Event.find({ organizerId })
            .populate('organizerId', 'firstName lastName')
            .lean();

        const eventsWithCounts = await Promise.all(events.map(async (event) => {
            const count = await Registration.countDocuments({ 
                eventId: event._id,
                status: { $in: ['Successful', 'Pending'] }
            });
            return { ...event, registrationCount: count };
        }));

        res.json(eventsWithCounts);
    } catch (err) {
        console.error(err);
        res.status(500).send('Server Error');
    }
};

// NEW: Get aggregated stats for Organizer Dashboard (Requirement 10.2)
exports.getOrganizerStats = async (req, res) => {
    try {
        const organizerId = req.user.id;
        
        // Find all events by this organizer
        const events = await Event.find({ organizerId }).select('_id name eventType registrationFee merchandiseItems');
        const eventIds = events.map(e => e._id);

        if (eventIds.length === 0) {
            return res.json({
                totalRegistrations: 0,
                totalRevenue: 0,
                totalAttendance: 0,
                eventsCount: 0
            });
        }

        // Aggregate Registrations
        const stats = await Registration.aggregate([
            { $match: { eventId: { $in: eventIds }, status: 'Successful' } },
            {
                $group: {
                    _id: null,
                    count: { $sum: 1 },
                    attendanceMatches: { 
                        $sum: { 
                            $cond: [ { $ifNull: ["$attendance.isScanned", false] }, 1, 0 ] 
                        } 
                    }
                }
            }
        ]);

        // Calculate Revenue (requires detailed logic due to Merchandise variable pricing)
        // We'll fetch all successful registrations to calculate revenue accurately in JS
        const allRegs = await Registration.find({ 
            eventId: { $in: eventIds }, 
            status: 'Successful' 
        }).select('eventId merchandiseSelection');

        let totalRevenue = 0;
        allRegs.forEach(reg => {
            const evt = events.find(e => e._id.toString() === reg.eventId.toString());
            if (!evt) return;

            if (evt.eventType === 'Normal') {
                totalRevenue += (evt.registrationFee || 0);
            } else if (evt.eventType === 'Merchandise' && reg.merchandiseSelection) {
                // Find item price
                const item = evt.merchandiseItems.find(i => i._id.toString() === reg.merchandiseSelection.variantId);
                if (item) {
                     totalRevenue += (item.price * (reg.merchandiseSelection.quantity || 1));
                }
            }
        });

        res.json({
            totalRegistrations: stats[0]?.count || 0,
            totalAttendance: stats[0]?.attendanceMatches || 0,
            totalRevenue,
            eventsCount: events.length
        });

    } catch (err) {
        console.error('Error fetching stats:', err);
        res.status(500).send('Server Error');
    }
};

// 3. Get Single Event by ID (Required for the Registration Page)
exports.getEventById = async (req, res) => {
    try {
        let event = await Event.findById(req.params.id).populate('organizerId', 'firstName lastName').lean();
        
        if (!event) {
            return res.status(404).json({ msg: "Event not found" });
        }

        // Add registration count to single event fetch
        const count = await Registration.countDocuments({ 
            eventId: event._id,
            status: { $in: ['Successful', 'Pending'] } 
        });
        event.registrationCount = count;

        res.json(event);
    } catch (err) {
        console.error(err);
        if (err.kind === 'ObjectId') return res.status(404).json({ msg: "Event not found" });
        res.status(500).send("Server Error");
    }
};

/**
 * Return an .ics calendar file for the given event ID
 * Endpoint: GET /api/events/:id/ics
 */
exports.getEventICS = async (req, res) => {
    try {
        const event = await Event.findById(req.params.id).populate('organizerId', 'firstName lastName').lean();
        if (!event) {
            return res.status(404).json({ msg: 'Event not found' });
        }


        // Determine start/end dates (support several shapes: event.dates.{start,end}, event.eventDates, plain strings, arrays)
        const resolveDate = (input) => {
            if (!input) return null;
            // If it's already a date or ISO string
            if (typeof input === 'string' || input instanceof Date) {
                const d = new Date(input);
                return isNaN(d.getTime()) ? null : d;
            }
            // If it's an object like { start, end }
            if (typeof input === 'object') {
                if (input.start) {
                    const d = new Date(input.start);
                    if (!isNaN(d.getTime())) return d;
                }
                // sometimes stored as { startDate: '', endDate: '' }
                if (input.startDate) {
                    const d = new Date(input.startDate);
                    if (!isNaN(d.getTime())) return d;
                }
                // sometimes an array of ranges
                if (Array.isArray(input) && input.length > 0) {
                    return resolveDate(input[0]);
                }
            }
            return null;
        };

        // Recursive search: find any date-like value in an object/array
        const findDateInObject = (obj, visited = new WeakSet()) => {
            if (!obj) return null;
            if (typeof obj === 'string' || obj instanceof Date) {
                const d = new Date(obj);
                return isNaN(d.getTime()) ? null : d;
            }
            if (typeof obj !== 'object') return null;
            if (visited.has(obj)) return null;
            visited.add(obj);

            if (Array.isArray(obj)) {
                for (const el of obj) {
                    const f = findDateInObject(el, visited);
                    if (f) return f;
                }
                return null;
            }

            // check common keys first
            const keysToCheck = ['start', 'startDate', 'date', 'dates', 'eventDates', 'from'];
            for (const k of keysToCheck) {
                if (obj[k]) {
                    const f = findDateInObject(obj[k], visited);
                    if (f) return f;
                }
            }

            // fallback: scan all values
            for (const k of Object.keys(obj)) {
                try {
                    const f = findDateInObject(obj[k], visited);
                    if (f) return f;
                } catch (e) {
                    // ignore traversal errors
                }
            }
            return null;
        };

        let startDate = resolveDate(event.dates) || resolveDate(event.eventDates) || resolveDate(event.start) || resolveDate(event.startDate) || null;
        let endDate = resolveDate(event.dates && event.dates.end) || resolveDate(event.eventDates && event.eventDates.end) || resolveDate(event.end) || resolveDate(event.endDate) || null;

        // fallback to recursive search if not found in expected places
        if (!startDate) {
            startDate = findDateInObject(event) || findDateInObject(event.dates) || findDateInObject(event.eventDates) || null;
            if (startDate) console.log('[ICS] found start date via recursive search:', startDate);
        }

        if (!startDate) {
            console.warn('[ICS] Event start date not available for event:', event._id);
            return res.status(400).json({ msg: 'Event start date not available for calendar export' });
        }

        if (!endDate) {
            // default to 2 hours after start
            endDate = new Date(startDate.getTime() + 2 * 60 * 60 * 1000);
        }

        const formatICSDate = (d) => {
            // Return YYYYMMDDTHHMMSSZ in UTC
            const dt = new Date(d);
            return dt.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
        };

        const uid = `${event._id}@felicity`;
        const dtStamp = formatICSDate(new Date());
        const dtStart = formatICSDate(startDate);
        const dtEnd = formatICSDate(endDate);

        const escapeText = (str) => {
            if (!str) return '';
            return String(str).replace(/\r?\n/g, '\\n').replace(/,/g, '\\,');
        };

        const summary = escapeText(event.name || 'Event');
        const description = escapeText(event.description || '');
        const organizer = event.organizerId ? `${event.organizerId.firstName || ''} ${event.organizerId.lastName || ''}`.trim() : '';

        const icsLines = [
            'BEGIN:VCALENDAR',
            'VERSION:2.0',
            'PRODID:-//Felicity Event Management//EN',
            'CALSCALE:GREGORIAN',
            'METHOD:PUBLISH',
            'BEGIN:VEVENT',
            `UID:${uid}`,
            `DTSTAMP:${dtStamp}`,
            `DTSTART:${dtStart}`,
            `DTEND:${dtEnd}`,
            `SUMMARY:${summary}`,
            `DESCRIPTION:${description}`,
        ];

        if (organizer) icsLines.push(`ORGANIZER:${escapeText(organizer)}`);

        // Add location if present on event (some events may include location field)
        if (event.location) icsLines.push(`LOCATION:${escapeText(event.location)}`);

        icsLines.push('END:VEVENT', 'END:VCALENDAR');

        const icsContent = icsLines.join('\r\n');

        // Set headers to prompt download
        const safeName = (event.name || 'event').replace(/[^a-z0-9\-_. ]/ig, '').replace(/\s+/g, '_');
        res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="${safeName}.ics"`);
        res.send(icsContent);
    } catch (err) {
        console.error('Error generating ICS:', err);
        res.status(500).send('Server Error');
    }
};

// Update event fields (Organizer only) - supports registrationDeadline and registrationLimit updates
exports.updateEvent = async (req, res) => {
    try {
        const eventId = req.params.id;
        // Accept all possible fields, but apply logic based on status
        const updates = req.body; // { name, description, ... }

        const event = await Event.findById(eventId);
        if (!event) return res.status(404).json({ msg: 'Event not found' });

        // Only the organizer who created the event may update it
        if (String(event.organizerId) !== String(req.user.id)) {
            return res.status(403).json({ msg: 'Forbidden' });
        }

        // -----------------------------------------------------
        // EDITING RULES (Requirement 10.4)
        // -----------------------------------------------------
        if (event.status === 'Draft') {
            // Free edits allowed
            Object.assign(event, updates);
        } else if (event.status === 'Published') {
            // Restricted edits: description, deadline, limit, status (to close)
            if (updates.description) event.description = updates.description;
            if (updates.registrationDeadline) event.registrationDeadline = updates.registrationDeadline;
            if (updates.registrationLimit) event.registrationLimit = updates.registrationLimit;
            if (updates.status) event.status = updates.status; 
            // Note: Cannot change Name, Type, Custom Form once published
        } else {
            // Ongoing/Closed
            if (updates.status) event.status = updates.status;
            // No other edits
        }

        await event.save();
        res.json({ msg: 'Event updated', event });
    } catch (err) {
        console.error('Error updating event:', err);
        res.status(500).send('Server Error');
    }
};

/**
 * Get Participants for an Event (Organizer/Admin) (Requirement 10.3)
 */
exports.getEventParticipants = async (req, res) => {
    try {
        const eventId = req.params.id;
        const event = await Event.findById(eventId);
        if (!event) return res.status(404).json({ msg: 'Event not found' });

        // Authorization Check
        if (req.user.role === 'Organizer' && String(event.organizerId) !== String(req.user.id)) {
            return res.status(403).json({ msg: 'Forbidden' });
        }
        if (req.user.role === 'Participant') {
            return res.status(403).json({ msg: 'Forbidden' });
        }

        const registrations = await Registration.find({ eventId })
            .populate('participantId', 'firstName lastName email contactNumber collegeName participantType')
            .lean();

        // Format for CSV export friendly JSON
        const participants = registrations.map(reg => ({
            _id: reg._id, // Include Registration ID for actions like Cancel/Reject
            ticketId: reg.ticketId,
            name: `${reg.participantId.firstName} ${reg.participantId.lastName}`,
            email: reg.participantId.email,
            contactNumber: reg.participantId.contactNumber,
            registrationDate: reg.createdAt,
            status: reg.status,
            attendance: reg.attendance ? reg.attendance.isScanned : false,
            merchandiseSelection: reg.merchandiseSelection // Need this for revenue calculation
        }));

        res.json(participants);
    } catch (err) {
        console.error(err);
        res.status(500).send("Server Error");
    }
};

/**
 * Organizer-only: Add a participant to an event (creates participant user if needed)
 * Endpoint: POST /api/events/:id/add-participant
 */
exports.addParticipant = async (req, res) => {
    try {
        const eventId = req.params.id;
        const { firstName, lastName, email, contactNumber, collegeName, participantType, formResponses, merchandiseSelection } = req.body;

        // Validate event
        const event = await Event.findById(eventId);
        if (!event) return res.status(404).json({ msg: 'Event not found' });

        // Check registration deadline
        const now = new Date();
        const deadline = event.registrationDeadline || (event.dates && event.dates.registrationDeadline) || (event.eventDates && event.eventDates.registrationDeadline);
        if (deadline && new Date(deadline) < now) {
            return res.status(400).json({ msg: 'Registration deadline has passed' });
        }

        // Determine participant user: find by email if provided, else create new
        let participantUser = null;
        if (email) {
            const existing = await User.findOne({ email: email.toLowerCase() });
            if (existing) {
                if (existing.role !== 'Participant') {
                    return res.status(400).json({ msg: 'Provided email belongs to a non-participant account' });
                }
                participantUser = existing;
            }
        }

        let plainPassword = null;
        if (!participantUser) {
            // Create a new participant user with a random password
            const generatedEmail = email ? email.toLowerCase() : `participant_${Date.now()}@local.invalid`;
            plainPassword = Math.random().toString(36).slice(2, 10);
            const salt = await bcrypt.genSalt(10);
            const hashed = await bcrypt.hash(plainPassword, salt);

            const newUser = new User({
                firstName: firstName || 'Participant',
                lastName: lastName || '-',
                email: generatedEmail,
                password: hashed,
                role: 'Participant',
                contactNumber,
                collegeName,
                participantType: participantType || 'Non-IIIT'
            });

            participantUser = await newUser.save();
        }

        // Check if participant already registered for this event
        const existingReg = await Registration.findOne({ participantId: participantUser._id, eventId });
        if (existingReg) return res.status(400).json({ msg: 'Participant already registered for this event' });

        // Check registration limit
        if (event.registrationLimit) {
            const currentCount = await Registration.countDocuments({ eventId: event._id, status: { $in: ['Successful', 'Pending'] } });
            if (currentCount >= event.registrationLimit) {
                return res.status(400).json({ msg: 'Registration limit reached' });
            }
        }

        // Handle merchandise if required (reuse logic similar to registerForEvent)
        let finalStatus = event.eventType === 'Merchandise' ? 'Pending' : 'Successful';
        if (event.eventType === 'Merchandise') {
            if (!merchandiseSelection) return res.status(400).json({ msg: 'Merchandise selection required for merchandise events' });
            const qty = merchandiseSelection.quantity || 1;
            const item = (event.merchandiseItems || []).find(it => {
                if (merchandiseSelection.variantId && it._id && it._id.toString() === merchandiseSelection.variantId) return true;
                if (merchandiseSelection.variantName && it.variantName === merchandiseSelection.variantName) return true;
                return false;
            });
            if (!item) return res.status(400).json({ msg: 'Selected merchandise item not found' });
            if ((item.stockQuantity || 0) < qty) return res.status(400).json({ msg: 'Selected merchandise is out of stock or insufficient quantity' });

            const updateResult = await Event.updateOne(
                { _id: event._id, 'merchandiseItems._id': item._id, 'merchandiseItems.stockQuantity': { $gte: qty } },
                { $inc: { 'merchandiseItems.$.stockQuantity': -qty } }
            );
            if (updateResult.modifiedCount === 0) return res.status(400).json({ msg: 'Failed to reserve merchandise (insufficient stock) — try again' });
            finalStatus = 'Successful';
        }

        // Generate ticket and QR
        const ticketId = `FEL-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
        const qrCodeImage = await QRCode.toDataURL(ticketId);

        // Create registration for participant
        const registration = new Registration({
            participantId: participantUser._id,
            eventId,
            ticketId,
            qrCode: qrCodeImage,
            formResponses,
            status: finalStatus
        });

        await registration.save();

        // Optionally lock the form
        event.formLocked = true;
        await event.save();

    // Return created registration and participant info (avoid sending password)
    // Use .lean() to get a plain JS object so JSON responses include all fields cleanly
    const respUser = await User.findById(participantUser._id).select('-password').lean();

        // If we created a user and have SMTP configured, send them an email with credentials
        if (plainPassword && participantUser && transporter && participantUser.email) {
            try {
                await transporter.sendMail({
                    from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
                    to: participantUser.email,
                    subject: `Felicity EMS - Your account for ${event.name}`,
                    text: `Hello ${participantUser.firstName || ''},\n\nAn account was created for you to access event '${event.name}'.\n\nEmail: ${participantUser.email}\nPassword: ${plainPassword}\n\nPlease log in and change your password.\n\nRegards,\nFelicity EMS`
                });
            } catch (mailErr) {
                console.error('Failed to send credential email:', mailErr);
            }
        }
        // Build response object
    const responseBody = { msg: 'Participant added and registered successfully', registrationId: registration._id, participant: respUser };
        // Optionally include the generated plain password for local/dev testing
        if (process.env.DEV_RETURN_PLAIN_PASSWORD === 'true' && plainPassword) {
            responseBody.plainPassword = plainPassword;
        }

        res.status(201).json(responseBody);
    } catch (err) {
        console.error('Error in addParticipant:', err);
        res.status(500).send('Server Error while adding participant');
    }
};