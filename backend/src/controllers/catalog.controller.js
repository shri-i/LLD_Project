const catalogService = require('../services/catalog.service');

async function listCities(req, res) {
  res.json(await catalogService.getCities());
}

async function listMovies(req, res) {
  res.json(await catalogService.getMoviesByCity(req.query.city));
}

async function listMovieShows(req, res) {
  res.json(await catalogService.getShowsForMovie(req.params.id, req.query.date));
}

module.exports = { listCities, listMovies, listMovieShows };
