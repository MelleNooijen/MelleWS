var createError = require('http-errors');
var express = require('express');
var path = require('path');
var cookieParser = require('cookie-parser');
var logger = require('morgan');
var mysql = require('mysql');
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
var session_age = 1000*60*60*24*365*10 // msecs*secs*mins*hrs*days*years
const { check,validationResult } = require('express-validator');
var verFile = fs.readFileSync("version.txt",{encoding: "utf-8"});
var secrets = JSON.parse(fs.readFileSync('./secrets.json'));
var xyears = new Date(new Date().getTime() + (1000*60*60*24*365*10)); // ~10y

const Keyv = require('keyv'); // legacy
const { info } = require('console');
const { report } = require('./routes/index');
const keyv = new Keyv('sqlite://login.sqlite'); // legacy
const keyvUsNms = new Keyv('sqlite://login.sqlite',{ // legacy
  table: "usernames"
});
var flash = require('connect-flash');
var crypto = require('crypto');
var passport = require('passport');
var LocalStrategy = require('passport-local').Strategy;
var sess = require('express-session');
var app = express();
var Store = require('express-session').Store;
// var BetterMemoryStore = require('session-memory-store')(sess);
// var store = new BetterMemoryStore({ expires: session_age, debug: true });
var MySQLStore = require('connect-mysql')(sess);
var storeoptions = {
  config: {
    host: secrets.sql_host,
    user: secrets.sql_user,
    password: secrets.sql_pwd,
    database: "mellews"
  }
};
// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');
// app.use(require('express-status-monitor')()) // /status page
// app.use(logger('dev')); // disble for prod
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
// init login system
var connection = mysql.createConnection({
  host: secrets.sql_host,
  user: secrets.sql_user,
  password: secrets.sql_pwd,
  database: "mellews"
});
app.use(sess({
  name: 'JSESSION',
  secret: secrets.session_secret,
  store: new MySQLStore(storeoptions),
  resave: true,
  maxAge: new Date(Date.now() + session_age),
  cookie: { path: '/', secure: false, httpOnly: true, maxAge: session_age}, 
  saveUninitialized: true
}));
app.use(flash());
app.use(passport.initialize());
app.use(passport.session());
connection.connect(function(err) {
  if (err) throw err;
  console.log("Connected to database!");
});
passport.use('local', new LocalStrategy({
  usernameField: 'username',
  passwordField: 'password',
  passReqToCallback: true }, function (req, username, password, done){
    if(!username || !password ) { return done(null, false, req.flash('message','All fields are required.')); }
    var salt = secrets.pass_salt;
    connection.query("select * from users where username = ?", [username], function(err, rows){
    console.log(err);
    if (err) return done(null, false, req.flash('message', "An internal error occurred."));
    if(!rows.length){ return done(null, false, req.flash('message','Invalid username or password.')); }
    salt = salt+''+password;
    var encPassword = crypto.createHash('sha1').update(salt).digest('hex');
    var dbPassword  = rows[0].password;
    if(!(dbPassword == encPassword)){
      return done(null, false, req.flash('message','Invalid username or password.'));
    }
    req.session.user = rows[0];
    return done(null, rows[0]);
    });
  }
));
passport.serializeUser(function(user, done){
  done(null, user.userid);
});
passport.deserializeUser(function(id, done){
  connection.query("select * from users where userid = " + id, function (err, rows){
    done(err, rows[0]);
  });
});
app.use('/', indexRouter);
app.get('/drive', driveRouter);
app.get('/info', infoRouter);
app.get('/signup', uidRouter);
app.get('/convert', convRouter);
app.get('/login', function(req, res){
  res.render('login', { req: req, message: req.flash('message') });
});
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

