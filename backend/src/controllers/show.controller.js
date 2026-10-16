const showService = require('../services/show.service');

async function getSeats(req, res) {
  res.json(await showService.getSeatMap(req.params.id));
}

module.exports = { getSeats };
