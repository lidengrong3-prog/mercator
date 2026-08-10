// 验证 mercatorFetchMarketData 的新行为：本地优先、Supabase 并行兜底、超时保护
global.AbortController = class {
  constructor(){ this.signal = { aborted:false }; }
  abort(){ this.signal.aborted = true; }
};

let supaHang = false;
global.fetch = function(url, opts) {
  // 模拟 Supabase 远端：market_data 路径
  if (url.indexOf('market_data') >= 0) {
    if (supaHang) return new Promise(function(_res, rej){ setTimeout(function(){ rej(new Error('aborted')); }, 4000); }); // 4s 后被中止，模拟远端挂起
    return Promise.resolve({ ok: true, json: function(){ return Promise.resolve([{ data: { src: 'supa' } }]); } });
  }
  // 模拟本地 JSON：FAIL 路径失败，否则成功
  if (url.indexOf('FAIL') >= 0) return Promise.reject(new Error('local fail'));
  return Promise.resolve({ ok: true, json: function(){ return Promise.resolve({ src: 'local' }); } });
};

var MERCATOR_SUPABASE_URL = 'https://x.supabase.co';
var MERCATOR_ANON_KEY = 'k';
var MERCATOR_API_URL = MERCATOR_SUPABASE_URL + '/rest/v1';

async function mercatorFetchMarketData(key, fallbackUrl) {
  function localTry() {
    return fetch(fallbackUrl).then(function(r){ return r.ok ? r.json() : null; }).catch(function(){ return null; });
  }
  function supaTry() {
    if (!(MERCATOR_SUPABASE_URL && MERCATOR_SUPABASE_URL !== 'YOUR_SUPABASE_URL')) return Promise.resolve(null);
    var ctrl = new AbortController();
    var timer = setTimeout(function(){ ctrl.abort(); }, 4000);
    return fetch(MERCATOR_API_URL + '/market_data?key=eq.' + encodeURIComponent(key) + '&select=data,meta', {
      headers: { 'apikey': MERCATOR_ANON_KEY, 'Authorization': 'Bearer ' + MERCATOR_ANON_KEY },
      signal: ctrl.signal
    }).then(function(r){ return r.ok ? r.json() : null; })
      .then(function(rows){
        clearTimeout(timer);
        if (rows && rows.length > 0 && rows[0].data) return rows[0].data;
        return null;
      }).catch(function(){ clearTimeout(timer); return null; });
  }
  var localP = localTry();
  var supaP = supaTry();
  var localData = await localP;
  if (localData) return localData;
  return await supaP;
}

(async function(){
  // 场景1：本地有效 → 立即返回本地（首屏不被远端阻塞）
  var t0 = Date.now();
  var r1 = await mercatorFetchMarketData('platforms', 'data/platforms.json');
  console.log('场景1 本地优先:', JSON.stringify(r1), '| 耗时', Date.now()-t0, 'ms (应≈0，不阻塞)');

  // 场景2：本地失败、Supabase 有效 → 返回 Supabase
  var r2 = await mercatorFetchMarketData('platforms', 'FAIL');
  console.log('场景2 本地失败用Supabase:', JSON.stringify(r2), '| (应为 {src:supa})');

  // 场景3：远端挂起但本地有效 → 本地立即返回，不卡
  supaHang = true;
  var t3 = Date.now();
  var r3 = await mercatorFetchMarketData('platforms', 'data/platforms.json');
  console.log('场景3 远端挂起时本地优先:', JSON.stringify(r3), '| 耗时', Date.now()-t3, 'ms (应≈0)');
  supaHang = false;

  // 场景4：本地失败 + 远端挂起 → 4s 超时后兜底返回 null（不永远挂起）
  supaHang = true;
  var t4 = Date.now();
  var r4 = await mercatorFetchMarketData('platforms', 'FAIL');
  console.log('场景4 本地失败+远端挂起→超时兜底:', JSON.stringify(r4), '| 耗时', Date.now()-t4, 'ms (应≈4000)');
  supaHang = false;

  console.log('ALL TESTS DONE');
})();