// - version
app.get('/version', function(req, res){
  res.write("Current version: " + verFile.split("\n")[0] + "\n\nChangelog:\n" + verFile.split("\n").filter(function(x) { return x !== verFile.split("\n")[0]; }).join("\n"));
  res.end();
});
// ---
app.post('/upl', async function(req, res){
  var form = new formidable.IncomingForm();
  // path.join(__dirname, "public\\upload\\")
  form.uploadDir = "./public/direct/";
  form.parse(req, async function (err, fields, files) {
      if (!req.isAuthenticated()) {
        res.render("drive", {req: req, error: "You are not logged in. Please log in."});
      }
      else {
        var filenameToUpload = files.filetoupload.name.replace(/ /g, "_");
        //var invalidCharsT = /[!@#^\&\*\(\)=\{\}\[\]\\|:;“‘<>,\?]/;
        filenameToUpload = encodeURIComponent(filenameToUpload);
        if (false) {
          res.render("drive", {req: req, error: "Encountered an error! (03: Filename contains invalid characters).<br/>The filename contains a prohibited character."});
        }
        else {
          if (filenameToUpload.startsWith("index") && fields.dispmetd != "dm_personal"){
            res.render("drive", {req: req, error: "Encountered an error! (04: The public directory isn't a web hosting service, use UserPages!"});
            return;
          }
          else {
            var flSz = files.filetoupload.size / 1000000;
            flSz = Math.round((flSz + Number.EPSILON) * 100) / 100;
            if (flSz > 100) {
              res.render("drive", {req: req, error: "Encountered an error! (05: File too large)<br/>The file you were trying to upload is too large (" + flSz + " MB compared to the limit of 100 MB)"})
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
                var newpath = path.normalize(path.join(__dirname, "public/user/") + req.session.user.username + "/" + safeName);
                var fuType = "user-upload/" + req.session.user.username;
                if (!fs.existsSync(path.normalize("./public/user/" + req.session.user.username))){
                  fs.mkdirSync(path.normalize("./public/user/" + req.session.user.username));
                }
              }
              else {
                var newpath = path.normalize(path.join(__dirname, "public/direct/") + safeName);
                var fuType = "upload";
              }
              if (fs.existsSync(path.normalize(path.join(__dirname, "public/direct/") + safeName)) && fields.dispmetd != "dm_personal"){
                res.render("drive", {req: req, error: "The file you are trying to upload already exists. Please rename the file."});
                return;
              }
              fs.rename(oldpath, newpath, function (err) {
                if (err){
                  res.render("drive", {req: req, error: "An error occurred creating the metadata file for the uploaded file."});
                  throw err;
                }
                var fileObj = '{ "name":' + '"' + safeName + '"' + ', "usrnm":' + '"' + req.session.user.username + '"' + ', "type":' + '"' + files.filetoupload.type + '"' + ', "size":' + files.filetoupload.size + '}';
                var jsonFileName = "./public/json/" + safeName + ".json";
                fs.writeFile(jsonFileName, fileObj, function(err){
                  if (err) {
                    res.render("drive", {req: req, error: "An error occurred creating the metadata file for the uploaded file."});
                    return;
                  }
                });
                var fullUrl = "http://mellemws.my.to/" + fuType + "/" + safeName;
                reportSuccess(res, req, "File uploaded successfully and can be found at /" + fuType + "/" + filenameToUpload + ".", fullUrl);
                return;
              });
            }
          }
        }
      }
  });
});
app.post('/createuid', async function(req, res){ // legacy
  var usID = Math.floor(Math.random() * 1000000);
  var usernameStr = req.body.usnm;
  var invalidChars = /[!@#^\&\*\(\)_=\{\}\[\]\\|:;“‘<>,\?]/;
  if (/\s/.test(usernameStr) || usernameStr.match(invalidChars) || usernameStr.includes("..") || usernameStr.includes("/")) {
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
    keyvUsNms.set(usernameStr, true);
    return;
  }
});
app.post('/register', [
  check('username')
      .exists()
      .trim()
      .matches(/^(?=.*[a-z])[a-z0-9_A-Z]{3,15}$/)
      .custom(async username => {
          const value = await isMentionNameInUse(username);
          if (value) {
              throw new Error('Username is taken.');
          }
      })
      .withMessage('Invalid username.'),
  check('email')
      .exists()
      .isLength({ min: 6, max: 100 })
      .isEmail()
      .normalizeEmail()
      .trim()
      .custom(async email => {
          const value = await isEmailInUse(email);
          if (value) {
              throw new Error('E-mail is already in use.');
          }
      })
      .withMessage('Invalid e-mail address.'),
  check('password')
      .exists()
      .isLength({ min: 8, max: 256 })
      .withMessage('Invalid password. (Use at least 8 characters!)'),
  check('rePassword').exists().custom((value, { req }) => {
      if (value !== req.body.password) {
        throw new Error('The passwords are not the same.');
      }    
      return true;
    })
], function (req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    console.log(errors.array());
    var errormsg = errors.array()[0].msg;
    console.log(errormsg);
    return res.render('createuser', { req: req, message: errormsg});
  } else {
      const username = req.body.username;
      const email = req.body.email;
      const pass = crypto.createHash('sha1').update(secrets.pass_salt + '' + req.body.password).digest('hex');
      var sql = mysql.format("INSERT INTO `users` (`userid`, `username`, `password`, `email`, `rgb`, `pro`, `mbused`) VALUES ('" + Math.floor(Math.random() * Math.floor(999999)) + "', '" + username + "', '" + pass + "', '" + email + "', '', '0', '0')");
      connection.query(sql, function (err, result) {
        if (err) throw err;
        console.log("New user registered: " + username);
      });
      res.render('login',{req:req, 'title':'Login', 'message': "Registered successfully. Please log in."});
  }
});
app.post("/login", passport.authenticate('local', {
  successRedirect: '/profile',
  failureRedirect: '/login',
  failureFlash: true
}), function(req, res, info){
  res.render('login',{'message' :req.flash('message')});
});
app.get('/upload/*', async function(req, res){
  var reqres = req.url.split("/")[2];
  var jsfn = "./public/json/" + reqres + ".json";
  console.log("Trying to access " + jsfn);
  var fileContent = "none.";
  fs.readFile(jsfn, function(err, data){
    if(err){
      reportErr(res, req, "An error occurred loading the file page.\nThis is likely because the file does not exist.");
      return;
    }
    else {
      fileContent = data;
    }
    console.log(fileContent);
    if (fileContent == "none."){
      res.render("interr", { req: req, errString: "The requested file does not exist." });
    }
    else {
      var parsedFC = JSON.parse(fileContent);
      var filetosim = reqres;
      connection.query("SELECT * FROM `fileviews` WHERE `file` = '" + filetosim + "' ", function(err, data){
        if(err){
          throw err;
        }
        if(!data[0]){
          console.log("File has not been viewed yet.");
          var regFile = {count:1,views:[{name: req.session.user.username || "Anonymous", time: new Date(), ip: req.headers['x-forwarded-for'] || req.socket.remoteAddress || req.connection.remoteAddress}]}
          var query = mysql.format("INSERT INTO `fileviews`(`file`, `views`) VALUES ('" + filetosim + "','" + JSON.stringify(regFile) + "')");
          connection.query(query, function(err, data){
            if(err){
              throw err;
            }
          })
        }
        else{
          var originalObj = JSON.parse(data[0].views);
          var newCount = originalObj.count + 1;
          //console.log(originalObj.views.push({name: "Simulated", time: new Date(), ip: req.headers['x-forwarded-for'] || req.socket.remoteAddress || req.connection.remoteAddress}));
          var viewArray = originalObj.views;
          viewArray.push({name: req.session.user.username || "Anonymous", time: new Date(), ip: req.headers['x-forwarded-for'] || req.socket.remoteAddress || req.connection.remoteAddress});
          var regFile = {count:newCount,views:viewArray};
          // UPDATE `fileviews` SET `file`='" + filetosim + "',`views`='" + JSON.stringify(regFile) + "' WHERE `file` = '" + filetosim + "'
          var query = mysql.format("UPDATE `fileviews` SET `file`='" + filetosim + "',`views`='" + JSON.stringify(regFile) + "' WHERE `file` = '" + filetosim + "'");
          connection.query(query, function(err, data){
            if(err){
              throw err;
            }
          })
        }
        res.render("dlview", { req: req, flobj: parsedFC, private: false, viewData: data});
      });
      return parsedFC;
    }
  });
});
app.get('/dev/test-upload-error', function(req, res){
  res.render('drive', { req: req, error: "Testing error!" });
});
app.get('/simulate-view', function(req, res){
  var filetosim = "test3.file";
  connection.query("SELECT * FROM `fileviews` WHERE `file` = '" + filetosim + "' ", function(err, data){
    if(err){
      throw err;
    }
    console.log(data);
    if(!data[0]){
      console.log("File has not been viewed yet.");
      var regFile = {count:1,views:[{name: "Simulated", time: new Date(), ip: req.headers['x-forwarded-for'] || req.socket.remoteAddress || req.connection.remoteAddress}]}
      var query = mysql.format("INSERT INTO `fileviews`(`file`, `views`) VALUES ('" + filetosim + "','" + JSON.stringify(regFile) + "')");
      connection.query(query, function(err, data){
        if(err){
          throw err;
        }
      })
    }
    else{
      var originalObj = JSON.parse(data[0].views);
      console.log(originalObj);
      var newCount = originalObj.count + 1;
      //console.log(originalObj.views.push({name: "Simulated", time: new Date(), ip: req.headers['x-forwarded-for'] || req.socket.remoteAddress || req.connection.remoteAddress}));
      var viewArray = originalObj.views;
      viewArray.push({name: "Simulated", time: new Date(), ip: req.headers['x-forwarded-for'] || req.socket.remoteAddress || req.connection.remoteAddress});
      var regFile = {count:newCount,views:viewArray};
      // UPDATE `fileviews` SET `file`='" + filetosim + "',`views`='" + JSON.stringify(regFile) + "' WHERE `file` = '" + filetosim + "'
      var query = mysql.format("UPDATE `fileviews` SET `file`='" + filetosim + "',`views`='" + JSON.stringify(regFile) + "' WHERE `file` = '" + filetosim + "'");
      connection.query(query, function(err, data){
        if(err){
          throw err;
        }
      })
    }
  });
  res.end('simmed view on file ' + filetosim);
});
app.get('/user-upload/*', async function(req, res){
  var reqres = req.url.split("/")[3];
  var jsfn = "./public/json/" + reqres + ".json";
  var fileContent = "none.";
  fs.readFile(jsfn, function(err, data){
    if(err){
      reportErr(res, req, "An error occurred loading the file page.\nThis is likely because the file does not exist.");
    }
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
  req.session.destroy(function (err) {
    if(err){
      console.log(err);
      throw err;
    }
    res.redirect('/');
  });
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
  var folder = './public/direct/' + dir;
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
        var fullTD = date_d + "-" + date_m + "-" + date_y + " " + time_h + ":" + time_m;
        var fileObject = {name: fileName, type: fileType, date: fullTD, icon: icon};
        fileArray.push(fileObject);
    });
    res.render('directory', { req: req, title: 'Public Directory', dirArray: fileArray, ihd: isHomeDir, curfol: folder, isUser: false});
  });
});
app.get('/destroysessioncookie', function(req, res){
  res.cookie('JSESSION','', { maxAge: xyears, httpOnly: true });
  res.redirect("/testsession");
});
app.get('/testsession', function(req,res){
  if(req.isAuthenticated()){
    res.write('[VALID] valid session\n');
  }
  else{
    if(req.cookies.JSESSION){
      res.write('[INVALID] reporting non-auth, session exists because JSESSION cookie was not destroyed, use /destroysessioncookie\n');
    }
    else if(req.session){
      res.write('[INVALID] reporting non-auth, session exists because session was ended invalidly\n');
    }
    else{
      res.write("[VALID] not authenticated\n");
    }
  }
  res.end("end of output");
});
app.get('/mydir/*', async function(req, res, next) {
  if (!req.isAuthenticated()){
    reportErr(res, req, "You are not logged in.\nPlease <a href='/login'>log in</a> to see your files.");
    return;
  }
  var usrName = req.session.user.username;
  if (!fs.existsSync(path.normalize("./public/user/" + req.session.user.username))){
    fs.mkdirSync(path.normalize("./public/user/" + req.session.user.username));
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
  var folder = './public/user/' + usrName + '/' + dir;
  console.log(folder);
  fs.readdir(folder, options, (err, files) => {
    var fileArray = [];
    if(!files){
      res.render('directory', { req: req, title: usrName + "'s files", dirArray: fileArray, ihd: isHomeDir, isUser: true, user: usrName});
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
        var fullTD = date_d + "-" + date_m + "-" + date_y + " " + time_h + ":" + time_m;
        var fileObject = {name: fileName, type: fileType, date: fullTD, icon: icon};
        fileArray.push(fileObject);
    });
    res.render('directory', { req: req, title: usrName + "'s files", dirArray: fileArray, ihd: isHomeDir, curfol: folder, isUser: true, user: usrName});
  });
});
app.get("/delete/*", async function(req, res, next){
  var fileToD = req.url.replace('/delete/','');
  if (fileToD.startsWith("?flnm=")){
    fileToD = fileToD.replace("?flnm=","");
  }
  fileToD = encodeURIComponent(fileToD);
  console.log(req.body);
  if (fileToD == ""){
    reportErr(res, req, "Please enter the name of the file that you want to delete.");
    return;
  }
  if(!req.isAuthenticated()){
    reportErr(res, req, "You are not logged in.\nPlease <a href='/login'>log in</a> to see your files.");
    return;
  }
  var usrName = req.session.user.username;
  if (fs.existsSync(path.normalize("./public/user/" + usrName + "/" + fileToD))){
    if (fileToD.includes("..")){
      reportErr(res, req, "You cannot delete files that are outside your User Directory.");
    }
    else {
      fs.unlinkSync(path.normalize("./public/user/" + usrName + "/" + fileToD));
      reportSuccess(res, req, "Successfully deleted file " + fileToD + " from your User Directory.");
    }
  }
  else {
    reportErr(res, req, "File does not exist.");
  }
});
app.get('/editmydir', isAuthenticated, function(req, res){
  res.render('diredit', { req: req });
});
app.post('/editmydir/*', isAuthenticated, function(req, res){
  var action = req.url.replace("/editmydir/","");
  if(action == "newfile"){
    var filenameToCreate = req.body.nfname.replace(/ /g, "_");
    //var invalidCharsT = /[!@#^\&\*\(\)=\{\}\[\]\\|:;“‘<>,\?]/;
    filenameToCreate = encodeURIComponent(filenameToCreate);
    var safeName = filenameToCreate;
    stringEscape(safeName);
    console.log("going to create file " + safeName + " with content " + req.body.nfcontent)
    fs.writeFileSync("./public/user/" + req.session.user.username + "/" + safeName,req.body.nfcontent);
  } else if(action == "newdir") {
    var filenameToCreate = req.body.ndname.replace(/ /g, "_");
    //var invalidCharsT = /[!@#^\&\*\(\)=\{\}\[\]\\|:;“‘<>,\?]/;
    filenameToCreate = encodeURIComponent(filenameToCreate);
    var safeName = filenameToCreate;
    stringEscape(safeName);
    console.log("going to create directory " + req.body.ndname + ".")
    
    fs.mkdirSync("./public/user/" + req.session.user.username + "/" + safeName);
  } else {
    reportErr(res, req, "Unknown action " + action);
    return;
  }
  res.redirect('/mydir/');
});
app.get('/profile', isAuthenticated, function(req, res){
  res.render('profile', { req: req, title: "Your Profile", user: req.session.user });
});
app.post('/up-edit', isAuthenticated, function(req, res){
  if(req.body.function == "create"){
    connection.query("INSERT INTO `userpage`(`name`, `data`) VALUES ('" + req.session.user.username + "','{}')");
    res.end("Created UserPage for " + req.session.user.username + ".");
  }
  else if(req.body.function == "set-private-access"){
    if(typeof(req.body['access-type']) == "undefined"){
      res.status(500).end();
      return;
    }
    if(!(req.body['access-type'].match(/^[a-zA-Z0-9]+$/g))){
      res.status(500).end();
      return;
    }
    console.log("trig " + req.body['access-type']);
    connection.query("UPDATE `access` SET `data`='{\"type\": \"" + req.body['access-type'] + "\"}' WHERE `user` = '" + req.session.user.username + "' ")
    res.status(200).end();
  }
  else{
    reportErr(res, req, "Unknown action " + action);
    return;
  }
});
app.post('/dev/clreq', function(req, res){
  console.log(req);
  res.end("Logged request to console.");
});
app.get('/user/*', function(req, res, next){
  console.log("I got a trig!");
  var userPage = req.originalUrl.split('/')[2];
  console.log(req.originalUrl.split('/'));
  if(req.originalUrl.split('/')[3]){
    if(fs.existsSync(path.normalize("./public/" + req.originalUrl))){
      if(!(req.isAuthenticated())){
        reportErr(res, req, "You need to be logged in to see private files.");
        return;
      }
      connection.query("SELECT * FROM `access` WHERE `user` = '" + userPage + "'", function(err, data){
        if(userPage == req.session.user.username || JSON.parse(data[0].data).type == "public"){
          //console.log("I should download");
          //console.log(path.normalize("./public/" + req.originalUrl));
          //res.download(path.normalize("./public/" + req.originalUrl));
          //res.end();
          next();
        }
        else{
          reportErr(res, req, "You do not have access to this file.");
          return;
        }
      });
    }
    else{
      next();
    }
  }
  else {
    var upPath = path.normalize("./public/user/" + userPage + "/");
    if(fs.existsSync(upPath + "index.htm") || fs.existsSync(upPath + "index.html")){
      next();
    }
    console.log(req.originalUrl.split('/')[2]);
    console.log("I _should_ get a trig");
    connection.query("SELECT * FROM `userpage` WHERE `name` = '" + userPage + "'", function(err, data){
      if(err){
        console.log(err);
        reportErr(res, req, err);
        return;
      }
      if(data.length != 0){
        console.log(data[0]);
        console.log("TRIGGERED");
        var customImage = fs.existsSync(path.normalize(`./public/images/user/${data[0].name}.png`));
        res.render("userpage", { req: req, name: data[0].name, data: JSON.parse(data[0].data), cim: customImage });
      }
      else{
        reportErr(res, req, "This user does not exist or has UserPages disabled.")
        return;
      }
    });
  }
});
app.get('/api/userpage/*', function(req, res){
  var upPath = path.normalize("./public/user/" + req.originalUrl.split('/')[3] + "/");
  if(fs.existsSync(upPath + "index.htm") || fs.existsSync(upPath + "index.html")){
    res.status(201).end();
    return;
  }
  console.log(req.originalUrl.split('/'));
  if(!(req.originalUrl.split('/')[3].match(/^[a-zA-Z0-9]+$/g))){
    res.status(500).end();
  }
  else{
    connection.query("SELECT * FROM `userpage` WHERE `name` = '" + req.originalUrl.split('/')[3] + "'", function(err, data){
      if(err){
        console.log(err);
        res.status(500).end();
      }
      if(data.length != 0){
        res.status(200).end();
      }
      else{
        res.status(404).end();
      }
    });
  }
});
app.get('/api/get-profile-data', function(req, res){
  if(!(req.isAuthenticated())){
    res.status(403).end();
  }
  else{
    connection.query("SELECT * FROM `access` WHERE `user` = '" + req.session.user.username + "'", function(err, data){
      if(err){
        console.log(err);
        res.status(500).end("Database error");
      }
      console.log(data);
      var acs_type = (data[0] ? JSON.parse(data[0].data).type : "unknown");
      res.json({"access-type":acs_type});
      res.end();
    });
  }
});
app.post('/profilesettings', function(req, res){
  if(!req.isAuthenticated()){
    reportErr(res, req, "Please log in to set your favourite colour!");
  }
  else {
    if(!req.body.color){
      reportErr(res, req, 'Please set a colour from the Profile page, not an out-of-nowhere POST request without the proper syntax!')
    }
    else {
      function hexToRgb(hex) {
        var result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? {
          r: parseInt(result[1], 16),
          g: parseInt(result[2], 16),
          b: parseInt(result[3], 16)
        } : null;
      }
      var rgbString = hexToRgb(req.body.color).r + "," + hexToRgb(req.body.color).g + "," + hexToRgb(req.body.color).b;
      connection.query("UPDATE `users` SET `rgb` = '" + rgbString + "' WHERE `users`.`username` = '" + req.session.user.username + "'", function(err, data){
        if(err){
          throw err;
        }
        req.session.user.rgb = rgbString;
        res.redirect('/profile');
      });
    }
  }
});
app.get('/dev/testsuccess', function(req, res){
  res.render("success", { req: req, sucString: "Nothing was actually done, this is just a test render of the success page.", sucUrl: "https://www.google.com/" }); // render success
});
/* 
  API handlers
*/
app.get("/api/ping", function(req, res){
  res.writeHead(200, {'Content-Type': 'text/plain'});
  res.write(apiHeader);
  res.write("\n  You successfully pinged the MelleWS API!\n");
  res.end("\n -- end of response -- " + new Date() + "\n");
});
app.get("/api/reqdetails", function(req, res){
  res.writeHead(200, {'Content-Type': 'text/plain'});
  res.write("     _____     _ _     _ _ _ _____ \n    |     |___| | |___| | | |   __|\n    | | | | -_| | | -_| | | |__   |\n    |_|_|_|___|_|_|___|_____|_____|\n")
  res.write("\n  Details found in your HTTP request can be found below.\n");
  res.write("\n  User Agent: " + req.rawHeaders[3] + "\n");
  // -- For some reason this code is triggering HTTP overload errors, even just logging the request JSON.
  //console.log(JSON.stringify(req));
  //res.write("\n  Raw JSON: " + JSON.stringify(req));
  //res.write("\n  Full Request JSON: " + JSON.stringify(req, null, 2) + "\n")
  res.end("\n -- end of response -- " + new Date() + "\n");
});
app.post('/api/upl', async function(req, res){
  reportApiErr(res, req, "API uploading is currently unavailable.")
  // var form = new formidable.IncomingForm();
  // // path.join(__dirname, "public\\upload\\")
  // form.uploadDir = "./public/upload/";
  // form.parse(req, async function (err, fields, files) {
  //   if (fields.usrID) {
  //     const getResult = await keyv.get(fields.usrID);
  //     if (getResult === void(0)) {
  //       reportErr(res, req, "User ID not found in database (code 02).<br/>Check if your User ID was entered correctly.");
  //     }
  //     else {
  //       var filenameToUpload = files.filetoupload.name.replace(/ /g, "_");
  //       console.log(filenameToUpload);
  //       var invalidCharsT = /[!@#^\&\*\(\)=\{\}\[\]\\|:;“‘<>,\?]/;
  //       if (filenameToUpload.match(invalidCharsT)) {
  //         reportErr(res, req, "Encountered an error! (03: Filename contains invalid characters).<br/>The filename contains a prohibited character.");
  //       }
  //       else {
  //         if (filenameToUpload.includes("/") || filenameToUpload.includes("\\")) {
  //           reportErr(res, req, "Encountered an error! (04: Malicious file detected.)<br/>The file you were trying to upload was detected as malicious.");
  //         }
  //         else {
  //           var flSz = files.filetoupload.size / 1000000;
  //           flSz = Math.round((flSz + Number.EPSILON) * 100) / 100;
  //           if (flSz > 100) {
  //             reportErr(res, req, "Encountered an error! (05: File too large)<br/>The file you were trying to upload is too large (" + flSz + " MB compared to the limit of 100 MB)")
  //           }
  //           else {
  //             var safeName = filenameToUpload;
  //             stringEscape(safeName);
  //             var oldpath = files.filetoupload.path;
  //             var newpath = path.join(__dirname, "public\\upload\\") + safeName;
  //             fs.rename(oldpath, newpath, function (err) {
  //               if (err) throw err;
  //               reportSuccess(res, req, "File uploaded successfully and can be found at /upload/" + filenameToUpload + ".");
  //             });
  //           }
  //         }
  //       }
  //     }
  //   }
  //   else {
  //     reportErr(res, req, "No User ID (code 01).");
  //   }
  // });
});
// End of API handlers
// Serve static, but only after checking that the user has access to the files accessed
app.use(express.static(path.join(__dirname, 'public')));

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
        res.end("\n -- end of response -- " + new Date() + "\n");
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
function isMentionNameInUse(username){
  return new Promise((resolve, reject) => {
      connection.query('SELECT COUNT(*) AS total FROM users WHERE username = ?', [username], function (error, results, fields) {
          if(!error){
              console.log("MENTION COUNT : "+results[0].total);
              return resolve(results[0].total > 0);
          } else {
            console.log(error);
              return reject(new Error('Database error!'));
          }
        }
      );
  });
}
function isEmailInUse(email){
  return new Promise((resolve, reject) => {
    connection.query('SELECT COUNT(*) AS total FROM users WHERE email = ?', [email], function (error, results, fields) {
          if(!error){
              console.log("EMAIL COUNT : "+results[0].total);
              return resolve(results[0].total > 0);
          } else {
              return reject(new Error('Database error!'));
          }
        }
      );
  });
}
function isAuthenticated(req, res, next) {
  if (req.isAuthenticated())
    return next();
  res.redirect('/login');
}
if(process.argv[1].includes('app.js')){
  console.log("\033[33m[Warning] \033[93mMelleWS is starting in Yooo mode. This is only to be used for debugging and development purposes and not supported for production environments. Features such as logging and SSL are not available in this mode. For more information, see README.md.\033[0m");
  app.listen(3000, () => {
    console.log("Started in Yooo mode.");
  })
}

module.exports = app;
