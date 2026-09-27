export type MacroHistoryRow = Record<string, unknown>;

const MACRO_SOURCE_KEYS = new Set(['fred', 'bls', 'macro-official']);
const MACRO_ROW_PATTERN = /ecomsa|ecompctsa|rsafs|umcsent|dspic96|pcec96|cpi|mrtssm|ces\d{10}|payems|unrate|gdp|fedfunds|dex[a-z0-9]+|retail|employment|nonfarm|inflation|unemployment|interest rate|exchange rate|零售|电商|消费|收入|信心|就业|非农|失业|通胀|利率|汇率|国内生产总值/i;

function rowText(row: MacroHistoryRow): string {
  return [
    row.record_key, row.title, row.content_excerpt, row.summary, row.source_name,
    row.source_key, row.source_record_id, row.series_id,
  ].map((part) => String(part || '')).join(' ').toLowerCase();
}

export function isMacroQuestion(value: string): boolean {
  return /\b(?:CES\d{10}|PAYEMS|UNRATE|CPI(?:AUCSL)?|GDP|FEDFUNDS|ECOMSA|ECOMPCTSA|RSAFS|UMCSENT|DSPIC96|PCEC96)\b|\bBLS\b|\bFRED\b|非农|就业人数|就业数据|失业率|消费者物价|消费价格|CPI|通胀|国内生产总值|GDP|联邦基金利率|利率|汇率|宏观指标|宏观数据/i.test(value);
}

export function isMacroHistoryRow(value: unknown): value is MacroHistoryRow {
  if (!value || typeof value !== 'object') return false;
  const row = value as MacroHistoryRow;
  const source = String(row.source_key || '').toLowerCase();
  return MACRO_SOURCE_KEYS.has(source) && MACRO_ROW_PATTERN.test(rowText(row));
}

function requestedSeriesIds(query: string): string[] {
  return Array.from(new Set(query.toUpperCase().match(/\b(?:CES\d{10}|PAYEMS|UNRATE|CPI(?:AUCSL)?|GDP|FEDFUNDS|ECOMSA|ECOMPCTSA|RSAFS|UMCSENT|DSPIC96|PCEC96)\b/g) || []));
}

function relevanceScore(row: MacroHistoryRow, query: string): number {
  const haystack = rowText(row);
  const ids = requestedSeriesIds(query);
  let score = 0;
  for (const id of ids) {
    if (haystack.includes(id.toLowerCase())) score += 1000;
  }
  const normalized = query.toLowerCase();
  const signals: Array<[RegExp, RegExp, number]> = [
    [/非农|nonfarm/i, /ces0000000001|payems|nonfarm|非农/i, 300],
    [/就业|employment/i, /ces0000000001|payems|nonfarm|total employment|就业人数|全部雇员/i, 220],
    [/失业|unemployment|unrate/i, /unrate|unemployment|失业/i, 260],
    [/cpi|通胀|物价|inflation/i, /cpi|inflation|通胀|物价/i, 260],
    [/gdp|国内生产总值/i, /gdp|国内生产总值/i, 260],
    [/利率|fedfunds|interest rate/i, /fedfunds|interest rate|利率/i, 260],
    [/汇率|exchange rate/i, /dex[a-z0-9]+|exchange rate|汇率/i, 260],
    [/零售|retail/i, /rsafs|mrtssm|retail|零售/i, 200],
    [/电商|e-?commerce/i, /ecomsa|ecompctsa|e-?commerce|电商/i, 200],
  ];
  for (const [queryPattern, rowPattern, weight] of signals) {
    if (queryPattern.test(normalized) && rowPattern.test(haystack)) score += weight;
  }
  return score;
}

export function selectRelevantMacroRows(rows: unknown[], query: string, limit = 8): MacroHistoryRow[] {
  const macroRows = rows.filter(isMacroHistoryRow);
  const ranked = macroRows.map((row, index) => ({ row, index, score: relevanceScore(row, query) }));
  const hasRelevantMatch = ranked.some((item) => item.score > 0);
  return ranked
    .filter((item) => !hasRelevantMatch || item.score > 0)
    .sort((left, right) => right.score - left.score || left.index - right.index)
    .slice(0, Math.max(1, limit))
    .map((item) => item.row);
}
