if [ "$EUID" -ne 0 ]
  then echo "Please run as root."
  exit
fi
node ./bin/www