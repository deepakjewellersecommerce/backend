const express = require('express');
const router = express.Router();
const jobController = require('../controllers/job.controller');
const { requireAdminLogin } = require('../middlewares/requireLogin');

router.get('/admin/jobs/:jobId', requireAdminLogin, jobController.getJob);

module.exports = router;