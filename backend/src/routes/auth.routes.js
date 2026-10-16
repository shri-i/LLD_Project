const express = require('express');
const asyncHandler = require('../utils/asyncHandler');
const authController = require('../controllers/auth.controller');
const { validate, requireObjectBody } = require('../middleware/validate');

const router = express.Router();
const validEmail = (email) => typeof email === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

router.post('/register', validate((req) => {
  const bodyError = requireObjectBody(req);
  if (bodyError) return bodyError;
  const { name, email, phone, password } = req.body;
  if (typeof name !== 'string' || name.trim().length < 1 || name.trim().length > 120) return 'name is required (1-120 characters)';
  if (!validEmail(email)) return 'email must be valid';
  if (typeof phone !== 'string' || phone.trim().length < 3 || phone.trim().length > 40) return 'phone is required (3-40 characters)';
  if (typeof password !== 'string' || password.length < 8 || Buffer.byteLength(password, 'utf8') > 72) return 'password must be 8-72 bytes';
  return null;
}), asyncHandler(authController.register));

router.post('/login', validate((req) => {
  const bodyError = requireObjectBody(req);
  if (bodyError) return bodyError;
  if (!validEmail(req.body.email)) return 'email must be valid';
  if (typeof req.body.password !== 'string' || req.body.password.length === 0) return 'password is required';
  return null;
}), asyncHandler(authController.login));

module.exports = router;
