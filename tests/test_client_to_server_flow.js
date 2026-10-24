const assert = require('assert');
const http = require('http');

function postJson(urlStr, data) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlStr);
    const body = JSON.stringify(data);
    const req = http.request({
      hostname: url.hostname,
      port: url.port,
      path: url.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body)
      }
    }, res => {
      let responseBody = '';
      res.on('data', chunk => responseBody += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(responseBody) });
        } catch {
          resolve({ status: res.statusCode, raw: responseBody });
        }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

function getJson(urlStr) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlStr);
    const req = http.request({
      hostname: url.hostname,
      port: url.port,
      path: url.pathname,
      method: 'GET',
      headers: { 'Accept': 'application/json' }
    }, res => {
      let responseBody = '';
      res.on('data', chunk => responseBody += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(responseBody) });
        } catch {
          resolve({ status: res.statusCode, raw: responseBody });
        }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

async function verifyCrossPortBotFlow() {
  console.log('\n======================================================');
  console.log('VERIFYING MULTI-PORT CLIENT TO GEMINI BOT PR LIFECYCLE');
  console.log('======================================================\n');

  // 1. Verify client website is live on port 4000
  console.log('1. Checking client website health on port 4000...');
  const clientHealth = await getJson('http://localhost:4000/api/health');
  assert.strictEqual(clientHealth.status, 200);
  assert.strictEqual(clientHealth.body.port, 4000);
  console.log('✓ Client website is live on http://localhost:4000');

  // 2. Trigger deliberate crash on client website port 4000
  console.log('2. Triggering real client-side crash via POST http://localhost:4000/api/checkout...');
  const crashRes = await postJson('http://localhost:4000/api/checkout', {
    items: [{ name: 'Zero-rated Special Promo', price: 10.00, taxRate: undefined }]
  });
  assert.strictEqual(crashRes.status, 500);
  console.log('✓ Client endpoint triggered expected 500 error:', crashRes.body.error);

  // 3. Client transmits telemetry (JS error, stack, network, console, click trail) to Really (Port 3000)
  console.log('3. Client transmitting telemetry report to Really server (http://localhost:3000/api/telemetry)...');
  const telemetryPayload = {
    title: 'TypeError: Cannot read properties of undefined in checkout tax calculation',
    error_name: crashRes.body.error,
    error_message: crashRes.body.message,
    stack_trace: crashRes.body.stack,
    component: crashRes.body.component,
    network_logs: [
      { url: 'http://localhost:4000/api/checkout', method: 'POST', status: 500, duration_ms: 18 }
    ],
    console_logs: [
      '[10:30:12 PM] [WARN] Initiating checkout with malformed tax payload...',
      '[10:30:12 PM] [ERROR] Uncaught TypeError in calculateItemTax'
    ],
    user_breadcrumbs: [
      '1. Open NovaPay store at http://localhost:4000',
      '2. Clicked [button] "+ Add to Cart"',
      '3. Clicked [button] "💥 Trigger Checkout Tax Crash"'
    ],
    environment: {
      browser: 'Chrome 131',
      os: 'Windows 11',
      viewport: '1920x1080'
    }
  };

  const telemRes = await postJson('http://localhost:3000/api/telemetry', telemetryPayload);
  assert.strictEqual(telemRes.status, 201);
  const sessionId = telemRes.body.session_id;
  assert(sessionId, 'Telemetry must create a session on Really');
  assert(telemRes.body.bot_analysis, 'Response must include Gemini Bot analysis');
  console.log(`✓ Telemetry ingested on Port 3000! Created Session ID: ${sessionId}`);
  console.log('✓ Bot Engine:', telemRes.body.bot_analysis.powered_by);
  console.log('✓ Reproduction Steps generated:', telemRes.body.bot_analysis.steps_to_reproduce.length, 'steps');
  console.log('✓ Developer Suggestion generated:', telemRes.body.bot_analysis.developer_suggestion.substring(0, 80) + '...');

  // 4. Developer asks Gemini Bot to create a Pull Request
  console.log(`4. Developer requesting Pull Request creation via POST http://localhost:3000/api/sessions/${sessionId}/pr...`);
  const prRes = await postJson(`http://localhost:3000/api/sessions/${sessionId}/pr`, {});
  assert.strictEqual(prRes.status, 201);
  const pr = prRes.body.pull_request;
  assert(pr, 'Pull Request must be generated');
  assert.strictEqual(pr.status, 'open');
  console.log(`✓ Pull Request created: PR #${pr.pr_number} (${pr.title})`);
  console.log(`✓ Branch: ${pr.branch} -> ${pr.target_branch}`);

  // 5. Developer reviews and merges the Pull Request
  console.log(`5. Developer merging Pull Request via POST http://localhost:3000/api/pull-requests/${pr.id}/merge...`);
  const mergeRes = await postJson(`http://localhost:3000/api/pull-requests/${pr.id}/merge`, {});
  assert.strictEqual(mergeRes.status, 200);
  assert.strictEqual(mergeRes.body.pull_request.status, 'merged');
  assert(mergeRes.body.pull_request.merge_commit, 'Merged PR must have commit hash');
  console.log(`✓ Pull Request successfully merged into main! Commit: ${mergeRes.body.pull_request.merge_commit}`);

  console.log('\n======================================================');
  console.log('SUCCESS: COMPLETE MULTI-PORT GEMINI BOT & PR WORKFLOW PASSED');
  console.log('======================================================\n');
}

verifyCrossPortBotFlow().catch(err => {
  console.error('Cross-Port Test Failed:', err);
  process.exit(1);
});
