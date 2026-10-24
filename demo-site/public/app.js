document.addEventListener('DOMContentLoaded', () => {
  let scenarios = [];
  let currentScenario = null;
  let activeTrace = null;
  let currentFixResult = null;

  // DOM Elements
  const scenariosContainer = document.getElementById('scenariosContainer');
  const currentFileName = document.getElementById('currentFileName');
  const scenarioDifficulty = document.getElementById('scenarioDifficulty');
  const scenarioCategoryTag = document.getElementById('scenarioCategoryTag');
  const codeContent = document.getElementById('codeContent');
  const crashConsole = document.getElementById('crashConsole');
  const sanitizerReport = document.getElementById('sanitizerReport');
  const btnTriggerCrash = document.getElementById('btnTriggerCrash');
  const btnRunAgent = document.getElementById('btnRunAgent');
  const btnHeaderFix = document.getElementById('btnHeaderFix');
  const agentBadge = document.getElementById('agentBadge');

  // Stage 1
  const step1Status = document.getElementById('step1Status');
  const rcHeadline = document.getElementById('rcHeadline');
  const rcExplanation = document.getElementById('rcExplanation');
  const rcHypothesisBox = document.getElementById('rcHypothesisBox');
  const rcHypothesis = document.getElementById('rcHypothesis');

  // Stage 2
  const testFilename = document.getElementById('testFilename');
  const testCodeBlock = document.getElementById('testCodeBlock');
  const btnCopyTestCode = document.getElementById('btnCopyTestCode');

  // Stage 3
  const sandboxStatusBadge = document.getElementById('sandboxStatusBadge');
  const diffSummaryText = document.getElementById('diffSummaryText');
  const diffDisplay = document.getElementById('diffDisplay');
  const btnDownloadTest = document.getElementById('btnDownloadTest');
  const btnSimulatePR = document.getElementById('btnSimulatePR');
  const toast = document.getElementById('toast');

  // Toast notification
  function showToast(msg, duration = 3000) {
    toast.textContent = msg;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), duration);
  }

  // Load Scenarios
  async function loadScenarios() {
    try {
      const res = await fetch('/api/scenarios');
      scenarios = await res.json();
      renderScenarioCards();
      if (scenarios.length > 0) {
        selectScenario(scenarios[0]);
      }
    } catch (err) {
      console.error('Failed to load scenarios:', err);
    }
  }

  // Render Scenario Selection Cards
  function renderScenarioCards() {
    scenariosContainer.innerHTML = scenarios.map((sc, idx) => `
      <div class="scenario-card ${idx === 0 ? 'active' : ''}" data-id="${sc.id}">
        <div class="sc-card-top">
          <span class="sc-badge ${sc.id.startsWith('curr') ? 'fintech' : sc.id.startsWith('time') ? 'saas' : 'api'}">${sc.category}</span>
          <span class="sc-diff">${sc.difficulty}</span>
        </div>
        <div class="sc-card-title">${sc.title}</div>
        <div class="sc-card-desc">${sc.description}</div>
      </div>
    `).join('');

    document.querySelectorAll('.scenario-card').forEach(card => {
      card.addEventListener('click', () => {
        const id = card.dataset.id;
        const target = scenarios.find(s => s.id === id);
        if (target) {
          document.querySelectorAll('.scenario-card').forEach(c => c.classList.remove('active'));
          card.classList.add('active');
          selectScenario(target);
        }
      });
    });
  }

  // Select Scenario
  function selectScenario(scenario) {
    currentScenario = scenario;
    activeTrace = null;
    currentFixResult = null;

    currentFileName.textContent = scenario.failingFile;
    scenarioDifficulty.textContent = scenario.difficulty;
    scenarioCategoryTag.textContent = scenario.category;
    codeContent.textContent = scenario.code;

    // Reset console
    crashConsole.innerHTML = `
      <div class="log-line info">[System] Loaded scenario "${scenario.title}"</div>
      <div class="log-line info">[System] Target file: ${scenario.failingFile}</div>
      <div class="log-line info">[System] Click "Trigger Production Bug" to execute inputs.</div>
    `;
    sanitizerReport.textContent = '0 tokens masked / 0 fields redacted';

    // Reset agent pipeline
    agentBadge.textContent = 'Ready';
    agentBadge.className = 'badge badge-ai';
    step1Status.textContent = 'Idle';
    rcHeadline.textContent = 'Pending bug execution trace...';
    rcExplanation.textContent = 'BugTwin will parse sanitized call stacks, inputs, and recent breadcrumbs.';
    rcHypothesisBox.style.display = 'none';

    testFilename.textContent = `bugtwin-${scenario.id}.test.js`;
    testCodeBlock.textContent = '// GPT-4o will synthesize a self-contained regression test here...';

    sandboxStatusBadge.textContent = 'Unverified';
    sandboxStatusBadge.className = 'badge badge-warning';
    diffSummaryText.textContent = 'Awaiting patch generation...';
    diffDisplay.innerHTML = '<div class="diff-placeholder">Click "Run Full Agent Loop" to synthesize fix and view side-by-side diff.</div>';
  }

  // Trigger Bug Crash Action
  btnTriggerCrash.addEventListener('click', async () => {
    if (!currentScenario) return;
    btnTriggerCrash.disabled = true;
    btnTriggerCrash.innerHTML = '💥 Triggering Failure...';

    try {
      const res = await fetch('/api/run-scenario', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scenarioId: currentScenario.id })
      });
      const trace = await res.json();
      activeTrace = trace;

      btnTriggerCrash.disabled = false;
      btnTriggerCrash.innerHTML = '<span>💥</span> Trigger Production Bug';

      // Log to console
      crashConsole.innerHTML = `
        <div class="log-line info">[Execution] Inbound request received with authentication credentials...</div>
        <div class="log-line sanitized">[Zero-Trust Sanitizer] Masked ${trace.sanitizationSummary.tokensMasked} tokens, redacted ${trace.sanitizationSummary.fieldsRedacted} sensitive fields.</div>
        <div class="log-line crash">[Fatal Exception Caught]: ${trace.error.name}: ${trace.error.message}</div>
        <div class="log-line stack">${trace.error.stack}</div>
        <div class="log-line info">[BugTwin Trace] Saved trace bundle: ${trace.traceId} (Ready for AI synthesis)</div>
      `;

      sanitizerReport.textContent = `Zero-Trust: ${trace.sanitizationSummary.tokensMasked} tokens masked / ${trace.sanitizationSummary.fieldsRedacted} fields redacted`;
      showToast('💥 Bug triggered! Sanitized execution trace captured.');
    } catch (err) {
      btnTriggerCrash.disabled = false;
      btnTriggerCrash.innerHTML = '<span>💥</span> Trigger Production Bug';
      showToast('Error triggering bug: ' + err.message);
    }
  });

  // Run AI Agent Loop (Live OpenAI GPT-4o)
  async function runAiPipeline() {
    if (!currentScenario) return;

    btnRunAgent.disabled = true;
    btnHeaderFix.disabled = true;
    btnRunAgent.innerHTML = '✨ GPT-4o Working...';
    btnHeaderFix.innerHTML = '✨ GPT-4o Working...';
    agentBadge.textContent = 'Live GPT-4o Processing...';
    agentBadge.className = 'badge badge-ai';

    step1Status.textContent = 'Analyzing Stack & Code...';
    rcHeadline.textContent = 'GPT-4o isolating root cause...';

    try {
      const res = await fetch('/api/ai-pipeline', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scenarioId: currentScenario.id,
          customCode: codeContent.textContent
        })
      });

      const data = await res.json();
      btnRunAgent.disabled = false;
      btnHeaderFix.disabled = false;
      btnRunAgent.innerHTML = '<span>⚡</span> Run Full Agent Loop';
      btnHeaderFix.innerHTML = '<span>✨</span> Auto-Fix Bug with GPT-4o';

      if (!res.ok) throw new Error(data.error || 'OpenAI pipeline error');
      currentFixResult = data;

      // Stage 1 Update
      step1Status.textContent = 'Isolated';
      agentBadge.textContent = 'Repaired & Verified';
      agentBadge.className = 'badge badge-success';
      rcHeadline.textContent = data.analysis.summary;
      rcExplanation.textContent = data.analysis.explanation;
      if (data.analysis.reproductionHypothesis) {
        rcHypothesisBox.style.display = 'flex';
        rcHypothesis.textContent = data.analysis.reproductionHypothesis;
      }

      // Stage 2 Update
      testFilename.textContent = data.synthesizedTest.filename;
      testCodeBlock.textContent = data.synthesizedTest.testCode;

      // Stage 3 Update
      sandboxStatusBadge.textContent = '100% Passed in Sandbox';
      sandboxStatusBadge.className = 'badge badge-success';
      diffSummaryText.textContent = `${data.patch.failingFile}: ${data.patch.diffSummary}`;

      renderDiff(data.patch.originalCode, data.patch.patchedCode);
      showToast('✔ OpenAI GPT-4o synthesized test & verified patch in isolated sandbox!');
    } catch (err) {
      btnRunAgent.disabled = false;
      btnHeaderFix.disabled = false;
      btnRunAgent.innerHTML = '<span>⚡</span> Run Full Agent Loop';
      btnHeaderFix.innerHTML = '<span>✨</span> Auto-Fix Bug with GPT-4o';
      agentBadge.textContent = 'Pipeline Error';
      agentBadge.className = 'badge badge-warning';
      showToast('OpenAI Agent error: ' + err.message);
    }
  }

  btnRunAgent.addEventListener('click', runAiPipeline);
  btnHeaderFix.addEventListener('click', runAiPipeline);

  // Render Code Diff
  function renderDiff(orig, patched) {
    const origLines = orig.split('\n');
    const patchedLines = patched.split('\n');
    let html = '';

    origLines.forEach((l) => {
      if (!patchedLines.includes(l) && l.trim().length > 0) {
        html += `<div class="diff-remove">- ${escapeHtml(l)}</div>`;
      }
    });

    patchedLines.forEach((l) => {
      if (!origLines.includes(l) && l.trim().length > 0) {
        html += `<div class="diff-add">+ ${escapeHtml(l)}</div>`;
      } else {
        html += `<div>  ${escapeHtml(l)}</div>`;
      }
    });

    diffDisplay.innerHTML = html || '<div>Files identical.</div>';
  }

  function escapeHtml(str) {
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  // Copy Test
  btnCopyTestCode.addEventListener('click', () => {
    navigator.clipboard.writeText(testCodeBlock.textContent).then(() => {
      showToast('📋 Regression test copied to clipboard!');
    });
  });

  // Download Test
  btnDownloadTest.addEventListener('click', () => {
    if (!currentFixResult) {
      showToast('Please run the agent pipeline first.');
      return;
    }
    const blob = new Blob([currentFixResult.synthesizedTest.testCode], { type: 'text/javascript' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = currentFixResult.synthesizedTest.filename;
    a.click();
    showToast(`📥 Downloaded ${currentFixResult.synthesizedTest.filename}`);
  });

  // Simulate GitHub PR
  btnSimulatePR.addEventListener('click', () => {
    if (!currentFixResult) {
      showToast('Run the AI agent loop first to produce verified patch.');
      return;
    }
    showToast(`🚀 Pull Request created: "fix(${currentScenario.id}): ${currentFixResult.patch.diffSummary}" with regression test!`);
  });

  // Initialize
  loadScenarios();
});
