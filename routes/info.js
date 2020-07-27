// router for info page
var express = require('express');
var router = express.Router();

/* GET info page. */
router.get('/info', function(req, res, next) {
  res.render('info', { req: req }); // renders info page
  console.log(req.headers['x-forwarded-for'] || req.connection.remoteAddress); // used for testing ;)
});

module.exports = router;
