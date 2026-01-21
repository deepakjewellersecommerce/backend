const mongoose = require('mongoose');

const jobSchema = new mongoose.Schema({
  type: { type: String, required: true },
  status: { type: String, enum: ['queued', 'running', 'completed', 'failed'], default: 'queued' },
  total: { type: Number, default: 0 },
  processed: { type: Number, default: 0 },
  failures: [
    {
      itemId: mongoose.Schema.Types.ObjectId,
      error: String
    }
  ],
  meta: { type: mongoose.Schema.Types.Mixed },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin' },
  result: { type: mongoose.Schema.Types.Mixed },
}, { timestamps: true });

const Job = mongoose.model('Job', jobSchema);
module.exports = Job;