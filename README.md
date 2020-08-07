# MelleWS
MelleWS is a web platform written in NodeJS and Express.JS. It uses EJS as the view engine.
## Info
Only the `/public/` folder is visible to the browser, and if no HTTP requests match the ones defined in `app.js` or a specific router in `/routes`, it will look for a file in `/public/`. If no file is found, it will default to the last request in `app.js`.
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
launcher
```

Done!
