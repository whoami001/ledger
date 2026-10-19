#!/usr/bin/env python3
"""体检一份从记账网站导出的 .xls 账目文件。

用法：
    python3 tools/inspect-legacy.py <文件路径>

只读，不会修改原文件。输出的是数据质量问题清单，不打印具体流水。
"""

import sys
from collections import Counter, defaultdict

import xlrd


def load(path):
    # Maatwebsite 导出的文件 COMPDOC 结构不规范，xlrd 默认会拒收
    return xlrd.open_workbook(path, ignore_workbook_corruption=True)


def text(v):
    if v is None:
        return ''
    if isinstance(v, float):
        return ('%f' % v).rstrip('0').rstrip('.')
    return str(v).strip()


def parse_date(s):
    s = text(s).replace('-', '/').replace('.', '/')
    parts = s.split('/')
    if len(parts) != 3:
        return None
    try:
        y, m, d = (int(p) for p in parts)
    except ValueError:
        return None
    if not (1900 < y < 2200 and 1 <= m <= 12 and 1 <= d <= 31):
        return None
    return (y, m, d)


def sheet_rows(sh):
    """返回 (表头, 数据行列表)，每行是字符串列表。"""
    header = [text(sh.cell_value(0, c)) for c in range(sh.ncols)]
    rows = []
    for r in range(1, sh.nrows):
        vals = [text(sh.cell_value(r, c)) for c in range(sh.ncols)]
        if any(v for v in vals):
            rows.append(vals)
    return header, rows


def section(title):
    print()
    print('─' * 72)
    print(title)
    print('─' * 72)


