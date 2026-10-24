const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.TEST_PORT || 4000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    app: 'ShopWave Cloud Testbed (External Application)',
    port: PORT,
    target_really_api: 'http://localhost:3000/api',
    timestamp: new Date().toISOString()
  });
});

// Bug 1: Checkout Tax Crash Endpoint
app.post('/api/checkout', (req, res) => {
  const { items } = req.body;
  if (!items || items.length === 0 || !items[0] || items[0].taxRate === undefined) {
    // Deliberate runtime exception simulating unhandled boundary condition
    try {
      const targetItem = items && items[0];
      const rate = targetItem.taxRate.multiplier; // Triggers TypeError
      return res.json({ success: true, tax: rate * 10 });
    } catch (err) {
      return res.status(500).json({
        error: 'Unhandled Exception in calculateItemTax',
        message: err.message,
        stack: err.stack,
        component: 'checkout-calculator',
        file: 'services/checkout.js:112:28'
      });
    }
  }
  res.json({ success: true, total: 149.00, message: 'Order processed successfully' });
});

// Bug 2: Webhook Endpoint missing customer
app.post('/api/webhooks/stripe', (req, res) => {
  const event = req.body;
  if (!event || !event.data || !event.data.object || !event.data.object.customer) {
    try {
      const customerId = event.data.object.customer.customer_id; // Triggers TypeError
      return res.json({ processed: true, customerId });
    } catch (err) {
      return res.status(500).json({
        error: 'TypeError: Cannot read properties of undefined (reading \'customer_id\')',
        message: err.message,
        stack: err.stack,
        component: 'billing-service',
        file: 'services/billing.js:142:32'
      });
    }
  }
  res.json({ processed: true });
});

// Bug 3: Auth Refresh Conflict
app.post('/api/auth/refresh', (req, res) => {
  const { simulateConflict } = req.body;
  if (simulateConflict) {
    return res.status(409).json({
      error: 'SessionTokenConflictError: Concurrent refresh token rotation detected for user_942',
      message: 'Token lock conflict occurred during simultaneous rotation request',
      stack: `SessionTokenConflictError: Concurrent refresh token rotation detected for user_942\n    at rotateRefreshToken (/app/services/auth.js:210:15)\n    at handleRefreshRequest (/app/services/auth.js:145:9)\n    at Layer.handle [as handle_request] (/app/node_modules/express/lib/router/layer.js:95:5)`,
      component: 'auth-service',
      file: 'services/auth.js:210:15'
    });
  }
  res.json({ token: 'jwt_mock_token_success_892', expiresIn: 3600 });
});

// Bug 4: Analytics Negative Offset Query
app.get('/api/analytics', (req, res) => {
  const page = parseInt(req.query.page || '1', 10);
  if (page < 0) {
    return res.status(500).json({
      error: 'DatabaseError: syntax error at or near "LIMIT" at character 142',
      message: 'syntax error in SQL string interpolation: OFFSET -10 LIMIT 10',
      stack: `DatabaseError: syntax error at or near "LIMIT" at character 142\n    at executeQuery (/app/services/db.js:52:19)\n    at generateAnalyticsReport (/app/services/analytics.js:104:11)\n    at processJob (/app/services/queue.js:83:7)`,
      component: 'analytics-worker',
      file: 'services/db.js:52:19'
    });
  }
  res.json({ analytics: { visitors: 1420, conversions: 84, revenue: 12400 } });
});

// Serve frontend
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`[ShopWave Test Website] Running independently on http://localhost:${PORT}`);
  console.log(`[ShopWave Test Website] Integrated with Really at http://localhost:3000`);
});
