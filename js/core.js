/* ============================================================
 * 核心：状态 / 存档 / 工具 / 时间推进
 * ==========================================================*/
(function () {
  'use strict';

  const D = G.DATA;
  const SAVE_KEY = 'dange_save_v1';
  const SAVE_VER = 2;      // 1 = 炼气分九层的旧体系，2 = 炼气期单层

  /* ---------------- 随机与工具 ---------------- */
  const U = {
    rnd(a, b) { return Math.floor(Math.random() * (b - a + 1)) + a; },
    rndf(a, b) { return Math.random() * (b - a) + a; },
    pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; },
    chance(p) { return Math.random() < p; },
    clamp(v, a, b) { return Math.max(a, Math.min(b, v)); },
    // 原地打乱并返回自身（勿改成返回副本：调用处很容易忘记接收返回值）
    shuffle(a) {
      for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        const t = a[i]; a[i] = a[j]; a[j] = t;
      }
      return a;
    },
    fmt(n) { return String(Math.floor(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ','); },
    // 加权随机
    weighted(list, wkey) {
      let total = 0;
      for (const it of list) total += it[wkey];
      let r = Math.random() * total;
      for (const it of list) { r -= it[wkey]; if (r <= 0) return it; }
      return list[list.length - 1];
    }
  };
  G.U = U;

  /* ---------------- 日期 ---------------- */
  const CN_NUM = ['一', '二', '三', '四', '五', '六', '七', '八', '九', '十'];
  function dayName(d) {
    if (d <= 10) return '初' + CN_NUM[d - 1];
    if (d < 20) return '十' + CN_NUM[d - 11];
    if (d === 20) return '二十';
    if (d < 30) return '廿' + CN_NUM[d - 21];
    return '三十';
  }
  function dateInfo(day) {
    const year = Math.floor((day - 1) / 360) + 1;
    const rest = (day - 1) % 360;
    const mi = Math.floor(rest / 30);
    const seasonIdx = Math.floor(mi / 3);
    return {
      year, month: mi + 1, dayOfMonth: (rest % 30) + 1,
      season: seasonIdx, seasonName: D.SEASONS[seasonIdx].name,
      text: `元和${CN_NUM[year - 1] || year}年 ${D.MONTHS[mi]}${dayName((rest % 30) + 1)}`
    };
  }
  G.dateInfo = dateInfo;

  /* ---------------- 新游戏 ---------------- */
  function newGame() {
    const st = D.STATS[1];                 // 炼气期的初始属性
    return {
      v: SAVE_VER,
      day: 1,
      money: 500,
      rep: 0,
      insight: 0,
      insightAll: 0,
      talents: {},
      player: {
        level: 1, exp: 0,
        maxHp: st.hp, hp: st.hp,
        maxMp: st.mp, mp: st.mp,
        atk: st.atk, def: st.def,
        furnace: 1,
        alchemy: { crafts: 0, exp: 0 }
      },
      bag: { dewgrass: 8, commonherb: 10, vineroot: 4, moonflower: 2 },
      pills: {},
      shelf: [],
      orders: [],
      orderSeq: 0,
      recipes: ['juqidan', 'liaoshangdan'],
      dungeons: ['qingmu'],
      buffs: [],
      stats: { sales: 0, income: 0, crafted: 0, fails: 0, kills: 0, explored: 0, best: 0, ordersDone: 0, ordersFailed: 0, orderIncome: 0 },
      news: [],
      flags: { tutorial: true },
      explore: null
    };
  }

  G.S = newGame();

  /* ---------------- 存档 ---------------- */
  G.save = function () {
    try {
      const copy = Object.assign({}, G.S);
      copy.explore = null;                    // 场景状态不落盘
      localStorage.setItem(SAVE_KEY, JSON.stringify(copy));
    } catch (e) { /* 忽略存档异常 */ }
  };

  /** 旧存档迁移：v1 的炼气一~九层压成单一「炼气期」 */
  function migrateV1(data) {
    const p = data.player || {};
    const oldLv = Math.max(1, Math.min(p.level || 1, 29));

    // 旧体系的基础属性（线性公式），据此反推丹药带来的永久加成
    const oldBase = {
      hp: 120 + (oldLv - 1) * 70,
      atk: 12 + (oldLv - 1) * 9,
      def: 5 + (oldLv - 1) * 4,
      mp: 60 + (oldLv - 1) * 12
    };
    const perm = {
      hp: Math.max(0, (p.maxHp || oldBase.hp) - oldBase.hp),
      atk: Math.max(0, (p.atk || oldBase.atk) - oldBase.atk),
      def: Math.max(0, (p.def || oldBase.def) - oldBase.def),
      mp: Math.max(0, (p.maxMp || oldBase.mp) - oldBase.mp)
    };

    // 炼气九层以下一律落到「炼气期」；筑基以后按大境界平移
    const newLv = oldLv <= 9 ? 1 : Math.max(1, oldLv - 8);
    const st = D.STATS[newLv] || D.STATS[1];

    p.level = newLv;
    p.exp = 0;                              // 修为需求表已变，重新从本级攒起
    p.maxHp = st.hp + perm.hp;
    p.atk = st.atk + perm.atk;
    p.def = st.def + perm.def;
    p.maxMp = st.mp + perm.mp;
    p.hp = p.maxHp;
    p.mp = p.maxMp;

    data.player = p;
    data.v = SAVE_VER;
    data.flags = data.flags || {};
    data.flags.migratedFrom = oldLv;
    return data;
  }

  G.load = function () {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return false;
      let data = JSON.parse(raw);
      if (!data) return false;
      if (data.v === 1) data = migrateV1(data);
      else if (data.v !== SAVE_VER) return false;

      const base = newGame();
      // 先留好默认值引用：Object.assign 之后 base.stats 会指向存档里的旧对象
      const baseStats = base.stats, basePlayer = base.player, baseFlags = base.flags;
      const s = Object.assign(base, data);
      s.stats = Object.assign({}, baseStats, data.stats || {});
      s.player = Object.assign({}, basePlayer, data.player || {});
      s.flags = Object.assign({}, baseFlags, data.flags || {});
      if (!Array.isArray(s.orders)) s.orders = [];          // 兼容旧存档
      if (typeof s.orderSeq !== 'number') s.orderSeq = 0;
      if (!Array.isArray(s.pills)) s.pills = {};
      if (!Array.isArray(s.recipes)) s.recipes = ['juqidan', 'liaoshangdan'];
      if (!Array.isArray(s.dungeons)) s.dungeons = ['qingmu'];
      s.recipes = s.recipes.filter(id => D.RECIPES.some(r => r.id === id));
      s.dungeons = s.dungeons.filter(id => D.DUNGEONS.some(d => d.id === id));
      // 按当前境界补齐应得的丹方与秘境（迁移后境界名称变了，不能靠旧清单）
      D.RECIPES.forEach(r => {
        if (r.req <= s.player.level && s.recipes.indexOf(r.id) < 0) s.recipes.push(r.id);
      });
      D.DUNGEONS.forEach(d => {
        if (d.req <= s.player.level && s.dungeons.indexOf(d.id) < 0) s.dungeons.push(d.id);
      });
      s.orders = s.orders.filter(o => o && o.pillId && D.PILLS[o.pillId]);
      s.orders.forEach(o => {
        if (o.state !== 'open' && o.state !== 'taken') {    // 旧档订单没有接取状态，一律视为已接
          o.state = 'taken';
          if (!o.days) o.days = Math.max(1, (o.due || s.day + 6) - s.day);
        }
        if (typeof o.openUntil !== 'number') o.openUntil = s.day + 6;
      });
      s.explore = null;
      G.S = s;
      return true;
    } catch (e) { return false; }
  };

  G.reset = function () {
    G.S = newGame();
    G.save();
  };

  /* ---------------- 日志 ---------------- */
  G.log = function (text, type) {
    const info = dateInfo(G.S.day);
    G.S.news.unshift({ text, type: type || 'info', day: info.text });
    if (G.S.news.length > 120) G.S.news.length = 120;
    if (G.UI && G.UI.pushLog) G.UI.pushLog(G.S.news[0]);
  };

  /* ---------------- 派生属性 ---------------- */
  const P = {
    /** 天赋加成倍率 */
    talentMul(id) {
      const t = D.TALENTS.find(x => x.id === id);
      const lv = G.S.talents[id] || 0;
      return t ? lv * t.step : 0;
    },
    realm() { return D.REALMS[G.S.player.level] || D.REALMS[D.REALMS.length - 1]; },
    // 含装备/天赋/临时增益的实际战力
    attr() {
      const p = G.S.player;
      let hp = p.maxHp, atk = p.atk, def = p.def;
      const bodyMul = 1 + P.talentMul('body');
      const buff = { atk: 0, def: 0, hp: 0 };
      for (const b of G.S.buffs) { buff.atk += b.atk || 0; buff.def += b.def || 0; buff.hp += b.hp || 0; }
      return {
        maxHp: Math.round(hp * bodyMul) + buff.hp,
        atk: Math.round(atk * bodyMul) + buff.atk,
        def: Math.round(def * bodyMul) + buff.def
      };
    },
    /** 修炼一天获得的修为 */
    cultPerDay() {
      const base = D.cultGain(G.S.player.level);
      return Math.round(base * (1 + P.talentMul('cult')));
    },
    /** 突破成功率。境界跨度变大，衰减略快于旧体系 */
    breakRate() {
      const lv = G.S.player.level;
      return U.clamp(0.93 - lv * 0.022, 0.35, 0.95);
    },
    fountain() { return D.FURNACES[Math.min(G.S.player.furnace, D.FURNACES.length) - 1]; },
    /** 炼丹基础成功率 */
    craftRate(recipe) {
      const f = P.fountain();
      const lvGap = G.S.player.level - recipe.req;
      let r = 0.72 + f.suc + P.talentMul('suc') + U.clamp(lvGap, 0, 12) * 0.02;
      return U.clamp(r, 0.15, 0.98);
    },
    /** 品质提升值 */
    craftQuality(recipe) {
      const f = P.fountain();
      const lvGap = G.S.player.level - recipe.req;
      return f.quality + P.talentMul('qual') + U.clamp(lvGap, 0, 12) * 0.016;
    },
    /** 售价加成倍率 */
    priceMul() { return 1 + P.talentMul('price'); },
    repMul() { return 1 + P.talentMul('fame'); },
    /** 每日客流 */
    customersPerDay() {
      const s = G.S;
      const season = D.SEASONS[dateInfo(s.day).season];
      let n = D.SHOP.baseCustomers + Math.floor(s.rep / D.SHOP.repPerCustomer);
      n = n * season.mult;
      return Math.max(1, Math.round(n + U.rndf(-0.8, 1.2)));
    }
  };
  G.P = P;

  /* ---------------- 背包 / 丹药 操作 ---------------- */
  G.addMat = function (id, n) {
    G.S.bag[id] = (G.S.bag[id] || 0) + n;
  };
  G.hasMats = function (mats) {
    for (const k in mats) if ((G.S.bag[k] || 0) < mats[k]) return false;
    return true;
  };
  G.takeMats = function (mats) {
    for (const k in mats) G.S.bag[k] = (G.S.bag[k] || 0) - mats[k];
  };
  G.pillKey = function (id, q) { return id + '#' + q; };
  G.addPill = function (id, q, n) {
    const k = G.pillKey(id, q);
    G.S.pills[k] = (G.S.pills[k] || 0) + n;
  };
  G.takePill = function (key, n) {
    if ((G.S.pills[key] || 0) < n) return false;
    G.S.pills[key] -= n;
    if (G.S.pills[key] <= 0) delete G.S.pills[key];
    return true;
  };
  G.parsePillKey = function (key) {
    const [id, q] = key.split('#');
    return { id, q: parseInt(q, 10), pill: D.PILLS[id], quality: D.QUALITY[parseInt(q, 10)] };
  };

  /** 某种丹药的库存：总数 + 品质明细文字（如「上品×1 中品×2 下品×3」） */
  G.pillStock = function (id) {
    const parts = [];
    let total = 0;
    const keys = Object.keys(G.S.pills)
      .filter(k => { const i = G.parsePillKey(k); return i.id === id && G.S.pills[k] > 0; })
      .sort((a, b) => G.parsePillKey(b).q - G.parsePillKey(a).q);
    for (const k of keys) {
      const i = G.parsePillKey(k), n = G.S.pills[k];
      total += n;
      parts.push(`${i.quality.name}×${n}`);
    }
    return { total, detail: parts.join(' ') || '库中无存' };
  };

  /* ---------------- 时间推进 ---------------- */
  let advancing = false;
  G.advanceDays = function (n, note) {
    if (advancing) return;
    advancing = true;
    n = Math.max(1, Math.round(n));
    if (note) G.log(note, 'day');
    for (let i = 0; i < n; i++) {
      G.S.day++;
      G.Sys.dailyTick();
    }
    advancing = false;
  };

  G.gainInsight = function (n, reason) {
    n = Math.round(n * 100) / 100;
    if (n <= 0) return;
    G.S.insight += n;
    G.S.insightAll += n;
    if (reason) G.log(`【丹道感悟】${reason}，感悟 +${n}`, 'insight');
  };

  G.gainRep = function (n) {
    const mul = n > 0 ? P.repMul() : 1;   // 天赋只加成收益，不放大惩罚
    const v = Math.round(n * mul * 10) / 10;
    G.S.rep = Math.max(0, G.S.rep + v);
    return v;
  };

  G.gainExp = function (n) {
    G.S.player.exp += Math.round(n);
  };

  G.sellItem = function (matId, n) {
    const m = D.MATERIALS[matId];
    if (!m || (G.S.bag[matId] || 0) < n) return 0;
    const gain = Math.round(m.price * D.MARKET_SELL * n);
    G.S.bag[matId] -= n;
    if (G.S.bag[matId] <= 0) delete G.S.bag[matId];
    G.S.money += gain;
    return gain;
  };

  G.buyItem = function (matId, n) {
    const m = D.MATERIALS[matId];
    if (!m) return false;
    const cost = Math.round(m.price * D.MARKET_BUY * n);
    if (G.S.money < cost) return false;
    G.S.money -= cost;
    G.addMat(matId, n);
    return cost;
  };
})();
