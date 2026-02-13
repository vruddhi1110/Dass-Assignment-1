require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

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
    const password = process.argv[3] || 'password123';
    const user = await User.findOne({ email });
    if (!user) {
      console.log('User not found for', email);
      process.exit(0);
    }

    let isMatch = false;
    if (user.password && user.password.startsWith('$2')) {
      isMatch = await bcrypt.compare(password, user.password);
      console.log('bcrypt compare:', isMatch);
    } else {
      isMatch = (password === user.password);
      console.log('plaintext compare:', isMatch);
      if (isMatch) {
        // migrate using updateOne to avoid full-document validation issues
        const newHash = await bcrypt.hash(password, 10);
        await User.updateOne({ _id: user._id }, { $set: { password: newHash } });
        console.log('migrated to bcrypt via updateOne');
      }
    }

    if (!isMatch) {
      console.log('Login failed: invalid credentials');
      process.exit(0);
    }

    const token = jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET || 'no-secret', { expiresIn: '1h' });
    console.log('Login succeeded. Token:', token);
    process.exit(0);
  } catch (err) {
    console.error('Error in doLogin:', err);
    process.exit(1);
  }
}

main();
