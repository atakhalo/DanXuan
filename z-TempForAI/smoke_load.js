// 无 DOM 环境下加载 data/core/systems/scene，确认改动没有破坏加载与地图生成
const fs = require('fs');
const vm = require('vm');
const path = require('path');

const ROOT = path.join(__dirname, '..');
global.window = global;
global.localStorage = {
  _d: {},
  getItem(k) { return this._d[k] || null; },
  setItem(k, v) { this._d[k] = String(v); },
  removeItem(k) { delete this._d[k]; }
};
global.document = undefined;   // 明确不提供 DOM

for (const f of ['data.js', 'core.js', 'systems.js', 'scene.js']) {
  const src = fs.readFileSync(path.join(ROOT, 'js', f), 'utf8');
  vm.runInThisContext(src, { filename: f });
  console.log('loaded', f);
}

const G = global.G;
console.log('G.Scene.move:', typeof G.Scene.move);
console.log('_debug:', Object.keys(G.Scene._debug).join(','));

// 跑 200 局地图生成，确认连通性检查仍可用
let minOpen = 1e9, maxOpen = 0, bad = 0;
for (let i = 0; i < 200; i++) {
  const d = G.DATA.DUNGEONS[i % G.DATA.DUNGEONS.length];
  const st = G.Scene._debug.genMap(d);
  const reach = G.Scene._debug.flood(st.terrain, G.Scene._debug.PX, G.Scene._debug.PY);
  let open = 0;
  for (let y = 0; y < 14; y++) for (let x = 0; x < 22; x++) if (st.terrain[y][x] === 0) open++;
  minOpen = Math.min(minOpen, reach.size);
  maxOpen = Math.max(maxOpen, reach.size);
  if (reach.size !== open) bad++;
}
console.log(`200 局：可达格 ${minOpen}~${maxOpen}，存在不可达空地 ${bad} 局`);
console.log(bad === 0 && minOpen > 100 ? 'OK' : 'FAIL');
