/* ============================================================
 * UI 渲染层：HUD / 各面板 / 日志 / 弹窗 / 战斗界面
 * ==========================================================*/
(function () {
  'use strict';

  const D = G.DATA, U = G.U, P = G.P;
  const $ = id => document.getElementById(id);
  const S = () => G.S;

  const el = {};
  let tab = 'shop';
  let lastTab = null;          // 上一次渲染时的标签，用来判断要不要保留滚动位置
  let selRecipe = null;
  let selFire = 'zhong';
  let exploring = false;
  let selectedDungeon = null;

  const UI = {};

  /* ---------------- 初始化 ---------------- */
  UI.init = function () {
    el.hud = $('hud'); el.tabs = $('tabs'); el.view = $('view'); el.log = $('logbox');
    el.modal = $('modal-layer'); el.toasts = $('toasts');
    el.tabs.addEventListener('click', e => {
      const b = e.target.closest('[data-tab]');
      if (!b || exploring) return;
      tab = b.dataset.tab;
      render();
    });
    el.view.addEventListener('click', onClick);
    el.view.addEventListener('change', onChange);
    render();
  };

  /* ---------------- 通用组件 ---------------- */
  UI.toast = function (msg, type) {
    const d = document.createElement('div');
    d.className = 'toast ' + (type || 'info');
    d.textContent = msg;
    el.toasts.appendChild(d);
    requestAnimationFrame(() => d.classList.add('show'));
    setTimeout(() => { d.classList.remove('show'); setTimeout(() => d.remove(), 320); }, 2800);
  };

  function modal(html, opts) {
    opts = opts || {};
    el.modal.innerHTML = `<div class="modal-back"></div><div class="modal ${opts.cls || ''}">${html}</div>`;
    el.modal.classList.remove('hidden');
    el.modal.querySelector('.modal-back').onclick = () => { if (!opts.blocking) closeModal(); };
    return el.modal.querySelector('.modal');
  }
  function closeModal() { el.modal.classList.add('hidden'); el.modal.innerHTML = ''; }
  UI.closeModal = closeModal;

  UI.confirm = function (title, text, onOk) {
    const m = modal(`
      <h3>${title}</h3>
      <p class="modal-text">${text}</p>
      <div class="modal-actions">
        <button class="btn ghost" data-x="no">再想想</button>
        <button class="btn primary" data-x="yes">确认</button>
      </div>`, { blocking: true });
    m.querySelector('[data-x="no"]').onclick = closeModal;
    m.querySelector('[data-x="yes"]').onclick = () => { closeModal(); onOk && onOk(); };
  };

  /** 二选一确认：options = [{ label, cls, pick }] */
  UI.choice = function (title, text, options) {
    const btns = options.map((o, i) =>
      `<button class="btn ${o.cls || ''}" data-x="${i}">${o.label}</button>`).join('');
    const m = modal(`
      <h3>${title}</h3>
      <p class="modal-text">${text}</p>
      <div class="modal-actions">${btns}</div>`, { blocking: true });
    m.querySelectorAll('[data-x]').forEach(b => {
      b.onclick = () => { closeModal(); const o = options[+b.dataset.x]; o && o.pick && o.pick(); };
    });
  };

  UI.showResult = function (title, text, kind) {
    modal(`
      <h3 class="${kind === 'bad' ? 'bad' : 'good'}">${title}</h3>
      <p class="modal-text">${text}</p>
      <div class="modal-actions"><button class="btn primary" data-x="ok">知道了</button></div>`)
      .querySelector('[data-x="ok"]').onclick = closeModal;
  };

  UI.showCraftResult = function (r) {
    if (!r.ok) {
      modal(`
        <h3 class="bad">炸炉</h3>
        <p class="modal-text">炼制「${r.name}」失败，药材化为焦灰。<br>
        <span class="dim">本次成功率 ${(r.rate * 100).toFixed(0)}% —— 提升丹炉、天赋或境界可增加把握。</span></p>
        <div class="modal-actions"><button class="btn primary" data-x="ok">继续</button></div>`)
        .querySelector('[data-x="ok"]').onclick = closeModal;
      return;
    }
    const q = D.QUALITY[r.quality];
    modal(`
      <h3 class="good">丹成</h3>
      <p class="modal-text">
        <span class="pill-tag" style="color:${q.color};border-color:${q.color}">${q.name}</span>
        <b class="big-pill">${r.name}</b> ×${r.amount}<br>
        <span class="dim">成功率 ${(r.rate * 100).toFixed(0)}% ｜ 丹道感悟 +${r.insight}</span>
      </p>
      <div class="modal-actions"><button class="btn primary" data-x="ok">收丹</button></div>`)
      .querySelector('[data-x="ok"]').onclick = closeModal;
  };

  /* ---------------- 主渲染 ---------------- */
  /* 面板是整块 innerHTML 重建的，滚动位置得自己记着：
     否则在丹房点一张丹方，列表就跳回开头 */
  function scrollKeep() {
    const list = el.view.querySelector('.recipe-list');
    return { top: el.view.scrollTop, list: list ? list.scrollTop : 0 };
  }
  function scrollRestore(k) {
    el.view.scrollTop = k.top;
    const list = el.view.querySelector('.recipe-list');
    if (list) list.scrollTop = k.list;
  }

  function render() {
    if (exploring) return;
    const stay = lastTab === tab;          // 同一标签内重绘才保留滚动，切标签该回顶部
    const keep = stay ? scrollKeep() : null;
    lastTab = tab;
    renderHud();
    renderTabs();
    renderView();
    renderLog();
    if (keep) scrollRestore(keep);
    else el.view.scrollTop = 0;
  }
  UI.render = render;
  UI.afterAction = function () {
    G.save();
    if (exploring) { UI.syncExplore(); return; }
    render();
  };

  function renderTabs() {
    const s = S();
    const list = [
      ['shop', '丹阁'], ['order', '委托'], ['alchemy', '丹房'], ['dungeon', '秘境'],
      ['cultivate', '修炼'], ['insight', '感悟'], ['market', '市集'], ['guide', '指要']
    ];
    const taken = G.Sys.ordersTaken();
    const ready = taken.filter(o => G.Sys.orderAvailable(o) >= o.qty).length;
    const open = s.orders.length - taken.length;
    const n = ready || taken.length || open;
    el.tabs.innerHTML = list.map(([id, name]) => {
      let badge = '';
      if (id === 'order' && n) {
        badge = `<em class="badge ${ready ? 'hot' : ''}">${n}</em>`;
      }
      return `<button class="tab ${tab === id ? 'on' : ''}" data-tab="${id}">${name}${badge}</button>`;
    }).join('');
  }

  function renderHud() {
    const s = S(), info = G.dateInfo(s.day), a = P.attr();
    const need = D.expNeed(s.player.level);
    const hpPct = U.clamp(s.player.hp / a.maxHp * 100, 0, 100);
    const expPct = s.player.level >= D.MAX_LEVEL ? 100 : U.clamp(s.player.exp / need * 100, 0, 100);
    el.hud.innerHTML = `
      <div class="hud-left">
        <div class="brand">丹<em>阁</em></div>
        <div class="date">${info.text} · <span class="season">${info.seasonName}</span></div>
      </div>
      <div class="hud-stats">
        <div class="stat"><label>境界</label><b class="realm">${P.realm()}</b></div>
        <div class="stat"><label>灵石</label><b class="gold">${U.fmt(s.money)}</b></div>
        <div class="stat"><label>声望</label><b>${Math.round(s.rep)}</b></div>
        <div class="stat"><label>感悟</label><b class="ins">${Math.floor(s.insight)}</b></div>
      </div>
      <div class="hud-bars">
        <div class="bar hp"><i style="width:${hpPct}%"></i><span>气血 ${Math.round(s.player.hp)} / ${a.maxHp}</span></div>
        <div class="bar exp"><i style="width:${expPct}%"></i><span>修为 ${U.fmt(s.player.exp)} / ${U.fmt(need)}</span></div>
      </div>`;
  }

  function renderLog() {
    if (el.log.dataset.done === '1') return;
    el.log.dataset.done = '1';
    el.log.innerHTML = `<div class="log-title">见 闻</div>` +
      S().news.slice().reverse().map(n => logHtml(n)).join('');
    el.log.scrollTop = el.log.scrollHeight;
  }
  function logHtml(n) {
    return `<div class="log-item ${n.type || ''}"><span class="lt">${n.day}</span><p>${n.text}</p></div>`;
  }
  UI.pushLog = function (n) {
    if (!el.log) return;
    if (!el.log.querySelector('.log-title')) renderLog();
    el.log.insertAdjacentHTML('beforeend', logHtml(n));
    el.log.scrollTop = el.log.scrollHeight;
  };

  /* ---------------- 面板分发 ---------------- */
  function renderView() {
    if (tab === 'shop') return viewShop();
    if (tab === 'order') return viewOrders();
    if (tab === 'alchemy') return viewAlchemy();
    if (tab === 'dungeon') return viewDungeon();
    if (tab === 'cultivate') return viewCultivate();
    if (tab === 'insight') return viewInsight();
    if (tab === 'market') return viewMarket();
    if (tab === 'guide') return viewGuide();
  }

  UI.gotoGuide = function () {
    exploring = false;
    tab = 'guide';
    render();
    const v = document.getElementById('view');
    if (v) v.scrollTop = 0;
  };

  /* ---------------- 指要 ---------------- */
  /** 七门天赋点满所需感悟总量 */
  function totalTalentCost() {
    return D.TALENTS.reduce((sum, t) => {
      let n = 0;
      for (let i = 0; i < t.max; i++) n += Math.round(t.cost * Math.pow(i + 1, D.COST.talentExp));
      return sum + n;
    }, 0);
  }

  function viewGuide() {
    el.view.innerHTML = `
      <div class="card">
        <div class="card-hd"><h3>丹 阁 指 要</h3><span class="dim">城南丹师手记</span></div>
        <p class="pad">你是初出茅庐的丹师，在城南盘下一间小小的铺面。采药、炼丹、接单、售卖、精进 —— 如此往复，直到丹道大成。</p>
        <div class="flow">
          <div class="flow-node"><b>秘境</b><span>采灵草、猎妖兽、开宝箱</span></div>
          <div class="flow-arrow">→</div>
          <div class="flow-node"><b>丹房</b><span>择丹方，掌火候，开炉</span></div>
          <div class="flow-arrow">→</div>
          <div class="flow-node"><b>委托</b><span>交付订单，赚取厚利</span></div>
          <div class="flow-arrow">→</div>
          <div class="flow-node"><b>修炼</b><span>打坐破境，解锁新天地</span></div>
        </div>
      </div>

      <div class="card">
        <div class="card-hd"><h3>上 手 三 步</h3></div>
        <div class="steps">
          <div class="step"><p>点开<b>秘境</b>页，进入「<b>青木林</b>」。用方向键 / WASD 移动，或直接点击相邻格子；金色光圈就是出口。灵草可采、宝箱可开、灵泉能回血，妖兽挡路就迎上去。行动力耗尽会问你是走是留，气血耗尽才会被迫退出。</p></div>
          <div class="step"><p>回城后去<b>丹房</b>，挑一张丹方，选一种火候，点「开炉炼丹」。一炉下来会推进日期，同时积攒<b>丹道感悟</b>。</p></div>
          <div class="step"><p>到<b>委托</b>页看看墙上的求购贴，挑一张做得来的点「接下」—— 接下之后才开始计时。丹药备齐了再交单，出价通常是市价的两三倍，比零售划算得多。</p></div>
        </div>
      </div>

      <div class="card">
        <div class="card-hd"><h3>七 大 系 统</h3></div>
        <div class="guide-grid">
          <div class="gsec">
            <h4><em>委</em>委托订单</h4>
            <ul>
              <li>求购贴子会一张张挂上<b>墙</b>，你在闭关、探险时也会自己攒着等你回来。</li>
              <li>贴子在墙上<b>不计时</b>；点「接下」后才移入手上，从那一刻开始倒计时。</li>
              <li><b>常单</b>摆得久（十来日），接单后给五到十一日，出价约市价 1.5~1.9 倍。</li>
              <li><b class="key">急单</b>主顾等不及：贴子只留三到六日，<b>不接就被别人揭走</b>；但一旦你应承下来，反倒给足六到九日，出价可达市价 2.5~3.3 倍，另附感悟谢礼。</li>
              <li>手上最多同时经手 <b>3 张</b>。</li>
              <li>常单误期只是少赚一笔；<b>急单失约扣 2 点声望</b>。吃不准就先别接。</li>
            </ul>
          </div>
          <div class="gsec">
            <h4><em>秘</em>秘境探险</h4>
            <ul>
              <li>共 <b>6 处秘境</b>，境界不足无法踏入。</li>
              <li>每处秘境有<b>行动力上限</b>（境界越高越多）。耗尽后可选择返回，或<b>就地歇息一日</b>恢复六成行动力继续探。</li>
              <li>灵草 → 药材（百草叶这类杂草更是遍地皆是）；宝箱 → 稀有材料；灵泉 → 回复 42% 气血。</li>
              <li>妖兽按回合交战，可<b>出击</b>、<b>蓄力一击</b>（耗灵力）、<b>服丹</b>、<b>逃走</b>；打赢只掉<b>灵石与材料</b>，不涨修为。</li>
              <li>嫌路不好走，可点「<b>重置秘境</b>」：就当这一趟没进去过，地形重掷、行动力回满，本次收获一并退回。</li>
            </ul>
          </div>
          <div class="gsec">
            <h4><em>炼</em>丹房炼丹</h4>
            <ul>
              <li>共 <b>15 张丹方</b>，随境界参悟获得。</li>
              <li>丹方上会标出这种丹药的<b>库中存量</b>与<b>能交几单</b>，一眼看出该补炼什么。</li>
              <li>火候四选一：<span class="key">文火</span>稳妥、<span class="key">武火</span>求质、<span class="key">急火</span>省时。</li>
              <li>成丹分<b>下品 / 中品 / 上品 / 极品</b>四档，品质越高售价与药效越强。</li>
              <li>缺料时丹房会直接标出该去哪儿找，也可以去<b>市集</b>采买补货。</li>
            </ul>
          </div>
          <div class="gsec">
            <h4><em>营</em>丹阁零售</h4>
            <ul>
              <li>上架后每天有零星散客自动买走，<b>利薄量小，只是保底</b>。</li>
              <li>散客只肯出<b>公道价以下</b>的价钱；标价过高就无人问津。</li>
              <li>定价公道可累积声望，<b>声望越高客流越大</b>。</li>
              <li>想赚大钱，还得靠委托订单。</li>
            </ul>
          </div>
          <div class="gsec">
            <h4><em>修</em>打坐修炼</h4>
            <ul>
              <li>境界自<b>炼气期</b>起一步一境：炼气期不再分一到九层，修为圆满便能直接破入<b>筑基初期</b>。</li>
              <li>修为圆满方可<b>突破</b>，境界越高成功率越低（服破境丹可加成）。</li>
              <li>每破一境，气血攻防<b>成倍跃升</b>，并解锁新丹方与新秘境。修炼页会写明「突破后」的具体收益。</li>
              <li>突破失败只损失部分修为，不会身死。</li>
            </ul>
          </div>
          <div class="gsec">
            <h4><em>感</em>丹道感悟</h4>
            <ul>
              <li>成丹、探索、交单、静坐都会积累感悟。</li>
              <li>可参悟 <b>7 条天赋</b>：成功率、品质、一炉双丹、售价、修炼速度、体质、声望。</li>
              <li>参悟<b>既耗感悟，也耗灵石</b>，两者都随层数递增。</li>
              <li>七门点满共需 <b>${U.fmt(totalTalentCost())}</b> 感悟；灵石另算，境界越高越贵。</li>
              <li>天赋是<b>永久加成</b>，早点点出关键几层最划算。</li>
            </ul>
          </div>
          <div class="gsec">
            <h4><em>市</em>市集买卖</h4>
            <ul>
              <li>药商坐地起价：买入是行价的 <b>${D.MARKET_BUY} 倍</b>，卖出只给 <b>${Math.round(D.MARKET_SELL * 100)}%</b>。</li>
              <li><b>买料炼丹再零售，几乎必亏</b> —— 药材得自己下秘境采。</li>
              <li>市集只用来应急补一两味缺药，或者把多余的存货折价换灵石。</li>
            </ul>
          </div>
          <div class="gsec">
            <h4><em>财</em>灵石开销</h4>
            <ul>
              <li><b>打坐布阵</b>：每日耗灵石，境界越高越贵；灵石见底就坐不下去。一枚<b>上品丹</b>的进项，大约够同级坐上两三日 —— 想快些精进，先想法子多赚钱。</li>
              <li><b>焚香悟道</b>：耗灵石换感悟，一次 ${D.meditateCost(1)}～${D.meditateCost(D.MAX_LEVEL)} 灵石。</li>
              <li><b>参悟天赋</b>：感悟与灵石<b>双重消耗</b>，越往上层越贵。</li>
              <li><b>市集买药</b>：行价两倍半，应急才用。</li>
              <li><b>升级丹炉与扩建店面</b>：一次性大额支出。</li>
              <li>赚钱的正路只有两条：<b>接委托</b>，和<b>下秘境采药</b>。</li>
            </ul>
          </div>
        </div>
      </div>

      <div class="grid2">
        <div class="card">
          <div class="card-hd"><h3>火 候 对 照</h3><span class="dim">按丹方难度自行取舍</span></div>
          <table class="tips">
            <tr><th>火候</th><th>成功率</th><th>品质</th><th>工期</th></tr>
            <tr><td>文火慢炼</td><td class="num">+20%</td><td>略降</td><td>不变</td></tr>
            <tr><td>中火守正</td><td class="num">±0</td><td>不变</td><td>不变</td></tr>
            <tr><td>武火猛攻</td><td class="num">-22%</td><td>大幅提升</td><td>不变</td></tr>
            <tr><td>急火抢时</td><td class="num">-10%</td><td>略降</td><td>缩短一天</td></tr>
          </table>
          <p class="dim pad" style="font-size:12px">
            丹房会把每个火候的<b>实际概率</b>算成条形图：先掷成败，成丹后再定品质。
            所以「武火」虽然一半会炸炉，却是唯一有像样机会炼出极品的火候。</p>
        </div>
        <div class="card">
          <div class="card-hd"><h3>品 质 与 增 益</h3></div>
          <table class="tips">
            <tr><th>品质</th><th>售价倍率</th><th>药效倍率</th></tr>
            <tr><td>下品</td><td class="num">×1.00</td><td class="num">×1.00</td></tr>
            <tr><td>中品</td><td class="num">×1.55</td><td class="num">×1.55</td></tr>
            <tr><td>上品</td><td class="num">×2.35</td><td class="num">×2.35</td></tr>
            <tr><td>极品</td><td class="num">×3.60</td><td class="num">×3.60</td></tr>
          </table>
          <p class="dim pad" style="font-size:12px">丹炉每升一级：成功率 +5%~+24%，品质同步提升。</p>
        </div>
      </div>

      <div class="card">
        <div class="card-hd"><h3>常 见 疑 问</h3></div>
        <div class="faq">
          <div class="faq-item"><b>订单做不出来怎么办？</b>
            <p>墙上的贴子<b>接之前不计时</b>，先想清楚再动手：这批药材够不够、这几天有没有别的事要忙。万一接了之后发现赶不上，可以「放弃」把委托退还回去，不扣声望，只是白忙一场；放着不管才会误期 —— 常单只是少赚，<b>急单失约扣 2 点声望</b>。</p></div>
          <div class="faq-item"><b>丹药定价该怎么定？</b>
            <p>零售客人只肯出公道价以下的钱，标高了就是摆设，货架会标出「好卖 / 尚可 / 难出手」。所以零售只当保底：压低价格走量、攒声望。<b>真正的利润在委托订单</b>，那边出价通常是市价的两三倍。</p></div>
          <div class="faq-item"><b>为什么炼丹反而亏钱？</b>
            <p>药商坐地起价，<b>买价是行价的 ${D.MARKET_BUY} 倍</b>；算上这笔料钱，买料炼丹再零售基本是赔本买卖。真正的路子是<b>自己下秘境采药</b>——同样是那几味药，采来的不要钱。市集只留着应急补一两味缺药。</p></div>
          <div class="faq-item"><b>灵石不够修炼怎么办？</b>
            <p>打坐要布聚灵阵，每日都得烧灵石，见底就坐不下去。这时别硬扛，去<b>秘境</b>走一趟：采来的药材能炼丹、能交委托，用不上还能折价卖给市集。攒够这一境的打坐钱，再回来闭关。</p></div>
          <div class="faq-item"><b>该炼什么丹？</b>
            <p>看丹房：丹方右上角写着这种丹药的<b>存量</b>以及<b>能交几张订单</b>。标红就是有人在等着、而你手上没有；标黄说明交了一部分、还差些；绿色说明够了。想留着自己服用或上架零售的，也可以照库存挑着炼。</p></div>
          <div class="faq-item"><b>火候该怎么选？</b>
            <p>看丹房的「开炉预估」条形图，它按你当前的丹炉与境界把真实概率算了出来：灰色是炸炉，后面四段是成丹后的品质分布。要保底就走<span class="key">文火</span>（成功率高，但基本出不了极品）；想赚大钱就赌<span class="key">武火</span>，一半会炸，可一旦成丹，出极品的概率是其他火候的好几倍。急着交单再考虑<span class="key">急火</span>省那一天。</p></div>
          <div class="faq-item"><b>为什么总是炸炉？</b>
            <p>三件事能救你：升级<b>丹炉</b>、参悟<b>火候精熟</b>天赋、提高<b>自身境界</b>（境界高于丹方需求会有额外加成）。拿不准的丹方先用文火慢炼试水。</p></div>
          <div class="faq-item"><b>秘境里路不好走怎么办？</b>
            <p>点状态栏右侧的「<b>重置秘境</b>」——就当这一趟没进去过：地形与灵材重新生成，行动力恢复如初。已采到的药材与打怪得的灵石会一并退回，所以反复重掷也占不到便宜，纯粹是给你换条路走。</p></div>
          <div class="faq-item"><b>秘境里行动力用完了怎么办？</b>
            <p>会弹出一个选择：<b>带着收获返回</b>，或<b>就地歇息一日</b>恢复六成行动力与部分气血，继续往深处走。已采到的材料无论如何都会保留。</p></div>
          <div class="faq-item"><b>气血太低还能进秘境吗？</b>
            <p>低于三成会被劝住。可以在修炼页服用疗伤丹，或干脆打坐几日 —— 每日自然恢复约两成气血。</p></div>
          <div class="faq-item"><b>时间会流逝吗？</b>
            <p>会。打坐、炼丹、探险都在推进日子，店铺每天自动营业一次，订单也在悄悄累积、悄悄逼近期限。日子走到月份与节气，客流也会随季节浮动。</p></div>
          <div class="faq-item"><b>进度会保存吗？</b>
            <p>会。游戏随时自动存档（本地浏览器），下次打开自动续上。点右上角「重开」可另起炉灶。</p></div>
        </div>
      </div>`;
  }

  /* ---------------- 委托订单 ---------------- */
  function orderCard(o) {
    const s = S();
    const pill = D.PILLS[o.pillId];
    const have = G.Sys.orderAvailable(o);
    const ready = have >= o.qty;
    const left = G.Sys.orderLeft(o);
    const taken = o.state === 'taken';
    const urgent = taken && o.rush && left <= 1;
    const qname = o.minQuality > 0 ? `${D.QUALITY[o.minQuality].name}以上` : '不限品质';

    const foot = taken
      ? `<span class="ord-left ${urgent || left <= 0 ? 'bad-t' : ''}">${left <= 0 ? '今日截止' : `剩 ${left} 日`}</span>
         <span class="ord-stock ${ready ? 'good-t' : 'dim'}">库存 ${have}/${o.qty}</span>
         <button class="btn primary" data-act="deliver" data-id="${o.id}" ${ready ? '' : 'disabled'}>交 付</button>
         <button class="btn tiny ghost" data-act="remove" data-id="${o.id}">放弃</button>`
      : `<span class="ord-left dim">${left} 日后撤贴</span>
         <span class="ord-stock ${ready ? 'good-t' : 'dim'}">库存 ${have}/${o.qty}</span>
         <button class="btn primary" data-act="accept" data-id="${o.id}">${ready ? '接下并交付' : '接 下'}</button>
         <button class="btn tiny ghost" data-act="remove" data-id="${o.id}">略过</button>`;

    return `<div class="ord ${taken ? '' : 'pending'} ${o.rush ? 'rush' : ''} ${ready && taken ? 'ready' : ''}">
      <div class="ord-hd">
        <span class="ord-dot" style="background:${o.color}"></span>
        <b>${o.customerName}</b>
        ${o.rush ? '<span class="tag rush">急单</span>' : '<span class="tag">常单</span>'}
        ${taken ? '' : '<span class="tag open-tag">待接</span>'}
        <span class="ord-reason">${o.reason}</span>
      </div>
      <div class="ord-want">
        求购 <b>${pill.name}</b> ×${o.qty}
        <span class="ord-q">${qname}</span>
        ${taken ? '' : `<span class="ord-q">限 ${o.days} 日</span>`}
      </div>
      <div class="ord-meta">
        <span>报酬 <b class="gold">${U.fmt(o.reward)}</b> 灵石</span>
        <span class="dim">声望 +${o.rep}</span>
        ${o.insight ? `<span class="dim">感悟 +${o.insight}</span>` : ''}
      </div>
      <div class="ord-ft">${foot}</div>
    </div>`;
  }

  function viewOrders() {
    const s = S();
    const taken = G.Sys.ordersTaken();
    const open = G.Sys.ordersOpen();
    const readyCount = taken.filter(o => G.Sys.orderAvailable(o) >= o.qty).length;

    const stats = `<div class="grid3">
      <div class="mini"><label>累计完成</label><b>${s.stats.ordersDone}</b></div>
      <div class="mini"><label>误期 / 失约</label><b>${s.stats.ordersFailed}</b></div>
      <div class="mini"><label>订单收入</label><b class="gold">${U.fmt(s.stats.orderIncome)}</b></div>
    </div>`;

    const takenBlock = `<div class="card">
      <div class="card-hd"><h3>手 上 的 委 托</h3>
        <span class="dim">${taken.length}/${D.ORDERS.takeMax} ｜ 已在计时</span></div>
      ${taken.length
        ? `<div class="ord-list">${taken.map(orderCard).join('')}</div>
           <div class="card-ft">
             <span class="dim">常单误期只是少赚一笔；急单失约要扣声望。</span>
             <button class="btn" data-act="deliver-all" ${readyCount ? '' : 'disabled'}>一键交付（${readyCount}）</button>
           </div>`
        : '<p class="pad dim">手上还没有委托。到下面的墙上挑几张接下 —— 接下之后才开始计日。</p>'}
    </div>`;

    const openBlock = `<div class="card">
      <div class="card-hd"><h3>墙 上 的 求 购</h3>
        <span class="dim">${open.length}/${D.ORDERS.openMax} ｜ 待接，不计时</span></div>
      ${open.length
        ? `<div class="ord-list">${open.map(orderCard).join('')}</div>
           <div class="card-ft"><span class="dim">贴子挂在墙上不计日，挂久了会被主顾揭走；接单不要本钱，交单时才扣库存。</span></div>`
        : '<p class="pad dim">墙上暂时空着。去做点别的事 —— 打坐、探险、炼丹，新的求购会一张张挂上来。</p>'}
    </div>`;

    el.view.innerHTML = `
      <div class="card">
        <div class="card-hd"><h3>委 托 订 单</h3>
          <span class="dim">手上 ${taken.length}/${D.ORDERS.takeMax} ｜ 墙上 ${open.length}/${D.ORDERS.openMax} ｜ 可交付 ${readyCount}</span></div>
        <p class="pad dim">贴子在墙上时不计时，<b>接下之后才开始倒计时</b>。拿不准的单子就先放着 —— 但墙上位置有限，一般也就摆十来天。</p>
      </div>
      ${takenBlock}
      ${openBlock}
      ${stats}`;
  }

  /* ---------------- 丹阁（商店） ---------------- */
  function pillLabel(key) {
    const { pill, quality } = G.parsePillKey(key);
    return `<span class="qn" style="color:${quality.color}">${quality.name}</span>${pill.name}`;
  }

  function viewShop() {
    const s = S(), a = P.attr();
    const limit = G.Sys.shelfLimit();
    const season = D.SEASONS[G.dateInfo(s.day).season];

    const shelf = s.shelf.map((it, i) => {
      const info = G.parsePillKey(it.key);
      const fair = Math.round(info.pill.price * info.quality.mult * P.priceMul());
      const tag = it.price <= fair * 0.72 ? '<span class="tag good">好卖</span>'
        : it.price <= fair * 1.0 ? '<span class="tag">尚可</span>' : '<span class="tag bad">难出手</span>';
      return `<div class="slot">
        <div class="slot-name">${pillLabel(it.key)}</div>
        <div class="slot-mid">
          <input class="inp price" type="number" min="1" value="${it.price}"
                 data-act="price" data-idx="${i}">
          <span class="dim">灵石 · 存 ${it.count}</span>
        </div>
        <div class="slot-right">${tag}<button class="btn tiny ghost" data-act="unshelf" data-idx="${i}">下架</button></div>
      </div>`;
    }).join('') + Array.from({ length: Math.max(0, limit - s.shelf.length) })
      .map(() => `<div class="slot empty">空货位</div>`).join('');

    // 库存里哪些丹药正被订单求购
    const wanted = {};
    for (const o of s.orders) wanted[o.pillId] = (wanted[o.pillId] || 0) + o.qty;

    const keys = Object.keys(s.pills).filter(k => s.pills[k] > 0);
    const stock = keys.length ? keys.map(k => {
      const info = G.parsePillKey(k);
      const fair = Math.round(info.pill.price * info.quality.mult * P.priceMul());
      const w = wanted[info.id];
      return `<div class="pill-row">
        <span class="pr-name">${pillLabel(k)}${w ? `<span class="tag rush plain">有求购 ×${w}</span>` : ''}</span>
        <span class="pr-cnt">×${s.pills[k]}</span>
        <input class="inp price" type="number" min="1" value="${fair}" data-act="askprice" data-key="${k}">
        <button class="btn tiny" data-act="shelf" data-key="${k}">上架</button>
      </div>`;
    }).join('') : '<p class="dim pad">库存中没有丹药，去丹房炼几炉吧。</p>';

    const taken = G.Sys.ordersTaken();
    const readyCount = taken.filter(o => G.Sys.orderAvailable(o) >= o.qty).length;
    const openCount = s.orders.length - taken.length;

    el.view.innerHTML = `
      <div class="card shop-notice">
        <div class="card-hd"><h3>生 意 门 道</h3></div>
        <div class="grid2" style="align-items:stretch">
          <div class="notice-item">
            <b>零售</b>
            <p>路过的散客顺手买几枚，<b>只肯出公道价以下的价钱</b>，图的是薄利多销。</p>
          </div>
          <div class="notice-item accent">
            <b>委托订单</b>
            <p>出价可达市价两三倍，才是丹阁真正的进项。手上 <b>${taken.length}</b> 张委托${readyCount ? `（<b class="good-t">${readyCount}</b> 张可交付）` : ''}，墙上另有 <b>${openCount}</b> 张待接。</p>
            <button class="btn primary" data-act="goto-order">去看订单</button>
          </div>
        </div>
        <p class="pad dim" style="margin-top:10px">灵石的去处：<b>打坐布阵</b>（每日耗）、<b>焚香悟道</b>、<b>市集买药</b>（行价两倍半）、<b>升级丹炉与店面</b>。
          药商坐地起价，买料炼丹再零售多半要亏本 —— 药材还是自己下秘境采划算。</p>
      </div>
      <div class="grid2">
        <div class="card">
          <div class="card-hd"><h3>货 架</h3>
            <span class="dim">${s.shelf.length}/${limit} ｜ 每日散客约 ${P.customersPerDay()} 人 ｜ ${season.name}：${season.tip}</span>
          </div>
          <div class="shelf-list">${shelf}</div>
          <div class="card-ft">
            <button class="btn ghost" data-act="expand">扩建店面（${U.fmt(Math.round(1200 * Math.pow(1.8, s.flags.shelfBonus || 0)))} 灵石）</button>
            <span class="dim">${s.flags.stalePrice ? `<span class="bad-t">昨日有 ${s.flags.stalePrice} 位散客嫌贵空手走了。</span>` : '定价压到公道价以下，散客才会掏钱。'}</span>
          </div>
        </div>
        <div class="card">
          <div class="card-hd"><h3>丹 药 库 存</h3><span class="dim">上架后仍可「下架」取回自用</span></div>
          <div class="stock-list">${stock}</div>
        </div>
      </div>
      <div class="grid3">
        <div class="mini"><label>累计售出（含订单）</label><b>${s.stats.sales}</b></div>
        <div class="mini"><label>订单收入</label><b class="gold">${U.fmt(s.stats.orderIncome)}</b></div>
        <div class="mini"><label>丹炉</label><b>${P.fountain().name}</b></div>
      </div>`;

    // 首日引导
    if (s.flags.tutorial && s.day <= 3) {
      el.view.insertAdjacentHTML('afterbegin',
        `<div class="hint-bar">初来乍到：先去<b>秘境</b>采些药材，回<b>丹房</b>炼成丹药，再到<b>委托</b>页看看有没有人求购 —— 订单出价可比零售高得多。右上「玩法」里有完整的《指要》。</div>`);
    }
  }

  /* ---------------- 丹房 ---------------- */
  /** 材料获取途径（结果做了缓存，数据表是静态的） */
  const srcCache = {};
  function matSource(id) {
    if (srcCache[id]) return srcCache[id];
    const gather = [], chest = [], kill = [];
    for (const dg of D.DUNGEONS) {
      if (dg.gathers.indexOf(id) >= 0) gather.push(dg.name);
      if (dg.chests.indexOf(id) >= 0) chest.push(dg.name);
      for (const eid of dg.enemies) {
        const e = D.ENEMIES[eid];
        if (e.loot.indexOf(id) >= 0) kill.push(e.name);
      }
    }
    const parts = [];
    if (gather.length) parts.push([...new Set(gather)].join('/') + '采集');
    if (chest.length) parts.push([...new Set(chest)].join('/') + '宝箱');
    if (kill.length) parts.push('猎杀' + [...new Set(kill)].join('/'));
    if (D.MARKET.indexOf(id) >= 0) parts.push('市集有售');
    return (srcCache[id] = parts.join('、') || '来源不明');
  }

  function viewAlchemy() {
    const s = S(), f = P.fountain();
    if (!selRecipe || s.recipes.indexOf(selRecipe) < 0) selRecipe = s.recipes[0];

    const cards = s.recipes.map(id => {
      const r = D.RECIPES.find(x => x.id === id);
      const pill = D.PILLS[r.pill];
      const ok = G.hasMats(r.mats);

      // 库存徽标：把「手上有几枚」和「够不够交单」一起说清楚
      const myOrders = s.orders.filter(o => o.pillId === r.pill);
      const want = myOrders.reduce((a, o) => a + o.qty, 0);
      const stock = G.pillStock(r.pill);
      let stockHtml;
      if (myOrders.length) {
        const canDeliver = myOrders.filter(o => G.Sys.orderAvailable(o) >= o.qty).length;
        const cls = canDeliver === myOrders.length ? 'ok' : (canDeliver ? 'mid' : 'short');
        stockHtml = `<span class="rc-stock ${cls}"
          title="库存：${stock.detail}；现有 ${myOrders.length} 张订单，其中 ${canDeliver} 张可立即交付">存 ${stock.total} · 可交 ${canDeliver}/${myOrders.length} 单</span>`;
      } else if (stock.total) {
        stockHtml = `<span class="rc-stock ok" title="库存：${stock.detail}">存 ${stock.total}</span>`;
      } else {
        stockHtml = `<span class="rc-stock none">库中无存</span>`;
      }

      const matHtml = Object.keys(r.mats).map(k => {
        const have = s.bag[k] || 0, need = r.mats[k];
        return `<span class="mat ${have >= need ? '' : 'lack'}" title="来源：${matSource(k)}">${D.MATERIALS[k].name} ${have}/${need}</span>`;
      }).join('');
      const rate = Math.round(U.clamp(P.craftRate(r) + (D.FIRES.find(x => x.id === selFire) || {}).suc, 0.05, 0.99) * 100);
      const lackTip = ok ? '' : '<span class="lack-tip">缺 ' + Object.keys(r.mats)
        .filter(k => (s.bag[k] || 0) < r.mats[k])
        .map(k => `${D.MATERIALS[k].name}（${matSource(k)}）`).join('，') + '</span>';
      return `<div class="recipe ${selRecipe === id ? 'on' : ''}" data-act="pick-recipe" data-id="${id}">
        <div class="rc-hd"><b>${pill.name}</b>
          <span class="rc-hd-r">${stockHtml}<span class="dim">${r.days} 日</span></span>
        </div>
        <div class="rc-tag"><span class="tag ${tagCls(pill.tag)}">${tagName(pill.tag)}</span>
          ${want ? `<span class="tag rush plain">求购 ×${want}</span>` : ''}
          <span class="dim">基准价 ${pill.price}</span></div>
        <div class="rc-mats">${matHtml}</div>
        <div class="rc-ok">${ok ? `<span class="good-t">药材齐备 · 成功率约 ${rate}%</span>` : `<span class="bad-t">药材不足</span> ${lackTip}`}</div>
      </div>`;
    }).join('');

    const fires = D.FIRES.map(x =>
      `<button class="fire ${selFire === x.id ? 'on' : ''}" data-act="pick-fire" data-id="${x.id}">
        <b>${x.name}</b><span>${x.desc}</span></button>`).join('');

    const r = D.RECIPES.find(x => x.id === selRecipe);
    const curFire = D.FIRES.find(x => x.id === selFire);
    const curRate = U.clamp(P.craftRate(r) + curFire.suc, 0.05, 0.99);
    const pickStock = G.pillStock(r.pill);
    const nextF = D.FURNACES[s.player.furnace];

    /* 开炉预估：先掷成败，成丹后再按加权掷品质，故各段为「绝对概率」 */
    const odds = G.Sys.qualityOdds(P.craftQuality(r) + curFire.quality);
    const segs = [{ name: '炸炉', p: 1 - curRate, color: '#d3d8d4', fail: true }]
      .concat(odds.map((p, q) => ({ name: D.QUALITY[q].name, p: p * curRate, color: D.QUALITY[q].color })));
    const bestP = (odds[2] + odds[3]) * curRate;          // 出上品及以上的把握
    const oddsHtml = `<div class="odds">
      <div class="odds-hd"><span>开 炉 预 估</span>
        <span class="dim">上品及以上 <b class="hi">${(bestP * 100).toFixed(0)}%</b></span></div>
      <div class="odds-bar">
        ${segs.map(x => `<i style="flex:${x.p.toFixed(4)};background:${x.color}"
          title="${x.name} ${(x.p * 100).toFixed(1)}%"></i>`).join('')}
      </div>
      <div class="odds-legend">
        ${segs.map(x => `<span class="${x.fail ? 'fail' : ''}"><em style="background:${x.color}"></em>${x.name}
          <b>${(x.p * 100).toFixed(0)}%</b></span>`).join('')}
      </div>
    </div>`;

    el.view.innerHTML = `
      <div class="grid2 wide-left">
        <div class="card">
          <div class="card-hd"><h3>丹 方</h3><span class="dim">共 ${s.recipes.length} 张</span></div>
          <div class="recipe-list">${cards}</div>
        </div>
        <div>
          <div class="card">
            <div class="card-hd"><h3>火 候</h3></div>
            <div class="fire-list">${fires}</div>
            ${oddsHtml}
            <div class="card-ft">
              <span class="dim">预计成功率 <b class="hi">${Math.round(curRate * 100)}%</b>　｜　${D.PILLS[r.pill].name} 库中
                <b class="${pickStock.total ? 'hi' : 'dim'}">${pickStock.total}</b> 枚
                ${pickStock.total ? `<span class="stock-detail">${pickStock.detail}</span>` : ''}</span>
              <button class="btn primary" data-act="craft">开炉炼丹</button>
            </div>
          </div>
          <div class="card">
            <div class="card-hd"><h3>丹 炉</h3></div>
            <p class="pad">当前：<b>${f.name}</b>　成功率 +${(f.suc * 100).toFixed(0)}%　品质 +${(f.quality * 100).toFixed(0)}%</p>
            <p class="dim pad">${f.desc}</p>
            ${nextF ? `<div class="card-ft"><span class="dim">下一级：${nextF.name}（${U.fmt(nextF.cost)} 灵石）</span>
              <button class="btn ghost" data-act="furnace">升级丹炉</button></div>`
        : '<div class="card-ft"><span class="dim">丹炉已臻绝品。</span></div>'}
          </div>
        </div>
      </div>`;
  }

  function tagCls(t) {
    return t === 'cultivation' ? 'cult' : t === 'heal' ? 'heal' : t === 'buff' ? 'buff'
      : t === 'beauty' ? 'beauty' : 'rare';
  }
  function tagName(t) {
    return { cultivation: '修炼', heal: '疗伤', buff: '增益', beauty: '养颜', rare: '珍稀', poison: '毒物' }[t] || t;
  }

  /* ---------------- 秘境 ---------------- */
  function viewDungeon() {
    const s = S();
    const list = D.DUNGEONS.map(d => {
      const lock = s.player.level < d.req;
      const mats = Array.from(new Set(d.gathers.concat(d.chests)));
      const enemies = Array.from(new Set(d.enemies)).map(e => D.ENEMIES[e].name).join('、');
      return `<div class="dg-card ${lock ? 'lock' : ''}">
        <div class="dg-hd">
          <b>${d.name}</b>
          <span class="dim">${d.days} 日路程 ｜ 需 ${D.REALMS[d.req]}</span>
        </div>
        <p class="dg-desc">${d.desc}</p>
        <div class="dg-mats">${mats.map(m => `<span class="mat">${D.MATERIALS[m].name}</span>`).join('')}</div>
        <div class="dg-enemy dim">出没：${enemies}</div>
        <div class="dg-ft">
          ${lock ? `<span class="bad-t">境界不足</span>`
        : `<button class="btn primary" data-act="enter" data-id="${d.id}">进入秘境</button>`}
        </div>
      </div>`;
    }).join('');

    el.view.innerHTML = `
      <div class="card">
        <div class="card-hd"><h3>秘 境 探 险</h3>
          <span class="dim">途中会遇到妖兽与灵材，气血耗尽会被迫退出</span></div>
        <div class="dg-list">${list}</div>
        <p class="dim pad" style="font-size:12px">妖兽只掉<b>材料与灵石</b>，不涨修为 —— 修为得靠回城打坐与服丹。秘境是赚钱采药的地方，修行还得在静室里熬。</p>
      </div>
      <div class="grid3">
        <div class="mini"><label>已探索次数</label><b>${s.stats.explored}</b></div>
        <div class="mini"><label>击杀妖兽</label><b>${s.stats.kills}</b></div>
        <div class="mini"><label>当前气血</label><b>${Math.round(s.player.hp)} / ${P.attr().maxHp}</b></div>
      </div>`;
  }

  /* ---------------- 探险视图 ---------------- */
  UI.showExplore = function (d) {
    exploring = true;
    tab = 'dungeon';
    el.tabs.innerHTML = `<button class="tab on">秘境 · ${d.name}</button>`;
    el.view.innerHTML = `
      <div class="explore-wrap">
        <div class="explore-top">
          <div class="et-item"><label>秘境</label><b>${d.name}</b></div>
          <div class="et-item"><label>行动力</label><b id="et-ap">-</b></div>
          <div class="et-item"><label>气血</label><b id="et-hp">-</b></div>
          <div class="et-item"><label>灵力</label><b id="et-mp">-</b></div>
          <div class="et-item"><label>收获</label><b id="et-gain" class="dim">暂无</b></div>
          <div class="et-btns">
            <button class="btn ghost" id="btn-reset-dungeon"
              title="就当这一趟没进去过：重掷地形、行动力回满、本次收获退回">重置秘境</button>
            <button class="btn ghost" id="btn-leave">撤退回城</button>
          </div>
        </div>
        <div class="canvas-box">
          <canvas id="dg-canvas" width="${22 * 42}" height="${14 * 42}"></canvas>
          <div id="battle-layer" class="hidden"></div>
        </div>
        <div class="explore-hint">方向键 / WASD 移动，或点击相邻格子　｜　灵草可采、宝箱可开、灵泉回血、金色光圈即出口　｜　行动力耗尽可返回或就地歇息</div>
      </div>`;
    const lv = $('btn-leave');
    if (lv) lv.onclick = () => G.UI.confirm('撤退', '现在返回丹阁？收获会保留。', () => G.Scene.leave());
    const rs = $('btn-reset-dungeon');
    if (rs) rs.onclick = () => G.UI.confirm('重置秘境',
      `就当这一趟没进去过，重新寻路进去。<br>
       <span class="dim">地形与灵材重新生成，行动力恢复如初；这一趟已采到的药材与灵石会一并退回。</span>`,
      () => G.Scene.resetDungeon());
    UI.syncExplore();
  };

  UI.syncExplore = function () {
    if (!exploring) return;
    const s = G.Scene.getState();
    if (!s) return;
    const ap = $('et-ap'); if (ap) ap.textContent = `${s.ap} / ${s.maxAp}`;
    const hp = $('et-hp'); if (hp) hp.textContent = `${Math.round(S().player.hp)} / ${P.attr().maxHp}`;
    const mp = $('et-mp'); if (mp) mp.textContent = `${Math.round(S().player.mp)} / ${S().player.maxMp}`;
    const g = $('et-gain');
    if (g) {
      const parts = Object.keys(s.gain).map(k => `${D.MATERIALS[k].name}×${s.gain[k]}`);
      g.textContent = parts.length ? parts.join('、') : '暂无';
      g.classList.toggle('dim', !parts.length);
    }
  };

  UI.closeExplore = function () {
    exploring = false;
    selRecipe = null;
    tab = 'shop';
    render();
  };

  /* ---------------- 战斗界面 ---------------- */
  UI.showBattle = function (b, e) {
    const layer = $('battle-layer');
    if (!layer) return;
    layer.classList.remove('hidden');
    layer.innerHTML = `
      <div class="bt-panel">
        <div class="bt-top">
          <div class="bt-info">
            <b class="bt-name">${b.name}</b>
            <div class="hpbar enemy"><i id="bt-ehp" style="width:100%"></i></div>
            <span class="bt-num" id="bt-ehp-t">${b.hp} / ${b.maxHp}</span>
          </div>
        </div>
        <div class="bt-log" id="bt-log"></div>
        <div class="bt-bottom">
          <div class="bt-info">
            <b class="bt-name">你 · ${P.realm()}</b>
            <div class="hpbar player"><i id="bt-php" style="width:100%"></i></div>
            <span class="bt-num" id="bt-php-t">${Math.round(S().player.hp)} / ${P.attr().maxHp}</span>
          </div>
          <div class="bt-actions" id="bt-actions"></div>
        </div>
        <div class="bt-float" id="bt-float"></div>
      </div>`;
    layer.querySelector('#bt-actions').addEventListener('click', ev => {
      const btn = ev.target.closest('[data-bt]');
      if (!btn) return;
      const act = btn.dataset.bt;
      if (act === 'atk') G.Scene.playerAttack(1, 0, '你一掌拍出');
      else if (act === 'power') G.Scene.playerAttack(1.9, 20, '你运起灵力全力一击');
      else if (act === 'flee') G.Scene.flee();
      else if (act === 'item') showItemMenu();
    });
    UI.updateBattle(b);
  };

  function showItemMenu() {
    const s = S();
    const keys = Object.keys(s.pills).filter(k => {
      const { pill } = G.parsePillKey(k);
      return s.pills[k] > 0 && (pill.effect.heal || pill.effect.buff);
    });
    const m = modal(`
      <h3>服用丹药</h3>
      <div class="item-list">${keys.length ? keys.map(k =>
      `<button class="btn ghost wide" data-key="${k}">${pillLabel(k)} ×${s.pills[k]}</button>`).join('')
      : '<p class="dim">没有可用于战斗的丹药。</p>'}</div>
      <div class="modal-actions"><button class="btn ghost" data-x="close">取消</button></div>`);
    m.querySelectorAll('[data-key]').forEach(btn => {
      btn.onclick = () => { G.Scene.useItemInBattle(btn.dataset.key); closeModal(); };
    });
    m.querySelector('[data-x="close"]').onclick = closeModal;
  }

  UI.updateBattle = function (b) {
    const ehp = $('bt-ehp'); if (!ehp) return;
    ehp.style.width = U.clamp(b.hp / b.maxHp * 100, 0, 100) + '%';
    $('bt-ehp-t').textContent = `${Math.max(0, b.hp)} / ${b.maxHp}`;
    const a = P.attr();
    $('bt-php').style.width = U.clamp(S().player.hp / a.maxHp * 100, 0, 100) + '%';
    $('bt-php-t').textContent = `${Math.max(0, Math.round(S().player.hp))} / ${a.maxHp}`;
    const log = $('bt-log');
    log.innerHTML = b.log.map((t, i) => `<div class="${i === 0 ? 'cur' : ''}">${t}</div>`).join('');
    const acts = $('bt-actions');
    if (!acts) return;
    acts.innerHTML = `
      <button class="btn primary" data-bt="atk" ${b.over ? 'disabled' : ''}>出 击</button>
      <button class="btn" data-bt="power" ${b.over ? 'disabled' : ''}>蓄力一击 (20灵力)</button>
      <button class="btn ghost" data-bt="item" ${b.over ? 'disabled' : ''}>服 丹</button>
      <button class="btn ghost" data-bt="flee" ${b.over ? 'disabled' : ''}>逃 走</button>`;
  };

  UI.flashBattle = function (who, dmg) {
    const f = $('bt-float');
    if (!f) return;
    const d = document.createElement('div');
    d.className = 'dmg ' + who;
    d.textContent = '-' + dmg;
    f.appendChild(d);
    setTimeout(() => d.remove(), 900);
  };

  UI.hideBattle = function () {
    const layer = $('battle-layer');
    if (layer) { layer.classList.add('hidden'); layer.innerHTML = ''; }
  };

  /* ---------------- 修炼 ---------------- */
  function viewCultivate() {
    const s = S(), a = P.attr();
    const need = D.expNeed(s.player.level);
    const can = G.Sys.canBreak();
    const rate = Math.round(P.breakRate() * 100);
    const stockKeys = Object.keys(s.pills).filter(k => s.pills[k] > 0);

    const buffs = s.buffs.length ? s.buffs.map(b =>
      `<span class="buff">${b.name}（${b.days}日）</span>`).join('') : '<span class="dim">无</span>';

    const usable = stockKeys.filter(k => {
      const { pill } = G.parsePillKey(k);
      return pill.effect.exp || pill.effect.heal || pill.effect.perm || pill.effect.insight;
    });

    // 突破预览：让玩家看清这一步能换来什么
    const nextLv = s.player.level + 1;
    const nextRealm = nextLv <= D.MAX_LEVEL ? D.REALMS[nextLv] : null;
    const nextSt = nextRealm ? D.STATS[nextLv] : null;
    const curSt = D.STATS[s.player.level] || nextSt;
    const nextRealmHtml = nextRealm
      ? `<div class="break-preview">
           <span class="bp-label">突破后</span>
           <b>${nextRealm}</b>
           <span class="bp-gain">气血 ${U.fmt(nextSt.hp)} <em>+${U.fmt(nextSt.hp - curSt.hp)}</em>
             ｜ 攻 ${nextSt.atk} <em>+${nextSt.atk - curSt.atk}</em>
             ｜ 防 ${nextSt.def} <em>+${nextSt.def - curSt.def}</em></span>
         </div>`
      : '<p class="pad dim">已臻渡劫期，前路再无可循之法。</p>';

    // 打坐：每日都要灵石布阵，钱不够就把按钮按下去
    const cultPer = D.cultCost(s.player.level, 1);
    const cultBtns = [1, 7, 30].map(d => {
      const cost = D.cultCost(s.player.level, d);
      const ok = s.money >= cost;
      return `<button class="btn" data-act="cult" data-d="${d}" ${ok ? '' : 'disabled'}>
        打坐 ${d} 日<em class="cost">${U.fmt(cost)} 灵石</em></button>`;
    }).join('');

    el.view.innerHTML = `
      <div class="grid2">
        <div class="card">
          <div class="card-hd"><h3>打 坐 修 炼</h3>
            <span class="dim">每日修为 +${U.fmt(P.cultPerDay())}　｜　每日耗 ${U.fmt(cultPer)} 灵石</span></div>
          <div class="realm-box">
            <div class="realm-name">${P.realm()}</div>
            <div class="bar exp big"><i style="width:${U.clamp(s.player.exp / need * 100, 0, 100)}%"></i>
              <span>${U.fmt(s.player.exp)} / ${U.fmt(need)}</span></div>
            <div class="attr-row">
              <span>气血 <b>${Math.round(s.player.hp)}/${a.maxHp}</b></span>
              <span>灵力 <b>${Math.round(s.player.mp)}/${s.player.maxMp}</b></span>
              <span>攻击 <b>${a.atk}</b></span>
              <span>防御 <b>${a.def}</b></span>
            </div>
            <div class="attr-row"><span>增益：${buffs}</span></div>
          </div>
          <div class="card-ft wrap">
            ${cultBtns}
            <span class="dim">聚灵阵每日耗灵石，现下够坐 ${U.fmt(G.Sys.maxCultDays())} 日。</span>
          </div>
        </div>
        <div class="card">
          <div class="card-hd"><h3>冲 击 境 界</h3><span class="dim">基础成功率 ${rate}%</span></div>
          <p class="pad">修为圆满后即可尝试突破。突破失败会损失部分修为，但不至于身死道消。</p>
          ${nextRealmHtml}
          <div class="bar exp big"><i style="width:${U.clamp(s.player.exp / need * 100, 0, 100)}%"></i>
            <span>${can ? '修为已圆满' : '修为尚浅'}</span></div>
          <div class="card-ft wrap">
            <button class="btn primary" data-act="break" ${can ? '' : 'disabled'}>直接突破</button>
            <button class="btn" data-act="break-pill" ${can ? '' : 'disabled'}>服破境丹突破</button>
          </div>
        </div>
      </div>
      <div class="card">
        <div class="card-hd"><h3>服 用 丹 药</h3><span class="dim">丹药品质越高，药效越强</span></div>
        <div class="item-list">${usable.length ? usable.map(k =>
      `<button class="btn ghost wide" data-act="use-pill" data-key="${k}">${pillLabel(k)} ×${s.pills[k]}</button>`).join('')
      : '<p class="dim pad">没有可服用的丹药。</p>'}</div>
      </div>`;
  }

  /* ---------------- 感悟 ---------------- */
  function viewInsight() {
    const s = S();
    const rows = D.TALENTS.map(t => {
      const cur = s.talents[t.id] || 0;
      const insCost = G.Sys.talentCost(t.id);
      const moneyCost = G.Sys.talentMoneyCost(t.id);
      const maxed = cur >= t.max;
      const lackIns = s.insight < insCost;
      const lackMoney = s.money < moneyCost;
      const afford = !lackIns && !lackMoney;
      return `<div class="tal">
        <div class="tal-hd"><b>${t.name}</b><span class="dim">${cur} / ${t.max}</span></div>
        <div class="tal-bar"><i style="width:${cur / t.max * 100}%"></i></div>
        <p class="tal-desc">${t.desc}</p>
        <button class="btn tiny ${maxed ? 'ghost' : afford ? 'primary' : 'ghost'}"
          data-act="talent" data-id="${t.id}" ${maxed || !afford ? 'disabled' : ''}>
          ${maxed ? '已圆满' : `参 悟`}
          ${maxed ? '' : `<em class="cost ${lackIns ? 'lack' : ''}">${U.fmt(insCost)} 感悟${lackMoney ? '（缺）' : ''}</em>
            <em class="cost ${lackMoney ? 'lack' : ''}">${U.fmt(moneyCost)} 灵石${lackMoney ? '（缺）' : ''}</em>`}
        </button>
      </div>`;
    }).join('');

    const mCost = D.meditateCost(s.player.level);
    const mAfford = s.money >= mCost;
    const spent = Math.max(0, s.insightAll - s.insight);
    const totalIns = D.TALENTS.reduce((sum, t) => {
      let n = 0;
      for (let i = 0; i < t.max; i++) n += Math.round(t.cost * Math.pow(i + 1, D.COST.talentExp));
      return sum + n;
    }, 0);
    // 灵石总量随参悟时的境界浮动，这里按当前境界粗略估个下限
    const totalMoneyLow = D.TALENTS.reduce((sum, t) => {
      let n = 0;
      for (let i = 0; i < t.max; i++) n += D.talentMoneyCost(s.player.level, i);
      return sum + n;
    }, 0);

    el.view.innerHTML = `
      <div class="card">
        <div class="card-hd"><h3>丹 道 感 悟</h3>
          <span class="dim">可用 <b class="ins big-ins">${Math.floor(s.insight)}</b>　｜　累计获得 ${Math.floor(s.insightAll)}　｜　已参悟耗去 ${U.fmt(Math.floor(spent))}</span></div>
        <p class="pad">炼丹成丹、服食灵丹、静坐观火皆可积攒感悟。<b>参悟既要感悟，也要灵石</b> —— 炼丹的炉火、静室的香烛，一样得花钱。
          七门天赋尽皆圆满共需 <b>${U.fmt(totalIns)}</b> 感悟，按当前境界算还需 <b>${U.fmt(totalMoneyLow)}</b> 灵石以上。</p>
        <div class="card-ft">
          <span class="dim">焚香静坐 ${D.COST.meditateDays} 日，稳定获得 4~7 点感悟（境界越高越多）。</span>
          <button class="btn primary" data-act="meditate" ${mAfford ? '' : 'disabled'}>
            焚香悟道<em class="cost">${U.fmt(mCost)} 灵石</em></button>
        </div>
      </div>
      <div class="talent-grid">${rows}</div>`;
  }

  /* ---------------- 市集 ---------------- */
  function viewMarket() {
    const s = S();
    const buy = D.MARKET.map(id => {
      const m = D.MATERIALS[id];
      const price = Math.round(m.price * D.MARKET_BUY);
      return `<div class="mk-row">
        <span class="mk-name">${m.name}<em class="dim">T${m.tier}</em></span>
        <span class="mk-price gold">${U.fmt(price)}</span>
        <span class="mk-act">
          <button class="btn tiny" data-act="buy" data-id="${id}" data-n="1">买1</button>
          <button class="btn tiny ghost" data-act="buy" data-id="${id}" data-n="10">买10</button>
        </span>
      </div>`;
    }).join('');

    const bagKeys = Object.keys(s.bag).filter(k => s.bag[k] > 0);
    const sell = bagKeys.length ? bagKeys.map(id => {
      const m = D.MATERIALS[id];
      const price = Math.round(m.price * D.MARKET_SELL);
      return `<div class="mk-row">
        <span class="mk-name">${m.name} <em class="dim">×${s.bag[id]}</em></span>
        <span class="mk-price">${U.fmt(price)}</span>
        <span class="mk-act">
          <button class="btn tiny ghost" data-act="sell" data-id="${id}" data-n="1">卖1</button>
          <button class="btn tiny ghost" data-act="sell" data-id="${id}" data-n="${s.bag[id]}">全卖</button>
        </span>
      </div>`;
    }).join('') : '<p class="dim pad">背包空空如也。</p>';

    el.view.innerHTML = `
      <div class="card shop-notice">
        <div class="card-hd"><h3>药 商 行 情</h3></div>
        <p class="pad">药商坐地起价，买价是行价 <b>${D.MARKET_BUY} 倍</b>，卖出却只给 <b>${Math.round(D.MARKET_SELL * 100)}%</b>。
          买料炼丹再零售，多半是亏的 —— 想赚钱，还得自己下秘境采药、去接委托。</p>
      </div>
      <div class="grid2">
        <div class="card">
          <div class="card-hd"><h3>收 购 灵 材</h3><span class="dim">应急补缺可以，长期靠它要破产</span></div>
          <div class="mk-list">${buy}</div>
        </div>
        <div class="card">
          <div class="card-hd"><h3>出 售 库 存</h3><span class="dim">药商只出 ${Math.round(D.MARKET_SELL * 100)}% 的价</span></div>
          <div class="mk-list">${sell}</div>
        </div>
      </div>`;
  }

  /* ---------------- 事件 ---------------- */
  function onClick(e) {
    const t = e.target.closest('[data-act]');
    if (!t) return;
    const act = t.dataset.act;

    switch (act) {
      case 'price': return; // 输入框，交给 change
      case 'unshelf': return G.Sys.shelfTakeBack(+t.dataset.idx);
      case 'shelf': {
        const key = t.dataset.key;
        const inp = el.view.querySelector(`input[data-act="askprice"][data-key="${key}"]`);
        const price = Math.max(1, parseInt(inp.value, 10) || 1);
        G.Sys.shelfAdd(key, price, S().pills[key] || 0);
        return;
      }
      case 'expand': return G.Sys.upgradeShelf();
      case 'accept': return G.Sys.orderAccept(t.dataset.id);
      case 'deliver': return G.Sys.orderDeliver(t.dataset.id);
      case 'remove': return G.Sys.orderRemove(t.dataset.id);
      case 'deliver-all': return G.Sys.orderDeliverAll();
      case 'goto-order': tab = 'order'; return render();
      case 'pick-recipe': selRecipe = t.dataset.id; return render();
      case 'pick-fire': selFire = t.dataset.id; return render();
      case 'craft': return G.Sys.craft(selRecipe, selFire);
      case 'furnace': return G.Sys.upgradeFurnace();
      case 'enter': return G.Sys.enterDungeon(t.dataset.id);
      case 'cult': return G.Sys.cultivate(+t.dataset.d);
      case 'break': return G.Sys.breakthrough(false);
      case 'break-pill': return G.Sys.breakthrough(true);
      case 'use-pill': return G.Sys.takePill(t.dataset.key);
      case 'talent': return G.Sys.upgradeTalent(t.dataset.id);
      case 'meditate': return G.Sys.meditate();
      case 'buy': return G.Sys.marketBuy(t.dataset.id, +t.dataset.n);
      case 'sell': return G.Sys.marketSell(t.dataset.id, +t.dataset.n);
    }
  }

  function onChange(e) {
    const t = e.target.closest('[data-act]');
    if (!t) return;
    if (t.dataset.act === 'price') {
      G.Sys.shelfSetPrice(+t.dataset.idx, parseInt(t.value, 10) || 1);
      G.save();
      // 局部刷新价格标签，不重建 DOM
      renderHud();
    }
  }

  G.UI = UI;
})();
