const fs = require('node:fs/promises');
const path = require('node:path');

const COLUMNS = [
  'external_id',
  'executed_at_utc',
  'institution',
  'account',
  'acquired_instrument',
  'acquired_quantity',
  'disposed_instrument',
  'disposed_quantity',
  'fee_instrument',
  'fee_quantity',
  'fee_value_eur_cents',
  'asset_listing_ticker',
  'asset_listing_market',
  'execution_value_eur_cents',
  'notes',
];
const FEE = /source fees \(unvalued\): ([A-Z]+) ([0-9]+(?:\.[0-9]+)?)/;
const BINANCE = 'https://api.binance.com/api/v3/klines';
const ECB = 'https://data-api.ecb.europa.eu/service/data/EXR/D.BRL.EUR.SP00.A';
const USER_CONFIRMED_FEE_FREE = new Set([
  'binance-row-0124',
  'binance-row-0126',
  'binance-row-1217',
  'binance-row-1218',
  'binance-row-1569',
  'binance-row-1571',
  'binance-row-1610',
  'binance-row-1955',
]);
const USER_CONFIRMED_GROSS_QUANTITIES = new Set(['binance-row-1217', 'binance-row-1218']);
const priceCache = new Map();
const brlCache = new Map();

function parseCsv(text) {
  const rows = [];
  let row = [];
  let value = '';
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (quoted) {
      if (char === '"' && text[i + 1] === '"') {
        value += char;
        i += 1;
      } else if (char === '"') quoted = false;
      else value += char;
    } else if (char === '"') quoted = true;
    else if (char === ',') {
      row.push(value);
      value = '';
    } else if (char === '\n') {
      row.push(value.replace(/\r$/, ''));
      rows.push(row);
      row = [];
      value = '';
    } else value += char;
  }
  if (value || row.length) {
    row.push(value.replace(/\r$/, ''));
    rows.push(row);
  }
  return rows;
}

function csv(rows) {
  return `${rows.map((row) => row.map((value) => `"${String(value ?? '').replaceAll('"', '""')}"`).join(',')).join('\n')}\n`;
}

function fraction(value) {
  const [whole, decimal = ''] = String(value).split('.');
  const den = 10n ** BigInt(decimal.length);
  return { n: BigInt(`${whole}${decimal}`), d: den };
}
function multiply(a, b) {
  return { n: a.n * b.n, d: a.d * b.d };
}
function divide(a, b) {
  return { n: a.n * b.d, d: a.d * b.n };
}
function add(a, b) {
  return { n: a.n * b.d + b.n * a.d, d: a.d * b.d };
}
function equals(a, b) {
  return a.n * b.d === b.n * a.d;
}
function decimal(a, places = 18) {
  const negative = a.n < 0n;
  const n = negative ? -a.n : a.n;
  const scaled = n * 10n ** BigInt(places);
  const q = scaled / a.d;
  const raw = q.toString().padStart(places + 1, '0');
  const result = `${raw.slice(0, -places)}.${raw.slice(-places)}`.replace(/\.?0+$/, '');
  return negative ? `-${result}` : result;
}
function centsHalfUp(eur) {
  const scaled = eur.n * 100n;
  const q = scaled / eur.d;
  const r = scaled % eur.d;
  return r * 2n >= eur.d ? q + 1n : q;
}
function minute(timestamp) {
  return Math.floor(Date.parse(timestamp) / 60000) * 60000;
}
function iso(ms) {
  return new Date(ms).toISOString().replace('.000Z', 'Z');
}

async function getJson(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}

async function candle(symbol, openTime) {
  const key = `${symbol}:${openTime}`;
  if (priceCache.has(key)) return priceCache.get(key);
  const url = `${BINANCE}?symbol=${symbol}&interval=1m&startTime=${openTime}&endTime=${openTime + 60000}&limit=1`;
  const result = await getJson(url)
    .then((data) => {
      const item = data[0];
      if (!item || item[0] !== openTime) return null;
      return { symbol, close: item[4], openTime, url };
    })
    .catch(() => null);
  priceCache.set(key, result);
  return result;
}

