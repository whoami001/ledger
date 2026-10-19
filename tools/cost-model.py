#!/usr/bin/env python3
"""家底模型：算清楚「我有多少」「每年花多少」「结构健不健康」。

用法：
    python3 tools/cost-model.py                 # 只看资产、负债、固定成本
    python3 tools/cost-model.py <旧账本.xls>    # 再加上历史支出分析

改下面的 LOANS / ANNUAL_FEES / ASSETS 就能跟上变化，不用动逻辑。
金额单位：元。
"""

import json
import math
import os
import re
import sys
from collections import defaultdict

# ---------------------------------------------------------------------------
# 数据放在 out/我的数据.json —— 那个目录在 .gitignore 里，不会进公开仓库。
# 找不到它的时候用下面这份示例数字（全是假的），只是为了让你能跑起来看效果。
# ---------------------------------------------------------------------------
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_FILE = os.path.join(ROOT, 'out', '我的数据.json')

EXAMPLE = {
    'daily_annual': 60000,
    # kind='min' 表示 monthly 只是「最低还款额」，不是实际在还的钱
    'loans': [
        dict(name='示例房贷', balance=500000, rate=0.031, monthly=2180,
             kind='normal', end='2055-08-08', note='这是示例数字'),
    ],
    'annual_fees': [
        dict(name='物业费', amount=434.71 * 12),
    ],
    # 房产按保守口径（合同价 × 0.7）估值
    'assets': [
        dict(name='自住房（保守估值）', value=3000000, productive=False),
        dict(name='投资持仓', value=1000000, productive=True),
        dict(name='现金', value=200000, productive=False),
        dict(name='车', value=100000, productive=False),
    ],
}


def load_config():
    if os.path.exists(DATA_FILE):
        with open(DATA_FILE, encoding='utf-8') as f:
            cfg = json.load(f)
        print('数据来源：%s' % os.path.relpath(DATA_FILE, ROOT))
        return cfg
    print('没找到 out/我的数据.json，下面跑的是【示例数字】，不是你的真实情况。')
    print('把你的数据写进 %s 即可。' % os.path.relpath(DATA_FILE, ROOT))
    return EXAMPLE


_CFG = load_config()
LOANS = _CFG.get('loans', [])
ASSETS = _CFG.get('assets', [])
ANNUAL_FEES = _CFG.get('annual_fees', [])
DAILY_ANNUAL = _CFG.get('daily_annual', 0)

NOT_SPENDING = {'借出', '余额变更'}
FAMILY_FIXED = {'妈工资', '房租'}
ONE_OFF_NOTE = r'购房|房款|契税|首付|房产交割|面积差|公维|买车|购车|新车|提车|瑞虎|MBA|mba课程'
ONE_OFF_CAT = {'装修'}
ONE_OFF_MIN = 1000


def money(x):
    return '{:,.0f}'.format(round(x))


def title(n, text):
    print()
    print('=' * 74)
    print('%s、%s' % (n, text))
    print('=' * 74)
    print()


def solve_n(balance, r, payment):
    if r <= 0:
        return balance / payment
    if payment <= balance * r:
        return None
    return -math.log(1 - balance * r / payment) / math.log(1 + r)


def balance_after(balance, r, payment, n):
    if r <= 0:
        return max(0.0, balance - payment * n)
    return balance * (1 + r) ** n - payment * ((1 + r) ** n - 1) / r


def months_until(end):
    m = re.match(r'(\d{4})-(\d{2})', end or '')
    if not m:
        return None
    return (int(m.group(1)) - 2026) * 12 + (int(m.group(2)) - 10)