def inspect_records(sh):
    header, rows = sheet_rows(sh)
    print('共 %d 条记录，%d 列：%s' % (len(rows), len(header), '、'.join(header)))

    idx = {name: i for i, name in enumerate(header)}

    def col(row, name):
        i = idx.get(name)
        return row[i].strip() if i is not None and i < len(row) else ''

    # ---- 1. 日期 ----
    section('1. 日期')
    good, bad = [], []
    for row in rows:
        d = parse_date(col(row, '时间'))
        (good if d else bad).append(d or col(row, '时间'))
    print('可解析的日期：%d 条' % len(good))
    if good:
        good_sorted = sorted(good)
        print('时间跨度：%d/%02d/%02d  ~  %d/%02d/%02d'
              % (good_sorted[0] + good_sorted[-1]))
        print('跨度约 %.1f 年' % ((len({g[:2] for g in good}) and
                                (good_sorted[-1][0] - good_sorted[0][0] + 1)) or 1))
    if bad:
        print('无法解析的日期：%d 条，例如：%s' % (len(bad), bad[:5]))

    by_year = Counter(d[0] for d in good)
    print()
    print('按年分布：')
    for y in sorted(by_year):
        print('  %d 年   %5d 条  %s' % (y, by_year[y], '▉' * max(1, by_year[y] // 60)))

    # ---- 2. 空值 ----
    section('2. 各列的空值情况')
    for i, name in enumerate(header):
        empty = sum(1 for r in rows if not r[i].strip())
        pct = empty * 100.0 / len(rows) if rows else 0
        flag = '  ← 几乎空列' if pct > 95 else ('  ← 大量缺失' if pct > 30 else '')
        print('  %-8s 空 %5d 条 (%5.1f%%)%s' % (name, empty, pct, flag))

    # ---- 3. 类型与金额符号 ----
    section('3. 收支类型 与 金额符号')
    types = Counter(col(r, '收支类型') for r in rows)
    for t, n in types.most_common():
        print('  %-8s %5d 条' % (t or '(空)', n))

    mismatch = []
    zero = []
    for r in rows:
        t = col(r, '收支类型')
        try:
            amt = float(col(r, '金额'))
        except ValueError:
            continue
        if amt == 0:
            zero.append(r)
        elif t == '支出' and amt > 0:
            mismatch.append(r)
        elif t == '收入' and amt < 0:
            mismatch.append(r)
    print()
    print('金额为 0 的记录：%d 条' % len(zero))
    print('符号与类型不符的记录：%d 条' % len(mismatch))
    for r in mismatch[:5]:
        print('     %s | %s | %s | %s' % (col(r, '时间'), col(r, '收支类型'),
                                          col(r, '账目分类'), col(r, '金额')))

    # ---- 4. 分类 ----
    section('4. 账目分类')
    cat_stat = defaultdict(lambda: [0, 0.0, None, None])
    for r in rows:
        c = col(r, '账目分类') or '(未分类)'
        try:
            amt = abs(float(col(r, '金额')))
        except ValueError:
            amt = 0.0
        s = cat_stat[c]
        s[0] += 1
        s[1] += amt
        d = parse_date(col(r, '时间'))
        if d:
            s[2] = d if s[2] is None or d < s[2] else s[2]
            s[3] = d if s[3] is None or d > s[3] else s[3]
    print('共 %d 个分类：' % len(cat_stat))
    print('  %-14s %6s %14s   %s' % ('分类', '条数', '累计金额', '使用时间范围'))
    for c, s in sorted(cat_stat.items(), key=lambda kv: -kv[1][0]):
        rng = ''
        if s[2]:
            rng = '%d/%02d ~ %d/%02d' % (s[2][0], s[2][1], s[3][0], s[3][1])
        print('  %-14s %6d %14.2f   %s' % (c, s[0], s[1], rng))

    # ---- 5. 账户 / 账本 / 成员 ----
    for name in ('账户', '账本', '成员'):
        section('5. %s 的取值' % name)
        cnt = Counter(col(r, name) or '(空)' for r in rows)
        for v, n in cnt.most_common(20):
            print('  %-16s %5d 条' % (v, n))
        if len(cnt) > 20:
            print('  ... 另有 %d 种取值' % (len(cnt) - 20))

    # ---- 6. 重复 ----
    section('6. 疑似重复记录')
    key = Counter()
    for r in rows:
        k = (col(r, '时间'), col(r, '金额'), col(r, '账目分类'), col(r, '备注'))
        key[k] += 1
    dup = {k: v for k, v in key.items() if v > 1}
    print('同一天 + 同金额 + 同分类 + 同备注 的记录组数：%d' % len(dup))
    print('涉及记录：%d 条' % sum(dup.values()))
    for k, v in sorted(dup.items(), key=lambda kv: -kv[1])[:6]:
        print('  ×%-3d %s  %s  %s  %s' % (v, k[0], k[1], k[2], k[3][:16]))

    # ---- 7. 金额分布 ----
    section('7. 金额分布')
    amts = []
    for r in rows:
        try:
            amts.append(abs(float(col(r, '金额'))))
        except ValueError:
            pass
    amts.sort()
    if amts:
        def pct(p):
            return amts[int(len(amts) * p)]
        print('  最小 %.2f   中位数 %.2f   75%% %.2f   95%% %.2f   99%% %.2f   最大 %.2f'
              % (amts[0], pct(0.5), pct(0.75), pct(0.95), pct(0.99), amts[-1]))
        print()
        print('  最大的 10 笔：')
        big = sorted(rows, key=lambda r: -abs(float(col(r, '金额') or 0)))[:10]
        for r in big:
            print('    %s  %-8s %-12s %12s  %s'
                  % (col(r, '时间'), col(r, '收支类型'), col(r, '账目分类'),
                     col(r, '金额'), col(r, '备注')[:20]))
        # 小数位异常
        odd = [a for a in amts if abs(a * 100 - round(a * 100)) > 1e-6]
        print()
        print('  金额小数超过 2 位的记录：%d 条' % len(odd))

    return header, rows, idx, col


def inspect_loans(sh):
    header, rows = sheet_rows(sh)
    if not rows:
        print('  （空表）')
        return
    print('共 %d 条，%d 列：%s' % (len(rows), len(header), '、'.join(header)))
    idx = {n: i for i, n in enumerate(header)}

    def col(row, name):
        i = idx.get(name)
        return row[i].strip() if i is not None and i < len(row) else ''

    section('借入借出：按人汇总')
    per = defaultdict(lambda: [0, 0.0])
    for r in rows:
        who = col(r, '借贷人') or '(空)'
        try:
            amt = float(col(r, '金额'))
        except ValueError:
            amt = 0.0
        per[who][0] += 1
        per[who][1] += amt
    print('  %-12s %6s %14s   %s' % ('对象', '笔数', '净额', '含义'))
    for who, (n, s) in sorted(per.items(), key=lambda kv: kv[1][1]):
        meaning = '对方还欠你 %.2f' % -s if s < -0.01 else (
            '你已收回/多余 %.2f' % s if s > 0.01 else '已结清')
        print('  %-12s %6d %14.2f   %s' % (who, n, s, meaning))

    section('借入借出：其他问题')
    bad = [r for r in rows if not col(r, '借贷人')]
    print('  借贷人为空：%d 条' % len(bad))
    noint = sum(1 for r in rows if not col(r, '利息'))
    print('  利息列为空：%d 条' % noint)
    kinds = Counter(col(r, '借贷类型') for r in rows)
    print('  借贷类型分布：%s' % dict(kinds))


def main():
    if len(sys.argv) < 2:
        print(__doc__)
        return 1
    path = sys.argv[1]
    book = load(path)
    print('文件：%s' % path)
    print('工作表：')
    for sh in book.sheets():
        print('  %-12s %5d 行 × %d 列' % (sh.name, sh.nrows, sh.ncols))

    for sh in book.sheets():
        print()
        print('#' * 72)
        print('# 【%s】' % sh.name)
        print('#' * 72)
        if sh.nrows <= 1:
            print('  只有表头，没有任何数据。')
            continue
        if '收支' in sh.name:
            inspect_records(sh)
        else:
            inspect_loans(sh)
    return 0


if __name__ == '__main__':
    sys.exit(main())
