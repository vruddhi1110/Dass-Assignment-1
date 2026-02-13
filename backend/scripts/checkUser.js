require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');

async function main() {
  try {
    const uri = process.env.MONGO_URI;
    if (!uri) {
      console.error('MONGO_URI not set in environment or .env');
      process.exit(1);
    }
    await mongoose.connect(uri, { dbName: 'felicityDB' });
    console.log('Connected to MongoDB');

    const email = process.argv[2] || 'vruddhi.shah@research.iiit.ac.in';
    const user = await User.findOne({ email }).lean();
    if (!user) {
      console.log('User not found for', email);
      process.exit(0);
    }

    // Print selected fields safely
    console.log('User:');
    console.log('  email:', user.email);
    console.log('  firstName:', user.firstName || user.name);
    console.log('  role:', user.role);
    console.log('  password field (first 60 chars):', (user.password || '').slice(0, 60));
    console.log('  password length:', (user.password || '').length);
    process.exit(0);
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
}

main();
