var createError = require('http-errors');
var express = require('express');
var path = require('path');
var cookieParser = require('cookie-parser');
var logger = require('morgan');
var formidable = require('formidable');
var fs = require("fs");
var url = require('url');
var indexRouter = require('./routes/index');
var usersRouter = require('./routes/users');
var driveRouter = require('./routes/drive');
var uidRouter = require('./routes/uidcreator');
var infoRouter = require('./routes/info');
var convRouter = require('./routes/convert');

const Keyv = require('keyv');
const { info } = require('console');
const { report } = require('./routes/index');
const keyv = new Keyv('sqlite://login.sqlite');
var app = express();

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

// app.use(logger('dev')); // disble for prod
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

app.use('/', indexRouter);
app.get('/drive', driveRouter);
app.get('/info', infoRouter);
app.get('/signup', uidRouter);
app.get('/convert', convRouter);
// test HTTP codes
app.get('/httptest', function(req, res){
  res.send('<form method="post">'
    + '<input type="text" name="resNum"/>'
    + '<input type="submit" value="Submit"/></form>'
    + '<p>Note that 100 and 101 may freeze your browser.</p>');
});
app.post('/httptest', function(req, res){
  var codeTs = req.body.resNum;
  res.writeHead(codeTs, {'Content-Type': 'text/html'});
  res.write("<p>Wrote code " + codeTs + ".</p>");
  res.write("<img src='https://http.cat/" + codeTs + "'/>")
  res.end();
});
// ---
// reqtest
app.get('/reqtest', function(req, res){
  res.send('<form method="get" action="/reqtesthandle">'
    + '<input type="text" name="tBox"/>'
    + '<input type="submit" value="Submit"/></form>' );
  console.log(url.parse(req.href));
  res.end();
});
app.get('/reqtesthandle', function(req, res){
  res.writeHead(200, {'Content-Type': 'text/html'});
  console.log(req);
  console.log(url.parse(req._parsedOriginalUrl.href));
  var parsedUrlString = url.parse(req._parsedOriginalUrl.href.toString());
  res.write("Request received, looks like:<br/>");
  res.write("<pre>" + parsedUrlString + "</pre>");
  res.end();
});
// ---
app.post('/upl', async function(req, res){
  var form = new formidable.IncomingForm();
  // path.join(__dirname, "public\\upload\\")
  form.uploadDir = "./public/upload/";
  form.parse(req, async function (err, fields, files) {
    if (fields.usrID) {
      const getResult = await keyv.get(fields.usrID);
      if (getResult === void(0)) {
        reportErr(res, req, "User ID not found in database (code 02).<br/>Check if your User ID was entered correctly.");
      }
      else {
        var filenameToUpload = files.filetoupload.name.replace(/ /g, "_");
        console.log(filenameToUpload);
        var invalidCharsT = /[!@#^\&\*\(\)=\{\}\[\]\\|:;“‘<>,\?]/;
        if (filenameToUpload.match(invalidCharsT)) {
          reportErr(res, req, "Encountered an error! (03: Filename contains invalid characters).<br/>The filename contains a prohibited character.");
        }
        else {
          if (filenameToUpload.includes("/") || filenameToUpload.includes("\\")) {
            reportErr(res, req, "Encountered an error! (04: Malicious file detected.)<br/>The file you were trying to upload was detected as malicious.");
          }
          else {
            var flSz = files.filetoupload.size / 1000000;
            flSz = Math.round((flSz + Number.EPSILON) * 100) / 100;
            if (flSz > 100) {
              reportErr(res, req, "Encountered an error! (05: File too large)<br/>The file you were trying to upload is too large (" + flSz + " MB compared to the limit of 100 MB)")
            }
            else {
              var safeName = filenameToUpload;
              stringEscape(safeName);
              var oldpath = files.filetoupload.path;
              var newpath = path.join(__dirname, "public\\upload\\") + safeName;
              fs.rename(oldpath, newpath, function (err) {
                if (err) throw err;
                reportSuccess(res, req, "File uploaded successfully and can be found at /upload/" + filenameToUpload + ".");
              });
            }
          }
        }
      }
    }
    else {
      reportErr(res, req, "No User ID (code 01).");
    }
  });
});
app.post('/createuid', function(req, res){
  console.log(req.body);
  var usID = Math.floor(Math.random() * 1000000);
  var usernameStr = req.body.usnm;
  var invalidChars = /[!@#^\&\*\(\)_=\{\}\[\]\\|:;“‘<>,\?]/;
  if (/\s/.test(usernameStr) || usernameStr.match(invalidChars)) {
    reportErr(res, req, "Encountered an error! (02: String contains invalid characters).\nYour username contains a prohibited character.")
  }
  else {
    console.log("Created object for User " + usID);
    res.cookie('userCookie', usernameStr);
    reportSuccess(res, req, usernameStr + ", your user ID is " + usID + ".\nYou can now log in.")
    var userObject = {name:req.body.usnm, email:req.body.mailad, pro:false};
    console.log(userObject);
    var usIDstr = usID.toString();
    keyv.set(usIDstr, userObject);
  }
});
app.get("/curl", function(req, res){
  res.writeHead(200, {'Content-Type': 'text/plain'});
  res.write("     _____     _ _     _ _ _ _____ \n    |     |___| | |___| | | |   __|\n    | | | | -_| | | -_| | | |__   |\n    |_|_|_|___|_|_|___|_____|_____|\n")
  res.write("\n  Welcome to MelleWS' cURL portal. Here, you can check the status of MelleWS' servers and see other data.\n");
  res.write("\n  Main: [Online]\n  Drive: [Online]\n");
  res.end("\n -- end of response -- " + new Date());
  console.log(res);
});
app.get('/cookietest', function(req, res){
  if (req.cookies.userCookie) {
    res.send("UserObject in storage: " + req.cookies.userCookie + '. Click to <a href="/forget">forget</a>!.');
    console.log(req.cookies.userCookie);
  } else {
    res.send('<form method="post">'
      + '<input type="text" name="textB"/>'
      + '<input type="submit" value="Submit"/></form>');
  }
});
app.post('/cookietest', function(req, res){
  if (req.body.textB) res.cookie('userCookie', req.body.textB);
  res.redirect('back');
});
app.get('/forget', function(req, res){
  res.clearCookie('userCookie');
  res.redirect('back');
});
// catch 404 and forward to error handler
app.use(function(req, res, next) {
  next(createError(404));
});

// error handler
app.use(function(err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  // render the error page
  res.status(err.status || 500);
  res.render('error', { req: req });
});
function reportErr(res, req, errStr) {
  res.render("interr", { req: req, errString: errStr }); // render interr
}
function reportSuccess(res, req, sucStr) {
  res.render("success", { req: req, sucString: sucStr }); // render success
}
function stringEscape(s) {
  return s ? s.replace(/\\/g,'\\\\').replace(/\n/g,'\\n').replace(/\t/g,'\\t').replace(/\v/g,'\\v').replace(/'/g,"\\'").replace(/"/g,'\\"').replace(/[\x00-\x1F\x80-\x9F]/g,hex) : s;
  function hex(c) { var v = '0'+c.charCodeAt(0).toString(16); return '\\x'+v.substr(v.length-2); }
}
module.exports = app;
