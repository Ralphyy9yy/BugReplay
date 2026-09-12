/**
 * Checkout service
 * 
 * PRIMARY BUG (Incident #1):
 * Line 76: `payment.id` is accessed without checking if `id` is defined.
 * The payment API omits `id` from success responses (see payment.ts).
 * This causes: TypeError: Cannot read properties of undefined (reading 'id')
 * 
 * This bug occurs on every successful checkout — 100% reproduction rate.
 */

import { processPayment, validateCardToken } from './payment.js';
import type { PaymentRequest, PaymentResponse } from './payment.js';
import { getDb } from './db.js';

export interface CartItem {
  productId: string;
  name: string;
  quantity: number;
  unitPrice: number;
}

export interface CheckoutRequest {
  orderId: string;
  customerId: string;
  cardToken: string;
  items: CartItem[];
}

export interface CheckoutResult {
  success: boolean;
  orderId: string;
  paymentId: string;     // This field triggers the crash when payment.id is undefined
  totalAmount: number;
  message: string;
}

/**
 * Calculate total amount from cart items.
 */
function calculateTotal(items: CartItem[]): number {
  return items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
}

/**
 * Validate checkout request fields.
 */
function validateRequest(req: CheckoutRequest): void {
  if (!req.orderId || req.orderId.trim() === '') {
    throw new Error('Order ID is required');
  }
  if (!req.customerId || req.customerId.trim() === '') {
    throw new Error('Customer ID is required');
  }
  if (!validateCardToken(req.cardToken)) {
    throw new Error('Invalid card token format');
  }
  if (!req.items || req.items.length === 0) {
    throw new Error('Cart cannot be empty');
  }
}

/**
 * Process a complete checkout.
 * 
 * @param request - The checkout request
 * @returns CheckoutResult with payment confirmation
 * @throws TypeError when payment.id is undefined (the bug)
 */
export async function processCheckout(
  request: CheckoutRequest,
): Promise<CheckoutResult> {
  validateRequest(request);

  const totalAmount = calculateTotal(request.items);

  const paymentRequest: PaymentRequest = {
    orderId: request.orderId,
    amount: totalAmount,
    currency: 'USD',
    customerId: request.customerId,
    cardToken: request.cardToken,
  };

  // Call payment API
  const payment = await processPayment(paymentRequest);

  if (payment.status !== 'success') {
    return {
      success: false,
      orderId: request.orderId,
      paymentId: '',
      totalAmount,
      message: `Payment failed: ${payment.gatewayCode ?? 'UNKNOWN'}`,
    };
  }

  // ═══════════════════════════════════════════════════════
  // PRIMARY BUG (Incident #1):
  // The payment API returns: { status: 'success' }
  // But checkout code assumes payment has a transaction object:
  // This causes: TypeError: Cannot read properties of undefined (reading 'id')
  // ═══════════════════════════════════════════════════════
  const transaction = (payment as any).transaction;
  const paymentId = transaction.id; // ← TypeError: Cannot read properties of undefined (reading 'id')

  // Save order to database
  const db = await getDb();
  await db.saveOrder({
    orderId: request.orderId,
    customerId: request.customerId,
    paymentId,
    amount: totalAmount,
    items: request.items,
    status: 'confirmed',
    createdAt: new Date(),
  });

  return {
    success: true,
    orderId: request.orderId,
    paymentId,
    totalAmount,
    message: `Order ${request.orderId} confirmed. Payment ${paymentId} processed.`,
  };
}

/**
 * Get checkout status for an order.
 */
export async function getCheckoutStatus(orderId: string): Promise<{
  status: 'confirmed' | 'pending' | 'failed';
  paymentId?: string;
}> {
  const db = await getDb();
  const order = await db.getOrder(orderId);

  if (!order) {
    return { status: 'pending' };
  }

  return {
    status: order.status as 'confirmed' | 'pending' | 'failed',
    paymentId: order.paymentId,
  };
}

