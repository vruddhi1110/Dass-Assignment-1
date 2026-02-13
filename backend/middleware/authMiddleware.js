const jwt = require('jsonwebtoken');
const User = require('../models/User');

/**
 * Protect Middleware:
 * Ensures the user is logged in by verifying the JWT token in the headers.
 */
exports.protect = async (req, res, next) => {
    let token;

    // Check for token in the Authorization header (Format: Bearer <token>)
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        token = req.headers.authorization.split(' ')[1];
    }

    // Also allow passing token via query string (useful for EventSource/SSE connections)
    if (!token && req.query && req.query.token) {
        token = req.query.token;
    }

    if (!token) {
        return res.status(401).json({ msg: "Access denied. No token provided." });
    }

    try {
        // Verify token using the secret key from your .env file
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        // Attach the user to the request object (excluding the password)
        req.user = await User.findById(decoded.id).select('-password');
        
        if (!req.user) {
            return res.status(404).json({ msg: "User not found." });
        }

        next(); // Move to the next middleware or controller
    } catch (err) {
        res.status(401).json({ msg: "Invalid or expired token." });
    }
};

/**
 * Authorize Middleware:
 * Restricts access based on user roles (e.g., 'Admin', 'Organizer').
 */
exports.authorize = (...roles) => {
    return (req, res, next) => {
        // req.user is available here because 'protect' middleware runs before this
        if (!roles.includes(req.user.role)) {
            return res.status(403).json({ 
                msg: `Role '${req.user.role}' is not authorized to access this resource.` 
            });
        }
        next();
    };
};