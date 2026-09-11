/* ============================================================
 * 秘境探索场景（Canvas）+ 极简战斗
 * ==========================================================*/
(function () {
  'use strict';

  const D = G.DATA, U = G.U, P = G.P;
  const CELL = 42, MW = 22, MH = 14;

  // 浅色宣纸系的秘境配色
  const THEME = {
    qingmu: { bg: '#eaf3ec', ground: '#dcebdb', obs: '#a9c6ac', water: '#bcd9e0', accent: '#2f7d6a' },
    huoyun: { bg: '#f9efea', ground: '#f4e2d8', obs: '#dfb3a0', water: '#eec7b2', accent: '#b4483d' },
    hantan: { bg: '#edf3f8', ground: '#dde9f2', obs: '#b0c9db', water: '#a6c7de', accent: '#2f6b8f' },
    wangu: { bg: '#f3edf5', ground: '#e7ddec', obs: '#c4b0d1', water: '#c9d7bc', accent: '#6d5a99' },
    leiyuan: { bg: '#eeeef7', ground: '#e1e2f0', obs: '#b7b8d8', water: '#b6c7e4', accent: '#5b5aa8' },
    yiji: { bg: '#f5f1e9', ground: '#eae3d5', obs: '#c9bda6', water: '#c2cfd3', accent: '#a8801f' }
  };

  let st = null;
  let raf = null, lastT = 0;
  let cv = null, ctx = null;
  let bound = false;

  /* ---------------- 地图生成 ---------------- */
  const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  const PX = 2, PY = Math.floor(MH / 2);      // 出生点

  function passable(x, y) {
    if (x < 0 || y < 0 || x >= MW || y >= MH) return false;
    return st.terrain[y][x] === 0;
  }

  /** 自 (sx,sy) 泛洪，返回可达空地的 key 集合（key = y*MW+x） */
  function flood(terrain, sx, sy) {
    const seen = new Set();
    if (!terrain[sy] || terrain[sy][sx] !== 0) return seen;
    const stack = [[sx, sy]];
    seen.add(sy * MW + sx);
    while (stack.length) {
      const [x, y] = stack.pop();
      for (const [dx, dy] of DIRS) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= MW || ny >= MH) continue;
        const k = ny * MW + nx;
        if (seen.has(k) || terrain[ny][nx] !== 0) continue;
        seen.add(k);
        stack.push([nx, ny]);
      }
    }
    return seen;
  }

  /**
   * 一版随机地形：元胞自动机生成洞穴式地貌。
   * 比"随机撒斑块"更容易长出成片的路网与岩体，死胡同少得多。
   */
  function genTerrain() {
    const terrain = [];
    for (let y = 0; y < MH; y++) {
      terrain.push([]);
      for (let x = 0; x < MW; x++) {
        terrain[y][x] = U.chance(0.40) ? 1 : 0;
      }
    }

    // 迭代收敛：身边障碍多则变为石，障碍少则打通
    for (let pass = 0; pass < 4; pass++) {
      const copy = terrain.map(row => row.slice());
      for (let y = 0; y < MH; y++) {
        for (let x = 0; x < MW; x++) {
          let blocked = 0;
          for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
              if (!dx && !dy) continue;
              const nx = x + dx, ny = y + dy;
              // 越界视为障碍，让边缘自然收拢成山壁
              if (nx < 0 || ny < 0 || nx >= MW || ny >= MH || terrain[ny][nx] !== 0) blocked++;
            }
          }
          if (blocked >= 5) copy[y][x] = 1;
          else if (blocked <= 3) copy[y][x] = 0;
        }
      }
      for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) terrain[y][x] = copy[y][x];
    }

    // 给一部分岩体标成水域，让画面有层次
    for (let i = 0; i < 4; i++) {
      const cx = U.rnd(1, MW - 2), cy = U.rnd(1, MH - 2), r = U.rndf(1.0, 2.4);
      for (let y = Math.max(0, cy - 3); y <= Math.min(MH - 1, cy + 3); y++) {
        for (let x = Math.max(0, cx - 3); x <= Math.min(MW - 1, cx + 3); x++) {
          if (terrain[y][x] !== 0 && Math.hypot(x - cx, y - cy) <= r) terrain[y][x] = 2;
        }
      }
    }

    // 出生点周围清出一小片空地
    for (let y = PY - 2; y <= PY + 2; y++) {
      for (let x = PX - 1; x <= PX + 2; x++) {
        if (y >= 0 && y < MH && x >= 0 && x < MW) terrain[y][x] = 0;
      }
    }
    return terrain;
  }

  /**
   * 反复掷地形，取连通性最好的一版；
   * 最后把从出生点走不到的空地一律填实 —— 玩家看到的每块空地都是能走到的，不会再有死局。
   */
  function buildTerrain() {
    let best = null, bestScore = -Infinity;
    const MIN_OPEN = 150, MIN_RATIO = 0.75;

    for (let tries = 0; tries < 60; tries++) {
      const t = genTerrain();
      const reach = flood(t, PX, PY);
      let open = 0;
      for (let y = 0; y < MH; y++) {
        for (let x = 0; x < MW; x++) if (t[y][x] === 0) open++;
      }
      const ratio = reach.size / Math.max(1, open);
      const score = reach.size + ratio * 80;
      if (score > bestScore) { bestScore = score; best = { terrain: t, reach }; }
      if (reach.size >= MIN_OPEN && ratio >= MIN_RATIO) break;
    }

    const t = best.terrain;
    for (let y = 0; y < MH; y++) {
      for (let x = 0; x < MW; x++) {
        if (t[y][x] === 0 && !best.reach.has(y * MW + x)) t[y][x] = 1;
      }
    }
    return t;
  }

  function genMap(d) {
    const terrain = buildTerrain();

    const ents = [];
    const freeCells = [];
    for (let y = 0; y < MH; y++) {
      for (let x = 0; x < MW; x++) {
        if (terrain[y][x] === 0 && !(Math.abs(x - PX) < 4 && Math.abs(y - PY) < 3)) freeCells.push([x, y]);
      }
    }
    U.shuffle(freeCells);

    // 各格到出生点的最短步数（出口要挑「走得过去又回得来」的位置）
    const steps = new Map([[PY * MW + PX, 0]]);
    const bfs = [[PX, PY]];
    for (let i = 0; i < bfs.length; i++) {
      const [x, y] = bfs[i];
      const dd = steps.get(y * MW + x);
      for (const [dx, dy] of DIRS) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= MW || ny >= MH || terrain[ny][nx] !== 0) continue;
        const k = ny * MW + nx;
        if (steps.has(k)) continue;
        steps.set(k, dd + 1);
        bfs.push([nx, ny]);
      }
    }
    const stepsOf = c => steps.get(c[1] * MW + c[0]) || 0;

    // 出口：优先取 12~20 步、偏右的格子，免得走到深处就回不了头
    const sweetSpot = freeCells.filter(c => {
      const dd = stepsOf(c);
      return dd >= 12 && dd <= 20;
    });
    const exitPool = sweetSpot.length ? sweetSpot : freeCells;
    let exitCell = exitPool[0];
    let exitScore = -Infinity;
    for (const c of exitPool) {
      const score = c[0] * 0.8 + U.rndf(0, 30);   // 偏右 + 一点随机，免得每张图都一个样
      if (score > exitScore) { exitScore = score; exitCell = c; }
    }
    freeCells.splice(freeCells.indexOf(exitCell), 1);

    /* 实体放置：随机取格，彼此隔开一段距离，并按象限轮流铺开。
       若只按顺序填格，实体就整片挤在一起；只按纯随机，又会三五成群、留下一片空区。 */
    const usedCell = new Set();
    const placedPt = [];
    const quadOf = c => (c[1] < MH / 2 ? 0 : 2) + (c[0] < MW / 2 ? 0 : 1);
    let quadCursor = 0;

    const placeAt = (c, relax) => {
      const k = c[1] * MW + c[0];
      if (usedCell.has(k)) return false;
      if (placedPt.some(p => Math.abs(p[0] - c[0]) + Math.abs(p[1] - c[1]) < relax)) return false;
      usedCell.add(k);
      placedPt.push(c);
      return true;
    };

    const put = (type, data) => {
      // 先挑「轮到的那一象限」放，四象限轮转，保证铺得开
      for (let q = 0; q < 4; q++) {
        const target = (quadCursor + q) % 4;
        for (let relax = 3; relax >= 1; relax--) {
          for (let attempt = 0; attempt < 30; attempt++) {
            const c = freeCells[U.rnd(0, freeCells.length - 1)];
            if (quadOf(c) !== target) continue;
            if (!placeAt(c, relax)) continue;
            quadCursor = (target + 1) % 4;
            ents.push({ x: c[0], y: c[1], type, data, alive: true });
            return true;
          }
        }
      }
      // 四象限都放不下（某处全是山壁），退而求其次：任意位置
      for (let relax = 3; relax >= 1; relax--) {
        for (let attempt = 0; attempt < 50; attempt++) {
          const c = freeCells[U.rnd(0, freeCells.length - 1)];
          if (!placeAt(c, relax)) continue;
          ents.push({ x: c[0], y: c[1], type, data, alive: true });
          return true;
        }
      }
      return false;
    };

    const ec = D.ENEMIES;
    const nEnemy = U.rnd(d.enemyCount[0], d.enemyCount[1]);
    for (let i = 0; i < nEnemy; i++) put('enemy', ec[U.pick(d.enemies)]);
    const nGather = U.rnd(d.gatherCount[0], d.gatherCount[1]);
    for (let i = 0; i < nGather; i++) put('gather', U.pick(d.gathers));
    const nChest = U.rnd(d.chestCount[0], d.chestCount[1]);
    for (let i = 0; i < nChest; i++) put('chest', U.pick(d.chests));
    for (let i = 0; i < 4; i++) put('spring', null);

    usedCell.add(exitCell[1] * MW + exitCell[0]);
    ents.push({ x: exitCell[0], y: exitCell[1], type: 'exit', data: null, alive: true });

    const seen = [];
    for (let y = 0; y < MH; y++) seen.push(new Array(MW).fill(false));

    return {
      active: true, d, terrain, seen, ents,
      player: { x: PX, y: PY },
      ap: 40 + Math.round(G.S.player.level * 4),
      maxAp: 40 + Math.round(G.S.player.level * 4),
      gain: {}, lootGold: 0, lootInsight: 0, kills: 0,
      battle: null, fx: [], t: 0, paused: false, theme: THEME[d.id] || THEME.qingmu
    };
  }

  /* ---------------- 生命周期 ---------------- */
  /**
   * 重置秘境：就当这一趟没进去过。
   * 用法是「进去发现走不通，重掷一份地形再来」，
   * 因此行动力回满、本次收获全部退回（材料/灵石/击杀数），
   * 不留任何好处，免得反复重掷刷图。
   */
  function resetDungeon() {
    if (!st || st.battle || st.paused) return false;

    // 把这一趟已经拿到的东西原样退回去
    for (const id in st.gain) {
      if (!st.gain[id]) continue;
      G.S.bag[id] = Math.max(0, (G.S.bag[id] || 0) - st.gain[id]);
      if (G.S.bag[id] <= 0) delete G.S.bag[id];
    }
    G.S.money = Math.max(0, G.S.money - (st.lootGold || 0));
    G.S.stats.kills = Math.max(0, G.S.stats.kills - (st.kills || 0));
    // 感悟与材料一样留在结算时给，重置直接丢弃即可

    const d = st.d;
    st = genMap(d);            // 全新地形，行动力也是满的
    revealAround();
    G.UI.syncExplore();
    G.UI.toast('重新寻了条路进去 —— 这一趟的收获已退，行动力如初。', 'info');
    return true;
  }

  function startDungeon(d) {
    st = genMap(d);
    G.S.explore = { id: d.id };
    G.UI.showExplore(d);
    cv = document.getElementById('dg-canvas');
    if (!cv) return;
    ctx = cv.getContext('2d');
    revealAround();
    if (!bound) {
      document.addEventListener('keydown', onKey);
      bound = true;
    }
    bindPointer();
    if (raf) cancelAnimationFrame(raf);
    lastT = performance.now();
    raf = requestAnimationFrame(loop);
  }

  function endDungeon(reason) {
    if (!st) return;
    st.active = false;
    if (raf) { cancelAnimationFrame(raf); raf = null; }
    if (bound) { document.removeEventListener('keydown', onKey); bound = false; }
    const res = { gain: st.gain, insight: st.lootInsight };
    st = null;
    bindPointerOff();
    G.Sys.finishDungeon(res);
    if (reason === 'down') G.UI.toast('你负伤退出了秘境。', 'bad');
  }

  function bindPointer() {
    if (!cv || cv._b) return;
    cv._b = (e) => {
      if (!st || st.battle || st.paused) return;
      const r = cv.getBoundingClientRect();
      const cx = Math.floor((e.clientX - r.left) * (cv.width / r.width) / CELL);
      const cy = Math.floor((e.clientY - r.top) * (cv.height / r.height) / CELL);
      tryMove(cx, cy);
    };
    cv.addEventListener('click', cv._b);
  }
  function bindPointerOff() {
    if (cv && cv._b) { cv.removeEventListener('click', cv._b); cv._b = null; }
  }

  function onKey(e) {
    if (!st || st.battle || !st.active || st.paused) return;
    const k = e.key;
    let dx = 0, dy = 0;
    if (k === 'ArrowLeft' || k === 'a' || k === 'A') dx = -1;
    else if (k === 'ArrowRight' || k === 'd' || k === 'D') dx = 1;
    else if (k === 'ArrowUp' || k === 'w' || k === 'W') dy = -1;
    else if (k === 'ArrowDown' || k === 's' || k === 'S') dy = 1;
    else return;
    e.preventDefault();
    tryMove(st.player.x + dx, st.player.y + dy);
  }

  /* ---------------- 移动与踩格 ---------------- */
  function tryMove(x, y) {
    if (!st || st.battle || !st.active || st.paused) return;
    const dx = Math.abs(x - st.player.x), dy = Math.abs(y - st.player.y);
    if (dx + dy !== 1) {
      if (dx + dy > 1) addFx(x * CELL + CELL / 2, y * CELL + CELL / 2, '太远了', FX.block);
      return;
    }
    if (!passable(x, y)) {
      addFx(x * CELL + CELL / 2, y * CELL + CELL / 2, '不通', FX.block);
      return;
    }
    if (st.ap <= 0) { askApEmpty(); return; }

    st.ap--;
    st.player.x = x; st.player.y = y;
    revealAround();
    G.UI.syncExplore();

    const ent = st.ents.find(e => e.alive && e.x === x && e.y === y);
    if (ent) {
      trigger(ent);
      if (ent.type !== 'exit' && ent.type !== 'enemy' && st.ap <= 0) askApEmpty();
    } else if (st.ap <= 0) {
      askApEmpty();
    }
  }

  /** 行动力耗尽：让玩家自己决定走还是歇 */
  function askApEmpty() {
    if (!st || st.ap > 0 || st.paused || st.battle) return;
    st.paused = true;
    const gain = Math.round(st.maxAp * 0.6);
    G.UI.choice('行动力已尽',
      `你已在秘境中走了许久，腿脚发沉，再也挪不动步子。<br>
       <span class="dim">就地歇息会耗去一日，但能恢复 ${gain} 点行动力与些许气血；此时丹阁照常收单，墙上还会添新的委托。</span>`,
      [
        {
          label: '带着收获返回', cls: 'ghost', pick: () => {
            if (st) { st.paused = false; endDungeon('exit'); }
          }
        },
        {
          label: `就地歇息（1 日）`, cls: 'primary', pick: () => {
            if (!st) return;
            st.paused = false;
            G.advanceDays(1, '在秘境中就地打坐歇息。');
            st.ap = gain;
            const heal = Math.round(P.attr().maxHp * 0.3);
            G.S.player.hp = Math.min(P.attr().maxHp, G.S.player.hp + heal);
            addFx(st.player.x * CELL + CELL / 2, st.player.y * CELL + CELL / 2, `行动力 +${gain}`, FX.spring);
            G.log(`歇息一日，行动力恢复 ${gain} 点，气血 +${heal}。`, 'info');
            G.UI.syncExplore();
          }
        }
      ]);
  }

  function revealAround() {
    const r = st.d.vision;
    for (let y = 0; y < MH; y++) {
      for (let x = 0; x < MW; x++) {
        if (Math.hypot(x - st.player.x, y - st.player.y) <= r) st.seen[y][x] = true;
      }
    }
  }

  function trigger(ent) {
    if (ent.type === 'gather') {
      ent.alive = false;
      const n = U.rnd(1, 2);
      addGain(ent.data, n);
      addFx(ent.x * CELL + CELL / 2, ent.y * CELL + CELL / 2, `+${n} ${D.MATERIALS[ent.data].name}`, FX.loot);
      G.UI.syncExplore();
    } else if (ent.type === 'chest') {
      ent.alive = false;
      const id = ent.data;
      const n = U.rnd(1, 2);
      addGain(id, n);
      addFx(ent.x * CELL + CELL / 2, ent.y * CELL + CELL / 2, `宝箱：${D.MATERIALS[id].name}×${n}`, FX.chest);
      if (U.chance(0.4)) { st.lootInsight += 1; }
      G.UI.syncExplore();
    } else if (ent.type === 'spring') {
      ent.alive = false;
      const heal = Math.round(P.attr().maxHp * 0.42);
      G.S.player.hp = Math.min(P.attr().maxHp, G.S.player.hp + heal);
      addFx(ent.x * CELL + CELL / 2, ent.y * CELL + CELL / 2, `灵泉 +${heal}`, FX.spring);
      G.UI.syncExplore();
    } else if (ent.type === 'exit') {
      G.UI.confirm('离开秘境', '前方就是出口，是否带着收获返回丹阁？', () => endDungeon('exit'));
    } else if (ent.type === 'enemy') {
      startBattle(ent);
    }
  }

  function addGain(id, n) {
    st.gain[id] = (st.gain[id] || 0) + n;
    G.addMat(id, n);
  }

  // 浅底上用深色飘字 + 白描边，保证可读
  const FX = {
    block: '#93a09a', loot: '#2f7d6a', chest: '#a8801f',
    spring: '#2f6b8f', exit: '#8a6a12'
  };

  function addFx(x, y, text, color) {
    st.fx.push({ x, y, text, color, life: 1, vy: -0.6 });
  }

  /* ---------------- 战斗 ---------------- */
  function startBattle(ent) {
    const e = ent.data;
    // 妖兽血量随玩家境界缓涨（新体系级数少，故系数比旧体系略大）
    const lvScale = 1 + (G.S.player.level - 1) * 0.028;
    st.battle = {
      ent,
      name: e.name,
      shape: e.shape,
      maxHp: Math.round(e.hp * lvScale), hp: Math.round(e.hp * lvScale),
      atk: e.atk, def: e.def,
      log: [], over: false, timer: null, busy: false
    };
    G.UI.showBattle(st.battle, e);
    pushLog(`遭遇 ${e.name}！`);
    st.battle.timer = setTimeout(enemyTurn, 900);
  }

  function pushLog(t) {
    if (!st || !st.battle) return;
    st.battle.log.unshift(t);
    if (st.battle.log.length > 8) st.battle.log.length = 8;
    G.UI.updateBattle(st.battle);
  }

  function playerAttack(mult, mpCost, label) {
    const b = st.battle;
    if (!b || b.over || b.busy) return;
    if (mpCost && G.S.player.mp < mpCost) { G.UI.toast('灵力不足。', 'warn'); return; }
    if (mpCost) G.S.player.mp -= mpCost;
    G.UI.syncExplore();                                  // 灵力变化要立刻反映到状态栏

    const a = P.attr();
    const crit = U.chance(0.12);
    let dmg = a.atk * U.rndf(0.9, 1.1) * (mult || 1) - b.def * 0.55;
    dmg = Math.max(1, Math.round(dmg * (crit ? 1.8 : 1)));
    b.hp -= dmg;
    pushLog(`${label || '你挥出一掌'}，${b.name} 受创 ${dmg}${crit ? '（暴击）' : ''}。`);
    G.UI.flashBattle('enemy', dmg);

    if (b.hp <= 0) {
      b.hp = 0;
      winBattle();
      return;
    }
    b.busy = true;
    b.timer = setTimeout(() => { b.busy = false; enemyTurn(); }, 700);
  }

  function enemyTurn() {
    const b = st.battle;
    if (!b || b.over) return;
    const a = P.attr();
    let dmg = b.atk * U.rndf(0.9, 1.1) - a.def * 0.55;
    dmg = Math.max(1, Math.round(dmg));
    G.S.player.hp -= dmg;
    pushLog(`${b.name} 反扑，你受到 ${dmg} 点伤害。`);
    G.UI.flashBattle('player', dmg);
    G.UI.syncExplore();

    if (G.S.player.hp <= 0) {
      G.S.player.hp = 1;
      loseBattle();
      return;
    }
    b.busy = false;
    G.UI.updateBattle(b);
  }

  function loseBattle() {
    const b = st.battle;
    if (!b || b.over) return;
    b.over = true;
    pushLog('你气血耗尽，被同伴拖出了秘境……');
    G.UI.updateBattle(b);
    G.S.player.hp = 1;
    st.lootInsight += 1;                     // 战败也有感悟，离开时结算
    setTimeout(() => {
      if (st) { st.battle = null; endDungeon('down'); }
    }, 1400);
  }

  function winBattle() {
    const b = st.battle;
    b.over = true;
    const e = b.ent.data;
    const res = G.Sys.winBattle(e, null);
    st.lootGold += res.gold;                 // 记账：重置时要原样退回
    // 掉落
    const drops = {};
    const n = U.rnd(1, 2);
    for (let i = 0; i < n; i++) {
      const id = U.pick(e.loot);
      const c = U.rnd(1, 2);
      drops[id] = (drops[id] || 0) + c;
      addGain(id, c);
    }
    const dropText = Object.keys(drops).map(k => `${D.MATERIALS[k].name}×${drops[k]}`).join('、');
    pushLog(`击败 ${b.name}！获得灵石 ${res.gold}。`);
    if (dropText) pushLog(`拾取：${dropText}`);
    b.ent.alive = false;
    st.kills++;
    G.UI.updateBattle(b);
    G.UI.syncExplore();

    setTimeout(() => {
      if (!st) return;
      st.battle = null;
      G.UI.hideBattle();
      G.UI.afterAction();
      if (st.ap <= 0) askApEmpty();
    }, 1500);
  }

  function useItemInBattle(key) {
    const b = st.battle;
    if (!b || b.over || b.busy) return;
    const { pill, quality } = G.parsePillKey(key);
    const e = pill.effect;
    if (!e.heal && !e.buff) { G.UI.toast('此丹战斗中无用。', 'warn'); return; }
    if (!G.takePill(key, 1)) return;
    if (e.heal) {
      const v = Math.round(e.heal * quality.mult);
      G.S.player.hp = Math.min(P.attr().maxHp, G.S.player.hp + v);
      pushLog(`服下${quality.name}${pill.name}，恢复 ${v} 点气血。`);
    }
    if (e.buff) {
      G.Sys.applyBuff(e.buff);
      pushLog(`服下${quality.name}${pill.name}，${e.buff.name} 加身。`);
    }
    G.UI.updateBattle(b);
    G.UI.syncExplore();
  }

  function flee() {
    const b = st.battle;
    if (!b || b.over) return;
    if (U.chance(0.55)) {
      pushLog('你抽身而退，逃出了战斗。');
      b.over = true;
      setTimeout(() => { if (st) { st.battle = null; G.UI.hideBattle(); } }, 700);
    } else {
      pushLog('逃跑失败，反而露出了破绽！');
      b.busy = true;
      setTimeout(() => { b.busy = false; enemyTurn(); }, 500);
    }
  }

  /* ---------------- 绘制 ---------------- */
  function loop(t) {
    if (!st || !st.active) return;
    const dt = Math.min(50, t - lastT); lastT = t;
    st.t += dt;
    for (const f of st.fx) { f.life -= dt / 1100; f.y += f.vy; }
    st.fx = st.fx.filter(f => f.life > 0);
    draw();
    raf = requestAnimationFrame(loop);
  }

  function draw() {
    const th = st.theme;
    ctx.fillStyle = th.bg;
    ctx.fillRect(0, 0, cv.width, cv.height);

    for (let y = 0; y < MH; y++) {
      for (let x = 0; x < MW; x++) {
        const seen = st.seen[y][x];
        const dist = Math.hypot(x - st.player.x, y - st.player.y);
        const vis = dist <= st.d.vision;
        if (!seen && !vis) continue;
        const alpha = vis ? 1 : 0.32;
        ctx.globalAlpha = alpha;
        drawTile(x, y, th);
        ctx.globalAlpha = 1;
      }
    }

    // 实体
    for (const e of st.ents) {
      if (!e.alive) continue;
      const vis = Math.hypot(e.x - st.player.x, e.y - st.player.y) <= st.d.vision;
      if (!st.seen[e.y][e.x] && !vis) continue;
      ctx.globalAlpha = vis ? 1 : 0.4;
      drawEntity(e);
      ctx.globalAlpha = 1;
    }

    // 玩家
    drawHero(st.player.x * CELL + CELL / 2, st.player.y * CELL + CELL / 2);

    // 飘字
    for (const f of st.fx) {
      ctx.globalAlpha = Math.max(0, f.life);
      ctx.font = 'bold 15px "Microsoft YaHei",sans-serif';
      ctx.textAlign = 'center';
      ctx.lineWidth = 3.5; ctx.strokeStyle = 'rgba(255,255,255,.92)';
      ctx.strokeText(f.text, f.x, f.y);
      ctx.fillStyle = f.color;
      ctx.fillText(f.text, f.x, f.y);
      ctx.globalAlpha = 1;
    }
    ctx.textAlign = 'left';

    if (st.battle) {
      ctx.fillStyle = 'rgba(247,246,240,.55)';
      ctx.fillRect(0, 0, cv.width, cv.height);
    }
  }

  function drawTile(x, y, th) {
    const px = x * CELL, py = y * CELL, t = st.terrain[y][x];
    ctx.fillStyle = th.ground;
    ctx.fillRect(px, py, CELL, CELL);
    ctx.strokeStyle = 'rgba(60,80,75,.06)';
    ctx.strokeRect(px + 0.5, py + 0.5, CELL - 1, CELL - 1);

    if (t === 1) {
      ctx.fillStyle = 'rgba(60,80,75,.13)';
      ctx.beginPath(); ctx.ellipse(px + CELL / 2, py + CELL - 10, 13, 5, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = th.obs;
      ctx.beginPath();
      ctx.moveTo(px + CELL / 2, py + 8);
      ctx.lineTo(px + CELL - 9, py + CELL - 8);
      ctx.lineTo(px + 9, py + CELL - 8);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,.55)';
      ctx.beginPath();
      ctx.moveTo(px + CELL / 2, py + 8);
      ctx.lineTo(px + CELL / 2 + 4, py + CELL - 8);
      ctx.lineTo(px + CELL / 2 - 4, py + CELL - 8);
      ctx.closePath(); ctx.fill();
    } else if (t === 2) {
      ctx.fillStyle = th.water;
      ctx.fillRect(px + 2, py + 2, CELL - 4, CELL - 4);
      ctx.strokeStyle = 'rgba(255,255,255,.7)';
      ctx.beginPath();
      const w = Math.sin((st.t / 420) + x * 0.9 + y * 0.6) * 4;
      ctx.moveTo(px + 8, py + CELL / 2 + w);
      ctx.quadraticCurveTo(px + CELL / 2, py + CELL / 2 - w, px + CELL - 8, py + CELL / 2 + w);
      ctx.stroke();
    }
  }

  function drawEntity(e) {
    const px = e.x * CELL + CELL / 2, py = e.y * CELL + CELL / 2;
    const th = st.theme;
    if (e.type === 'enemy') {
      drawMonster(px, py, e.data.shape, th);
    } else if (e.type === 'gather') {
      const sway = Math.sin(st.t / 380 + e.x) * 2;
      ctx.strokeStyle = '#7ba888';
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(px, py + 10); ctx.quadraticCurveTo(px + sway, py - 2, px + sway * 1.5, py - 10); ctx.stroke();
      ctx.fillStyle = th.accent;
      ctx.beginPath(); ctx.arc(px + sway * 1.5, py - 12, 5, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha *= 0.35;
      ctx.beginPath(); ctx.arc(px + sway * 1.5, py - 12, 9 + Math.sin(st.t / 300) * 2, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha /= 0.35;
    } else if (e.type === 'chest') {
      ctx.fillStyle = '#a8801f';
      ctx.fillRect(px - 12, py - 2, 24, 14);
      ctx.fillStyle = '#c9a24a';
      ctx.fillRect(px - 12, py - 10, 24, 9);
      ctx.fillStyle = '#5c4a18';
      ctx.fillRect(px - 3, py - 3, 6, 6);
    } else if (e.type === 'spring') {
      ctx.fillStyle = 'rgba(90,150,190,.22)';
      ctx.beginPath(); ctx.arc(px, py, 14 + Math.sin(st.t / 300) * 2, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#8fc4de';
      ctx.beginPath(); ctx.arc(px, py, 7, 0, Math.PI * 2); ctx.fill();
    } else if (e.type === 'exit') {
      const pulse = 0.5 + Math.sin(st.t / 260) * 0.25;
      ctx.strokeStyle = `rgba(168,128,31,${pulse + 0.4})`;
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(px, py, 15, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = `rgba(201,162,74,${pulse + 0.3})`;
      ctx.beginPath(); ctx.arc(px, py, 7, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#8a6a12';
      ctx.font = '12px "Microsoft YaHei"';
      ctx.textAlign = 'center';
      ctx.fillText('出口', px, py + 30);
      ctx.textAlign = 'left';
    }
  }

  function drawMonster(px, py, shape, th) {
    const bob = Math.sin(st.t / 260 + px) * 2;
    ctx.fillStyle = 'rgba(60,80,75,.15)';
    ctx.beginPath(); ctx.ellipse(px, py + 13, 12, 4, 0, 0, Math.PI * 2); ctx.fill();
    if (shape === 'ghost') {
      ctx.globalAlpha *= 0.8;
      ctx.fillStyle = '#a9c2dd';
      ctx.beginPath(); ctx.arc(px, py - 4 + bob, 12, Math.PI, 0);
      ctx.lineTo(px + 12, py + 12 + bob);
      for (let i = 0; i < 4; i++) ctx.lineTo(px + 12 - 6 * (i + 0.5), py + 6 + bob);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#33465c';
      ctx.beginPath(); ctx.arc(px - 4, py - 5 + bob, 2, 0, 7); ctx.fill();
      ctx.beginPath(); ctx.arc(px + 4, py - 5 + bob, 2, 0, 7); ctx.fill();
      ctx.globalAlpha /= 0.8;
    } else if (shape === 'golem') {
      ctx.fillStyle = '#a49c8c';
      ctx.fillRect(px - 13, py - 10, 26, 24);
      ctx.fillStyle = '#bab2a1';
      ctx.fillRect(px - 8, py - 20, 16, 12);
      ctx.fillStyle = th.accent;
      ctx.fillRect(px - 5, py - 16, 4, 4);
      ctx.fillRect(px + 2, py - 16, 4, 4);
    } else if (shape === 'flying') {
      ctx.fillStyle = '#8b80bb';
      const f = Math.sin(st.t / 120) * 8;
      ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px - 22, py - f); ctx.lineTo(px - 8, py + 8); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px + 22, py - f); ctx.lineTo(px + 8, py + 8); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#5d5488';
      ctx.beginPath(); ctx.ellipse(px, py + 2, 8, 10, 0, 0, Math.PI * 2); ctx.fill();
    } else if (shape === 'insect') {
      ctx.fillStyle = '#6e9c58';
      ctx.beginPath(); ctx.ellipse(px, py + 4, 14, 9, 0, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#4a7040'; ctx.lineWidth = 2;
      for (let i = -1; i <= 1; i++) {
        ctx.beginPath();
        ctx.moveTo(px + i * 7, py + 4);
        ctx.lineTo(px + i * 10, py + 14 + Math.sin(st.t / 150 + i) * 2);
        ctx.stroke();
      }
      ctx.fillStyle = '#c0563f';
      ctx.beginPath(); ctx.arc(px, py - 5, 6, 0, Math.PI * 2); ctx.fill();
    } else {
      // beast
      ctx.fillStyle = '#8a7160';
      ctx.beginPath(); ctx.ellipse(px, py + 4, 15, 10, 0, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(px + 11, py - 4 + bob * 0.4, 9, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#b4483d';
      ctx.beginPath(); ctx.arc(px + 14, py - 6, 2, 0, 7); ctx.fill();
      ctx.fillStyle = '#6b564a';
      ctx.beginPath(); ctx.moveTo(px + 6, py - 11); ctx.lineTo(px + 8, py - 20); ctx.lineTo(px + 12, py - 11); ctx.closePath(); ctx.fill();
    }
  }

  function drawHero(cx, cy) {
    const bob = Math.sin(st.t / 300) * 1.6;
    ctx.fillStyle = 'rgba(60,80,75,.18)';
    ctx.beginPath(); ctx.ellipse(cx, cy + 14, 11, 4, 0, 0, Math.PI * 2); ctx.fill();
    // 袍身
    ctx.fillStyle = '#fdfcf7';
    ctx.beginPath();
    ctx.moveTo(cx - 9, cy + 13);
    ctx.lineTo(cx - 6, cy - 4 + bob);
    ctx.lineTo(cx + 6, cy - 4 + bob);
    ctx.lineTo(cx + 9, cy + 13);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(63,131,120,.35)';
    ctx.lineWidth = 1;
    ctx.stroke();
    // 腰带
    ctx.fillStyle = '#b4483d';
    ctx.fillRect(cx - 7, cy + 2 + bob, 14, 3);
    // 头
    ctx.fillStyle = '#f6e4cd';
    ctx.beginPath(); ctx.arc(cx, cy - 10 + bob, 7, 0, Math.PI * 2); ctx.fill();
    // 发髻
    ctx.fillStyle = '#3a3a42';
    ctx.beginPath(); ctx.arc(cx, cy - 15 + bob, 7, Math.PI, 0); ctx.fill();
    ctx.beginPath(); ctx.arc(cx, cy - 20 + bob, 3.2, 0, Math.PI * 2); ctx.fill();
    // 光晕
    ctx.strokeStyle = 'rgba(63,131,120,.42)';
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(cx, cy + 2, 17 + Math.sin(st.t / 400) * 1.5, 0, Math.PI * 2); ctx.stroke();
  }

  /* ---------------- 对外接口 ---------------- */
  G.Scene = {
    startDungeon,
    leave: () => endDungeon('exit'),
    resetDungeon,
    isActive: () => !!(st && st.active),
    getState: () => st,
    playerAttack, useItemInBattle, flee,
    getBattle: () => st && st.battle,
    MAX: { CELL, MW, MH },
    // 供离线测试：验证地形连通性
    _debug: { genMap, flood, PX, PY }
  };
})();
