// Telemetry & Error Capture SDK for Client Website
// Automatically captures JS exceptions, network traces, console logs, and user breadcrumbs.

const TelemetryTracker = {
  consoleLogs: [],
  networkLogs: [],
  breadcrumbs: [],
  lastError: null,

  init() {
    // 1. Intercept console logs
    const origLog = console.log;
    const origWarn = console.warn;
    const origError = console.error;

    console.log = (...args) => {
      this.recordConsole('LOG', args);
      origLog.apply(console, args);
    };
    console.warn = (...args) => {
      this.recordConsole('WARN', args);
      origWarn.apply(console, args);
    };
    console.error = (...args) => {
      this.recordConsole('ERROR', args);
      origError.apply(console, args);
    };

    // 2. Intercept global JS runtime exceptions
    window.addEventListener('error', (event) => {
      this.recordError({
        name: event.error?.name || 'Error',
        message: event.message,
        stack: event.error?.stack || `${event.filename}:${event.lineno}:${event.colno}`,
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno
      });
    });

    // 3. Intercept unhandled promise rejections
    window.addEventListener('unhandledrejection', (event) => {
      const err = event.reason;
      this.recordError({
        name: err?.name || 'UnhandledRejection',
        message: err?.message || String(err),
        stack: err?.stack || 'N/A'
      });
    });

    // 4. Intercept network fetch requests
    const origFetch = window.fetch;
    window.fetch = async (...args) => {
      const [url, options = {}] = args;
      const method = options.method || 'GET';
      const startTime = performance.now();
      const logEntry = {
        url: String(url),
        method,
        payload: options.body ? (typeof options.body === 'string' ? options.body : JSON.stringify(options.body)) : null,
        timestamp: new Date().toISOString()
      };

      try {
        const response = await origFetch.apply(window, args);
        const duration = Math.round(performance.now() - startTime);
        const clone = response.clone();
        let respText = '';
        try { respText = await clone.text(); } catch {}

        this.networkLogs.unshift({
          ...logEntry,
          status: response.status,
          statusText: response.statusText,
          duration_ms: duration,
          response_snippet: respText.substring(0, 300)
        });
        if (this.networkLogs.length > 25) this.networkLogs.pop();

        // If HTTP 4xx or 5xx, record as error telemetry
        if (!response.ok) {
          this.recordError({
            name: `HTTP_${response.status}_Error`,
            message: `Network request to ${url} failed with status ${response.status} (${response.statusText})`,
            stack: `FetchError: ${method} ${url} -> ${response.status}\nResponse: ${respText.substring(0, 200)}`
          });
        }

        return response;
      } catch (networkErr) {
        const duration = Math.round(performance.now() - startTime);
        this.networkLogs.unshift({
          ...logEntry,
          status: 0,
          error: networkErr.message,
          duration_ms: duration
        });
        this.recordError({
          name: 'NetworkFetchError',
          message: networkErr.message,
          stack: networkErr.stack || 'Network request failed'
        });
        throw networkErr;
      }
    };

    // 5. User interaction breadcrumbs
    document.addEventListener('click', (e) => {
      const target = e.target.closest('button, a, input, select');
      if (target) {
        const label = target.innerText?.trim() || target.id || target.name || target.tagName;
        this.breadcrumbs.unshift(`Clicked [${target.tagName.toLowerCase()}] "${label.substring(0, 30)}" at ${new Date().toLocaleTimeString()}`);
        if (this.breadcrumbs.length > 15) this.breadcrumbs.pop();
      }
    }, true);
  },

  recordConsole(level, args) {
    const text = args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ');
    this.consoleLogs.unshift(`[${new Date().toLocaleTimeString()}] [${level}] ${text.substring(0, 200)}`);
    if (this.consoleLogs.length > 30) this.consoleLogs.pop();
  },

  recordError(err) {
    this.lastError = {
      ...err,
      timestamp: new Date().toISOString()
    };
    if (typeof window.onTelemetryError === 'function') {
      window.onTelemetryError(this.lastError);
    }
  },

  getReportPayload(component = 'client-storefront') {
    return {
      title: this.lastError ? `${this.lastError.name}: ${this.lastError.message}` : 'Client-reported Telemetry Crash',
      error_name: this.lastError?.name || 'UnknownClientError',
      error_message: this.lastError?.message || 'Client triggered bug report',
      error_logs: this.lastError?.stack || this.lastError?.message || 'No stack trace captured',
      stack_trace: this.lastError?.stack || '',
      component,
      network_logs: [...this.networkLogs],
      console_logs: [...this.consoleLogs],
      user_breadcrumbs: [...this.breadcrumbs],
      environment: {
        browser: navigator.userAgent.split(' ')[0] || 'Browser',
        os: navigator.platform || 'Windows',
        viewport: `${window.innerWidth}x${window.innerHeight}`,
        page_url: window.location.href,
        user_agent: navigator.userAgent
      }
    };
  },

  // Dynamic server URL resolution (Localhost or Cloudflare hosted domain)
  getServerUrl() {
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const paramUrl = urlParams.get('bugtwin') || urlParams.get('server');
      if (paramUrl) {
        const clean = paramUrl.replace(/\/+$/, '');
        localStorage.setItem('bugtwin_server_url', clean);
        return clean;
      }
    } catch {}

    const stored = localStorage.getItem('bugtwin_server_url');
    if (stored) return stored.replace(/\/+$/, '');

    if (window.__BUG_TWIN_SERVER_URL__) {
      return window.__BUG_TWIN_SERVER_URL__.replace(/\/+$/, '');
    }

    return 'http://localhost:3000';
  },

  setServerUrl(newUrl) {
    if (!newUrl) return;
    const clean = newUrl.trim().replace(/\/+$/, '');
    localStorage.setItem('bugtwin_server_url', clean);
    return clean;
  },

  // Check health of BugTwin / Really server
  async checkHealth(targetUrl = null) {
    const base = targetUrl || this.getServerUrl();
    const startTime = performance.now();
    try {
      const res = await fetch(`${base}/api/health`, {
        method: 'GET',
        headers: { 'Accept': 'application/json' },
        cache: 'no-store'
      });
      const latency = Math.round(performance.now() - startTime);
      if (res.ok) {
        const data = await res.json();
        return { online: true, latency, data, base };
      }
      return { online: false, status: res.status, latency, base };
    } catch (err) {
      return { online: false, error: err.message, base };
    }
  },

  // Transmit telemetry to Really / BugTwin server (dynamic or Cloudflare-hosted)
  async sendToReallyServer(overrideUrl = null) {
    const reallyBaseUrl = overrideUrl || this.getServerUrl();
    const payload = this.getReportPayload();
    const res = await fetch(`${reallyBaseUrl}/api/telemetry`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.details || err.error || `HTTP ${res.status}`);
    }

    return await res.json();
  }
};

TelemetryTracker.init();
window.TelemetryTracker = TelemetryTracker;
