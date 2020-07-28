// router for user creator page
var express = require('express');
var router = express.Router();

/* GET uidcreator page. */
router.get('/signup', function(req, res, next) {
  res.render('createuser', { req: req }); // renders signup page
});

module.exports = router;
