import { readFile, writeFile, mkdir, rename } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { existsSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import type {
  BugReplayState,
  Incident,
  IncidentAnalysis,
  ReproductionPlan,
  PatchProposal,
  VerificationResult,
} from '../types/index.js';

const STATE_VERSION = '0.1.0';
const STATE_DIR = '.bugreplay';
const STATE_FILE = 'state.json';

// ── Path resolution ──────────────────────────────────────────

export function getStateDir(projectRoot: string): string {
  return resolve(projectRoot, STATE_DIR);
}

export function getStatePath(projectRoot: string): string {
  return resolve(projectRoot, STATE_DIR, STATE_FILE);
}

// ── Load / Save ──────────────────────────────────────────────

function emptyState(): BugReplayState {
  return {
    version: STATE_VERSION,
    incidents: [],
    analyses: {},
    reproductions: {},
    patches: {},
    verifications: {},
    updatedAt: new Date(),
  };
}

export async function loadState(projectRoot: string): Promise<BugReplayState> {
  const path = getStatePath(projectRoot);

  if (!existsSync(path)) {
    return emptyState();
  }

  try {
    const raw = await readFile(path, 'utf8');
    const parsed = JSON.parse(raw) as BugReplayState;

    // Restore Date objects (JSON serializes them as strings)
    parsed.updatedAt = new Date(parsed.updatedAt);
    parsed.incidents = parsed.incidents.map((i) => ({
      ...i,
      firstSeen: i.firstSeen ? new Date(i.firstSeen) : undefined,
      lastSeen: i.lastSeen ? new Date(i.lastSeen) : undefined,
      createdAt: new Date(i.createdAt),
    }));

    for (const id of Object.keys(parsed.analyses)) {
      const a = parsed.analyses[Number(id)];
      if (a) {
        a.generatedAt = new Date(a.generatedAt);
        parsed.analyses[Number(id)] = a;
      }
    }

    return parsed;
  } catch (err) {
    // Corrupt state — start fresh with a warning
    console.warn(
      `Warning: Could not read state file at ${path}: ${err instanceof Error ? err.message : String(err)}\nStarting with fresh state.`,
    );
    return emptyState();
  }
}

async function saveState(state: BugReplayState, projectRoot: string): Promise<void> {
  const stateDir = getStateDir(projectRoot);
  await mkdir(stateDir, { recursive: true });

  const path = getStatePath(projectRoot);
  const tmpPath = path + '.tmp';

  state.updatedAt = new Date();
  const json = JSON.stringify(state, null, 2);

  // Atomic write: write to .tmp then rename
  await writeFile(tmpPath, json, 'utf8');
  await rename(tmpPath, path);
}

// ── Incidents ────────────────────────────────────────────────

export async function saveIncidents(
  incidents: Incident[],
  logFile: string,
  projectRoot: string,
): Promise<void> {
  const state = await loadState(projectRoot);
  state.incidents = incidents;
  state.logFile = logFile;
  state.projectRoot = projectRoot;
  // Reset derived data when rescanning
  state.analyses = {};
  state.reproductions = {};
  state.patches = {};
  state.verifications = {};
  await saveState(state, projectRoot);
}

export async function loadIncidents(projectRoot: string): Promise<Incident[]> {
  const state = await loadState(projectRoot);
  return state.incidents;
}

export async function getIncident(
  id: number,
  projectRoot: string,
): Promise<Incident | undefined> {
  const incidents = await loadIncidents(projectRoot);
  return incidents.find((i) => i.id === id);
}

export async function updateIncidentStatus(
  id: number,
  status: Incident['status'],
  projectRoot: string,
): Promise<void> {
  const state = await loadState(projectRoot);
  const incident = state.incidents.find((i) => i.id === id);
  if (incident) {
    incident.status = status;
    await saveState(state, projectRoot);
  }
}

// ── Analysis ─────────────────────────────────────────────────

export async function saveAnalysis(
  analysis: IncidentAnalysis,
  projectRoot: string,
): Promise<void> {
  const state = await loadState(projectRoot);
  state.analyses[analysis.incidentId] = analysis;
  await saveState(state, projectRoot);
}

export async function loadAnalysis(
  incidentId: number,
  projectRoot: string,
): Promise<IncidentAnalysis | undefined> {
  const state = await loadState(projectRoot);
  return state.analyses[incidentId];
}

// ── Reproduction ─────────────────────────────────────────────

export async function saveReproduction(
  plan: ReproductionPlan,
  projectRoot: string,
): Promise<void> {
  const state = await loadState(projectRoot);
  state.reproductions[plan.incidentId] = plan;
  await saveState(state, projectRoot);
}

export async function loadReproduction(
  incidentId: number,
  projectRoot: string,
): Promise<ReproductionPlan | undefined> {
  const state = await loadState(projectRoot);
  return state.reproductions[incidentId];
}

// ── Patches ──────────────────────────────────────────────────

export async function savePatch(
  patch: PatchProposal,
  projectRoot: string,
): Promise<void> {
  const state = await loadState(projectRoot);
  state.patches[patch.incidentId] = patch;
  await saveState(state, projectRoot);
}

export async function loadPatch(
  incidentId: number,
  projectRoot: string,
): Promise<PatchProposal | undefined> {
  const state = await loadState(projectRoot);
  return state.patches[incidentId];
}

// ── Verifications ────────────────────────────────────────────

export async function saveVerification(
  verification: VerificationResult,
  projectRoot: string,
): Promise<void> {
  const state = await loadState(projectRoot);
  if (!state.verifications[verification.incidentId]) {
    state.verifications[verification.incidentId] = [];
  }
  state.verifications[verification.incidentId]!.push(verification);
  await saveState(state, projectRoot);
}

export async function loadVerifications(
  incidentId: number,
  projectRoot: string,
): Promise<VerificationResult[]> {
  const state = await loadState(projectRoot);
  return state.verifications[incidentId] ?? [];
}

// ── Log events (stored as separate file due to size) ─────────

export async function saveLogEvents(
  events: unknown[],
  projectRoot: string,
): Promise<void> {
  const stateDir = getStateDir(projectRoot);
  await mkdir(stateDir, { recursive: true });
  const path = resolve(stateDir, 'events.json');
  await writeFile(path, JSON.stringify(events), 'utf8');
}

export async function loadLogEvents(projectRoot: string): Promise<unknown[]> {
  const path = resolve(getStateDir(projectRoot), 'events.json');
  if (!existsSync(path)) return [];
  try {
    const raw = await readFile(path, 'utf8');
    return JSON.parse(raw) as unknown[];
  } catch {
    return [];
  }
}

