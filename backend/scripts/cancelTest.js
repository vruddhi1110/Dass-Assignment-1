require('dotenv').config();
const mongoose = require('mongoose');
const Event = require('../models/Event');
const Registration = require('../models/Registration');
const User = require('../models/User');

async function main() {
    try {
        const uri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/felicityDB';
        await mongoose.connect(uri);
        console.log('Connected to DB');

        const targetId = '6984bbcff10edf00024da10f';
        console.log('Target ID:', targetId);

        const reg = await Registration.findById(targetId).populate('eventId');
        if (reg) {
            console.log('FOUND Registration!');
            console.log('Ticket ID:', reg.ticketId);
            console.log('Status:', reg.status);
        } else {
            console.log('NOT FOUND Registration via findById');
            const reg2 = await Registration.findOne({ _id: targetId });
            if (reg2) console.log('Found via findOne({_id})');
            else console.log('Not found via findOne({_id}) either');
        }

        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

main();