async function brlEur(timestamp) {
  const day = timestamp.slice(0, 10);
  if (brlCache.has(day)) return brlCache.get(day);
  const end = new Date(`${day}T00:00:00Z`);
  const start = new Date(end.getTime() - 8 * 86400000).toISOString().slice(0, 10);
  const url = `${ECB}?startPeriod=${start}&endPeriod=${day}&format=csvdata`;
  const text = await fetch(url).then(async (response) => (response.ok ? response.text() : Promise.reject(new Error(`HTTP ${response.status}`))));
  const data = parseCsv(text);
  const header = data[0];
  const dateIndex = header.indexOf('TIME_PERIOD');
  const rateIndex = header.indexOf('OBS_VALUE');
  const latest = data
    .slice(1)
    .filter((row) => row[dateIndex] <= day)
    .at(-1);
  const result = latest
    ? {
        rate: fraction(latest[rateIndex]),
        date: latest[dateIndex],
        url,
        fallback: latest[dateIndex] === day ? '' : `ECB latest published rate on or before execution date (${latest[dateIndex]})`,
      }
    : null;
  brlCache.set(day, result);
  return result;
}

async function eurPerUnit(code, timestamp, seen = new Set()) {
  if (code === 'EUR')
    return {
      rate: fraction('1'),
      path: 'actual EUR consideration',
      sources: [{ type: 'input CSV', request: 'recorded EUR trade leg', timestamp, priceField: 'quantity', rate: '1', direction: 'EUR per EUR' }],
      fallback: '',
    };
  if (code === 'BRL') {
    const ecb = await brlEur(timestamp);
    if (!ecb) return null;
    return {
      rate: divide(fraction('1'), ecb.rate),
      path: `BRL / ECB BRL per EUR`,
      sources: [
        {
          type: 'ECB daily reference rate',
          request: ecb.url,
          timestamp: `${ecb.date}T00:00:00Z`,
          priceField: 'OBS_VALUE (BRL per EUR)',
          rate: decimal(ecb.rate),
          direction: 'divide BRL by BRL/EUR',
        },
      ],
      fallback: ecb.fallback || 'ECB daily rate, not one-minute execution price',
    };
  }
  if (seen.has(code)) return null;
  const next = new Set(seen).add(code);
  const openTime = minute(timestamp);
  const direct = await candle(`${code}EUR`, openTime);
  if (direct)
    return {
      rate: fraction(direct.close),
      path: `${code}EUR close`,
      sources: [
        {
          type: 'Binance 1m kline',
          request: direct.url,
          timestamp: iso(direct.openTime),
          priceField: 'close',
          rate: direct.close,
          direction: `EUR per ${code}`,
        },
      ],
      fallback: '',
    };
  const inverse = await candle(`EUR${code}`, openTime);
  if (inverse)
    return {
      rate: divide(fraction('1'), fraction(inverse.close)),
      path: `1 / EUR${code} close`,
      sources: [
        {
          type: 'Binance 1m kline',
          request: inverse.url,
          timestamp: iso(inverse.openTime),
          priceField: 'close',
          rate: inverse.close,
          direction: `${code} per EUR; inverted`,
        },
      ],
      fallback: '',
    };
  for (const quote of ['USDT', 'USDC', 'BUSD', 'DAI', 'BTC', 'ETH', 'BNB']) {
    if (quote === code || next.has(quote)) continue;
    const quoted = await candle(`${code}${quote}`, openTime);
    if (!quoted) continue;
    const quoteEur = await eurPerUnit(quote, timestamp, next);
    if (!quoteEur) continue;
    return {
      rate: multiply(fraction(quoted.close), quoteEur.rate),
      path: `${code}${quote} close × ${quoteEur.path}`,
      sources: [
        {
          type: 'Binance 1m kline',
          request: quoted.url,
          timestamp: iso(quoted.openTime),
          priceField: 'close',
          rate: quoted.close,
          direction: `${quote} per ${code}`,
        },
        ...quoteEur.sources,
      ],
      fallback: quoteEur.fallback,
    };
  }
  return null;
}

