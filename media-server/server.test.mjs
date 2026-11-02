import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createHash, randomBytes } from 'node:crypto';
import { Readable } from 'node:stream';
import { fileURLToPath } from 'node:url';
import { createServer, filePathFor, createSupabaseTokenChecker } from './server.mjs';

const LIMIT = 64 * 1024;
const KIB = 1024;
const SECRET = 'TOP-SECRET-SENTINEL';
const SERVER_JS = fileURLToPath(new URL('./server.mjs', import.meta.url));

// What Supabase would say for each token. Only `who` is looked at by the server.
const WHO = {
  tokenA: { id: 'user-a', email: 'a@example.com', confirmed: true },
  tokenB: { id: 'user-b', email: 'b@example.com', confirmed: true },
  alice: { id: 'user-alice', email: 'Alice@Example.COM', confirmed: true },
  carol: { id: 'user-carol', email: '  carol@example.com  ', confirmed: true },
  unconfirmed: { id: 'user-unc', email: 'alice@example.com', confirmed: false },
  mallory: { id: 'user-mal', email: 'mallory@example.com', confirmed: true },
  quotaA: { id: 'user-qa', email: 'qa@example.com', confirmed: true },
  quotaB: { id: 'user-qb', email: 'qb@example.com', confirmed: true },
};

const fakeCheck = async (token) => {
  if (token === 'down') throw new Error('supabase unreachable');
  return Object.hasOwn(WHO, token) ? WHO[token] : null;
};

const sha = (s) => createHash('sha256').update(String(s)).digest('hex');

let base;
let dataDir;
let secretPath;
let server;
let port;
let gated;
let quota;
const extra = [];

// A second server on a random port, for the access and quota tests.
async function start(opts) {
  const s = createServer({ checkToken: fakeCheck, log: () => {}, ...opts });
  await new Promise((resolve) => s.listen(0, '127.0.0.1', resolve));
  extra.push(s);
  return { server: s, port: s.address().port, dataDir: opts.dataDir };
}

before(async () => {
  base = await fsp.mkdtemp(path.join(os.tmpdir(), 'pixelmorph-media-'));
  dataDir = path.join(base, 'data');
  await fsp.mkdir(dataDir);
  secretPath = path.join(base, 'secret.txt');
  await fsp.writeFile(secretPath, SECRET);
  server = createServer({
    dataDir,
    maxUploadBytes: LIMIT,
    allowedEmails: null,
    checkToken: fakeCheck,
    log: () => {},
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  port = server.address().port;
  gated = await start({
    dataDir: path.join(base, 'more', 'gated'),
    maxUploadBytes: LIMIT,
    allowedEmails: new Set(['alice@example.com', ' Carol@Example.com ']),
  });
  quota = await start({
    dataDir: path.join(base, 'more', 'quota'),
    maxUploadBytes: LIMIT,
    maxUserBytes: 100 * KIB,
    allowedEmails: null,
  });
});

after(async () => {
  server.close();
  for (const s of extra) s.close();
  await fsp.rm(base, { recursive: true, force: true });
});

// Raw client: `path` goes on the wire exactly as given, so `..` is never normalised away.
// `at` picks another server's port; the default is the shared one.
function request({ method = 'GET', path: p, token, headers = {}, body, at = port } = {}) {
  return new Promise((resolve, reject) => {
    const h = { ...headers };
    if (token) h.Authorization = `Bearer ${token}`;
    const req = http.request(
      { host: '127.0.0.1', port: at, method, path: p, headers: h },
      (res) => {
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () =>
          resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks) })
        );
        res.on('error', reject);
      }
    );
    req.on('error', reject);
    if (body === undefined) req.end();
    else if (typeof body === 'string' || Buffer.isBuffer(body)) req.end(body);
    else body.pipe(req);
  });
}

const json = (r) => JSON.parse(r.body.toString('utf8'));
const file = (proj, id) => `/files/${encodeURIComponent(proj)}/${encodeURIComponent(id)}`;
const delay = (ms) => new Promise((r) => setTimeout(r, ms));

