/* ============================================================
 * 丹阁 · 玄幻丹药经营  ——  静态数据表
 * 所有可调数值集中在此文件，便于平衡性调整。
 * ==========================================================*/
window.G = window.G || {};

G.DATA = (function () {
  'use strict';

  /* ---------------- 境界 ----------------
   * 炼气期不再分一到九层：一次突破便直入筑基，让前期节奏清爽些。
   * 之后每个大境界仍分初/中/后三期。
   * ------------------------------------ */
  const REALMS = [
    '凡人',
    '炼气期',
    '筑基初期', '筑基中期', '筑基后期',
    '金丹初期', '金丹中期', '金丹后期',
    '元婴初期', '元婴中期', '元婴后期',
    '化神初期', '化神中期', '化神后期',
    '炼虚初期', '炼虚中期', '炼虚后期',
    '合体初期', '合体中期', '合体后期',
    '大乘期', '渡劫期'
  ];

  /* 各级属性：数值锚定在「大境界」上，与各秘境妖兽的强度一一对应。
     炼气期到筑基初期跨度很大（跨过八个层次），突破时提升感明显。 */
  const STATS = [
    { hp: 60, atk: 6, def: 2, mp: 30 },        // 0  凡人
    { hp: 120, atk: 12, def: 5, mp: 60 },      // 1  炼气期
    { hp: 750, atk: 93, def: 41, mp: 168 },    // 2  筑基初期
    { hp: 820, atk: 102, def: 45, mp: 180 },   // 3  筑基中期
    { hp: 890, atk: 111, def: 49, mp: 192 },   // 4  筑基后期
    { hp: 960, atk: 120, def: 53, mp: 204 },   // 5  金丹初期
    { hp: 1030, atk: 129, def: 57, mp: 216 },  // 6  金丹中期
    { hp: 1100, atk: 138, def: 61, mp: 228 },  // 7  金丹后期
    { hp: 1170, atk: 147, def: 65, mp: 240 },  // 8  元婴初期
    { hp: 1240, atk: 156, def: 69, mp: 252 },  // 9  元婴中期
    { hp: 1310, atk: 165, def: 73, mp: 264 },  // 10 元婴后期
    { hp: 1380, atk: 174, def: 77, mp: 276 },  // 11 化神初期
    { hp: 1450, atk: 183, def: 81, mp: 288 },  // 12 化神中期
    { hp: 1520, atk: 192, def: 85, mp: 300 },  // 13 化神后期
    { hp: 1590, atk: 201, def: 89, mp: 312 },  // 14 炼虚初期
    { hp: 1660, atk: 210, def: 93, mp: 324 },  // 15 炼虚中期
    { hp: 1730, atk: 219, def: 97, mp: 336 },  // 16 炼虚后期
    { hp: 1800, atk: 228, def: 101, mp: 348 }, // 17 合体初期
    { hp: 1870, atk: 237, def: 105, mp: 360 }, // 18 合体中期
    { hp: 1940, atk: 246, def: 109, mp: 372 }, // 19 合体后期
    { hp: 2010, atk: 255, def: 113, mp: 384 }, // 20 大乘期
    { hp: 2080, atk: 264, def: 117, mp: 396 }  // 21 渡劫期
  ];

  // 升级所需修为：与修炼速度搭配，每级大致二十到三十余日
  function expNeed(level) {
    return Math.floor(55 * Math.pow(level, 1.55)) + 90;
  }
  // 每日打坐修炼获得的修为
  function cultGain(level) {
    return Math.floor(6 + level * 2.2 + level * level * 0.55);
  }

  /* ---------------- 材料 ---------------- */
  // tier 仅用于市场定价与展示；price 为基准市价
  const MATERIALS = {};
  function addMat(id, name, tier, price, desc) {
    MATERIALS[id] = { id, name, tier, price, desc };
  }

  addMat('commonherb', '百草叶', 1, 6, '山野间随处可见的杂草，药性极淡，却是最稳妥的辅药。');
  addMat('dewgrass', '凝露草', 1, 10, '叶上凝露成珠，性平微润，炼气修士的入门药材。');
  addMat('vineroot', '青木藤', 1, 13, '青木林深处的老藤根，纤维坚韧，可固丹形。');
  addMat('moonflower', '月华花', 2, 28, '只在月圆之夜绽放，花瓣带有一丝清冷灵韵。');
  addMat('jademarrow', '玉髓', 2, 48, '灵玉化为液后的结晶，能中和药性中的燥烈之气。');
  addMat('woodcore', '木髓结晶', 2, 72, '千年古木的心核，蕴含旺盛的生发之力。');
  addMat('lingzhi', '千年灵芝', 3, 115, '紫纹如云，寻常修士得之可换半年口粮。');
  addMat('flameflower', '赤炎花', 2, 42, '花蕊终年燃烧着一簇不灭的火苗。');
  addMat('firedust', '火云砂', 2, 36, '火云谷的风蚀砂粒，触手滚烫。');
  addMat('scarletfruit', '朱果', 3, 98, '百年一熟的赤色果实，入口如吞炭火。');
  addMat('lavacore', '熔岩心', 3, 155, '地脉深处凝出的石心，藏着不驯的炎力。');
  addMat('coldspring', '寒泉水', 3, 102, '寒潭底部的泉眼之水，盛于玉瓶亦结薄冰。');
  addMat('icemoss', '冰魄苔', 3, 90, '附着于万年寒石上的青苔，触之刺骨。');
  addMat('deepshell', '玄龟壳', 4, 285, '寒潭玄龟褪下的背甲碎片，坚固得不可思议。');
  addMat('frostmarrow', '寒髓', 4, 345, '冰脉中心的白色膏脂，据说是极寒的具现。');
  addMat('bloodginseng', '血参', 3, 132, '根须如血管般搏动，补气血之效奇佳。');
  addMat('venomgrass', '噬魂草', 4, 245, '叶片边缘生有细密齿刺，触碰会麻痹神识。');
  addMat('guflower', '蛊花', 4, 305, '花心盘踞着一只沉睡的蛊虫，以血为食。');
  addMat('poisonsac', '万毒囊', 5, 630, '万蛊沼深处怪物的毒囊，一囊可毒杀半村人。');
  addMat('thundershale', '雷鸣石', 4, 310, '握在手中会发出细微的嗡鸣。');
  addMat('stormflower', '风雷花', 5, 570, '在雷雨中开放，花瓣上凝着细小的电弧。');
  addMat('purplecore', '紫雷髓', 5, 730, '雷渊深处凝结的紫色膏体，传闻能锻体。');
  addMat('thunderjade', '雷玉', 5, 870, '被天雷反复淬炼的玉质，透明得能看见内部闪电。');
  addMat('spiritcrystal', '灵晶', 3, 168, '高纯度的灵石结晶，是硬通货也是辅药。');
  addMat('stardust', '星辉砂', 5, 710, '遗迹穹顶坠落之物，夜里会自行发亮。');
  addMat('primordialfruit', '太初果', 5, 1120, '据说结于天地初开时的第一株灵植。');
  addMat('chaosstone', '混沌石', 5, 1450, '一块不起眼的灰石，内里翻涌着混沌气机。');
  addMat('immortaldew', '仙灵液', 5, 1850, '遗迹石缝中一滴滴积攒的乳白液体，百年仅得一盏。');
  addMat('dragonblood', '龙血芝', 4, 490, '芝盖呈龙形，切开时流出赤色浆液。');

  /* ---------------- 丹药 ---------------- */
  // tag: cultivation 修炼 / heal 疗伤 / buff 增益 / beauty 养颜 / rare 珍稀
  const PILLS = {};
  function addPill(id, name, tag, price, effect, desc) {
    PILLS[id] = { id, name, tag, price, effect, desc };
  }

  addPill('juqidan', '聚气丹', 'cultivation', 46,
    { exp: 55 }, '最基础的丹药，服之可聚拢游散灵气，加速修行。');
  addPill('liaoshangdan', '疗伤丹', 'heal', 48,
    { heal: 60 }, '外伤圣品，凝血生肌，散修出门必备。');
  addPill('yangyandan', '养颜丹', 'beauty', 72,
    { beauty: 1 }, '驻颜三日，凡间贵妇趋之若鹜。');
  addPill('ningshendan', '凝神丹', 'cultivation', 185,
    { exp: 90, insight: 1 }, '服后神台清明，于丹道亦有小补。');
  addPill('jedudan', '解毒丹', 'heal', 570,
    { heal: 130, cure: 1 }, '可解百毒，行走江湖之人的保命之物。');
  addPill('huolingdan', '火灵丹', 'cultivation', 225,
    { exp: 240 }, '以赤炎花为主药，灵力精纯，唯性烈。');
  addPill('xuanbingdan', '玄冰丹', 'buff', 425,
    { buff: { name: '玄冰护体', atk: 8, def: 6, days: 3 } }, '服后遍体生寒，可御火毒、增防御。');
  addPill('pojingdan', '破境丹', 'cultivation', 375,
    { breakthrough: 25 }, '临突破时服用，可稳住气机，提升三成把握。');
  addPill('xisuidan', '洗髓丹', 'buff', 560,
    { perm: { maxHp: 30, atk: 3 } }, '伐毛洗髓，永久改善体质，价值不菲。');
  addPill('yanxuidan', '炎髓丹', 'buff', 800,
    { perm: { atk: 10 } }, '以熔岩心炼化而成，服下如烈火自骨髓里烧起，肉身愈发坚悍。');
  addPill('guiyuandan', '龟元丹', 'rare', 1320,
    { exp: 900, perm: { maxHp: 60 } }, '取玄龟长寿之意，为延年益寿之珍品。');
  addPill('wandudan', '万毒丹', 'rare', 1790,
    { poison: 1 }, '剧毒之物，亦是世间难得的神药，识货者愿出重金。');
  addPill('leiyuandan', '雷元丹', 'cultivation', 1720,
    { exp: 1600 }, '雷力入体，锻经伐脉，痛楚与机缘并存。');
  addPill('zixiaodan', '紫霄丹', 'rare', 3600,
    { exp: 2600, perm: { atk: 6, def: 4 } }, '紫霄雷意所凝，服之如受天雷洗礼。');
  addPill('taichudan', '太初丹', 'rare', 6900,
    { exp: 5000, insight: 5 }, '传说中开启道途的丹药，一丹可抵十年苦修。');
  addPill('hundundan', '混沌丹', 'rare', 6950,
    { exp: 9000, perm: { maxHp: 150, atk: 12, def: 8 } }, '以混沌石入药，成丹之时天色异变。');

  /* ---------------- 配方 ----------------
   * req 对应新体系的具体境界；大致按「材料产地的秘境」分批解锁。
   * days: 炼制天数  qty: 一炉产量
   * ---------------------------------------- */
  const RECIPES = [
    { id: 'juqidan', pill: 'juqidan', qty: 1, mats: { dewgrass: 2, commonherb: 2 }, req: 1, days: 1 },
    { id: 'liaoshangdan', pill: 'liaoshangdan', qty: 1, mats: { dewgrass: 2, vineroot: 1 }, req: 1, days: 1 },
    { id: 'yangyandan', pill: 'yangyandan', qty: 1, mats: { moonflower: 1, commonherb: 2, dewgrass: 1 }, req: 2, days: 1 },
    { id: 'huolingdan', pill: 'huolingdan', qty: 1, mats: { flameflower: 2, firedust: 2 }, req: 2, days: 2 },
    { id: 'ningshendan', pill: 'ningshendan', qty: 1, mats: { moonflower: 2, woodcore: 1 }, req: 3, days: 2 },
    { id: 'pojingdan', pill: 'pojingdan', qty: 1, mats: { woodcore: 2, lingzhi: 1 }, req: 4, days: 2 },
    { id: 'xuanbingdan', pill: 'xuanbingdan', qty: 1, mats: { coldspring: 2, icemoss: 1 }, req: 5, days: 3 },
    { id: 'xisuidan', pill: 'xisuidan', qty: 1, mats: { scarletfruit: 1, bloodginseng: 1, jademarrow: 2 }, req: 5, days: 3 },
    { id: 'guiyuandan', pill: 'guiyuandan', qty: 1, mats: { deepshell: 2, frostmarrow: 1 }, req: 6, days: 3 },
    { id: 'yanxuidan', pill: 'yanxuidan', qty: 1, mats: { lavacore: 2, firedust: 3, jademarrow: 1 }, req: 9, days: 3 },
    { id: 'jedudan', pill: 'jedudan', qty: 1, mats: { venomgrass: 1, commonherb: 3, bloodginseng: 1 }, req: 8, days: 2 },
    { id: 'wandudan', pill: 'wandudan', qty: 1, mats: { guflower: 2, poisonsac: 1 }, req: 8, days: 3 },
    { id: 'leiyuandan', pill: 'leiyuandan', qty: 1, mats: { thundershale: 2, stormflower: 1 }, req: 12, days: 4 },
    { id: 'zixiaodan', pill: 'zixiaodan', qty: 1, mats: { purplecore: 2, thunderjade: 1, spiritcrystal: 1 }, req: 14, days: 4 },
    { id: 'taichudan', pill: 'taichudan', qty: 1, mats: { primordialfruit: 2, immortaldew: 1, stardust: 1 }, req: 17, days: 5 },
    { id: 'hundundan', pill: 'hundundan', qty: 1, mats: { chaosstone: 2, stardust: 2, dragonblood: 1 }, req: 17, days: 5 }
  ];

  // 品质：0 下品 1 中品 2 上品 3 极品
  const QUALITY = [
    { name: '下品', rank: 0, mult: 1.0, color: '#8d9691' },
    { name: '中品', rank: 1, mult: 1.55, color: '#2f7d6a' },
    { name: '上品', rank: 2, mult: 2.35, color: '#a8801f' },
    { name: '极品', rank: 3, mult: 3.6, color: '#b4483d' }
  ];

  // 火候：影响成功率与品质
  const FIRES = [
    { id: 'wen', name: '文火慢炼', suc: 0.20, quality: -0.10, days: 0, desc: '成功率 +20%，品质略降' },
    { id: 'zhong', name: '中火守正', suc: 0.00, quality: 0.00, days: 0, desc: '四平八稳，中规中矩' },
    { id: 'wu', name: '武火猛攻', suc: -0.22, quality: +0.22, days: 0, desc: '成功率 -22%，品质大幅提升' },
    { id: 'su', name: '急火抢时', suc: -0.10, quality: -0.05, days: -1, desc: '工期缩短一天，风险略增' }
  ];

  /* ---------------- 怪物 ----------------
   * 数值基准：同级玩家的期望战斗时长 4~8 回合，单场消耗 20%~45% 气血。
   * 普通 lv1：hp≈40 atk≈9      lv25：hp≈1000 atk≈165
   * 精英      lv1：hp≈65 atk≈10     lv25：hp≈1200 atk≈190
   * 妖兽只给材料与灵石，**不给修为** —— 修为是打坐与丹药的事，
   * 否则秘境会变成刷本，闭关苦修失去意义。
   * ------------------------------------------ */
  const ENEMIES = {
    wolf: { id: 'wolf', name: '青毛妖狼', hp: 38, atk: 8, def: 2, loot: ['dewgrass', 'vineroot'], gold: [3, 8], shape: 'beast' },
    spider: { id: 'spider', name: '碧眼毒蛛', hp: 48, atk: 9, def: 3, loot: ['venomgrass', 'dewgrass'], gold: [4, 10], shape: 'insect' },
    boar: { id: 'boar', name: '铁背山猪', hp: 65, atk: 10, def: 4, loot: ['woodcore', 'vineroot'], gold: [6, 14], shape: 'beast' },

    lizard: { id: 'lizard', name: '赤鳞火蜥', hp: 320, atk: 64, def: 14, loot: ['flameflower', 'firedust'], gold: [10, 24], shape: 'beast' },
    spirit: { id: 'spirit', name: '火魄精怪', hp: 250, atk: 76, def: 6, loot: ['firedust', 'lavacore'], gold: [12, 28], shape: 'ghost' },
    magmabeast: { id: 'magmabeast', name: '熔岩巨蜥', hp: 480, atk: 78, def: 18, loot: ['scarletfruit', 'lavacore'], gold: [24, 56], shape: 'beast' },

    frostwolf: { id: 'frostwolf', name: '霜牙白狼', hp: 400, atk: 82, def: 18, loot: ['icemoss', 'coldspring'], gold: [18, 40], shape: 'beast' },
    iceman: { id: 'iceman', name: '冰魄鬼影', hp: 520, atk: 88, def: 20, loot: ['icemoss', 'coldspring'], gold: [20, 46], shape: 'ghost' },
    turtle: { id: 'turtle', name: '寒潭玄龟', hp: 720, atk: 88, def: 34, loot: ['deepshell', 'frostmarrow'], gold: [36, 80], shape: 'beast' },

    guinsect: { id: 'guinsect', name: '蛊虫群', hp: 500, atk: 100, def: 22, loot: ['venomgrass', 'guflower'], gold: [28, 60], shape: 'insect' },
    bloodbat: { id: 'bloodbat', name: '幽冥血蝠', hp: 430, atk: 118, def: 16, loot: ['bloodginseng', 'venomgrass'], gold: [30, 66], shape: 'flying' },
    guworm: { id: 'guworm', name: '万蛊母虫', hp: 880, atk: 112, def: 38, loot: ['guflower', 'poisonsac', 'bloodginseng'], gold: [60, 140], shape: 'insect' },

    thundermoth: { id: 'thundermoth', name: '紫电雷蛾', hp: 560, atk: 128, def: 26, loot: ['thundershale', 'stormflower'], gold: [44, 96], shape: 'flying' },
    crow: { id: 'crow', name: '紫电雷鸦', hp: 980, atk: 142, def: 48, loot: ['thundershale', 'stormflower'], gold: [90, 200], shape: 'flying' },

    guardpuppet: { id: 'guardpuppet', name: '守灵傀儡', hp: 900, atk: 158, def: 60, loot: ['stardust', 'spiritcrystal'], gold: [80, 180], shape: 'golem' },
    stone: { id: 'stone', name: '遗迹石傀', hp: 1200, atk: 165, def: 78, loot: ['stardust', 'spiritcrystal'], gold: [140, 320], shape: 'golem' },
    remnant: { id: 'remnant', name: '古修残魂', hp: 1100, atk: 190, def: 62, loot: ['primordialfruit', 'immortaldew'], gold: [180, 420], shape: 'ghost' }
  };

  /* ---------------- 秘境 ---------------- */
  const DUNGEONS = [
    {
      id: 'qingmu', name: '青木林', req: 1, days: 1, vision: 4.5,
      desc: '城外的古木林子，灵气稀薄，胜在安全，是散修们练手的老地方。',
      enemies: ['wolf', 'wolf', 'spider', 'boar'], enemyCount: [6, 9],
      gathers: ['commonherb', 'commonherb', 'dewgrass', 'dewgrass', 'vineroot', 'moonflower'], gatherCount: [8, 12],
      chests: ['woodcore', 'jademarrow'], chestCount: [2, 3]
    },
    {
      id: 'huoyun', name: '火云谷', req: 2, days: 2, vision: 4.0,
      desc: '地火熏腾的赤色峡谷，空气扭曲如波纹，火属灵材遍地。',
      enemies: ['lizard', 'lizard', 'spirit', 'spirit', 'magmabeast'], enemyCount: [7, 11],
      gathers: ['flameflower', 'firedust', 'firedust', 'scarletfruit'], gatherCount: [8, 13],
      chests: ['lavacore', 'jademarrow'], chestCount: [2, 4]
    },
    {
      id: 'hantan', name: '寒潭幽谷', req: 5, days: 2, vision: 3.6,
      desc: '终年不见日光的深谷，水汽凝结成霜，寒气能冻裂凡铁。',
      enemies: ['frostwolf', 'iceman', 'iceman', 'turtle'], enemyCount: [6, 9],
      gathers: ['coldspring', 'coldspring', 'icemoss', 'icemoss', 'lingzhi'], gatherCount: [7, 11],
      chests: ['frostmarrow', 'deepshell'], chestCount: [3, 4]
    },
    {
      id: 'wangu', name: '万蛊沼', req: 8, days: 3, vision: 3.2,
      desc: '毒雾缭绕的黑色沼泽，泥下不知埋着多少具尸骨。',
      enemies: ['guinsect', 'guinsect', 'bloodbat', 'guworm'], enemyCount: [6, 9],
      gathers: ['venomgrass', 'guflower', 'bloodginseng'], gatherCount: [6, 10],
      chests: ['poisonsac', 'bloodginseng'], chestCount: [2, 4]
    },
    {
      id: 'leiyuan', name: '玄天雷渊', req: 12, days: 3, vision: 3.0,
      desc: '天雷常年在此地落下，焦土之中埋藏着雷属性的稀世灵材。',
      enemies: ['thundermoth', 'thundermoth', 'crow', 'crow'], enemyCount: [7, 10],
      gathers: ['thundershale', 'stormflower', 'spiritcrystal'], gatherCount: [6, 9],
      chests: ['purplecore', 'thunderjade'], chestCount: [2, 3]
    },
    {
      id: 'yiji', name: '上古遗迹', req: 17, days: 4, vision: 2.8,
      desc: '沉眠于地下的古修士洞府，禁制犹存，石傀仍在巡视。',
      enemies: ['guardpuppet', 'stone', 'stone', 'remnant'], enemyCount: [6, 9],
      gathers: ['stardust', 'spiritcrystal', 'dragonblood'], gatherCount: [5, 8],
      chests: ['chaosstone', 'primordialfruit', 'immortaldew'], chestCount: [3, 4]
    }
  ];

  /* ---------------- 顾客 ---------------- */
  const CUSTOMERS = [
    { id: 'merchant', name: '凡间富商', color: '#c8a15a', budget: [70, 240], pref: ['beauty', 'heal'], weight: 20, greed: 0.75 },
    { id: 'sanxiu', name: '落魄散修', color: '#7d8fa8', budget: [25, 110], pref: ['cultivation', 'heal'], weight: 28, greed: 0.85 },
    { id: 'sword', name: '游侠剑客', color: '#9c6b5f', budget: [60, 260], pref: ['heal', 'buff'], weight: 14, greed: 0.8 },
    { id: 'disciple', name: '宗门弟子', color: '#5f9c8a', budget: [150, 480], pref: ['cultivation', 'buff'], weight: 18, greed: 1.0 },
    { id: 'elder', name: '宗门长老', color: '#b98fc4', budget: [700, 2400], pref: ['rare', 'buff'], weight: 7, greed: 1.15 },
    { id: 'demon', name: '化形妖修', color: '#c4674f', budget: [450, 1600], pref: ['rare', 'cultivation'], weight: 8, greed: 1.1 },
    { id: 'mystery', name: '蒙面客', color: '#54586b', budget: [300, 1200], pref: ['rare', 'poison'], weight: 5, greed: 1.25 }
  ];

  /* ---------------- 丹道感悟天赋树 ---------------- */
  const TALENTS = [
    { id: 'suc', name: '火候精熟', max: 10, cost: 2, step: 0.03, desc: '炼丹成功率 +3% / 级' },
    { id: 'qual', name: '丹心通明', max: 10, cost: 3, step: 0.02, desc: '品质提升概率 +2% / 级' },
    { id: 'yield', name: '一炉双丹', max: 5, cost: 6, step: 0.08, desc: '额外产出一枚丹药的概率 +8% / 级' },
    { id: 'price', name: '巧舌如簧', max: 8, cost: 3, step: 0.05, desc: '丹药售价 +5% / 级' },
    { id: 'cult', name: '悟道于静', max: 8, cost: 3, step: 0.08, desc: '修炼速度 +8% / 级' },
    { id: 'body', name: '淬体秘法', max: 8, cost: 3, step: 0.06, desc: '气血与攻击 +6% / 级' },
    { id: 'fame', name: '医者仁心', max: 6, cost: 4, step: 0.12, desc: '声望获取 +12% / 级' }
  ];

  /* ---------------- 丹炉 ---------------- */
  const FURNACES = [
    { lv: 1, name: '粗陶丹炉', cost: 0, suc: 0.00, quality: 0.00, desc: '街边匠人随手捏的，勉强能用。' },
    { lv: 2, name: '青铜丹炉', cost: 600, suc: 0.05, quality: 0.03, desc: '炉壁刻有简易聚火纹，火候更均匀。' },
    { lv: 3, name: '玄铁丹炉', cost: 2500, suc: 0.10, quality: 0.06, desc: '玄铁锻打三月而成，聚灵效果上佳。' },
    { lv: 4, name: '紫玉丹炉', cost: 9000, suc: 0.16, quality: 0.10, desc: '整块紫玉雕成，丹气不散。' },
    { lv: 5, name: '九龙神炉', cost: 30000, suc: 0.24, quality: 0.16, desc: '传说是丹道祖师遗留之物，九条龙纹自吐丹火。' }
  ];

  /* ---------------- 丹阁零售 ----------------
   * 零售只是路过散客的顺手买卖，利薄量小；真正的大生意在委托订单上。
   * ------------------------------------------ */
  const SHOP = {
    shelves: 4,          // 初始货架数
    baseCustomers: 2,    // 每日基础客流
    repPerCustomer: 34,  // 每多少声望 +1 客流
    priceBand: [0.60, 0.98]   // 散客只肯出公道价的这个区间
  };

  /* ---------------- 委托订单 ----------------
   * 贴子先挂在墙上（open，不计时），玩家主动接下后才开始倒计时（taken）。
   * 急单的主顾等不及：贴子在墙上留不了几天（不接就被别人揭走），
   * 可一旦你应承下来，反倒会给足功夫 —— 失了约才是真丢脸。
   * ------------------------------------------ */
  const ORDERS = {
    openMax: 8,          // 墙上待接的贴子上限
    takeMax: 3,          // 同时经手的委托上限
    dailyBase: 1.1,      // 每日基础新增订单
    repPerOrder: 130,    // 每多少声望 +1 订单机会
    rushChance: 0.30,    // 急单占比
    maxQty: 3,           // 单笔最大数量（一炉通常只出一枚，故偏向小批量）
    // openLife: 贴子在墙上能留几日　days: 接下后的时限
    // mul: 报价系数　rep: 声望　failRep: 失约扣声望
    normal: { openLife: [12, 20], days: [5, 11], mul: [1.5, 1.9], rep: [2, 4], failRep: 0 },
    rush: { openLife: [3, 6], days: [6, 9], mul: [2.5, 3.3], rep: [6, 10], failRep: 2 },
    // 品质要求档位（权重）
    quality: [
      { q: 0, w: 40 },
      { q: 1, w: 34 },
      { q: 2, w: 19 },
      { q: 3, w: 7 }
    ]
  };

  /* ---------------- 委托由头 ---------------- */
  const ORDER_REASONS = {
    merchant: ['家中老太爷寿宴，需丹贺寿', '商行要囤一批货，催得紧', '为独子备些傍身之物', '宴请仙门贵客，不敢怠慢'],
    sanxiu: ['远行前想备几枚保命丹', '道友重伤，急等丹药', '囊中羞涩，只求实惠'],
    sword: ['行走江湖，丹药就是命', '同门受伤，托我来求', '想以丹药换一份人情'],
    disciple: ['宗门例行采买', '师长所命，不敢耽搁', '为师弟妹们备下'],
    elder: ['长老自用，不问价', '门派要炼一炉定例', '旧伤未愈，需灵丹调养'],
    demon: ['妖修以宝易丹', '化形不久，急需固本', '不问来路，只要好丹'],
    mystery: ['雇主不愿留名', '来历不明的人放下定金', '只说三日后取货']
  };

  /* ---------------- 月份 ---------------- */
  const MONTHS = ['正月', '二月', '三月', '四月', '五月', '六月',
    '七月', '八月', '九月', '十月', '冬月', '腊月'];
  const SEASONS = [
    { name: '春', mult: 1.05, tip: '春暖花开，客流略增' },
    { name: '夏', mult: 1.00, tip: '酷暑难耐，疗伤丹药好卖' },
    { name: '秋', mult: 1.10, tip: '秋高气爽，正是采药好时节' },
    { name: '冬', mult: 0.92, tip: '天寒地冻，行人稀少' }
  ];

  /* ---------------- 市场 ----------------
   * 药商坐地起价：买价是基准价的两倍半，小本买卖根本划不来。
   * 真想省钱，还得自己下秘境采。市集只用来应急补一两味缺药。
   * ------------------------------------ */
  const MARKET = ['commonherb', 'dewgrass', 'vineroot', 'moonflower', 'jademarrow', 'lingzhi', 'spiritcrystal', 'bloodginseng', 'dragonblood'];
  const MARKET_BUY = 2.5;    // 买入加价（药商要赚一手）
  const MARKET_SELL = 0.55;  // 卖出折价

  /* ---------------- 修行开销 ----------------
   * 灵石不只是货架上的数字：打坐要布聚灵阵，悟道要焚香，
   * 越往上走，这些开销越是压在丹师肩上的担子。
   *
   * 打坐日耗的标尺：**一枚上品丹的售价 ≈ 同级 2~3 天的开销**
   * （炼气期：聚气丹上品 113 灵石 ≈ 2.3 天 × 50 灵石）。
   * 灵石是修行真正的瓶颈，赚得快才能坐得久。
   * ------------------------------------ */
  const COST = {
    cultPerDay: lv => Math.round(40 + lv * 8 + lv * lv * 1.5),  // 打坐一日所需灵石（布阵用的下品灵石）
    meditateBase: 200,                          // 焚香悟道的固定香火钱
    meditatePerLv: 30,                          // 随境界递增的部分
    meditateDays: 3,                            // 悟道耗时
    talentExp: 1.35,                            // 天赋感悟消耗的陡峭度（越高后期越贵）
    talentMoneyBase: 60,                        // 参悟天赋的灵石底价
    talentMoneyPerLv: 8,                        // 随境界递增的部分
    talentMoneyExp: 1.2                         // 灵石消耗的陡峭度
  };
  function meditateCost(lv) { return COST.meditateBase + lv * COST.meditatePerLv; }
  function cultCost(lv, days) { return COST.cultPerDay(lv) * Math.max(1, days); }
  /** 参悟第 cur+1 层天赋所需灵石 */
  function talentMoneyCost(lv, cur) {
    return Math.round((COST.talentMoneyBase + lv * COST.talentMoneyPerLv) * Math.pow(cur + 1, COST.talentMoneyExp));
  }

  return {
    REALMS, STATS, expNeed, cultGain,
    MATERIALS, PILLS, RECIPES, QUALITY, FIRES,
    ENEMIES, DUNGEONS, CUSTOMERS, TALENTS, FURNACES,
    SHOP, ORDERS, ORDER_REASONS, MONTHS, SEASONS,
    MARKET, MARKET_BUY, MARKET_SELL, COST, meditateCost, cultCost, talentMoneyCost,
    MAX_LEVEL: REALMS.length - 1
  };
})();
