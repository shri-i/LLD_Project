const express = require('express');
const asyncHandler = require('../utils/asyncHandler');
const catalogController = require('../controllers/catalog.controller');

const router = express.Router();
router.get('/', asyncHandler(catalogController.listCities));

module.exports = router;
