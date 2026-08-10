const fs = require('fs');
const src = fs.readFileSync('D:/AI工具/mercator-main/index.html', 'utf8');
const lines = src.split(/\r?\n/);
function span(a, b){ return lines.slice(a-1, b).join('\n'); } // 1-based inclusive
const code = [
  span(3834, 3842),   // escapeHtml
  span(8507, 8587),   // chart block
  span(8588, 8640),   // renderMarkdownSafe
  span(8641, 8646),   // inlineFmt
].join('\n');

const sandbox = {};
const fn = new Function(code + '\nreturn { rpRenderReportWithCharts: rpRenderReportWithCharts, jayRenderChartSpec: jayRenderChartSpec };');
const api = fn();

const sample = [
  '## 二、市场优先级总览',
  '',
  '以下是综合得分排序：',
  '',
  '```chart',
  '{"type":"hbar","title":"市场优先级排序（综合得分）","labels":["越南","泰国","马来","印尼"],"values":[88,82,76,70],"source":"来源：JAY观海综合测算，2026"}',
  '```',
  '',
  '## 四、竞品调研',
  '',
  '```chart',
  '{"type":"pie","title":"品牌份额估算","labels":["帮宝适","花王","好奇","国货"],"values":[28,22,18,32],"source":"来源：行业估算，2026","note":"估算值，仅供参考"}',
  '```',
  '',
  '## 三、宏观市场环境',
  '',
  '```chart',
  '{"type":"bar","title":"区域市场规模（亿美元）","labels":["东南亚","中东","拉美","东欧"],"values":[120,80,60,45]}',
  '```',
  '',
  '## 五、消费者需求与痛点',
  '',
  '> ✅ 东南亚年轻家庭对高性价比纸尿裤需求旺盛。',
  '> ⚠ 部分市场准入认证（如 halal）周期长。',
].join('\n');

const html = api.rpRenderReportWithCharts(sample);

const checks = {
  HAS_SVG: (html.match(/<svg/g) || []).length,
  FIGURES: (html.match(/<figure class="jay-chart">/g) || []).length,
  HBAR: html.includes('type="hbar"') || html.includes('市场优先级排序'),
  PIE: html.includes('品牌份额估算'),
  BAR: html.includes('区域市场规模'),
  CAPTION: html.includes('jay-chart-cap'),
  SOURCE: html.includes('jay-chart-src'),
  NOTE: html.includes('jay-chart-note'),
  CALLOUT_OK: html.includes('rp-v2-rpt-success') && html.includes('rp-v2-rpt-risk'),
  TABLE_OK: !html.includes('undefined'),
};
console.log(JSON.stringify(checks, null, 2));
console.log('RENDER_LEN', html.length);
