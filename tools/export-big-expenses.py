#!/usr/bin/env python3
"""从旧账本导出「需要人工甄别的大额支出」清单。

用法：
    python3 tools/export-big-expenses.py <xls文件> <输出目录>

产出两个 CSV：
  大额支出待甄别.csv   金额 ≥ 2000 的支出，最后一列留空给你填判断
  分类年份覆盖.csv     每个分类在哪几年被用过，用来看记录口径的变化
"""

import csv
import os
import re
import sys
from collections import Counter, defaultdict

import xlrd

THRESHOLD = 2000          # 进入待甄别清单的金额门槛

# 只用来给一列「机器推测」做提示，不参与统计。你在 CSV 里直接改就行了。
HINTS = [
    ('借贷本金', r'^$|借出|收款'),
    ('购房',     r'购房|房款|首付|契税|房贷|过户|中介费'),
    ('房租',     r'房租|租金'),
    ('装修',     r'装修|瓷砖|地板|家具|沙发|橱柜|门窗|油漆|水电|吊顶|家电|洗衣机|冰箱|空调|烘干机'),
    ('车辆',     r'买车|购车|新车|提车|瑞虎|车险|保养|交强险|上牌'),
    ('保险医疗', r'保险|重疾|医保|医疗|宏康|挂号|住院|手术'),
    ('学习',     r'认证|考试|培训|学费|报班|Cisp|证书'),
    ('数码',     r'\bmac\b|Mac|MacBook|电脑|笔记本|显示器|手机\b|iPhone|iPad'),
    ('旅行',     r'旅游|机票|酒店|民宿|门票'),
]


def hint_for(category, note):
    if category in ('借出', '收款'):
        return '借贷本金'
    text = '%s %s' % (category, note)
    for label, pattern in HINTS:
        if pattern != r'^$|借出|收款' and re.search(pattern, text, re.I):
            return label
    return '待定'


def load(path):
    return xlrd.open_workbook(path, ignore_workbook_corruption=True)


def read_records(book):
    sh = book.sheet_by_name('收支记录')
    header = [str(sh.cell_value(0, c)).strip() for c in range(sh.ncols)]
    idx = {n: i for i, n in enumerate(header)}

    def get(row, name):
        v = sh.cell_value(row, idx[name])
        return v.strip() if isinstance(v, str) else v

    rows = []
    for r in range(1, sh.nrows):
        if not any(str(sh.cell_value(r, c)).strip() for c in range(sh.ncols)):
            continue
        try:
            amount = float(get(r, '金额') or 0)
        except (TypeError, ValueError):
            continue
        date = str(get(r, '时间') or '').strip()
        m = re.match(r'(\d{4})[/-](\d{1,2})[/-](\d{1,2})', date)
        year = int(m.group(1)) if m else 0
        rows.append({
            'date': date,
            'year': year,
            'type': str(get(r, '收支类型') or '').strip(),
            'category': str(get(r, '账目分类') or '').strip(),
            'amount': amount,
            'abs': abs(amount),
            'account': str(get(r, '账户') or '').strip(),
            'note': str(get(r, '备注') or '').strip(),
        })
    return rows


def main():
    if len(sys.argv) < 3:
        print(__doc__)
        return 1
    src, outdir = sys.argv[1], sys.argv[2]
    os.makedirs(outdir, exist_ok=True)
    rows = read_records(load(src))
    expenses = [r for r in rows if r['type'] == '支出']

    # ---- 1. 大额支出待甄别 ----
    big = sorted((r for r in expenses if r['abs'] >= THRESHOLD),
                 key=lambda r: (-r['abs'], r['date']))
    path1 = os.path.join(outdir, '大额支出待甄别.csv')
    with open(path1, 'w', newline='', encoding='utf-8-sig') as f:
        w = csv.writer(f)
        w.writerow(['序号', '日期', '金额', '分类', '备注',
                    '机器推测(仅供参考)', '你的判断(填这里)', '是否日常消费(填是/否)', '备注2'])
        for i, r in enumerate(big, 1):
            w.writerow([i, r['date'], '%.2f' % r['abs'], r['category'], r['note'],
                        hint_for(r['category'], r['note']), '', '', ''])

    total = sum(r['abs'] for r in expenses)
    big_total = sum(r['abs'] for r in big)
    print('大额支出待甄别.csv   %d 条（≥%d 元），合计 %.0f，占支出总额 %.0f%%'
          % (len(big), THRESHOLD, big_total, 100.0 * big_total / total))

    # ---- 2. 分类 × 年份 覆盖 ----
    years = sorted({r['year'] for r in rows if r['year']})
    cats = Counter(r['category'] for r in rows)
    matrix = defaultdict(lambda: defaultdict(int))
    for r in rows:
        if r['year']:
            matrix[r['category']][r['year']] += 1

    path2 = os.path.join(outdir, '分类年份覆盖.csv')
    with open(path2, 'w', newline='', encoding='utf-8-sig') as f:
        w = csv.writer(f)
        w.writerow(['分类', '总条数'] + [str(y) for y in years])
        for cat, _ in sorted(cats.items(), key=lambda kv: -kv[1]):
            w.writerow([cat, cats[cat]] + [matrix[cat].get(y, 0) for y in years])

    print('分类年份覆盖.csv     %d 个分类 × %d 年' % (len(cats), len(years)))

    # ---- 3. 终端摘要 ----
    print()
    print('=== 每年记录情况（看口径什么时候变过） ===')
    print('  %-6s %6s %14s %8s %10s' % ('年份', '条数', '支出总额', '分类数', '主要账户'))
    for y in years:
        rs = [r for r in rows if r['year'] == y]
        ex = [r for r in rs if r['type'] == '支出']
        acc = Counter(r['account'] for r in rs).most_common(1)
        print('  %-6d %6d %14.0f %8d %10s'
              % (y, len(rs), sum(r['abs'] for r in ex),
                 len({r['category'] for r in rs}), acc[0][0] if acc else ''))
    return 0


if __name__ == '__main__':
    sys.exit(main())
