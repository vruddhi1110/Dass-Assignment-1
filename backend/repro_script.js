const axios = require('axios');
const mongoose = require('mongoose');

const MONGO_URI = 'mongodb+srv://vruddhis25:Felicity2026@cluster0.pk0r0.mongodb.net/felicityDB?retryWrites=true&w=majority&appName=Cluster0';
const BASE_URL = 'http://127.0.0.1:5050/api';

// Mongoose Schemas (minimal)
const userSchema = new mongoose.Schema({
    firstName: String, lastName: String, email: { type: String, unique: true },
    password: String, role: { type: String, enum: ['Participant', 'Organizer', 'Admin'] },
    participantType: String, contactNumber: String, collegeName: String
});
// Use existing model if compiled
const User = mongoose.models.User || mongoose.model('User', userSchema);

const eventSchema = new mongoose.Schema({
    name: String, description: String, eventType: String,
    organizerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    status: String,
    merchandiseItems: [{
        variantName: String, price: Number, stockQuantity: Number, reservedQuantity: { type: Number, default: 0 }
    }],
    eventDates: { start: Date, end: Date },
    registrationDeadline: Date,
    registrationLimit: Number
});
const Event = mongoose.models.Event || mongoose.model('Event', eventSchema);

async function run() {
    try {
        console.log('Connecting to MongoDB...');
        await mongoose.connect(MONGO_URI);
        console.log('Connected.');

        const timestamp = Date.now();
        const orgEmail = `org_${timestamp}@test.com`;
        const partEmail = `part_${timestamp}@test.com`;
        const password = 'password123';

        console.log(`Creating Organizer: ${orgEmail}`);
        await User.create({
            firstName: 'Org', lastName: 'Test', email: orgEmail,
            password: password, role: 'Organizer',
            contactNumber: '1234567890'
        });

        console.log(`Creating Participant: ${partEmail}`);
        await User.create({
            firstName: 'Part', lastName: 'Test', email: partEmail,
            password: password, role: 'Participant',
            participantType: 'Non-IIIT', contactNumber: '0987654321'
        });

        // Login
        console.log('Logging in Organizer...');
        const orgLogin = await axios.post(`${BASE_URL}/auth/login`, { email: orgEmail, password });
        const orgToken = orgLogin.data.token;

        console.log('Logging in Participant...');
        const partLogin = await axios.post(`${BASE_URL}/auth/login`, { email: partEmail, password });
        const partToken = partLogin.data.token;

        // Create Event
        console.log('Creating Merchandise Event...');
        const eventData = {
            name: `Merch Event ${timestamp}`,
            description: 'Testing 500 Error',
            eventType: 'Merchandise',
            eventDates: { start: new Date(Date.now() + 86400000), end: new Date(Date.now() + 172800000) },
            registrationDeadline: new Date(Date.now() + 86400000),
            status: 'Published',
            merchandiseItems: [
                { variantName: 'Small', price: 100, stockQuantity: 50, reservedQuantity: 0 }
            ]
        };

        const createRes = await axios.post(`${BASE_URL}/events`, eventData, {
            headers: { Authorization: `Bearer ${orgToken}` }
        });
        const eventId = createRes.data._id;
        const variantId = createRes.data.merchandiseItems[0]._id;
        console.log(`Event Created: ${eventId}, Variant: ${variantId}`);

        // Register
        console.log('Attempting Registration...');
        const regPayload = {
            eventId: eventId,
            formResponses: {},
            merchandiseSelection: {
                variantId: variantId,
                quantity: 1
            }
        };

        try {
            const regRes = await axios.post(`${BASE_URL}/registrations`, regPayload, {
                headers: { Authorization: `Bearer ${partToken}` }
            });
            console.log('SUCCESS:', regRes.data);
        } catch (e) {
            console.log('FAILURE (Expected 500):');
            if (e.response) {
                console.log('Status:', e.response.status);
                // The new error format from my patch
                console.log('Data:', JSON.stringify(e.response.data, null, 2)); 
            } else {
                console.log('Error:', e.message);
            }
        }

    } catch (e) {
        console.error('Script Error:', e.message);
        if (e.response) console.error('Response:', e.response.data);
    } finally {
        await mongoose.disconnect();
    }
}

run();
