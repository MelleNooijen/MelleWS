// router for drive page
var express = require('express');
var router = express.Router();

/* GET drive page. */
router.get('/drive', function(req, res, next) {
  res.render('drive', { req: req }); // renders drive page
});

module.exports = router;
