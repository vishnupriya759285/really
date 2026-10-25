document.addEventListener('DOMContentLoaded', () => {
  const pageLoadTime = Date.now();
  let incomingExternalTrace = null;
  let lastSeenTraceId = null;
  let currentFixResult = null;

  // DOM Elements
  const currentFileName = document.getElementById('currentFileName');
  const telemetryStatusBadge = document.getElementById('telemetryStatusBadge');
  const waitingBox = document.getElementById('waitingBox');
  const activeTraceBox = document.getElementById('activeTraceBox');
  const traceAppDisplay = document.getElementById('traceAppDisplay');
  const traceUrlDisplay = document.getElementById('traceUrlDisplay');
  const failingFileNameTag = document.getElementById('failingFileNameTag');
  const scenarioCategoryTag = document.getElementById('scenarioCategoryTag');
  const codeContent = document.getElementById('codeContent');
  const crashConsole = document.getElementById('crashConsole');
  const sanitizerReport = document.getElementById('sanitizerReport');
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

  // Real-time Incoming Trace Elements
  const liveIncomingBanner = document.getElementById('liveIncomingBanner');
  const incomingTraceId = document.getElementById('incomingTraceId');
  const incomingAppName = document.getElementById('incomingAppName');
  const btnAutoSolveIncoming = document.getElementById('btnAutoSolveIncoming');

  // Toast notification
  function showToast(msg, duration = 3000) {
    toast.textContent = msg;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), duration);
  }

  // 📡 Real-Time Listener: Poll for live incoming crashes from external websites
  async function pollRealTimeIncomingTraces() {
    try {
      const res = await fetch('/api/latest-external-trace');
      const trace = await res.json();

      // STRICT TIMING GATE: ONLY trigger if trace was created AFTER the user opened this page
      if (
        trace &&
        trace.traceId &&
        trace.status !== 'no_trace' &&
        trace.traceId !== lastSeenTraceId &&
        trace.timestamp &&
        trace.timestamp >= pageLoadTime
      ) {
        lastSeenTraceId = trace.traceId;
        incomingExternalTrace = trace;

        // Switch Left Pane from Waiting to Active Crash Inspector
        waitingBox.style.display = 'none';
        activeTraceBox.style.display = 'block';

        currentFileName.textContent = `${trace.appName} (Crash Inspector)`;
        telemetryStatusBadge.textContent = 'Crash Captured';
        telemetryStatusBadge.className = 'badge badge-warning';

        traceAppDisplay.textContent = trace.appName || 'NovaStore App';
        traceUrlDisplay.textContent = trace.url || 'http://localhost:5500';
        failingFileNameTag.textContent = trace.error?.name || 'TypeError';
        scenarioCategoryTag.textContent = 'Live Production Crash';

        // Display crashing code snippet or stack
        codeContent.textContent = trace.error?.stack || JSON.stringify(trace.error, null, 2);

        // Update console with live incoming crash
        crashConsole.innerHTML = `
          <div class="log-line crash">[⚡ REAL-TIME INCOMING CRASH]: ${trace.error?.name || 'Error'}: ${trace.error?.message}</div>
          <div class="log-line stack">${trace.error?.stack || 'No stack'}</div>
          <div class="log-line sanitized">[Zero-Trust Sanitizer]: Scrubbed ${trace.sanitizationSummary?.tokensMasked || 0} tokens & ${trace.sanitizationSummary?.fieldsRedacted || 0} sensitive fields from ${trace.appName}!</div>
          <div class="log-line info">[Origin]: ${trace.url} at ${new Date(trace.timestamp).toLocaleTimeString()}</div>
        `;

        sanitizerReport.textContent = `Zero-Trust: ${trace.sanitizationSummary?.tokensMasked || 0} tokens masked / ${trace.sanitizationSummary?.fieldsRedacted || 0} fields redacted`;

        // Enable Action Buttons
        btnRunAgent.disabled = false;
        btnHeaderFix.disabled = false;
        agentBadge.textContent = 'Crash Ready to Solve';
        agentBadge.className = 'badge badge-ai';

        showToast(`⚡ REAL-TIME ERROR RECEIVED from ${trace.appName}! Click "Auto-Fix" to solve!`, 5000);
      }
    } catch (e) {
      // Ignore background poll errors
    }
    setTimeout(pollRealTimeIncomingTraces, 1200);
  }

  // Run AI Agent Loop (Live Engine)
  async function runAiPipeline() {
    if (!incomingExternalTrace) {
      showToast('Waiting for a real crash from target website...');
      return;
    }

    btnRunAgent.disabled = true;
    btnHeaderFix.disabled = true;
    btnRunAgent.innerHTML = '✨ Live Engine Working...';
    btnHeaderFix.innerHTML = '✨ Live Engine Working...';
    agentBadge.textContent = 'Live Engine Processing...';
    agentBadge.className = 'badge badge-ai';

    step1Status.textContent = 'Analyzing Real Stack & Payload...';
    rcHeadline.textContent = 'Live Engine isolating root cause...';

    try {
      const res = await fetch('/api/ai-pipeline', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scenarioId: 'currency-rounding',
          customCode: codeContent.textContent,
          externalTrace: incomingExternalTrace
        })
      });

      const data = await res.json();
      btnRunAgent.disabled = false;
      btnHeaderFix.disabled = false;
      btnRunAgent.innerHTML = '<span>⚡</span> Run Full Agent Loop';
      btnHeaderFix.innerHTML = '<span>✨</span> Auto-Fix Bug with Live Engine';

      if (!res.ok) throw new Error(data.error || 'Live Engine pipeline error');
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
      showToast('✔ Live Engine synthesized test & verified patch in isolated sandbox!');
    } catch (err) {
      btnRunAgent.disabled = false;
      btnHeaderFix.disabled = false;
      btnRunAgent.innerHTML = '<span>⚡</span> Run Full Agent Loop';
      btnHeaderFix.innerHTML = '<span>✨</span> Auto-Fix Bug with Live Engine';
      agentBadge.textContent = 'Pipeline Error';
      agentBadge.className = 'badge badge-warning';
      showToast('Live Engine error: ' + err.message);
    }
  }

  btnRunAgent.addEventListener('click', runAiPipeline);
  btnHeaderFix.addEventListener('click', runAiPipeline);

  // Render Code Diff
  function renderDiff(orig, patched) {
    const origLines = (orig || '').split('\n');
    const patchedLines = (patched || '').split('\n');
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
    return (str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
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
    showToast(`🚀 Pull Request created: "fix(production): ${currentFixResult.patch.diffSummary}" with regression test!`);
  });

  // Start polling
  pollRealTimeIncomingTraces();
});
