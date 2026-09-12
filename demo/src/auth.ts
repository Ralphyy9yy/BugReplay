/**
 * Authentication service
 *
 * SECONDARY BUG (Incident #2):
 * getUserEmail() calls user.email.toLowerCase() without a null check.
 * When user.email is null (e.g., OAuth users without verified email),
 * this throws: TypeError: Cannot read properties of null (reading 'toLowerCase')
 */

export interface User {
  id: string;
  username: string;
  email: string | null;  // Email can be null for OAuth users
  role: 'admin' | 'user' | 'guest';
  lastLogin?: Date;
  sessionToken?: string;
}

export interface AuthResult {
  success: boolean;
  user?: User;
  token?: string;
  error?: string;
}

// In-memory session store (simplified for demo)
const sessions = new Map<string, User>();

/**
 * Authenticate a user by username and password.
 */
export async function authenticateUser(
  username: string,
  password: string,
): Promise<AuthResult> {
  // Simulated user lookup
  if (!username || !password) {
    return { success: false, error: 'Username and password are required' };
  }

  // Demo: hardcoded test users
  const mockUsers: User[] = [
    { id: 'usr_001', username: 'alice', email: 'alice@example.com', role: 'user' },
    { id: 'usr_002', username: 'bob', email: null, role: 'user' },    // ← OAuth user, no email
    { id: 'usr_003', username: 'admin', email: 'admin@example.com', role: 'admin' },
  ];

  const user = mockUsers.find((u) => u.username === username);

  if (!user || password !== 'password123') {
    return { success: false, error: `User ${username} failed to authenticate` };
  }

  const token = `sess_${Math.random().toString(36).slice(2)}`;
  user.sessionToken = token;
  user.lastLogin = new Date();
  sessions.set(token, user);

  return { success: true, user, token };
}

/**
 * Get the email address for a user.
 * 
 * BUG: Does not check if user.email is null before calling toLowerCase().
 * OAuth users can have email = null.
 */
export function getUserEmail(user: User): string {
  // ← BUG: user.email might be null
  return user.email.toLowerCase();  // TypeError: Cannot read properties of null (reading 'toLowerCase')
}

/**
 * Validate a session token.
 */
export function validateSession(token: string): User | null {
  return sessions.get(token) ?? null;
}

/**
 * Invalidate a session.
 */
export function logout(token: string): void {
  sessions.delete(token);
}

/**
 * Check if a user has admin privileges.
 */
export function isAdmin(user: User): boolean {
  return user.role === 'admin';
}

