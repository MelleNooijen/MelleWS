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
var loginRouter = require('./routes/login');
var uncoRouter = require('./routes/ucon');
const mime = require('mime-types');
const options = {withFileTypes: true};

var xyears = new Date(new Date().getTime() + (1000*60*60*24*365*10)); // ~10y

const Keyv = require('keyv');
const { info } = require('console');
const { report } = require('./routes/index');
const keyv = new Keyv('sqlite://login.sqlite');
const keyvUsNms = new Keyv('sqlite://login.sqlite',{
  table: "usernames"
});
var app = express();

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');
app.use(require('express-status-monitor')()) // /status page
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
app.get('/login', loginRouter);
app.get('/unco', uncoRouter);

var apiHeader = "     _____     _ _     _ _ _ _____ \n    |     |___| | |___| | | |   __|\n    | | | | -_| | | -_| | | |__   |\n    |_|_|_|___|_|_|___|_____|_____|\n";
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
  form.uploadDir = "./public/direct/";
  form.parse(req, async function (err, fields, files) {
    if (fields.usrID) {
      const getResult = await keyv.get(fields.usrID);
      if (getResult === void(0)) {
        reportErr(res, req, "User ID not found in database (code 02).<br/>Check if your User ID was entered correctly.");
      }
      else {
        var filenameToUpload = files.filetoupload.name.replace(/ /g, "_");
        var invalidCharsT = /[!@#^\&\*\(\)=\{\}\[\]\\|:;“‘<>,\?]/;
        if (filenameToUpload.match(invalidCharsT)) {
          reportErr(res, req, "Encountered an error! (03: Filename contains invalid characters).<br/>The filename contains a prohibited character.");
        }
        else {
          if (filenameToUpload.startsWith("index") && fields.dispmetd != "dm_personal"){
            reportErr(res, req, "Encountered an error! (04: Malicious file detected.)<br/>The file you were trying to upload was detected as malicious.");
            return;
          }
          if (filenameToUpload.includes("/") || filenameToUpload.includes("\\") || filenameToUpload.includes("..")) {
            reportErr(res, req, "Encountered an error! (04: Malicious file detected.)<br/>The file you were trying to upload was detected as malicious.");
            return;
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
              if(fields.dispmetd == "dm_hide"){
                safeName = "H." + safeName;
              }
              var oldpath = files.filetoupload.path;
              console.log(fields.dispmetd);
              if(fields.dispmetd == "dm_personal") {
                var newpath = path.normalize(path.join(__dirname, "public/user/") + getResult.name + "/" + safeName);
                var fuType = "user-upload/" + getResult.name;
                if (!fs.existsSync(path.normalize("./public/user/" + getResult.name))){
                  fs.mkdirSync(path.normalize("./public/user/" + getResult.name));
                }
              }
              else {
                var newpath = path.normalize(path.join(__dirname, "public/direct/") + safeName);
                var fuType = "upload";
              }
              if (fs.existsSync(path.normalize(path.join(__dirname, "public/direct/") + safeName)) && fields.dispmetd != "dm_personal"){
                reportErr(res, req, "The file you are trying to upload already exists. Please rename the file.");
                return;
              }
              fs.rename(oldpath, newpath, function (err) {
                console.log(newpath);
                if (err){
                  reportErr(res, req, "An error occurred creating the metadata file for the uploaded file.");
                  throw err;
                }
                var fileObj = '{ "name":' + '"' + safeName + '"' + ', "usrnm":' + '"' + getResult.name + '"' + ', "type":' + '"' + files.filetoupload.type + '"' + ', "size":' + files.filetoupload.size + '}';
                var jsonFileName = "./public/json/" + safeName + ".json";
                fs.writeFile(jsonFileName, fileObj, function(err){
                  if (err) {
                    reportErr(res, req, "An error occurred creating the metadata file for the uploaded file.");
                    return;
                  }
                });
                var fullUrl = "http://mellemws.my.to/" + fuType + "/" + filenameToUpload;
                reportSuccess(res, req, "File uploaded successfully and can be found at /" + fuType + "/" + filenameToUpload + ".", fullUrl);
                return;
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
app.post('/createuid', async function(req, res){
  var usID = Math.floor(Math.random() * 1000000);
  var usernameStr = req.body.usnm;
  var invalidChars = /[!@#^\&\*\(\)_=\{\}\[\]\\|:;“‘<>,\?]/;
  if (/\s/.test(usernameStr) || usernameStr.match(invalidChars)) {
    reportErr(res, req, "Encountered an error! (02: String contains invalid characters).\nYour username contains a prohibited character.")
  }
  const unExist = await keyvUsNms.get(usernameStr);
  if(unExist){
    reportErr(res, req, "Encountered an error! (03: Username already exists.)")
  }
  else {
    res.cookie('userCookie', usernameStr, { maxAge: xyears });
    var usIDstr = usID.toString();
    res.cookie('idCookie', usIDstr, { maxAge: xyears });
    reportSuccess(res, req, usernameStr + ", your user ID is " + usID + ".\nYou can now log in.")
    var userObject = {name:req.body.usnm, email:req.body.mailad, pro:false};
    keyv.set(usIDstr, userObject);
    console.log(userObject);
    keyvUsNms.set(usernameStr, true);
    return;
  }
});

app.post('/login', async function(req, res){
  if (req.body.textB) {
    var resUsOb = await keyv.get(req.body.textB);
    if (resUsOb) {
      console.log(resUsOb.name);
      res.cookie('idCookie', req.body.textB, { maxAge: xyears });
      res.cookie('userCookie', resUsOb.name, { maxAge: xyears });
      res.redirect('back');
    }
    else {
      reportErr(res, req, "User ID not found.");
    }
  }
  else {
    reportErr(res, req, "No data passed.");
  }
});
app.get('/upload/*', async function(req, res){
  var reqres = req.url.split("/")[2];
  var jsfn = "./public/json/" + reqres + ".json";
  console.log("Trying to access " + jsfn);
  var fileContent = "none.";
  fs.readFile(jsfn, function(err, data){
    if(err){
      reportErr(res, req, "An error occurred loading the file page.\nThis is likely because the file does not exist.");
    }
    else {
      console.log(data);
      fileContent = data;
    }
    console.log(fileContent);
    if (fileContent == "none."){
      res.render("interr", { req: req, errString: "The requested file does not exist." });
    }
    else {
      var parsedFC = JSON.parse(fileContent);
      console.log(parsedFC);
      res.render("dlview", { req: req, flobj: parsedFC, private: false});
      return parsedFC;
    }
  });
});
app.get('/user-upload/*', async function(req, res){
  var reqres = req.url.split("/")[3];
  var jsfn = "./public/json/" + reqres + ".json";
  console.log("Trying to access " + jsfn);
  var fileContent = "none.";
  fs.readFile(jsfn, function(err, data){
    if(err){
      reportErr(res, req, "An error occurred loading the file page.\nThis is likely because the file does not exist.");
    }
    else {
      console.log(data);
      fileContent = data;
    }
    console.log(fileContent);
    if (fileContent == "none."){
      res.render("interr", { req: req, errString: "The requested file does not exist." });
    }
    else {
      var parsedFC = JSON.parse(fileContent);
      console.log(parsedFC);
      res.render("dlview", { req: req, flobj: parsedFC, private: true});
      return parsedFC;
    }
  });
});
app.get('/forget', function(req, res){
  res.clearCookie('userCookie');
  res.redirect('back');
});
app.get('/pubdir/*', function(req, res, next) {
  var dir = req.url.replace('/pubdir/','');
  if (!dir.endsWith("/")){
    dir = dir + "/";
  }
  if(dir == "/"){
    isHomeDir = true;
  }
  else{
    isHomeDir = false;
  }
  console.log(dir);
  console.log(isHomeDir);
  var folder = './public/direct/' + dir;
  console.log(folder);
  fs.readdir(folder, options, (err, files) => {
    var fileArray = [];
    if(!files){
      res.render('directory', { req: req, title: 'Public Directory', dirArray: fileArray, ihd: isHomeDir, isUser: false});
      return;
    }
    files.forEach(file =>{
        if(file.name.startsWith("H.")){
          return;
        }
        var fileName = file.name;
        var fileTypeL = "err:unclearedvariable";
        var fileTypeS = "err:unclearedvariable";
        var fileType = "Unknown";
        if(file.isDirectory()){
            fileType = "directory";
        }
        else {
            fileTypeL = mime.lookup(folder + file.name);
            if(!fileTypeL){
              fileTypeL = "-";
              fileTypeS = "Other";
            }
            else{
              fileTypeS = mime.extension(fileTypeL);
              if(!fileTypeL){
                fileTypeS = "Special";
              }
            }
            fileType = fileTypeS.toUpperCase() + " file (" + fileTypeL + ")";
        }
        var fullDate = new Date(fs.statSync(folder + file.name).birthtime.toISOString());
        var date_y = fullDate.getFullYear();
        var date_m = fullDate.getMonth() + 1;
        var date_d = fullDate.getDate();
        var time_h = ('0'+fullDate.getHours()).slice(-2);
        var time_m = ('0'+fullDate.getMinutes()).slice(-2);
        if(fileTypeL == "-"){
          var icon = "default";
        }
        else if (fileTypeL.split("/")[0] == "image"){
          var icon = "image";
        }
        else if (fileTypeL.split("/")[0] == "audio"){
          var icon = "audio";
        }
        else if (fileTypeL.split("/")[0] == "video"){
          var icon = "video";
        }
        else if (fileTypeL.split("/")[0] == "text"){
          var icon = "text";
        }
        else if (fileType == "directory"){
          var icon = "directory";
        }
        else if (fileTypeL.split("/")[1] == "pdf"){
          var icon = "document";
        }
        else {
          var icon = "default";
        }
        console.log(icon);
        var fullTD = date_d + "-" + date_m + "-" + date_y + " " + time_h + ":" + time_m;
        var fileObject = {name: fileName, type: fileType, date: fullTD, icon: icon};
        fileArray.push(fileObject);
    });
    res.render('directory', { req: req, title: 'Public Directory', dirArray: fileArray, ihd: isHomeDir, curfol: folder, isUser: false});
  });
});
app.get('/mydir/*', function(req, res, next) {
  if(typeof(req.cookies.userCookie) == "undefined"){
    reportErr(res, req, "You are not logged in.\nPlease <a href='/login'>log in</a> to see your files.");
    return;
  }
  var dir = req.url.replace('/mydir/','');
  if (!dir.endsWith("/")){
    dir = dir + "/";
  }
  if(dir == "/"){
    isHomeDir = true;
  }
  else{
    isHomeDir = false;
  }
  console.log(dir);
  console.log(isHomeDir);
  var folder = './public/user/' + req.cookies.userCookie + '/' + dir;
  console.log(folder);
  fs.readdir(folder, options, (err, files) => {
    var fileArray = [];
    if(!files){
      res.render('directory', { req: req, title: req.cookies.userCookie + "'s files", dirArray: fileArray, ihd: isHomeDir, isUser: true});
      return;
    }
    files.forEach(file =>{
        if(file.name.startsWith("H.")){
          return;
        }
        var fileName = file.name;
        var fileTypeL = "err:unclearedvariable";
        var fileTypeS = "err:unclearedvariable";
        var fileType = "Unknown";
        if(file.isDirectory()){
            fileType = "directory";
        }
        else {
            fileTypeL = mime.lookup(folder + file.name);
            if(!fileTypeL){
              fileTypeL = "-";
              fileTypeS = "Other";
            }
            else{
              fileTypeS = mime.extension(fileTypeL);
              if(!fileTypeL){
                fileTypeS = "Special";
              }
            }
            fileType = fileTypeS.toUpperCase() + " file (" + fileTypeL + ")";
        }
        var fullDate = new Date(fs.statSync(folder + file.name).birthtime.toISOString());
        var date_y = fullDate.getFullYear();
        var date_m = fullDate.getMonth() + 1;
        var date_d = fullDate.getDate();
        var time_h = ('0'+fullDate.getHours()).slice(-2);
        var time_m = ('0'+fullDate.getMinutes()).slice(-2);
        if(fileTypeL == "-"){
          var icon = "default";
        }
        else if (fileTypeL.split("/")[0] == "image"){
          var icon = "image";
        }
        else if (fileTypeL.split("/")[0] == "audio"){
          var icon = "audio";
        }
        else if (fileTypeL.split("/")[0] == "video"){
          var icon = "video";
        }
        else if (fileTypeL.split("/")[0] == "text"){
          var icon = "text";
        }
        else if (fileType == "directory"){
          var icon = "directory";
        }
        else if (fileTypeL.split("/")[1] == "pdf"){
          var icon = "document";
        }
        else {
          var icon = "default";
        }
        console.log(icon);
        var fullTD = date_d + "-" + date_m + "-" + date_y + " " + time_h + ":" + time_m;
        var fileObject = {name: fileName, type: fileType, date: fullTD, icon: icon};
        fileArray.push(fileObject);
    });
    res.render('directory', { req: req, title: req.cookies.userCookie + "'s files", dirArray: fileArray, ihd: isHomeDir, curfol: folder, isUser: true});
  });
});
app.get("/delete/*", function(req, res, next){
  var fileToD = req.url.replace('/delete/','')
  if (fileToD.startsWith("?flnm=")){
    fileToD = fileToD.replace("?flnm=","");
  }
  if (fileToD == ""){
    reportErr(res, req, "Please enter the name of the file that you want to delete.");
    return;
  }
  if (typeof(req.cookies.userCookie) == "undefined"){
    reportErr(res, req, "Please log in to delete files in your folder.");
    return;
  }
  console.log(fileToD);
  if (fs.existsSync(path.normalize("./public/user/" + req.cookies.userCookie + "/" + fileToD))){
    if (fileToD.includes("..")){
      reportErr(res, req, "You cannot delete files that are outside your User Directory.");
    }
    else {
      fs.unlinkSync(path.normalize("./public/user/" + req.cookies.userCookie + "/" + fileToD));
      reportSuccess(res, req, "Successfully deleted file " + fileToD + " from your User Directory.");
    }
  }
  else {
    reportErr(res, req, "File does not exist.");
  }
});
/* 
  API handlers
*/
app.get("/api/ping", function(req, res){
  res.writeHead(200, {'Content-Type': 'text/plain'});
  res.write(apiHeader);
  res.write("\n  You successfully pinged the MelleWS API!\n");
  res.end("\n -- end of response -- " + new Date());
});
app.get("/api/reqdetails", function(req, res){
  res.writeHead(200, {'Content-Type': 'text/plain'});
  res.write("     _____     _ _     _ _ _ _____ \n    |     |___| | |___| | | |   __|\n    | | | | -_| | | -_| | | |__   |\n    |_|_|_|___|_|_|___|_____|_____|\n")
  res.write("\n  Details found in your HTTP request can be found below.\n");
  res.write("\n  User Agent: " + req.rawHeaders[3] + "\n")
  console.log(req.rawHeaders[3]);
  res.end("\n -- end of response -- " + new Date());
});
app.post('/api/upl', async function(req, res){
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
// End of API handlers

// catch 404 and forward to error handler
app.use(function(req, res, next) {
  next(createError(404));
});

// error handler
app.use(function(err, req, res, next) {
  if (req.url.startsWith("/test/")){
    return;
  }
  else {
    // set locals, only providing error in development
    res.locals.message = err.message;
    res.locals.error = req.app.get('env') === 'development' ? err : {};

    // render the error page
    res.status(err.status || 500);
    if (typeof(req.rawHeaders) == "undefined") {
      res.end("Your browser is not compatible with MelleWS as the HTTP request is not formatted correctly.")
      return;
    }
    else {
      if (req.rawHeaders[3].match("curl")) {
        res.writeHead(err.status, {'Content-Type': 'text/plain'});
        res.write("     _____     _ _     _ _ _ _____ \n    |     |___| | |___| | | |   __|\n    | | | | -_| | | -_| | | |__   |\n    |_|_|_|___|_|_|___|_____|_____|\n")
        res.write("\n  An error occurred. Details can be found below.\n");
        res.write("\n  HTTP Status: " + err.status + "\n  Error message: " + err.message);
        res.end("\n -- end of response -- " + new Date());
      }
      else {
        res.render('error', { req: req });
      }
    }
  }
});
function reportErr(res, req, errStr) {
  res.render("interr", { req: req, errString: errStr }); // render interr
  return;
}
function reportApiErr(res, req, errStr) {
  res.writeHead(200, {'Content-Type': 'text/plain'});
  res.write("\n  An error occurred in the API applet. Details can be found below.\n");
  res.write("\n  " + errStr);
  res.end("\n -- end of response -- " + new Date());
}
function reportSuccess(res, req, sucStr, sucUrl) {
  res.render("success", { req: req, sucString: sucStr, sucUrl: sucUrl }); // render success
  return;
}
function stringEscape(s) {
  return s ? s.replace(/\\/g,'\\\\').replace(/\n/g,'\\n').replace(/\t/g,'\\t').replace(/\v/g,'\\v').replace(/'/g,"\\'").replace(/"/g,'\\"').replace(/[\x00-\x1F\x80-\x9F]/g,hex) : s;
  function hex(c) { var v = '0'+c.charCodeAt(0).toString(16); return '\\x'+v.substr(v.length-2); }
}
module.exports = app;
