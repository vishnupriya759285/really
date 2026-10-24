/**
 * BugTwin Universal Client SDK for External Websites
 * Embed in any website: <script src="http://localhost:5500/bugtwin-sdk.js"></script>
 */
(function(window) {
  const BUGTWIN_ENDPOINT = 'http://localhost:5500/api/ingest';
  const breadcrumbs = [];

  // Zero-Trust Client-Side Masking
  function sanitize(val) {
    if (!val) return val;
    if (typeof val === 'string') {
      return val
        .replace(/Bearer\s+[a-zA-Z0-9._~+/-]+=*/gi, 'Bearer [REDACTED_TOKEN]')
        .replace(/eyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+/g, '[REDACTED_JWT]')
        .replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, 'u***@domain.com')
        .replace(/\b(?:\d{4}[ -]?){3}\d{4}\b/g, '[REDACTED_CARD]');
    }
    if (typeof val === 'object') {
      const copy = Array.isArray(val) ? [] : {};
      for (const [k, v] of Object.entries(val)) {
        if (/password|secret|token|key|card|cvv/i.test(k)) {
          copy[k] = '[REDACTED_SECRET]';
        } else {
          copy[k] = sanitize(v);
        }
      }
      return copy;
    }
    return val;
  }

  // Intercept Console Logs for Breadcrumbs
  const origLog = console.log;
  const origError = console.error;
  console.log = function(...args) {
    breadcrumbs.push({ type: 'log', time: Date.now(), msg: sanitize(args.join(' ')) });
    if (breadcrumbs.length > 25) breadcrumbs.shift();
    origLog.apply(console, args);
  };
  console.error = function(...args) {
    breadcrumbs.push({ type: 'error', time: Date.now(), msg: sanitize(args.join(' ')) });
    if (breadcrumbs.length > 25) breadcrumbs.shift();
    origError.apply(console, args);
  };

  // Intercept Global Errors
  window.addEventListener('error', function(event) {
    sendTrace({
      type: 'uncaught_exception',
      message: event.message,
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno,
      stack: event.error ? event.error.stack : `${event.message} at ${event.filename}:${event.lineno}`
    });
  });

  window.addEventListener('unhandledrejection', function(event) {
    const reason = event.reason;
    sendTrace({
      type: 'unhandled_rejection',
      message: reason && reason.message ? reason.message : String(reason),
      stack: reason && reason.stack ? reason.stack : String(reason)
    });
  });

  // Intercept Fetch API to record failed network calls
  const origFetch = window.fetch;
  window.fetch = async function(...args) {
    const url = typeof args[0] === 'string' ? args[0] : (args[0] && args[0].url) || '';
    const options = args[1] || {};
    try {
      const response = await origFetch.apply(this, args);
      if (!response.ok && response.status >= 400) {
        breadcrumbs.push({
          type: 'network_fail',
          time: Date.now(),
          msg: `HTTP ${response.status} on ${sanitize(url)}`
        });
      }
      return response;
    } catch (fetchErr) {
      breadcrumbs.push({
        type: 'network_crash',
        time: Date.now(),
        msg: `Fetch failed to ${sanitize(url)}: ${fetchErr.message}`
      });
      throw fetchErr;
    }
  };

  function sendTrace(errorData) {
    const payload = {
      appName: document.title || window.location.hostname,
      url: window.location.href,
      userAgent: navigator.userAgent,
      error: sanitize(errorData),
      breadcrumbs: breadcrumbs.slice(-15),
      timestamp: Date.now()
    };

    // Send asynchronously without blocking the user
    if (navigator.sendBeacon) {
      navigator.sendBeacon(BUGTWIN_ENDPOINT, JSON.stringify(payload));
    } else {
      fetch(BUGTWIN_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        keepalive: true
      }).catch(() => {});
    }

    console.warn('[BugTwin] Sanitized execution trace dispatched to BugTwin engine.');
  }

  window.__bugtwin = { sendTrace, sanitize };
})(window);