def loans_section():
    title('一', '负债与还款结构')
    monthly_sum = interest_month = principal_month = debt_total = 0.0
    for L in LOANS:
        r = L['rate'] / 12
        interest = L['balance'] * r
        principal = L['monthly'] - interest
        monthly_sum += L['monthly']
        interest_month += interest
        principal_month += principal
        debt_total += L['balance']

        print('  【%s】%s' % (L['name'], L.get('note', '')))
        print('    余额 %s    年利率 %.3f%%    每月 %s'
              % (money(L['balance']), L['rate'] * 100, money(L['monthly'])))
        print('    月利息 %.0f → 每月这 %s 里，%.0f 是利息、%.0f 是本金'
              % (interest, money(L['monthly']), interest, principal))

        left_months = months_until(L.get('end'))
        if left_months and left_months > 0:
            if r > 0:
                need = L['balance'] * r / (1 - (1 + r) ** -left_months)
            else:
                need = L['balance'] / left_months
            print('    到期 %s，还剩 %d 期（%.1f 年），按期还完每月应还 %.0f'
                  % (L['end'], left_months, left_months / 12.0, need))
            if need > L['monthly'] * 1.02:
                gap = need - L['monthly']
                tail = balance_after(L['balance'], r, L['monthly'], left_months)
                if L.get('kind') == 'min':
                    print('    ⚠ 只还最低的话，比"按期还完"少 %.0f/月（一年少还 %s）'
                          % (gap, money(gap * 12)))
                    if tail > 1:
                        print('    ⚠ 后果：到 %s 时还剩 %s 本金要一次性结清'
                              % (L['end'], money(tail)))
                else:
                    print('    ⚠ 比你现在还的多 %.0f/月（一年多 %s）' % (gap, money(gap * 12)))
                    if tail > 1:
                        print('    ⚠ 若一直只还 %s 到到期日，届时还剩 %s 要一次性还清'
                              % (money(L['monthly']), money(tail)))
        n = solve_n(L['balance'], r, L['monthly'])
        if n:
            print('    按 %s/月 单独算，需要 %.0f 期（%.1f 年）'
                  % (money(L['monthly']), n, n / 12.0))
        print()

    print('  ── 每月小计 ──')
    print('    月还款合计        %12s' % money(monthly_sum))
    print('    其中利息          %12s   ← 真正「花掉」的部分' % money(interest_month))
    print('    其中本金          %12s   ← 转成净资产，不是花掉' % money(principal_month))
    print('    负债总额          %12s' % money(debt_total))
    return debt_total


def fees_section():
    title('二', '每年固定成本')
    monthly = sum(L['monthly'] for L in LOANS)
    print('  每月扣款：')
    for L in LOANS:
        print('    %-12s %12s × 12 = %12s'
              % (L['name'], money(L['monthly']), money(L['monthly'] * 12)))
    print('    %-12s %12s   %12s' % ('小计', '', money(monthly * 12)))
    print()
    print('  每年一次性缴纳：')
    annual = 0.0
    for f in ANNUAL_FEES:
        annual += f['amount']
        print('    %-14s %26s' % (f['name'], money(f['amount'])))
    print('    %-12s %12s   %12s' % ('小计', '', money(annual)))
    print()
    with_car = monthly * 12 + annual
    car = next((L['monthly'] for L in LOANS if L['name'] == '车贷'), 0.0)
    without_car = with_car - car * 12
    print('  ┌──────────────────────────────────────────────────────┐')
    print('  │ 年度固定成本（含车贷） %10s 元              │' % money(with_car))
    print('  │ 车贷还完后             %10s 元              │' % money(without_car))
    print('  └──────────────────────────────────────────────────────┘')
    return with_car, without_car


