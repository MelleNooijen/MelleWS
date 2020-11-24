/*
    SPDX-license_Identifier: AGPL-3.0-or-later
    Copyright © 2020 Melle Nooijen & contributors
*/

// router for under construction page
var express = require('express');
var router = express.Router();

/* GET under construction page. */
router.get('/unco', function(req, res, next) {
  res.render('unco', { req: req }); // renders under construction page
});

module.exports = router;
