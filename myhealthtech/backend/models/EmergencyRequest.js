const mongoose = require('mongoose');

const EmergencySchema = new mongoose.Schema({
  patientName:   { type: String, required: true },
  bloodRequired: { type: String, required: true },
  hospital:      { type: String, required: true },
  location:      { type: String, required: true },
  urgency:       { type: String, default: 'High' },
  contact:       { type: String, required: true },
  notes:         { type: String, default: '' },
  requestedBy:   { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  // The specific donor this request was sent to
  targetDonor:   { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  // Status flow: pending → accepted → donated  (or pending → rejected)
  status:        { type: String, enum: ['pending','accepted','donated','rejected'], default: 'pending' },
  // Which donor accepted and later marked donated
  acceptedBy:    { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null }
}, { timestamps: true });

module.exports = mongoose.model('EmergencyRequest', EmergencySchema);