const assert = require('assert');
const http = require('http');
const fs = require('fs');
const path = require('path');
const app = require('../server');
const db = require('../db/db');

let server;
const PORT = 3982;
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

async function runUserJourney() {
  console.log('\n======================================================');
  console.log('BEGINNING SENIOR QA REVIEW: 10-STEP USER JOURNEY AUDIT');
  console.log('======================================================\n');

  await new Promise((resolve) => {
    server = app.listen(PORT, resolve);
  });

  try {
    // Step 1: Open landing page
    console.log('[Step 1] Open the landing page...');
    const landingRes = await request('GET', '/');
    assert.strictEqual(landingRes.status, 200, 'Landing page route / must return 200 OK');
    assert(landingRes.raw.includes('BugTwin') || landingRes.raw.includes('Really'), 'Landing page HTML title must match');
    assert(landingRes.raw.includes('id="main-content"'), 'Main content container must exist');
    assert(landingRes.raw.includes('id="brand-logo"'), 'Brand logo must exist');
    console.log('  -> Step 1 Passed: Landing page loaded successfully with valid semantic HTML.\n');

    // Step 2: Navigate to the dashboard
    console.log('[Step 2] Navigate to the dashboard...');
    const dashRes = await request('GET', '/dashboard');
    assert.strictEqual(dashRes.status, 200, 'Dashboard route /dashboard must return 200 OK');
    const sessionsRes = await request('GET', '/api/sessions');
    assert.strictEqual(sessionsRes.status, 200, 'API endpoint /api/sessions must be reachable');
    assert(Array.isArray(sessionsRes.body), 'Dashboard sessions response must be an array');
    console.log(`  -> Step 2 Passed: Dashboard routes reachable, loaded ${sessionsRes.body.length} existing sessions.\n`);

    // Step 3: Start a new debugging session
    console.log('[Step 3] Start a new debugging session...');
    const newSessionPage = await request('GET', '/sessions/new');
    assert.strictEqual(newSessionPage.status, 200, 'New session route /sessions/new must return 200 OK');
    console.log('  -> Step 3 Passed: /sessions/new route ready for input.\n');

    // Step 4: Submit a bug report with sample error logs
    console.log('[Step 4] Submit a bug report with sample error logs...');
    const sampleBugReport = {
      title: "Unhandled TypeError when calculating tax on empty cart items",
      severity: "High",
      component: "checkout-calculator",
      environment: "Node.js v20.19.4 / Express 4.19 / Linux",
      error_logs: "TypeError: Cannot read properties of undefined (reading 'taxRate')\n    at calculateItemTax (/app/services/checkout.js:112:28)\n    at processCart (/app/services/cart.js:45:12)\n    at /app/node_modules/express/lib/router/index.js:284:7",
      stack_trace: "/app/services/checkout.js:112:28\n/app/services/cart.js:45:12",
      steps_to_reproduce: "1. POST /api/cart/checkout with empty items array\n2. Service attempts to evaluate taxRate on undefined item",
      expected_behavior: "Return { subtotal: 0, tax: 0, total: 0 } with status 200",
      actual_behavior: "Process crashes with unhandled TypeError, dropping connection"
    };

    const submitRes = await request('POST', '/api/sessions', sampleBugReport);
    assert.strictEqual(submitRes.status, 201, 'POST /api/sessions must return 201 Created');
    assert(submitRes.body.id, 'Created session must have a unique ID');
    assert.strictEqual(submitRes.body.title, sampleBugReport.title);
    const createdSessionId = submitRes.body.id;
    console.log(`  -> Step 4 Passed: Bug report accepted. Created session ID: ${createdSessionId}\n`);

    // Step 5: Open the created session
    console.log(`[Step 5] Open the created session (/sessions/${createdSessionId})...`);
    const sessionRouteRes = await request('GET', `/sessions/${createdSessionId}`);
    assert.strictEqual(sessionRouteRes.status, 200, 'Session view route must return 200 OK');
    const sessionData = await request('GET', `/api/sessions/${createdSessionId}`);
    assert.strictEqual(sessionData.status, 200);
    assert.strictEqual(sessionData.body.session.id, createdSessionId);
    assert.strictEqual(sessionData.body.session.status, 'created');
    console.log(`  -> Step 5 Passed: Created session opened, status confirmed as 'created'.\n`);

    // Step 6: Run the demo workflow
    console.log('[Step 6] Run the demo workflow...');
    const workflowRes = await request('POST', `/api/sessions/${createdSessionId}/workflow`);
    assert.strictEqual(workflowRes.status, 200, 'POST /api/sessions/:id/workflow must return 200 OK');
    assert(workflowRes.body.analysis, 'Workflow response must include analysis');
    assert(workflowRes.body.reproduction, 'Workflow response must include reproduction');
    assert(workflowRes.body.fix, 'Workflow response must include proposed fix');
    assert(workflowRes.body.regressionTest, 'Workflow response must include synthesized regression test');
    console.log('  -> Step 6 Passed: Automated workflow pipeline executed all phases.\n');

    // Step 7: Inspect the analysis and reproduction results
    console.log('[Step 7] Inspect the analysis and reproduction results...');
    const analysis = workflowRes.body.analysis;
    const reproduction = workflowRes.body.reproduction;

    // Verify simulation disclosure
    assert.strictEqual(analysis.is_simulated, true, 'Analysis must be labeled as simulated');
    assert(analysis.simulation_label.includes('SIMULATED'), 'Analysis must show explicit SIMULATED label');
    console.log(`  - Root cause file: ${analysis.root_cause_file}`);
    console.log(`  - Root cause function: ${analysis.root_cause_function}`);
    console.log(`  - Simulation label: "${analysis.simulation_label}"`);

    assert.strictEqual(reproduction.execution_mode, 'SIMULATED_SANDBOX', 'Reproduction execution mode must be SIMULATED_SANDBOX');
    assert.strictEqual(reproduction.status, 'reproduced');
    assert.strictEqual(reproduction.exit_code, 1, 'Reproduction exit code must be 1 to prove bug was confirmed');
    console.log(`  - Reproduction status: ${reproduction.status} (Exit Code: ${reproduction.exit_code})`);
    console.log('  -> Step 7 Passed: Analysis and reproduction verified with explicit simulation disclosure.\n');

    // Step 8: Review the proposed code diff
    console.log('[Step 8] Review the proposed code diff...');
    const fix = workflowRes.body.fix;
    assert(fix.patch_diff.includes('--- a/'), 'Diff must contain unified diff headers');
    assert(fix.patch_diff.includes('+++ b/'), 'Diff must contain target file headers');
    assert(fix.patch_diff.includes('+'), 'Diff must include additions');
    assert(fix.patch_diff.includes('-'), 'Diff must include deletions');

    // Verify integrity rule: Never claims fix was verified without actual supporting test results
    assert.strictEqual(fix.verification_status, 'VERIFIED_BY_TEST_RUN', 'Verification status must reflect test execution');
    assert(fix.verification_details, 'Supporting test execution details must be present');
    assert.strictEqual(fix.verification_details.exit_code, 0, 'Supporting test must have exit code 0');
    assert.strictEqual(fix.verification_details.passed_count, 1, 'Supporting test must have passed count');
    assert(fix.verification_details.test_output.includes('Exit code 0, 1 passed'), 'Supporting test output must prove passage');
    console.log(`  - Patch target: ${fix.target_file}`);
    console.log(`  - Verification Status: ${fix.verification_status}`);
    console.log(`  - Supporting test exit code: ${fix.verification_details.exit_code} (1 passed)`);
    console.log('  -> Step 8 Passed: Code diff reviewed, verification backed by supporting test output.\n');

    // Step 9: Open the regression test library
    console.log('[Step 9] Open the regression test library...');
    const regLibraryPage = await request('GET', '/regression');
    assert.strictEqual(regLibraryPage.status, 200, 'Regression library page /regression must return 200 OK');
    const allRegressions = await request('GET', '/api/regressions');
    assert.strictEqual(allRegressions.status, 200);
    const linkedReg = allRegressions.body.find(r => r.session_id === createdSessionId);
    assert(linkedReg, `Regression library must contain the synthesized test for session ${createdSessionId}`);
    assert.strictEqual(linkedReg.status, 'passing');
    console.log(`  - Found synthesized regression test: ${linkedReg.test_name} (ID: ${linkedReg.id})`);

    // Execute test run on demand
    const testRunRes = await request('POST', `/api/regressions/${linkedReg.id}/run`);
    assert.strictEqual(testRunRes.status, 200);
    assert.strictEqual(testRunRes.body.test_result.exit_code, 0);
    assert.strictEqual(testRunRes.body.regression.execution_count, 2);
    console.log('  -> Step 9 Passed: Regression library contains test, on-demand execution succeeded with Exit 0.\n');

    // Step 10: Refresh the page and verify that persisted data remains available
    console.log('[Step 10] Refresh the page and verify that persisted data remains available...');
    // Simulate server reboot / reload by re-instantiating the database from disk
    const dbFilePath = path.join(__dirname, '..', 'data', 'really_db.json');
    assert(fs.existsSync(dbFilePath), 'Database file data/really_db.json must exist on disk');
    const rawDiskData = JSON.parse(fs.readFileSync(dbFilePath, 'utf8'));

    const persistedSession = rawDiskData.sessions.find(s => s.id === createdSessionId);
    assert(persistedSession, `Session ${createdSessionId} must exist in persistent disk storage`);
    assert.strictEqual(persistedSession.title, sampleBugReport.title);
    assert.strictEqual(persistedSession.status, 'verified');

    const persistedAnalysis = rawDiskData.analyses[createdSessionId];
    assert(persistedAnalysis, `Analysis for session ${createdSessionId} must persist on disk`);

    const persistedReproduction = rawDiskData.reproductions[createdSessionId];
    assert(persistedReproduction, `Reproduction for session ${createdSessionId} must persist on disk`);

    const persistedFix = rawDiskData.fixes[createdSessionId];
    assert(persistedFix, `Fix for session ${createdSessionId} must persist on disk`);

    const persistedReg = rawDiskData.regressions.find(r => r.session_id === createdSessionId);
    assert(persistedReg, `Regression test for session ${createdSessionId} must persist on disk`);

    console.log('  -> Step 10 Passed: Persistent storage verified across sessions, analyses, reproductions, fixes, and regression tests.\n');

    console.log('======================================================');
    console.log('AUDIT RESULT: ALL 10 USER JOURNEY STEPS FULLY VERIFIED');
    console.log('======================================================\n');
  } finally {
    server.close();
  }
}

runUserJourney().catch(err => {
  console.error('User Journey Audit Failed:', err);
  if (server) server.close();
  process.exit(1);
});
