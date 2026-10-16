const { HttpError } = require('./errorHandler');

function validate(validator) {
  return (req, res, next) => {
    const message = validator(req);
    if (message) return next(new HttpError(400, message));
    return next();
  };
}

const isUuid = (value) =>
  typeof value === 'string' &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);

function requireObjectBody(req) {
  return isObject(req.body) ? null : 'JSON request body must be an object';
}

module.exports = { validate, isUuid, isObject, requireObjectBody };
