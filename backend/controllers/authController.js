const User = require('../models/User');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const PasswordResetRequest = require('../models/PasswordResetRequest');
const PasswordResetAudit = require('../models/PasswordResetAudit');
const crypto = require('crypto');

// 1. Participant Registration (IIIT vs Non-IIIT)
exports.register = async (req, res) => {
    try {
        const { firstName, lastName, email: rawEmail, password, contactNumber, collegeName } = req.body;
        const email = rawEmail ? String(rawEmail).toLowerCase().trim() : rawEmail;

        // Check if user exists
    let user = await User.findOne({ email });
        if (user) return res.status(400).json({ msg: "User already exists" });

        // Domain validation for IIIT emails and classification
        // Allowed IIIT domains:
        //  - students.iiit.ac.in   (single-degree students)
        //  - research.iiit.ac.in   (dual-degree / research students)
        //  - iiit.ac.in            (professors / staff)
        const lowerEmail = String(email).toLowerCase();
        const isStudents = /@students\.iiit\.ac\.in$/.test(lowerEmail);
        const isResearch = /@research\.iiit\.ac\.in$/.test(lowerEmail);
        const isIiitStaff = /@iiit\.ac\.in$/.test(lowerEmail);

        let participantType = 'Non-IIIT';
        if (isStudents) participantType = 'IIIT-Student-Single';
        else if (isResearch) participantType = 'IIIT-Student-Dual';
        else if (isIiitStaff) participantType = 'IIIT-Professor';

        // If email claims to be IIIT (any of the above subdomains) but does not match
        // the allowed patterns, reject registration to enforce institution-issued emails.
        // (This protects cases like other-subdomain.iiit.ac.in if you want to restrict.)
        const iiitDomainPattern = /@(students|research)\.iiit\.ac\.in$|@iiit\.ac\.in$/;
        if (lowerEmail.includes('.iiit.ac.in') && !iiitDomainPattern.test(lowerEmail)) {
            return res.status(400).json({ msg: 'Invalid IIIT email format. Use students.iiit.ac.in, research.iiit.ac.in or iiit.ac.in as appropriate.' });
        }

        // Hash password [Requirement 4.1]
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        user = new User({
            firstName, lastName, email,
            password: hashedPassword, 
            role: 'Participant', 
            participantType,
            contactNumber, collegeName
        });

        await user.save();

        // Generate JWT for auto-login
        const token = jwt.sign(
            { id: user._id, role: user.role }, 
            process.env.JWT_SECRET, 
            { expiresIn: '1h' } 
        );

        res.status(201).json({ 
            msg: "User registered successfully", 
            token, 
            user: { 
                id: user._id, 
                role: user.role, 
                name: user.firstName,
                preferences: user.preferences
            } 
        });
    } catch (err) {
        res.status(500).send("Server Error");
    }
};

// 2. User Login
exports.login = async (req, res) => {
    try {
        const { email: rawEmail, password } = req.body;
        const email = rawEmail ? String(rawEmail).toLowerCase().trim() : rawEmail;
        if (process.env.NODE_ENV !== 'production') {
            console.log('[auth] Login attempt for:', email);
        }
        const user = await User.findOne({ email });
        if (!user) {
            if (process.env.NODE_ENV !== 'production') console.log('[auth] User not found for', email);
            return res.status(400).json({ msg: "Invalid Credentials" });
        }

        // Support two cases:
        // 1) password is hashed with bcrypt (recommended)
        // 2) legacy/plaintext password in DB (development data) - allow login once and migrate to hashed
        let isMatch = false;
        try {
            if (user.password && user.password.startsWith('$2')) {
                // probably a bcrypt hash
                isMatch = await bcrypt.compare(password, user.password);
                if (process.env.NODE_ENV !== 'production') console.log('[auth] bcrypt compare result:', isMatch);
            } else {
                // legacy/plaintext password - compare directly
                isMatch = (password === user.password);
                if (process.env.NODE_ENV !== 'production') console.log('[auth] plaintext compare result:', isMatch);
                if (isMatch) {
                    // migrate to bcrypt-hashed password for future logins
                    try {
                        const salt = await bcrypt.genSalt(10);
                        const newHash = await bcrypt.hash(password, salt);
                        // Use updateOne to avoid triggering full document validation if the stored
                        // document uses legacy fields (e.g., `name` instead of `firstName`)
                        await User.updateOne({ _id: user._id }, { $set: { password: newHash } });
                        if (process.env.NODE_ENV !== 'production') console.log('[auth] migrated plaintext password to bcrypt for', email);
                    } catch (mErr) {
                        // Migration failure should not block login - log and continue
                        console.error('[auth] password migration failed for', email, mErr);
                    }
                }
            }
        } catch (e) {
            console.error('[auth] Error during password comparison', e);
            isMatch = false;
        }

        if (!isMatch) return res.status(400).json({ msg: "Invalid Credentials" });

        // Generate JWT [Requirement 4.2]
        const token = jwt.sign(
            { id: user._id, role: user.role }, 
            process.env.JWT_SECRET, 
            { expiresIn: '1h' }
        );

    // Support older documents that used a single `name` field
    const displayName = user.firstName || user.name || '';
    res.json({ token, user: { id: user._id, role: user.role, name: displayName, preferences: user.preferences } });
    } catch (err) {
        res.status(500).send("Server Error");
    }
};

