// router for info page
var express = require('express');
var router = express.Router();

/* GET info page. */
router.get('/info', function(req, res, next) {
  res.render('info', { req: req }); // renders info page
});

module.exports = router;
