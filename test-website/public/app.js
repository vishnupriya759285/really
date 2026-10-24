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

    const res = await fetch('/api/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(badPayload)
    });

    if (!res.ok) {
      const errData = await res.json();
      console.error("Checkout service error response:", errData);
      openTelemetryModal(errData);
    }
  } catch (networkErr) {
    openTelemetryModal();
  }
}

// Bug Trigger 2: Webhook Crash
async function triggerWebhookCrash() {
  console.warn("Dispatching simulated Stripe payment webhook missing customer_id...");
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
      const errData = await res.json();
      openTelemetryModal(errData);
    }
  } catch (err) {
    openTelemetryModal();
  }
}

// Bug Trigger 3: Auth Race Condition
async function triggerRaceCondition() {
  console.warn("Dispatching concurrent token refresh requests...");
  try {
    const res = await fetch('/api/auth/refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ simulateConflict: true })
    });

    if (!res.ok) {
      const errData = await res.json();
      openTelemetryModal(errData);
    }
  } catch (err) {
    openTelemetryModal();
  }
}

// Bug Trigger 4: SQL Query Offset Error
async function triggerSqlError() {
  console.warn("Requesting analytics report with negative offset (page=-1)...");
  try {
    const res = await fetch('/api/analytics?page=-1');
    if (!res.ok) {
      const errData = await res.json();
      openTelemetryModal(errData);
    }
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

  document.getElementById('modal-error-title').innerText = tracker.lastError?.name || 'Client Runtime Exception';
  document.getElementById('modal-stack-trace').innerText = tracker.lastError?.stack || tracker.lastError?.message || 'No stack trace';
  document.getElementById('modal-network-logs').innerText = JSON.stringify(tracker.networkLogs.slice(0, 5), null, 2);
  document.getElementById('modal-console-logs').innerText = tracker.consoleLogs.slice(0, 10).join('\n') || 'No console logs';
  document.getElementById('modal-breadcrumbs').innerText = tracker.breadcrumbs.join('\n') || 'No user actions recorded';

  modal.style.display = 'flex';
}

function closeTelemetryModal() {
  document.getElementById('telemetry-modal').style.display = 'none';
}

// Transmit to Really Server (Port 3000)
async function transmitTelemetryToReally() {
  const btn = document.getElementById('btn-send-to-really');
  btn.disabled = true;
  btn.innerText = "Transmitting Telemetry to Gemini Bot (Port 3000)...";

  try {
    const res = await window.TelemetryTracker.sendToReallyServer('http://localhost:3000');
    closeTelemetryModal();

    // Show Success Toast
    const toast = document.getElementById('toast-success');
    const toastMsg = document.getElementById('toast-msg');
    const toastLink = document.getElementById('toast-link');

    toastMsg.innerText = `Session ${res.session_id} created on Port 3000. ${res.bot_analysis?.powered_by || 'Gemini Bot'} analyzed root cause, generated reproduction steps, and drafted code diff.`;
    toastLink.href = `http://localhost:3000/sessions/${res.session_id}`;
    toast.style.display = 'block';

    // Auto-open Really session in new tab
    window.open(`http://localhost:3000/sessions/${res.session_id}`, '_blank');
  } catch (err) {
    alert(`Failed to transmit to Really server (http://localhost:3000): ${err.message}. Is Really server running on port 3000?`);
  } finally {
    btn.disabled = false;
    btn.innerText = "🚀 Send to Really Bot Server (Port 3000) →";
  }
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

document.addEventListener('DOMContentLoaded', () => {
  updateCartUI();
});
