const jwt = require('jsonwebtoken');
const { HttpError } = require('./errorHandler');

function authenticate(req, res, next) {
  const authorization = req.get('authorization') || '';
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  if (!match) return next(new HttpError(401, 'Authentication required'));

  const secret = process.env.JWT_SECRET;
  if (!secret) return next(new HttpError(500, 'JWT_SECRET is not configured'));

  try {
    const payload = jwt.verify(match[1], secret);
    if (typeof payload.sub !== 'string') throw new Error('Invalid token subject');
    req.user = { id: payload.sub };
    return next();
  } catch {
    return next(new HttpError(401, 'Invalid or expired token'));
  }
}

module.exports = authenticate;