async function waitFor(check, ms = 2000) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    if (await check()) return true;
    await delay(25);
  }
  return false;
}

async function listAll(dir) {
  const out = [];
  for (const e of await fsp.readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...(await listAll(full)));
    else out.push(full);
  }
  return out;
}

const hex = (n) => randomBytes(n);

test('upload then download returns the same bytes, with safe headers', async () => {
  const data = hex(1000);
  const up = await request({
    method: 'PUT',
    path: file('proj1', 'file1'),
    token: 'tokenA',
    body: data,
  });
  assert.equal(up.status, 201);
  assert.deepEqual(json(up), { size: 1000 });

  const down = await request({ path: file('proj1', 'file1'), token: 'tokenA' });
  assert.equal(down.status, 200);
  assert.deepEqual(down.body, data);
  assert.equal(down.headers['content-type'], 'application/octet-stream');
  assert.equal(down.headers['x-content-type-options'], 'nosniff');
  assert.equal(down.headers['cache-control'], 'private, no-store');
  assert.equal(down.headers['content-length'], '1000');
  assert.equal(down.headers['access-control-allow-origin'], undefined);
});

test('DELETE then GET gives 404', async () => {
  await request({ method: 'PUT', path: file('proj2', 'gone'), token: 'tokenA', body: 'x' });
  const del = await request({ method: 'DELETE', path: file('proj2', 'gone'), token: 'tokenA' });
  assert.equal(del.status, 204);
  const get = await request({ path: file('proj2', 'gone'), token: 'tokenA' });
  assert.equal(get.status, 404);
  assert.equal(json(get).error, 'not_found');
});

test('missing, invalid, or unreachable auth gives 401, 401 and 503', async () => {
  assert.equal((await request({ path: file('p', 'f') })).status, 401);
  assert.equal((await request({ path: file('p', 'f'), token: 'nope' })).status, 401);
  assert.equal(
    (await request({ path: file('p', 'f'), headers: { Authorization: 'Basic abc' } })).status,
    401
  );
  assert.equal((await request({ path: file('p', 'f'), token: 'down' })).status, 503);
  assert.equal(
    (await request({ method: 'PUT', path: file('p', 'f'), token: 'down', body: 'x' })).status,
    503
  );
});

test('user B cannot read, delete or overwrite user A same ids', async () => {
  const a = Buffer.from('content of user A');
  await request({ method: 'PUT', path: file('shared', 'same'), token: 'tokenA', body: a });

  assert.equal((await request({ path: file('shared', 'same'), token: 'tokenB' })).status, 404);
  assert.equal(
    (await request({ method: 'DELETE', path: file('shared', 'same'), token: 'tokenB' })).status,
    404
  );

  const bUp = await request({
    method: 'PUT',
    path: file('shared', 'same'),
    token: 'tokenB',
    body: 'B wrote this',
  });
  assert.equal(bUp.status, 201);

  const aGet = await request({ path: file('shared', 'same'), token: 'tokenA' });
  assert.deepEqual(aGet.body, a);
  const bGet = await request({ path: file('shared', 'same'), token: 'tokenB' });
  assert.equal(bGet.body.toString(), 'B wrote this');
});

test('traversal attempts never reach or change the sentinel file', async () => {
  const bad = [
    '/files/../secret.txt',
    '/files/..%2f..%2fsecret.txt/x',
    '/files/%2e%2e/%2e%2e',
    '/files/a/..%5c..%5csecret.txt',
    '/files/a/b/c',
    '/files/a%00/b',
    '//files/a/b',
    '/files/../../../../etc/passwd',
  ];
  for (const p of bad) {
    for (const method of ['GET', 'PUT', 'DELETE']) {
      const r = await request({
        method,
        path: p,
        token: 'tokenA',
        body: method === 'PUT' ? 'pwned' : undefined,
      });
      assert.ok([400, 404].includes(r.status), `${method} ${p} gave ${r.status}`);
      assert.ok(!r.body.toString().includes(SECRET), `${method} ${p} leaked sentinel`);
    }
  }
  assert.equal(await fsp.readFile(secretPath, 'utf8'), SECRET);
});

