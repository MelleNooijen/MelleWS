// router for convmp page
var express = require('express');
var router = express.Router();

/* GET convmp page. */
router.get('/convert', function(req, res, next) {
  res.render('convmp', { req: req }); // renders convmp page
});

module.exports = router;
