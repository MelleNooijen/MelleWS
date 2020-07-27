# MelleWS
MelleWS is a web platform written in NodeJS and Express.JS. It uses EJS as the view engine.
## Info
Only the `/public/` folder is visible to the browser, and if no HTTP requests match the ones defined in `app.js` or a specific router in `/routes`, it will look for a file in `/public/`. If no file is found, it will default to the last request in `app.js`.
