'use strict';

/* =========================================================
   小账本 —— 本地记账应用
   数据存在浏览器 localStorage，不上传任何服务器。
   ========================================================= */

/* ---------- 分类定义 ---------- */
const CATEGORIES = {
  expense: [
    { k:'food',      n:'餐饮', e:'🍜', c:'#f4553d' },
    { k:'transport', n:'交通', e:'🚌', c:'#3d8bfd' },
    { k:'shopping',  n:'购物', e:'🛍️', c:'#a855f7' },
    { k:'home',      n:'居家', e:'🏠', c:'#14b8a6' },
    { k:'fun',       n:'娱乐', e:'🎮', c:'#ec4899' },
    { k:'health',    n:'医疗', e:'💊', c:'#22a35b' },
    { k:'study',     n:'学习', e:'📚', c:'#f59e0b' },
    { k:'comm',      n:'通讯', e:'📱', c:'#6366f1' },
    { k:'social',    n:'人情', e:'🎁', c:'#ef4444' },
    { k:'pet',       n:'宠物', e:'🐾', c:'#8d6e63' },
    { k:'travel',    n:'旅行', e:'✈️', c:'#06b6d4' },
    { k:'other',     n:'其他', e:'📦', c:'#94a3b8' },
  ],
  income: [
    { k:'salary',    n:'工资', e:'💰', c:'#12a45c' },
    { k:'bonus',     n:'奖金', e:'🎉', c:'#f59e0b' },
    { k:'invest',    n:'理财', e:'📈', c:'#0d9488' },
    { k:'parttime',  n:'兼职', e:'💼', c:'#3d8bfd' },
    { k:'reimburse', n:'报销', e:'🧾', c:'#a855f7' },
    { k:'other',     n:'其他', e:'📦', c:'#94a3b8' },
  ],
};

const CAT_MAP = {};
for (const type of ['expense', 'income']) {
  for (const c of CATEGORIES[type]) CAT_MAP[type + ':' + c.k] = Object.assign({ type }, c);
}
function catInfo(type, k) {
  return CAT_MAP[type + ':' + k] || { k, n: '未分类', e: '❔', c: '#94a3b8', type };
}

/* ---------- 存储 ---------- */
const LS_KEY = 'xiaozhangben.v1';
let storageOK = true;
let demoMode = false;

const defaultState = () => ({
  version: 2,
  records: [],          // 日常流水
  loans: [],            // 债务：余额、利率、月供、到期日
  fees: [],             // 固定支出：物业费、取暖费、保险等
  ui: { type: 'expense', cat: { expense: 'food', income: 'salary' }, fixedOpen: false },
});

let state = defaultState();

function load() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return;
    const data = JSON.parse(raw);
    if (data && Array.isArray(data.records)) {
      state = Object.assign(defaultState(), data);
      state.ui = Object.assign(defaultState().ui, data.ui || {});
      // 老版本的数据没有这两项，补上空数组
      if (!Array.isArray(state.loans)) state.loans = [];
      if (!Array.isArray(state.fees)) state.fees = [];
    }
  } catch (err) {
    storageOK = false;
    console.warn('读取本地数据失败：', err);
  }
}

function save() {
  if (demoMode) return; // 预览模式不动真实数据
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(state));
  } catch (err) {
    storageOK = false;
    console.warn('保存失败：', err);
  }
}

/* 预览用示例数据：?demo=1 时只在内存里生成，不写入 localStorage */
function seedDemo() {
  demoMode = true;
  storageOK = true;
  const out = [];
  const push = (ago, type, category, amount, note) => {
    const d = new Date();
    d.setDate(d.getDate() - ago);
    out.push({
      id: 'demo' + out.length,
      type, category,
      amount,
      date: `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`,
      note: note || '',
      createdAt: Date.now() - ago * 864e5 - out.length,
    });
  };
  const plan = [
    [0, 'expense', 'food', 32, '楼下小面'],
    [0, 'expense', 'transport', 6, '地铁'],
    [0, 'expense', 'shopping', 128.5, '日用品'],
    [1, 'expense', 'food', 58, '和同事午饭'],
    [1, 'income', 'parttime', 800, '外快'],
    [2, 'expense', 'fun', 45, '电影票'],
    [2, 'expense', 'food', 26, ''],
    [3, 'expense', 'health', 240, '感冒药'],
    [4, 'expense', 'comm', 99, '话费'],
    [4, 'expense', 'food', 41, '晚饭'],
    [5, 'expense', 'home', 320, '水电燃气'],
    [6, 'expense', 'study', 158, '买了本书'],
    [7, 'income', 'salary', 12000, ''],
    [8, 'expense', 'social', 200, '同事生日'],
    [9, 'expense', 'food', 37, ''],
    [12, 'expense', 'shopping', 699, '一双鞋'],
    [15, 'expense', 'travel', 460, '周末周边'],
    [20, 'expense', 'pet', 180, '猫粮'],
    [35, 'expense', 'home', 1500, '房租'],
    [40, 'income', 'salary', 12000, ''],
    [45, 'expense', 'food', 210, '聚餐'],
    [70, 'expense', 'home', 1500, '房租'],
    [75, 'income', 'salary', 11800, ''],
  ];
  for (const p of plan) push(p[0], p[1], p[2], p[3], p[4]);
  state.records = out;

  // 预览用的示例贷款和固定支出（都是假数字，仅用于看界面）
  state.loans = [
    { id: 'dl1', name: '示例房贷', balance: 500000, rate: 0.031, monthly: 2178, end: '2055-08' },
  ];
  state.fees = [
    { id: 'df1', name: '物业费', amount: 434.71, cycle: 'month', month: 0 },
    { id: 'df2', name: '取暖费', amount: 2688.90, cycle: 'year', month: 11 },
  ];
}

/* ---------- 小工具 ---------- */
const $  = (sel, root) => (root || document).querySelector(sel);
const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));

const pad2 = n => String(n).padStart(2, '0');
const todayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
};
const ymOf = dateStr => dateStr.slice(0, 7);
const thisYM = () => todayStr().slice(0, 7);

/** 金额 -> 千分位字符串 */
function fmtMoney(n) {
  const neg = n < 0;
  const s = Math.abs(Number(n) || 0).toFixed(2);
  const [i, d] = s.split('.');
  return (neg ? '-' : '') + i.replace(/\B(?=(\d{3})+(?!\d))/g, ',') + '.' + d;
}
/** 紧凑金额，用于图表 */
function fmtShort(n) {
  const v = Number(n) || 0;
  if (v >= 10000) return (v / 10000).toFixed(v >= 100000 ? 0 : 1) + '万';
  if (v >= 1000) return (v / 1000).toFixed(1) + 'k';
  return String(Math.round(v));
}
/** 记账键盘的输入缓冲 -> 显示文本 */
function fmtBuf(buf) {
  if (!buf) return '0';
  const [i, d] = buf.split('.');
  const gi = (i || '0').replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return d === undefined ? gi : gi + '.' + d;
}
function parseBuf(buf) {
  const v = parseFloat(buf || '0');
  return isFinite(v) ? Math.round(v * 100) / 100 : 0;
}

const WEEK = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
/** '2026-10-17' -> '10月17日 周六'，今天/昨天特殊标注 */
function dayLabel(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  const t = todayStr();
  const yest = (() => { const x = new Date(); x.setDate(x.getDate() - 1); return `${x.getFullYear()}-${pad2(x.getMonth() + 1)}-${pad2(x.getDate())}`; })();
  let pre = '';
  if (dateStr === t) pre = '今天 · ';
  else if (dateStr === yest) pre = '昨天 · ';
  return pre + `${m}月${d}日 ${WEEK[dt.getDay()]}`;
}

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

