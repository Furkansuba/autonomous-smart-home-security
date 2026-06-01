function parsePositiveInteger(value, fallback) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }
  return Math.floor(parsed);
}
function getPagination(query = {}, options = {}) {
  const defaultLimit = options.defaultLimit || 50;
  const maxLimit = options.maxLimit || 100;
  const page = parsePositiveInteger(query.page, 1);
  const rawLimit = parsePositiveInteger(query.limit, defaultLimit);
  const limit = Math.min(rawLimit, maxLimit);
  const skip = (page - 1) * limit;
  return {
    page,
    limit,
    skip,
  };
}
function buildPaginatedResponse(resourceName, items, meta) {
  const total = meta.total || 0;
  const page = meta.page || 1;
  const limit = meta.limit || items.length || 1;
  const totalPages = limit > 0 ? Math.ceil(total / limit) : 0;
  return {
    count: items.length,
    total,
    page,
    limit,
    total_pages: totalPages,
    [resourceName]: items,
  };
}
module.exports = {
  parsePositiveInteger,
  getPagination,
  buildPaginatedResponse,
};
