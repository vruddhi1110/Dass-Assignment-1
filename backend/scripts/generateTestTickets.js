require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');
const Event = require('../models/Event');
const Registration = require('../models/Registration');
const crypto = require('crypto');

async function main() {
    try {
        const uri = process.env.MONGO_URI;
        if (!uri) throw new Error('MONGO_URI is missing');
        
        // Ensure connection to the specific DB if needed, checkUser.js used 'felicityDB'
        await mongoose.connect(uri, { dbName: 'felicityDB' });
        console.log('Connected to DB');

        // 1. Find the Participant (Tanvi or fallback)
        // Trying to find a user named Tanvi or just the first user
        let participant = await User.findOne({ 
            $or: [
                { firstName: /tanvi/i }, 
                { email: /tanvi/i },
                { role: 'Participant' }
            ] 
        });

        if (!participant) {
            // Create a dummy tanvi if absolutely no users exist? Unlikely.
            participant = await User.findOne({}); // Any user
        }

        if (!participant) {
            console.log("No users found in system. Please register a user first.");
            process.exit(1);
        }
        console.log(`Generating tickets for Participant: ${participant.firstName} (${participant.email})`);

        // 2. Find an Organizer
        let organizer = await User.findOne({ role: { $in: ['Organizer', 'Admin'] } });
        if (!organizer) {
            console.log("No organizer found, making the participant the organizer for these tests.");
            organizer = participant;
        }

        // 3. Create MERCHANDISE Event & Ticket
        const merchEvent = await Event.create({
            name: 'Felicity Official Hoodie 2026',
            description: 'Premium quality cotton hoodie. Limited Edition.',
            eventType: 'Merchandise', // Key for filtering
            organizerId: organizer._id,
            status: 'Published',
            registrationLimit: 500,
            eventDates: { start: new Date(), end: new Date(Date.now() + 86400000) } // Active
        });
        
        await Registration.create({
            participantId: participant._id,
            eventId: merchEvent._id,
            ticketId: 'MERCH-' + crypto.randomBytes(4).toString('hex').toUpperCase(),
            status: 'Successful',
            qrCode: 'https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=TestMerch'
        });
        console.log(`Created Merchandise Ticket for '${merchEvent.name}'`);

        // 4. Create PAST/COMPLETED Event & Ticket
        const pastEvent = await Event.create({
            name: 'Flashback Concert 2025',
            description: 'A night to remember.',
            eventType: 'Normal',
            organizerId: organizer._id,
            status: 'Closed',
            eventDates: { 
                start: new Date('2025-01-01'), 
                end: new Date('2025-01-02') // in the past
            }
        });

        await Registration.create({
            participantId: participant._id,
            eventId: pastEvent._id,
            ticketId: 'PAST-' + crypto.randomBytes(4).toString('hex').toUpperCase(),
            status: 'Successful',
            qrCode: 'https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=TestPast'
        });
        console.log(`Created Completed Ticket for '${pastEvent.name}'`);

        // 5. Create REJECTED Ticket
        const rejectedEvent = await Event.create({
            name: 'Exclusive VIP Gala',
            description: 'Invite only event.',
            eventType: 'Normal',
            organizerId: organizer._id,
            status: 'Published',
            eventDates: { start: new Date(), end: new Date(Date.now() + 86400000) }
        });

        await Registration.create({
            participantId: participant._id,
            eventId: rejectedEvent._id,
            ticketId: 'REJ-' + crypto.randomBytes(4).toString('hex').toUpperCase(),
            status: 'Rejected', // Key for filtering
            qrCode: null
        });
        console.log(`Created Rejected Ticket for '${rejectedEvent.name}'`);

        console.log("\nDone! Refresh your My Tickets page.");
        process.exit(0);

    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

main();