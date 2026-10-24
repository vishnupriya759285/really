const assert = require('assert');
const http = require('http');
const app = require('../server');
const db = require('../db/db');

let server;
const PORT = 3981;
const BASE_URL = `http://localhost:${PORT}`;

function request(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const options = {
      method,
      hostname: url.hostname,
      port: url.port,
      path: url.pathname,
      headers: { 'Content-Type': 'application/json' }
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = data ? JSON.parse(data) : {};
          resolve({ status: res.statusCode, headers: res.headers, body: parsed, raw: data });
        } catch {
          resolve({ status: res.statusCode, headers: res.headers, raw: data });
        }
      });
    });

    req.on('error', reject);
    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

async function runTests() {
  console.log('--- Starting API Endpoint Verification Tests ---');

  await new Promise((resolve) => {
    server = app.listen(PORT, resolve);
  });

  try {
    // 1. Health check
    console.log('Testing GET /api/health...');
    const health = await request('GET', '/api/health');
    assert.strictEqual(health.status, 200, 'Health endpoint should return 200');
    assert.strictEqual(health.body.status, 'ok', 'Status should be ok');
    console.log('✓ Health check passed');

    // 2. Sessions list
    console.log('Testing GET /api/sessions...');
    const sessions = await request('GET', '/api/sessions');
    assert.strictEqual(sessions.status, 200);
    assert(Array.isArray(sessions.body), 'Sessions should be an array');
    console.log(`✓ GET /api/sessions returned ${sessions.body.length} sessions`);

    // 3. Validation failure on POST /api/sessions
    console.log('Testing POST /api/sessions validation rejection (missing logs)...');
    const badSession = await request('POST', '/api/sessions', { title: 'Test only' });
    assert.strictEqual(badSession.status, 400, 'Missing error_logs should return 400 Bad Request');
    console.log('✓ Validation guard correctly rejected incomplete bug report');

    // 4. Successful POST /api/sessions
    console.log('Testing POST /api/sessions creation...');
    const newSession = await request('POST', '/api/sessions', {
      title: 'Null pointer in OrderProcessor',
      severity: 'Critical',
      component: 'order-service',
      environment: 'Node.js v20',
      error_logs: 'TypeError: Cannot read property id of null\n  at OrderProcessor.run (/app/order.js:45:10)'
    });
    assert.strictEqual(newSession.status, 201, 'Should return 201 Created');
    assert(newSession.body.id, 'Session should have an id');
    const createdId = newSession.body.id;
    console.log(`✓ Created session with ID: ${createdId}`);

    // 5. GET /api/sessions/:id
    console.log(`Testing GET /api/sessions/${createdId}...`);
    const sessionDetail = await request('GET', `/api/sessions/${createdId}`);
    assert.strictEqual(sessionDetail.status, 200);
    assert.strictEqual(sessionDetail.body.session.title, 'Null pointer in OrderProcessor');
    console.log('✓ GET /api/sessions/:id verified');

    // 6. 404 for unknown session
    console.log('Testing GET /api/sessions/nonexistent_id (404)...');
    const notFound = await request('GET', '/api/sessions/sess_does_not_exist_999');
    assert.strictEqual(notFound.status, 404);
    console.log('✓ 404 status verified for nonexistent session');

    // 7. Workflow execution
    console.log(`Testing POST /api/sessions/${createdId}/workflow...`);
    const workflow = await request('POST', `/api/sessions/${createdId}/workflow`);
    assert.strictEqual(workflow.status, 200);
    assert(workflow.body.analysis, 'Workflow should produce analysis');
    assert(workflow.body.reproduction, 'Workflow should produce reproduction');
    assert(workflow.body.fix, 'Workflow should produce fix');
    assert(workflow.body.regressionTest, 'Workflow should produce regression test');
    console.log('✓ Workflow execution generated all 4 phases successfully');

    // 8. Regression library
    console.log('Testing GET /api/regressions...');
    const regs = await request('GET', '/api/regressions');
    assert.strictEqual(regs.status, 200);
    assert(regs.body.length > 0, 'Regressions should have at least 1 test');
    const regId = regs.body[0].id;
    console.log(`✓ Regressions retrieved (${regs.body.length} tests)`);

    // 9. Run on-demand regression test
    console.log(`Testing POST /api/regressions/${regId}/run...`);
    const regRun = await request('POST', `/api/regressions/${regId}/run`);
    assert.strictEqual(regRun.status, 200);
    assert.strictEqual(regRun.body.regression.status, 'passing');
    assert.strictEqual(regRun.body.test_result.exit_code, 0);
    console.log('✓ On-demand regression execution verified with Exit 0');

    console.log('\n=======================================');
    console.log('ALL API ENDPOINT TESTS PASSED WITH 100%');
    console.log('=======================================\n');
  } finally {
    server.close();
  }
}

runTests().catch(err => {
  console.error('API Test Suite Failed:', err);
  if (server) server.close();
  process.exit(1);
});