test('an encoded id of ../../x is rejected, and an odd harmless name works', async () => {
  const evil = await request({
    method: 'PUT',
    path: `/files/proj/${encodeURIComponent('../../x')}`,
    token: 'tokenA',
    body: 'x',
  });
  assert.equal(evil.status, 400);

  const odd = Buffer.from('odd name content');
  const name = 'foto final (1).jpg';
  const up = await request({ method: 'PUT', path: file('proj', name), token: 'tokenA', body: odd });
  assert.equal(up.status, 201);
  const landed = filePathFor(dataDir, 'user-a', 'proj', name);
  assert.ok(fs.existsSync(landed));
  assert.ok(landed.startsWith(dataDir + path.sep));
  assert.deepEqual((await request({ path: file('proj', name), token: 'tokenA' })).body, odd);
});

test('over-limit upload with Content-Length gives 413, keeps the old version, leaves no tmp', async () => {
  await request({ method: 'PUT', path: file('lim', 'v'), token: 'tokenA', body: 'version one' });
  const big = hex(LIMIT + 4096);
  const r = await request({
    method: 'PUT',
    path: file('lim', 'v'),
    token: 'tokenA',
    headers: { 'Content-Length': String(big.length) },
    body: big,
  });
  assert.equal(r.status, 413);
  assert.equal(
    (await request({ path: file('lim', 'v'), token: 'tokenA' })).body.toString(),
    'version one'
  );
  assert.deepEqual(
    (await listAll(dataDir)).filter((f) => f.endsWith('.tmp')),
    []
  );
});

test('over-limit chunked upload gives 413, keeps the old version, leaves no tmp', async () => {
  await request({ method: 'PUT', path: file('lim', 'c'), token: 'tokenA', body: 'chunk version' });
  const chunks = Array.from({ length: 40 }, () => hex(4096));
  const r = await request({
    method: 'PUT',
    path: file('lim', 'c'),
    token: 'tokenA',
    body: Readable.from(chunks),
  });
  assert.equal(r.status, 413);
  assert.equal(
    (await request({ path: file('lim', 'c'), token: 'tokenA' })).body.toString(),
    'chunk version'
  );
  assert.ok(await waitFor(async () => (await listAll(dataDir)).every((f) => !f.endsWith('.tmp'))));
});

test('aborted upload keeps the old version and leaves no tmp shortly after', async () => {
  await request({ method: 'PUT', path: file('abort', 'f'), token: 'tokenA', body: 'before abort' });
  await new Promise((resolve) => {
    const req = http.request({
      host: '127.0.0.1',
      port,
      method: 'PUT',
      path: file('abort', 'f'),
      headers: { Authorization: 'Bearer tokenA' },
    });
    req.on('error', () => {});
    req.write(hex(8192));
    setTimeout(() => {
      req.destroy();
      resolve();
    }, 100);
  });
  assert.ok(await waitFor(async () => (await listAll(dataDir)).every((f) => !f.endsWith('.tmp'))));
  assert.equal(
    (await request({ path: file('abort', 'f'), token: 'tokenA' })).body.toString(),
    'before abort'
  );
});

test('a symlink at the final path gives 404', async (t) => {
  const link = filePathFor(dataDir, 'user-a', 'links', 'trap');
  await fsp.mkdir(path.dirname(link), { recursive: true });
  try {
    await fsp.symlink(secretPath, link);
  } catch {
    t.skip('symlinks not available here');
    return;
  }
  try {
    const r = await request({ path: file('links', 'trap'), token: 'tokenA' });
    assert.equal(r.status, 404);
    assert.ok(!r.body.toString().includes(SECRET));
  } finally {
    await fsp.unlink(link).catch(() => {});
  }
});

test('GET / and GET /files give 404 with no listing', async () => {
  for (const p of ['/', '/files', '/files/', '/nope']) {
    const r = await request({ path: p, token: 'tokenA' });
    assert.equal(r.status, 404, p);
    assert.equal(json(r).error, 'not_found');
  }
});

