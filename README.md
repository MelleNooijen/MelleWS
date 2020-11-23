[![Website mellemws.my.to](https://img.shields.io/website-up-down-green-red/http/mellemws.my.to.svg)](https://mellemws.my.to/)
# MelleWS
MelleWS is a web platform written in NodeJS and Express.JS. It uses EJS as the view engine.
## Info
### The different scripts
You may ask, what is the difference between all the `.js` files, and what do they do?

Here is a list of what the scripts do:

`/app.js`: All main scripts and functions of MelleWS are handled here, and all pages are registered here.

`/bin/www`: This is the script from which all of MelleWS is started, as it creates and initializes all HTTP(S) servers. It also handles logging.

`/routes/*.js`: These are Routers. For more info, see "Routers".

`/views/*.ejs`: These are actually mostly HTML files, but with server-side JavaScript in them.

`/launcher(-prod/loop).bat`: These are Launcher scripts to start MelleWS. They can be ignored and don't need much updating, since they're only used to launch MelleWS for the website itself.
### Routers
Routers are the scripts which render EJS (dynamic HTML) pages. They are defined in `app.js`.
### HTTP Request handling
Only the `/public/` folder is visible to the browser, and if no HTTP requests match the ones defined in `app.js`, it will look for a file in `/public/`. If no file is found, it will (as of 0.4) throw a 404 error.
## Cloning and running
It is very easy to host MelleWS yourself, to tinker with it or just to have your own server. Below are the steps for cloning this repository and running it for yourself.
> Note: Make sure you have the latest versions of both NodeJS and NPM before starting.

First, clone the repo:
```bash
git clone https://github.com/MelleNooijen/MelleWS.git
```
It might prompt you to log in to Git(Hub), as this is a private repository.

Then, go to the folder in which the repository was cloned:
```bash
cd MelleWS
```
Install `nodemon` so you can run MelleWS properly:
```bash
npm install -g nodemon
```
Then, install dependencies:
```bash
npm install
```
(this will get the necessary dependencies from `package.json`)

And at last, you can start MelleWS:

**Linux:**
```bash
nodemon /bin/www
```
**Windows:**
```batch
launcher-prod
```
Or to start in Debug Mode (not recommended):
```batch
launcher-adv
```

Done!
