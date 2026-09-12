/**
 * Existing checkout tests — written BEFORE the payment refactor bug.
 * These tests only cover the happy path partially, which is why
 * the payment.id bug wasn't caught before it hit production.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// We import the module but mock the payment dependency
// NOTE: These tests are intentionally incomplete — they don't test
// that payment.id is present in the response (the bug).

describe('checkout validation', () => {
  it('rejects empty order ID', async () => {
    const { processCheckout } = await import('../src/checkout.js');

    await expect(
      processCheckout({
        orderId: '',
        customerId: 'cust_001',
        cardToken: 'tok_valid_card_123',
        items: [{ productId: 'prod_1', name: 'Widget', quantity: 1, unitPrice: 2999 }],
      }),
    ).rejects.toThrow('Order ID is required');
  });

  it('rejects empty cart', async () => {
    const { processCheckout } = await import('../src/checkout.js');

    await expect(
      processCheckout({
        orderId: 'ord_test_001',
        customerId: 'cust_001',
        cardToken: 'tok_valid_card_123',
        items: [], // empty cart
      }),
    ).rejects.toThrow('Cart cannot be empty');
  });

  it('rejects invalid card token', async () => {
    const { processCheckout } = await import('../src/checkout.js');

    await expect(
      processCheckout({
        orderId: 'ord_test_001',
        customerId: 'cust_001',
        cardToken: 'invalid_token', // doesn't start with tok_
        items: [{ productId: 'prod_1', name: 'Widget', quantity: 1, unitPrice: 2999 }],
      }),
    ).rejects.toThrow('Invalid card token format');
  });
});

describe('payment validation', () => {
  it('validates card token format', async () => {
    const { validateCardToken } = await import('../src/payment.js');

    expect(validateCardToken('tok_valid_abc123')).toBe(true);
    expect(validateCardToken('invalid')).toBe(false);
    expect(validateCardToken('')).toBe(false);
    expect(validateCardToken('tok_')).toBe(false); // too short
  });

  // NOTE: Missing test — "processPayment returns an id on success"
  // This test would have caught the bug:
  //
  // it('returns an id on successful payment', async () => {
  //   const { processPayment } = await import('../src/payment.js');
  //   const result = await processPayment({ ... });
  //   expect(result.id).toBeDefined(); // ← would fail with current code!
  // });
});

