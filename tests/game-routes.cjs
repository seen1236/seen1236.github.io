// Guards the /game deployment: the page, its assets, the account API and the
// private directory must all behave the same way on a fresh server start.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const net = require('node:net');
const path = require('node:path');
const {spawn} = require('node:child_process');
const {once} = require('node:events');
const test = require('node:test');
const web = path.join(__dirname, '..');
const project = path.join(web, '..');

function request(port, target, method = 'GET') {
  return new Promise((resolve, reject) => {
    http.request({host:'127.0.0.1', port, path:target, method, headers:{'Accept-Encoding':'identity'}}, response => {
      const chunks = [];
      response.on('data', chunk => chunks.push(chunk));
      response.on('end', () => resolve({status:response.statusCode, headers:response.headers, body:Buffer.concat(chunks)}));
    }).on('error', reject).end();
  });
}

test('the game page, its assets, accounts and private files are routed correctly', async t => {
  const probe = net.createServer(); probe.listen(0, '127.0.0.1'); await once(probe, 'listening');
  const port = probe.address().port; await new Promise(resolve => probe.close(resolve));
  const child = spawn(process.execPath, [path.join(web, 'server.js')], {
    env: {...process.env, PORT:String(port)}, cwd:path.join(web, '..'), windowsHide:true, stdio:['ignore','pipe','pipe'],
  });
  const noise = [];
  child.stdout.on('data', chunk => noise.push(chunk.toString()));
  child.stderr.on('data', chunk => noise.push(chunk.toString()));
  t.after(async () => {
    if (child.exitCode === null) { const stopped = once(child, 'exit'); child.kill(); await stopped; }
  });
  await Promise.race([once(child.stdout, 'data'), once(child, 'exit').then(() => { throw new Error('server exited: ' + noise.join('')); })]);

  const root = await request(port, '/game');
  assert.equal(root.status, 308);
  assert.equal(root.headers.location, '/game/');

  const page = await request(port, '/game/');
  assert.equal(page.status, 200);
  assert.match(page.headers['content-type'], /^text\/html/);
  assert.ok(page.body.toString('utf8').includes('SEEN RIDE'));
  assert.match(page.headers['content-security-policy'] || '', /script-src/);

  const app = await request(port, '/game/ride-app.js');
  assert.equal(app.status, 200);
  assert.match(app.headers['content-type'], /javascript/);
  assert.deepEqual(app.body, fs.readFileSync(path.join(project, 'game', 'public', 'ride-app.js')));

  const manifest = await request(port, '/game/manifest.json');
  assert.equal(manifest.status, 200);
  assert.match(manifest.headers['cache-control'], /no-store/);

  const session = await request(port, '/game/api/session');
  assert.equal(session.status, 200);
  assert.equal(typeof JSON.parse(session.body.toString('utf8')).googleReady, 'boolean');

  for (const target of ['/game/private/config.json', '/game/%2e%2e/private/config.json', '/game/../game/private/config.json', '/game/models/../../private/config.json']) {
    const blocked = await request(port, target);
    assert.ok([400, 403, 404].includes(blocked.status), target + ' -> ' + blocked.status);
    assert.ok(!blocked.body.toString('utf8').includes('clientSecret'), target + ' leaked the game configuration');
  }

  const missing = await request(port, '/game/does-not-exist.js');
  assert.equal(missing.status, 404);
});
