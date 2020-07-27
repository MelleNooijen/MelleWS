// router for index page
var express = require('express');
var router = express.Router();

/* GET home page. */
router.get('/', function(req, res, next) {
  res.render('index', { req: req }); // renders home page
  console.log(req.headers['x-forwarded-for'] || req.connection.remoteAddress); // used for testing ;)
});

module.exports = router;
