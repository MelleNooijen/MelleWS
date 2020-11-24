/*
    SPDX-license_Identifier: AGPL-3.0-or-later
    Copyright © 2020 Melle Nooijen & contributors
*/

// router for drive page
var express = require('express');
var router = express.Router();

/* GET drive page. */
router.get('/drive', function(req, res, next) {
  res.render('drive', { req: req }); // renders drive page
});

module.exports = router;
