const mongoose = require('mongoose');

const registrationSchema = new mongoose.Schema({
  participantId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  eventId: { type: mongoose.Schema.Types.ObjectId, ref: 'Event', required: true },
  // ticketId is optional for Pending merchandise orders; generated on final approval
  ticketId: { type: String, unique: true, sparse: true }, // allow nulls via sparse index
  qrCode: { type: String },
  status: { 
    type: String, 
    enum: ['Pending', 'Successful', 'Cancelled', 'Rejected'], 
    default: 'Successful' 
  },
  formResponses: mongoose.Schema.Types.Mixed, // Stores dynamic form answers
  
  // For Tier A: Merchandise Payment Approval
  paymentProofUrl: String, 
  
  // For Tier A: Attendance Tracking [cite: 179]
  attendance: {
    isScanned: { type: Boolean, default: false },
    scannedAt: Date
  },
  
  // Used to store details about merchandise selection
  merchandiseSelection: {
    variantId: String,
    quantity: Number,
    variantName: String
  }
  
}, { timestamps: true });

module.exports = mongoose.model('Registration', registrationSchema);