def wealth_section(debt_total, fixed_annual):
    title('三', '家底与健康指标')
    total_asset = sum(a['value'] for a in ASSETS)
    net_worth = total_asset - debt_total
    cash = sum(a['value'] for a in ASSETS if a['name'] == '现金')
    productive = sum(a['value'] for a in ASSETS if a.get('productive'))
    passive = sum(a.get('annual_income', 0) for a in ASSETS)
    annual_expense = DAILY_ANNUAL + fixed_annual
    monthly_expense = annual_expense / 12.0

    print('  %-24s %14s %10s' % ('资产', '金额', '占总资产'))
    for a in sorted(ASSETS, key=lambda x: -x['value']):
        print('  %-24s %14s %9.1f%%'
              % (a['name'], money(a['value']), 100.0 * a['value'] / total_asset))
    print('  %-24s %14s' % ('总资产', money(total_asset)))
    print('  %-24s %14s' % ('负债', '-' + money(debt_total)))
    print('  %-24s %14s' % ('净资产', money(net_worth)))
    print()
    print('  ── 健康指标 ──')
    print('    负债率（负债/总资产）   %8.1f%%     越低越稳' % (100.0 * debt_total / total_asset))
    print('    生存月数（现金/月支出） %8.1f 个月   低于 6 个月要警惕'
          % (cash / monthly_expense))
    print('    生产性资产占比          %8.1f%%     会自己生钱的部分'
          % (100.0 * productive / net_worth))
    print('    债务覆盖（现金/负债）   %8.1f%%     现金能抵掉多少债'
          % (100.0 * cash / debt_total))
    print('    被动收入（年）          %8s     占年支出 %.1f%%'
          % (money(passive), 100.0 * passive / annual_expense))
    print()
    print('  ── 年度收支 ──')
    print('    日常 + 家庭固定         %10s' % money(DAILY_ANNUAL))
    print('    ＋ 年度固定成本         %10s' % money(fixed_annual))
    print('    ＝ 真实年度支出         %10s    月均 %s'
          % (money(annual_expense), money(monthly_expense)))
    return net_worth, annual_expense


def load_records(path):
    import xlrd
    book = xlrd.open_workbook(path, ignore_workbook_corruption=True)
    sh = book.sheet_by_name('收支记录')
    header = [str(sh.cell_value(0, c)).strip() for c in range(sh.ncols)]
    ix = {n: i for i, n in enumerate(header)}

    def g(row, name):
        v = sh.cell_value(row, ix[name])
        return v.strip() if isinstance(v, str) else v

    out = []
    for r in range(1, sh.nrows):
        if not any(str(sh.cell_value(r, c)).strip() for c in range(sh.ncols)):
            continue
        try:
            amt = float(g(r, '金额') or 0)
        except (TypeError, ValueError):
            continue
        date = str(g(r, '时间') or '')
        m = re.match(r'(\d{4})[/-]', date)
        out.append(dict(year=int(m.group(1)) if m else 0, date=date,
                        type=str(g(r, '收支类型') or ''), cat=str(g(r, '账目分类') or ''),
                        amt=abs(amt), note=str(g(r, '备注') or '')))
    return out


def bucket_of(r):
    if r['cat'] in NOT_SPENDING:
        return '非消费'
    if re.search(ONE_OFF_NOTE, r['note'], re.I):
        return '一次性大额'
    if r['cat'] in ONE_OFF_CAT and r['amt'] >= ONE_OFF_MIN:
        return '一次性大额'
    if r['cat'] in FAMILY_FIXED:
        return '家庭固定'
    if re.search(r'房租|物业|取暖|供暖|保险|房贷|月供', r['note']):
        return '家庭固定'
    return '日常'


def history_section(path):
    title('四', '旧账本按你的口径重新分桶')
    rows = [r for r in load_records(path) if r['type'] == '支出']
    per = defaultdict(lambda: defaultdict(float))
    for r in rows:
        per[r['year']][bucket_of(r)] += r['amt']
    print('  注意：旧账本里没有房贷和车贷，所以下表不等于你的真实支出。')
    print()
    print('  %-6s %12s %12s %12s %12s' % ('年份', '日常', '家庭固定', '一次性大额', '非消费'))
    for y in sorted(y for y in per if y):
        print('  %-6d %12s %12s %12s %12s'
              % (y, money(per[y]['日常']), money(per[y]['家庭固定']),
                 money(per[y]['一次性大额']), money(per[y]['非消费'])))


def main():
    debt = loans_section()
    fixed, _ = fees_section()
    wealth_section(debt, fixed)
    if len(sys.argv) > 1 and os.path.exists(sys.argv[1]):
        history_section(sys.argv[1])
    return 0


if __name__ == '__main__':
    sys.exit(main())
