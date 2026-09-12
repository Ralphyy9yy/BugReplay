import { writeFile } from 'node:fs/promises';
import { mkdir } from 'node:fs/promises';

/**
 * Generates a realistic 1200+ line server log with 3 types of errors.
 * Used to create demo/logs/server.log
 */

function pad(n: number, len = 2): string {
  return String(n).padStart(len, '0');
}

function isoTime(date: Date): string {
  return date.toISOString();
}

function addMs(date: Date, ms: number): Date {
  return new Date(date.getTime() + ms);
}

const BASE_DATE = new Date('2024-01-15T08:00:00.000Z');
const ORDER_IDS = [
  'ord_7f3a9b2c', 'ord_4e1d8f5a', 'ord_9c6b2e1f', 'ord_3a5d7c8e',
  'ord_1b4f9e2d', 'ord_6c8a3f7b', 'ord_2d5e9a4c', 'ord_8b1c6d3a',
];
const CUSTOMER_IDS = [
  'cust_001', 'cust_002', 'cust_003', 'cust_004', 'cust_005',
  'cust_006', 'cust_007', 'cust_008',
];
const REQUEST_IDS = [
  'req_a1b2c3d4', 'req_e5f6a7b8', 'req_c9d0e1f2', 'req_a3b4c5d6',
  'req_e7f8a9b0', 'req_c1d2e3f4', 'req_a5b6c7d8', 'req_e9f0a1b2',
  'req_c3d4e5f6', 'req_a7b8c9d0', 'req_e1f2a3b4', 'req_c5d6e7f8',
];
const ENDPOINTS = [
  '/api/checkout', '/api/payment/process', '/api/orders', '/api/auth/login',
  '/api/cart', '/api/products', '/api/users/profile',
];

function randItem<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)] as T;
}

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// ── Log line generators ──────────────────────────────────────

function httpLog(ts: Date, method: string, endpoint: string, status: number, ms: number): string {
  return `${isoTime(ts)} INFO ${method} ${endpoint} ${status} ${ms}ms - requestId=${randItem(REQUEST_IDS)}`;
}

function infoLog(ts: Date, message: string): string {
  return `${isoTime(ts)} INFO ${message}`;
}

function warnLog(ts: Date, message: string): string {
  return `${isoTime(ts)} WARN ${message}`;
}

function errorLog(ts: Date, message: string): string {
  return `${isoTime(ts)} ERROR ${message}`;
}

// ── Primary bug stack trace (TypeError in checkout.ts) ───────

function typeErrorStack(ts: Date, orderId: string, customerId: string, reqId: string): string[] {
  const lines: string[] = [];
  lines.push(errorLog(ts, `Unhandled error processing checkout for order ${orderId} - requestId=${reqId} customerId=${customerId}`));
  lines.push(`TypeError: Cannot read properties of undefined (reading 'id')`);
  lines.push(`    at processCheckout (/app/src/checkout.ts:84:26)`);
  lines.push(`    at async handleCheckoutRequest (/app/src/routes/checkout.ts:31:22)`);
  lines.push(`    at async Layer.handle [as handle_request] (/app/node_modules/express/lib/router/layer.js:95:5)`);
  lines.push(`    at next (/app/node_modules/express/lib/router/route.js:144:13)`);
  lines.push(`    at Route.dispatch (/app/node_modules/express/lib/router/route.js:114:3)`);
  lines.push(`    at Layer.handle [as handle_request] (/app/node_modules/express/lib/router/layer.js:95:5)`);
  lines.push(`    at /app/node_modules/express/lib/router/index.js:284:15`);
  lines.push(`    at Function.process_params (/app/node_modules/express/lib/router/index.js:346:12)`);
  lines.push(`    at next (/app/node_modules/express/lib/router/index.js:280:10)`);
  lines.push(`    at /app/src/middleware/auth.ts:22:5`);
  return lines;
}

// ── Secondary bug stack trace (TypeError in auth.ts) ─────────

function authErrorStack(ts: Date, username: string, reqId: string): string[] {
  return [
    errorLog(ts, `Authentication error for user ${username} - requestId=${reqId}`),
    `TypeError: Cannot read properties of null (reading 'toLowerCase')`,
    `    at getUserEmail (/app/src/auth.ts:68:18)`,
    `    at sendWelcomeEmail (/app/src/notifications.ts:44:22)`,
    `    at async afterAuthMiddleware (/app/src/middleware/auth.ts:89:5)`,
    `    at Layer.handle [as handle_request] (/app/node_modules/express/lib/router/layer.js:95:5)`,
    `    at next (/app/node_modules/express/lib/router/route.js:144:13)`,
  ];
}

// ── Tertiary bug (DatabaseError in db.ts) ────────────────────

function dbErrorStack(ts: Date, orderId: string): string[] {
  return [
    errorLog(ts, `Database error while saving order ${orderId}`),
    `Error: Cannot call method on null — database not initialized`,
    `    at InMemoryDatabase.assertInitialized (/app/src/db.ts:51:13)`,
    `    at InMemoryDatabase.saveOrder (/app/src/db.ts:57:10)`,
    `    at async processCheckout (/app/src/checkout.ts:90:5)`,
    `    at async handleCheckoutRequest (/app/src/routes/checkout.ts:31:22)`,
    `    at async Layer.handle [as handle_request] (/app/node_modules/express/lib/router/layer.js:95:5)`,
  ];
}

// ── Build the log ─────────────────────────────────────────────

