// NovaPay Client Storefront Application & Bug Dispatcher
const cart = [
  { name: 'DevTwin Autonomous QA Agent', price: 49.00, quantity: 1, taxRate: { multiplier: 0.08 } },
  { name: 'Cloud GPU Inference Pod (A100)', price: 199.00, quantity: 1, taxRate: { multiplier: 0.08 } }
];

function updateCartUI() {
  const list = document.getElementById('cart-items-list');
  const countSpan = document.getElementById('cart-count');
  const subtotalSpan = document.getElementById('cart-subtotal');
  const taxSpan = document.getElementById('cart-tax');
  const totalSpan = document.getElementById('cart-total');
  const checkoutBtnSpan = document.getElementById('checkout-total-btn');

  if (!list) return;

  countSpan.innerText = cart.length;

  if (cart.length === 0) {
    list.innerHTML = `<p style="font-size: 13px; color: #64748b; text-align: center; margin: 10px 0;">Cart is empty.</p>`;
    subtotalSpan.innerText = '$0.00';
    taxSpan.innerText = '$0.00';
    totalSpan.innerText = '$0.00';
    checkoutBtnSpan.innerText = '0.00';
    return;
  }

  let subtotal = 0;
  let tax = 0;

  list.innerHTML = cart.map((item, idx) => {
    subtotal += item.price * item.quantity;
    const rate = item.taxRate ? item.taxRate.multiplier : 0;
    tax += (item.price * item.quantity) * rate;

    return `
      <div class="cart-item-row">
        <span>${escapeHtml(item.name)} (x${item.quantity})</span>
        <div style="display: flex; align-items: center; gap: 10px;">
          <strong>$${(item.price * item.quantity).toFixed(2)}</strong>
          <button style="background: none; border: none; color: #f43f5e; cursor: pointer;" onclick="removeFromCart(${idx})">✕</button>
        </div>
      </div>
    `;
  }).join('');

  const total = subtotal + tax;
  subtotalSpan.innerText = `$${subtotal.toFixed(2)}`;
  taxSpan.innerText = `$${tax.toFixed(2)}`;
  totalSpan.innerText = `$${total.toFixed(2)}`;
  checkoutBtnSpan.innerText = total.toFixed(2);
}

function addToCart(name, price, taxRateMultiplier) {
  cart.push({
    name,
    price,
    quantity: 1,
    taxRate: { multiplier: taxRateMultiplier }
  });
  updateCartUI();
}

function removeFromCart(idx) {
  cart.splice(idx, 1);
  updateCartUI();
}

function clearCart() {
  cart.length = 0;
  updateCartUI();
}

async function performNormalCheckout() {
  if (cart.length === 0) {
    alert("Cart is empty! Please add items first.");
    return;
  }

  try {
    const res = await fetch('/api/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items: cart })
    });
    const data = await res.json();
    if (res.ok) {
      alert(`Success! Order confirmed. Transaction ID: #${Date.now().toString(16)}`);
    } else {
      openTelemetryModal();
    }
  } catch (err) {
    openTelemetryModal();
  }
}

// Bug Trigger 1: Checkout Tax Crash
async function triggerCheckoutCrash() {
  console.warn("Initiating checkout with malformed tax payload (boundary condition trigger)...");
  try {
    // Deliberately pass item missing taxRate multiplier to trigger TypeError
    const badPayload = {
      items: [{ name: 'Zero-rated Special Promo', price: 10.00, taxRate: undefined }]
    };

    let errorData = null;
    try {
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(badPayload)
      });

      if (!res.ok) {
        errorData = await res.json().catch(() => null);
      }
    } catch (netErr) {
      // Static Cloudflare Pages hosting or network boundary
    }

    if (!errorData) {
      // Simulate/trigger authentic client-side exception if running on static Cloudflare Pages
      try {
        const targetItem = badPayload.items[0];
        const multiplier = targetItem.taxRate.multiplier; // Triggers TypeError: Cannot read properties of undefined (reading 'multiplier')
        console.log(multiplier);
      } catch (clientErr) {
        errorData = {
          error: clientErr.name || 'TypeError',
          message: clientErr.message,
          stack: clientErr.stack,
          component: 'checkout-calculator',
          file: 'services/checkout.js:112:28'
        };
      }
    }

    console.error("Checkout service error caught:", errorData);
    openTelemetryModal(errorData);
  } catch (outerErr) {
    openTelemetryModal();
  }
}

