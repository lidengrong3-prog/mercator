// 评测修复校验：jsdom 加载 index.html，捕获初始化错误，验证关键修复点
const fs = require('fs');
const path = require('path');
const { JSDOM, VirtualConsole } = require('jsdom');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8')
  // 去掉外部脚本（CDN/Supabase），避免网络
  .replace(/<script[^>]*\ssrc=["'][^"']*["'][^>]*><\/script>/g, '');

const errors = [];
const vc = new VirtualConsole();
vc.on('jsdomError', e => errors.push('jsdomError: ' + (e.detail && e.detail.stack ? e.detail.stack : (e.message || e))));
vc.on('error', (...a) => errors.push('console.error: ' + a.map(String).join(' ')));

const dom = new JSDOM(html, {
  runScripts: 'dangerously',
  virtualConsole: vc,
  pretendToBeVisual: true,
  url: 'http://localhost/'
});

setTimeout(() => {
  const w = dom.window;
  const out = [];
  out.push('JAY_PLATFORM_COUNT = ' + w.JAY_PLATFORM_COUNT);
  // 路由切换不报错
  try {
    if (typeof w.switchPage === 'function') {
      ['countries','products','policies','rules','shops','alerts','report','settings','platforms','content','watchlist','overview']
        .forEach(p => w.switchPage(p));
      out.push('switchPage 各页面切换: OK');
    } else out.push('switchPage: 未定义!');
  } catch (e) { errors.push('switchPage 运行错误: ' + e.message); }

  // 面包屑/标题应为中文
  try {
    w.switchPage('countries');
    const bc = w.document.getElementById('breadcrumb');
    const pt = w.document.getElementById('page-title');
    out.push('面包屑(countries) = ' + (bc ? bc.textContent : 'N/A'));
    out.push('标题(countries) = ' + (pt ? pt.textContent : 'N/A'));
  } catch(e){ errors.push('breadcrumb 错误: '+e.message); }

  // 平台数 KPI
  const kpi = w.document.getElementById('kpi-platforms');
  out.push('KPI 平台数 = ' + (kpi ? kpi.textContent : 'N/A'));

  // 导出函数存在
  out.push('rpExportAll = ' + (typeof w.rpExportAll));
  out.push('plExportReport = ' + (typeof w.plExportReport));
  out.push('jayExportReport = ' + (typeof w.jayExportReport));

  // 术语表
  out.push('jayOpenGlossary = ' + (typeof w.jayOpenGlossary));

  // 商品归一化：美元->人民币（Poolhacker $35-40 -> 252-288）
  try {
    if (typeof w.products !== 'undefined' && w.products) {
      const ph = w.products.find(p => Array.isArray(p) && /Poolhacker/.test(p[1]||''));
      out.push('Poolhacker rmb(归一化后) = ' + (ph ? ph[7] : 'N/A (行未找到)'));
      const tl = w.products.find(p => Array.isArray(p) && /Toplux/.test(p[1]||''));
      out.push('Toplux signal(归一化后) = ' + (tl ? tl[10] : 'N/A'));
    }
  } catch(e){ out.push('products 检查异常: '+e.message); }

  console.log('==== 校验输出 ====');
  out.forEach(l => console.log(' ' + l));
  console.log('==== 初始化错误数: ' + errors.length + ' ====');
  errors.slice(0, 25).forEach(e => console.log(' ERR ' + e.slice(0, 400)));
  process.exit(0);
}, 2000);
