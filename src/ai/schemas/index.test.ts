import { describe, it, expect } from 'vitest';
import {
  parseAnalysisResponse,
  parseReproductionResponse,
  parsePatchResponse,
} from './index.js';

describe('parseAnalysisResponse', () => {
  it('accepts a valid analysis response', () => {
    const valid = {
      summary: 'Payment ID is undefined after API call',
      rootCause: 'checkout.js accesses payment.id but the payment API returns no id field',
      confidence: 91,
      facts: ['payment.id accessed at checkout.js:184', 'API response lacks id field'],
      hypotheses: ['Refactor changed API contract'],
      assumptions: ['API is the authoritative source'],
      affectedFiles: ['src/checkout.js', 'src/payment.js'],
      reproductionConditions: ['trigger checkout with valid cart', 'process payment'],
      suggestedFix: 'Use optional chaining: payment?.id',
      uncertainty: 'Cannot confirm without seeing payment API source',
    };
    expect(() => parseAnalysisResponse(valid)).not.toThrow();
    const result = parseAnalysisResponse(valid);
    expect(result.confidence).toBe(91);
  });

  it('rejects missing required fields', () => {
    const invalid = {
      summary: 'Something failed',
      // missing rootCause, confidence, etc.
    };
    expect(() => parseAnalysisResponse(invalid)).toThrow(/validation failed/i);
  });

  it('rejects confidence out of range', () => {
    const invalid = {
      summary: 'test',
      rootCause: 'test',
      confidence: 150, // invalid
      facts: ['fact'],
      hypotheses: [],
      assumptions: [],
      affectedFiles: [],
      reproductionConditions: ['step'],
      uncertainty: 'test',
    };
    expect(() => parseAnalysisResponse(invalid)).toThrow();
  });

  it('rejects empty facts array', () => {
    const invalid = {
      summary: 'test',
      rootCause: 'test',
      confidence: 80,
      facts: [], // must have min 1
      hypotheses: [],
      assumptions: [],
      affectedFiles: [],
      reproductionConditions: ['step'],
      uncertainty: 'test',
    };
    expect(() => parseAnalysisResponse(invalid)).toThrow();
  });
});

describe('parseReproductionResponse', () => {
  it('accepts a valid reproduction plan', () => {
    const valid = {
      summary: 'Trigger checkout with mock payment',
      steps: [
        { order: 1, description: 'Create order' },
        { order: 2, description: 'Process payment without id' },
        { order: 3, description: 'Call checkout — TypeError thrown' },
      ],
      preconditions: ['Node.js server running'],
      expectedFailure: "TypeError: Cannot read properties of undefined (reading 'id')",
      testCode: "import { describe, it, expect } from 'vitest';\nit('test', () => {});",
      testFileName: 'incident-001.test.ts',
    };
    expect(() => parseReproductionResponse(valid)).not.toThrow();
  });

  it('rejects empty steps', () => {
    const invalid = {
      summary: 'test',
      steps: [],
      preconditions: [],
      expectedFailure: 'TypeError',
      testCode: 'code',
      testFileName: 'test.ts',
    };
    expect(() => parseReproductionResponse(invalid)).toThrow();
  });
});

describe('parsePatchResponse', () => {
  it('accepts a valid patch proposal', () => {
    const valid = {
      explanation: 'Use optional chaining to guard against undefined payment',
      patches: [
        {
          file: 'src/checkout.js',
          explanation: 'Add optional chaining',
          originalSnippet: 'const id = payment.id;',
          patchedSnippet: 'const id = payment?.id;',
        },
      ],
      confidence: 88,
      warnings: ['Test after applying'],
    };
    expect(() => parsePatchResponse(valid)).not.toThrow();
  });

  it('rejects empty patches array', () => {
    const invalid = {
      explanation: 'Fix it',
      patches: [],
      confidence: 80,
      warnings: [],
    };
    expect(() => parsePatchResponse(invalid)).toThrow();
  });
});