async function generateLog(): Promise<void> {
  const lines: string[] = [];
  let ts = BASE_DATE;

  // Startup sequence
  lines.push(infoLog(ts, 'Payment API server starting...'));
  ts = addMs(ts, 100);
  lines.push(infoLog(ts, 'Loading environment configuration'));
  ts = addMs(ts, 50);
  lines.push(infoLog(ts, 'Connecting to database...'));
  ts = addMs(ts, 200);
  lines.push(infoLog(ts, 'Database connection established'));
  ts = addMs(ts, 100);
  lines.push(infoLog(ts, 'Payment gateway client initialized'));
  ts = addMs(ts, 50);
  lines.push(infoLog(ts, 'Express server listening on port 3000'));
  ts = addMs(ts, 50);
  lines.push(infoLog(ts, ''));

  // Normal traffic phase (200 lines)
  for (let i = 0; i < 80; i++) {
    ts = addMs(ts, randInt(100, 800));
    const endpoint = randItem(ENDPOINTS.filter((e) => e !== '/api/checkout'));
    const status = Math.random() < 0.02 ? 404 : 200;
    lines.push(httpLog(ts, 'GET', endpoint, status, randInt(15, 180)));
  }

  ts = addMs(ts, 2000);
  lines.push(infoLog(ts, 'Payment refactor deployed — version 2.1.3'));
  ts = addMs(ts, 500);

  // First checkout errors start appearing (primary bug)
  let checkoutErrorCount = 0;
  let authErrorCount = 0;
  let dbErrorCount = 0;

  for (let i = 0; i < 400; i++) {
    ts = addMs(ts, randInt(200, 2000));
    const roll = Math.random();

    if (roll < 0.08 && checkoutErrorCount < 14) {
      // Primary bug: TypeError in checkout
      const orderId = randItem(ORDER_IDS);
      const customerId = randItem(CUSTOMER_IDS);
      const reqId = randItem(REQUEST_IDS);

      // Request comes in
      ts = addMs(ts, randInt(10, 50));
      lines.push(httpLog(ts, 'POST', '/api/checkout', 200, randInt(20, 60)));
      ts = addMs(ts, randInt(50, 150));
      lines.push(infoLog(ts, `Processing checkout for order ${orderId} - customerId=${customerId}`));
      ts = addMs(ts, randInt(30, 80));
      lines.push(infoLog(ts, `Payment gateway called - amount=${randInt(1000, 9999)} currency=USD`));
      ts = addMs(ts, randInt(60, 200));
      lines.push(infoLog(ts, `Payment gateway response received - status=success (no id in response)`));
      ts = addMs(ts, randInt(10, 30));

      // Error occurs
      for (const line of typeErrorStack(ts, orderId, customerId, reqId)) {
        lines.push(line);
      }
      ts = addMs(ts, 50);
      lines.push(httpLog(ts, 'POST', '/api/checkout', 500, randInt(200, 800)));
      checkoutErrorCount++;
    } else if (roll < 0.12 && authErrorCount < 8) {
      // Secondary bug: null email
      const username = randItem(['bob', 'charlie', 'diana', 'eve']);
      const reqId = randItem(REQUEST_IDS);

      lines.push(httpLog(ts, 'POST', '/api/auth/login', 200, randInt(30, 100)));
      ts = addMs(ts, randInt(20, 60));
      lines.push(infoLog(ts, `User ${username} authenticated successfully`));
      ts = addMs(ts, randInt(10, 30));
      lines.push(infoLog(ts, `Sending welcome notification to ${username}`));
      ts = addMs(ts, randInt(20, 50));

      for (const line of authErrorStack(ts, username, reqId)) {
        lines.push(line);
      }
      authErrorCount++;
    } else if (roll < 0.15 && dbErrorCount < 5) {
      // Tertiary bug: uninitialized DB
      const orderId = randItem(ORDER_IDS);
      lines.push(infoLog(ts, `Database connection pool health check initiated`));
      ts = addMs(ts, randInt(50, 150));

      for (const line of dbErrorStack(ts, orderId)) {
        lines.push(line);
      }
      dbErrorCount++;
    } else {
      // Normal traffic
      const endpoint = randItem(ENDPOINTS);
      const method = endpoint.includes('checkout') ? 'POST' : Math.random() < 0.3 ? 'POST' : 'GET';
      const status = Math.random() < 0.01 ? 404 : Math.random() < 0.005 ? 503 : 200;
      lines.push(httpLog(ts, method, endpoint, status, randInt(15, 300)));

      // Occasional warnings
      if (Math.random() < 0.02) {
        ts = addMs(ts, randInt(10, 30));
        lines.push(warnLog(ts, `Slow query detected: ${randInt(500, 2000)}ms on orders table`));
      }

      if (Math.random() < 0.01) {
        ts = addMs(ts, randInt(5, 15));
        lines.push(warnLog(ts, `Payment gateway response time elevated: ${randInt(800, 2000)}ms`));
      }
    }
  }

  // Tail: more normal traffic
  for (let i = 0; i < 100; i++) {
    ts = addMs(ts, randInt(100, 500));
    lines.push(httpLog(ts, 'GET', randItem(ENDPOINTS), 200, randInt(10, 200)));
  }

  lines.push(infoLog(ts, `Total requests served: ${lines.length}`));

  const content = lines.join('\n') + '\n';

  await mkdir('demo/logs', { recursive: true });
  await writeFile('demo/logs/server.log', content, 'utf8');
  console.log(`Generated server.log: ${lines.length} lines, ${checkoutErrorCount} checkout errors, ${authErrorCount} auth errors, ${dbErrorCount} DB errors`);
}

generateLog().catch(console.error);

