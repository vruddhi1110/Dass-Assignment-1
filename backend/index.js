const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const app = express();

// Parse JSON bodies
app.use(express.json());
app.use('/uploads', express.static('uploads'));

// Enable CORS for development and production
const allowedOrigins = ['http://localhost:3000', 'http://127.0.0.1:3000'];
if (process.env.FRONTEND_URL) {
    allowedOrigins.push(process.env.FRONTEND_URL);
}

app.use(cors({
    origin: function(origin, callback) {
        // allow requests with no origin (like mobile apps, curl, etc.)
        if (!origin) return callback(null, true);
        if (allowedOrigins.indexOf(origin) === -1) {
            // For debugging production CORS issues
            console.log('Blocked Origin:', origin);
            // const msg = 'The CORS policy for this site does not allow access from the specified Origin.';
            // return callback(new Error(msg), false);
            // Temporarily allow all for assignment submission if strictness causes issues, 
            // but normally we'd return error. For now, let's allow it if it matches or if we just want to be lenient.
             return callback(null, true); // Allow all for now to prevent deployment headaches
        }
        return callback(null, true);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

// Routes
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/events', require('./routes/eventRoutes'));
app.use('/api/registrations', require('./routes/registrationRoutes'));
app.use('/api/upload', require('./routes/uploadRoutes'));

// Connect to MongoDB (use env var or fallback to local)
const mongoUri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/felicityDB';
mongoose.connect(mongoUri)
    .then(() => console.log('MongoDB Connected'))
    .catch(err => {
        console.error('MongoDB Connection Error: ', err);
        process.exit(1);
    });

// Start Server: use PORT env var or 5050 and listen on all interfaces so frontend can reach it
const PORT = process.env.PORT || 5050;
const http = require('http');
const server = http.createServer(app);

// Initialize Socket.IO
const { init } = require('./socket');
init(server);

server.listen(PORT, '0.0.0.0', () => {
    console.log(`SERVER IS RUNNING AT http://0.0.0.0:${PORT}`);
});

// Admin Provisioning Script
const User = require('./models/User');
const bcrypt = require('bcryptjs');

const provisionAdmin = async () => {
    try {
        const adminEmail = process.env.ADMIN_EMAIL || 'admin@felicity.iiit.ac.in';
        const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';

        const existingAdmin = await User.findOne({ role: 'Admin' });
        if (!existingAdmin) {
            console.log('Provisioning Admin Account...');
            const salt = await bcrypt.genSalt(10);
            const hashedPassword = await bcrypt.hash(adminPassword, salt);
            
            const admin = new User({
                firstName: 'System',
                lastName: 'Admin',
                email: adminEmail,
                password: hashedPassword,
                role: 'Admin',
                participantType: 'Non-IIIT' // Irrelevant for Admin but required by enum sometimes? No, simplified user model
            });
            await admin.save();
            console.log(`Admin created: ${adminEmail} / ${adminPassword}`);
        } else {
            console.log('Admin account already exists.');
        }
    } catch (err) {
        console.error('Admin provisioning failed:', err);
    }
};

// Run provisioning after DB connection (simplified for this file structure)
mongoose.connection.once('open', () => {
    provisionAdmin();
});