// Bug Trigger 2: Webhook Crash
async function triggerWebhookCrash() {
  console.warn("Dispatching simulated Stripe payment webhook missing customer_id...");
  try {
    let errorData = null;
    try {
      const res = await fetch('/api/webhooks/stripe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: 'evt_simulated_fail_921',
          type: 'invoice.payment_failed',
          data: { object: {} } // Missing customer!
        })
      });

      if (!res.ok) {
        errorData = await res.json().catch(() => null);
      }
    } catch (netErr) {}

    if (!errorData) {
      try {
        const payload = { data: { object: {} } };
        const customerId = payload.data.object.customer.customer_id;
        console.log(customerId);
      } catch (clientErr) {
        errorData = {
          error: "TypeError: Cannot read properties of undefined (reading 'customer_id')",
          message: clientErr.message,
          stack: `TypeError: Cannot read properties of undefined (reading 'customer_id')\n    at handleInvoicePaymentFailed (/app/services/billing.js:142:32)\n    at processWebhookEvent (/app/services/webhook.js:58:11)`,
          component: 'billing-service',
          file: 'services/billing.js:142:32'
        };
      }
    }

    openTelemetryModal(errorData);
  } catch (err) {
    openTelemetryModal();
  }
}

// Bug Trigger 3: Auth Race Condition
async function triggerRaceCondition() {
  console.warn("Dispatching concurrent token refresh requests...");
  try {
    let errorData = null;
    try {
      const res = await fetch('/api/auth/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ simulateConflict: true })
      });

      if (!res.ok) {
        errorData = await res.json().catch(() => null);
      }
    } catch (netErr) {}

    if (!errorData) {
      errorData = {
        error: 'SessionTokenConflictError: Concurrent refresh token rotation detected for user_942',
        message: 'Optimistic lock version mismatch: expected revision 4, found 5',
        stack: `SessionTokenConflictError: Concurrent refresh token rotation detected\n    at rotateSessionToken (/app/services/auth.js:89:14)\n    at handleTokenRefresh (/app/services/auth.js:42:9)`,
        component: 'auth-service',
        file: 'services/auth.js:89:14'
      };
    }

    openTelemetryModal(errorData);
  } catch (err) {
    openTelemetryModal();
  }
}

// Bug Trigger 4: SQL Query Offset Error
async function triggerSqlError() {
  console.warn("Requesting analytics report with negative offset (page=-1)...");
  try {
    let errorData = null;
    try {
      const res = await fetch('/api/analytics?page=-1');
      if (!res.ok) {
        errorData = await res.json().catch(() => null);
      }
    } catch (netErr) {}

    if (!errorData) {
      errorData = {
        error: 'DatabaseQuerySyntaxError: OFFSET must not be negative',
        message: 'Invalid pagination offset: -10',
        stack: `DatabaseQuerySyntaxError: syntax error at or near "-10"\n    at executeQuery (/app/services/analytics.js:77:22)\n    at getDailySalesReport (/app/services/analytics.js:29:10)`,
        component: 'analytics-reporter',
        file: 'services/analytics.js:77:22'
      };
    }

    openTelemetryModal(errorData);
  } catch (err) {
    openTelemetryModal();
  }
}

// Modal management
function openTelemetryModal(specificError = null) {
  const modal = document.getElementById('telemetry-modal');
  const tracker = window.TelemetryTracker;

  if (specificError) {
    tracker.recordError({
      name: specificError.error || 'ServerRuntimeError',
      message: specificError.message || 'Operation failed on server',
      stack: specificError.stack || specificError.message
    });
  }

  const currentTarget = window.TelemetryTracker.getServerUrl();
  document.getElementById('modal-error-title').innerText = tracker.lastError?.name || 'Client Runtime Exception';
  document.getElementById('modal-stack-trace').innerText = tracker.lastError?.stack || tracker.lastError?.message || 'No stack trace';
  document.getElementById('modal-network-logs').innerText = JSON.stringify(tracker.networkLogs.slice(0, 5), null, 2);
  document.getElementById('modal-console-logs').innerText = tracker.consoleLogs.slice(0, 10).join('\n') || 'No console logs';
  document.getElementById('modal-breadcrumbs').innerText = tracker.breadcrumbs.join('\n') || 'No user actions recorded';

  const modalTargetElem = document.getElementById('modal-target-url');
  if (modalTargetElem) modalTargetElem.innerText = `${currentTarget}/api/telemetry`;

  modal.style.display = 'flex';
}

function closeTelemetryModal() {
  document.getElementById('telemetry-modal').style.display = 'none';
}

