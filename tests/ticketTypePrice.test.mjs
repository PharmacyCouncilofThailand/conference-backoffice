import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';
import * as XLSX from 'xlsx';
const source = fs.readFileSync(
  new URL('../src/app/registrations/page.tsx', import.meta.url),
  'utf8',
);
const ast = ts.createSourceFile(
  'page.tsx',
  source,
  ts.ScriptTarget.Latest,
  true,
  ts.ScriptKind.TSX,
);
const declarations = {};
let priceEffect;
function walk(n) {
  if (
    ts.isVariableDeclaration(n) &&
    ts.isIdentifier(n.name) &&
    [
      'buildTicketPrices',
      'formatTicketType',
      'getTicketPriceTier',
      'handleExport',
    ].includes(n.name.text)
  )
    declarations[n.name.text] = 'const ' + n.getText(ast) + ';';
  if (
    ts.isCallExpression(n) &&
    n.expression.getText(ast) === 'useEffect' &&
    n.arguments[0]?.getText(ast).includes('setTicketPrices(null)')
  )
    priceEffect = n.arguments[0].getText(ast);
  ts.forEachChild(n, walk);
}
walk(ast);
for (const name of [
  'buildTicketPrices',
  'formatTicketType',
  'getTicketPriceTier',
  'handleExport',
])
  assert.ok(declarations[name], name);
assert.ok(priceEffect, 'ticket price loading effect exists');
function transpile(s) {
  return ts.transpileModule(s, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      jsx: ts.JsxEmit.ReactJSX,
    },
  }).outputText;
}
const exportSource = transpile(
  fs.readFileSync(
    new URL('../src/lib/exportExcel.ts', import.meta.url),
    'utf8',
  ),
);
const helpers = Object.entries(declarations)
  .filter(([n]) => n !== 'handleExport')
  .map(([, s]) => s)
  .join('\n');
