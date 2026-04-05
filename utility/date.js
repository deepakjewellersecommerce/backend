/**
 * IST Date Handling Utility
 * Ensures that YYYY-MM-DD strings are interpreted correctly as Indian Standard Time
 * (UTC+5:30) rather than UTC (Z).
 */

/**
 * Normalizes a date string to the start of the day in IST.
 * Output: UTC Date object mapping to 00:00:00.000 +05:30
 */
const startOfDayIST = (dateStr) => {
  if (!dateStr) return null;
  // Format: YYYY-MM-DDT00:00:00.000+05:30
  return new Date(`${dateStr}T00:00:00.000+05:30`);
};

/**
 * Normalizes a date string to the end of the day in IST.
 * Output: UTC Date object mapping to 23:59:59.999 +05:30
 */
const endOfDayIST = (dateStr) => {
  if (!dateStr) return null;
  // Format: YYYY-MM-DDT23:59:59.999+05:30
  return new Date(`${dateStr}T23:59:59.999+05:30`);
};

/**
 * Returns a Mongoose-ready match object for a date range in IST.
 */
const getISTDateRangePatch = (startDate, endDate) => {
  const filter = {};
  const start = startOfDayIST(startDate);
  const end = endOfDayIST(endDate);

  if (start || end) {
    filter.createdAt = {};
    if (start) filter.createdAt.$gte = start;
    if (end) filter.createdAt.$lte = end;
  }
  return filter;
};

module.exports = {
  startOfDayIST,
  endOfDayIST,
  getISTDateRangePatch
};