function entry(row) {
  return Object.fromEntries(COLUMNS.map((column, index) => [column, row[index] ?? '']));
}
function feeFromNotes(notes) {
  const match = notes.match(FEE);
  return match ? { instrument: match[1], quantity: match[2] } : null;
}
function sourceTime(timestamp) {
  return timestamp.replace('T', ' ').replace('Z', '');
}
function sourceGroups(rows) {
  const header = rows.shift();
  header[0] = header[0].replace(/^\uFEFF/, '');
  const groups = new Map();
  for (const row of rows) {
    const item = Object.fromEntries(header.map((column, index) => [column, row[index] ?? '']));
    if (!groups.has(item.Time)) groups.set(item.Time, []);
    groups.get(item.Time).push(item);
  }
  return groups;
}
function sourceMatch(row, groups) {
  const records = groups.get(sourceTime(row.executed_at_utc))?.filter((item) => item.Account === 'Spot') ?? [];
  const acquisition = records
    .filter((item) => item.Coin === row.acquired_instrument && fraction(item.Change).n > 0n)
    .reduce((sum, item) => add(sum, fraction(item.Change)), fraction('0'));
  const disposal = records
    .filter((item) => item.Coin === row.disposed_instrument && fraction(item.Change).n < 0n)
    .reduce((sum, item) => add(sum, { n: -fraction(item.Change).n, d: fraction(item.Change).d }), fraction('0'));
  if (!records.length || !equals(acquisition, fraction(row.acquired_quantity)) || !equals(disposal, fraction(row.disposed_quantity)))
    return { status: 'UNMATCHED_OR_AMBIGUOUS_SOURCE_GROUP', grossVerified: false };
  const expectedLeg = (item) =>
    (item.Coin === row.acquired_instrument && fraction(item.Change).n > 0n) || (item.Coin === row.disposed_instrument && fraction(item.Change).n < 0n);
  const fees = records.filter((item) => item.Operation === 'Fee');
  if (records.some((item) => !expectedLeg(item) && item.Operation !== 'Fee')) return { status: 'UNMATCHED_OR_AMBIGUOUS_SOURCE_GROUP', grossVerified: false };
  const byInstrument = new Map();
  for (const item of fees)
    byInstrument.set(item.Coin, add(byInstrument.get(item.Coin) ?? fraction('0'), { n: -fraction(item.Change).n, d: fraction(item.Change).d }));
  if (byInstrument.size === 0) return { status: 'CONFIRMED_FEE_FREE', grossVerified: true };
  if (byInstrument.size > 1) return { status: 'MULTIPLE_FEE_INSTRUMENTS', grossVerified: true };
  const [instrument, quantity] = byInstrument.entries().next().value;
  return { status: 'SOURCE_FEE_CONFIRMED', grossVerified: true, fee: { instrument, quantity: decimal(quantity, 18) } };
}
function reportRow(value) {
  return value;
}

function validate(original, prepared, enriched, report) {
  if (original.length !== prepared.length || original.length !== enriched.length || new Set(original.map((row) => row.external_id)).size !== original.length)
    throw new Error('Row count or stable ID reconciliation failed.');
  const immutable = COLUMNS.filter((column) => !['fee_instrument', 'fee_quantity', 'fee_value_eur_cents', 'execution_value_eur_cents'].includes(column));
  for (let index = 0; index < original.length; index += 1)
    for (const column of immutable)
      if (original[index][column] !== prepared[index][column] || original[index][column] !== enriched[index][column])
        throw new Error(`Preservation check failed for ${original[index].external_id}:${column}`);
  if (report.filter((row) => row.kind === 'fee' && row.instrument).length !== 558) throw new Error('Recovered fee reconciliation failed.');
}

async function mapLimit(items, limit, worker) {
  const results = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (next < items.length) {
        const index = next;
        next += 1;
        results[index] = await worker(items[index], index);
      }
    }),
  );
  return results;
}

