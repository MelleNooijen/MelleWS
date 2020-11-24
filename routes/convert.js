/*
    SPDX-license_Identifier: AGPL-3.0-or-later
    Copyright © 2020 Melle Nooijen & contributors
*/

// router for convmp page
var express = require('express');
var router = express.Router();
/* GET convmp page. */
router.get('/convert', function(req, res, next) {
  res.render('unco', { req: req }); // renders convmp page
});

module.exports = router;
