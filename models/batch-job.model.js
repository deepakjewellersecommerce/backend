const mongoose = require("mongoose");

const BATCH_JOB_STATUS = {
  PENDING: "PENDING",
  RUNNING: "RUNNING",
  COMPLETED: "COMPLETED",
  FAILED: "FAILED",
  PARTIAL: "PARTIAL" // some items succeeded, some failed
};

const BATCH_JOB_TYPE = {
  PRICE_RECALCULATION: "PRICE_RECALCULATION"
};

const batchJobSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      required: true,
      enum: Object.values(BATCH_JOB_TYPE),
      index: true
    },
    status: {
      type: String,
      required: true,
      enum: Object.values(BATCH_JOB_STATUS),
      default: BATCH_JOB_STATUS.PENDING,
      index: true
    },
    // Input parameters for the job
    params: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    },
    // Progress tracking
    progress: {
      total: { type: Number, default: 0 },
      processed: { type: Number, default: 0 },
      succeeded: { type: Number, default: 0 },
      failed: { type: Number, default: 0 },
      skipped: { type: Number, default: 0 }
    },
    // Failure details (capped at 100 to prevent doc bloat)
    failures: [
      {
        entityId: mongoose.Schema.Types.ObjectId,
        error: String,
        _id: false
      }
    ],
    // Result summary
    result: {
      type: mongoose.Schema.Types.Mixed,
      default: null
    },
    // Retry tracking
    attempts: { type: Number, default: 0 },
    maxAttempts: { type: Number, default: 3 },
    lastError: { type: String, default: null },
    // Timing
    startedAt: { type: Date, default: null },
    completedAt: { type: Date, default: null },
    // Who triggered this
    triggeredBy: { type: String, default: "System" }
  },
  { timestamps: true }
);

batchJobSchema.index({ status: 1, createdAt: -1 });
batchJobSchema.index({ type: 1, status: 1 });

/**
 * Mark job as started
 */
batchJobSchema.methods.markRunning = async function () {
  this.status = BATCH_JOB_STATUS.RUNNING;
  this.startedAt = new Date();
  this.attempts += 1;
  return this.save();
};

/**
 * Update progress
 */
batchJobSchema.methods.updateProgress = async function (progressData) {
  Object.assign(this.progress, progressData);
  return this.save();
};

/**
 * Mark job as completed
 */
batchJobSchema.methods.markCompleted = async function (result) {
  this.status =
    this.progress.failed > 0
      ? BATCH_JOB_STATUS.PARTIAL
      : BATCH_JOB_STATUS.COMPLETED;
  this.completedAt = new Date();
  this.result = result;
  return this.save();
};

/**
 * Mark job as failed
 */
batchJobSchema.methods.markFailed = async function (error) {
  this.lastError = error;
  if (this.attempts >= this.maxAttempts) {
    this.status = BATCH_JOB_STATUS.FAILED;
    this.completedAt = new Date();
  } else {
    this.status = BATCH_JOB_STATUS.PENDING; // will be retried
  }
  return this.save();
};

/**
 * Add a failure entry (cap at 100)
 */
batchJobSchema.methods.addFailure = function (entityId, error) {
  if (this.failures.length < 100) {
    this.failures.push({ entityId, error: String(error).slice(0, 200) });
  }
};

/**
 * Static: Get retryable jobs
 */
batchJobSchema.statics.getRetryableJobs = function () {
  return this.find({
    status: BATCH_JOB_STATUS.PENDING,
    attempts: { $lt: 3 },
    createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } // within 24h
  }).sort({ createdAt: 1 });
};

/**
 * Static: Clean up old completed jobs (older than 30 days)
 */
batchJobSchema.statics.cleanup = function () {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  return this.deleteMany({
    status: { $in: [BATCH_JOB_STATUS.COMPLETED, BATCH_JOB_STATUS.FAILED] },
    completedAt: { $lt: thirtyDaysAgo }
  });
};

const BatchJob = mongoose.model("BatchJob", batchJobSchema);

module.exports = { BatchJob, BATCH_JOB_STATUS, BATCH_JOB_TYPE };
