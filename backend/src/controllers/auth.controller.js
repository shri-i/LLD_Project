const authService = require('../services/auth.service');

async function register(req, res) {
  res.status(201).json(await authService.register(req.body));
}

async function login(req, res) {
  res.json(await authService.login(req.body));
}

module.exports = { register, login };
