/**
 * Payment API client
 * 
 * BUG: The processPayment function returns a response object WITHOUT an `id` field
 * on success. This is the root cause of incident #1.
 * 
 * The real payment gateway (Stripe, Braintree, etc.) always includes a transaction ID.
 * During a "Refactor payment processing" commit, the response mapper was updated
 * to use a new internal DTO format — but the `id` field was accidentally omitted.
 */

export interface PaymentRequest {
  orderId: string;
  amount: number;
  currency: string;
  customerId: string;
  cardToken: string;
}

export interface PaymentResponse {
  status: 'success' | 'failed' | 'pending';
  id?: string;           // BUG: This should always be present on success
  amount: number;
  currency: string;
  timestamp: string;
  gatewayCode?: string;
}

export interface PaymentError {
  code: string;
  message: string;
  retryable: boolean;
}

/**
 * Process a payment through the payment gateway.
 * Returns a PaymentResponse on success, throws PaymentError on failure.
 */
export async function processPayment(
  request: PaymentRequest,
): Promise<PaymentResponse> {
  // Simulate slight network latency
  await delay(5);

  // Simulate card decline (5% of requests)
  if (request.amount > 10000) {
    return {
      status: 'failed',
      amount: request.amount,
      currency: request.currency,
      timestamp: new Date().toISOString(),
      gatewayCode: 'INSUFFICIENT_FUNDS',
      // No id on failure — this is correct
    };
  }

  // SUCCESS RESPONSE — BUG: `id` field is missing!
  // It was present in the old implementation:
  //   return { id: generateTransactionId(), status: 'success', ... }
  // After the refactor, `id` was dropped from the response mapper.
  return {
    status: 'success',
    // id: generateTransactionId(),  ← REMOVED during refactor (the bug)
    amount: request.amount,
    currency: request.currency,
    timestamp: new Date().toISOString(),
    gatewayCode: 'APPROVED',
  };
}

/**
 * Validate a card token format.
 */
export function validateCardToken(token: string): boolean {
  return typeof token === 'string' && token.startsWith('tok_') && token.length > 10;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

