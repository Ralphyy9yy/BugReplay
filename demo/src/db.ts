/**
 * Database module
 *
 * TERTIARY BUG (Incident #3):
 * The `db` variable is used synchronously before the async initialization
 * resolves. Callers that call getDb() multiple times concurrently may get
 * the uninitialized singleton, leading to:
 * DatabaseError: Cannot call method on null — database not initialized
 */

export interface Order {
  orderId: string;
  customerId: string;
  paymentId: string;
  amount: number;
  items: unknown[];
  status: string;
  createdAt: Date;
}

export interface Database {
  saveOrder(order: Order): Promise<void>;
  getOrder(orderId: string): Promise<Order | null>;
  query<T>(sql: string, params?: unknown[]): Promise<T[]>;
}

// ── In-memory database for demo ──────────────────────────────

class InMemoryDatabase implements Database {
  private orders = new Map<string, Order>();
  private initialized = false;

  async initialize(): Promise<void> {
    // Simulate slow DB connection
    await new Promise((resolve) => setTimeout(resolve, 100));
    this.initialized = true;
  }

  private assertInitialized(): void {
    if (!this.initialized) {
      const err = new Error('Cannot call method on null — database not initialized');
      (err as Error & { code: string }).code = 'DB_NOT_INITIALIZED';
      throw err;
    }
  }

  async saveOrder(order: Order): Promise<void> {
    this.assertInitialized();
    this.orders.set(order.orderId, order);
  }

  async getOrder(orderId: string): Promise<Order | null> {
    this.assertInitialized();
    return this.orders.get(orderId) ?? null;
  }

  async query<T>(sql: string, params?: unknown[]): Promise<T[]> {
    this.assertInitialized();
    // Demo: always returns empty
    return [];
  }
}

// ── Singleton management (the bug lives here) ────────────────

let _db: InMemoryDatabase | null = null;
let _initPromise: Promise<void> | null = null;

/**
 * Get the database instance.
 *
 * BUG: If two concurrent callers call getDb() before initialization completes,
 * the first creates the init promise but returns _db before it's ready.
 * Subsequent calls that check `_db !== null` will return the uninitialized instance.
 *
 * This is a race condition in initialization — the fix is to return
 * the promise and await it, not return _db immediately after creating it.
 */
export async function getDb(): Promise<Database> {
  if (_db !== null) {
    return _db;
  }

  _db = new InMemoryDatabase();
  _initPromise = _db.initialize();
  await _initPromise;

  return _db;
}

/**
 * Properly initialized database getter (the fix would look like this).
 * Not used currently — exists for documentation purposes.
 */
export async function getDbFixed(): Promise<Database> {
  if (_db !== null && _initPromise !== null) {
    await _initPromise;
    return _db;
  }

  _db = new InMemoryDatabase();
  _initPromise = _db.initialize();
  await _initPromise;
  return _db;
}

