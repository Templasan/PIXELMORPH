// Local media server: per-user file storage that cannot leave its folder.
// Node built-ins only. Binds to 127.0.0.1. See README.md.

import http from 'node:http';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { createHash, randomBytes } from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const FOUR_GIB = 4 * 1024 ** 3;
const MAX_SEGMENT = 512;
const TOKEN_TTL_MS = 60_000;
const TOKEN_CACHE_MAX = 1000;
const DRAIN_MS = 5000;
// shortcut: no resumable uploads, no per-user quota, no rate limiting, upgrade before sharing beyond the owner's PC

const sha256 = (s) => createHash('sha256').update(String(s)).digest('hex');

// The only place a disk path is built. Client strings only ever contribute hashes.
export function filePathFor(dataDir, userId, projectId, fileId) {
  const result = path.join(dataDir, sha256(userId), sha256(projectId), sha256(fileId));
  const root = path.resolve(dataDir) + path.sep;
  if (!path.resolve(result).startsWith(root)) throw new Error('path escapes data directory');
  return result;
}

// Returns the decoded id, or null when the raw segment is not a safe id.
function decodeSegment(raw) {
  if (!raw || raw.length > MAX_SEGMENT) return null;
  let s;
  try {
    s = decodeURIComponent(raw);
  } catch {
    return null;
  }
  if (!s || s.length > MAX_SEGMENT) return null;
  if (/[/\\\u0000]/.test(s) || s === '.' || s === '..') return null;
  return s;
}

// Supabase-backed token check. Successful lookups are cached 60 s, keyed by sha256(token).
export function createSupabaseTokenChecker({
  supabaseUrl,
  supabaseKey,
  fetchImpl = fetch,
  now = () => Date.now(),
}) {
  const cache = new Map();
  return async function checkToken(token) {
    const key = sha256(token);
    const hit = cache.get(key);
    if (hit) {
      if (hit.expires > now()) return hit.userId;
      cache.delete(key);
    }
    const res = await fetchImpl(`${supabaseUrl}/auth/v1/user`, {
      headers: { apikey: supabaseKey, Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(10_000),
    });
    if (res.status === 401 || res.status === 403) {
      res.body?.cancel().catch(() => {});
      return null;
    }
    if (res.status !== 200) throw new Error(`auth service answered ${res.status}`);
    const json = await res.json();
    if (typeof json?.id !== 'string' || json.id === '') return null;
    if (cache.size >= TOKEN_CACHE_MAX) {
      for (const [k, v] of cache) if (v.expires <= now()) cache.delete(k);
      if (cache.size >= TOKEN_CACHE_MAX) cache.clear();
    }
    cache.set(key, { userId: json.id, expires: now() + TOKEN_TTL_MS });
    return json.id;
  };
}

function send(res, status, body, headers = {}) {
  const data = JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(data),
    ...headers,
  });
  res.end(data);
}

// Answers now, then discards whatever the client still sends (bounded) so the answer is not reset.
function refuse(req, res, status, code) {
  send(res, status, { error: code }, { Connection: 'close' });
  req.resume();
  setTimeout(() => req.destroy(), DRAIN_MS).unref();
}

// Streams the body into tmp. Resolves with the byte count only when the request ended fully.
// Rejects with err.code 'too_large' | 'aborted' | 'io'; the tmp file is closed by then.
function receive(req, tmp, max) {
  return new Promise((resolve, reject) => {
    const out = fs.createWriteStream(tmp, { flags: 'wx' });
    let size = 0;
    let failure = null;
    let ended = false;
    out.on('error', () => {
      failure ??= 'io';
    });
    out.on('close', () => {
      if (failure) return reject(Object.assign(new Error(failure), { code: failure }));
      if (ended) resolve(size);
    });
    const abort = (code) => {
      if (failure || ended) return;
      failure = code;
      req.resume();
      out.destroy();
    };
    req.on('data', (chunk) => {
      if (failure || ended) return;
      size += chunk.length;
      if (size > max) return abort('too_large');
      if (!out.write(chunk)) {
        req.pause();
        out.once('drain', () => req.resume());
      }
    });
    req.on('end', () => {
      if (failure || ended) return;
      ended = true;
      out.end();
    });
    req.on('close', () => abort('aborted'));
    req.on('error', () => abort('aborted'));
  });
}

async function handleUpload(req, res, finalPath, max) {
  const cl = req.headers['content-length'];
  if (cl !== undefined) {
    if (!/^\d{1,16}$/.test(cl)) return send(res, 400, { error: 'bad_request' });
    if (Number(cl) > max) return refuse(req, res, 413, 'too_large');
  }
  const dir = path.dirname(finalPath);
  await fsp.mkdir(dir, { recursive: true });
  const tmp = path.join(dir, `${randomBytes(16).toString('hex')}.tmp`);
  let size;
  try {
    size = await receive(req, tmp, max);
  } catch (err) {
    await fsp.rm(tmp, { force: true }).catch(() => {});
    if (err.code === 'io') return send(res, 500, { error: 'write_failed' });
    return refuse(req, res, 413, err.code === 'too_large' ? 'too_large' : 'upload_failed');
  }
  try {
    await fsp.rename(tmp, finalPath);
  } catch {
    await fsp.rm(tmp, { force: true }).catch(() => {});
    return send(res, 500, { error: 'internal' });
  }
  return send(res, 201, { size });
}