// 3. Admin: Create Organizer [Requirement 3.2 - Organizers cannot self-register]
exports.createOrganizer = async (req, res) => {
    try {
        // Ensure only Admin can create organizers. The route should be protected by auth middleware
        // which attaches req.user; add an extra guard here for safety.
        if (!req.user || req.user.role !== 'Admin') {
            return res.status(403).json({ msg: 'Forbidden: Admins only' });
        }
        const { firstName, lastName, email, password } = req.body;
        
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        const newOrganizer = new User({
            firstName, lastName, email, 
            password: hashedPassword, 
            role: 'Organizer'
        });

        await newOrganizer.save();
        res.status(201).json({ msg: "Organizer account created by Admin" });
    } catch (err) {
        res.status(500).send("Server Error");
    }
};

// Request a password reset link (public)
exports.requestPasswordReset = async (req, res) => {
        try {
                // Organizer-initiated password reset REQUEST
            const { organizerId: bodyOrganizerId, reason } = req.body;
            const organizerId = req.user && req.user.id ? req.user.id : bodyOrganizerId;
            if (!organizerId) return res.status(400).json({ msg: 'organizerId required' });

            const organizer = await User.findById(organizerId);
                if (!organizer) return res.status(404).json({ msg: 'Organizer not found' });
                if (organizer.role !== 'Organizer') return res.status(400).json({ msg: 'User is not an organizer' });

                const reqDoc = new PasswordResetRequest({ organizerId, reason: reason || '' });
                await reqDoc.save();

                // Audit creation
                await PasswordResetAudit.create({ requestId: reqDoc._id, adminId: req.user ? req.user.id : null, action: 'create', comment: reason || '' });

                return res.status(201).json({ msg: 'Password reset request submitted', requestId: reqDoc._id });
        } catch (err) {
                console.error('Error in requestPasswordReset:', err);
                res.status(500).send('Server Error');
        }
};

// Organizer: view their own requests
exports.myPasswordResetRequests = async (req, res) => {
    try {
        const organizerId = req.user.id;
        const requests = await PasswordResetRequest.find({ organizerId }).sort({ createdAt: -1 });
        res.json(requests);
    } catch (err) {
        console.error('Error in myPasswordResetRequests:', err);
        res.status(500).send('Server Error');
    }
};

// Admin: list all password reset requests
exports.listPasswordResetRequests = async (req, res) => {
    try {
        if (!req.user || req.user.role !== 'Admin') return res.status(403).json({ msg: 'Admins only' });
        const requests = await PasswordResetRequest.find().populate('organizerId', 'firstName lastName email').sort({ createdAt: -1 });
        res.json(requests);
    } catch (err) {
        console.error('Error in listPasswordResetRequests:', err);
        res.status(500).send('Server Error');
    }
};