test('wrong method on a known path gives 405, and /health needs no token', async () => {
  assert.equal(
    (await request({ method: 'POST', path: '/files/a/b', token: 'tokenA', body: 'x' })).status,
    405
  );

  const health = await request({ path: '/health' });
  assert.equal(health.status, 200);
  assert.deepEqual(json(health), { ok: true });
  assert.equal((await request({ method: 'POST', path: '/health' })).status, 405);
});

test('filePathFor is deterministic and stays inside dataDir', () => {
  const a = filePathFor(dataDir, 'user-a', 'p', 'f');
  assert.equal(a, filePathFor(dataDir, 'user-a', 'p', 'f'));
  assert.notEqual(a, filePathFor(dataDir, 'user-b', 'p', 'f'));
  assert.ok(a.startsWith(dataDir + path.sep));
  const hostile = filePathFor(dataDir, 'a/../../b', '..', '\\..\\x');
  assert.ok(hostile.startsWith(dataDir + path.sep));
  assert.match(path.relative(dataDir, hostile), /^[0-9a-f]{64}[\\/][0-9a-f]{64}[\\/][0-9a-f]{64}$/);
});

test('token checker caches successes for 60 s and never caches failures', async () => {
  let calls = 0;
  let clock = 0;
  const responses = [
    () => new Response(JSON.stringify({ id: 'user-z' }), { status: 200 }),
    () => new Response('{}', { status: 401 }),
    () => new Response('oops', { status: 500 }),
  ];
  const check = createSupabaseTokenChecker({
    supabaseUrl: 'https://example.supabase.co',
    supabaseKey: 'pk_test',
    now: () => clock,
    fetchImpl: async (url, opts) => {
      calls++;
      assert.equal(url, 'https://example.supabase.co/auth/v1/user');
      assert.equal(opts.headers.apikey, 'pk_test');
      return responses[Math.min(calls - 1, responses.length - 1)]();
    },
  });
  assert.equal((await check('t1')).id, 'user-z');
  assert.equal((await check('t1')).id, 'user-z');
  assert.equal(calls, 1);
  clock = 60_001;
  assert.equal(await check('t1'), null);
  assert.equal(calls, 2);
  await assert.rejects(check('t1'));
  await assert.rejects(check('t2'));
});

test('token checker maps the confirmation fields to confirmed', async () => {
  const answers = {
    'email-set': { id: 'u1', email: 'x@example.com', email_confirmed_at: '2026-01-01T00:00:00Z' },
    'confirmed-set': { id: 'u2', email: 'x@example.com', confirmed_at: '2026-01-01T00:00:00Z' },
    'both-empty': { id: 'u3', email: 'x@example.com', email_confirmed_at: '', confirmed_at: null },
    neither: { id: 'u4', email: 'x@example.com' },
    'no-email': { id: 'u5', email_confirmed_at: '2026-01-01T00:00:00Z' },
  };
  const check = createSupabaseTokenChecker({
    supabaseUrl: 'https://example.supabase.co',
    supabaseKey: 'pk_test',
    fetchImpl: async (_url, opts) =>
      new Response(JSON.stringify(answers[opts.headers.Authorization.slice(7)]), { status: 200 }),
  });
  assert.deepEqual(await check('email-set'), { id: 'u1', email: 'x@example.com', confirmed: true });
  assert.deepEqual(await check('confirmed-set'), {
    id: 'u2',
    email: 'x@example.com',
    confirmed: true,
  });
  assert.deepEqual(await check('both-empty'), {
    id: 'u3',
    email: 'x@example.com',
    confirmed: false,
  });
  assert.deepEqual(await check('neither'), { id: 'u4', email: 'x@example.com', confirmed: false });
  assert.deepEqual(await check('no-email'), { id: 'u5', email: '', confirmed: true });
});

