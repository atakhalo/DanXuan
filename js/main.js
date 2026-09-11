/* ============================================================
 * 主入口：引导 / 全局按钮 / 自动存档
 * ==========================================================*/
(function () {
  'use strict';

  function boot() {
    const loaded = G.load();
    G.UI.init();

    if (!loaded) {
      G.log('你在城南盘下了一间铺面，「丹阁」就此开张。柜台、丹炉、药柜，都还空着。', 'big');
      G.log('有人说过：丹道一途，三分靠天赋，七分靠药材。', 'info');
      G.Sys.orderGenerate(2, true);      // 开局先在墙上挂两张不挑品质的委托
      G.log('开张头一天，就有两位客人把求购的贴子贴到了门前的木牌上。', 'info');
      G.save();
      G.UI.gotoGuide();          // 新档先看指要
    } else {
      G.save();                  // 迁移过的旧档立刻回存，免得每次启动都再迁一次
    }

    document.getElementById('btn-guide').onclick = () => G.UI.gotoGuide();

    document.getElementById('btn-reset').onclick = () => {
      G.UI.confirm('重开一局', '所有进度都会消失，确定要另起炉灶吗？', () => {
        G.reset();
        location.reload();
      });
    };

    window.addEventListener('beforeunload', () => G.save());
    setInterval(() => G.save(), 15000);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
