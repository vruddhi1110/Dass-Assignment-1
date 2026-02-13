const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../models/User');

async function main() {
  const args = process.argv.slice(2);
  if (args.length < 2) {
    console.error('Usage: node setPassword.js <email> <newPassword>');
    process.exit(1);
  }

  const [email, newPassword] = args;
  const mongoUri = process.env.MONGO_URI;
  if (!mongoUri) {
    console.error('Please set MONGO_URI in the environment.');
    process.exit(1);
  }

  try {
    await mongoose.connect(mongoUri, { useNewUrlParser: true, useUnifiedTopology: true });
    console.log('Connected to MongoDB');

    const user = await User.findOne({ email });
    if (!user) {
      console.error('User not found for email:', email);
      process.exit(1);
    }

    const salt = await bcrypt.genSalt(10);
    const hashed = await bcrypt.hash(newPassword, salt);

    await User.updateOne({ _id: user._id }, { $set: { password: hashed } });
    console.log(`Password updated for ${email}`);
    process.exit(0);
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
}

main();
