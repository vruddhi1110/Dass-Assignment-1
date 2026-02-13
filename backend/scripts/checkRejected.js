require('dotenv').config();
const mongoose = require('mongoose');
const Event = require('../models/Event');
const User = require('../models/User');
const Registration = require('../models/Registration');

async function main() {
    try {
        const uri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/felicityDB';
        await mongoose.connect(uri);
        console.log('Connected to DB');

        const regs = await Registration.find({ status: 'Rejected' }).populate('eventId').populate('participantId');
        console.log('Rejected Registrations found:', regs.length);
        regs.forEach(r => {
            console.log(`ID: ${r._id}, Status: ${r.status}, Email: ${r.participantId ? r.participantId.email : 'null'}`);
        });

        const cancelledRegs = await Registration.find({ status: 'Cancelled' });
        console.log('Cancelled Registrations found:', cancelledRegs.length);

        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

main();
