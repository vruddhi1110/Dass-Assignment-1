const mongoose = require('mongoose');

const eventSchema = new mongoose.Schema({
  name: { type: String, required: true },
  description: { type: String, required: true },
  eventType: { type: String, enum: ['Normal', 'Merchandise'], required: true },
  organizerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  status: { 
    type: String, 
    enum: ['Draft', 'Published', 'Ongoing', 'Closed'], 
    default: 'Draft' 
  },
  registrationDeadline: Date,
  eventDates: { start: Date, end: Date },
  registrationLimit: Number,
  eligibility: String,
  registrationFee: { type: Number, default: 0 },
  tags: [String],
  
  // Dynamic Form Builder for Normal Events [cite: 88, 134]
  customForm: [{
    label: String,
    fieldType: { type: String, enum: ['text', 'dropdown', 'checkbox', 'file'] },
    required: Boolean,
    options: [String] // For dropdowns
  }],
  formLocked: { type: Boolean, default: false }, // Locked after first reg [cite: 136]

  // Merchandise Specific Attributes [cite: 91]
  merchandiseItems: [{
    variantName: String, // e.g., "M - Blue"
    price: Number,
    stockQuantity: Number,
    // number of items currently reserved (orders placed but not yet approved)
    reservedQuantity: { type: Number, default: 0 }
  }],
  purchaseLimit: { type: Number, default: 1 }
}, { timestamps: true });

module.exports = mongoose.model('Event', eventSchema);