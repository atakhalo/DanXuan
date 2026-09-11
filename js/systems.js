/* ============================================================
 * 系统：每日结算 / 修炼 / 炼丹 / 商店 / 感悟 / 市场
 * ==========================================================*/
(function () {
  'use strict';

  const D = G.DATA, U = G.U, P = G.P;
  const S = () => G.S;

  const Sys = {};

  /* ==================== 每日结算 ==================== */
  Sys.dailyTick = function () {
    const s = S();

    // 1) 气血与灵力恢复
    const a = P.attr();
    s.player.hp = Math.min(a.maxHp, s.player.hp + Math.round(a.maxHp * 0.22) + 12);
    s.player.mp = Math.min(s.player.maxMp, s.player.mp + Math.round(s.player.maxMp * 0.3) + 4);

    // 2) 临时增益倒计时
    if (s.buffs.length) {
      s.buffs = s.buffs.filter(b => {
        b.days--;
        if (b.days <= 0) { G.log(`【药力消散】${b.name} 的效果已经消退。`, 'dim'); return false; }
        return true;
      });
    }

    // 3) 店铺营业
    Sys.shopTick();

    // 4) 委托订单：结算超时 + 招来新单
    Sys.orderTick();

    // 5) 随机事件
    if (U.chance(0.07)) Sys.randomEvent();
  };

  /* ==================== 随机事件 ==================== */
  const EVENTS = [
    function () {
      const mats = D.MARKET.filter(m => (D.MATERIALS[m].tier * 2) <= S().player.level + 4);
      if (!mats.length) return;
      const id = U.pick(mats), n = U.rnd(2, 5), m = D.MATERIALS[id];
      const cost = Math.round(m.price * 0.7 * n);
      if (S().money < cost) return;
      S().money -= cost; G.addMat(id, n);
      G.log(`【行商】山外来了个背着药篓的老翁，你以 ${U.fmt(cost)} 灵石收下 ${m.name} ×${n}。`, 'good');
    },
    function () {
      const rep = U.rnd(2, 6);
      G.gainRep(rep);
      G.log(`【口碑】有客人在酒楼里夸了你的丹阁几句，声望 +${rep}。`, 'good');
    },
    function () {
      const loss = Math.min(S().money, U.rnd(30, 160) + S().player.level * 12);
      if (loss <= 0) return;
      S().money -= loss;
      G.log(`【劫修】夜里有人翻墙进了后院，损失 ${U.fmt(loss)} 灵石。该加固阵法了。`, 'bad');
    },
    function () {
      G.gainInsight(1, '观炉火明灭，若有所得');
    },
    function () {
      const bag = Object.keys(S().bag).filter(k => S().bag[k] > 0);
      if (!bag.length) return;
      const id = U.pick(bag), n = Math.min(S().bag[id], U.rnd(1, 2));
      S().bag[id] -= n; if (S().bag[id] <= 0) delete S().bag[id];
      G.log(`【鼠患】药柜角落进了灵鼠，${D.MATERIALS[id].name} 少了 ${n} 份。`, 'bad');
    },
    function () {
      if (S().buffs.some(b => b.days > 0)) return;
      Sys.applyBuff({ name: '天地灵气', atk: 5, def: 3, days: 2 });
      G.log('【灵潮】今夜灵气格外浓郁，你打坐时隐隐有所进益。', 'good');
    }
  ];
  Sys.randomEvent = function () {
    U.pick(EVENTS)();
  };

  Sys.applyBuff = function (b) {
    S().buffs.push(Object.assign({}, b));
  };

  /* ==================== 修炼 ==================== */
  /** 现下灵石够打坐几日 */
  Sys.maxCultDays = function () {
    const s = S();
    const per = D.cultCost(s.player.level, 1);
    return per > 0 ? Math.floor(s.money / per) : 999;
  };

  Sys.cultivate = function (days) {
    days = Math.max(1, days | 0);
    const s = S();
    const cost = D.cultCost(s.player.level, days);
    if (s.money < cost) {
      G.UI.toast(`灵石不足：打坐 ${days} 日需 ${U.fmt(cost)} 灵石，眼下只够 ${U.fmt(Sys.maxCultDays())} 日。`, 'bad');
      return false;
    }

    s.money -= cost;
    const gain = P.cultPerDay() * days;
    G.advanceDays(days, `闭关打坐 ${days} 日，耗去 ${U.fmt(cost)} 灵石布置聚灵阵。`);
    G.gainExp(gain);
    G.log(`潜心吐纳，修为 +${U.fmt(gain)}。（${s.player.exp}/${D.expNeed(s.player.level)}）`, 'cult');

    if (U.chance(0.06 * days)) {
      G.gainInsight(U.rnd(1, 2), '入定时忽有明悟');
    }
    G.UI.afterAction();
    return true;
  };

  Sys.canBreak = function () {
    return S().player.level < D.MAX_LEVEL && S().player.exp >= D.expNeed(S().player.level);
  };

  /** 突破。usePill: 是否服用破境丹 */
  Sys.breakthrough = function (usePill) {
    const s = S();
    if (!Sys.canBreak()) return false;
    let bonus = 0, usedKey = null;
    if (usePill) {
      const idx = Object.keys(s.pills).find(k => k.startsWith('pojingdan#'));
      if (idx) {
        usedKey = idx; bonus = D.PILLS.pojingdan.effect.breakthrough / 100;
      }
    }
    const rate = U.clamp(P.breakRate() + bonus, 0.05, 0.99);
    if (usedKey) { G.takePill(usedKey, 1); G.log('服下破境丹，气机沉稳了几分。', 'info'); }

    G.advanceDays(1, '闭关冲击境界。');
    const ok = U.chance(rate);

    if (ok) {
      const prevExp = s.player.exp;
      const prevLv = s.player.level;
      const need = D.expNeed(prevLv);
      s.player.level = prevLv + 1;
      s.player.exp = Math.max(0, prevExp - need);   // 溢出的修为保留
      const lv = s.player.level;
      const st = D.STATS[lv] || D.STATS[D.STATS.length - 1];
      // 丹药带来的永久加成要跨境界保留（当前值 - 本级基础值）
      const prevBase = D.STATS[prevLv] || st;
      const perm = {
        hp: Math.max(0, s.player.maxHp - prevBase.hp),
        atk: Math.max(0, s.player.atk - prevBase.atk),
        def: Math.max(0, s.player.def - prevBase.def),
        mp: Math.max(0, s.player.maxMp - prevBase.mp)
      };
      s.player.maxHp = st.hp + perm.hp;
      s.player.atk = st.atk + perm.atk;
      s.player.def = st.def + perm.def;
      s.player.maxMp = st.mp + perm.mp;
      s.player.hp = s.player.maxHp;
      s.player.mp = s.player.maxMp;
      s.stats.best = Math.max(s.stats.best, lv);
      G.log(`【突破成功】气机贯通，境界升至 ${D.REALMS[lv]}！`, 'big');
      G.gainInsight(2, '境界跃升带来的道韵余韵');
      // 解锁丹方 / 秘境
      D.RECIPES.forEach(r => {
        if (r.req <= lv && s.recipes.indexOf(r.id) < 0) {
          s.recipes.push(r.id);
          G.log(`【丹方】你参透了新丹方：${D.PILLS[r.pill].name}。`, 'good');
        }
      });
      D.DUNGEONS.forEach(d => {
        if (d.req <= lv && s.dungeons.indexOf(d.id) < 0) {
          s.dungeons.push(d.id);
          G.log(`【秘境】你已能安然踏入 ${d.name}。`, 'good');
        }
      });
      G.UI.showResult('突破成功', `境界提升至「${D.REALMS[lv]}」`, 'good');
    } else {
      const lost = Math.round(s.player.exp * 0.35);
      s.player.exp = Math.max(0, s.player.exp - lost);
      s.player.hp = Math.max(1, Math.round(s.player.hp * 0.5));
      G.log(`【突破失败】气机反噬，修为 -${U.fmt(lost)}，气血大损。`, 'bad');
      G.UI.showResult('突破失败', `修为损失 ${U.fmt(lost)}，来日再战。`, 'bad');
    }
    G.UI.afterAction();
    return ok;
  };

  /** 服用丹药（非战斗状态） */
  Sys.takePill = function (key) {
    const s = S();
    if (!s.pills[key]) return false;
    const { pill, quality } = G.parsePillKey(key);
    const mul = quality.mult;
    const e = pill.effect;
    let msg = [];
    if (e.exp) { const v = Math.round(e.exp * mul); G.gainExp(v); msg.push(`修为 +${U.fmt(v)}`); }
    if (e.heal) { const v = Math.round(e.heal * mul); s.player.hp = Math.min(P.attr().maxHp, s.player.hp + v); msg.push(`气血 +${v}`); }
    if (e.insight) { const v = Math.round(e.insight * mul * 10) / 10; G.gainInsight(v); msg.push(`感悟 +${v}`); }
    if (e.perm) {
      if (e.perm.maxHp) s.player.maxHp += Math.round(e.perm.maxHp * mul);
      if (e.perm.atk) s.player.atk += Math.round(e.perm.atk * mul);
      if (e.perm.def) s.player.def += Math.round(e.perm.def * mul);
      msg.push('体质永久提升');
    }
    if (!msg.length) return false;
    G.takePill(key, 1);
    G.log(`服下${quality.name}${pill.name}：${msg.join('，')}。`, 'cult');
    G.UI.afterAction();
    return true;
  };

  /** 主动悟道：焚香静坐，耗灵石换感悟 */
  Sys.meditate = function () {
    const s = S();
    const cost = D.meditateCost(s.player.level);
    if (s.money < cost) {
      G.UI.toast(`焚香悟道需 ${U.fmt(cost)} 灵石，眼下不够。`, 'bad');
      return false;
    }
    s.money -= cost;

    const days = D.COST.meditateDays;
    G.advanceDays(days, `焚香静坐 ${days} 日，耗去 ${U.fmt(cost)} 灵石香火。`);
    const gain = U.rnd(4, 7) + Math.floor(s.player.level / 6);
    G.gainInsight(gain, '静坐三日，心中豁然');
    G.UI.afterAction();
    return true;
  };

  /* ==================== 炼丹 ==================== */
  /* 品质掷骰：roll = rand()*Q_SPAN + bonus，越大品质越高。
     UI 用同一组常数反推各档概率（Sys.qualityOdds），改这里就不必改那边。 */
  const Q_SPAN = 1.35;
  const Q_MID = 0.58, Q_GOOD = 1.00, Q_TOP = 1.30;

  function rollQuality(bonus) {
    const roll = Math.random() * Q_SPAN + bonus;
    if (roll >= Q_TOP) return 3;
    if (roll >= Q_GOOD) return 2;
    if (roll >= Q_MID) return 1;
    return 0;
  }

  /** 各品质的出现概率 [下品,中品,上品,极品]，总和为 1 */
  Sys.qualityOdds = function (bonus) {
    const th = [Q_MID, Q_GOOD, Q_TOP].map(t => (t - bonus) / Q_SPAN);   // 换算成 rand() 的阈值
    const p = [];
    let prev = 0;
    for (let i = 0; i < 3; i++) {
      const cur = Math.max(prev, Math.min(1, th[i]));
      p.push(cur - prev);
      prev = cur;
    }
    p.push(Math.max(0, 1 - prev));
    return p;
  };

  Sys.craft = function (recipeId, fireId) {
    const s = S();
    const r = D.RECIPES.find(x => x.id === recipeId);
    const fire = D.FIRES.find(f => f.id === fireId) || D.FIRES[1];
    if (!r || s.recipes.indexOf(recipeId) < 0) return false;
    if (!G.hasMats(r.mats)) { G.UI.toast('药材不足，快去秘境或市场补货。', 'bad'); return false; }

    G.takeMats(r.mats);
    const days = Math.max(1, r.days + fire.days);
    G.advanceDays(days, `开炉炼制 ${D.PILLS[r.pill].name}（${fire.name}），历时 ${days} 日。`);

    const rate = U.clamp(P.craftRate(r) + fire.suc, 0.05, 0.99);
    const ok = U.chance(rate);
    s.stats.crafts = (s.stats.crafts || 0) + 1;

    if (!ok) {
      s.stats.fails++;
      G.log(`【炸炉】炉中丹气翻涌失控，一炉药材尽废。`, 'bad');
      G.gainInsight(1, '从失败中窥见一丝火候真意');
      G.UI.showCraftResult({ ok: false, name: D.PILLS[r.pill].name, rate });
      G.UI.afterAction();
      return false;
    }

    // 品质判定
    const bonus = P.craftQuality(r) + fire.quality;
    const q = rollQuality(bonus);

    let amount = r.qty;
    if (U.chance(P.talentMul('yield'))) amount++;

    G.addPill(r.pill, q, amount);
    const ins = 1 + q;
    G.gainInsight(ins, `成功炼出${D.QUALITY[q].name}${D.PILLS[r.pill].name}`);
    s.stats.crafted += amount;
    s.player.alchemy.crafts++;

    G.log(`【成丹】${D.QUALITY[q].name}${D.PILLS[r.pill].name} ×${amount}（成功率 ${(rate * 100).toFixed(0)}%）。`, 'good');
    G.UI.showCraftResult({ ok: true, name: D.PILLS[r.pill].name, quality: q, amount, rate, insight: ins });
    G.UI.afterAction();
    return true;
  };

  /* ==================== 丹道感悟 ==================== */
  /** 参悟某层天赋所需感悟（越往上越贵） */
  Sys.talentCost = function (id) {
    const t = D.TALENTS.find(x => x.id === id);
    if (!t) return 0;
    const cur = S().talents[id] || 0;
    return Math.round(t.cost * Math.pow(cur + 1, D.COST.talentExp));
  };

  /** 参悟某层天赋所需灵石（炼丹的炉火、静室的香烛，一样要钱） */
  Sys.talentMoneyCost = function (id) {
    const cur = S().talents[id] || 0;
    return D.talentMoneyCost(S().player.level, cur);
  };

  Sys.upgradeTalent = function (id) {
    const s = S();
    const t = D.TALENTS.find(x => x.id === id);
    if (!t) return false;
    const cur = s.talents[id] || 0;
    if (cur >= t.max) { G.UI.toast('此道已至圆满。', 'warn'); return false; }

    const insCost = Sys.talentCost(id);
    const moneyCost = Sys.talentMoneyCost(id);
    if (s.insight < insCost) { G.UI.toast(`感悟不足：参悟${t.name}需 ${U.fmt(insCost)} 感悟。`, 'bad'); return false; }
    if (s.money < moneyCost) { G.UI.toast(`灵石不足：参悟${t.name}需 ${U.fmt(moneyCost)} 灵石。`, 'bad'); return false; }

    s.insight -= insCost;
    s.money -= moneyCost;
    s.talents[id] = cur + 1;
    G.log(`【悟道】${t.name} 精进至 ${cur + 1} 层，耗去 ${U.fmt(insCost)} 感悟与 ${U.fmt(moneyCost)} 灵石。`, 'insight');
    G.UI.afterAction();
    return true;
  };

  /* ==================== 商店 ==================== */
  Sys.shelfLimit = function () { return D.SHOP.shelves + (S().flags.shelfBonus || 0); };

  Sys.shelfAdd = function (key, price, count) {
    const s = S();
    const exist = s.shelf.find(x => x.key === key);
    const total = s.shelf.length + (exist ? 0 : 1);
    if (total > Sys.shelfLimit()) { G.UI.toast('货架已满。', 'warn'); return false; }
    if ((s.pills[key] || 0) < count) { G.UI.toast('库存不足。', 'bad'); return false; }
    G.takePill(key, count);
    if (exist) { exist.count += count; exist.price = price; }
    else s.shelf.push({ key, price, count });
    G.log(`上架 ${count} 枚${G.parsePillKey(key).quality.name}${G.parsePillKey(key).pill.name}，定价 ${price}。`, 'info');
    G.UI.afterAction();
    return true;
  };

  Sys.shelfTakeBack = function (idx) {
    const s = S();
    const it = s.shelf[idx];
    if (!it) return;
    s.pills[it.key] = (s.pills[it.key] || 0) + it.count;
    s.shelf.splice(idx, 1);
    G.UI.afterAction();
  };

  Sys.shelfSetPrice = function (idx, price) {
    const it = S().shelf[idx];
    if (!it) return;
    it.price = Math.max(1, Math.round(price));
    G.UI.afterAction();
  };

  /** 顾客的购买力上限：声望越高、境界越高，来的客人越阔绰 */
  function affordCap(cus, it) {
    const s = S();
    const info = G.parsePillKey(it.key);
    const scale = 1 + Math.min(4, s.rep / 100) + Math.max(0, s.player.level - 7) * 0.12;
    return cus.budget[1] * scale * (0.7 + info.quality.rank * 0.4);
  }

  /** 每日零售：路过的散客顺手买几枚，只肯出公道价以下的价钱 */
  Sys.shopTick = function () {
    const s = S();
    const pool = s.shelf.filter(it => it.count > 0);
    const guests = P.customersPerDay();
    let sold = 0, income = 0, repGain = 0, tooExpensive = 0;
    const soldNames = {};

    for (let i = 0; i < guests; i++) {
      if (!pool.some(it => it.count > 0)) break;
      const cus = U.weighted(D.CUSTOMERS, 'weight');
      // 只看买得起的货，再按偏好挑选
      const buyable = pool.filter(it => it.count > 0 && it.price <= affordCap(cus, it));
      let cand = buyable.filter(it => cus.pref.indexOf(G.parsePillKey(it.key).pill.tag) >= 0);
      if (!cand.length) cand = buyable;
      if (!cand.length) { tooExpensive++; continue; }

      const it = U.pick(cand);
      const info = G.parsePillKey(it.key);
      const fair = info.pill.price * info.quality.mult * P.priceMul();
      const willing = fair * U.rndf(D.SHOP.priceBand[0], D.SHOP.priceBand[1]) * cus.greed;

      if (it.price <= willing) {
        it.count--;
        s.money += it.price;
        sold++; income += it.price;
        repGain += U.rndf(0.3, 0.7);
        soldNames[info.pill.name] = (soldNames[info.pill.name] || 0) + 1;
      } else {
        tooExpensive++;
      }
    }

    s.shelf = s.shelf.filter(it => it.count > 0);
    s.stats.sales += sold;
    s.stats.income += income;

    if (sold > 0) {
      G.gainRep(repGain);
      const list = Object.keys(soldNames).map(k => `${k}×${soldNames[k]}`).join('、');
      G.log(`【零售】散客买走 ${list}，得 ${U.fmt(income)} 灵石。`, 'good');
    }

    // 连续十二日货架空空，名声淡薄（卖过丹药之后才开始计较）
    if (s.shelf.length === 0) {
      s.flags.emptyDays = (s.flags.emptyDays || 0) + 1;
      if (s.flags.emptyDays >= 12 && s.stats.sales > 0) {
        s.flags.emptyDays = 0;
        G.gainRep(-2);
        G.log('【门可罗雀】丹阁连着十余日无丹可卖，乡邻议论纷纷，声望 -2。', 'bad');
      }
    } else {
      s.flags.emptyDays = 0;
    }
    if (tooExpensive > 0) s.flags.stalePrice = tooExpensive;
    else s.flags.stalePrice = 0;
  };

  /* ==================== 委托订单 ====================
   * 订单会自行累积到墙上（state='open'，不限时）；
   * 玩家主动「接下」后才转入进行中（state='taken'），从此开始倒计时。
   * 急单时限短、报酬高、失约代价大。
   * ================================================= */
  const O = () => D.ORDERS;
  const isOpen = o => o.state === 'open';
  const isTaken = o => o.state === 'taken';

  /** 剩余天数：已接 = 距到期；待接 = 贴子还能挂多久 */
  Sys.orderLeft = function (o) {
    return (isTaken(o) ? o.due : o.openUntil) - S().day;
  };

  /** 库存中符合该订单要求的丹药总数 */
  Sys.orderAvailable = function (o) {
    const s = S();
    let n = 0;
    for (const k in s.pills) {
      const info = G.parsePillKey(k);
      if (info.id === o.pillId && info.q >= o.minQuality) n += s.pills[k];
    }
    return n;
  };

  /** 已接委托（临期的排前面） */
  Sys.ordersTaken = function () {
    return S().orders.filter(isTaken).sort((a, b) => (b.rush - a.rush) || (a.due - b.due));
  };
  /** 墙上待接的贴子（急单、报酬高的排前面） */
  Sys.ordersOpen = function () {
    return S().orders.filter(isOpen).sort((a, b) =>
      (b.rush - a.rush) || (b.reward - a.reward) || (a.openUntil - b.openUntil));
  };


  function makeOrder(easy, avoid) {
    const s = S();
    // 只从已解锁的丹方里接单，并尽量跟上当前境界
    const all = s.recipes.map(id => D.RECIPES.find(r => r.id === id)).filter(Boolean);
    let pool = all.filter(r => r.req >= s.player.level - 6);
    if (!pool.length) pool = all;
    // 同一批里尽量别求购同一种丹药
    const varied = pool.filter(r => !avoid || avoid.indexOf(r.pill) < 0);
    if (varied.length) pool = varied;
    if (!pool.length) return null;

    const r = U.pick(pool);
    const pill = D.PILLS[r.pill];
    const rush = U.chance(O().rushChance);
    const cfg = rush ? O().rush : O().normal;
    const minQuality = easy ? 0 : U.weighted(O().quality, 'w').q;
    // 偏向小批量：多为 1~2 枚，偶尔三两枚
    const maxQ = Math.max(1, O().maxQty - Math.floor(minQuality / 2));
    const qty = Math.min(maxQ, U.chance(0.3) ? U.rnd(2, maxQ) : U.rnd(1, 2));
    const base = pill.price * D.QUALITY[minQuality].mult * qty;
    const reward = Math.round(base * U.rndf(cfg.mul[0], cfg.mul[1]) / 5) * 5;
    const days = U.rnd(cfg.days[0], cfg.days[1]);
    const cus = U.weighted(D.CUSTOMERS, 'weight');
    const reasons = D.ORDER_REASONS[cus.id] || ['求购丹药'];

    return {
      id: 'ord' + (++s.orderSeq),
      state: 'open',                      // 接下后才变为 taken
      rush,
      pillId: r.pill,
      qty,
      minQuality,
      reward,
      rep: Math.round(U.rnd(cfg.rep[0], cfg.rep[1]) * (minQuality >= 2 ? 1.5 : 1)),
      insight: rush ? U.rnd(1, 3) : (minQuality >= 2 ? 2 : 0),
      customer: cus.id,
      customerName: cus.name,
      color: cus.color,
      reason: U.pick(reasons),
      days,                               // 接单后才开始算的时限
      created: s.day,
      openUntil: s.day + U.rnd(cfg.openLife[0], cfg.openLife[1]),   // 急单在墙上留不久
      taken: 0,
      due: 0
    };
  }

  /** 生成订单挂上墙。easy = 不挑品质（给开局用） */
  Sys.orderGenerate = function (n, easy) {
    const s = S();
    let added = 0;
    const avoid = s.orders.filter(isOpen).map(o => o.pillId);
    for (let i = 0; i < n; i++) {
      if (s.orders.filter(isOpen).length >= O().openMax) break;
      const o = makeOrder(easy, avoid);
      if (!o) break;
      s.orders.push(o);
      avoid.push(o.pillId);
      added++;
    }
    return added;
  };

  /** 每日：清算到期的已接委托、揭走无人理会的贴子，再招来新单 */
  Sys.orderTick = function () {
    const s = S();

    // 1) 已接委托到期
    const overdue = s.orders.filter(o => isTaken(o) && s.day > o.due);
    if (overdue.length) {
      for (const o of overdue) {
        const cfg = o.rush ? O().rush : O().normal;
        s.stats.ordersFailed++;
        if (cfg.failRep > 0) {
          G.gainRep(-cfg.failRep);
          G.log(`【失约】应承下来的急单没能办妥，${o.customerName}拂袖而去，声望 -${cfg.failRep}。`, 'bad');
        } else {
          G.log(`【误期】${o.customerName}等不到${D.PILLS[o.pillId].name}，另寻他处去了。`, 'warn');
        }
      }
      s.orders = s.orders.filter(o => !(isTaken(o) && s.day > o.due));
    }

    // 2) 墙上贴子挂太久，被别人揭走
    const stale = s.orders.filter(o => isOpen(o) && s.day > o.openUntil);
    if (stale.length) {
      s.orders = s.orders.filter(o => !(isOpen(o) && s.day > o.openUntil));
      const names = Array.from(new Set(stale.map(o => D.PILLS[o.pillId].name))).join('、');
      G.log(`【撤贴】${stale.length} 张求购（${names}）久无人应，被主顾揭走了。`, 'dim');
    }

    // 3) 招来新单（只受待接池上限约束）
    const room = Math.max(0, O().openMax - s.orders.filter(isOpen).length);
    let n = O().dailyBase + Math.floor(s.rep / O().repPerOrder);
    n = Math.min(room, Math.floor(n + U.rndf(-0.45, 0.85)));
    if (n <= 0) return;

    Sys.orderGenerate(n);
    const rush = s.orders.slice(-n).filter(o => o.rush)[0];
    if (rush) {
      G.log(`【急单】有人急着要 ${D.PILLS[rush.pillId].name} ×${rush.qty}，出价 ${U.fmt(rush.reward)} 灵石。`, 'warn');
    }
  };

  /** 接下委托：从此刻起才开始计算时限 */
  Sys.orderAccept = function (id) {
    const s = S();
    const o = s.orders.find(x => x.id === id);
    if (!o || !isOpen(o)) return false;
    const taken = s.orders.filter(isTaken).length;
    if (taken >= O().takeMax) {
      G.UI.toast(`同时最多经手 ${O().takeMax} 张委托，先把手上的了结。`, 'warn');
      return false;
    }

    o.state = 'taken';
    o.taken = s.day;
    o.due = s.day + o.days;
    G.log(`【接单】接下${o.customerName}的委托：${D.PILLS[o.pillId].name} ×${o.qty}，限 ${o.days} 日内交付。`, 'info');

    // 货已在手就直接交差，省一次点击
    if (Sys.orderAvailable(o) >= o.qty) {
      Sys.orderDeliver(o.id);
    } else {
      G.UI.afterAction();
    }
    return true;
  };

  /** 移出清单：待接的「略过」/ 已接的「放弃」 */
  Sys.orderRemove = function (id) {
    const s = S();
    const o = s.orders.find(x => x.id === id);
    if (!o) return false;
    s.orders = s.orders.filter(x => x.id !== id);
    G.log(isTaken(o)
      ? `你把手头${o.customerName}的委托退还了回去。`
      : `你把${o.customerName}的贴子搁到了一边。`, 'info');
    G.UI.afterAction();
    return true;
  };

  /** 交付订单。silent 时不触发整页重绘（供一键交付使用） */
  Sys.orderDeliver = function (id, silent) {
    const s = S();
    const o = s.orders.find(x => x.id === id);
    if (!o) return false;
    if (isOpen(o)) {                    // 未接单就直接交？先接单
      if (!Sys.orderAccept(id)) return false;
      const after = s.orders.find(x => x.id === id);
      if (after) return false;          // 只是接下了，还没交
      return true;
    }
    if (Sys.orderAvailable(o) < o.qty) {
      if (!silent) G.UI.toast('库存中符合要求的丹药不足。', 'bad');
      return false;
    }

    // 从低品质开始交付，把好货留给自己
    let need = o.qty;
    const keys = Object.keys(s.pills)
      .filter(k => {
        const i = G.parsePillKey(k);
        return i.id === o.pillId && i.q >= o.minQuality && s.pills[k] > 0;
      })
      .sort((a, b) => G.parsePillKey(a).q - G.parsePillKey(b).q);
    for (const k of keys) {
      if (need <= 0) break;
      const take = Math.min(need, s.pills[k]);
      G.takePill(k, take);
      need -= take;
    }

    s.money += o.reward;
    s.stats.income += o.reward;
    s.stats.orderIncome += o.reward;
    s.stats.sales += o.qty;
    s.stats.ordersDone++;
    const rep = G.gainRep(o.rep);
    if (o.insight) G.gainInsight(o.insight, `${o.customerName}的谢礼`);
    s.orders = s.orders.filter(x => x.id !== id);

    G.log(`【交单】交付 ${D.PILLS[o.pillId].name} ×${o.qty} 给${o.customerName}，得 ${U.fmt(o.reward)} 灵石${rep ? `、声望 +${rep}` : ''}。`, 'good');

    if (!silent) {
      G.UI.showResult('委托完成',
        `${o.customerName}收下丹药，${o.rush ? '连声道谢，还多塞了一份谢礼。' : '满意地点了点头。'}<br>
         <span class="gold big-pill">${U.fmt(o.reward)} 灵石</span>　声望 +${rep}${o.insight ? `　感悟 +${o.insight}` : ''}`,
        'good');
      G.UI.afterAction();
    }
    return true;
  };

  /** 一键交付所有备齐的已接委托 */
  Sys.orderDeliverAll = function () {
    const s = S();
    let done = 0;
    for (const o of Sys.ordersTaken()) {
      if (Sys.orderAvailable(o) >= o.qty) {
        if (Sys.orderDeliver(o.id, true)) done++;
      }
    }
    if (!done) G.UI.toast('暂时没有可以交付的委托。', 'warn');
    else G.UI.toast(`一口气交付了 ${done} 单。`, 'good');
    G.UI.afterAction();
    return done;
  };

  /* ==================== 市场 ==================== */
  Sys.marketBuy = function (id, n) {
    const cost = G.buyItem(id, n);
    if (!cost) { G.UI.toast('灵石不足。', 'bad'); return false; }
    G.log(`在市场购入 ${D.MATERIALS[id].name} ×${n}，花费 ${U.fmt(cost)} 灵石。`, 'info');
    G.UI.afterAction();
    return true;
  };
  Sys.marketSell = function (id, n) {
    const gain = G.sellItem(id, n);
    if (!gain) { G.UI.toast('没有可卖的货。', 'bad'); return false; }
    G.log(`向药商卖出 ${D.MATERIALS[id].name} ×${n}，得 ${U.fmt(gain)} 灵石。`, 'info');
    G.UI.afterAction();
    return true;
  };

  /* ==================== 升级丹炉 / 货架 ==================== */
  Sys.upgradeFurnace = function () {
    const s = S();
    const next = D.FURNACES[s.player.furnace];
    if (!next) { G.UI.toast('丹炉已至绝品。', 'warn'); return false; }
    if (s.money < next.cost) { G.UI.toast(`需要 ${U.fmt(next.cost)} 灵石。`, 'bad'); return false; }
    s.money -= next.cost;
    s.player.furnace++;
    G.log(`【丹炉】换上了${next.name}，火候掌控更上一层。`, 'good');
    G.UI.afterAction();
    return true;
  };

  Sys.upgradeShelf = function () {
    const s = S();
    const cost = 1200 * Math.pow(1.8, s.flags.shelfBonus || 0);
    if ((s.flags.shelfBonus || 0) >= 4) { G.UI.toast('店面已经扩建到极限了。', 'warn'); return false; }
    if (s.money < cost) { G.UI.toast(`需要 ${U.fmt(cost)} 灵石。`, 'bad'); return false; }
    s.money -= cost;
    s.flags.shelfBonus = (s.flags.shelfBonus || 0) + 1;
    G.log('【扩建】店面拓宽了一间，又可以多摆一方货架。', 'good');
    G.UI.afterAction();
  };

  /* ==================== 秘境 ==================== */
  Sys.enterDungeon = function (id) {
    const s = S();
    const d = D.DUNGEONS.find(x => x.id === id);
    if (!d) return false;
    if (s.player.level < d.req) { G.UI.toast(`境界不足，需 ${D.REALMS[d.req]}。`, 'bad'); return false; }
    if (s.player.hp < P.attr().maxHp * 0.3) { G.UI.toast('气血过于虚弱，先疗伤再出发。', 'bad'); return false; }

    G.advanceDays(d.days, `启程前往 ${d.name}（${d.days} 日路程）。`);
    G.log(`你踏入了 ${d.name}。`, 'big');
    G.Scene.startDungeon(d);
    G.UI.afterAction();
    return true;
  };

  /** 秘境结束（返回 / 被击退） */
  Sys.finishDungeon = function (result) {
    const s = S();
    s.stats.explored++;
    s.explore = null;
    if (result && result.gain) {
      const parts = Object.keys(result.gain).map(k => `${D.MATERIALS[k].name}×${result.gain[k]}`).join('、');
      G.log(`【归来】此行收获：${parts || '无'}。`, 'good');
    } else {
      G.log('【归来】你空手走出了秘境。', 'warn');
    }
    const ins = result && result.insight ? result.insight : 0;
    if (ins) G.gainInsight(ins, '生死之间，道心更坚');
    G.UI.closeExplore();
    G.UI.afterAction();
  };

  /** 战斗胜利结算（妖兽只掉灵石与材料，不给修为） */
  Sys.winBattle = function (enemy, gain) {
    const s = S();
    s.stats.kills++;
    const gold = U.rnd(enemy.gold[0], enemy.gold[1]);
    s.money += gold;
    if (U.chance(0.35)) G.gainInsight(1, '战斗中灵光一闪');
    return { gold };
  };

  G.Sys = Sys;
})();
