// router for drive page
var express = require('express');
var router = express.Router();

/* GET drive page. */
router.get('/drive', function(req, res, next) {
  res.render('drive', { req: req }); // renders drive page
  console.log(req.headers['x-forwarded-for'] || req.connection.remoteAddress); // used for testing ;)
});

module.exports = router;
