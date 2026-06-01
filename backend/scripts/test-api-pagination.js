const {
  parsePositiveInteger,
  getPagination,
  buildPaginatedResponse,
} = require('../src/utils/pagination');
function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}
function main() {
  assert(parsePositiveInteger('5', 1) === 5, 'valid integer should parse');
  assert(parsePositiveInteger('abc', 1) === 1, 'invalid integer should fallback');
  assert(parsePositiveInteger('-10', 1) === 1, 'negative integer should fallback');
  const defaultPagination = getPagination({});
  assert(defaultPagination.page === 1, 'default page should be 1');
  assert(defaultPagination.limit === 50, 'default limit should be 50');
  assert(defaultPagination.skip === 0, 'default skip should be 0');
  const customPagination = getPagination({ page: '3', limit: '20' });
  assert(customPagination.page === 3, 'custom page should be 3');
  assert(customPagination.limit === 20, 'custom limit should be 20');
  assert(customPagination.skip === 40, 'custom skip should be 40');
  const cappedPagination = getPagination({ page: '1', limit: '999' });
  assert(cappedPagination.limit === 100, 'limit should be capped at 100');
  const response = buildPaginatedResponse('items', [{ id: 1 }, { id: 2 }], {
    total: 12,
    page: 2,
    limit: 5,
  });
  assert(response.count === 2, 'response count should be item length');
  assert(response.total === 12, 'response total should match meta');
  assert(response.page === 2, 'response page should match meta');
  assert(response.limit === 5, 'response limit should match meta');
  assert(response.total_pages === 3, 'total pages should be ceil(total / limit)');
  assert(Array.isArray(response.items), 'response resource should be array');
  console.log('[OK] pagination parse helper');
  console.log('[OK] pagination metadata helper');
  console.log('API pagination helper tests passed.');
}
try {
  main();
} catch (error) {
  console.error('[FAIL] API pagination helper test failed');
  console.error(error);
  process.exit(1);
}
