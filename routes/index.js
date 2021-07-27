// router for index page
var express = require('express');
var router = express.Router();
const fs = require('fs');
var verFile = fs.readFileSync("version.txt",{encoding: "utf-8"});

/* GET home page. */
router.get('/', function(req, res, next) {
  res.render('index', { req: req, version: verFile.split("\n")[0] }); // renders home page
});

module.exports = router;