let toastTimer = null;
function toast(msg) {
  const el = $('#toast');
  el.textContent = msg;
  el.classList.add('is-on');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('is-on'), 1700);
}

/* ---------- 弹层管理 ---------- */
const sheetStack = [];
function openSheet(id) {
  const el = $('#' + id);
  if (!el || el.classList.contains('is-on')) return;
  $('#mask').classList.add('is-on');
  el.classList.add('is-on');
  sheetStack.push(id);
}
function closeSheet(id) {
  const target = id || sheetStack[sheetStack.length - 1];
  if (!target) return;
  $('#' + target).classList.remove('is-on');
  const i = sheetStack.indexOf(target);
  if (i > -1) sheetStack.splice(i, 1);
  if (!sheetStack.length) $('#mask').classList.remove('is-on');
}
function closeAllSheets() {
  while (sheetStack.length) closeSheet();
}
$('#mask').addEventListener('click', closeAllSheets);
document.addEventListener('click', ev => {
  const btn = ev.target.closest('[data-close]');
  if (btn) closeSheet(btn.closest('.sheet').id);
});

/* =========================================================
   视图切换
   ========================================================= */
let currentView = 'add';
function switchView(name) {
  currentView = name;
  $$('.view').forEach(v => v.classList.toggle('is-active', v.id === 'view-' + name));
  $$('#tabbar .tab').forEach(t => t.classList.toggle('is-on', t.dataset.view === name));
  if (name === 'list') renderList();
  if (name === 'chart') renderChart();
  if (name === 'wealth') renderWealth();
  if (name === 'me') renderMe();
  renderChips();
}
$('#tabbar').addEventListener('click', ev => {
  const tab = ev.target.closest('.tab');
  if (tab) switchView(tab.dataset.view);
});

/* =========================================================
   记账页
   ========================================================= */
const add = {
  buf: '',
  date: todayStr(),
  note: '',
};

function renderTypeSeg() {
  const type = state.ui.type;
  $('#typeSeg').dataset.type = type;
  $$('#typeSeg .seg-btn').forEach(b => b.classList.toggle('is-on', b.dataset.type === type));
}

function renderCats() {
  const type = state.ui.type;
  const cur = state.ui.cat[type];
  const box = $('#catScroll');
  box.innerHTML = CATEGORIES[type].map(c => `
    <button class="cat${c.k === cur ? ' is-on' : ''}" data-cat="${c.k}">
      <span class="ico" style="background:${c.c}1f">${c.e}</span>
      <span class="nm">${c.n}</span>
    </button>`).join('');
  const on = $('.cat.is-on', box);
  if (on && on.scrollIntoView) {
    on.scrollIntoView({ block: 'nearest', inline: 'center' });
  }
}

function renderAddMeta() {
  const d = $('#metaDate');
  const [, mm, dd] = add.date.split('-');
  d.textContent = add.date === todayStr() ? '今天' : `${Number(mm)}月${Number(dd)}日`;
  d.classList.toggle('has-val', add.date !== todayStr());
  const n = $('#metaNote');
  n.textContent = add.note || '添加备注';
  n.classList.toggle('has-val', !!add.note);
}

function renderAmount() {
  const el = $('#amountText');
  el.textContent = fmtBuf(add.buf);
  el.style.color = add.buf ? '' : '#c2c7cf';
}

function keypadPress(k) {
  if (/^\d$/.test(k)) {
    if (add.buf.replace('.', '').length >= 9) return;
    if (add.buf === '0') add.buf = '';
    add.buf += k;
  } else if (k === 'dot') {
    if (add.buf.includes('.')) return;
    add.buf = (add.buf || '0') + '.';
  } else if (k === 'back') {
    add.buf = add.buf.slice(0, -1);
  } else if (k === 'date') {
    openDatePick();
    return;
  } else if (k === 'note') {
    openNoteEdit();
    return;
  } else if (k === 'save') {
    commitRecord();
    return;
  }
  renderAmount();
}

function commitRecord() {
  const amount = parseBuf(add.buf);
  if (!(amount > 0)) {
    $('#amountText').classList.add('shake');
    setTimeout(() => $('#amountText').classList.remove('shake'), 420);
    toast('先输入金额');
    return;
  }
  const type = state.ui.type;
  state.records.push({
    id: uid(),
    type,
    amount,
    category: state.ui.cat[type],
    date: add.date,
    note: add.note.trim(),
    createdAt: Date.now(),
  });
  save();
  add.buf = '';
  add.note = '';
  add.date = todayStr();
  renderChips();
  renderAmount();
  renderAddMeta();
  flashSaved();
  const okBtn = $('.key-ok');
  okBtn.classList.add('is-done');
  setTimeout(() => okBtn.classList.remove('is-done'), 550);
}

let savedTimer = null;
function flashSaved() {
  const el = $('#amountText');
  el.textContent = '已记下 ✓';
  el.style.color = '#12a45c';
  el.style.fontSize = '30px';
  clearTimeout(savedTimer);
  savedTimer = setTimeout(() => {
    el.style.fontSize = '';
    renderAmount();
  }, 620);
}

$('#typeSeg').addEventListener('click', ev => {
  const btn = ev.target.closest('.seg-btn');
  if (!btn) return;
  state.ui.type = btn.dataset.type;
  save();
  renderTypeSeg();
  renderCats();
});

$('#catScroll').addEventListener('click', ev => {
  const btn = ev.target.closest('.cat');
  if (!btn) return;
  state.ui.cat[state.ui.type] = btn.dataset.cat;
  save();
  renderCats();
});

$('#keypad').addEventListener('click', ev => {
  const key = ev.target.closest('.key');
  if (key) keypadPress(key.dataset.k);
});

$('#metaDate').addEventListener('click', openDatePick);
$('#metaNote').addEventListener('click', openNoteEdit);

/* ---- 日期选择 ---- */
let pendingDate = null;
function openDatePick() {
  pendingDate = add.date;
  $('#pickTitle').textContent = '选择日期';
  const y = new Date();
  const quick = [];
  for (let i = 0; i < 4; i++) {
    const d = new Date(); d.setDate(d.getDate() - i);
    quick.push(`${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`);
  }
  const quickNames = ['今天', '昨天', '前天', '3 天前'];
  $('#pickBody').innerHTML = `
    <div class="pick-grid" style="margin-bottom:14px">
      ${quick.map((q, i) => `<button class="pick-item${q === pendingDate ? ' is-on' : ''}" data-quick="${q}">${quickNames[i]}</button>`).join('')}
    </div>
    <label class="field">
      <span class="field-label">其他日期</span>
      <input class="field-input" type="date" id="pickDateInput" value="${pendingDate}">
    </label>`;
  const inp = $('#pickDateInput');
  if (inp) inp.addEventListener('change', () => {
    if (inp.value) {
      pendingDate = inp.value;
      $$('#pickBody .pick-item').forEach(x => x.classList.toggle('is-on', x.dataset.quick === pendingDate));
    }
  });
  $('#pickOk').dataset.mode = 'date';
  openSheet('sheetPick');
}

/* 快捷日期：绑一次，避免每次打开都叠加监听 */
$('#pickBody').addEventListener('click', ev => {
  const b = ev.target.closest('[data-quick]');
  if (!b) return;
  pendingDate = b.dataset.quick;
  const inp = $('#pickDateInput');
  if (inp) inp.value = pendingDate;
  $$('#pickBody .pick-item').forEach(x => x.classList.toggle('is-on', x.dataset.quick === pendingDate));
});