test('a confirmed e-mail outside the list gets 403 on every /files route, and nothing is written', async () => {
  const methods = [
    ['PUT', file('gate', 'f'), 'new bytes'],
    ['GET', file('gate', 'f'), undefined],
    ['DELETE', file('gate', 'f'), undefined],
    ['POST', '/files/a/b', 'x'],
    ['PUT', `/files/${encodeURIComponent('..')}/x`, 'x'],
  ];
  for (const [method, p, body] of methods) {
    const r = await request({ method, path: p, token: 'mallory', body, at: gated.port });
    assert.equal(r.status, 403, `${method} ${p}`);
    assert.equal(r.body.toString(), '{"error":"forbidden"}');
  }
  assert.equal(fs.existsSync(path.join(gated.dataDir, sha(WHO.mallory.id))), false);
});

test('an unconfirmed e-mail gets 403 even when it is on the list, and creates no folder', async () => {
  const r = await request({
    method: 'PUT',
    path: file('gate', 'f'),
    token: 'unconfirmed',
    body: 'x',
    at: gated.port,
  });
  assert.equal(r.status, 403);
  assert.equal(json(r).error, 'forbidden');
  assert.equal(fs.existsSync(path.join(gated.dataDir, sha(WHO.unconfirmed.id))), false);
});

test('the list match ignores case and surrounding spaces, on both sides', async () => {
  const alice = Buffer.from('alice file');
  const up = await request({
    method: 'PUT',
    path: file('gate', 'alice'),
    token: 'alice',
    body: alice,
    at: gated.port,
  });
  assert.equal(up.status, 201);
  const down = await request({ path: file('gate', 'alice'), token: 'alice', at: gated.port });
  assert.deepEqual(down.body, alice);
  assert.equal(
    (
      await request({
        method: 'PUT',
        path: file('gate', 'c'),
        token: 'carol',
        body: 'c',
        at: gated.port,
      })
    ).status,
    201
  );
});

test('a 403 reveals nothing: an existing file and a missing one answer the same', async () => {
  const secret = 'alice private bytes';
  await request({
    method: 'PUT',
    path: file('gate', 'secret'),
    token: 'alice',
    body: secret,
    at: gated.port,
  });
  const existing = await request({
    path: file('gate', 'secret'),
    token: 'mallory',
    at: gated.port,
  });
  const missing = await request({
    path: file('gate', 'nothing-here'),
    token: 'mallory',
    at: gated.port,
  });
  assert.equal(existing.status, 403);
  assert.equal(missing.status, 403);
  assert.equal(existing.body.toString(), missing.body.toString());
  assert.ok(!existing.body.toString().includes(secret));
});

test('the null list allows any confirmed user, but not an unconfirmed one', async () => {
  const ok = await request({ method: 'PUT', path: file('open', 'f'), token: 'tokenB', body: 'b' });
  assert.equal(ok.status, 201);
  const no = await request({
    method: 'PUT',
    path: file('open', 'f'),
    token: 'unconfirmed',
    body: 'x',
  });
  assert.equal(no.status, 403);
});

test('a quota refuses a Content-Length upload that would pass it with 507, keeps the old version, leaves no tmp', async () => {
  const keep = hex(60 * KIB);
  assert.equal(
    (
      await request({
        method: 'PUT',
        path: file('q', 'keep'),
        token: 'quotaA',
        body: keep,
        at: quota.port,
      })
    ).status,
    201
  );

  const over = hex(50 * KIB);
  const r = await request({
    method: 'PUT',
    path: file('q', 'other'),
    token: 'quotaA',
    headers: { 'Content-Length': String(over.length) },
    body: over,
    at: quota.port,
  });
  assert.equal(r.status, 507);
  assert.equal(json(r).error, 'quota_exceeded');
  assert.equal(
    (await request({ path: file('q', 'other'), token: 'quotaA', at: quota.port })).status,
    404
  );
  assert.deepEqual(
    (await request({ path: file('q', 'keep'), token: 'quotaA', at: quota.port })).body,
    keep
  );
  assert.deepEqual(
    (await listAll(quota.dataDir)).filter((f) => f.endsWith('.tmp')),
    []
  );
});

