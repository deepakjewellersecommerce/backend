const { AuditLog, AUDIT_ENTITIES, AUDIT_ACTIONS } = require("../models/audit-log.model");
const { successRes, errorRes } = require("../utility");
const catchAsync = require("../utility/catch-async");

/**
 * Get audit logs with filtering
 * GET /api/admin/audit-logs
 */
module.exports.getAuditLogs = catchAsync(async (req, res) => {
  const {
    entityType,
    entityId,
    action,
    actorName,
    limit = 50,
    offset = 0,
    startDate,
    endDate
  } = req.query;

  const filter = {};
  if (entityType) filter.entityType = entityType;
  if (entityId) filter.entityId = entityId;
  if (action) filter.action = action;
  if (actorName) filter.actorName = { $regex: actorName, $options: "i" };
  if (startDate || endDate) {
    filter.createdAt = {};
    if (startDate) filter.createdAt.$gte = new Date(startDate);
    if (endDate) filter.createdAt.$lte = new Date(endDate);
  }

  const [logs, total] = await Promise.all([
    AuditLog.find(filter)
      .sort({ createdAt: -1 })
      .skip(parseInt(offset))
      .limit(Math.min(parseInt(limit), 100))
      .lean(),
    AuditLog.countDocuments(filter)
  ]);

  successRes(res, {
    logs,
    total,
    limit: parseInt(limit),
    offset: parseInt(offset),
    entityTypes: Object.values(AUDIT_ENTITIES),
    actions: Object.values(AUDIT_ACTIONS)
  });
});

/**
 * Get audit logs for a specific entity
 * GET /api/admin/audit-logs/entity/:entityType/:entityId
 */
module.exports.getEntityAuditLogs = catchAsync(async (req, res) => {
  const { entityType, entityId } = req.params;
  const { limit = 20 } = req.query;

  if (!Object.values(AUDIT_ENTITIES).includes(entityType)) {
    return errorRes(res, 400, `Invalid entity type: ${entityType}`);
  }

  const logs = await AuditLog.find({ entityType, entityId })
    .sort({ createdAt: -1 })
    .limit(Math.min(parseInt(limit), 100))
    .lean();

  successRes(res, { logs });
});
