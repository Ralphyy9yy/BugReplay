/**
 * Secret redaction — strips sensitive values before sending text to the LLM.
 * Conservative: prefers over-redaction to under-redaction.
 */

const REDACTION_PLACEHOLDER = '[REDACTED]';

interface RedactionPattern {
  name: string;
  pattern: RegExp;
}

const PATTERNS: RedactionPattern[] = [
  // Generic API keys (various prefixes)
  {
    name: 'api-key-prefix',
    pattern: /(?:api[_-]?key|apikey)\s*[:=]\s*["']?([A-Za-z0-9_\-./+]{16,128})["']?/gi,
  },
  // Bearer tokens
  {
    name: 'bearer-token',
    pattern: /bearer\s+([A-Za-z0-9\-._~+/]+=*)/gi,
  },
  // Authorization header values
  {
    name: 'authorization-header',
    pattern: /authorization\s*[:=]\s*["']?([^\s"',\n]{10,256})["']?/gi,
  },
  // AWS keys
  {
    name: 'aws-access-key',
    pattern: /(?:AKIA|AIPA|ASIA|AROA|ANPA|ANVA|APKA)[A-Z0-9]{16}/g,
  },
  {
    name: 'aws-secret',
    pattern: /(?:aws[_-]?secret|secret[_-]?access[_-]?key)\s*[:=]\s*["']?([A-Za-z0-9/+]{40})["']?/gi,
  },
  // Passwords
  {
    name: 'password',
    pattern: /(?:password|passwd|pwd)\s*[:=]\s*["']?([^\s"',\n]{4,128})["']?/gi,
  },
  // Private keys (PEM blocks)
  {
    name: 'pem-private-key',
    pattern: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----[\s\S]+?-----END (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g,
  },
  // JWT tokens (header.payload.signature)
  {
    name: 'jwt',
    pattern: /eyJ[A-Za-z0-9\-_]+\.eyJ[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+/g,
  },
  // Generic tokens / secrets
  {
    name: 'generic-token',
    pattern: /(?:token|secret|credential)\s*[:=]\s*["']?([A-Za-z0-9_\-./+]{16,256})["']?/gi,
  },
  // Connection strings with credentials
  {
    name: 'connection-string',
    pattern: /(?:mongodb|postgresql|mysql|redis|amqp):\/\/[^@\s]+:[^@\s]+@/gi,
  },
  // .env style assignments with long values
  {
    name: 'dotenv-secret',
    pattern: /^([A-Z_]{3,}(?:KEY|TOKEN|SECRET|PASSWORD|PASS|PWD|API|AUTH)[A-Z_]*)\s*=\s*(.+)$/gm,
  },
  // GitHub tokens
  {
    name: 'github-token',
    pattern: /gh[pousr]_[A-Za-z0-9_]{36,}/g,
  },
  // Stripe keys
  {
    name: 'stripe-key',
    pattern: /(?:sk|pk|rk)_(?:live|test)_[A-Za-z0-9]{24,}/g,
  },
  // Google API keys
  {
    name: 'google-api-key',
    pattern: /AIza[0-9A-Za-z\-_]{30,}/g,
  },
];

export interface RedactionResult {
  redacted: string;
  redactionCount: number;
  redactedTypes: string[];
}

export function redact(text: string): RedactionResult {
  let result = text;
  let redactionCount = 0;
  const redactedTypes: string[] = [];

  for (const { name, pattern } of PATTERNS) {
    // Reset lastIndex for global patterns
    pattern.lastIndex = 0;

    const before = result;
    result = result.replace(pattern, (match, ...groups) => {
      // For patterns with capture groups, only replace the sensitive part
      // while keeping the key name for context
      const sensitiveGroup = groups.find(
        (g) => typeof g === 'string' && g.length > 4,
      );

      if (sensitiveGroup && match.length > sensitiveGroup.length + 4) {
        // Replace only the value part, keep the key
        return match.replace(sensitiveGroup, REDACTION_PLACEHOLDER);
      }
      return REDACTION_PLACEHOLDER;
    });

    if (result !== before) {
      redactionCount++;
      if (!redactedTypes.includes(name)) {
        redactedTypes.push(name);
      }
    }
  }

  return { redacted: result, redactionCount, redactedTypes };
}

/**
 * Quick check — returns true if the text likely contains sensitive data.
 */
export function containsSensitiveData(text: string): boolean {
  return PATTERNS.some((p) => {
    p.pattern.lastIndex = 0;
    return p.pattern.test(text);
  });
}

/**
 * Redact a file path to remove home directory or sensitive segments.
 * Keeps the filename and last 2 path segments for readability.
 */
export function redactPath(filePath: string): string {
  const segments = filePath.replace(/\\/g, '/').split('/');
  const meaningful = segments.slice(-3); // keep last 3 segments
  return '.../' + meaningful.join('/');
}