test('a quota refuses a chunked upload that passes it mid-stream with 507; the old version stays, no tmp', async () => {
  const old = hex(10 * KIB);
  await request({
    method: 'PUT',
    path: file('q', 'chunky'),
    token: 'quotaA',
    body: old,
    at: quota.port,
  });

  // 61440 bytes of keep are already there, so this file may use 40960 bytes; the fifth chunk passes it.
  const chunks = Array.from({ length: 5 }, () => hex(10 * KIB));
  const r = await request({
    method: 'PUT',
    path: file('q', 'chunky'),
    token: 'quotaA',
    body: Readable.from(chunks),
    at: quota.port,
  });
  assert.equal(r.status, 507);
  assert.equal(json(r).error, 'quota_exceeded');
  assert.deepEqual(
    (await request({ path: file('q', 'chunky'), token: 'quotaA', at: quota.port })).body,
    old
  );
  assert.ok(
    await waitFor(async () => (await listAll(quota.dataDir)).every((f) => !f.endsWith('.tmp')))
  );
});

test('replacing a file within quota works, even if old plus new would exceed the quota', async () => {
  // keep (60 KiB) plus chunky (10 KiB) are stored; replacing keep with 64 KiB makes 126 KiB in total, over 100 KiB.
  const bigger = hex(64 * KIB);
  const r = await request({
    method: 'PUT',
    path: file('q', 'keep'),
    token: 'quotaA',
    headers: { 'Content-Length': String(bigger.length) },
    body: bigger,
    at: quota.port,
  });
  assert.equal(r.status, 201);
  assert.deepEqual(
    (await request({ path: file('q', 'keep'), token: 'quotaA', at: quota.port })).body,
    bigger
  );
});

test("one user's usage does not change another user's quota", async () => {
  const bee = hex(60 * KIB);
  const b = await request({
    method: 'PUT',
    path: file('q', 'bee'),
    token: 'quotaB',
    headers: { 'Content-Length': String(bee.length) },
    body: bee,
    at: quota.port,
  });
  assert.equal(b.status, 201);

  // And the same user is still held to the quota: a second 60 KiB file does not fit beside the first.
  const second = await request({
    method: 'PUT',
    path: file('q', 'bee2'),
    token: 'quotaB',
    headers: { 'Content-Length': String(bee.length) },
    body: bee,
    at: quota.port,
  });
  assert.equal(second.status, 507);
});

test('ALLOWED_EMAILS is required: without it the server exits 1 with the message, before touching disk', async () => {
  const run = promisify(execFile);
  const freePort = String(20000 + Math.floor(Math.random() * 20000));
  const dir = path.join(base, 'spawn-data');
  const env = {
    ...process.env,
    SUPABASE_URL: 'https://example.supabase.co',
    SUPABASE_KEY: 'pk_test',
    PORT: freePort,
    DATA_DIR: dir,
  };
  delete env.ALLOWED_EMAILS;
  delete env.ALLOW_ANY_CONFIRMED_USER;
  for (const value of [undefined, ' , ']) {
    const e = { ...env };
    if (value !== undefined) e.ALLOWED_EMAILS = value;
    await assert.rejects(run(process.execPath, [SERVER_JS], { env: e, timeout: 10000 }), (err) => {
      assert.equal(err.code, 1);
      assert.match(err.stderr, /ALLOWED_EMAILS is required/);
      return true;
    });
  }
  assert.equal(fs.existsSync(dir), false);
});

test('after all of the above, only hashed 64-hex names exist and nothing is outside the data folders', async () => {
  for (const f of [...(await listAll(dataDir)), ...(await listAll(path.join(base, 'more')))]) {
    const name = path.basename(f);
    assert.match(name, /^[0-9a-f]{64}$/, `unexpected file name: ${name}`);
  }
  const top = (await fsp.readdir(base)).sort();
  assert.deepEqual(top, ['data', 'more', 'secret.txt']);
  assert.equal(await fsp.readFile(secretPath, 'utf8'), SECRET);
});