/* ---- 备注编辑 ---- */
function openNoteEdit() {
  $('#pickTitle').textContent = '备注';
  $('#pickBody').innerHTML = `
    <label class="field">
      <span class="field-label">这条记录的说明（选填）</span>
      <input class="field-input" id="pickNoteInput" type="text" placeholder="例如：和同事吃午饭" value="${escapeAttr(add.note)}">
    </label>`;
  $('#pickOk').dataset.mode = 'note';
  openSheet('sheetPick');
  setTimeout(() => { const i = $('#pickNoteInput'); if (i) i.focus(); }, 260);
}
$('#pickOk').addEventListener('click', () => {
  const mode = $('#pickOk').dataset.mode;
  if (mode === 'date') {
    if (pendingDate) add.date = pendingDate;
    renderAddMeta();
  } else if (mode === 'note') {
    const inp = $('#pickNoteInput');
    add.note = inp ? inp.value : '';
    renderAddMeta();
  }
  closeSheet('sheetPick');
});

function escapeAttr(s) {
  return String(s || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}

/* =========================================================
   明细页
   ========================================================= */
let viewMonth = thisYM();
let listFilter = 'all';

function recordsOfMonth(ym) {
  return state.records
    .filter(r => ymOf(r.date) === ym)
    .sort((a, b) => (a.date === b.date ? b.createdAt - a.createdAt : (a.date < b.date ? 1 : -1)));
}

function sumBy(records, type) {
  return records.reduce((s, r) => s + (r.type === type ? r.amount : 0), 0);
}

function setMonth(delta) {
  const [y, m] = viewMonth.split('-').map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  viewMonth = `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`;
  if (currentView === 'list') renderList();
  else if (currentView === 'chart') renderChart();
}
$$('[data-month]').forEach(b => b.addEventListener('click', () => setMonth(Number(b.dataset.month))));

/** 明细页顶部那条「固定成本」折叠。默认收起，状态记在 state.ui 里。 */
function fixedFoldHTML(ym) {
  const fm = fixedOfMonth(ym);
  if (!state.loans.length && !state.fees.length) {
    return `<div class="fold">
      <div class="fold-head" data-gowealth="1">
        <span class="fold-title">固定成本</span>
        <span class="fold-hint">还没录入，点这里去「负债」添加 ›</span>
      </div>
    </div>`;
  }

  const open = !!state.ui.fixedOpen;
  const lines = [];
  for (const L of state.loans) {
    if (!loanActive(L, ym)) continue;
    lines.push(`<div class="fold-row"><span>${escapeHTML(L.name)}</span>
      <span>¥${fmtMoney(L.monthly)}</span></div>`);
  }
  const mm = Number(ym.slice(5, 7));
  for (const F of state.fees) {
    const amt = Number(F.amount) || 0;
    if (F.cycle === 'year') {
      if (Number(F.month) !== mm) continue;
      lines.push(`<div class="fold-row"><span>${escapeHTML(F.name)}<em>年缴</em></span>
        <span>¥${fmtMoney(amt)}</span></div>`);
    } else {
      lines.push(`<div class="fold-row"><span>${escapeHTML(F.name)}</span>
        <span>¥${fmtMoney(amt)}</span></div>`);
    }
  }
  if (!lines.length) {
    lines.push(`<div class="fold-row"><span>这个月没有固定扣款</span><span>—</span></div>`);
  }

  const flowExp = sumBy(recordsOfMonth(ym), 'expense');
  return `<div class="fold${open ? ' is-open' : ''}">
    <div class="fold-head" data-fold="1">
      <span class="fold-title">固定成本</span>
      <span class="fold-amt">¥${fmtMoney(fm.total)}</span>
      <span class="fold-arrow">${open ? '▾' : '▸'}</span>
    </div>
    ${open ? `<div class="fold-body">
      ${lines.join('')}
      <div class="fold-row fold-total"><span>固定成本合计</span>
        <span>¥${fmtMoney(fm.total)}</span></div>
      <div class="fold-row fold-total"><span>本月实际支出（流水 + 固定）</span>
        <span>¥${fmtMoney(flowExp + fm.total)}</span></div>
    </div>` : ''}
  </div>`;
}

function renderList() {
  const [y, m] = viewMonth.split('-').map(Number);
  $('#listMonth').textContent = `${y}年${m}月`;

  const monthAll = recordsOfMonth(viewMonth);
  const exp = sumBy(monthAll, 'expense');
  const inc = sumBy(monthAll, 'income');

  const rows = listFilter === 'all' ? monthAll : monthAll.filter(r => r.type === listFilter);
  const body = $('#listBody');

  // 统计卡和筛选条放在滚动区里（而不是固定在顶部），
  // 这样五个页面的顶部区高度一致，切换标签时内容不会跳。
  const head = `
    <div class="stat-row">
      <div class="stat-card"><div class="k">支出</div><div class="v v-exp">¥${fmtMoney(exp)}</div></div>
      <div class="stat-card"><div class="k">收入</div><div class="v v-inc">¥${fmtMoney(inc)}</div></div>
      <div class="stat-card"><div class="k">结余</div><div class="v">¥${fmtMoney(inc - exp)}</div></div>
    </div>
    ${fixedFoldHTML(viewMonth)}
    <div class="filters">
      <div class="pill-group">
        <button class="pill${listFilter === 'all' ? ' is-on' : ''}" data-f="all">全部</button>
        <button class="pill${listFilter === 'expense' ? ' is-on' : ''}" data-f="expense">支出</button>
        <button class="pill${listFilter === 'income' ? ' is-on' : ''}" data-f="income">收入</button>
      </div>
    </div>`;

  if (!rows.length) {
    body.innerHTML = head + `<div class="empty"><span class="big">🗒️</span>${
      monthAll.length ? '这个筛选条件下没有记录' : '这个月还没有记录<br>去「记账」记一笔吧'
    }</div>`;
    return;
  }

  // 按日期分组
  const groups = [];
  const map = {};
  for (const r of rows) {
    if (!map[r.date]) { map[r.date] = []; groups.push(r.date); }
    map[r.date].push(r);
  }

  body.innerHTML = head + groups.map(date => {
    const items = map[date];
    const e = sumBy(items, 'expense');
    const i = sumBy(items, 'income');
    const parts = [];
    if (e) parts.push(`支出 ¥${fmtMoney(e)}`);
    if (i) parts.push(`收入 ¥${fmtMoney(i)}`);
    return `
      <div class="day-group">
        <div class="day-head">
          <span class="d-main">${dayLabel(date)}</span>
          <span class="d-sum">${parts.join('　')}</span>
        </div>
        ${items.map(recHTML).join('')}
      </div>`;
  }).join('');
}

function recHTML(r) {
  const info = catInfo(r.type, r.category);
  const sign = r.type === 'expense' ? '-' : '+';
  const color = r.type === 'expense' ? 'var(--exp)' : 'var(--inc)';
  return `
    <div class="rec" data-id="${r.id}">
      <span class="rec-ico" style="background:${info.c}1f">${info.e}</span>
      <span class="rec-mid">
        <span class="rec-cat">${info.n}</span>
        ${r.note ? `<span class="rec-note">${escapeHTML(r.note)}</span>` : ''}
      </span>
      <span class="rec-amt" style="color:${color}">${sign}${fmtMoney(r.amount)}</span>
    </div>`;
}

function escapeHTML(s) {
  return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

$('#listBody').addEventListener('click', ev => {
  const pill = ev.target.closest('.pill');
  if (pill) {
    listFilter = pill.dataset.f;
    renderList();
    return;
  }
  if (ev.target.closest('[data-fold]')) {
    state.ui.fixedOpen = !state.ui.fixedOpen;
    save();
    renderList();
    return;
  }
  if (ev.target.closest('[data-gowealth]')) {
    switchView('wealth');
    return;
  }
  const el = ev.target.closest('.rec');
  if (el) openRecordEdit(el.dataset.id);
});

/* =========================================================
   记录编辑
   ========================================================= */
let editTarget = null;
let editDraft = null;
function openRecordEdit(id) {
  const r = state.records.find(x => x.id === id);
  if (!r) return;
  editTarget = r;
  // 用草稿存改动，点「取消」时不会偷偷改到原记录
  editDraft = { type: r.type, amount: r.amount, date: r.date, category: r.category, note: r.note || '' };
  $('#editAmount').value = r.amount.toFixed(2);
  $('#editDate').value = r.date;
  $('#editNote').value = r.note || '';
  renderEditCats();
  openSheet('sheetRecord');
}

function renderEditCats() {
  if (!editDraft) return;
  $('#editCats').innerHTML = CATEGORIES[editDraft.type].map(c => `
    <button class="cat${c.k === editDraft.category ? ' is-on' : ''}" data-cat="${c.k}">
      <span class="ico" style="background:${c.c}1f">${c.e}</span>
      <span class="nm">${c.n}</span>
    </button>`).join('');
}

$('#editCats').addEventListener('click', ev => {
  const b = ev.target.closest('.cat');
  if (!b || !editDraft) return;
  editDraft.category = b.dataset.cat;
  $$('#editCats .cat').forEach(x => x.classList.toggle('is-on', x === b));
});

$('#editSave').addEventListener('click', () => {
  if (!editTarget || !editDraft) return;
  const amt = parseFloat($('#editAmount').value);
  if (!(amt > 0)) { toast('金额不对'); return; }
  editTarget.amount = Math.round(amt * 100) / 100;
  editTarget.date = $('#editDate').value || editTarget.date;
  editTarget.note = $('#editNote').value.trim();
  editTarget.category = editDraft.category;
  save();
  closeSheet('sheetRecord');
  toast('已保存');
  refreshCurrentView();
});

$('#editDelete').addEventListener('click', () => {
  if (!editTarget) return;
  if (!confirm('确定删除这条记录？删除后无法恢复。')) return;
  state.records = state.records.filter(x => x.id !== editTarget.id);
  save();
  closeSheet('sheetRecord');
  editTarget = null;
  editDraft = null;
  toast('已删除');
  refreshCurrentView();
});

function refreshCurrentView() {
  if (currentView === 'list') renderList();
  else if (currentView === 'chart') renderChart();
  else if (currentView === 'wealth') renderWealth();
  else if (currentView === 'me') renderMe();
  renderChips();
}

/* =========================================================
   图表页
   ========================================================= */
/** 某年 1 月到 uptoMonth 月之间，手记流水的支出合计 */
function flowExpenseBetween(year, uptoMonth) {
  let sum = 0;
  for (const r of state.records) {
    if (r.type !== 'expense') continue;
    const [y, m] = ymOf(r.date).split('-').map(Number);
    if (y === year && m <= uptoMonth) sum += r.amount;
  }
  return sum;
}

function renderChart() {
  const [y, m] = viewMonth.split('-').map(Number);
  $('#chartMonth').textContent = `${y}年${m}月`;

  const month = recordsOfMonth(viewMonth);
  const exp = sumBy(month, 'expense');
  const inc = sumBy(month, 'income');

  /* --- 分类排行 --- */
  const byCat = {};
  for (const r of month) {
    if (r.type !== 'expense') continue;
    byCat[r.category] = (byCat[r.category] || 0) + r.amount;
  }
  const ranked = Object.entries(byCat).sort((a, b) => b[1] - a[1]);
  const max = ranked.length ? ranked[0][1] : 1;

  const rankHTML = ranked.length ? ranked.map(([k, v]) => {
    const info = catInfo('expense', k);
    const pct = exp ? (v / exp * 100) : 0;
    return `
      <div class="bar-row">
        <span class="bar-cat"><span class="e">${info.e}</span>${info.n}</span>
        <span class="bar-track"><span class="bar-fill" style="width:${(v / max * 100).toFixed(1)}%;background:${info.c}"></span></span>
        <span class="bar-val"><b>${fmtMoney(v)}</b><i>${pct.toFixed(0)}%</i></span>
      </div>`;
  }).join('') : `<div class="empty" style="padding:28px 0">本月还没有支出记录</div>`;

  /* --- 近 6 个月趋势 --- */
  const trend = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(y, m - 1 - i, 1);
    const key = `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`;
    const recs = state.records.filter(r => ymOf(r.date) === key);
    trend.push({ key, label: `${d.getMonth() + 1}月`, expense: sumBy(recs, 'expense') });
  }

  const avg = (() => {
    // 只算「有支出」的天数，跟标签保持一致
    const days = new Set(month.filter(r => r.type === 'expense').map(r => r.date)).size;
    return days ? exp / days : 0;
  })();

  /* --- 年度总支出：这才是"我一年花多少"的答案 --- */
  const vy = y;
  const nowD = new Date();
  const upto = vy === nowD.getFullYear() ? nowD.getMonth() + 1 : 12;
  const flowY = flowExpenseBetween(vy, upto);
  const fixedY = fixedOfYearUpto(vy, upto);
  const totalY = flowY + fixedY;
  const hasFixed = state.loans.length || state.fees.length;

  const yearPanel = `
    <div class="panel">
      <div class="panel-title"><span>${vy} 年总支出</span><span class="sub">1–${upto} 月</span></div>
      <div class="kv-row"><span class="k">日常（手记的流水）</span><span class="v">¥${fmtMoney(flowY)}</span></div>
      <div class="kv-row"><span class="k">固定（房贷 / 物业 / 保险等）</span><span class="v">¥${fmtMoney(fixedY)}</span></div>
      <div class="kv-row" style="border-top:1px solid var(--line);margin-top:6px;padding-top:8px">
        <span class="k" style="color:var(--text);font-weight:600">合计</span>
        <span class="v" style="font-size:17px">¥${fmtMoney(totalY)}</span>
      </div>
      ${upto > 0 ? `<div class="kv-row"><span class="k">推算全年</span>
        <span class="v">约 ¥${fmtMoney(flowY / upto * 12 + fixedOfYear(vy))}</span></div>
        <p class="hint" style="margin-top:2px">日常按已发生的比例年化；固定成本是确定的，直接取全年计划。</p>` : ''}
      ${hasFixed ? '' : `<p class="hint" style="margin-top:8px;color:#b26a00">
        ⚠️ 还没录入固定成本，上面的「固定」是 0。去「负债」录一次，
        年支出才是真实的——旧账本漏掉的正是这一块。</p>`}
    </div>`;

  $('#chartBody').innerHTML = yearPanel + `
    <div class="panel">
      <div class="panel-title"><span>本月总览</span><span class="sub">近 6 个月趋势见下</span></div>
      <div class="stat-row" style="padding:0">
        <div style="flex:1"><div class="k" style="font-size:12px;color:var(--muted)">支出</div>
          <div class="v v-exp" style="font-size:18px;font-weight:700">¥${fmtMoney(exp)}</div></div>
        <div style="flex:1"><div class="k" style="font-size:12px;color:var(--muted)">收入</div>
          <div class="v v-inc" style="font-size:18px;font-weight:700">¥${fmtMoney(inc)}</div></div>
        <div style="flex:1"><div class="k" style="font-size:12px;color:var(--muted)">有支出日均</div>
          <div class="v" style="font-size:18px;font-weight:700">¥${fmtMoney(avg)}</div></div>
      </div>
    </div>

    <div class="panel">
      <div class="panel-title"><span>支出分类</span><span class="sub">共 ${ranked.length} 类</span></div>
      ${rankHTML}
    </div>

    <div class="panel">
      <div class="panel-title"><span>近 6 个月支出</span></div>
      ${trendSVG(trend)}
    </div>`;
}

function trendSVG(trend) {
  const W = 320, H = 148, padL = 6, padR = 6, padT = 24, padB = 26;
  const max = Math.max(...trend.map(t => t.expense), 1);
  const n = trend.length;
  const slot = (W - padL - padR) / n;
  const bw = Math.min(30, slot * 0.46);
  const baseY = H - padB;
  const topY = padT;

  const bars = trend.map((t, i) => {
    const cx = padL + slot * i + slot / 2;
    const h = t.expense > 0 ? Math.max(3, (t.expense / max) * (baseY - topY)) : 0;
    const y = baseY - h;
    const isCur = t.key === viewMonth;
    return `
      <rect x="${(cx - bw / 2).toFixed(1)}" y="${y.toFixed(1)}" width="${bw.toFixed(1)}" height="${h.toFixed(1)}"
            rx="4" fill="${isCur ? '#f4553d' : '#ffd0c8'}"/>
      ${t.expense > 0 ? `<text class="tvalue" x="${cx.toFixed(1)}" y="${(y - 6).toFixed(1)}">${fmtShort(t.expense)}</text>` : ''}
      <text class="tlabel" x="${cx.toFixed(1)}" y="${H - 8}">${t.label}</text>`;
  }).join('');

  return `<svg class="trend" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet">
    <line class="grid-line" x1="${padL}" y1="${baseY}" x2="${W - padR}" y2="${baseY}"/>
    ${bars}
  </svg>`;
}

/* =========================================================
   负债：债务、固定支出与本月支出

   日常记账只覆盖「随手花掉的钱」。房贷、物业、取暖、保险这些每月/每年
   固定要交的，一次录进来、之后自动计入年度支出——否则年度支出会被
   严重低估（这是旧账本最大的问题：8.6 万/年的房贷车贷一条都没记）。
   ========================================================= */

/** 某笔贷款在某年某月是否处于还款期 */
function loanActive(loan, ym) {
  if (loan.start && ym < loan.start) return false;
  if (loan.end && ym > loan.end) return false;
  return true;
}

/** 某个月的固定支出，拆成：贷款月供 / 每月费用 / 当月缴纳的年度费用 */
function fixedOfMonth(ym) {
  let loan = 0, mfee = 0, yfee = 0;
  for (const L of state.loans) {
    if (loanActive(L, ym)) loan += Number(L.monthly) || 0;
  }
  const m = Number(ym.slice(5, 7));
  for (const F of state.fees) {
    const amt = Number(F.amount) || 0;
    if (F.cycle === 'year') {
      if (Number(F.month) === m) yfee += amt;
    } else {
      mfee += amt;
    }
  }
  return { loan, mfee, yfee, total: loan + mfee + yfee };
}

function fixedOfYear(year) {
  let sum = 0;
  for (let m = 1; m <= 12; m++) sum += fixedOfMonth(`${year}-${pad2(m)}`).total;
  return sum;
}

/** 今年到某月为止的固定成本，用来和同期流水对比 */
function fixedOfYearUpto(year, uptoMonth) {
  let sum = 0;
  for (let m = 1; m <= uptoMonth; m++) sum += fixedOfMonth(`${year}-${pad2(m)}`).total;
  return sum;
}

function loansSummary() {
  let balance = 0, monthly = 0, interest = 0;
  for (const L of state.loans) {
    balance += Number(L.balance) || 0;
    monthly += Number(L.monthly) || 0;
    interest += (Number(L.balance) || 0) * (Number(L.rate) || 0) / 12;
  }
  return { balance, monthly, interest, principal: monthly - interest };
}

/** 按当前月供还要多少期才还得完；月供不够覆盖利息就返回 Infinity */
function monthsToPayoff(balance, rate, monthly) {
  if (!(balance > 0) || !(monthly > 0)) return null;
  const r = rate / 12;
  if (r <= 0) return balance / monthly;
  if (monthly <= balance * r) return Infinity;
  return -Math.log(1 - balance * r / monthly) / Math.log(1 + r);
}

/** 按当前月供一直还到第 months 期时，还剩多少本金 */
function tailAt(balance, rate, monthly, months) {
  const r = rate / 12;
  if (r <= 0) return Math.max(0, balance - monthly * months);
  const f = Math.pow(1 + r, months);
  return balance * f - monthly * (f - 1) / r;
}

function monthsUntil(ym) {
  if (!ym) return null;
  const [y, m] = String(ym).split('-').map(Number);
  const now = new Date();
  return (y - now.getFullYear()) * 12 + (m - (now.getMonth() + 1));
}

/** '2026-10' -> '2026年10月' */
function ymLabel(ym) {
  const [y, m] = String(ym).split('-');
  return `${y}年${Number(m)}月`;
}

function pctText(rate) {
  return (rate * 100).toFixed(3).replace(/0+$/, '').replace(/\.$/, '');
}

function renderWealth() {
  const now = new Date();
  const ym = thisYM();
  const fm = fixedOfMonth(ym);
  const flow = sumBy(recordsOfMonth(ym), 'expense');
  const year = now.getFullYear();
  const s = loansSummary();
  const out = ['<p class="page-sub">每月支出与欠款</p>'];

  out.push(`
    <div class="hero">
      <div class="h-k">本月支出</div>
      <div class="h-v">¥${fmtMoney(flow + fm.total)}</div>
      <div class="h-sub">本月固定 ¥${fmtMoney(fm.total)} · 已合并日常流水</div>
      <div class="hero-grid is-three">
        <div><div class="k">本月流水</div><div class="v">¥${fmtShort(flow)}</div></div>
        <div><div class="k">每年固定</div><div class="v">¥${fmtShort(fixedOfYear(year))}</div></div>
        <div><div class="k">负债总额</div><div class="v">¥${fmtShort(s.balance)}</div></div>
      </div>
    </div>`);

  /* ---- 债务 ---- */
  out.push(`<div class="grp-title">债务 · ${state.loans.length} 笔</div>`);
  if (!state.loans.length) {
    out.push(`<div class="empty" style="padding:22px 0">还没有录入贷款</div>`);
  }
  for (const L of state.loans) {
    const bal = Number(L.balance) || 0;
    const rate = Number(L.rate) || 0;
    const monthly = Number(L.monthly) || 0;
    const interest = bal * rate / 12;
    const principal = monthly - interest;
    const pctInt = monthly > 0 ? Math.max(0, Math.min(100, interest / monthly * 100)) : 0;

    const meta = [`余额 ¥${fmtMoney(bal)}`, `年利率 ${pctText(rate)}%`];
    if (L.end) meta.push(`到期 ${ymLabel(L.end)}`);

    let alert = '';
    const n = monthsToPayoff(bal, rate, monthly);
    const left = monthsUntil(L.end);
    if (n === Infinity) {
      alert = '月供还不够覆盖利息，这笔贷款按现在的还法永远还不完。';
    } else if (n && L.end && left > 0 && n > left * 1.02) {
      const tail = tailAt(bal, rate, monthly, left);
      alert = `按现在的月供要 ${(n / 12).toFixed(1)} 年才还完，比到期日晚。到 ${ymLabel(L.end)} 时还剩约 ¥${fmtMoney(tail)} 要一次性结清。`;
    }

    out.push(`
      <div class="item" data-loan="${L.id}">
        <div class="item-top">
          <span class="item-name">${escapeHTML(L.name || '未命名')}</span>
          <span class="item-amt">¥${fmtMoney(monthly)}<span style="font-size:11px;color:var(--muted);font-weight:400">/月</span></span>
        </div>
        <div class="item-meta">${meta.join(' · ')}</div>
        ${monthly > 0 ? `
          <div class="split">
            <i class="s-int" style="width:${pctInt.toFixed(1)}%"></i>
            <i class="s-pri" style="width:${(100 - pctInt).toFixed(1)}%"></i>
          </div>
          <div class="legend">
            <span><em style="background:#f4553d"></em>利息 ¥${fmtMoney(interest)}</span>
            <span><em style="background:#12a45c"></em>本金 ¥${fmtMoney(principal)}</span>
          </div>` : ''}
        ${alert ? `<div class="warn" style="margin:10px 0 0">⚠️ ${alert}</div>` : ''}
      </div>`);
  }
  out.push(`<button class="add-btn" data-add="loan">＋ 添加一笔贷款</button>`);

  /* ---- 固定支出 ---- */
  out.push(`<div class="grp-title" style="margin-top:16px">固定支出 · ${state.fees.length} 项</div>`);
  if (!state.fees.length) {
    out.push(`<div class="empty" style="padding:22px 0">还没有录入固定支出</div>`);
  }
  for (const F of state.fees) {
    const amt = Number(F.amount) || 0;
    const isYear = F.cycle === 'year';
    const per = isYear
      ? `${Number(F.month) || 1} 月缴纳 · 折合每月 ¥${fmtMoney(amt / 12)}`
      : `每月缴纳 · 折合每年 ¥${fmtMoney(amt * 12)}`;
    out.push(`
      <div class="item" data-fee="${F.id}">
        <div class="item-top">
          <span class="item-name">${escapeHTML(F.name || '未命名')}</span>
          <span class="item-amt">¥${fmtMoney(amt)}<span style="font-size:11px;color:var(--muted);font-weight:400">/${isYear ? '年' : '月'}</span></span>
        </div>
        <div class="item-meta">${per}</div>
      </div>`);
  }
  out.push(`<button class="add-btn" data-add="fee">＋ 添加一项固定支出</button>`);
  out.push(`<p class="hint">日常流水会自动汇总到顶部；这里的固定支出不要再在记账页重复录入。录一次即可，之后自动计入年度支出。</p>`);

  $('#wealthBody').innerHTML = out.join('');
}

$('#wealthBody').addEventListener('click', ev => {
  const loan = ev.target.closest('[data-loan]');
  if (loan) { openLoanForm(loan.dataset.loan); return; }
  const fee = ev.target.closest('[data-fee]');
  if (fee) { openFeeForm(fee.dataset.fee); return; }
  const add = ev.target.closest('[data-add]');
  if (add) add.dataset.add === 'loan' ? openLoanForm() : openFeeForm();
});

/* ---- 编辑表单 ---- */
let itemKind = null;   // 'loan' | 'fee'
let itemId = null;

function openLoanForm(id) {
  itemKind = 'loan';
  itemId = id || null;
  const L = id ? state.loans.find(x => x.id === id) : null;
  $('#itemTitle').textContent = L ? '编辑贷款' : '添加贷款';
  $('#itemBody').innerHTML = `
    <label class="field"><span class="field-label">名称</span>
      <input class="field-input" id="f-name" type="text" placeholder="例如：天津房贷" value="${escapeAttr(L ? L.name : '')}"></label>
    <label class="field"><span class="field-label">当前剩余本金（元）</span>
      <input class="field-input" id="f-balance" type="text" inputmode="decimal" value="${L ? num(L.balance) : ''}"></label>
    <label class="field"><span class="field-label">年利率（% ，填 3.1 就是 3.1%）</span>
      <input class="field-input" id="f-rate" type="text" inputmode="decimal" value="${L ? num((Number(L.rate) || 0) * 100) : ''}"></label>
    <label class="field"><span class="field-label">每月还款（元）</span>
      <input class="field-input" id="f-monthly" type="text" inputmode="decimal" value="${L ? num(L.monthly) : ''}"></label>
    <label class="field"><span class="field-label">到期月份（选填，用来检查还得完还不上）</span>
      <input class="field-input" id="f-end" type="month" value="${L && L.end ? L.end : ''}"></label>
    <p class="hint">利息和本金按「余额 × 月利率」自动拆分，你只要在每次还款后更新剩余本金。</p>
    ${L ? `<button class="danger-btn" id="f-del">删除这笔贷款</button>` : ''}`;
  openSheet('sheetItem');
}

function openFeeForm(id) {
  itemKind = 'fee';
  itemId = id || null;
  const F = id ? state.fees.find(x => x.id === id) : null;
  const cycle = F ? F.cycle : 'year';
  $('#itemTitle').textContent = F ? '编辑固定支出' : '添加固定支出';
  $('#itemBody').innerHTML = `
    <label class="field"><span class="field-label">名称</span>
      <input class="field-input" id="f-name" type="text" placeholder="例如：物业费、取暖费、保险" value="${escapeAttr(F ? F.name : '')}"></label>
    <label class="field"><span class="field-label">金额（元）</span>
      <input class="field-input" id="f-amount" type="text" inputmode="decimal" value="${F ? num(F.amount) : ''}"></label>
    <div class="field"><span class="field-label">缴纳频率</span>
      <div class="form-seg" id="f-cycle">
        <button data-c="month"${cycle === 'month' ? ' class="is-on"' : ''}>每月</button>
        <button data-c="year"${cycle === 'year' ? ' class="is-on"' : ''}>每年</button>
      </div></div>
    <label class="field" id="f-month-wrap"${cycle === 'month' ? ' style="display:none"' : ''}>
      <span class="field-label">每年几月缴纳</span>
      <input class="field-input" id="f-month" type="number" min="1" max="12" value="${F && F.month ? F.month : 11}"></label>
    ${F ? `<button class="danger-btn" id="f-del">删除这项费用</button>` : ''}`;
  $('#f-cycle').addEventListener('click', ev => {
    const b = ev.target.closest('button');
    if (!b) return;
    $$('#f-cycle button').forEach(x => x.classList.toggle('is-on', x === b));
    $('#f-month-wrap').style.display = b.dataset.c === 'year' ? '' : 'none';
  });
  openSheet('sheetItem');
}

function num(v) {
  const n = Number(v);
  if (!isFinite(n)) return '';
  return String(Math.round(n * 100) / 100);
}

$('#itemSave').addEventListener('click', () => {
  const nameEl = $('#f-name');
  const name = nameEl ? nameEl.value.trim() : '';
  if (!name) { toast('先填个名称'); return; }

  if (itemKind === 'loan') {
    const balance = parseFloat($('#f-balance').value);
    const monthly = parseFloat($('#f-monthly').value);
    const ratePct = parseFloat($('#f-rate').value);
    if (!(balance >= 0)) { toast('剩余本金填一下'); return; }
    if (!(monthly >= 0)) { toast('每月还款填一下'); return; }
    const rec = {
      id: itemId || uid(),
      name,
      balance: Math.round(balance * 100) / 100,
      rate: isFinite(ratePct) ? ratePct / 100 : 0,
      monthly: Math.round(monthly * 100) / 100,
      end: $('#f-end').value || '',
    };
    if (itemId) {
      const i = state.loans.findIndex(x => x.id === itemId);
      if (i > -1) state.loans[i] = rec;
    } else {
      state.loans.push(rec);
    }
  } else {
    const amount = parseFloat($('#f-amount').value);
    if (!(amount > 0)) { toast('金额填一下'); return; }
    const onBtn = $('#f-cycle button.is-on');
    const cycle = onBtn ? onBtn.dataset.c : 'year';
    const rec = {
      id: itemId || uid(),
      name,
      amount: Math.round(amount * 100) / 100,
      cycle,
      month: cycle === 'year' ? Math.min(12, Math.max(1, parseInt($('#f-month').value, 10) || 1)) : 0,
    };
    if (itemId) {
      const i = state.fees.findIndex(x => x.id === itemId);
      if (i > -1) state.fees[i] = rec;
    } else {
      state.fees.push(rec);
    }
  }
  save();
  closeSheet('sheetItem');
  renderWealth();
  toast('已保存');
});

$('#itemBody').addEventListener('click', ev => {
  if (!ev.target.closest('#f-del')) return;
  const isLoan = itemKind === 'loan';
  if (!confirm(`确定删除${isLoan ? '这笔贷款' : '这项费用'}？`)) return;
  if (isLoan) state.loans = state.loans.filter(x => x.id !== itemId);
  else state.fees = state.fees.filter(x => x.id !== itemId);
  save();
  closeSheet('sheetItem');
  renderWealth();
  toast('已删除');
});

/* =========================================================
   我的
   ========================================================= */
function renderMe() {
  const recs = state.records;
  const days = new Set(recs.map(r => r.date)).size;
  const totalExp = sumBy(recs, 'expense');
  const totalInc = sumBy(recs, 'income');
  const thisMonth = recordsOfMonth(thisYM());
  const monthExp = sumBy(thisMonth, 'expense');

  $('#meBody').innerHTML = `
    <div class="panel">
      <div class="panel-title"><span>总览</span></div>
      <div class="stat-row" style="padding:0;flex-wrap:wrap;gap:10px">
        <div style="flex:1 1 40%">
          <div style="font-size:12px;color:var(--muted)">累计支出</div>
          <div class="v-exp" style="font-size:19px;font-weight:700">¥${fmtMoney(totalExp)}</div>
        </div>
        <div style="flex:1 1 40%">
          <div style="font-size:12px;color:var(--muted)">累计收入</div>
          <div class="v-inc" style="font-size:19px;font-weight:700">¥${fmtMoney(totalInc)}</div>
        </div>
        <div style="flex:1 1 40%">
          <div style="font-size:12px;color:var(--muted)">共记录</div>
          <div style="font-size:19px;font-weight:700">${recs.length} 笔</div>
        </div>
        <div style="flex:1 1 40%">
          <div style="font-size:12px;color:var(--muted)">记账天数</div>
          <div style="font-size:19px;font-weight:700">${days} 天</div>
        </div>
      </div>
      <div style="margin-top:12px;padding-top:12px;border-top:1px solid var(--line);font-size:13px;color:var(--sub)">
        本月已支出 <b style="color:var(--exp)">¥${fmtMoney(monthExp)}</b>
      </div>
      ${state.loans.length || state.fees.length ? `
      <div style="margin-top:8px;font-size:13px;color:var(--sub);line-height:1.9">
        负债总额 <b>¥${fmtMoney(loansSummary().balance)}</b>　·　
        每年固定成本 <b>¥${fmtMoney(fixedOfYear(new Date().getFullYear()))}</b>
      </div>` : `
      <div style="margin-top:8px;font-size:13px;color:#b26a00">
        还没录入固定成本。房贷这类每月必须交的钱不录进来，年度支出会少掉一大块——去「负债」录一下。
      </div>`}
    </div>

    <div class="sec">
      <div class="grp-title">数据</div>
      <div class="card-list">
        <button class="row" data-act="export-json">
          <span class="row-l"><span class="row-ico">⬇️</span>导出备份（JSON）</span><span class="row-r">›</span>
        </button>
        <button class="row" data-act="export-csv">
          <span class="row-l"><span class="row-ico">📊</span>导出表格（CSV）</span><span class="row-r">›</span>
        </button>
        <button class="row" data-act="import-json">
          <span class="row-l"><span class="row-ico">⬆️</span>导入备份</span><span class="row-r">›</span>
        </button>
        <button class="row" data-act="clear">
          <span class="row-l"><span class="row-ico">🗑️</span><span style="color:#e5484d">清空所有数据</span></span><span class="row-r">›</span>
        </button>
      </div>
      ${storageOK ? '' : `<p class="hint" style="color:#e5484d">⚠️ 当前浏览器不允许本地存储，数据只保留在内存里，刷新会丢失。建议用 <code>./start.sh</code> 启动后访问，或换用 Chrome / Safari。</p>`}
    </div>

    <div class="sec">
      <div class="grp-title">关于</div>
      <div class="card-list">
        <div class="row"><span class="row-l"><span class="row-ico">🔒</span>数据位置</span><span class="row-r">仅本机浏览器</span></div>
        <div class="row"><span class="row-l"><span class="row-ico">💾</span>存储方式</span><span class="row-r">localStorage</span></div>
        <div class="row"><span class="row-l"><span class="row-ico">📦</span>版本</span><span class="row-r">v1.0</span></div>
      </div>
      <p class="hint">换手机或换浏览器时，用「导出备份」把数据存成文件，到新设备上再「导入备份」就能恢复。建议每月导出一次。</p>
    </div>`;
}

$('#meBody').addEventListener('click', ev => {
  const row = ev.target.closest('[data-act]');
  if (!row) return;
  const act = row.dataset.act;
  if (act === 'export-json') exportJSON();
  else if (act === 'export-csv') exportCSV();
  else if (act === 'import-json') openImport();
  else if (act === 'clear') clearAll();
});

/* ---- 导出 ---- */
function download(filename, text, mime) {
  const blob = new Blob([text], { type: mime || 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

function exportJSON() {
  if (!state.records.length && !state.loans.length && !state.fees.length) {
    toast('还没有数据可导出');
    return;
  }
  const name = `账本备份-${todayStr()}.json`;
  download(name, JSON.stringify(state, null, 2));
  toast('已导出 ' + name);
}

function exportCSV() {
  if (!state.records.length) { toast('还没有数据可导出'); return; }
  const head = ['日期', '类型', '分类', '金额', '备注'];
  const lines = [head.join(',')];
  const sorted = state.records.slice().sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.createdAt - b.createdAt));
  for (const r of sorted) {
    const info = catInfo(r.type, r.category);
    const row = [r.date, r.type === 'expense' ? '支出' : '收入', info.n, r.amount.toFixed(2), r.note || ''];
    lines.push(row.map(cell => {
      const s = String(cell);
      return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
    }).join(','));
  }
  // BOM 让 Excel 正确识别 UTF-8
  download(`账本-${todayStr()}.csv`, '\ufeff' + lines.join('\r\n'), 'text/csv;charset=utf-8');
  toast('已导出 CSV');
}

/* ---- 导入 ---- */
function openImport() {
  $('#dataTitle').textContent = '导入备份';
  $('#dataEditor').value = '';
  $('#dataHint').textContent = '把 JSON 内容整段粘贴到这里，然后点「确定」。'
    + '流水会追加（同 id 自动跳过）；贷款和固定支出按名称匹配——已存在的更新余额，不存在的添加。所以重复导入同一份不会产生重复项。';
  $('#dataOk').classList.remove('is-hidden');
  $('#dataOk').dataset.mode = 'import';
  openSheet('sheetData');
}

/* 选文件导入：手机上比粘贴一大段 JSON 现实得多 */
$('#dataPickFile').addEventListener('click', () => {
  const input = $('#dataFile');
  if (input) input.click();
});

$('#dataFile').addEventListener('change', ev => {
  const file = ev.target.files && ev.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    $('#dataEditor').value = String(reader.result || '');
    toast('已读取，点「确定」完成导入');
  };
  reader.onerror = () => toast('读取失败');
  reader.readAsText(file);
  ev.target.value = '';   // 允许重复选同一个文件
});

$('#dataOk').addEventListener('click', () => {
  const mode = $('#dataOk').dataset.mode;
  if (mode !== 'import') return;
  let data;
  try {
    data = JSON.parse($('#dataEditor').value);
  } catch (err) {
    toast('JSON 格式不对，请检查');
    return;
  }
  const isBare = Array.isArray(data);
  const records = isBare ? data : (data && Array.isArray(data.records) ? data.records : []);
  const loans = !isBare && data && Array.isArray(data.loans) ? data.loans : [];
  const fees = !isBare && data && Array.isArray(data.fees) ? data.fees : [];

  if (!records.length && !loans.length && !fees.length) {
    toast('没找到可导入的内容');
    return;
  }

  /* 流水：按 id 去重后追加 */
  const exist = new Set(state.records.map(r => r.id));
  let added = 0;
  for (const r of records) {
    if (!r || typeof r.amount !== 'number' || !r.date) continue;
    if (r.id && exist.has(r.id)) continue;
    state.records.push({
      id: r.id || uid(),
      type: r.type === 'income' ? 'income' : 'expense',
      amount: Math.round(r.amount * 100) / 100,
      category: r.category || 'other',
      date: String(r.date).slice(0, 10),
      note: r.note || '',
      createdAt: r.createdAt || Date.now(),
    });
    added++;
  }

  /* 债务：同名则更新（方便你只改余额后重新导入），否则新增 */
  let loanNew = 0, loanUpd = 0;
  for (const L of loans) {
    if (!L || !L.name) continue;
    const cur = state.loans.find(x => x.name === L.name);
    const val = {
      balance: Math.round((Number(L.balance) || 0) * 100) / 100,
      rate: Number(L.rate) || 0,
      monthly: Math.round((Number(L.monthly) || 0) * 100) / 100,
      end: L.end || '',
    };
    if (cur) { Object.assign(cur, val); loanUpd++; }
    else { state.loans.push(Object.assign({ id: L.id || uid(), name: L.name }, val)); loanNew++; }
  }

  /* 固定支出：同样按名称匹配 */
  let feeNew = 0, feeUpd = 0;
  for (const F of fees) {
    if (!F || !F.name) continue;
    const cur = state.fees.find(x => x.name === F.name);
    const val = {
      amount: Math.round((Number(F.amount) || 0) * 100) / 100,
      cycle: F.cycle === 'month' ? 'month' : 'year',
      month: Math.min(12, Math.max(0, parseInt(F.month, 10) || 0)),
    };
    if (cur) { Object.assign(cur, val); feeUpd++; }
    else { state.fees.push(Object.assign({ id: F.id || uid(), name: F.name }, val)); feeNew++; }
  }

  save();
  closeSheet('sheetData');
  const parts = [];
  if (added) parts.push(`${added} 条流水`);
  if (loanNew) parts.push(`${loanNew} 笔贷款`);
  if (loanUpd) parts.push(`更新 ${loanUpd} 笔贷款`);
  if (feeNew) parts.push(`${feeNew} 项费用`);
  if (feeUpd) parts.push(`更新 ${feeUpd} 项费用`);
  toast(parts.length ? `已导入：${parts.join('、')}` : '没有新增内容');
  refreshCurrentView();
});

/* ---- 清空 ---- */
function clearAll() {
  if (!state.records.length) { toast('本来就没有数据'); return; }
  if (!confirm(`确定清空全部 ${state.records.length} 条记录？\n清空后无法恢复，建议先导出备份。`)) return;
  if (!confirm('再确认一次：真的要清空吗？')) return;
  state.records = [];
  save();
  toast('已清空');
  renderMe();
  renderChips();
}

/* =========================================================
   键盘支持（电脑上也能快速记账）
   ========================================================= */
document.addEventListener('keydown', ev => {
  if (sheetStack.length) {
    if (ev.key === 'Escape') closeAllSheets();
    return;
  }
  if (currentView !== 'add') return;
  const tag = (ev.target.tagName || '').toLowerCase();
  if (tag === 'input' || tag === 'textarea') return;

  if (/^\d$/.test(ev.key)) { keypadPress(ev.key); ev.preventDefault(); }
  else if (ev.key === '.' || ev.key === '。') { keypadPress('dot'); ev.preventDefault(); }
  else if (ev.key === 'Backspace') { keypadPress('back'); ev.preventDefault(); }
  else if (ev.key === 'Enter') { keypadPress('save'); ev.preventDefault(); }
  else if (ev.key === 'Escape') {
    add.buf = ''; add.note = ''; renderAmount(); renderAddMeta();
  }
});

/* =========================================================
   顶部右侧的简介胶囊
   每页显示该页最关键的那一个数，让五个页面的顶部长得一样。
   ========================================================= */
function renderChips() {
  // 记账：今天花了多少
  const t = todayStr();
  let todayExp = 0;
  for (const r of state.records) {
    if (r.type === 'expense' && r.date === t) todayExp += r.amount;
  }
  const a = $('#chipAdd');
  if (a) a.textContent = `今天 ¥${fmtMoney(todayExp)}`;

  // 负债：欠款总额
  const w = $('#chipWealth');
  if (w) {
    const total = loansSummary().balance;
    w.textContent = total > 0 ? `欠款 ¥${fmtShort(total)}` : '欠款 —';
  }

  // 我的：一共记了多少笔
  const m = $('#chipMe');
  if (m) m.textContent = `共 ${state.records.length} 笔`;
}

/* =========================================================
   启动
   ========================================================= */

/* 离线缓存：需要 HTTPS 或 localhost，局域网 http 下会自动跳过 */
function registerSW() {
  if (!('serviceWorker' in navigator)) return;
  const secure = location.protocol === 'https:' ||
                 location.hostname === 'localhost' ||
                 location.hostname === '127.0.0.1';
  if (!secure) return;
  navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' })
    .then(reg => reg.update())
    .catch(err => {
      console.warn('离线缓存注册失败（不影响使用）：', err);
    });
}

function boot() {
  load();
  add.date = todayStr();

  const params = new URLSearchParams(location.search);
  if (params.get('demo') === '1') seedDemo();

  renderTypeSeg();
  renderCats();
  renderAddMeta();
  renderAmount();

  const want = params.get('view');
  switchView(['add', 'list', 'wealth', 'chart', 'me'].includes(want) ? want : 'add');

  if (demoMode) {
    $('#tabbar') && toast('预览模式：示例数据不会保存');
  }

  registerSW();
}
boot();
