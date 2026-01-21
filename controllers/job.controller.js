const Job = require('../models/job.model');
const catchAsync = require('../utility/catch-async');
const { successRes, errorRes, internalServerError } = require('../utility');

module.exports.getJob = catchAsync(async (req, res) => {
  const { jobId } = req.params;
  const job = await Job.findById(jobId);
  if (!job) return errorRes(res, 404, 'Job not found');
  successRes(res, { job });
});
