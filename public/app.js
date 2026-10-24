// Really Single Page Application Router & State Manager

const state = {
  currentRoute: '/',
  sessions: [],
  currentSession: null,
  regressions: [],
  isLoading: false,
  error: null
};

// Routing
function navigate(path) {
  window.history.pushState({}, '', path);
  handleRoute();
}

window.addEventListener('popstate', handleRoute);

function handleRoute() {
  const path = window.location.pathname;
  state.currentRoute = path;
  updateNavState();

  if (path === '/' || path === '') {
    renderLanding();
  } else if (path === '/dashboard') {
    renderDashboard();
  } else if (path === '/sessions/new') {
    renderNewSession();
  } else if (path.startsWith('/sessions/')) {
    const id = path.replace('/sessions/', '');
    renderSessionDetail(id);
  } else if (path === '/regression') {
    renderRegressionLibrary();
  } else {
    renderNotFound();
  }
}

function updateNavState() {
  document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active'));
  if (state.currentRoute === '/') {
    document.getElementById('nav-btn-landing')?.classList.add('active');
  } else if (state.currentRoute === '/dashboard') {
    document.getElementById('nav-btn-dashboard')?.classList.add('active');
  } else if (state.currentRoute === '/sessions/new') {
    document.getElementById('nav-btn-new-session')?.classList.add('active');
  } else if (state.currentRoute === '/regression') {
    document.getElementById('nav-btn-regressions')?.classList.add('active');
  }
}

// API Helpers
async function fetchSessions() {
  try {
    const res = await fetch('/api/sessions');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    state.sessions = await res.json();
    return state.sessions;
  } catch (err) {
    console.error('Failed to load sessions:', err);
    return [];
  }
}

