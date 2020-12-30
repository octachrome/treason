PORT=$1
MSG=$2
if [ \( "$PORT" != 80 -a "$PORT" != 8999 \) -o "$MSG" = "" ]; then
    echo "Usage: $0 80|8999 MSG"
    exit 1
fi
NGINX_PASSWD=$(grep nginx_passwd local_vars.yml | cut -d' ' -f2)
echo curl http://coup.thebrown.net:$PORT/alert -d "msg=$MSG" -u "treason:$NGINX_PASSWD"
