const mongoose = require('mongoose');

const MONGO_URI = 'mongodb+srv://vruddhis25:Felicity2026@cluster0.pk0r0.mongodb.net/felicityDB?retryWrites=true&w=majority&appName=Cluster0';

async function run() {
    await mongoose.connect(MONGO_URI);
    const db = mongoose.connection.db;
    const indexes = await db.collection('registrations').indexes();
    console.log(JSON.stringify(indexes, null, 2));
    await mongoose.disconnect();
}
run();