// Admin: approve a request -> generate password, update organizer, mark request approved, create audit
exports.approvePasswordResetRequest = async (req, res) => {
    try {
        if (!req.user || req.user.role !== 'Admin') return res.status(403).json({ msg: 'Admins only' });
        const requestId = req.params.id;
        const { adminComment } = req.body;
        const reqDoc = await PasswordResetRequest.findById(requestId);
        if (!reqDoc) return res.status(404).json({ msg: 'Request not found' });
        if (reqDoc.status !== 'Pending') return res.status(400).json({ msg: 'Request already handled' });

        // Generate a secure random password
        const newPassword = crypto.randomBytes(6).toString('base64').replace(/\+/g, 'A').replace(/\//g, 'B'); // 8-ish chars
        const salt = await bcrypt.genSalt(10);
        const hashed = await bcrypt.hash(newPassword, salt);

        // Update organizer password
        const organizer = await User.findById(reqDoc.organizerId);
        if (!organizer) return res.status(404).json({ msg: 'Organizer not found' });
        organizer.password = hashed;
        await organizer.save();

        // Update request
        reqDoc.status = 'Approved';
        reqDoc.adminComment = adminComment || '';
        reqDoc.handledBy = req.user.id;
        await reqDoc.save();

        // Audit
        await PasswordResetAudit.create({ requestId: reqDoc._id, adminId: req.user.id, action: 'approve', comment: adminComment || '' });

        // send email to organizer with new password if SMTP configured
        if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
            try {
                const transporter = nodemailer.createTransport({
                    host: process.env.EMAIL_HOST || 'smtp.gmail.com',
                    port: process.env.EMAIL_PORT ? parseInt(process.env.EMAIL_PORT) : 587,
                    secure: false,
                    auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS }
                });
                await transporter.sendMail({
                    from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
                    to: organizer.email,
                    subject: 'Felicity EMS - Password reset approved',
                    text: `Hello ${organizer.firstName || ''},\n\nYour password reset request has been approved. Use the following temporary password to login and change it: ${newPassword}\n\nPlease change it after logging in.`
                });
            } catch (mailErr) {
                console.error('Failed to send approval email:', mailErr);
            }
        }

        // Return new password in response for admin to share (only allowed for admin)
        res.json({ msg: 'Password reset approved', newPassword });
    } catch (err) {
        console.error('Error in approvePasswordResetRequest:', err);
        res.status(500).send('Server Error');
    }
};

// Admin: reject a request
exports.rejectPasswordResetRequest = async (req, res) => {
    try {
        if (!req.user || req.user.role !== 'Admin') return res.status(403).json({ msg: 'Admins only' });
        const requestId = req.params.id;
        const { adminComment } = req.body;
        const reqDoc = await PasswordResetRequest.findById(requestId);
        if (!reqDoc) return res.status(404).json({ msg: 'Request not found' });
        if (reqDoc.status !== 'Pending') return res.status(400).json({ msg: 'Request already handled' });

        reqDoc.status = 'Rejected';
        reqDoc.adminComment = adminComment || '';
        reqDoc.handledBy = req.user.id;
        await reqDoc.save();

        await PasswordResetAudit.create({ requestId: reqDoc._id, adminId: req.user.id, action: 'reject', comment: adminComment || '' });

        res.json({ msg: 'Password reset request rejected' });
    } catch (err) {
        console.error('Error in rejectPasswordResetRequest:', err);
        res.status(500).send('Server Error');
    }
};

// Reset password using token
exports.resetPassword = async (req, res) => {
    try {
        const { token, newPassword } = req.body;
        if (!token || !newPassword) return res.status(400).json({ msg: 'Token and new password required' });
        
        // Use jwt.verify wrapped in try/catch (it throws on invalid signature)
        let decoded;
        try {
            decoded = jwt.verify(token, process.env.JWT_SECRET);
        } catch (e) {
            return res.status(400).json({ msg: 'Invalid or expired token' });
        }

        const user = await User.findById(decoded.id);
        if (!user) return res.status(400).json({ msg: 'User not found' });

        const salt = await bcrypt.genSalt(10);
        user.password = await bcrypt.hash(newPassword, salt);
        await user.save();

        res.json({ msg: 'Password reset successful' });
    } catch (err) {
        console.error('Error in resetPassword:', err);
        res.status(500).send('Server Error');
    }
};