const names = [
  'Early Bird',
  'Regular',
  'Late / หน้างาน',
  'Undergraduate',
  'Postgraduate',
  'Health Hack',
  'Booth',
];
const amounts = [1250, 2500, 2500, 500, 1250, 500, 500];
const tickets = names.map((name, i) => ({
  id: i + 1,
  name,
  price: String(amounts[i]),
  currency: 'THB',
  isActive: i !== 2,
}));
const rows = names.map((ticketName, i) => ({
  regCode: 'MOCK-' + i,
  firstName: 'Synthetic',
  lastName: String(i),
  email: 'synthetic' + i + '@example.test',
  ticketName,
  eventCode: 'PRIS-2026',
  status: 'confirmed',
  source: 'purchase',
  createdAt: '2026-10-22T00:00:00Z',
}));
async function scenario(options = {}) {
  const writes = [],
    notices = [],
    loading = [],
    calls = [];
  const adapter = {
    ...XLSX,
    writeFile: (wb, name) =>
      writes.push({
        name,
        buffer: XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }),
      }),
  };
  const ex = {
    exports: {},
    require: (name) => {
      assert.equal(name, 'xlsx');
      return adapter;
    },
  };
  vm.runInNewContext(exportSource, ex);
  const c = {
    URLSearchParams,
    showTicketType: options.show ?? true,
    eventFilter: options.eventFilter ?? '2',
    statusFilter: 'confirmed',
    searchTerm: 'Synthetic',
    sourceFilter: 'purchase',
    promoCodeFilter: '9',
    eventOptions: [{ id: 2, name: 'PRIS 2026', code: 'PRIS-2026' }],
    getBackofficeToken: () => 'synthetic-token',
    setIsExporting: (v) => loading.push(v),
    toast: { error: (m) => notices.push(m) },
    console: { error: () => {} },
    exportToExcel: ex.exports.exportToExcel,
    api: {
      registrations: {
        list: async (token, q) => {
          calls.push(['rows', q]);
          if (options.rowsError) throw Error('test');
          return { registrations: options.rows ?? rows };
        },
      },
      backofficeEvents: {
        getTickets: async (token, id) => {
          calls.push(['prices', id]);
          if (options.priceError) throw Error('test');
          return { tickets: options.tickets ?? tickets };
        },
      },
    },
  };
  vm.runInNewContext(
    transpile(
      helpers +
        '\n' +
        declarations.handleExport +
        '\nglobalThis.run=handleExport;',
    ),
    c,
  );
  await c.run();
  const data = writes.map((w) => {
    const wb = XLSX.read(w.buffer);
    return {
      name: w.name,
      rows: XLSX.utils.sheet_to_json(wb.Sheets.Sheet1),
      header: XLSX.utils.sheet_to_json(wb.Sheets.Sheet1, { header: 1 })[0],
    };
  });
  return { data, notices, loading, calls };
}
test('exports all seven ticket prices in a real XLSX with column order and active filters', async () => {
  let r = await scenario();
  assert.equal(r.data[0].name, 'registrations_PRIS_2026.xlsx');
  assert.equal(r.data[0].rows.length, 7);
  assert.equal(
    r.data[0].header[r.data[0].header.indexOf('Ticket') + 1],
    'TICKET TYPE',
  );
  for (let i = 0; i < 7; i++)
    assert.equal(
      r.data[0].rows[i]['TICKET TYPE'],
      names[i] + ' | ' + amounts[i].toLocaleString('th-TH') + ' บาท',
    );
  assert.deepEqual(r.loading, [true, false]);
  const params = new URLSearchParams(r.calls[0][1]);
  for (const [k, v] of Object.entries({
    eventId: '2',
    status: 'confirmed',
    search: 'Synthetic',
    source: 'purchase',
    promoCodeId: '9',
  }))
    assert.equal(params.get(k), v);
});
test('price API failure preserves names and warns while exporting', async () => {
  const r = await scenario({ priceError: true });
  assert.equal(r.data[0].rows[0]['TICKET TYPE'], 'Early Bird');
  assert.equal(r.notices.length, 1);
});
test('other events never receive PRIS prices or request their price column', async () => {
  let r = await scenario({ rows: [{ ...rows[0], eventCode: 'OTHER' }] });
  assert.equal(r.data[0].rows[0]['TICKET TYPE'], 'Early Bird');
  r = await scenario({ show: false, eventFilter: '3' });
  assert.ok(!r.data[0].header.includes('TICKET TYPE'));
  assert.ok(!r.calls.some((c) => c[0] === 'prices'));
});
test('duplicate ticket names omit ambiguous prices', async () => {
  const r = await scenario({
    tickets: [...tickets, { ...tickets[0], id: 99, price: '1' }],
  });
  assert.equal(r.data[0].rows[0]['TICKET TYPE'], 'Early Bird');
});
test('registration failure emits no workbook and clears loading', async () => {
  const r = await scenario({ rowsError: true });
  assert.equal(r.data.length, 0);
  assert.deepEqual(r.loading, [true, false]);
});
test('no selected event makes no request and exports nothing', async () => {
  const r = await scenario({ eventFilter: '' });
  assert.equal(r.calls.length, 0);
  assert.equal(r.data.length, 0);
});
test('price helpers reject missing or invalid prices and preserve zero, fractions, currency and tier boundaries', () => {
  const h = {};
  vm.runInNewContext(
    transpile(
      helpers +
        '\nglobalThis.h={buildTicketPrices,formatTicketType,getTicketPriceTier};',
    ),
    h,
  );
  const {
    buildTicketPrices: b,
    formatTicketType: f,
    getTicketPriceTier: t,
  } = h.h;
  assert.equal(b([{ name: ' ', price: 500, currency: 'THB' }]).size, 0);
  for (const amount of [-1, NaN, Infinity])
    assert.equal(
      b([{ name: 'Invalid', price: amount, currency: 'THB' }]).size,
      0,
    );
  for (const price of [null, undefined, '', true])
    assert.equal(b([{ name: 'Invalid', price, currency: 'THB' }]).size, 0);
  assert.equal(
    f(
      'Free',
      b([{ name: 'Free', price: '0.00', currency: 'THB' }]).get('Free'),
    ),
    'Free | 0 บาท',
  );
  assert.equal(
    f(
      'Fraction',
      b([{ name: 'Fraction', price: '1250.50', currency: 'THB' }]).get(
        'Fraction',
      ),
    ),
    'Fraction | 1,250.50 บาท',
  );
  for (const [amount, tier] of [
    [0, 'neutral'],
    [500, 'red'],
    [1000, 'green'],
    [1250, 'green'],
    [2000, 'gold'],
    [2500, 'gold'],
  ])
    assert.equal(t({ amount, currency: 'THB', label: '' }), tier);
  assert.equal(t({ amount: 2500, currency: 'USD', label: '' }), 'neutral');
});
test('effect cleanup prevents stale ticket responses from updating prices', async () => {
  let resolve;
  const state = [];
  const effectCtx = {
    showTicketType: true,
    eventFilter: '2',
    setTicketPrices: (v) => state.push(v),
    getBackofficeToken: () => '',
    api: {
      backofficeEvents: { getTickets: () => new Promise((r) => (resolve = r)) },
    },
    toast: {
      error: () => {
        throw Error('unexpected toast');
      },
    },
    console,
  };
  vm.runInNewContext(
    transpile(helpers + '\nglobalThis.runEffect=' + priceEffect + ';'),
    effectCtx,
  );
  const cleanup = effectCtx.runEffect();
  cleanup();
  resolve({ tickets });
  await Promise.resolve();
  await Promise.resolve();
  assert.deepEqual(state, [null]);
});
