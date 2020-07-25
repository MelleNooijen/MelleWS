var express = require('express');
var path = require('path');
var cookieParser = require('cookie-parser');
var logger = require('morgan');
var formidable = require('formidable');
var fs = require("fs");
var url = require('url');
var cookieParser = require('cookie-parser');
var indexRouter = require('./routes/index');
var usersRouter = require('./routes/users');
const Keyv = require('keyv');
const keyv = new Keyv('sqlite://login.sqlite');
var app = express();
var erVar = "Test melle";
var outputVar = "The applet did not provide any output.";
app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));
app.use(cookieParser('sosecret'));
app.use('/', indexRouter);
app.use('/users', usersRouter);
app.post('/inp', function(req, res){
    console.log(req.body);
    res.redirect('/');
});
app.post('/upl', async function(req, res){
  var form = new formidable.IncomingForm();
  // path.join(__dirname, "public\\upload\\")
  form.uploadDir = "./public/upload/";
  form.parse(req, async function (err, fields, files) {
    if (fields.usrID) {
      const getResult = await keyv.get(fields.usrID);
      if (getResult === void(0)) {
        erVar = "User ID not found in database (code 02).<br/>Check if your User ID was entered correctly.";
        res.redirect("interr.html");
        res.end();
      }
      else {
        console.log(files.filetoupload.path)
        var oldpath = files.filetoupload.path;
        var newpath = path.join(__dirname, "public\\upload\\") + files.filetoupload.name;
        //
        console.log(newpath);
        fs.rename(oldpath, newpath, function (err) {
          if (err) throw err;
          outputVar = "File uploaded successfully and can be found at /upload/" + files.filetoupload.name + ".";
          res.redirect("success.html");
          res.end();
        });
      }
    }
    else {
      erVar = "No User ID (code 01).";
      res.redirect("interr.html");
      res.end();
    }
  });
});
app.post('/createuid', function(req, res){
  console.log(req.body);
  var usID = Math.floor(Math.random() * 1000000);
  var usernameStr = req.body.usnm;
  var invalidChars = /[!@#^\&\*\(\)_=\{\}\[\]\\|:;“‘<>,\?]/;
  if (/\s/.test(usernameStr) || usernameStr.match(invalidChars)) {
    res.write("Encountered an error! (02: String contains invalid characters).\nYour username contains a prohibited character.")
    res.end();
  }
  else {
    console.log("Created object for User " + usID);
    res.write(usernameStr + ", your user ID is " + usID + ".\nYou can now log in.");
    res.end();
    var userObject = {name:req.body.usnm, email:req.body.mailad, pro:false};
    console.log(userObject);
    var usIDstr = usID.toString();
    keyv.set(usIDstr, userObject);
  }
});
app.get("/dbtest", function(req, res){
  res.writeHead(200, {'Content-Type': 'text/html'});
  res.write('<form method="post">'
  + '<input type="text" name="keyBox"/>'
  + '<input type="submit" value="Submit"/></form>');
  res.end();
});
app.post("/dbtest", async function(req, res){
  const getResult = await keyv.get(req.body.keyBox);
  if (getResult === void(0)) {
    console.log("invalid");
  }
  else {
    console.log("valid");
  }
  res.end(getResult);
});
app.get("/curl", function(req, res){
  res.writeHead(200, {'Content-Type': 'text/plain'});
  res.write("     _____     _ _     _ _ _ _____ \n    |     |___| | |___| | | |   __|\n    | | | | -_| | | -_| | | |__   |\n    |_|_|_|___|_|_|___|_____|_____|\n")
  res.write("\n  Welcome to MelleWS' cURL portal. Here, you can check the status of MelleWS' servers and see other data.\n");
  res.write("\n  Main: [Online]\n  Drive: [Offline]\n  Database: [Offline]\n");
  res.end("\n -- end of response -- " + new Date());
  console.log(res);
});
app.get('/cookietest', function(req, res){
  if (req.cookies.remember) {
    res.send("UserObject in storage: " + req.cookies.remember + '. Click to <a href="/forget">forget</a>!.');
    console.log(req.cookies.remember);
  } else {
    res.send('<form method="post">'
      + '<input type="text" name="textB"/>'
      + '<input type="submit" value="Submit"/></form>');
  }
});
app.post('/cookietest', function(req, res){
  
  if (req.body.textB) res.cookie('remember', req.body.textB);
  res.redirect('back');
});
app.get('/cookieinit', function(req, res){
  // how to use: /cookieinit?userID=(userID)
  const parsed = url.parse(req.href, true);
  console.log(parsed);
  console.log(req);
  if (req.body.userID) {
    console.log(req.body);
    res.end('success!');
  }
  else {
    console.log(req.body);
    res.end('fail');
  }
});
app.get('/forget', function(req, res){
  res.clearCookie('remember');
  res.redirect('back');
});
app.get('/rendertest', function(req, res, next){
  outputVar = "Demo output.";
  res.redirect("success.html");
  res.end();
});
app.get('/request', function(req, res, next){
  console.log(erVar);
  res.write(erVar);
  res.end("<br/>End of error.");
});
app.get('/applout', function(req, res, next){
  console.log(outputVar);
  res.write(outputVar);
  res.end("<br/>End of output..");
});
app.use(function(req, res, next){
    res.redirect("404.htm");
});
module.exports = app;
