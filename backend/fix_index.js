const mongoose = require('mongoose');

const MONGO_URI = 'mongodb+srv://vruddhis25:Felicity2026@cluster0.pk0r0.mongodb.net/felicityDB?retryWrites=true&w=majority&appName=Cluster0';

async function fix() {
    try {
        console.log('Connecting...');
        await mongoose.connect(MONGO_URI);
        const db = mongoose.connection.db;
        const collection = db.collection('registrations');
        
        console.log('Dropping ticketId_1 index...');
        try {
            await collection.dropIndex('ticketId_1');
            console.log('Index dropped successfully.');
        } catch (e) {
            console.log('Index drop failed (maybe not exists):', e.message);
        }

        console.log('Creating sparse unique index on ticketId...');
        await collection.createIndex({ ticketId: 1 }, { unique: true, sparse: true, background: true });
        console.log('Index created successfully.');

    } catch (e) {
        console.error('Error:', e);
    } finally {
        await mongoose.disconnect();
    }
}

fix();
