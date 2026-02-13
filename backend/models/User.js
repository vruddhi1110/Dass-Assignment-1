const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  firstName: { type: String, required: true },
  lastName: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true }, // To be hashed via bcrypt [cite: 42]
  role: { 
    type: String, 
    enum: ['Admin', 'Organizer', 'Participant'], 
    required: true 
  },
  participantType: { 
    type: String, 
    enum: ['IIIT-Student-Single', 'IIIT-Student-Dual', 'IIIT-Professor', 'Non-IIIT'],
    default: 'Non-IIIT'
  },
  contactNumber: String,
  collegeName: String,
  // Organizer specific fields
  description: String,
  category: String,
  discordWebhook: String, // [Requirement 10.5]
  preferences: {
    areasOfInterest: [String], // [cite: 49]
    followedClubs: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }] // [cite: 51]
  }
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);