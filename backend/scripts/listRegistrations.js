require('dotenv').config();
const mongoose = require('mongoose');
const Registration = require('../models/Registration');

async function main() {
    try {
        const uri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/felicityDB';
        await mongoose.connect(uri);
        console.log('Connected to DB');

        const regs = await Registration.find({});
        console.log('Registrations found:', regs.length);
        regs.forEach(r => {
            console.log(`ID: ${r._id}, TicketID: ${r.ticketId}, Status: ${r.status}`);
        });

        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

main();
