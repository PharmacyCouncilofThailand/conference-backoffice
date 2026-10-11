import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

const source = readFileSync(
  new URL(
    '../src/components/registrations/SessionEmailPreviewDialog.tsx',
    import.meta.url,
  ),
  'utf8',
);

async function mountPreview(apiPreview) {
  const states = [];
  let cursor = 0;
  const effects = [];
  const confirmations = [];
  let closed = 0;
  const jsx = (type, props) => ({ type, props });
  const context = {
    exports: {},
    localStorage: { getItem: () => 'token' },
    sessionStorage: { getItem: () => null },
    document: { activeElement: { focus() {} } },
    require: (name) =>
      name === 'react'
        ? {
            useState: (initial) => {
              const slot = cursor++;
              if (!(slot in states)) states[slot] = initial;
              return [
                states[slot],
                (value) => {
                  states[slot] =
                    typeof value === 'function' ? value(states[slot]) : value;
                },
              ];
            },
            useRef: () => ({ current: { showModal() {}, close() {} } }),
            useEffect: (callback) => {
              effects.push(callback);
            },
          }
        : name === '@/lib/api'
          ? { api: { sessionGrants: { preview: apiPreview } } }
          : name === 'react/jsx-runtime'
            ? { jsx, jsxs: jsx, Fragment: 'fragment' }
            : { IconX: 'icon', IconLoader2: 'icon' },
  };
  runInNewContext(
    ts.transpileModule(source, {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        jsx: ts.JsxEmit.ReactJSX,
        target: ts.ScriptTarget.ES2021,
      },
    }).outputText,
    context,
  );
  const request = { key: 'frozen-key', sessionId: 12, registrationIds: [1, 2] };
  const render = (submitting = false) => {
    cursor = 0;
    return context.exports.SessionEmailPreviewDialog({
      request,
      submitting,
      onClose: () => {
        closed++;
      },
      onConfirm: async (value) => {
        confirmations.push(value);
      },
    });
  };
  const initial = render();
  effects.splice(0).forEach((callback) => callback());
  await new Promise((resolve) => setImmediate(resolve));
  return {
    initial,
    render,
    confirmations,
    request,
    get closed() {
      return closed;
    },
  };
}

function nodes(tree) {
  if (!tree || typeof tree !== 'object') return [];
  const children = tree.props?.children;
  return [
    tree,
    ...(Array.isArray(children) ? children : [children]).flatMap(nodes),
  ];
}
const button = (tree, label) =>
  nodes(tree).find(
    (node) => node.type === 'button' && node.props.children === label,
  );
const send = (tree) =>
  nodes(tree)
    .filter((node) => node.type === 'button')
    .at(-1);

test('preview loads without sending, pages through emails, and confirms the frozen request', async () => {
  let reads = 0;
  const view = await mountPreview(async () => {
    reads++;
    return {
      emails: [1, 2].map((id) => ({
        registrationId: id,
        name: `Person ${id}`,
        recipient: `${id}@example.invalid`,
        subject: `Subject ${id}`,
        html: '<html><body><a href="https://preview.invalid">Respond</a></body></html>',
      })),
      skipped: [],
    };
  });
  assert.equal(reads, 1);
  assert.equal(view.confirmations.length, 0);
  assert.equal(send(view.initial).props.disabled, true);
  let tree = view.render();
  assert.equal(button(tree, 'ก่อนหน้า').props.disabled, true);
  const frame = nodes(tree).find((node) => node.type === 'iframe');
  assert.equal(frame.props.sandbox, '');
  assert.match(frame.props.srcDoc, /inert tabindex="-1"/);
  button(tree, 'ถัดไป').props.onClick();
  tree = view.render();
  assert.equal(button(tree, 'ถัดไป').props.disabled, true);
  assert.equal(
    nodes(tree).find((node) => node.type === 'iframe').props.title,
    'เนื้อหาอีเมลสำหรับ Person 2',
  );
  button(tree, 'ก่อนหน้า').props.onClick();
  assert.equal(
    nodes(view.render()).find((node) => node.type === 'iframe').props.title,
    'เนื้อหาอีเมลสำหรับ Person 1',
  );
  assert.equal(send(view.render(true)).props.disabled, true);
  send(tree).props.onClick();
  assert.equal(view.confirmations[0].key, view.request.key);
  assert.equal(view.confirmations[0].sessionId, view.request.sessionId);
  assert.deepEqual(Array.from(view.confirmations[0].registrationIds), [1, 2]);
  button(tree, 'ย้อนกลับ').props.onClick();
  assert.equal(view.closed, 1);
});

test('empty and failed previews cannot send', async () => {
  for (const load of [
    async () => ({ emails: [], skipped: [] }),
    async () => {
      throw new Error('Unavailable');
    },
  ]) {
    const view = await mountPreview(load);
    assert.equal(send(view.render()).props.disabled, true);
    assert.equal(view.confirmations.length, 0);
  }
});

test('final confirmation sends only recipients included in the reviewed preview', async () => {
  const view = await mountPreview(async () => ({
    emails: [
      {
        registrationId: 1,
        name: 'Person 1',
        recipient: '1@example.invalid',
        subject: 'Subject',
        html: '<body>Notice</body>',
      },
    ],
    skipped: [{ registrationId: 2, reasonCode: 'ALREADY_INVITED' }],
  }));
  send(view.render()).props.onClick();
  assert.deepEqual(Array.from(view.confirmations[0].registrationIds), [1]);
});

test('bulk and individual selection open previews without creating grants', () => {
  const cases = [
    {
      file: '../src/app/registrations/page.tsx',
      start: 'const openGrantPreview =',
      end: 'const submitGrant =',
      functionName: 'openGrantPreview',
      context: {
        grantSession: { id: 12 },
        selectedCount: 2,
        isGrantSubmitting: false,
        SESSION_GRANT_SELECTION_LIMIT: 500,
        selectedRegistrations: new Map([
          [2, {}],
          [1, {}],
        ]),
        pendingGrantOperation: null,
      },
      args: [],
    },
    {
      file: '../src/app/registrations/[id]/page.tsx',
      start: 'const grantSelectedSession =',
      end: 'const submitGrant =',
      functionName: 'grantSelectedSession',
      context: {
        registration: { id: 1 },
        grantSubmitting: false,
        pendingGrant: null,
      },
      args: [{ id: 12 }],
    },
  ];
  for (const entry of cases) {
    let request;
    const context = {
      ...entry.context,
      crypto: { randomUUID: () => 'key' },
      setPreviewRequest: (value) => {
        request = value;
      },
      submitGrant: () => assert.fail('selection must not send'),
      toast: { error: () => assert.fail('unexpected error') },
    };
    const page = readFileSync(new URL(entry.file, import.meta.url), 'utf8');
    const fn = runInNewContext(
      ts.transpile(
        page.slice(page.indexOf(entry.start), page.indexOf(entry.end)) +
          `\n${entry.functionName};`,
        { target: ts.ScriptTarget.ES2021 },
      ),
      context,
    );
    fn(...entry.args);
    assert.equal(request.sessionId, 12);
    assert.deepEqual(
      Array.from(request.registrationIds),
      entry.functionName === 'openGrantPreview' ? [1, 2] : [1],
    );
    const pending = request;
    let retried;
    context[
      entry.functionName === 'openGrantPreview'
        ? 'pendingGrantOperation'
        : 'pendingGrant'
    ] = pending;
    context.submitGrant = (value) => {
      retried = value;
    };
    context.setPreviewRequest = () =>
      assert.fail('retry must preserve the already submitted operation');
    fn(...entry.args);
    assert.equal(retried, pending);
  }
});