async function handleDownload(res, finalPath) {
  const st = await fsp.lstat(finalPath).catch(() => null);
  if (!st || !st.isFile()) return send(res, 404, { error: 'not_found' });
  const fh = await fsp.open(finalPath, 'r').catch(() => null);
  if (!fh) return send(res, 404, { error: 'not_found' });
  const fst = await fh.stat();
  if (!fst.isFile()) {
    await fh.close();
    return send(res, 404, { error: 'not_found' });
  }
  res.writeHead(200, {
    'Content-Type': 'application/octet-stream',
    'X-Content-Type-Options': 'nosniff',
    'Content-Length': fst.size,
    'Cache-Control': 'private, no-store',
  });
  const stream = fh.createReadStream();
  stream.on('error', () => res.destroy());
  res.on('close', () => stream.destroy());
  stream.pipe(res);
}

async function handleDelete(res, finalPath) {
  const st = await fsp.lstat(finalPath).catch(() => null);
  if (!st || !st.isFile()) return send(res, 404, { error: 'not_found' });
  await fsp.unlink(finalPath);
  res.writeHead(204).end();
}

// Auth comes before method and id checks, so an unauthenticated caller learns nothing.
async function authenticate(header, checkToken) {
  const m = typeof header === 'string' ? /^Bearer ([^\s]{1,4096})$/i.exec(header) : null;
  if (!m) return { status: 401 };
  let userId;
  try {
    userId = await checkToken(m[1]);
  } catch {
    return { status: 503 };
  }
  if (typeof userId !== 'string' || userId === '') return { status: 401 };
  return { userId };
}

export function createServer({
  dataDir,
  maxUploadBytes = FOUR_GIB,
  checkToken,
  log = (line) => console.log(line),
}) {
  const METHODS = ['GET', 'PUT', 'DELETE', 'HEAD', 'POST', 'PATCH', 'OPTIONS'];

  async function handle(req, res, ctx) {
    const rawPath = req.url.split('?')[0];

    if (rawPath === '/health') {
      if (req.method !== 'GET') return send(res, 405, { error: 'method_not_allowed' });
      return send(res, 200, { ok: true });
    }

    // Exactly ['', 'files', projectSeg, fileSeg]; everything else is 404 (no listing exists).
    const parts = rawPath.split('/');
    if (parts.length !== 4 || parts[0] !== '' || parts[1] !== 'files') {
      return send(res, 404, { error: 'not_found' });
    }

    const auth = await authenticate(req.headers.authorization, checkToken);
    if (auth.status) {
      const code = auth.status === 503 ? 'auth_unavailable' : 'unauthorized';
      return send(res, auth.status, { error: code });
    }
    ctx.uid = sha256(auth.userId).slice(0, 8);

    if (!['GET', 'PUT', 'DELETE'].includes(req.method)) {
      return send(res, 405, { error: 'method_not_allowed' });
    }

    const projectId = decodeSegment(parts[2]);
    const fileId = decodeSegment(parts[3]);
    if (projectId === null || fileId === null) return send(res, 400, { error: 'bad_id' });

    const finalPath = filePathFor(dataDir, auth.userId, projectId, fileId);
    if (req.method === 'PUT') return handleUpload(req, res, finalPath, maxUploadBytes);
    if (req.method === 'GET') return handleDownload(res, finalPath);
    return handleDelete(res, finalPath);
  }

  const server = http.createServer((req, res) => {
    const ctx = { uid: null };
    res.on('finish', () => {
      const method = METHODS.includes(req.method) ? req.method : 'OTHER';
      log(`${method} ${res.statusCode}${ctx.uid ? ` user=${ctx.uid}` : ''}`);
    });
    handle(req, res, ctx).catch(() => {
      if (!res.headersSent) send(res, 500, { error: 'internal' });
      else res.destroy();
    });
  });
  // Long uploads are allowed; slow headers are not.
  server.requestTimeout = 0;
  server.headersTimeout = 30000;
  return server;
}

function positiveInt(value, fallback, name) {
  if (!value) return fallback;
  const n = Number(value);
  if (!Number.isSafeInteger(n) || n <= 0) {
    console.error(`media-server: ${name} must be a positive whole number`);
    process.exit(1);
  }
  return n;
}

function main() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_KEY;
  if (!supabaseUrl || !supabaseKey) {
    console.error(
      'media-server: SUPABASE_URL and SUPABASE_KEY are required (use the publishable key, never service_role)',
    );
    process.exit(1);
  }
  const port = positiveInt(process.env.PORT, 3000, 'PORT');
  const maxUploadBytes = positiveInt(process.env.MAX_UPLOAD_BYTES, FOUR_GIB, 'MAX_UPLOAD_BYTES');
  const dataDir = path.resolve(process.env.DATA_DIR || path.join(HERE, 'data'));
  fs.mkdirSync(dataDir, { recursive: true });

  const server = createServer({
    dataDir,
    maxUploadBytes,
    checkToken: createSupabaseTokenChecker({
      supabaseUrl: supabaseUrl.replace(/\/+$/, ''),
      supabaseKey,
    }),
  });
  server.listen(port, '127.0.0.1', () => {
    console.log(`media-server listening on http://127.0.0.1:${port}`);
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main();
}
