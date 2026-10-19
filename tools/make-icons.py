#!/usr/bin/env python3
"""生成 App 图标。

图形只在这里定义一次，然后同时产出：
  - favicon.svg        网页标签页图标（浏览器用矢量，缩放不糊）
  - icon-180.png       iOS「添加到主屏幕」用
  - icon-192.png       Android / PWA 用
  - icon-512.png       PWA 大图 / 应用商店素材

用法：  python3 tools/make-icons.py
只依赖 Python 标准库，不需要装任何东西，也不需要浏览器。
改图标只需要改下面的 BG_TOP / BG_BOTTOM / BARS。
"""

import os
import struct
import zlib

# ---------------------------------------------------------------------------
# 图形定义。坐标系固定为 512×512，生成其它尺寸时会等比缩放。
# ---------------------------------------------------------------------------

SIZE = 512                      # 设计稿坐标系边长
BG_TOP = (59, 123, 255)         # #3b7bff 顶部
BG_BOTTOM = (38, 86, 214)       # #2656d6 底部
BARS = [                        # 三条白色横杠，像账目列表
    dict(x=128, y=142, w=256, h=52, r=26, alpha=1.00),
    dict(x=128, y=230, w=192, h=52, r=26, alpha=0.80),
    dict(x=128, y=318, w=128, h=52, r=26, alpha=0.55),
]

PNG_SIZES = [180, 192, 512]
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


# ---------------------------------------------------------------------------
# SVG（矢量图，直接由上面的常量生成）
# ---------------------------------------------------------------------------

def svg_source():
    def fmt(v):
        return ('%g' % v)

    lines = []
    for b in BARS:
        opacity = '' if b['alpha'] == 1 else ' opacity="%g"' % round(b['alpha'], 2)
        lines.append(
            '    <rect x="%s" y="%s" width="%s" height="%s" rx="%s"%s/>'
            % (fmt(b['x']), fmt(b['y']), fmt(b['w']), fmt(b['h']), fmt(b['r']), opacity)
        )
    bars = '\n'.join(lines)

    return '\n'.join([
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" '
        'width="512" height="512">',
        '  <!-- 这个文件由 tools/make-icons.py 生成，不要手改；改图标请改那个脚本。 -->',
        '  <defs>',
        '    <linearGradient id="g" x1="0" y1="0" x2="0" y2="1">',
        '      <stop offset="0" stop-color="#%02x%02x%02x"/>' % BG_TOP,
        '      <stop offset="1" stop-color="#%02x%02x%02x"/>' % BG_BOTTOM,
        '    </linearGradient>',
        '  </defs>',
        '  <rect width="512" height="512" fill="url(#g)"/>',
        '  <g fill="#ffffff">',
        bars,
        '  </g>',
        '</svg>',
        '',
    ])


# ---------------------------------------------------------------------------
# 位图（自己光栅化 + 自己写 PNG，超采样让圆角平滑）
# ---------------------------------------------------------------------------

def render(size, ss):
    """渲染 size×size 的 RGB 像素，每组 ss×ss 个采样点做抗锯齿。"""
    k = size / float(SIZE)                     # 设计坐标 -> 输出像素
    step = 1.0 / ss
    half = step / 2.0

    # 预先把横杠换算到输出坐标系，循环里就不用反复乘
    bars = []
    for b in BARS:
        bars.append((
            b['x'] * k, b['y'] * k,
            (b['x'] + b['w']) * k, (b['y'] + b['h']) * k,
            b['r'] * k, b['alpha'],
        ))

    rows = []
    n = ss * ss

    for y in range(size):
        row = bytearray(size * 3)
        for x in range(size):
            r = g = bl = 0.0
            for sy in range(ss):
                py = y + half + sy * step
                t = py / (SIZE * k)             # 纵向位置归一化到 0..1，和 SVG 渐变一致
                if t < 0.0:
                    t = 0.0
                elif t > 1.0:
                    t = 1.0
                br = BG_TOP[0] + (BG_BOTTOM[0] - BG_TOP[0]) * t
                bgc = BG_TOP[1] + (BG_BOTTOM[1] - BG_TOP[1]) * t
                bb = BG_TOP[2] + (BG_BOTTOM[2] - BG_TOP[2]) * t

                for sx in range(ss):
                    px = x + half + sx * step
                    cr, cg, cb = br, bgc, bb
                    for (x0, y0, x1, y1, rad, alpha) in bars:
                        # 圆角矩形 = 内缩掉半径的那个矩形，向外扩 rad。
                        # 先把点夹到内缩矩形上，再看它离得多远。
                        ix0 = x0 + rad
                        ix1 = x1 - rad
                        iy0 = y0 + rad
                        iy1 = y1 - rad
                        cx = ix0 if px < ix0 else (ix1 if px > ix1 else px)
                        cy = iy0 if py < iy0 else (iy1 if py > iy1 else py)
                        dx = px - cx
                        dy = py - cy
                        if dx * dx + dy * dy <= rad * rad:
                            cr += (255.0 - cr) * alpha
                            cg += (255.0 - cg) * alpha
                            cb += (255.0 - cb) * alpha
                    r += cr
                    g += cg
                    bl += cb

            o = x * 3
            row[o] = int(r / n + 0.5)
            row[o + 1] = int(g / n + 0.5)
            row[o + 2] = int(bl / n + 0.5)
        rows.append(row)
    return rows


def write_png(path, size, rows):
    raw = bytearray()
    for row in rows:
        raw.append(0)                # 每行的过滤器类型：0 = None
        raw += row

    def chunk(tag, data):
        return (struct.pack('>I', len(data)) + tag + data
                + struct.pack('>I', zlib.crc32(tag + data) & 0xffffffff))

    ihdr = struct.pack('>IIBBBBB', size, size, 8, 2, 0, 0, 0)   # 8 位、真彩色
    png = (b'\x89PNG\r\n\x1a\n'
           + chunk(b'IHDR', ihdr)
           + chunk(b'IDAT', zlib.compress(bytes(raw), 9))
           + chunk(b'IEND', b''))

    with open(path, 'wb') as f:
        f.write(png)
    return len(png)


def main():
    svg_path = os.path.join(ROOT, 'favicon.svg')
    with open(svg_path, 'w', encoding='utf-8') as f:
        f.write(svg_source())
    print('  favicon.svg      已生成')

    for size in PNG_SIZES:
        # 3×3 超采样，圆角有 10 级过渡，够平滑了
        rows = render(size, 3)
        path = os.path.join(ROOT, 'icon-%d.png' % size)
        n = write_png(path, size, rows)
        print('  icon-%d.png%*s已生成  %d×%d  %.1f KB'
              % (size, max(1, 12 - len(str(size))), '', size, size, n / 1024.0))

    print('\n图标已更新。如果网页已经打开，刷新一下即可看到新图标。')


if __name__ == '__main__':
    main()
