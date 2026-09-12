// ============================================================
// BugReplay Domain Types
// ============================================================

// ── Log Parsing ─────────────────────────────────────────────

export type LogLevel = 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal' | 'unknown';

export interface StackFrame {
  functionName?: string;
  file: string;
  line: number;
  column?: number;
  isNative?: boolean;
  isInternal?: boolean; // node_modules or node: internals
}

export interface LogEvent {
  id: string;
  raw: string;
  timestamp?: Date;
  level: LogLevel;
  message: string;
  errorType?: string;
  errorMessage?: string;
  stackTrace?: StackFrame[];
  requestId?: string;
  sessionId?: string;
  userId?: string;
  httpMethod?: string;
  endpoint?: string;
  statusCode?: number;
  durationMs?: number;
  lineNumber: number; // line in original log file
  parseWarnings?: string[];
}

// ── Incidents ────────────────────────────────────────────────

export type IncidentStatus =
  | 'new'
  | 'analyzed'
  | 'reproduced'
  | 'fixed'
  | 'verified'
  | 'closed';

export interface Incident {
  id: number;
  title: string;
  errorType: string;
  normalizedMessage: string;
  occurrences: number;
  firstSeen?: Date;
  lastSeen?: Date;
  affectedFiles: string[];
  primaryFrame?: StackFrame;
  relatedEventIds: string[];
  status: IncidentStatus;
  logFile: string;
  projectRoot?: string;
  createdAt: Date;
}

// ── Evidence ─────────────────────────────────────────────────

export interface SourceSnippet {
  file: string;
  startLine: number;
  endLine: number;
  highlightLine?: number;
  code: string;
}

export interface GitCommitInfo {
  hash: string;
  shortHash: string;
  author: string;
  email: string;
  date: Date;
  message: string;
  daysAgo: number;
}

export interface GitBlameInfo {
  file: string;
  line: number;
  commit: GitCommitInfo;
  correlationScore?: number; // 0-100, deterministic heuristic
}

export interface GitInfo {
  blame?: GitBlameInfo[];
  recentCommits?: GitCommitInfo[];
  recentDiff?: string;
  isGitRepo: boolean;
}

export interface Evidence {
  incidentId: number;
  sourceSnippets: SourceSnippet[];
  stackTrace?: StackFrame[];
  relatedLogs: LogEvent[];
  gitInfo?: GitInfo;
  testFiles: string[];
  packageInfo?: Record<string, string>; // name -> version
  collectedAt: Date;
}

// ── AI Analysis ──────────────────────────────────────────────

export type EvidenceTag = 'FACT' | 'HYPOTHESIS' | 'ASSUMPTION';

export interface EvidencedClaim {
  claim: string;
  tag: EvidenceTag;
  sourceRef?: string; // e.g. "checkout.ts:184"
}

export interface IncidentAnalysis {
  incidentId: number;
  summary: string;
  rootCause: string;
  confidence: number; // 0-100
  facts: string[];
  hypotheses: string[];
  assumptions: string[];
  affectedFiles: string[];
  reproductionConditions: string[];
  suggestedFix?: string;
  uncertainty: string;
  generatedAt: Date;
  modelUsed?: string;
}

// ── Reproduction ─────────────────────────────────────────────

export interface ReproductionStep {
  order: number;
  description: string;
  code?: string;
}

export interface ReproductionPlan {
  incidentId: number;
  summary: string;
  steps: ReproductionStep[];
  preconditions: string[];
  expectedFailure: string;
  generatedTestPath?: string;
  testCode?: string;
  generatedAt: Date;
}

// ── Test Execution ───────────────────────────────────────────

export type TestResultStatus = 'passed' | 'failed' | 'error' | 'timeout' | 'skipped';

export interface TestResult {
  status: TestResultStatus;
  passed: boolean;
  output: string;
  exitCode: number;
  durationMs: number;
  testFile?: string;
  errorOutput?: string;
  failureReason?: string;
}

// ── Patch ────────────────────────────────────────────────────

export interface FilePatch {
  file: string;
  originalContent: string;
  patchedContent: string;
  diff: string;
  linesChanged: number;
}

export interface PatchProposal {
  incidentId: number;
  explanation: string;
  patches: FilePatch[];
  confidence: number; // 0-100
  warnings: string[];
  generatedAt: Date;
}

// ── Verification ─────────────────────────────────────────────

export interface VerificationResult {
  incidentId: number;
  phase: 'reproduction' | 'patch';
  testResult: TestResult;
  aiPrediction?: string;
  aiPredictionCorrect?: boolean;
  verifiedAt: Date;
}

// ── Storage ──────────────────────────────────────────────────

export interface BugReplayState {
  version: string;
  logFile?: string;
  projectRoot?: string;
  incidents: Incident[];
  analyses: Record<number, IncidentAnalysis>;
  reproductions: Record<number, ReproductionPlan>;
  patches: Record<number, PatchProposal>;
  verifications: Record<number, VerificationResult[]>;
  updatedAt: Date;
}

// ── Config ───────────────────────────────────────────────────

export interface BugReplayConfig {
  apiKey: string;
  provider: 'gemini' | 'openai' | 'anthropic';
  model: string;
  apiBaseUrl?: string;
  logLevel: 'debug' | 'info' | 'warn' | 'error';
  contextLines: number;
}

// ── AI Provider Interface ────────────────────────────────────

export interface AnalysisContext {
  incident: Incident;
  evidence: Evidence;
  logSample: LogEvent[];
}

export interface ReproductionContext {
  incident: Incident;
  analysis: IncidentAnalysis;
  evidence: Evidence;
}

export interface PatchContext {
  incident: Incident;
  analysis: IncidentAnalysis;
  evidence: Evidence;
  reproduction?: ReproductionPlan;
}

export interface AIProvider {
  analyzeIncident(ctx: AnalysisContext): Promise<IncidentAnalysis>;
  generateReproduction(ctx: ReproductionContext): Promise<ReproductionPlan>;
  generatePatch(ctx: PatchContext): Promise<PatchProposal>;
}