// Transmit to Really / BugTwin Server (Dynamic Localhost or Cloudflare URL)
async function transmitTelemetryToReally() {
  const btn = document.getElementById('btn-send-to-really');
  const targetServer = window.TelemetryTracker.getServerUrl();

  btn.disabled = true;
  btn.innerText = `Transmitting Telemetry to Gemini Bot (${targetServer})...`;

  try {
    const res = await window.TelemetryTracker.sendToReallyServer(targetServer);
    closeTelemetryModal();

    // Show Success Toast
    const toast = document.getElementById('toast-success');
    const toastMsg = document.getElementById('toast-msg');
    const toastLink = document.getElementById('toast-link');

    toastMsg.innerText = `Session ${res.session_id} created on ${targetServer}. ${res.bot_analysis?.powered_by || 'Gemini Bot'} analyzed root cause, generated reproduction steps, and drafted code diff.`;
    toastLink.href = `${targetServer}/sessions/${res.session_id}`;
    toast.style.display = 'block';

    // Auto-open Really session in new tab
    window.open(`${targetServer}/sessions/${res.session_id}`, '_blank');
  } catch (err) {
    alert(`Failed to transmit to BugTwin server (${targetServer}): ${err.message}.\n\nPlease ensure BugTwin is running, or click "⚙️ Change" in the header to point to your hosted Cloudflare URL.`);
  } finally {
    btn.disabled = false;
    btn.innerText = "🚀 Send to Really Bot Server →";
  }
}

// Server Configuration Modal Management
function openServerConfigModal() {
  const modal = document.getElementById('server-config-modal');
  if (!modal) return;
  const current = window.TelemetryTracker.getServerUrl();
  const input = document.getElementById('config-server-input');
  if (input) {
    input.value = current;
    setTimeout(() => input.focus(), 50);
  }
  const resultDiv = document.getElementById('connection-test-result');
  if (resultDiv) resultDiv.style.display = 'none';
  modal.style.display = 'flex';
}

function closeServerConfigModal() {
  const modal = document.getElementById('server-config-modal');
  if (modal) modal.style.display = 'none';
}

function setPresetServer(url) {
  const input = document.getElementById('config-server-input');
  if (input) {
    input.value = url;
    input.focus();
  }
}

async function testConnectionFromModal() {
  const input = document.getElementById('config-server-input');
  const resultDiv = document.getElementById('connection-test-result');
  const url = input.value.trim().replace(/\/+$/, '');

  resultDiv.style.display = 'block';
  resultDiv.style.background = '#1e293b';
  resultDiv.style.color = '#94a3b8';
  resultDiv.innerHTML = `Testing connection to <code>${escapeHtml(url)}/api/health</code>...`;

  const health = await window.TelemetryTracker.checkHealth(url);
  if (health.online) {
    resultDiv.style.background = 'rgba(16, 185, 129, 0.15)';
    resultDiv.style.color = '#34d399';
    resultDiv.style.border = '1px solid rgba(16, 185, 129, 0.3)';
    resultDiv.innerHTML = `✓ Connected successfully (${health.latency}ms latency). Server is online!`;
  } else {
    resultDiv.style.background = 'rgba(244, 63, 94, 0.15)';
    resultDiv.style.color = '#f87171';
    resultDiv.style.border = '1px solid rgba(244, 63, 94, 0.3)';
    resultDiv.innerHTML = `✕ Connection failed: ${escapeHtml(health.error || `HTTP ${health.status}`)}. Verify CORS or check if the server is running.`;
  }
}

function saveServerConfigFromModal() {
  const input = document.getElementById('config-server-input');
  const url = input.value.trim().replace(/\/+$/, '');
  if (!url) {
    alert("Please enter a valid server URL.");
    return;
  }
  window.TelemetryTracker.setServerUrl(url);
  refreshServerDisplay();
  closeServerConfigModal();
}

async function refreshServerDisplay() {
  const current = window.TelemetryTracker.getServerUrl();
  const link = document.getElementById('server-status-link');
  const dot = document.getElementById('server-status-dot');
  if (link) {
    link.href = current;
    link.innerText = current;
  }

  // Probe health
  if (dot) {
    dot.style.background = '#f59e0b'; // pending
    const health = await window.TelemetryTracker.checkHealth(current);
    if (health.online) {
      dot.style.background = '#10b981';
      dot.style.boxShadow = '0 0 8px #10b981';
    } else {
      dot.style.background = '#f43f5e';
      dot.style.boxShadow = '0 0 8px #f43f5e';
    }
  }
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// Global window exposure for inline and external calls
window.openServerConfigModal = openServerConfigModal;
window.closeServerConfigModal = closeServerConfigModal;
window.setPresetServer = setPresetServer;
window.testConnectionFromModal = testConnectionFromModal;
window.saveServerConfigFromModal = saveServerConfigFromModal;
window.refreshServerDisplay = refreshServerDisplay;
window.openTelemetryModal = openTelemetryModal;
window.closeTelemetryModal = closeTelemetryModal;
window.transmitTelemetryToReally = transmitTelemetryToReally;

document.addEventListener('DOMContentLoaded', () => {
  updateCartUI();
  refreshServerDisplay();

  // Explicit event listener binding as backup
  const cfgBtn = document.getElementById('btn-open-server-config');
  if (cfgBtn) {
    cfgBtn.addEventListener('click', (e) => {
      e.preventDefault();
      openServerConfigModal();
    });
  }

  // Close modals on Escape key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeServerConfigModal();
      closeTelemetryModal();
    }
  });
});