// Send password reset link (public "Forgot Password" flow)
exports.forgotPassword = async (req, res) => {
    try {
        const { email } = req.body;
        // Case-insensitive search
        const user = await User.findOne({ email: { $regex: new RegExp(`^${email}$`, 'i') } });

        // Always return success to prevent email enumeration
        if (!user) {
            return res.json({ msg: 'If an account exists, a reset link will be sent.' });
        }

        // Generate token
        const payload = { id: user.id };
        const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '1h' });
        
        // This is where the user will be redirected when they click the email link
        // Assuming frontend is running where the request came from, or configured URL
        const frontendUrl = process.env.FRONTEND_URL || req.headers.origin || 'http://localhost:3000';
        const resetLink = `${frontendUrl}/reset-password?token=${token}`;

        console.log(`Sending reset link to ${user.email}: ${resetLink}`);

        if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
            const transporter = nodemailer.createTransport({
                host: process.env.EMAIL_HOST || 'smtp.ethereal.email',
                port: process.env.EMAIL_PORT ? parseInt(process.env.EMAIL_PORT) : 587,
                secure: false, // true for 465, false for other ports
                auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS }
            });
            await transporter.sendMail({
                from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
                to: user.email,
                subject: 'Felicity EMS - Reset Password',
                text: `You requested a password reset. Click the following link to set a new password:\n\n${resetLink}\n\nThis link expires in 1 hour.`
            });
        }

        res.json({ msg: 'If an account exists, a reset link will be sent.' });

    } catch (err) {
        console.error('Error in forgotPassword:', err);
        res.status(500).send('Server Error');
    }
};


// User Profile & Social Features 


// Get current user profile
exports.getProfile = async (req, res) => {
    try {
        const user = await User.findById(req.user.id)
            .select('-password')
            .populate('preferences.followedClubs', 'firstName lastName email');
        res.json(user);
    } catch (err) {
        res.status(500).send('Server Error');
    }
};

// Update user profile
exports.updateProfile = async (req, res) => {
    try {
        const { firstName, lastName, contactNumber, collegeName, preferences, description, category, discordWebhook } = req.body;
        const updates = {};
        if (firstName) updates.firstName = firstName;
        if (lastName) updates.lastName = lastName;
        if (contactNumber) updates.contactNumber = contactNumber;
        if (collegeName) updates.collegeName = collegeName;
        if (preferences) updates.preferences = preferences;
        // Allow organizer fields update
        if (description) updates.description = description;
        if (category) updates.category = category;
        if (discordWebhook) updates.discordWebhook = discordWebhook;

        // Email and Role are NOT editable here
        
        const user = await User.findByIdAndUpdate(
            req.user.id, 
            { $set: updates }, 
            { new: true }
        ).select('-password');
        
        res.json(user);
    } catch (err) {
        res.status(500).send('Server Error');
    }
};

// List all Organizers
exports.getAllOrganizers = async (req, res) => {
    try {
        const organizers = await User.find({ role: 'Organizer' })
            .select('firstName lastName email category description'); // assuming description/categories exist or firstName is used as Org Name
        res.json(organizers);
    } catch (err) {
        res.status(500).send('Server Error');
    }
};

// Follow/Unfollow Organizer
exports.toggleFollow = async (req, res) => {
    try {
        const organizerId = req.params.organizerId;
        const user = await User.findById(req.user.id);
        
        // Ensure FollowedClubs array exists
        if (!user.preferences) user.preferences = { followedClubs: [] };
        if (!user.preferences.followedClubs) user.preferences.followedClubs = [];

        const index = user.preferences.followedClubs.indexOf(organizerId);
        if (index > -1) {
            // Unfollow
            user.preferences.followedClubs.splice(index, 1);
        } else {
            // Follow
            user.preferences.followedClubs.push(organizerId);
        }
        
        await user.save();
        res.json(user.preferences.followedClubs);
    } catch (err) {
        res.status(500).send('Server Error');
    }
};

// Admin: Delete Organizer
exports.deleteOrganizer = async (req, res) => {
    try {
        const organizerId = req.params.id;
        // Verify user exists and is an organizer
        const user = await User.findById(organizerId);
        if (!user) return res.status(404).json({ msg: 'User not found' });
        if (user.role !== 'Organizer') return res.status(400).json({ msg: 'Can only delete organizers via this route' });

        await User.findByIdAndDelete(organizerId);
        
        
        res.json({ msg: 'Organizer account deleted' });
    } catch (err) {
        res.status(500).send('Server Error');
    }
};