document.addEventListener('DOMContentLoaded', () => {
  // State
  let activeTrace = null;
  let activeFixResult = null;

  // Elements
  const agentStatusText = document.getElementById('agentStatusText');
  const btnReplay = document.getElementById('btnReplay');
  const btnRunFix = document.getElementById('btnRunFix');
  const btnApplyPatch = document.getElementById('btnApplyPatch');
  const traceIdEl = document.getElementById('traceId');
  const appNameEl = document.getElementById('appName');
  const traceStatusEl = document.getElementById('traceStatus');
  const sanitizerStatsEl = document.getElementById('sanitizerStats');
  const networkCallCountEl = document.getElementById('networkCallCount');
  const toastEl = document.getElementById('notificationToast');

  // Stage 1 elements
  const stage1Status = document.getElementById('stage1Status');
  const rcHeadline = document.getElementById('rcHeadline');
  const rcCategory = document.getElementById('rcCategory');
  const rcComponent = document.getElementById('rcComponent');
  const rcExplanation = document.getElementById('rcExplanation');
  const rcHypothesisBox = document.getElementById('rcHypothesisBox');
  const rcHypothesis = document.getElementById('rcHypothesis');

  // Stage 2 elements
  const stage2Status = document.getElementById('stage2Status');
  const testFilename = document.getElementById('testFilename');
  const testCodePreview = document.getElementById('testCodePreview');
  const btnCopyTest = document.getElementById('btnCopyTest');

  // Stage 3 elements
  const stage3Status = document.getElementById('stage3Status');
  const verificationStats = document.getElementById('verificationStats');
  const statIterations = document.getElementById('statIterations');
  const statPreFix = document.getElementById('statPreFix');
  const statPostFix = document.getElementById('statPostFix');
  const verificationLogs = document.getElementById('verificationLogs');

  // Console & Diff elements
  const consoleOutput = document.getElementById('consoleOutput');
  const btnClearConsole = document.getElementById('btnClearConsole');
  const diffViewer = document.getElementById('diffViewer');
  const diffFilePath = document.getElementById('diffFilePath');

  // Trace Inspector
  const errorMsgText = document.getElementById('errorMsgText');
  const errorStackText = document.getElementById('errorStackText');
  const networkList = document.getElementById('networkList');
  const breadcrumbsList = document.getElementById('breadcrumbsList');

  // Toast Helper
  function showToast(message, duration = 3000) {
    toastEl.textContent = message;
    toastEl.classList.add('show');
    setTimeout(() => {
      toastEl.classList.remove('show');
    }, duration);
  }

  // Append Console line
  function logConsole(message, type = 'stdout') {
    const line = document.createElement('div');
    line.className = `console-line ${type}`;
    line.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;
    consoleOutput.appendChild(line);
    consoleOutput.scrollTop = consoleOutput.scrollHeight;
  }

  // Tab Switching
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
      btn.classList.add('active');
      const target = document.getElementById(btn.dataset.tab);
      if (target) target.classList.add('active');
    });
  });

  // Load Status
  async function loadStatus() {
    try {
      const res = await fetch('/api/status');
      const data = await res.json();
      if (data.openAiConfigured) {
        agentStatusText.textContent = `OpenAI Ready (${data.model})`;
      } else {
        agentStatusText.textContent = `Offline Heuristic Engine`;
      }
    } catch {
      agentStatusText.textContent = 'Server Offline';
    }
  }

  // Load Trace
  async function loadTrace() {
    try {
      const res = await fetch('/api/trace');
      if (!res.ok) {
        traceIdEl.textContent = 'No active trace recorded';
        return;
      }
      const trace = await res.json();
      activeTrace = trace;

      traceIdEl.textContent = trace.traceId;
      appNameEl.textContent = trace.appName || 'Node.js App';
      traceStatusEl.textContent = trace.status.toUpperCase();
      traceStatusEl.className = `value badge ${trace.status}`;

      const s = trace.sanitizationSummary || { tokensMasked: 0, fieldsRedacted: 0 };
      sanitizerStatsEl.textContent = `${s.tokensMasked} tokens masked / ${s.fieldsRedacted} fields redacted`;
      networkCallCountEl.textContent = trace.networkCalls?.length || 0;

      // Populate Inspector
      if (trace.error) {
        errorMsgText.textContent = `${trace.error.name}: ${trace.error.message}`;
        errorStackText.textContent = trace.error.stack || 'No stack trace';
      }

      // Network Calls
      if (trace.networkCalls && trace.networkCalls.length > 0) {
        networkList.innerHTML = trace.networkCalls.map(call => `
          <div class="network-item">
            <div>
              <span class="net-method ${call.method}">${call.method}</span>
              <span class="code-val">${call.url}</span>
            </div>
            <div>
              <span class="badge ${call.status && call.status < 400 ? 'success' : 'failed'}">${call.status || 'ERR'}</span>
              <span class="dim" style="margin-left: 10px;">${call.durationMs || 0}ms</span>
            </div>
          </div>
        `).join('');
      }

      // Breadcrumbs
      if (trace.breadcrumbs && trace.breadcrumbs.length > 0) {
        breadcrumbsList.innerHTML = trace.breadcrumbs.map(bc => `
          <div class="network-item">
            <span class="badge ${bc.type === 'error' ? 'failed' : 'running'}">${bc.type.toUpperCase()}</span>
            <span style="flex:1; margin-left: 12px; font-size: 13px;">${bc.message}</span>
            <span class="dim">${new Date(bc.timestamp).toLocaleTimeString()}</span>
          </div>
        `).join('');
      }

      logConsole(`Loaded trace ${trace.traceId} with ${trace.networkCalls?.length || 0} network calls.`, 'system');
    } catch (err) {
      logConsole(`Failed to load trace: ${err.message}`, 'stderr');
    }
  }

  // Replay Button Action
  btnReplay.addEventListener('click', async () => {
    btnReplay.disabled = true;
    btnReplay.innerHTML = '🔁 Replaying in Sandbox...';
    logConsole('Triggering isolated sandbox replay...', 'system');

    try {
      const res = await fetch('/api/replay', { method: 'POST' });
      const data = await res.json();
      btnReplay.disabled = false;
      btnReplay.innerHTML = '<span class="btn-icon">🔁</span> Replay in Sandbox';

      if (data.reproduced) {
        showToast('✔ Bug reproduced successfully in isolated sandbox!');
        logConsole(`Reproduction confirmed! Process exited with code ${data.result.exitCode}`, 'stdout');
      } else {
        showToast('ℹ Process executed cleanly without crashing.');
        logConsole('Process exited with code 0.', 'stdout');
      }

      if (data.result.stdout) logConsole(data.result.stdout, 'stdout');
      if (data.result.stderr) logConsole(data.result.stderr, 'stderr');
    } catch (err) {
      btnReplay.disabled = false;
      btnReplay.innerHTML = '<span class="btn-icon">🔁</span> Replay in Sandbox';
      showToast('Replay error: ' + err.message);
      logConsole('Replay failed: ' + err.message, 'stderr');
    }
  });

  // Run AI Fix Pipeline
  btnRunFix.addEventListener('click', async () => {
    btnRunFix.disabled = true;
    btnRunFix.innerHTML = '✨ Running Autonomous Agent...';

    stage1Status.textContent = 'Analyzing...';
    stage1Status.className = 'badge running';
    stage2Status.textContent = 'Waiting';
    stage3Status.textContent = 'Waiting';

    logConsole('Starting BugTwin Multi-Stage AI Agent loop...', 'system');

    try {
      const res = await fetch('/api/fix', { method: 'POST' });
      const data = await res.json();

      btnRunFix.disabled = false;
      btnRunFix.innerHTML = '<span class="btn-icon">✨</span> Run AI Fix Pipeline';

      if (!res.ok) {
        throw new Error(data.error || 'Agent loop encountered an error');
      }

      activeFixResult = data;

      // Update Stage 1: Root Cause
      stage1Status.textContent = 'Completed';
      stage1Status.className = 'badge success';
      rcHeadline.textContent = data.analysis.summary;
      rcCategory.textContent = data.analysis.category;
      rcComponent.textContent = `${data.analysis.failingComponent || 'target'}:${data.analysis.failingLine || '?'}`;
      rcExplanation.textContent = data.analysis.explanation;
      if (data.analysis.reproductionHypothesis) {
        rcHypothesisBox.style.display = 'block';
        rcHypothesis.textContent = data.analysis.reproductionHypothesis;
      }

      // Update Stage 2: Regression Test
      stage2Status.textContent = 'Synthesized';
      stage2Status.className = 'badge success';
      testFilename.textContent = data.synthesizedTest.filename;
      testCodePreview.textContent = data.synthesizedTest.testCode;

      // Update Stage 3: Verification
      stage3Status.textContent = data.fixResult.success ? 'Verified Green' : 'Needs Review';
      stage3Status.className = data.fixResult.success ? 'badge success' : 'badge failed';
      verificationStats.style.display = 'grid';
      statIterations.textContent = data.fixResult.iterations;
      statPreFix.textContent = 'Failed (Confirmed)';
      statPostFix.textContent = data.fixResult.success ? 'Passed 100%' : 'Failed';

      verificationLogs.innerHTML = data.fixResult.verificationLogs
        .map(l => `<div class="log-entry">${l}</div>`)
        .join('');

      // Populate Diff
      if (data.fixResult.patches && data.fixResult.patches.length > 0) {
        const patch = data.fixResult.patches[0];
        diffFilePath.textContent = `${patch.filePath} (${patch.diffSummary})`;
        renderSimpleDiff(patch.originalContent, patch.patchedContent);
        btnApplyPatch.disabled = false;
      }

      showToast('✔ BugTwin synthesized test and verified patch in sandbox!');
      logConsole('Autonomous Agent loop completed successfully!', 'system');
    } catch (err) {
      btnRunFix.disabled = false;
      btnRunFix.innerHTML = '<span class="btn-icon">✨</span> Run AI Fix Pipeline';
      stage1Status.textContent = 'Failed';
      stage1Status.className = 'badge failed';
      showToast('Agent failed: ' + err.message);
      logConsole('Agent error: ' + err.message, 'stderr');
    }
  });

  // Render Diff
  function renderSimpleDiff(orig, patched) {
    const origLines = orig.split('\n');
    const patchedLines = patched.split('\n');

    let html = '';
    origLines.forEach((l, idx) => {
      if (!patchedLines.includes(l) && l.trim()) {
        html += `<div class="diff-line-removed">- ${escapeHtml(l)}</div>`;
      }
    });

    patchedLines.forEach((l, idx) => {
      if (!origLines.includes(l) && l.trim()) {
        html += `<div class="diff-line-added">+ ${escapeHtml(l)}</div>`;
      } else {
        html += `<div>  ${escapeHtml(l)}</div>`;
      }
    });

    diffViewer.innerHTML = html || '<div>Files are identical.</div>';
  }

  function escapeHtml(str) {
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  // Copy Test Code
  btnCopyTest.addEventListener('click', () => {
    navigator.clipboard.writeText(testCodePreview.textContent).then(() => {
      showToast('Test code copied to clipboard!');
    });
  });

  // Apply Patch
  btnApplyPatch.addEventListener('click', async () => {
    if (!activeFixResult) return;
    btnApplyPatch.disabled = true;
    btnApplyPatch.innerHTML = '✔ Applying...';

    try {
      const res = await fetch('/api/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patches: activeFixResult.fixResult.patches,
          testFile: activeFixResult.synthesizedTest.filename,
          testCode: activeFixResult.synthesizedTest.testCode
        })
      });

      const data = await res.json();
      btnApplyPatch.innerHTML = '✔ Applied to Codebase!';
      showToast('✔ Patches and regression test written to workspace!');
      logConsole('Applied verified fix directly to source files.', 'system');
    } catch (err) {
      btnApplyPatch.disabled = false;
      btnApplyPatch.innerHTML = '✔ Apply Patch to Codebase';
      showToast('Apply failed: ' + err.message);
    }
  });

  // Clear Console
  btnClearConsole.addEventListener('click', () => {
    consoleOutput.innerHTML = '<div class="console-line system">[BugTwin Console Cleared]</div>';
  });

  // Init
  loadStatus();
  loadTrace();
});
