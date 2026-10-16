class HttpError extends Error {
  constructor(statusCode, message) {
    super(message);
    this.name = 'HttpError';
    this.statusCode = statusCode;
  }
}

function errorHandler(error, req, res, next) {
  if (res.headersSent) return next(error);

  const statusCode = Number.isInteger(error.statusCode)
    ? error.statusCode
    : error.type === 'entity.parse.failed'
      ? 400
      : 500;
  if (statusCode >= 500) {
    console.error(error);
  }
  return res.status(statusCode).json({
    error: statusCode === 500 ? 'Internal server error' : error.message || 'Invalid JSON body',
  });
}

module.exports = { HttpError, errorHandler };
