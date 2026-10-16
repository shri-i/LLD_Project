const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const supabase = require('../config/supabase');
const { HttpError } = require('../middleware/errorHandler');

function ensureJwtSecret() {
  if (!process.env.JWT_SECRET) throw new HttpError(500, 'JWT_SECRET is not configured');
  return process.env.JWT_SECRET;
}

function ensureQuerySucceeded(error, operation) {
  if (!error) return;
  if (error.code === '23505') throw new HttpError(409, 'An account with this email already exists');
  console.error(`${operation} failed:`, error);
  throw new HttpError(500, 'Database query failed');
}

function issueToken(user) {
  return jwt.sign({ email: user.email }, ensureJwtSecret(), {
    subject: user.id,
    expiresIn: process.env.JWT_EXPIRES_IN || '1d',
  });
}

async function register({ name, email, phone, password }) {
  ensureJwtSecret();
  const passwordHash = await bcrypt.hash(password, 12);
  const { data, error } = await supabase
    .from('users')
    .insert({ name: name.trim(), email: email.trim().toLowerCase(), phone: phone.trim(), password_hash: passwordHash })
    .select('id,name,email,phone')
    .single();
  ensureQuerySucceeded(error, 'register');
  const { password_hash: omitted, ...user } = data;
  void omitted;
  return { user, token: issueToken(user) };
}

async function login({ email, password }) {
  ensureJwtSecret();
  const { data, error } = await supabase
    .from('users')
    .select('id,name,email,phone,password_hash')
    .eq('email', email.trim().toLowerCase())
    .maybeSingle();
  ensureQuerySucceeded(error, 'login');
  if (!data || !data.password_hash || !(await bcrypt.compare(password, data.password_hash))) {
    throw new HttpError(401, 'Invalid email or password');
  }
  const { password_hash: omitted, ...user } = data;
  void omitted;
  return { user, token: issueToken(user) };
}

module.exports = { register, login };
