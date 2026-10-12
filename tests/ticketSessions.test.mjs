import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

const source = readFileSync(
  new URL('../src/app/tickets/page.tsx', import.meta.url),
  'utf8',
);
const main = (id) => ({
  id,
  sessionCode: `MAIN-${id}`,
  sessionName: `Main ${id}`,
  isMainSession: true,
});
const workshop = {
  id: 6,
  sessionCode: 'WORKSHOP-6',
  sessionName: 'Workshop',
  isMainSession: false,
};
const ticket = {
  id: 7,
  eventId: 2,
  eventCode: 'PRIS',
  name: 'Existing',
  category: 'primary',
  price: '100',
  quota: 10,
  sold: 0,
  allowedRoles: 'general',
  sessionIds: [6],
};
const deferred = () => {
  let resolve, reject;
  const promise = new Promise((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
};
function nodes(tree) {
  if (!tree || typeof tree !== 'object') return [];
  return [tree, ...[tree.props?.children].flat().flatMap(nodes)];
}
function textOf(tree) {
  if (Array.isArray(tree)) return tree.map(textOf).join('');
  return typeof tree === 'object' && tree
    ? textOf(tree.props?.children)
    : typeof tree === 'string'
      ? tree
      : '';
}

async function mount(getSessions, tickets = []) {
  const slots = [],
    effects = [],
    pending = [],
    saves = [],
    errors = [];
  let cursor = 0;
  const jsx = (type, props) => ({ type, props });
  const context = {
    exports: {},
    console: { error() {}, log() {} },
    URLSearchParams,
    localStorage: { getItem: () => 'test' },
    sessionStorage: { getItem: () => null },
    require(name) {
      if (name === 'react')
        return {
          useState(initial) {
            const index = cursor++;
            if (!(index in slots)) slots[index] = initial;
            return [
              slots[index],
              (value) => {
                slots[index] =
                  typeof value === 'function' ? value(slots[index]) : value;
              },
            ];
          },
          useEffect(callback, deps) {
            const index = cursor++;
            const old = effects[index];
            if (
              !old ||
              deps.some((value, i) => !Object.is(value, old.deps[i]))
            ) {
              pending.push(() => {
                old?.cleanup?.();
                effects[index] = { deps, cleanup: callback() };
              });
            }
          },
        };
      if (name === 'react/jsx-runtime')
        return { jsx, jsxs: jsx, Fragment: 'fragment' };
      if (name === '@/lib/api')
        return {
          api: {
            backofficeEvents: {
              list: async () => ({
                events: [
                  { id: 1, eventCode: 'Other' },
                  { id: 2, eventCode: 'PRIS' },
                ],
              }),
              getSessions: (_token, eventId) => getSessions(eventId),
              createTicket: async (_token, eventId, payload) => {
                saves.push({ eventId, payload });
              },
              updateTicket: async (_token, eventId, ticketId, payload) => {
                saves.push({ eventId, ticketId, payload });
              },
            },
            tickets: {
              list: async () => ({
                tickets,
                pagination: { total: tickets.length, totalPages: 1 },
              }),
            },
          },
        };
      if (name === 'react-hot-toast')
        return {
          __esModule: true,
          default: {
            success() {},
            error(value) {
              errors.push(value);
            },
          },
        };
      return new Proxy(
        {},
        { get: (_target, key) => (key === '__esModule' ? true : String(key)) },
      );
    },
  };
  runInNewContext(
    ts.transpileModule(source, {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        jsx: ts.JsxEmit.ReactJSX,
        target: ts.ScriptTarget.ES2021,
        esModuleInterop: true,
      },
    }).outputText,
    context,
  );
  let tree;
  const render = () => {
    cursor = 0;
    tree = context.exports.default();
    pending.splice(0).forEach((run) => run());
    return tree;
  };
  const settle = async () => {
    await new Promise((resolve) => setImmediate(resolve));
    render();
  };
  const button = (label) =>
    nodes(tree).find(
      (node) => node.type === 'button' && textOf(node) === label,
    );
  const eventSelect = () =>
    nodes(tree).find(
      (node) => node.type === 'select' && typeof node.props.value === 'number',
    );
  const categorySelect = () =>
    nodes(tree).find(
      (node) => node.type === 'select' && node.props.value === 'primary',
    );
  const checkbox = (id) =>
    nodes(tree).find(
      (node) => node.type === 'label' && textOf(node).includes(`MAIN-${id}`),
    )?.props.children[0];
  render();
  await settle();
  await settle();
  return {
    render,
    settle,
    saves,
    errors,
    button,
    checkbox,
    categorySelect,
    add() {
      button('Add Ticket').props.onClick();
      render();
    },
    changeEvent(id) {
      eventSelect().props.onChange({ target: { value: String(id) } });
      render();
    },
    action(title) {
      nodes(tree)
        .find((node) => node.props?.title === title)
        .props.onClick();
      render();
    },
    close() {
      button('Cancel').props.onClick();
      render();
    },
    get tree() {
      return tree;
    },
  };
}

test('changing event clears hidden IDs and saves only current-event sessions', async () => {
  const f = await mount(async (id) => ({
    sessions: id === 1 ? [main(8)] : [main(2), workshop],
  }));
  f.add();
  await f.settle();
  assert.equal(f.checkbox(8).props.checked, true);
  f.changeEvent(2);
  await f.settle();
  assert.equal(f.checkbox(8), undefined);
  const box = nodes(f.tree).find(
    (node) => node.type === 'label' && textOf(node).includes('WORKSHOP-6'),
  ).props.children[0];
  box.props.onChange({ target: { checked: true } });
  f.render();
  await f.button('Create Ticket').props.onClick();
  assert.deepEqual(JSON.parse(JSON.stringify(f.saves[0])), {
    eventId: 2,
    payload: {
      name: '',
      category: 'primary',
      price: '0',
      currency: 'THB',
      features: [],
      quota: 100,
      allowedRoles: '["general"]',
      priority: 'regular',
      isActive: true,
      sessionIds: [2, 6],
    },
  });
});

for (const lateFailure of [false, true]) {
  test(`late ${lateFailure ? 'failure' : 'response'} from a previous event cannot change current sessions`, async () => {
    const old = deferred(),
      current = deferred();
    const f = await mount((id) => (id === 1 ? old.promise : current.promise));
    f.add();
    f.changeEvent(2);
    assert.equal(f.button('Create Ticket').props.disabled, true);
    assert.equal(f.categorySelect().props.disabled, true);
    await f.button('Create Ticket').props.onClick();
    assert.equal(f.saves.length, 0);
    current.resolve({ sessions: [main(2)] });
    await f.settle();
    if (lateFailure) old.reject(new Error('Old event failed'));
    else old.resolve({ sessions: [main(8)] });
    await f.settle();
    assert.equal(f.checkbox(8), undefined);
    assert.equal(f.checkbox(2).props.checked, true);
    await f.button('Create Ticket').props.onClick();
    assert.deepEqual(Array.from(f.saves[0].payload.sessionIds), [2]);
  });
}

test('closing and reopening ignores the old load, and main-session deselection stays deselected', async () => {
  const old = deferred();
  let calls = 0;
  const f = await mount(() =>
    ++calls === 1 ? old.promise : Promise.resolve({ sessions: [main(8)] }),
  );
  f.add();
  f.close();
  f.add();
  await f.settle();
  f.checkbox(8).props.onChange({ target: { checked: false } });
  f.render();
  old.resolve({ sessions: [main(8)] });
  await f.settle();
  assert.equal(f.checkbox(8).props.checked, false);
  await f.button('Create Ticket').props.onClick();
  assert.deepEqual(Array.from(f.saves[0].payload.sessionIds), []);
});

test('editing retains explicit selection; duplicate adds only current-event main sessions', async () => {
  const f = await mount(
    async () => ({ sessions: [main(2), workshop] }),
    [{ ...ticket, sessionIds: [8, 6] }],
  );
  f.action('Edit');
  await f.settle();
  assert.equal(f.checkbox(2).props.checked, false);
  await f.button('Save Changes').props.onClick();
  await f.settle();
  assert.deepEqual(Array.from(f.saves[0].payload.sessionIds), [6]);
  f.action('Duplicate');
  await f.settle();
  await f.button('Create Ticket').props.onClick();
  assert.deepEqual(Array.from(f.saves[1].payload.sessionIds), [6, 2]);
});

test('a current-event load failure blocks saving and explains how to retry', async () => {
  const f = await mount(async () => {
    throw new Error('Unavailable');
  });
  f.add();
  await f.settle();
  assert.equal(f.button('Create Ticket').props.disabled, true);
  await f.button('Create Ticket').props.onClick();
  assert.equal(f.saves.length, 0);
  assert.match(f.errors[0], /reopen the ticket form/);
});

test('switching to add-on removes automatic selection after an event change', async () => {
  const f = await mount(async (id) => ({
    sessions: id === 1 ? [main(8)] : [main(2)],
  }));
  f.add();
  await f.settle();
  f.categorySelect().props.onChange({ target: { value: 'addon' } });
  f.render();
  f.changeEvent(2);
  await f.settle();
  assert.equal(f.checkbox(2).props.checked, false);
  await f.button('Create Ticket').props.onClick();
  assert.deepEqual(Array.from(f.saves[0].payload.sessionIds), []);
});
