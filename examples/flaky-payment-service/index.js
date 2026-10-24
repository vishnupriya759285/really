const http = require('http');

/**
 * Realistic Payment & Currency Conversion Service
 * This service contains a subtle edge-case bug:
 * When processing foreign currency transactions, it assumes the exchange rate response
 * always contains a 'cents' property. For currencies without fractional sub-units (e.g. JPY)
 * or when external rate payload has precision formatting, it crashes with:
 * TypeError: Cannot read properties of undefined (reading 'rate')
 */

async function processPayment(paymentRequest) {
  console.log(`[PaymentService] Initiating transaction for customer: ${paymentRequest.customerId}`);
  console.log(`[PaymentService] Amount: ${paymentRequest.amount} ${paymentRequest.currency}`);

  // Fetch exchange rate from external service
  const rateData = await fetchExchangeRate(paymentRequest.currency, 'USD');

  // BUG: Direct property access on nested conversion field without null check or default
  const exchangeRate = rateData.data.conversion.rate;
  const convertedAmount = paymentRequest.amount * exchangeRate;

  console.log(`[PaymentService] Converted amount: $${convertedAmount.toFixed(2)} USD`);

  return {
    status: 'success',
    transactionId: 'tx_' + Math.random().toString(36).substring(2, 9),
    originalAmount: paymentRequest.amount,
    currency: paymentRequest.currency,
    usdEquivalent: convertedAmount
  };
}

function fetchExchangeRate(fromCurrency, toCurrency) {
  return new Promise((resolve, reject) => {
    // In real app or under BugTwin, this hits the exchange API endpoint
    const mockPort = process.env.BUGTWIN_MOCK_PORT || 9876;
    const req = http.request(
      `http://localhost:${mockPort}/v1/rates?from=${fromCurrency}&to=${toCurrency}`,
      {
        headers: {
          'Authorization': 'Bearer test_secret_token_12345',
          'X-Customer-Email': 'alice@example.com'
        }
      },
      (res) => {
        let raw = '';
        res.on('data', chunk => raw += chunk);
        res.on('end', () => {
          try {
            resolve(JSON.parse(raw));
          } catch (e) {
            // If mock server not running, return the realistic payload that triggers the bug
            if (fromCurrency === 'JPY') {
              // Edge case payload: rate is top-level instead of nested under conversion
              resolve({
                base: 'JPY',
                target: 'USD',
                data: {
                  // Notice: missing 'conversion' object! It provides direct 'rawRate'
                  rawRate: 0.0067
                }
              });
            } else {
              resolve({
                data: { conversion: { rate: 1.08 } }
              });
            }
          }
        });
      }
    );

    req.on('error', () => {
      // Offline fallback simulating the edge-case response
      resolve({
        base: 'JPY',
        target: 'USD',
        data: {
          rawRate: 0.0067
        }
      });
    });

    req.end();
  });
}

// Entrypoint runner
async function main() {
  console.log('[PaymentService] Service starting...');
  const sampleRequest = {
    customerId: 'cust_9874',
    customerEmail: 'alice@example.com',
    cardNumber: '4111-2222-3333-4444',
    amount: 50000,
    currency: 'JPY'
  };

  const result = await processPayment(sampleRequest);
  console.log('[PaymentService] Result:', result);
}

if (require.main === module) {
  main().catch(err => {
    console.error('[PaymentService Fatal Crash]:', err);
    process.exit(1);
  });
}

module.exports = { processPayment };
