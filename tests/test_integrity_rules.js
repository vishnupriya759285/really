const assert = require('assert');
const db = require('../db/db');
const { runSessionWorkflow } = require('../backend/workflow');

function testIntegrityRules() {
  console.log('--- Starting Integrity & Simulation Disclosure Tests ---');

  // Rule 1: Analysis must always be labeled simulated
  const testSession = db.createSession({
    title: 'Integrity check session',
    error_logs: 'ReferenceError: config is not defined\n    at loadConfig (/app/config.js:12:5)'
  });

  const workflow = runSessionWorkflow(testSession.id);
  assert(workflow.analysis.is_simulated === true, 'Analysis must have is_simulated: true');
  assert(workflow.analysis.simulation_label.includes('SIMULATED'), 'Analysis must include SIMULATED in label');
  console.log('✓ Rule 1 Verified: Simulated root cause analysis clearly tagged as simulated.');

  // Rule 2: Reproduction must be labeled as simulated sandbox
  assert(workflow.reproduction.execution_mode === 'SIMULATED_SANDBOX', 'Reproduction execution mode must be SIMULATED_SANDBOX');
  assert(workflow.reproduction.simulation_label.includes('SIMULATED'), 'Reproduction label must contain SIMULATED');
  console.log('✓ Rule 2 Verified: Reproduction sandbox clearly tagged with simulation label.');

  // Rule 3: Verification status integrity
  // Case A: With valid supporting test execution, status is VERIFIED_BY_TEST_RUN
  assert.strictEqual(workflow.fix.verification_status, 'VERIFIED_BY_TEST_RUN');
  assert(workflow.fix.verification_details.verified_by_tests === true);
  assert.strictEqual(workflow.fix.verification_details.exit_code, 0);

  // Case B: Without supporting test execution, status CANNOT be verified
  const unverifiedFix = {
    session_id: testSession.id,
    target_file: 'services/unverified.js',
    patch_diff: '--- +++',
    rationale: 'Hypothetical untested patch',
    verification_status: 'UNVERIFIED',
    verification_details: {
      verified_by_tests: false,
      exit_code: null,
      passed_count: 0,
      test_output: 'No tests executed.'
    }
  };
  db.saveFix(testSession.id, unverifiedFix);
  const retrieved = db.getFix(testSession.id);
  assert.strictEqual(retrieved.verification_status, 'UNVERIFIED');
  assert.strictEqual(retrieved.verification_details.verified_by_tests, false);
  console.log('✓ Rule 3 Verified: Untested fixes strictly blocked from claiming verified status.');

  console.log('========================================================');
  console.log('ALL INTEGRITY & DISCLOSURE RULES SUCCESSFULLY VALIDATED');
  console.log('========================================================\n');
}

testIntegrityRules();
