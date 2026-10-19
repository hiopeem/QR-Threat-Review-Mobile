const mongoose = require('mongoose');

const statsSchema = new mongoose.Schema(
  {
    malicious:  { type: Number, default: 0 },
    suspicious: { type: Number, default: 0 },
    harmless:   { type: Number, default: 0 },
    undetected: { type: Number, default: 0 },
  },
  { _id: false }
);

const scanLogSchema = new mongoose.Schema(
  {
    url: {
      type: String,
      required: true,
      unique: true,
      index: true,
      trim: true,
    },
    verdict: {
      type: String,
      enum: ['Safe', 'Malicious'],
      required: true,
    },
    stats: {
      type: statsSchema,
      required: true,
    },
    scannedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('ScanLog', scanLogSchema);
