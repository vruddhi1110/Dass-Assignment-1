const mongoose = require('mongoose');

const PasswordResetAuditSchema = new mongoose.Schema({
  requestId: { type: mongoose.Schema.Types.ObjectId, ref: 'PasswordResetRequest', required: true },
  adminId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  action: { type: String, enum: ['approve', 'reject', 'create'], required: true },
  comment: { type: String },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('PasswordResetAudit', PasswordResetAuditSchema);
