/* 离线缓存。
   只在 HTTPS 或 localhost 下会生效 —— 浏览器规定局域网 http 地址不允许注册
   Service Worker，所以用 start.sh 走局域网时它会被跳过，这是正常的。 */

const CACHE = 'xiaozhangben-v1';
const ASSETS = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './manifest.webmanifest',
  './favicon.svg',
  './icon-180.png',
  './icon-192.png',
  './icon-512.png',
];

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    // 逐个添加：某一个文件缺失也不该让整个安装失败
    await Promise.all(ASSETS.map(async url => {
      try { await cache.add(new Request(url, { cache: 'reload' })); }
      catch (err) { console.warn('[sw] 跳过', url, err); }
    }));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;

  let url;
  try { url = new URL(req.url); } catch { return; }
  if (url.origin !== self.location.origin) return;

  // 先给缓存（快），同时在后台更新（下次打开就是新版）
  event.respondWith((async () => {
    const cached = await caches.match(req, { ignoreSearch: true });

    const network = fetch(req).then(res => {
      if (res && res.ok && res.type === 'basic') {
        caches.open(CACHE).then(c => c.put(req, res.clone())).catch(() => {});
      }
      return res;
    }).catch(() => null);

    if (cached) return cached;

    const fresh = await network;
    if (fresh) return fresh;

    if (req.mode === 'navigate') {
      const shell = await caches.match('./index.html');
      if (shell) return shell;
    }
    return new Response('离线，且没有缓存副本', {
      status: 503,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    });
  })());
});
