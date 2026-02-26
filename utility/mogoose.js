const buildPaginatedSortedFilteredQuery = async (query, req, model) => {
  const page = req.query.page * 1 || 1;
  const limit = Math.min(req.query.limit * 1 || 10, 100); // Cap at 100
  const sort = req.query.sort || "-createdAt";
  const skip = (page - 1) * limit;

  // Clone the query BEFORE applying skip/limit so we can count total documents
  const countQuery = query.clone();

  query = query.skip(skip).limit(limit).sort(sort);

  const [result, total] = await Promise.all([
    query,
    countQuery.countDocuments(),
  ]);

  result.page = page;
  result.limit = limit;
  result.total = total;

  return result;
};

exports.buildPaginatedSortedFilteredQuery = buildPaginatedSortedFilteredQuery;