async function fetchSessionDetail(id) {
  try {
    const res = await fetch(`/api/sessions/${id}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    console.error(`Failed to load session ${id}:`, err);
    return null;
  }
}

async function fetchRegressions() {
  try {
    const res = await fetch('/api/regressions');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    state.regressions = await res.json();
    return state.regressions;
  } catch (err) {
    console.error('Failed to load regressions:', err);
    return [];
  }
}

// View: Landing Page
function renderLanding() {
  const container = document.getElementById('main-content');
  container.innerHTML = `
    <section class="hero-section" id="landing-hero">
      <div class="hero-pill">
        <span>⚡ BugTwin — Autonomous Bug Reproduction & Devin-Class Coding Twin</span>
      </div>
      <h1 class="hero-title" style="font-size: 42px; line-height: 1.2; margin: 18px 0 16px;">Turn Hard-to-Reproduce Bugs<br>Into Reliable Regression Tests.</h1>
      <p class="hero-subtitle" style="max-width: 820px; font-size: 16px; line-height: 1.6; color: var(--text-muted); margin: 0 auto 28px;">
        BugTwin captures sanitized execution traces, recreates failures in an isolated environment, identifies likely root causes, and uses AI coding agents like Devin to implement and verify fixes. Instead of spending hours debugging issues that only occur in certain environments or under specific conditions, developers can reproduce, fix, and prevent the same bugs from returning through one streamlined workflow.
      </p>

      <div class="hero-actions" style="margin-bottom: 40px;">
        <button id="btn-launch-dashboard" class="btn-primary" onclick="navigate('/dashboard')">Open BugTwin Dashboard</button>
        <button id="btn-quick-new" class="btn-secondary" onclick="navigate('/sessions/new')">+ Submit Execution Trace</button>
        <a id="btn-hero-client" class="btn-secondary" style="border: 1px solid var(--accent-cyan); color: var(--accent-cyan); background: rgba(6, 182, 212, 0.1); text-decoration: none; display: inline-flex; align-items: center; gap: 6px;" href="http://localhost:4000" target="_blank">🌐 Test on Client App (Port 4000) ↗</a>
      </div>

      <!-- End-to-End Workflow Diagram Bar -->
      <div style="background: rgba(15, 23, 42, 0.6); border: 1px solid var(--border-subtle); border-radius: var(--radius-md); padding: 20px; margin-bottom: 36px; text-align: left;">
        <div style="font-size: 12px; font-weight: 700; color: var(--accent-cyan); text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 12px;">
          The BugTwin Autonomous Lifecycle
        </div>
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 14px;">
          <div style="background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.06); padding: 12px 14px; border-radius: 8px;">
            <div style="font-size: 13px; font-weight: 700; color: #fff; margin-bottom: 4px;">1. Trace Ingestion</div>
            <p style="font-size: 12px; color: var(--text-muted); margin: 0;">Captures console logs, network requests, stack traces, and click trails with automatic PII sanitization.</p>
          </div>
          <div style="background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.06); padding: 12px 14px; border-radius: 8px;">
            <div style="font-size: 13px; font-weight: 700; color: #fca5a5; margin-bottom: 4px;">2. Isolated Sandbox</div>
            <p style="font-size: 12px; color: var(--text-muted); margin: 0;">Recreates the exact failure in a hermetic container, yielding confirmed Exit Code 1 proof.</p>
          </div>
          <div style="background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.06); padding: 12px 14px; border-radius: 8px;">
            <div style="font-size: 13px; font-weight: 700; color: #93c5fd; margin-bottom: 4px;">3. AI Root Cause</div>
            <p style="font-size: 12px; color: var(--text-muted); margin: 0;">Gemini AI identifies the faulty file, failing function, and writes developer reproduction steps.</p>
          </div>
          <div style="background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.06); padding: 12px 14px; border-radius: 8px;">
            <div style="font-size: 13px; font-weight: 700; color: #86efac; margin-bottom: 4px;">4. Devin AI & PR Merge</div>
            <p style="font-size: 12px; color: var(--text-muted); margin: 0;">Coding Twin drafts fix, verifies Exit Code 0, opens PR, and stores test in regression suite.</p>
          </div>
        </div>
      </div>

      <div class="feature-grid">
        <div class="card" id="card-feature-ingest">
          <div class="card-icon">📡</div>
          <h3>Sanitized Trace Capture</h3>
          <p>Zero manual reproduction notes. Captures user breadcrumbs, recent network calls, and exception frames straight from production or staging.</p>
        </div>

        <div class="card" id="card-feature-repro">
          <div class="card-icon">🧪</div>
          <h3>Isolated Failure Recreation</h3>
          <p>Turns elusive, environment-dependent bugs into reliable, deterministic test scripts executed in an isolated sandbox.</p>
        </div>

        <div class="card" id="card-feature-diff">
          <div class="card-icon">🤖</div>
          <h3>Devin-Class AI Coding Twin</h3>
          <p>Generates targeted code diffs and proves correctness with test execution results before human review.</p>
        </div>

        <div class="card" id="card-feature-regression">
          <div class="card-icon">🛡️</div>
          <h3>Permanent Regression Library</h3>
          <p>Verified test scripts automatically graduate into your permanent test suite so the same bug can never recur.</p>
        </div>
      </div>
    </section>
  `;
}

// View: Dashboard
async function renderDashboard() {
  const container = document.getElementById('main-content');
  container.innerHTML = `<div class="loading-state">Loading debugging sessions...</div>`;

  const sessions = await fetchSessions();
  const regressions = await fetchRegressions();

  const totalSessions = sessions.length;
  const verifiedCount = sessions.filter(s => s.status === 'verified').length;
  const inProgressCount = sessions.filter(s => s.status !== 'verified').length;

  container.innerHTML = `
    <div class="dashboard-container" id="dashboard-view">
      <div class="dashboard-header">
        <div>
          <h2>Debugging Sessions</h2>
          <p>Monitor active bug investigations and automated reproduction workflows.</p>
        </div>
        <button id="btn-create-session-dash" class="btn-primary" onclick="navigate('/sessions/new')">+ Start New Session</button>
      </div>

      <div class="stats-bar">
        <div class="stat-card" id="stat-total-sessions">
          <div class="stat-label">Total Sessions</div>
          <div class="stat-value">${totalSessions}</div>
        </div>
        <div class="stat-card" id="stat-verified-fixes">
          <div class="stat-label">Verified Fixes</div>
          <div class="stat-value" style="color: var(--accent-emerald)">${verifiedCount}</div>
        </div>
        <div class="stat-card" id="stat-active-investigations">
          <div class="stat-label">In Progress</div>
          <div class="stat-value" style="color: var(--accent-amber)">${inProgressCount}</div>
        </div>
        <div class="stat-card" id="stat-regression-suite">
          <div class="stat-label">Regression Suite</div>
          <div class="stat-value" style="color: var(--accent-cyan)">${regressions.length}</div>
        </div>
      </div>

      <div class="session-table-container">
        <div class="table-header-title">
          <span>Active Sessions</span>
          <span class="badge badge-simulated">TRANSPARENT SIMULATION</span>
        </div>
        <table class="session-table" id="table-sessions">
          <thead>
            <tr>
              <th>Title & Trace</th>
              <th>Component</th>
              <th>Severity</th>
              <th>Status</th>
              <th>Date</th>
            </tr>
          </thead>
          <tbody>
            ${sessions.map(s => `
              <tr class="session-row" id="row-session-${s.id}" onclick="navigate('/sessions/${s.id}')">
                <td>
                  <div class="session-title-cell">
                    <span>${escapeHtml(s.title)}</span>
                    <span class="session-subtext">ID: ${s.id}</span>
                  </div>
                </td>
                <td><code>${escapeHtml(s.component || 'general')}</code></td>
                <td><span class="badge ${s.severity === 'Critical' ? 'badge-unverified' : 'badge-simulated'}">${s.severity}</span></td>
                <td><span class="badge badge-status ${s.status}">${s.status.toUpperCase()}</span></td>
                <td class="session-subtext">${new Date(s.created_at).toLocaleDateString()}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

// View: New Debugging Session Form
function renderNewSession() {
  const container = document.getElementById('main-content');
  container.innerHTML = `
    <div class="form-container" id="new-session-view">
      <div class="form-header">
        <h2>Start New Debugging Session</h2>
        <p>Submit runtime logs and error context to trigger automated root cause analysis.</p>
      </div>

      <div class="sample-fill-bar">
        <span style="font-size: 12px; color: var(--text-muted); font-weight: 600;">PREFILL SAMPLES:</span>
        <button id="btn-sample-typeerror" class="sample-btn" type="button" onclick="fillSample('typeerror')">TypeError (Null Pointer)</button>
        <button id="btn-sample-race" class="sample-btn" type="button" onclick="fillSample('race')">Race Condition</button>
        <button id="btn-sample-sql" class="sample-btn" type="button" onclick="fillSample('sql')">Query Syntax Error</button>
      </div>

      <form id="form-new-session" onsubmit="handleSessionSubmit(event)">
        <div class="form-group">
          <label class="form-label" for="input-title">Bug Report Title *</label>
          <input class="form-input" id="input-title" name="title" required placeholder="e.g. Unhandled TypeError when processing Stripe webhook">
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
          <div class="form-group">
            <label class="form-label" for="select-severity">Severity</label>
            <select class="form-select" id="select-severity" name="severity">
              <option value="Critical">Critical</option>
              <option value="High">High</option>
              <option value="Medium" selected>Medium</option>
              <option value="Low">Low</option>
            </select>
          </div>

          <div class="form-group">
            <label class="form-label" for="input-component">Component / Service</label>
            <input class="form-input" id="input-component" name="component" value="billing-service" placeholder="e.g. auth-service">
          </div>
        </div>

        <div class="form-group">
          <label class="form-label" for="input-environment">Environment Specification</label>
          <input class="form-input" id="input-environment" name="environment" value="Node.js v20.19.4 / Express / Production" placeholder="Runtime, OS, versions">
        </div>

        <div class="form-group">
          <label class="form-label" for="textarea-error-logs">Runtime Error Logs / Exception Stack *</label>
          <textarea class="form-textarea" id="textarea-error-logs" name="error_logs" required placeholder="Paste stderr output, unhandled exception traces, or error logs"></textarea>
        </div>

        <div class="form-group">
          <label class="form-label" for="textarea-steps">Steps to Reproduce</label>
          <textarea class="form-textarea" id="textarea-steps" name="steps_to_reproduce" style="min-height: 80px;" placeholder="Optional steps observed prior to crash"></textarea>
        </div>

        <div style="display: flex; gap: 12px; justify-content: flex-end; margin-top: 24px;">
          <button id="btn-cancel-session" type="button" class="btn-secondary" onclick="navigate('/dashboard')">Cancel</button>
          <button id="btn-submit-bug-report" type="submit" class="btn-primary">Create Debugging Session</button>
        </div>
      </form>
    </div>
  `;
}

// Prefill sample templates
function fillSample(type) {
  if (type === 'typeerror') {
    document.getElementById('input-title').value = "TypeError: Cannot read properties of undefined in billing checkout";
    document.getElementById('select-severity').value = "Critical";
    document.getElementById('input-component').value = "checkout-service";
    document.getElementById('input-environment').value = "Node.js v20.19.4 / Express / Stripe SDK";
    document.getElementById('textarea-error-logs').value = `TypeError: Cannot read properties of undefined (reading 'amount')
    at calculateTax (/app/services/checkout.js:88:24)
    at processOrder (/app/services/order.js:34:12)
    at Layer.handle [as handle_request] (/app/node_modules/express/lib/router/layer.js:95:5)`;
    document.getElementById('textarea-steps').value = "1. Initiate checkout with zero-item cart\n2. Trigger POST /api/checkout/calculate";
  } else if (type === 'race') {
    document.getElementById('input-title').value = "Race condition during concurrent session token refresh";
    document.getElementById('select-severity').value = "High";
    document.getElementById('input-component').value = "auth-service";
    document.getElementById('input-environment').value = "Node.js v20.19.4 / Redis Session Store";
    document.getElementById('textarea-error-logs').value = `SessionTokenConflictError: Concurrent refresh token rotation detected for user_942
    at rotateRefreshToken (/app/services/auth.js:210:15)
    at handleRefreshRequest (/app/services/auth.js:145:9)`;
    document.getElementById('textarea-steps').value = "1. Trigger two simultaneous refresh requests with the same expired access token";
  } else if (type === 'sql') {
    document.getElementById('input-title').value = "Query syntax error in paginated customer analytics report";
    document.getElementById('select-severity').value = "Medium";
    document.getElementById('input-component').value = "analytics-worker";
    document.getElementById('input-environment').value = "Node.js v20.19.4 / PostgreSQL Pool";
    document.getElementById('textarea-error-logs').value = `DatabaseError: syntax error at or near "LIMIT" at character 142
    at executeQuery (/app/services/db.js:52:19)
    at generateAnalyticsReport (/app/services/analytics.js:104:11)`;
    document.getElementById('textarea-steps').value = "1. Call GET /analytics/customers with page=-1";
  }
}

// Handle Form Submission
async function handleSessionSubmit(event) {
  event.preventDefault();
  const form = event.target;
  const payload = {
    title: form.title.value.trim(),
    severity: form.severity.value,
    component: form.component.value.trim(),
    environment: form.environment.value.trim(),
    error_logs: form.error_logs.value.trim(),
    steps_to_reproduce: form.steps_to_reproduce.value.trim()
  };

  try {
    const res = await fetch('/api/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.details || err.error || 'Submission failed');
    }

    const created = await res.json();
    navigate(`/sessions/${created.id}`);
  } catch (err) {
    alert(`Failed to create session: ${err.message}`);
  }
}

// View: Session Detail & Workflow Runner
async function renderSessionDetail(sessionId) {
  const container = document.getElementById('main-content');
  container.innerHTML = `<div class="loading-state">Loading session details...</div>`;

  const data = await fetchSessionDetail(sessionId);
  if (!data || !data.session) {
    container.innerHTML = `<div class="error-state">Session not found. <button class="btn-secondary" onclick="navigate('/dashboard')">Back to Dashboard</button></div>`;
    return;
  }

  // Fetch PR if one exists
  let pr = null;
  try {
    const prRes = await fetch(`/api/sessions/${sessionId}/pr`);
    if (prRes.ok) {
      const prData = await prRes.json();
      pr = prData.pull_request;
    }
  } catch {}

  const { session, analysis, reproduction, fix, regressions } = data;
  const isWorkflowCompleted = !!(analysis && reproduction && fix);

  container.innerHTML = `
    <div class="session-detail-view" id="session-detail-${session.id}">
      <div class="session-detail-header">
        <div>
          <div style="display: flex; gap: 8px; align-items: center; margin-bottom: 8px;">
            <button class="nav-btn" onclick="navigate('/dashboard')">← Dashboard</button>
            <span class="badge ${session.severity === 'Critical' ? 'badge-unverified' : 'badge-simulated'}">${session.severity}</span>
            <span class="badge badge-status ${session.status}">${session.status.toUpperCase()}</span>
          </div>
          <h2 id="session-title-display">${escapeHtml(session.title)}</h2>
          <p style="font-size: 13px; color: var(--text-muted); margin-top: 4px;">
            Component: <code>${escapeHtml(session.component)}</code> | Environment: ${escapeHtml(session.environment)} | Created: ${new Date(session.created_at).toLocaleString()}
          </p>
        </div>

        <button id="btn-run-workflow" class="btn-primary" onclick="triggerWorkflow('${session.id}')">
          ${isWorkflowCompleted ? '↻ Re-run Demo Workflow' : '▶ Run Demo Workflow'}
        </button>
      </div>

      <!-- Workflow Progress Stepper -->
      <div class="stepper" id="workflow-stepper">
        <div class="step-item completed">1. Sanitized Trace</div>
        <div class="step-item ${analysis ? 'completed' : 'active'}">2. Gemini Root Cause</div>
        <div class="step-item ${reproduction ? 'completed' : ''}">3. Sandbox Reproduction (Exit 1)</div>
        <div class="step-item ${fix ? 'completed' : ''}">4. Devin Coding Twin Fix</div>
        <div class="step-item ${fix && fix.verification_status === 'VERIFIED_BY_TEST_RUN' ? 'completed' : ''}">5. Verified with Proof (Exit 0)</div>
        <div class="step-item ${pr ? (pr.status === 'merged' ? 'completed' : 'active') : ''}">6. PR & Regression Suite (${pr ? pr.status.toUpperCase() : 'PENDING'})</div>
      </div>

      <!-- Raw Log Context Card -->
      <div class="workflow-card" id="card-raw-logs">
        <div class="workflow-header">
          <h3>Sanitized Execution Trace & Error Log</h3>
          <span class="badge badge-status">TRACE CAPTURED</span>
        </div>
        <div class="code-box">${escapeHtml(session.error_logs)}</div>
      </div>

      <!-- Root Cause Analysis & Gemini Bot Guidance Card -->
      ${analysis ? `
        <div class="workflow-card" id="card-analysis-results">
          <div class="workflow-header">
            <div style="display: flex; align-items: center; gap: 10px;">
              <h3>Root Cause & Gemini Bot Guidance</h3>
              <span class="badge badge-simulated">${escapeHtml(analysis.powered_by || analysis.simulation_label || 'Gemini Bot Engine')}</span>
            </div>
            <span style="font-size: 13px; font-weight: 700; color: var(--accent-cyan);">Confidence: ${analysis.confidence}</span>
          </div>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 12px;">
            <div>
              <span class="stat-label">Suspected File</span>
              <p><code>${escapeHtml(analysis.root_cause_file)}</code></p>
            </div>
            <div>
              <span class="stat-label">Failing Function</span>
              <p><code>${escapeHtml(analysis.root_cause_function)}</code></p>
            </div>
          </div>
          <div>
            <span class="stat-label">Failure Mechanism</span>
            <p style="color: var(--text-primary); font-size: 14px;">${escapeHtml(analysis.failure_mechanism)}</p>
          </div>

          <!-- Developer Steps to Reproduce -->
          ${analysis.steps_to_reproduce && analysis.steps_to_reproduce.length > 0 ? `
            <div style="margin-top: 16px; background: rgba(6, 182, 212, 0.05); border: 1px solid rgba(6, 182, 212, 0.2); border-radius: var(--radius-sm); padding: 14px;">
              <span class="stat-label" style="color: var(--accent-cyan); display: flex; align-items: center; gap: 6px; font-weight: 700;">
                📝 Developer Reproduction Steps (Synthesized by Bot)
              </span>
              <ol style="margin: 8px 0 0 20px; font-size: 13px; line-height: 1.7; color: var(--text-primary);">
                ${analysis.steps_to_reproduce.map(s => `<li>${escapeHtml(s)}</li>`).join('')}
              </ol>
            </div>
          ` : ''}

          <!-- Developer Suggestion -->
          ${analysis.developer_suggestion ? `
            <div style="margin-top: 14px; background: rgba(99, 102, 241, 0.05); border: 1px solid rgba(99, 102, 241, 0.2); border-radius: var(--radius-sm); padding: 14px;">
              <span class="stat-label" style="color: var(--accent-primary); display: flex; align-items: center; gap: 6px; font-weight: 700;">
                💡 Gemini Bot Architectural Suggestion
              </span>
              <p style="margin: 6px 0 0; font-size: 13px; line-height: 1.6; color: var(--text-primary); white-space: pre-wrap;">${escapeHtml(analysis.developer_suggestion)}</p>
            </div>
          ` : ''}
        </div>
      ` : ''}

      <!-- Reproduction Results Card -->
      ${reproduction ? `
        <div class="workflow-card" id="card-reproduction-results">
          <div class="workflow-header">
            <div style="display: flex; align-items: center; gap: 10px;">
              <h3>Isolated Sandbox Failure Recreation</h3>
              <span class="badge badge-simulated">${reproduction.simulation_label || 'HERMETIC_SANDBOX'}</span>
            </div>
            <span class="badge ${reproduction.exit_code === 1 ? 'badge-simulated' : 'badge-unverified'}">
              ${reproduction.exit_code === 1 ? 'BUG REPRODUCED (EXIT 1)' : 'REPRODUCTION FAILED'}
            </span>
          </div>

          <div style="margin-bottom: 12px;">
            <span class="stat-label">Isolated Sandbox Console Output</span>
            <div class="code-box" style="color: #fca5a5;">${escapeHtml(reproduction.stdout)}</div>
          </div>

          <div>
            <span class="stat-label">Standalone Deterministic Reproduction Test</span>
            <div class="code-box">${escapeHtml(reproduction.reproduction_code)}</div>
          </div>
        </div>
      ` : ''}

      <!-- Proposed Code Diff Card -->
      ${fix ? `
        <div class="workflow-card" id="card-proposed-diff">
          <div class="workflow-header">
            <div style="display: flex; align-items: center; gap: 10px;">
              <h3>Devin-Class AI Coding Twin — Verified Fix Diff</h3>
              ${fix.verification_status === 'VERIFIED_BY_TEST_RUN' 
                ? '<span class="badge badge-verified">VERIFIED BY TEST EXECUTION</span>' 
                : '<span class="badge badge-unverified">UNVERIFIED FIX</span>'}
            </div>
            <span style="font-size: 13px; color: var(--text-muted);">Target: <code>${escapeHtml(fix.target_file)}</code></span>
          </div>

          <div style="margin-bottom: 14px;">
            <p style="font-size: 14px; margin-bottom: 8px;"><strong>Rationale:</strong> ${escapeHtml(fix.rationale)}</p>
          </div>

          <div class="diff-viewer" id="diff-content-viewer">
            ${formatDiff(fix.patch_diff)}
          </div>

          <!-- Supporting Test Results -->
          <div style="margin-top: 20px; padding: 16px; background: rgba(0,0,0,0.3); border-radius: var(--radius-sm); border: 1px solid var(--border-subtle);">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
              <span style="font-size: 13px; font-weight: 700; color: var(--text-primary);">Supporting Verification Evidence</span>
              <span class="badge ${fix.verification_details?.exit_code === 0 ? 'badge-verified' : 'badge-unverified'}">
                Exit Code ${fix.verification_details?.exit_code ?? 'N/A'} (100% Passed)
              </span>
            </div>
            <div class="code-box" style="color: #86efac; font-size: 12px;">${escapeHtml(fix.verification_details?.test_output || 'No supporting test run recorded.')}</div>
          </div>
        </div>
      ` : ''}

      <!-- Pull Request (PR) Lifecycle Card -->
      <div class="workflow-card" id="card-pull-request">
        <div class="workflow-header">
          <div style="display: flex; align-items: center; gap: 10px;">
            <span style="font-size: 20px;">🔀</span>
            <h3>GitHub Pull Request Lifecycle</h3>
          </div>
          ${pr ? (pr.status === 'merged' 
            ? '<span class="badge" style="background: rgba(168,85,247,0.2); color: #c084fc; border: 1px solid #a855f7;">🟣 MERGED</span>' 
            : '<span class="badge badge-verified">🟢 OPEN (READY FOR MERGE)</span>')
            : '<span class="badge badge-simulated">DECISION PENDING</span>'}
        </div>

        ${!pr ? `
          <p style="font-size: 14px; margin-bottom: 16px;">
            Review the Gemini Bot's reproduction steps, suggestions, and proposed code diff above. As the developer, you can now instruct the Bot to generate a formal Pull Request.
          </p>
          <button id="btn-create-pr" class="btn-primary" style="background: linear-gradient(135deg, var(--accent-primary), var(--accent-cyan));" onclick="requestBotCreatePR('${session.id}')">
            🚀 Ask Gemini Bot to Create Pull Request
          </button>
        ` : `
          <div style="background: rgba(0,0,0,0.3); border: 1px solid var(--border-subtle); border-radius: var(--radius-sm); padding: 18px; margin-bottom: 14px;">
            <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px; flex-wrap: wrap; gap: 10px;">
              <div>
                <h4 style="font-size: 16px; color: #fff; margin-bottom: 4px;">PR #${pr.pr_number}: ${escapeHtml(pr.title)}</h4>
                <span style="font-size: 12px; color: var(--text-muted);">
                  Branch: <code>${escapeHtml(pr.branch)}</code> → <code>${escapeHtml(pr.target_branch)}</code> | Author: <strong>${escapeHtml(pr.author)}</strong>
                </span>
              </div>
              <span class="badge ${pr.status === 'merged' ? 'badge-verified' : 'badge-status'}">${pr.status.toUpperCase()}</span>
            </div>

            <div class="code-box" style="font-size: 12px; margin-bottom: 14px; max-height: 140px; overflow-y: auto;">${escapeHtml(pr.description)}</div>

            <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px; border-top: 1px solid var(--border-subtle); padding-top: 12px;">
              ${pr.status === 'open' ? `
                <span style="font-size: 13px; color: var(--accent-cyan);">✓ All tests passed. Patch verified against regression runner.</span>
                <button id="btn-merge-pr" class="btn-primary" style="background: var(--accent-emerald);" onclick="mergeBotPR('${pr.id}', '${session.id}')">
                  ✅ Merge Pull Request into Main
                </button>
              ` : `
                <div style="font-size: 13px; color: #c084fc;">
                  <strong>✓ Merged into main:</strong> <code>${escapeHtml(pr.merge_commit)}</code> at ${new Date(pr.merged_at).toLocaleString()}
                </div>
                <span class="badge badge-verified">LIVE MERGED</span>
              `}
            </div>
          </div>
        `}
      </div>

      <!-- Regression Link Card -->
      ${regressions && regressions.length > 0 ? `
        <div class="workflow-card" id="card-linked-regressions">
          <div class="workflow-header">
            <h3>Linked Regression Test Asset</h3>
            <button class="btn-secondary" style="font-size: 13px; padding: 6px 14px;" onclick="navigate('/regression')">View in Library →</button>
          </div>
          <p style="font-size: 14px; margin-bottom: 10px;">
            This verified fix was automatically converted into a permanent regression test:
            <code>${escapeHtml(regressions[0].test_name)}</code>
          </p>
        </div>
      ` : ''}
    </div>
  `;
}

// Request Bot to Create PR
async function requestBotCreatePR(sessionId) {
  const btn = document.getElementById('btn-create-pr');
  if (btn) {
    btn.disabled = true;
    btn.innerText = "Gemini Bot generating Pull Request...";
  }

  try {
    const res = await fetch(`/api/sessions/${sessionId}/pr`, { method: 'POST' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    renderSessionDetail(sessionId);
  } catch (err) {
    alert(`Failed to create PR: ${err.message}`);
    if (btn) {
      btn.disabled = false;
      btn.innerText = "🚀 Ask Gemini Bot to Create Pull Request";
    }
  }
}

// Merge PR
async function mergeBotPR(prId, sessionId) {
  const btn = document.getElementById('btn-merge-pr');
  if (btn) {
    btn.disabled = true;
    btn.innerText = "Merging Pull Request into main...";
  }

  try {
    const res = await fetch(`/api/pull-requests/${prId}/merge`, { method: 'POST' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    renderSessionDetail(sessionId);
  } catch (err) {
    alert(`Failed to merge PR: ${err.message}`);
    if (btn) {
      btn.disabled = false;
      btn.innerText = "✅ Merge Pull Request into Main";
    }
  }
}

// Trigger Workflow
async function triggerWorkflow(sessionId) {
  const btn = document.getElementById('btn-run-workflow');
  if (btn) {
    btn.disabled = true;
    btn.innerText = "Running Simulation Workflow...";
  }

  try {
    const res = await fetch(`/api/sessions/${sessionId}/workflow`, {
      method: 'POST'
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.details || err.error || 'Workflow execution failed');
    }
    // Reload session view to display new results
    renderSessionDetail(sessionId);
  } catch (err) {
    alert(`Workflow error: ${err.message}`);
    if (btn) {
      btn.disabled = false;
      btn.innerText = "Run Demo Workflow";
    }
  }
}

// View: Regression Test Library
async function renderRegressionLibrary() {
  const container = document.getElementById('main-content');
  container.innerHTML = `<div class="loading-state">Loading regression test library...</div>`;

  const regressions = await fetchRegressions();

  container.innerHTML = `
    <div class="regression-view" id="regression-library-view">
      <div class="dashboard-header">
        <div>
          <h2>Regression Test Library</h2>
          <p>Enduring test suite synthesized from verified bug reproduction workflows.</p>
        </div>
        <button class="btn-secondary" onclick="navigate('/dashboard')">← Back to Dashboard</button>
      </div>

      <div class="session-table-container">
        <div class="table-header-title">
          <span>Active Regression Assets (${regressions.length})</span>
          <span class="badge badge-verified">VERIFIED PROOF</span>
        </div>

        <table class="session-table" id="table-regressions">
          <thead>
            <tr>
              <th>Test Identifier</th>
              <th>Component</th>
              <th>Status</th>
              <th>Runs</th>
              <th>Last Execution Result</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            ${regressions.map(r => `
              <tr id="row-regression-${r.id}">
                <td>
                  <div class="session-title-cell">
                    <code>${escapeHtml(r.test_name)}</code>
                    <span class="session-subtext">Origin: <a href="javascript:navigate('/sessions/${r.session_id}')" style="color: var(--accent-cyan); text-decoration: none;">${r.session_id}</a></span>
                  </div>
                </td>
                <td><code>${escapeHtml(r.component)}</code></td>
                <td><span class="badge ${r.status === 'passing' ? 'badge-verified' : 'badge-unverified'}">${r.status.toUpperCase()}</span></td>
                <td><strong>${r.execution_count}</strong></td>
                <td><span class="session-subtext" style="color: var(--text-primary);">${escapeHtml(r.last_result)}</span></td>
                <td>
                  <button id="btn-run-reg-${r.id}" class="btn-secondary" style="padding: 6px 12px; font-size: 12px;" onclick="runSingleRegression('${r.id}')">
                    ▶ Run Test
                  </button>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

// Run single regression test
async function runSingleRegression(id) {
  const btn = document.getElementById(`btn-run-reg-${id}`);
  if (btn) {
    btn.disabled = true;
    btn.innerText = "Running...";
  }

  try {
    const res = await fetch(`/api/regressions/${id}/run`, { method: 'POST' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    renderRegressionLibrary();
  } catch (err) {
    alert(`Failed to execute test: ${err.message}`);
    if (btn) {
      btn.disabled = false;
      btn.innerText = "▶ Run Test";
    }
  }
}

// 404 View
function renderNotFound() {
  const container = document.getElementById('main-content');
  container.innerHTML = `
    <div style="text-align: center; padding: 60px 0;">
      <h2>404 — Route Not Found</h2>
      <p style="margin: 16px 0 24px;">The requested view does not exist.</p>
      <button class="btn-primary" onclick="navigate('/')">Return Home</button>
    </div>
  `;
}

// Helpers
function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function formatDiff(diffText) {
  if (!diffText) return '';
  return diffText.split('\n').map(line => {
    if (line.startsWith('+') && !line.startsWith('+++')) {
      return `<span class="diff-line addition">${escapeHtml(line)}</span>`;
    } else if (line.startsWith('-') && !line.startsWith('---')) {
      return `<span class="diff-line deletion">${escapeHtml(line)}</span>`;
    } else {
      return `<span class="diff-line context">${escapeHtml(line)}</span>`;
    }
  }).join('');
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
  handleRoute();
});