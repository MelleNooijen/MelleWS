@echo off
pm2 start ./bin/www --exp-backoff-restart-delay=100
pause