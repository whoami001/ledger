#!/bin/sh
# 启动本地服务，然后用浏览器打开提示的地址。
# 手机上使用：确保手机和电脑连同一个 Wi-Fi，用手机浏览器访问下面显示的「手机」地址，
# 再点「添加到主屏幕」，就跟 App 一样了。

cd "$(dirname "$0")" || exit 1
PORT="${PORT:-8787}"

echo ""
echo "  小账本已启动，请用浏览器打开："
echo ""
echo "    本机：   http://127.0.0.1:$PORT"

IP="$(ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null)"
if [ -n "$IP" ]; then
  echo "    手机：   http://$IP:$PORT      ← 地址可能随路由器变化"
fi

# Bonjour 名称，地址不受 IP 变化影响，手机上更推荐用这个
NAME="$(scutil --get LocalHostName 2>/dev/null)"
if [ -n "$NAME" ]; then
  echo "    手机（推荐）： http://$NAME.local:$PORT"
fi

echo ""
echo "  注意：电脑需要保持开机，手机才能访问；关掉这个窗口 App 就打不开了。"
echo "  想要随时随地都能用（电脑不用开），见 README.md 的「放到网上」一节。"
echo ""
echo "  按 Ctrl+C 停止。"
echo ""

LOG="$(mktemp -t xiaozhangben)"
python3 -m http.server "$PORT" --bind 0.0.0.0 >"$LOG" 2>&1 &
PID=$!

sleep 1
if ! kill -0 "$PID" 2>/dev/null; then
  echo "  启动失败："
  tail -5 "$LOG" | sed 's/^/    /'
  rm -f "$LOG"
  echo ""
  echo "  端口 $PORT 可能被占用了，换个端口重试：  PORT=8899 ./start.sh"
  exit 1
fi

trap 'kill "$PID" 2>/dev/null; rm -f "$LOG"' EXIT INT TERM
wait "$PID"
