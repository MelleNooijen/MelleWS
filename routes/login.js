// router for login page
var express = require('express');
var router = express.Router();

/* GET login page. */
router.get('/login', function(req, res, next) {
  res.render('login', { req: req }); // renders login page
});

module.exports = router;
