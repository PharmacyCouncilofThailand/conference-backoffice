import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';
import * as XLSX from 'xlsx';
import * as jsxRuntime from 'react/jsx-runtime';
import { IconSparkles } from '@tabler/icons-react';
import { renderToStaticMarkup } from 'react-dom/server';
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
function walk(node) {
  if (
    ts.isVariableDeclaration(node) &&
    ts.isIdentifier(node.name) &&
    [
      'getHolderDisplay',
      'getHolderBadgeTone',
      'holderBadgeClasses',
      'handleExport',
    ].includes(node.name.text)
  )
    declarations[node.name.text] = 'const ' + node.getText(ast) + ';';
  if (ts.isFunctionDeclaration(node) && node.name?.text === 'HolderTypeBadge')
    declarations.HolderTypeBadge = node.getText(ast);
  ts.forEachChild(node, walk);
}
walk(ast);
for (const name of ['getHolderDisplay', 'handleExport', 'HolderTypeBadge'])
  assert.ok(declarations[name], name);
function transpile(value) {
  return ts.transpileModule(value, {
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
const helpers = declarations.getHolderDisplay;
const expected = [
  ['กรรมการสภาเภสัชกรรม', 'แก้ว Mug set1'],
  ['กรรมการราชวิทยาลัยเภสัชกรรมแห่งประเทศไทย', 'แก้ว Mug set1'],
  ['VIP', 'แก้ว Mug set1'],
  ['วิทยากร', 'ชุดใหญ่ไฟกระพริบ set3'],
  ['ผู้นำเสนอผลงาน', 'กิจกรรม set2'],
  ['ผู้เข้าร่วมงาน', 'กิจกรรม set2'],
  ['เจ้าหน้าที่บูธ (Exhibitor)', 'กิจกรรม set2'],
  ['Health Hack', '—'],
  ['สื่อมวลชน', 'ชุดใหญ่ไฟกระพริบ set3'],
  ['เจ้าหน้าที่/MC', 'กิจกรรม set2'],
  ['กรรมการประเมินผลงาน', 'แก้ว Mug set1'],
];
const keys = [
  'council_committee',
  'college_committee',
  'vip',
  'speaker',
  'presenter',
  'participant',
  'exhibitor',
  'health_hack',
  'media',
  'staff_mc',
  'reviewer',
];
const giftCodes = [
  'mug_set1',
  'mug_set1',
  'mug_set1',
  'large_set3',
  'activity_set2',
  'activity_set2',
  'activity_set2',
  'none',
  'large_set3',
  'activity_set2',
  'mug_set1',
];
const rows = expected.map(([holderTypeLabel, holderGift], i) => ({
  regCode: 'MOCK-' + i,
  firstName: 'Synthetic',
  lastName: String(i),
  email: 'synthetic' + i + '@example.test',
  ticketName: 'Regular',
  price: '2500',
  holderTypeLabel,
  holderGift,
  holderType: keys[i],
  holderGiftCode: giftCodes[i],
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
        getTickets: async () => {
          calls.push(['prices']);
          throw new Error('Price lookup is forbidden');
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

test('exports all eleven holder labels and gifts with correct XLSX column order and filters', async () => {
  const r = await scenario();
  assert.equal(r.data.length, 1);
  assert.equal(r.data[0].name, 'registrations_PRIS_2026.xlsx');
  assert.equal(r.data[0].rows.length, 11);
  const index = r.data[0].header.indexOf('Ticket');
  assert.deepEqual(r.data[0].header.slice(index, index + 4), [
    'Ticket',
    'TICKET TYPE',
    'GIFT',
    'Promo Code',
  ]);
  expected.forEach(([label, gift], i) => {
    assert.equal(r.data[0].rows[i]['TICKET TYPE'], label);
    assert.equal(r.data[0].rows[i].GIFT, gift);
    assert.equal(r.data[0].rows[i].Ticket, 'Regular');
    assert.ok(!r.data[0].rows[i]['TICKET TYPE'].includes('2500'));
  });
  assert.deepEqual(r.loading, [true, false]);
  assert.equal(r.calls.length, 1);
  const params = new URLSearchParams(r.calls[0][1]);
  for (const [key, value] of Object.entries({
    page: '1',
    limit: '1000',
    eventId: '2',
    status: 'confirmed',
    search: 'Synthetic',
    source: 'purchase',
    promoCodeId: '9',
  }))
    assert.equal(params.get(key), value);
});

test('missing and blank assignments remain unassigned without price or promo inference', async () => {
  const input = [null, undefined, '', '   '].map((value) => ({
    ...rows[0],
    holderTypeLabel: value,
    holderGift: value,
    promoCode: 'PRISVIP2026',
  }));
  input.push({ ...rows[0], eventCode: 'OTHER' });
  const r = await scenario({ rows: input });
  for (const row of r.data[0].rows) {
    assert.equal(row['TICKET TYPE'], 'ยังไม่ระบุ');
    assert.equal(row.GIFT, 'ยังไม่ระบุ');
  }
});

test('Health Hack no-gift marker stays distinct from an unknown gift', async () => {
  const r = await scenario({
    rows: [rows[7], { ...rows[7], holderGift: null }],
  });
  assert.equal(r.data[0].rows[0].GIFT, '—');
  assert.equal(r.data[0].rows[1].GIFT, 'ยังไม่ระบุ');
});

test('other event exports neither holder column and makes no additional API request', async () => {
  const r = await scenario({
    show: false,
    eventFilter: '3',
    rows: [{ ...rows[0], eventCode: 'OTHER' }],
  });
  assert.ok(!r.data[0].header.includes('TICKET TYPE'));
  assert.ok(!r.data[0].header.includes('GIFT'));
  assert.equal(r.calls.length, 1);
  assert.equal(r.calls[0][0], 'rows');
});

test('registration API failure exports nothing and clears loading', async () => {
  const r = await scenario({ rowsError: true });
  assert.equal(r.data.length, 0);
  assert.deepEqual(r.loading, [true, false]);
  assert.equal(r.notices.length, 1);
});

test('no selected event makes no request or workbook', async () => {
  const r = await scenario({ eventFilter: '' });
  assert.equal(r.data.length, 0);
  assert.equal(r.calls.length, 0);
  assert.deepEqual(r.loading, []);
});

test('real HolderTypeBadge renders all full labels without price or truncation styling', () => {
  const context = {
    IconSparkles,
    exports: {},
    require: (name) => {
      assert.equal(name, 'react/jsx-runtime');
      return jsxRuntime;
    },
  };
  vm.runInNewContext(
    transpile(
      helpers +
        '\n' +
        declarations.getHolderBadgeTone +
        '\n' +
        declarations.holderBadgeClasses +
        '\n' +
        declarations.HolderTypeBadge +
        '\nglobalThis.Badge=HolderTypeBadge;',
    ),
    context,
  );
  for (const row of rows) {
    const html = renderToStaticMarkup(context.Badge({ registration: row }));
    assert.ok(html.includes(row.holderTypeLabel), row.holderTypeLabel);
    assert.ok(!html.includes('2500'));
    assert.ok(!/truncate|text-ellipsis|overflow-hidden|line-clamp/.test(html));
  }
  const html = renderToStaticMarkup(
    context.Badge({ registration: { ...rows[0], holderTypeLabel: null } }),
  );
  assert.ok(html.includes('ยังไม่ระบุ'));
});

test('holder keys keep distinct stable type colors and preserve gift colors and gold precedence', () => {
  const context = { IconSparkles, exports: {}, require: () => jsxRuntime };
  vm.runInNewContext(
    transpile(
      helpers +
        '\n' +
        declarations.getHolderBadgeTone +
        '\n' +
        declarations.holderBadgeClasses +
        '\n' +
        declarations.HolderTypeBadge +
        '\nglobalThis.Badge=HolderTypeBadge;globalThis.tone=getHolderBadgeTone;',
    ),
    context,
  );
  const expectedTypeTones = [
    'indigo',
    'fuchsia',
    'gold',
    'gold',
    'blue',
    'emerald',
    'teal',
    'rose',
    'gold',
    'orange',
    'violet',
  ];
  const expectedGiftTones = [
    'green',
    'green',
    'green',
    'gold',
    'orange',
    'orange',
    'orange',
    'neutral',
    'gold',
    'orange',
    'green',
  ];
  const colorClasses = {
    indigo: 'text-indigo-800',
    fuchsia: 'text-fuchsia-800',
    blue: 'text-blue-800',
    emerald: 'text-emerald-800',
    teal: 'text-teal-800',
    rose: 'text-rose-800',
    violet: 'text-violet-800',
    gold: 'text-amber-950',
    green: 'text-emerald-800',
    orange: 'text-orange-800',
    neutral: 'text-zinc-500',
  };
  rows.forEach((registration, index) => {
    for (const [kind, tone] of [
      ['type', expectedTypeTones[index]],
      ['gift', expectedGiftTones[index]],
    ]) {
      assert.equal(context.tone(registration, kind), tone);
      const html = renderToStaticMarkup(context.Badge({ registration, kind }));
      assert.ok(html.includes(colorClasses[tone]));
      assert.equal(html.includes('<svg'), tone === 'gold');
      assert.ok(
        html.includes(
          kind === 'type'
            ? registration.holderTypeLabel
            : registration.holderGift,
        ),
      );
      assert.ok(
        !/animate-|truncate|text-ellipsis|overflow-hidden|line-clamp/.test(
          html,
        ),
      );
    }
  });
  for (const kind of ['type', 'gift']) {
    assert.equal(
      context.tone({ ...rows[2], eventCode: 'OTHER' }, kind),
      'neutral',
    );
    assert.equal(
      context.tone(
        { ...rows[2], holderType: null, holderGiftCode: null },
        kind,
      ),
      'neutral',
    );
    assert.equal(
      context.tone(
        { ...rows[2], holderTypeLabel: null, holderGift: null },
        kind,
      ),
      'neutral',
    );
    assert.equal(
      context.tone(
        {
          ...rows[0],
          holderTypeLabel: 'VIP',
          holderGift: 'ชุดใหญ่ไฟกระพริบ set3',
          price: 9999,
        },
        kind,
      ),
      kind === 'type' ? 'indigo' : 'green',
    );
  }
  const borderTokens = new Set();
  rows.forEach((registration, index) => {
    const first = renderToStaticMarkup(context.Badge({ registration }));
    assert.equal(renderToStaticMarkup(context.Badge({ registration })), first);
    if (expectedTypeTones[index] !== 'gold') {
      const expectedBorder = `border-${expectedTypeTones[index]}-${expectedTypeTones[index] === 'orange' ? '200' : '400'}`;
      assert.ok(first.includes(expectedBorder), expectedBorder);
      borderTokens.add(expectedBorder);
    }
  });
  assert.equal(borderTokens.size, 8);
  for (const index of [2, 3, 8]) {
    assert.equal(
      context.tone({ ...rows[index], holderGiftCode: null }, 'type'),
      'gold',
    );
  }
  for (const registration of rows) {
    assert.equal(
      context.tone({ ...registration, holderGiftCode: 'large_set3' }, 'type'),
      'gold',
    );
    assert.equal(
      context.tone({ ...registration, holderGiftCode: 'large_set3' }, 'gift'),
      'gold',
    );
  }
  assert.equal(
    context.tone(
      { ...rows[0], holderType: 'unknown', holderGiftCode: null },
      'type',
    ),
    'neutral',
  );
  assert.ok(!declarations.getHolderBadgeTone.includes('Math.random'));
});
