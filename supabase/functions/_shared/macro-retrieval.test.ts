import { isMacroQuestion, selectRelevantMacroRows } from './macro-retrieval.ts';

const macroRows = [
  { source_key: 'fred', record_key: 'CPIAUCSL', title: 'Consumer Price Index', content_excerpt: '{\"series_id\":\"CPIAUCSL\",\"value\":321}' },
  { source_key: 'bls', record_key: 'CES0000000001', title: '美国非农就业人数：全部雇员（季调）', content_excerpt: '{\"series_id\":\"CES0000000001\",\"value\":159540,\"unit\":\"千人\"}' },
  { source_key: 'fred', record_key: 'UNRATE', title: 'Unemployment Rate', content_excerpt: '{\"series_id\":\"UNRATE\",\"value\":4.3}' },
];

Deno.test('explicit BLS series ID wins over earlier mixed macro rows', () => {
  const selected = selectRelevantMacroRows(macroRows, 'CES0000000001 代表什么指标？最新数值是多少？', 8);
  if (selected.length !== 1 || selected[0].record_key !== 'CES0000000001') {
    throw new Error(`expected exact BLS series, got ${JSON.stringify(selected)}`);
  }
});

Deno.test('Chinese nonfarm question is recognized as a macro question', () => {
  if (!isMacroQuestion('美国最新非农就业人数是多少')) throw new Error('nonfarm query was not recognized');
});

Deno.test('ordinary greeting is not recognized as a macro question', () => {
  if (isMacroQuestion('你好，帮我写一封开发信')) throw new Error('greeting was incorrectly classified');
});

Deno.test('nonfarm query excludes unrelated CPI rows', () => {
  const selected = selectRelevantMacroRows(macroRows, '美国最新非农就业人数是多少', 8);
  if (!selected.length || selected.some((row) => row.record_key === 'CPIAUCSL')) {
    throw new Error(`unrelated CPI row leaked into nonfarm results: ${JSON.stringify(selected)}`);
  }
});
