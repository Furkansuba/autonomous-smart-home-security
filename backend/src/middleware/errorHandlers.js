function notFoundHandler(req, res, next) {
  return res.status(404).json({
    error: 'Not Found',
    path: req.originalUrl,
  });
}
function errorHandler(error, req, res, next) {
  const statusCode = error.statusCode || error.status || 500;
  const response = {
    error: error.publicMessage || 'Internal Server Error',
  };
  if (process.env.NODE_ENV !== 'production') {
    response.message = error.message;
  }
  return res.status(statusCode).json(response);
}
module.exports = {
  notFoundHandler,
  errorHandler,
};
