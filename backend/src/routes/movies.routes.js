const express = require('express');
const asyncHandler = require('../utils/asyncHandler');
const catalogController = require('../controllers/catalog.controller');
const { validate, isUuid } = require('../middleware/validate');

const router = express.Router();

router.get('/', validate((req) => {
  if (typeof req.query.city !== 'string' || req.query.city.trim() === '') {
    return 'city query parameter is required';
  }
  return null;
}), asyncHandler(catalogController.listMovies));

router.get('/:id/shows', validate((req) => {
  if (!isUuid(req.params.id)) return 'movie id must be a UUID';
  if (req.query.date && !/^\d{4}-\d{2}-\d{2}$/.test(req.query.date)) {
    return 'date must use YYYY-MM-DD format';
  }
  if (req.query.date && new Date(`${req.query.date}T00:00:00.000Z`).toISOString().slice(0, 10) !== req.query.date) {
    return 'date must be a valid calendar date';
  }
  return null;
}), asyncHandler(catalogController.listMovieShows));

module.exports = router;