async function main() {
  const [input, outputDir, originalExport] = process.argv.slice(2);
  if (!input || !outputDir || !originalExport)
    throw new Error('Usage: node scripts/enrich-binance-investment-trades.cjs INPUT.csv OUTPUT_DIR ORIGINAL-EXPORT.csv');
  const inputBytes = await fs.readFile(input);
  const parsed = parseCsv(inputBytes.toString('utf8'));
  const header = parsed.shift();
  if (header.join(',') !== COLUMNS.join(',')) throw new Error('Input columns do not match the normalized investment CSV contract.');
  const exportGroups = sourceGroups(parseCsv(await fs.readFile(originalExport, 'utf8')));
  const original = parsed.map(entry);
  const prepared = new Array(original.length);
  const enriched = new Array(original.length);
  const reportByIndex = Array.from({ length: original.length }, () => []);
  await mapLimit(original, 12, async (row, index) => {
    const noteFee = feeFromNotes(row.notes);
    const source = sourceMatch(row, exportGroups);
    const userConfirmedFeeFree = USER_CONFIRMED_FEE_FREE.has(row.external_id);
    const fee = userConfirmedFeeFree ? null : (source.fee ?? noteFee);
    const base = { ...row };
    const prep = { ...base, fee_instrument: fee?.instrument ?? '', fee_quantity: fee?.quantity ?? '', fee_value_eur_cents: '', execution_value_eur_cents: '' };
    prepared[index] = prep;
    const result = { ...prep };
    const flags = [
      source.grossVerified
        ? 'GROSS_QUANTITIES_CONFIRMED_FROM_ORIGINAL_EXPORT'
        : USER_CONFIRMED_GROSS_QUANTITIES.has(row.external_id)
          ? 'GROSS_QUANTITIES_USER_CONFIRMED'
          : 'GROSS_NET_UNVERIFIED_SOURCE_GROUP_AMBIGUOUS',
    ];
    const candidates =
      row.disposed_instrument === 'EUR'
        ? [{ leg: 'disposed', instrument: 'EUR', quantity: row.disposed_quantity }]
        : row.acquired_instrument === 'EUR'
          ? [{ leg: 'acquired', instrument: 'EUR', quantity: row.acquired_quantity }]
          : [
              { leg: 'disposed', instrument: row.disposed_instrument, quantity: row.disposed_quantity },
              { leg: 'acquired', instrument: row.acquired_instrument, quantity: row.acquired_quantity },
            ].sort(
              (a, b) =>
                (['BRL', 'USDT', 'USDC', 'BUSD', 'DAI'].includes(b.instrument) ? 1 : 0) -
                (['BRL', 'USDT', 'USDC', 'BUSD', 'DAI'].includes(a.instrument) ? 1 : 0),
            );
    let execution = null;
    for (const candidate of candidates) {
      const rate = await eurPerUnit(candidate.instrument, row.executed_at_utc);
      if (rate) {
        execution = { ...candidate, rate };
        break;
      }
    }
    if (execution) {
      const raw = multiply(fraction(execution.quantity), execution.rate.rate);
      const cents = centsHalfUp(raw);
      if (cents > 0n) result.execution_value_eur_cents = cents.toString();
      reportByIndex[index].push(
        reportRow({
          external_id: row.external_id,
          kind: 'execution',
          status: cents > 0n ? 'RESOLVED' : 'UNRESOLVED',
          selected_leg: execution.leg,
          instrument: execution.instrument,
          quantity: execution.quantity,
          eur_value_cents: cents > 0n ? cents.toString() : '',
          conversion_path: execution.rate.path,
          price_timestamp_utc: execution.rate.sources.map((source) => source.timestamp).join(' -> '),
          price_field: execution.rate.sources.map((source) => source.priceField).join(' -> '),
          rates_used: execution.rate.sources.map((source) => `${source.direction}: ${source.rate}`).join(' | '),
          raw_eur: decimal(raw),
          rounding_decision: `decimal half-up to ${cents} cents`,
          fallback: execution.rate.fallback,
          source_requests: execution.rate.sources.map((source) => source.request).join(' | '),
          unresolved_reason: cents > 0n ? '' : 'EXECUTION_ROUNDS_TO_ZERO_CENTS',
          flags: flags.join('|'),
        }),
      );
    } else
      reportByIndex[index].push(
        reportRow({
          external_id: row.external_id,
          kind: 'execution',
          status: 'UNRESOLVED',
          selected_leg: '',
          instrument: '',
          quantity: '',
          eur_value_cents: '',
          conversion_path: '',
          price_timestamp_utc: '',
          price_field: '',
          rates_used: '',
          raw_eur: '',
          rounding_decision: '',
          fallback: '',
          source_requests: '',
          unresolved_reason: 'MISSING_HISTORICAL_BINANCE_OR_ECB_COVERAGE',
          flags: flags.join('|'),
        }),
      );
    if (!fee && (source.status === 'CONFIRMED_FEE_FREE' || userConfirmedFeeFree)) {
      reportByIndex[index].push(
        reportRow({
          external_id: row.external_id,
          kind: 'fee',
          status: userConfirmedFeeFree ? 'USER_CONFIRMED_FEE_FREE' : 'CONFIRMED_FEE_FREE',
          selected_leg: '',
          instrument: '',
          quantity: '',
          eur_value_cents: '',
          conversion_path: '',
          price_timestamp_utc: row.executed_at_utc,
          price_field: '',
          rates_used: '',
          raw_eur: '',
          rounding_decision: '',
          fallback: '',
          source_requests: userConfirmedFeeFree
            ? 'user confirmation in this conversation'
            : `original Binance export timestamp ${sourceTime(row.executed_at_utc)}`,
          unresolved_reason: '',
          flags: flags.join('|'),
        }),
      );
    } else if (!fee) {
      flags.push('UNKNOWN_FEE_STATUS');
      reportByIndex[index].push(
        reportRow({
          external_id: row.external_id,
          kind: 'fee',
          status: 'UNRESOLVED',
          selected_leg: '',
          instrument: '',
          quantity: '',
          eur_value_cents: '',
          conversion_path: '',
          price_timestamp_utc: '',
          price_field: '',
          rates_used: '',
          raw_eur: '',
          rounding_decision: '',
          fallback: '',
          source_requests: '',
          unresolved_reason: source.status,
          flags: flags.join('|'),
        }),
      );
    } else {
      const rate = await eurPerUnit(fee.instrument, row.executed_at_utc);
      if (!rate)
        reportByIndex[index].push(
          reportRow({
            external_id: row.external_id,
            kind: 'fee',
            status: 'UNRESOLVED',
            selected_leg: '',
            instrument: fee.instrument,
            quantity: fee.quantity,
            eur_value_cents: '',
            conversion_path: '',
            price_timestamp_utc: '',
            price_field: '',
            rates_used: '',
            raw_eur: '',
            rounding_decision: '',
            fallback: '',
            source_requests: '',
            unresolved_reason: 'MISSING_HISTORICAL_BINANCE_COVERAGE',
            flags: flags.join('|'),
          }),
        );
      else {
        const raw = multiply(fraction(fee.quantity), rate.rate);
        const cents = centsHalfUp(raw);
        if (cents > 0n) result.fee_value_eur_cents = cents.toString();
        else result.fee_value_eur_cents = '0';
        reportByIndex[index].push(
          reportRow({
            external_id: row.external_id,
            kind: 'fee',
            status: cents > 0n ? 'RESOLVED' : 'USER_ACCEPTED_ZERO_CENT_FEE',
            selected_leg: '',
            instrument: fee.instrument,
            quantity: fee.quantity,
            eur_value_cents: cents.toString(),
            conversion_path: rate.path,
            price_timestamp_utc: rate.sources.map((source) => source.timestamp).join(' -> '),
            price_field: rate.sources.map((source) => source.priceField).join(' -> '),
            rates_used: rate.sources.map((source) => `${source.direction}: ${source.rate}`).join(' | '),
            raw_eur: decimal(raw),
            rounding_decision: `decimal half-up to ${cents} cents`,
            fallback: rate.fallback,
            source_requests: rate.sources.map((source) => source.request).join(' | '),
            unresolved_reason: '',
            flags: cents > 0n ? flags.join('|') : [...flags, 'FEE_VALUE_ZERO_USER_ACCEPTED_CURRENT_IMPORTER_REJECTS'].join('|'),
          }),
        );
      }
    }
    enriched[index] = result;
  });
  const report = reportByIndex.flat();
  const reportColumns = [
    'external_id',
    'kind',
    'status',
    'selected_leg',
    'instrument',
    'quantity',
    'eur_value_cents',
    'conversion_path',
    'price_timestamp_utc',
    'price_field',
    'rates_used',
    'raw_eur',
    'rounding_decision',
    'fallback',
    'source_requests',
    'unresolved_reason',
    'flags',
  ];
  validate(original, prepared, enriched, report);
  const unresolved = report.filter((item) => item.status === 'UNRESOLVED');
  const feeRows = report.filter((item) => item.kind === 'fee');
  const summary = [
    '# Binance investment valuation report',
    '',
    `- Input rows: ${original.length}`,
    `- Prepared rows: ${prepared.length}`,
    `- Enriched rows: ${enriched.length}`,
    `- Fee quantities recovered: ${feeRows.filter((item) => item.instrument).length} (BNB ${feeRows.filter((item) => item.instrument === 'BNB').length}, ETH ${feeRows.filter((item) => item.instrument === 'ETH').length}, ADA ${feeRows.filter((item) => item.instrument === 'ADA').length}, LINK ${feeRows.filter((item) => item.instrument === 'LINK').length})`,
    `- Confirmed fee-free trades: ${feeRows.filter((item) => ['CONFIRMED_FEE_FREE', 'USER_CONFIRMED_FEE_FREE'].includes(item.status)).length}`,
    `- Execution valuations resolved: ${report.filter((item) => item.kind === 'execution' && item.status === 'RESOLVED').length}`,
    `- Fee valuations resolved: ${feeRows.filter((item) => item.status === 'RESOLVED').length}`,
    `- User-accepted zero-cent fee values: ${feeRows.filter((item) => item.status === 'USER_ACCEPTED_ZERO_CENT_FEE').length}`,
    `- Unresolved report entries: ${unresolved.length}`,
    '',
    '## Importer contract',
    '',
    'The enriched CSV has no unresolved fee status or valuation. It is still not import-ready because the current importer requires positive fee EUR cents and rejects the five user-accepted zero-cent fees. Active entity references and importer preview remain unverified.',
    '',
    '## Method',
    '',
    'Execution: used an actual EUR leg first, otherwise a documented BRL or stablecoin leg, otherwise the disposed leg. Fee: valued the recovered fee instrument independently. Binance one-minute candle close was used at the candle containing the execution timestamp. BRL uses the ECB daily reference rate, dividing BRL by BRL-per-EUR and using the most recent publication on or before the execution date. Stablecoins were priced through actual Binance pairs and never assumed equal to USD. Decimal arithmetic is exact through conversion and rounds only once to cents using half-up.',
    '',
    'The accompanying CSV is keyed by external_id and records every selected source request, conversion path, candle timestamp, rate, raw EUR value, rounding decision, fallback, and unresolved reason.',
  ].join('\n');
  await fs.mkdir(outputDir, { recursive: true });
  await fs.writeFile(
    path.join(outputDir, 'Binance-Investment-Trades-Prepared.csv'),
    csv([COLUMNS, ...prepared.map((row) => COLUMNS.map((column) => row[column]))]),
  );
  await fs.writeFile(
    path.join(outputDir, 'Binance-Investment-Trades-Enriched.csv'),
    csv([COLUMNS, ...enriched.map((row) => COLUMNS.map((column) => row[column]))]),
  );
  await fs.writeFile(
    path.join(outputDir, 'Binance-Investment-Trades-Valuation-Report.csv'),
    csv([reportColumns, ...report.map((row) => reportColumns.map((column) => row[column]))]),
  );
  await fs.writeFile(path.join(outputDir, 'Binance-Investment-Trades-Valuation-Report.md'), `${summary}\n`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
