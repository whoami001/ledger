# 部署到群晖 DS220+

## 你这台设备的情况

已经探测到的（无需你手动确认）：

| 项 | 值 |
| --- | --- |
| 型号 | DS220+（DS220plus） |
| DSM | 7.3-86009 |
| 网口 | eth0 = 192.168.31.172，eth1 = 192.168.31.173（同一台机器的两个网口） |
| CPU | Intel Celeron J4025，x86_64 |

x86 架构这一条是关键：DS220+ 能装 **Container Manager**（Docker），所以它不只能放网页，
以后还能跑后端。入门款 DS220j 是 ARM，装不了 Docker，路子会窄很多。

## 目标

同时满足三个硬条件：

1. **地址永久固定**（数据绑地址，地址一变账本就「空」了）
2. **HTTPS**（没有它，离线缓存用不了；而且 HTTPS 页面不允许调用 HTTP 接口）
3. **不用公网 IP、不用端口映射、不用备案**

满足这三条的免费做法是 **Tailscale**：它给你的 NAS 分配一个固定的 `*.ts.net` 域名，
自动签好 HTTPS 证书，并且能穿过运营商级 NAT（CGNAT）——顺带说，国内家宽的 80/443
入站普遍被封锁或需要备案，所以「DDNS + 端口映射」那条最直觉的路基本走不通。

代价是：**手机和电脑上都要装 Tailscale 客户端**并保持连接。如果不想装客户端，
见文末的 Cloudflare Tunnel 方案。

## 步骤

### 1. 把账本文件传到 NAS

用 File Station 建一个文件夹，例如 `/web/ledger`，把这些文件传上去：

```
index.html
styles.css
app.js
sw.js
manifest.webmanifest
favicon.svg
icon-180.png
icon-192.png
icon-512.png
```

`tools/`、`README.md`、`start.sh`、`.env` 都不用传。

### 2. 先用 Web Station 在局域网跑通

套件中心 → 安装 **Web Station** → 建一个「虚拟主机」或直接用默认站点，
文档根目录指到 `/web/ledger`。

然后在电脑浏览器打开 `http://192.168.31.172/`，**看到账本界面才算这一步过了**。
先别往下走，局域网都不通的话，后面加隧道只会更难排查。

### 3. 装 Container Manager

套件中心 → 搜索 **Container Manager** → 安装。

### 4. 用容器跑 Tailscale

先在 Tailscale 官网注册账号、在后台生成一个 **Auth Key**（Reusable 打开）。

然后 SSH 到 NAS，或者用 Container Manager 的「终端机」，执行：

```sh
sudo mkdir -p /volume1/docker/tailscale

sudo docker run -d \
  --name tailscale \
  --restart unless-stopped \
  --network host \
  --cap-add NET_ADMIN \
  --cap-add NET_RAW \
  -v /volume1/docker/tailscale:/var/lib/tailscale \
  -e TS_STATE_DIR=/var/lib/tailscale \
  -e TS_AUTHKEY=你生成的key \
  tailscale/tailscale:latest
```

用 `--network host` 是必须的，否则容器里访问不到 Web Station 的端口。

### 5. 打开 HTTPS 证书

Tailscale 管理后台 → **DNS** → 找到 **HTTPS Certificates** → 启用。

不做这一步，第 6 步的 `--https=443` 会失败。

### 6. 把站点发布出去

进入容器执行：

```sh
sudo docker exec -it tailscale tailscale serve --bg --https=443 http://127.0.0.1:80
```

它会返回一个形如 `https://ds220plus.你的tailnet.ts.net/` 的地址。

> 不同版本的 Tailscale 参数略有差别，如果报错，先跑
> `sudo docker exec -it tailscale tailscale serve --help` 看当前版本的写法。
> 老版本可能是 `tailscale serve https / http://127.0.0.1:80`。
>
> 也可以让 Tailscale 直接托管静态目录（省掉 Web Station），
> 把上面的目标换成 `/volume1/web/ledger` 即可——但那个目录得挂进容器里才看得见。

`serve` 和 `funnel` 的区别要留意：**`serve` 只对你自己的 tailnet 开放**（私有，推荐），
`funnel` 是向公网开放。别用错。

### 7. 在 iPhone 上设置

1. App Store 装 **Tailscale**，用同一个账号登录，保持开启
2. Safari 打开第 6 步拿到的 `https://...ts.net` 地址
3. 共享 → 添加到主屏幕

以后从桌面图标打开即可。**地址就是这一个，不要改**——改了等于换了一本空账本。

## 这样比静态托管好在哪

| | Netlify / Cloudflare Pages | NAS + Tailscale |
| --- | --- | --- |
| 配置成本 | 拖一下文件夹，两分钟 | 半小时，要装套件和容器 |
| 手机端要求 | 无 | 要装并保持 Tailscale |
| 依赖第三方 | 是 | 否，完全自己的设备 |
| 服务是否公开在公网 | 是（只有代码，没有数据） | 否，只有你的 tailnet 能访问 |
| 以后加后端做同步 | 不方便，那些平台不支持长驻进程 | 天然合适 |
| NAS 关机或断网时 | 不受影响 | 打不开，但**已缓存的页面仍可用，记账照常** |

最后一条容易被误读，说明一下：因为 App 已经加了离线缓存，NAS 不可达时页面会从缓存打开，
你照样能记账，数据先存在手机本地；等 NAS 恢复、下次打开时再取最新文件。所以 NAS 掉线
并不会让你记不了账。

## 另一个选项：Cloudflare Tunnel

不想在手机上装 Tailscale 的话：

1. 买一个域名（约 ¥60/年），DNS 托管到 Cloudflare
2. NAS 上用 Container Manager 跑一个 `cloudflare/cloudflared` 容器
3. 在 Cloudflare 后台建一条隧道，指向 `http://127.0.0.1:80`
4. 得到 `https://ledger.你的域名.com`

优点是任何浏览器都能开，不需要客户端；代价是要买域名，而且站点是**真的公开在互联网上**
（现在只有代码没有数据，无所谓；但以后如果加后端，必须先加访问认证）。

## 国内使用的现实提醒

这两条路在国内都不是 100% 稳定，取决于你的宽带和运营商：

- Tailscale 的控制面在国内有时会连接不畅（登录环节尤其容易出问题，可以试试用邮箱登录的方式）
- `*.pages.dev` / `*.netlify.app` 这类域名在国内访问时好时坏

**建议先在手机上实测一周再做决定**，不要因为第一天能用就认定长期稳定。

真正最稳的是国内云服务器 + 域名 + 备案，但那是另一笔成本和另一套流程，对个人记账不划算。

## 无论如何都要记住的两件事

1. **地址一旦定下就别换。** 换地址 = 换账本，旧数据不会跟过去。
2. **定期导出备份。** NAS 能降低风险，但不能消除风险（误删、账号丢失、NAS 故障都会中招）。
