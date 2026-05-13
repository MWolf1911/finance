const express = require('express');
const HouseholdModel = require('../models/household');

const router = express.Router();

router.get('/', (req, res) => {
  res.json(HouseholdModel.getProfile());
});

module.exports = router;